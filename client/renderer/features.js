'use strict';
/* Bubble – Zusatzfunktionen
   Themes & Schriften, Bilder/GIFs hochladen, Soundboard, eigene Töne, Einstellungen. */

// =====================================================================
// Themes & Schriften
// =====================================================================
let folderThemes = [];

function allThemes() {
  const custom = store.get('localThemes', []); // Fallback ohne Themes-Ordner (z.B. im Browser)
  return [...BUILTIN_THEMES, ...folderThemes.filter((t) => !t.error).map((t) => ({ ...t, group: 'Eigene Themes' })),
    ...custom.map((t) => ({ ...t, group: 'Eigene Themes' }))];
}

function currentTheme() {
  const id = store.get('themeId', 'bubble');
  return allThemes().find((t) => t.id === id) || BUILTIN_THEMES[0];
}

function appearanceOpts() {
  return {
    uiFont: fontStack(store.get('uiFont', '')),
    chatFont: fontStack(store.get('chatFont', '')),
    reduceMotion: store.get('reduceMotion', false),
    style: store.get('uiStyle', 'auto'),
  };
}
function fontStack(name) { return name ? `"${name.replace(/"/g, '')}", "Segoe UI", system-ui, sans-serif` : ''; }

function applyCurrentTheme(themeOverride) {
  const wasClassic = document.body.classList.contains('layout-classic');
  applyTheme(themeOverride || currentTheme(), appearanceOpts());
  document.documentElement.style.setProperty('--font-size', store.get('fontSize', 15) + 'px');
  if (wasClassic !== document.body.classList.contains('layout-classic') && typeof renderMessages === 'function' && S.me) renderMessages(true);
}

async function reloadFolderThemes() {
  if (!bridge.themes) return;
  try { folderThemes = await bridge.themes.list(); } catch { folderThemes = []; }
  const bad = folderThemes.filter((t) => t.error);
  if (bad.length) console.warn('Fehlerhafte Themes:', bad);
}

async function registerCustomFonts() {
  for (const f of store.get('customFonts', [])) {
    try {
      const face = new FontFace(f.family, `url("bubble-file://themes/${encodeURIComponent(f.file)}")`);
      await face.load();
      document.fonts.add(face);
    } catch (e) { console.warn('Schrift konnte nicht geladen werden:', f.family, e); }
  }
}

let installedFontsCache = null;
async function availableFonts() {
  if (!installedFontsCache) {
    const set = new Set(FONT_PRESETS);
    try {
      if (window.queryLocalFonts) for (const f of await window.queryLocalFonts()) set.add(f.family);
    } catch { /* Liste der Standardschriften reicht */ }
    installedFontsCache = [...set].sort((a, b) => a.localeCompare(b));
  }
  return [...new Set([...store.get('customFonts', []).map((f) => f.family), ...installedFontsCache])];
}

// =====================================================================
// Hochladen (Bilder, GIFs, Sounds)
// =====================================================================
function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => resolve(inp.files[0] || null);
    inp.click();
  });
}

async function uploadFile(file) {
  const type = file.type || ({ mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[(file.name.split('.').pop() || '').toLowerCase()] || '');
  let res;
  try {
    res = await fetch(S.serverUrl + '/api/upload', { method: 'POST', headers: { 'Content-Type': type, Authorization: 'Bearer ' + S.token }, body: file });
  } catch { throw new Error('Upload fehlgeschlagen – Server nicht erreichbar.'); }
  let data = null;
  try { data = await res.json(); } catch { /* egal */ }
  if (!res.ok) throw new Error(data?.error || (res.status === 413 ? 'Datei zu gross.' : `Upload-Fehler ${res.status}`));
  return data.path;
}

async function sendImage(file) {
  const ch = currentChannel();
  if (!ch || ch.type === 'voice') return;
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return toast('Nur Bilder und GIFs (PNG, JPG, GIF, WEBP).', 'error');
  toast('Wird hochgeladen …');
  try {
    const p = await uploadFile(file);
    const text = $('#input').value.trim();
    $('#input').value = '';
    $('#input').dispatchEvent(new Event('input'));
    S.socket.emit('message:send', { channelId: ch.id, content: (text ? text + '\n' : '') + fileUrl(p) }, (r) => { if (r?.error) toast(r.error, 'error'); });
  } catch (e) { toast(e.message, 'error'); }
}

async function changeGuildIcon(d) {
  const f = await pickFile('image/png,image/jpeg,image/gif,image/webp');
  if (!f) return;
  try {
    const p = await uploadFile(f);
    await api(`/api/guilds/${d.id}`, { method: 'PATCH', body: { icon: p } });
    toast('Gruppen-Icon geändert.');
  } catch (e) { toast(e.message, 'error'); }
}

function setupUploads() {
  const input = $('#attach-input');
  $('#attach').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) sendImage(input.files[0]); input.value = ''; });
  $('#input').addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); sendImage(f); }
  });
  const chat = $('#chat');
  let depth = 0;
  chat.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { depth++; $('#drop-hint').classList.remove('hidden'); } });
  chat.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) $('#drop-hint').classList.add('hidden'); });
  chat.addEventListener('dragover', (e) => e.preventDefault());
  chat.addEventListener('drop', (e) => {
    e.preventDefault(); depth = 0; $('#drop-hint').classList.add('hidden');
    const f = [...(e.dataTransfer?.files || [])][0];
    if (f) sendImage(f);
  });
}

// =====================================================================
// Soundboard
// =====================================================================
const SB = { sounds: [], loaded: false, cat: 'Alle', floating: false };
let sbCtx = null; let sbDest = null; let sbTrackPub = null; let sbPublishing = null;
const sbBuffers = new Map();

async function loadSounds(force = false) {
  if (SB.loaded && !force) return;
  try { SB.sounds = (await api('/api/sounds')).sounds; SB.loaded = true; } catch (e) { toast(e.message, 'error'); }
}

function sbCategories() {
  const cats = new Set(store.get('sbCats', ['Allgemein']));
  for (const s of SB.sounds) cats.add(s.category);
  return [...cats].sort((a, b) => a.localeCompare(b));
}

async function toggleSoundboard(floating = false) {
  const box = $('#soundboard');
  const open = !box.classList.contains('hidden');
  if (open && SB.floating === floating) { box.classList.add('hidden'); $('#sb-btn').classList.remove('open'); return; }
  SB.floating = floating;
  // Im Anruf ohne Chat: als schwebendes Fenster anzeigen
  if (floating) document.body.append(box); else $('.composer-wrap').append(box);
  box.classList.toggle('floating', floating);
  box.classList.remove('hidden');
  $('#sb-btn').classList.toggle('open', !floating);
  await loadSounds();
  renderSoundboard();
}

function renderSoundboard() {
  const box = $('#soundboard');
  if (box.classList.contains('hidden')) return;
  const live = !!(S.call && !S.call.connecting);
  const cats = sbCategories();
  if (SB.cat !== 'Alle' && !cats.includes(SB.cat)) SB.cat = 'Alle';
  const list = SB.sounds.filter((s) => SB.cat === 'Alle' || s.category === SB.cat);
  box.innerHTML = `
    <div class="sb-head"><strong>Soundboard</strong>
      <span class="sb-mode ${live ? 'live' : ''}" title="${live ? 'Sounds laufen live im Anruf' : 'Sounds werden als Nachricht in den Chat geschickt'}">${live ? '● Live im Call' : 'In den Chat'}</span>
      <button class="icon-btn" id="sb-add" title="Sound hochladen">${icon('plus', 18)}</button>
      <button class="icon-btn" id="sb-close" title="Schliessen">${icon('x', 18)}</button></div>
    <div class="sb-cats">
      ${['Alle', ...cats].map((c) => `<button class="sb-cat ${c === SB.cat ? 'active' : ''}" data-cat="${esc(c)}">${c === 'Alle' ? 'Alle' : '📁 ' + esc(c)}</button>`).join('')}
      <button class="sb-cat" id="sb-newcat" title="Neuer Ordner">+ Ordner</button>
    </div>
    <div class="sb-grid">
      ${list.length ? list.map((s) => `<button class="sb-sound" data-sid="${s.id}" title="${esc(s.name)} – Rechtsklick zum Bearbeiten"><span class="e">${esc(s.emoji || '🔊')}</span><span class="n">${esc(s.name)}</span><span class="more" data-more="${s.id}">⋯</span></button>`).join('')
    : `<div class="sb-empty">${SB.sounds.length ? 'Dieser Ordner ist leer.' : 'Noch keine Sounds.<br>Klick auf <strong>+</strong> und lade MP3, OGG, WAV oder M4A hoch (max. 5 MB).'}</div>`}
    </div>
    <div class="sb-foot"><span class="small muted">🔈</span><input type="range" id="sb-vol" min="0.05" max="1" step="0.05" value="${store.get('sbVolume', 0.8)}"><span class="small muted">🔊</span></div>`;

  $('#sb-close', box).onclick = () => { box.classList.add('hidden'); $('#sb-btn').classList.remove('open'); };
  $('#sb-add', box).onclick = () => addSoundDialog();
  $('#sb-newcat', box).onclick = () => newSoundFolderDialog();
  $('#sb-vol', box).oninput = (e) => store.set('sbVolume', Number(e.target.value));
  box.querySelectorAll('[data-cat]').forEach((b) => {
    b.onclick = () => { SB.cat = b.dataset.cat; renderSoundboard(); };
    b.oncontextmenu = (e) => {
      if (b.dataset.cat === 'Alle') return;
      e.preventDefault();
      folderMenu(e.clientX, e.clientY, b.dataset.cat);
    };
  });
  box.querySelectorAll('[data-sid]').forEach((b) => {
    const s = SB.sounds.find((x) => x.id === Number(b.dataset.sid));
    b.onclick = (e) => {
      if (e.target.closest('[data-more]')) { soundMenu(e.clientX, e.clientY, s); return; }
      triggerSound(s, b);
    };
    b.oncontextmenu = (e) => { e.preventDefault(); soundMenu(e.clientX, e.clientY, s); };
  });
}

async function triggerSound(s, btn) {
  btn?.classList.add('playing');
  setTimeout(() => btn?.classList.remove('playing'), 600);
  if (S.call && !S.call.connecting) {
    // Live in den Anruf – alle im Call hören es
    try { await playIntoCall(s); } catch (e) { toast('Soundboard: ' + e.message, 'error'); }
    return;
  }
  const ch = currentChannel();
  if (!ch || ch.type === 'voice') { toast('Öffne einen Chat oder tritt einem Call bei, um Sounds abzuspielen.'); return; }
  S.socket.emit('message:send', { channelId: ch.id, soundId: s.id }, (r) => { if (r?.error) toast(r.error, 'error'); });
  playChatSound(s.file, s.volume);
}

async function getBuffer(file) {
  if (sbBuffers.has(file)) return sbBuffers.get(file);
  const res = await fetch(fileUrl(file));
  if (!res.ok) throw new Error('Sound konnte nicht geladen werden.');
  const buf = await sbCtx.decodeAudioData(await res.arrayBuffer());
  sbBuffers.set(file, buf);
  return buf;
}

async function ensureSoundboardTrack() {
  const room = S.call.room;
  if (!sbCtx || sbCtx.state === 'closed') {
    sbCtx = new AudioContext();
    sbDest = sbCtx.createMediaStreamDestination();
    sbTrackPub = null;
  }
  if (sbCtx.state === 'suspended') await sbCtx.resume();
  if (!sbTrackPub) {
    if (!sbPublishing) {
      sbPublishing = room.localParticipant.publishTrack(sbDest.stream.getAudioTracks()[0], {
        name: 'soundboard', source: Track.Source.Unknown, dtx: false, red: false,
      }).then((pub) => { sbTrackPub = pub; }).finally(() => { sbPublishing = null; });
    }
    await sbPublishing;
  }
}

async function playIntoCall(s) {
  await ensureSoundboardTrack();
  const buf = await getBuffer(s.file);
  const src = sbCtx.createBufferSource();
  src.buffer = buf;
  const gain = sbCtx.createGain();
  gain.gain.value = (Number(s.volume) || 1) * store.get('sbVolume', 0.8);
  src.connect(gain);
  gain.connect(sbDest); // an alle im Call
  if (!S.deafened) {   // und selbst mithören
    const mon = sbCtx.createGain();
    mon.gain.value = store.get('outVolume', 1);
    gain.connect(mon).connect(sbCtx.destination);
  }
  src.start();
}

function resetSoundboardTrack() {
  try { sbCtx?.close(); } catch { /* egal */ }
  sbCtx = null; sbDest = null; sbTrackPub = null; sbPublishing = null;
  sbBuffers.clear();
}

async function addSoundDialog(prefCat) {
  const cats = sbCategories();
  modal(`
    <h2>Sound hinzufügen</h2>
    <form id="f">
      <label>Datei (MP3, OGG, WAV, M4A – max. 5 MB)<input type="file" name="file" accept="audio/*" required></label>
      <div class="row">
        <label>Name<input name="name" maxlength="32" required placeholder="z.B. Airhorn"></label>
        <label style="max-width:110px">Emoji<input name="emoji" maxlength="8" placeholder="📯"></label>
      </div>
      <label>Ordner<select name="category">${cats.map((c) => `<option ${c === (prefCat || (SB.cat !== 'Alle' ? SB.cat : '')) ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__new">+ Neuer Ordner …</option></select></label>
      <label id="newcat-wrap" class="hidden">Neuer Ordnername<input name="newcat" maxlength="30"></label>
      <div class="range-row">Lautstärke<input type="range" name="volume" min="0.1" max="1.5" step="0.05" value="1"><span class="val" id="vol-val">100%</span></div>
      <div class="modal-actions"><button type="button" class="btn ghost" id="test">▶ Probehören</button><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary">Hochladen</button></div>
    </form>`, {
    onMount(m, close) {
      const f = $('#f', m);
      f.file.onchange = () => { if (f.file.files[0] && !f.name.value) f.name.value = f.file.files[0].name.replace(/\.[^.]+$/, '').slice(0, 32); };
      f.category.onchange = () => $('#newcat-wrap', m).classList.toggle('hidden', f.category.value !== '__new');
      f.volume.oninput = () => { $('#vol-val', m).textContent = Math.round(f.volume.value * 100) + '%'; };
      let test = null;
      $('#test', m).onclick = () => {
        const file = f.file.files[0];
        if (!file) return;
        test?.pause();
        test = new Audio(URL.createObjectURL(file));
        test.volume = Math.min(1, f.volume.value * store.get('sbVolume', 0.8));
        test.play().catch(() => {});
      };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const file = f.file.files[0];
        if (!file) return;
        const category = f.category.value === '__new' ? f.newcat.value.trim() || 'Allgemein' : f.category.value;
        const btn = $('button.primary', f);
        btn.disabled = true; btn.textContent = 'Lädt hoch …';
        try {
          const p = await uploadFile(file);
          const r = await api('/api/sounds', { body: { name: f.name.value, emoji: f.emoji.value, category, file: p, volume: Number(f.volume.value) } });
          SB.sounds.push(r.sound);
          SB.sounds.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
          SB.cat = category;
          test?.pause();
          close();
          renderSoundboard();
          toast('Sound gespeichert.');
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Hochladen'; }
      };
    },
  });
}

function soundMenu(x, y, s) {
  contextMenu(x, y, [
    { label: '▶ Vorhören (nur für dich)', action: () => playChatSound(s.file, s.volume) },
    { label: 'Bearbeiten …', action: () => editSoundDialog(s) },
    ...sbCategories().filter((c) => c !== s.category).slice(0, 8).map((c) => ({ label: `Verschieben nach 📁 ${c}`, action: () => updateSound(s, { category: c }) })),
    '-',
    { label: 'Löschen', danger: true, action: async () => {
      if (await confirmDialog('Sound löschen', `„${s.name}“ löschen?`)) {
        try { await api(`/api/sounds/${s.id}`, { method: 'DELETE' }); SB.sounds = SB.sounds.filter((x) => x.id !== s.id); renderSoundboard(); } catch (e) { toast(e.message, 'error'); }
      }
    } },
  ]);
}

async function updateSound(s, patch) {
  try {
    const r = await api(`/api/sounds/${s.id}`, { method: 'PATCH', body: patch });
    Object.assign(s, r.sound);
    renderSoundboard();
  } catch (e) { toast(e.message, 'error'); }
}

function editSoundDialog(s) {
  modal(`<h2>Sound bearbeiten</h2>
    <form id="f">
      <div class="row"><label>Name<input name="name" maxlength="32" value="${esc(s.name)}" required></label>
      <label style="max-width:110px">Emoji<input name="emoji" maxlength="8" value="${esc(s.emoji || '')}"></label></div>
      <label>Ordner<input name="category" maxlength="30" value="${esc(s.category)}" list="sb-cat-list"><datalist id="sb-cat-list">${sbCategories().map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <div class="range-row">Lautstärke<input type="range" name="volume" min="0.1" max="1.5" step="0.05" value="${s.volume}"><span class="val" id="vol-val">${Math.round(s.volume * 100)}%</span></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary">Speichern</button></div>
    </form>`, {
    onMount(m, close) {
      const f = $('#f', m);
      f.volume.oninput = () => { $('#vol-val', m).textContent = Math.round(f.volume.value * 100) + '%'; };
      f.onsubmit = async (e) => {
        e.preventDefault();
        await updateSound(s, { name: f.name.value, emoji: f.emoji.value, category: f.category.value, volume: Number(f.volume.value) });
        close();
      };
    },
  });
}

function newSoundFolderDialog() {
  modal(`<h2>Neuer Ordner</h2><form id="f"><label>Name<input name="name" maxlength="30" required placeholder="z.B. Memes"></label>
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary">Erstellen</button></div></form>`, {
    onMount(m, close) {
      $('#f', m).onsubmit = (e) => {
        e.preventDefault();
        const name = e.target.name.value.trim().slice(0, 30);
        if (!name) return;
        store.set('sbCats', [...new Set([...store.get('sbCats', ['Allgemein']), name])]);
        SB.cat = name;
        close(); renderSoundboard();
      };
    },
  });
}

function folderMenu(x, y, cat) {
  contextMenu(x, y, [
    { label: 'Sound in diesen Ordner hochladen', action: () => addSoundDialog(cat) },
    { label: 'Ordner umbenennen …', action: () => {
      modal(`<h2>Ordner umbenennen</h2><form id="f"><label>Neuer Name<input name="name" maxlength="30" value="${esc(cat)}" required></label>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary">Speichern</button></div></form>`, {
        onMount(m, close) {
          $('#f', m).onsubmit = async (e) => {
            e.preventDefault();
            const to = e.target.name.value.trim().slice(0, 30);
            try {
              await api('/api/sounds/rename-category', { body: { from: cat, to } });
              store.set('sbCats', store.get('sbCats', ['Allgemein']).map((c) => (c === cat ? to : c)));
              await loadSounds(true); SB.cat = to; close(); renderSoundboard();
            } catch (err) { toast(err.message, 'error'); }
          };
        },
      });
    } },
    { label: 'Leeren Ordner entfernen', danger: true, action: () => {
      if (SB.sounds.some((s) => s.category === cat)) return toast('Der Ordner ist nicht leer – verschiebe oder lösche zuerst die Sounds.');
      store.set('sbCats', store.get('sbCats', []).filter((c) => c !== cat));
      SB.cat = 'Alle'; renderSoundboard();
    } },
  ]);
}

// =====================================================================
// Profilkarte (Bubble-Karte) & Aktivität
// =====================================================================
let myActivity = null;

function configureActivity() {
  bridge.activity?.configure({ game: store.get('actGame', true), music: store.get('actMusic', true), custom: store.get('customGames', {}) });
  if (!store.get('actGame', true) && !store.get('actMusic', true)) { myActivity = null; sendActivity(true); }
}

function sendActivity() {
  let a = myActivity;
  if (a) a = { game: store.get('actGame', true) ? a.game : null, music: store.get('actMusic', true) ? a.music : null };
  if (a && !a.game && !a.music) a = null;
  S.socket?.emit('activity:set', a);
  if (S.me) { S.me.activity = a; const u = S.users.get(S.me.id); if (u) u.activity = a; }
}

const fmtSince = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });

function profileCardHtml(user, preview = false) {
  const u = { ...user, ...(user.id ? S.users.get(user.id) : {}), ...(preview ? user : {}) };
  const isMe = S.me && u.id === S.me.id;
  const col = esc(u.color || '#7c5cff');
  const banner = u.banner
    ? `background:center / cover no-repeat url("${esc(fileUrl(u.banner))}")`
    : `background:radial-gradient(120% 140% at 0% 0%, ${col}, transparent 60%), radial-gradient(120% 140% at 100% 100%, color-mix(in srgb, ${col} 60%, #06b6d4), transparent 60%), color-mix(in srgb, ${col} 35%, #0a0a18)`;
  const a = u.activity;
  let now = '';
  if (a?.game) now += `<div class="pc-now game"><span class="pc-now-ic">🎮</span><span class="pc-now-txt"><small>Spielt gerade</small><strong>${esc(a.game)}</strong></span><span class="pc-pulse"></span></div>`;
  if (a?.music) {
    const i = a.music.indexOf(' - ');
    const artist = i > 0 ? a.music.slice(0, i) : '';
    const title = i > 0 ? a.music.slice(i + 3) : a.music;
    now += `<div class="pc-now music"><span class="pc-now-ic"><i></i><i></i><i></i><i></i></span><span class="pc-now-txt"><small>Hört auf Spotify</small><strong>${esc(title)}</strong>${artist ? `<em>${esc(artist)}</em>` : ''}</span></div>`;
  }
  const online = isMe ? S.connected : S.online.has(u.id);
  const inCall = !isMe && S.call?.room && [...S.call.room.remoteParticipants.values()].some((p) => String(p.identity) === String(u.id));
  const since = u.memberSince ? fmtSince.format(new Date(u.memberSince)) : '';
  return `
    <div class="pc-banner" style='${banner}'><span class="pc-chip ${online ? 'on' : ''}">${online ? '● online' : '○ offline'}</span></div>
    <div class="pc-head">
      <div class="pc-ring" style="--ring:${col}">${avatar(u, 92)}</div>
      <div class="pc-name">${esc(u.displayName || u.username)}</div>
      <div class="pc-user">@${esc(u.username || '')}${since ? ` · seit ${since}` : ''}</div>
    </div>
    <div class="pc-body">
      ${now}
      ${u.bio ? `<div class="pc-bio">${esc(u.bio).replace(/\n/g, '<br>')}</div>` : (isMe && preview ? '<div class="pc-bio muted">Noch keine Bio – erzähl etwas über dich.</div>' : '')}
      ${preview ? '' : `<div class="pc-actions">${isMe
    ? '<button class="pc-btn wide" data-pc="edit">Profil bearbeiten</button>'
    : `<button class="pc-btn wide" data-pc="dm">${icon('chat', 18)}<span>Schreiben</span></button><button class="pc-btn" data-pc="call" title="Anrufen">${icon('phone', 18)}</button><button class="pc-btn" data-pc="video" title="Videoanruf">${icon('video', 18)}</button>${inCall ? `<button class="pc-btn" data-pc="vol" title="Lautstärke">${icon('speaker', 18)}</button>` : ''}`}</div>`}
    </div>`;
}

let openCardUid = null;
function showProfile(uid, x, y) {
  const root = $('#menu-root');
  root.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'pcard pcard-pop';
  const u = uid === S.me.id ? S.me : userOf(uid);
  card.innerHTML = profileCardHtml(u);
  root.append(card);
  openCardUid = uid;
  // offsetWidth/-Height: unabhängig von der Einblend-Animation
  const w = card.offsetWidth; const h = card.offsetHeight;
  const left = x + w + 12 > innerWidth ? x - w - 12 : x + 12;
  card.style.left = Math.max(8, Math.min(left, innerWidth - w - 8)) + 'px';
  card.style.top = Math.max(8, Math.min(y - 40, innerHeight - h - 8)) + 'px';
  const close = () => { root.innerHTML = ''; openCardUid = null; document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', esc_); };
  const outside = (e) => { if (!card.contains(e.target)) close(); };
  const esc_ = (e) => { if (e.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', esc_); }, 0);
  card.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-pc]')?.dataset.pc;
    if (!act) return;
    if (act === 'vol') { const b = e.target.closest('[data-pc]').getBoundingClientRect(); close(); volumePopover(b.left, b.bottom + 6, uid); return; }
    close();
    if (act === 'edit') openSettings('profile');
    if (act === 'dm') startDmWith(uid);
    if (act === 'call' || act === 'video') { const dm = await startDmWith(uid); if (dm) startCall(dm.id, act === 'video'); }
  });
}

function refreshProfileCard(uid) {
  if (openCardUid !== uid) return;
  const card = $('.pcard-pop');
  if (card) card.innerHTML = profileCardHtml(uid === S.me.id ? S.me : userOf(uid));
}

// Klick auf eine Person öffnet jetzt die Profilkarte (ersetzt das einfache Menü)
function userMenu(x, y, uid) { showProfile(uid, x, y); }

// =====================================================================
// Lautstärke pro Person
// =====================================================================
function volumePopover(x, y, uid) {
  const u = userOf(uid);
  const root = $('#menu-root');
  root.innerHTML = '';
  const m = document.createElement('div');
  m.className = 'menu vol-pop';
  const v = Math.round(userVolume(uid) * 100);
  m.innerHTML = `<strong>Lautstärke: ${esc(u.displayName)}</strong>
    <div class="range-row"><input type="range" min="0" max="200" step="5" value="${v}"><span class="val">${v}%</span></div>
    <button class="btn small ghost" style="align-self:flex-start">Zurücksetzen</button>`;
  root.append(m);
  m.style.left = Math.min(x, innerWidth - 260) + 'px';
  m.style.top = Math.min(y, innerHeight - 120) + 'px';
  const range = $('input', m);
  const val = $('.val', m);
  range.oninput = () => { val.textContent = range.value + '%'; store.set('userVol.' + uid, range.value / 100); applyVolumes(); };
  $('button', m).onclick = () => { range.value = 100; range.oninput(); };
  const outside = (e) => { if (!m.contains(e.target)) { root.innerHTML = ''; document.removeEventListener('mousedown', outside, true); } };
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
}

// =====================================================================
// Einstellungen
// =====================================================================
async function listDevices() {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
  } catch { /* ohne Erlaubnis keine Gerätenamen */ }
  try { return await navigator.mediaDevices.enumerateDevices(); } catch { return []; }
}

function keyLabel(code) {
  return String(code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'Leertaste').replace('ControlLeft', 'Strg links')
    .replace('ControlRight', 'Strg rechts').replace('ShiftLeft', 'Shift links').replace('AltLeft', 'Alt links').replace('Backquote', '^');
}

async function openSettings(startTab = 'profile') {
  const devices = await listDevices();
  const opts = (kind, key) => {
    const cur = store.get(key, '');
    return '<option value="">Standard</option>' + devices.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== 'default')
      .map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || `Gerät ${i + 1}`)}</option>`).join('');
  };
  const chk = (key, def) => (store.get(key, def) ? 'checked' : '');
  const fonts = await availableFonts();
  const fontOpts = (key) => `<option value="">Vom Theme</option>` + fonts.map((f) => `<option value="${esc(f)}" ${store.get(key, '') === f ? 'selected' : ''} style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('');

  let cleanup = [];
  const close = modal(`
    <h2>Einstellungen</h2>
    <div class="tabs">
      <button class="tab" data-tab="profile">Profil</button>
      <button class="tab" data-tab="look">Themes</button>
      <button class="tab" data-tab="fonts">Schrift</button>
      <button class="tab" data-tab="av">Sprache & Video</button>
      <button class="tab" data-tab="sounds">Töne</button>
      <button class="tab" data-tab="account">Konto</button>
      <button class="tab" data-tab="about">Über</button>
    </div>

    <div class="tab-pane" data-pane="profile">
      <div class="pcard pcard-inline" id="pv-card">${profileCardHtml(S.me, true)}</div>
      <div class="upload-row">
        <button class="btn primary" id="up-avatar">Profilbild (auch GIF)</button>${S.me.avatar ? '<button class="btn" id="rm-avatar">Bild entfernen</button>' : ''}
        <button class="btn primary" id="up-banner">Banner (auch GIF)</button>${S.me.banner ? '<button class="btn" id="rm-banner">Banner entfernen</button>' : ''}
      </div>
      <label>Anzeigename<input id="set-name" maxlength="32" value="${esc(S.me.displayName)}"></label>
      <label>Über mich <span class="small muted" id="bio-count" style="text-transform:none">${(S.me.bio || '').length}/190</span><textarea id="set-bio" maxlength="190" rows="3" placeholder="Erzähl etwas über dich …">${esc(S.me.bio || '')}</textarea></label>
      <label>Farbe (falls kein Bild)</label>
      <div class="swatches">${COLORS.map((c) => `<button class="swatch ${c === S.me.color ? 'active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
      <div class="modal-actions"><button class="btn primary" id="save-profile">Speichern</button></div>
      <h3>Aktivität</h3>
      <label class="check"><input type="checkbox" id="act-game" ${chk('actGame', true)}> Zeigen, welches Spiel ich gerade spiele</label>
      <label class="check"><input type="checkbox" id="act-music" ${chk('actMusic', true)}> Zeigen, was ich auf Spotify höre (Spotify-App am PC)</label>
      <p class="small muted">Bubble erkennt über 60 bekannte Spiele automatisch. Fehlt eins? Füge es hier hinzu – den Namen der .exe findest du im Task-Manager unter „Details“.</p>
      <div id="custom-games" style="display:flex;flex-direction:column;gap:6px"></div>
      <form id="game-form" class="row" style="flex-direction:row">
        <label>Spielname<input name="name" maxlength="60" placeholder="z.B. Mein Lieblingsspiel" required></label>
        <label>Programm (.exe)<input name="exe" maxlength="80" placeholder="z.B. spiel.exe" required></label>
        <button class="btn" style="align-self:flex-end">Hinzufügen</button>
      </form>
    </div>

    <div class="tab-pane hidden" data-pane="look">
      <div class="theme-toolbar">
        <input class="field" id="theme-search" placeholder="Theme suchen …">
        <button class="btn small" id="theme-new">+ Eigenes Theme</button>
        <button class="btn small" id="theme-import">Importieren</button>
        ${bridge.themes ? '<button class="btn small" id="theme-folder">Ordner öffnen</button><button class="btn small" id="theme-reload">Neu laden</button>' : ''}
      </div>
      <label>Stil<select id="set-style">
        <option value="auto" ${store.get('uiStyle', 'auto') === 'auto' ? 'selected' : ''}>Automatisch (passend zum Theme)</option>
        <option value="bubble" ${store.get('uiStyle', 'auto') === 'bubble' ? 'selected' : ''}>Bubble – schwebende Glas-Panels & Chat-Blasen</option>
        <option value="classic" ${store.get('uiStyle', 'auto') === 'classic' ? 'selected' : ''}>Klassisch – durchgehende Spalten & Nachrichtenliste</option>
      </select></label>
      <div class="theme-grid" id="theme-grid"></div>
      <label class="check"><input type="checkbox" id="set-motion" ${chk('reduceMotion', false)}> Animationen & Videos im Hintergrund aus (spart Leistung)</label>
      <p class="small muted">Eigene Themes: im Editor zusammenklicken oder .json-Dateien (mit Videos, GIFs, Bildern) in den Themes-Ordner legen. Rechtsklick auf ein eigenes Theme zum Bearbeiten, Exportieren oder Löschen.</p>
    </div>

    <div class="tab-pane hidden" data-pane="fonts">
      <label>Schrift der Oberfläche<select id="font-ui">${fontOpts('uiFont')}</select></label>
      <label>Schrift im Chat<select id="font-chat">${fontOpts('chatFont')}</select></label>
      <div class="range-row">Schriftgrösse<input type="range" id="font-size" min="12" max="20" step="1" value="${store.get('fontSize', 15)}"><span class="val" id="font-size-val">${store.get('fontSize', 15)} px</span></div>
      <div class="profile-preview" id="font-preview" style="flex-direction:column;align-items:flex-start;gap:4px">
        <strong>Bubble – Vorschau</strong><span style="font-family:var(--font-chat)">Hey! Kommst du heute Abend in den Call? 🎮</span>
      </div>
      <div class="upload-row"><button class="btn" id="font-import">Eigene Schrift importieren (.ttf, .otf, .woff2)</button>
        ${store.get('customFonts', []).length ? '<button class="btn ghost" id="font-clear">Eigene Schriften entfernen</button>' : ''}</div>
    </div>

    <div class="tab-pane hidden" data-pane="av">
      <h3>Eingabe</h3>
      <label>Mikrofon<select id="set-mic">${opts('audioinput', 'micId')}</select></label>
      <div class="row"><button class="btn small" id="mic-test">🎙 Mikro testen</button><div class="meter" style="flex:1"><div id="mic-meter"></div></div></div>
      <label>Eingabemodus<select id="set-mode">
        <option value="voice" ${!isPtt() ? 'selected' : ''}>Sprachaktivierung (immer an, wenn nicht stumm)</option>
        <option value="ptt" ${isPtt() ? 'selected' : ''}>Push-to-Talk (Taste gedrückt halten)</option></select></label>
      <div class="row ${isPtt() ? '' : 'hidden'}" id="ptt-row"><span class="small">Push-to-Talk-Taste:</span><button class="btn small" id="ptt-key">${esc(keyLabel(store.get('pttKey', 'KeyV')))}</button><span class="small muted">funktioniert, solange Bubble im Vordergrund ist</span></div>
      <label class="check"><input type="checkbox" id="set-ns" ${chk('noiseSuppression', true)}> Rauschunterdrückung</label>
      <label class="check"><input type="checkbox" id="set-ec" ${chk('echoCancellation', true)}> Echo-Unterdrückung</label>
      <label class="check"><input type="checkbox" id="set-agc" ${chk('autoGain', true)}> Mikrofon-Lautstärke automatisch anpassen</label>
      <h3>Ausgabe</h3>
      <label>Lautsprecher / Kopfhörer<select id="set-speaker">${opts('audiooutput', 'speakerId')}</select></label>
      <div class="range-row">Lautstärke der anderen<input type="range" id="set-out" min="0" max="200" step="5" value="${Math.round(store.get('outVolume', 1) * 100)}"><span class="val" id="out-val">${Math.round(store.get('outVolume', 1) * 100)}%</span></div>
      <h3>Video</h3>
      <label>Kamera<select id="set-cam">${opts('videoinput', 'camId')}</select></label>
      <div class="row"><button class="btn small" id="cam-test">📷 Vorschau</button></div>
      <video id="cam-prev" class="cam-preview hidden" muted playsinline autoplay></video>
      <p class="small muted">Gerätewechsel gelten sofort, Rauschunterdrückung/Echo/Automatik ab dem nächsten Beitritt. Lautstärke einzelner Personen: im Call Rechtsklick auf die Person.</p>
    </div>

    <div class="tab-pane hidden" data-pane="sounds">
      <label class="check"><input type="checkbox" id="snd-off" ${chk('soundsOff', false)}> Alle App-Töne aus</label>
      <div class="range-row">Lautstärke der Töne<input type="range" id="snd-vol" min="0" max="1" step="0.05" value="${notifVolume()}"><span class="val" id="snd-vol-val">${Math.round(notifVolume() * 100)}%</span></div>
      <label class="check"><input type="checkbox" id="sb-auto" ${chk('sbAutoplay', true)}> Soundboard-Sounds im Chat automatisch abspielen</label>
      <h3>Eigene Töne</h3>
      <div id="sound-slots" style="display:flex;flex-direction:column;gap:6px"></div>
    </div>

    <div class="tab-pane hidden" data-pane="account">
      <p class="muted small">Angemeldet als <strong>@${esc(S.me.username)}</strong> auf <strong>${esc(S.serverUrl)}</strong>. Jede Person hat ihr eigenes Konto mit eigenem Passwort.</p>
      <form id="pw-form">
        <label>Aktuelles Passwort<input type="password" name="password" required autocomplete="current-password"></label>
        <label>Neues Passwort<input type="password" name="newPassword" required minlength="8" autocomplete="new-password"></label>
        <div class="modal-actions"><button class="btn">Passwort ändern</button></div>
      </form>
      <div class="modal-actions left"><button class="btn danger" id="logout">${icon('logout', 16)} Abmelden</button></div>
    </div>
    <div class="tab-pane hidden" data-pane="about" style="align-items:center;text-align:center;padding:16px 0">
      ${logo(96)}
      <h2 style="margin-top:8px">Bubble</h2>
      <p class="muted">Version ${esc(document.querySelector('meta[name=version]')?.content || '1.0.0')}</p>
      <p>Entwickelt von <strong>Erlin Ramaj</strong></p>
      <p class="small muted">© 2026 Erlin Ramaj. Chat, Sprache und Video für Freunde – auf deinem eigenen Server.</p>
    </div>
    <button class="modal-x" data-close title="Schliessen">${icon('x', 20)}</button>`, {
    wide: true,
    onMount(m, closeFn) {
      const showTab = (name) => {
        $$('.tab', m).forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
        $$('.tab-pane', m).forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== name));
      };
      $$('.tab', m).forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
      showTab(startTab);

      // ---- Profil ----
      let color = S.me.color;
      const previewCard = () => {
        $('#pv-card', m).innerHTML = profileCardHtml({ ...S.me, displayName: $('#set-name', m).value || S.me.displayName,
          bio: $('#set-bio', m).value, color }, true);
      };
      const saveMe = async (body) => {
        const r = await api('/api/me', { method: 'PATCH', body });
        S.me = { ...S.me, ...r.user }; cacheUser(r.user); render();
        previewCard();
      };
      $$('.swatch', m).forEach((s) => s.addEventListener('click', () => {
        color = s.dataset.color;
        $$('.swatch', m).forEach((x) => x.classList.toggle('active', x === s));
        previewCard();
      }));
      $('#set-name', m).addEventListener('input', previewCard);
      $('#set-bio', m).addEventListener('input', (e) => { $('#bio-count', m).textContent = e.target.value.length + '/190'; previewCard(); });
      $('#save-profile', m).onclick = async () => {
        try { await saveMe({ displayName: $('#set-name', m).value, color, bio: $('#set-bio', m).value }); toast('Gespeichert.'); } catch (e) { toast(e.message, 'error'); }
      };
      $('#up-banner', m).onclick = async () => {
        const f = await pickFile('image/png,image/jpeg,image/gif,image/webp');
        if (!f) return;
        try { toast('Wird hochgeladen …'); await saveMe({ banner: await uploadFile(f) }); toast('Banner geändert.'); } catch (e) { toast(e.message, 'error'); }
      };
      const rmb = $('#rm-banner', m);
      if (rmb) rmb.onclick = async () => { try { await saveMe({ banner: null }); rmb.remove(); } catch (e) { toast(e.message, 'error'); } };
      // Aktivität
      const renderGames = () => {
        const games = store.get('customGames', {});
        $('#custom-games', m).innerHTML = Object.entries(games).map(([exe, name]) => `<div class="sound-setting"><span class="name">🎮 ${esc(name)}</span><span class="file">${esc(exe)}</span><button class="btn small ghost" data-rm-game="${esc(exe)}">Entfernen</button></div>`).join('');
      };
      renderGames();
      $('#custom-games', m).addEventListener('click', (e) => {
        const b = e.target.closest('[data-rm-game]');
        if (!b) return;
        const games = store.get('customGames', {}); delete games[b.dataset.rmGame];
        store.set('customGames', games); renderGames(); configureActivity();
      });
      $('#game-form', m).onsubmit = (e) => {
        e.preventDefault();
        let exe = e.target.exe.value.trim().toLowerCase();
        if (!exe.endsWith('.exe')) exe += '.exe';
        store.set('customGames', { ...store.get('customGames', {}), [exe]: e.target.name.value.trim() });
        e.target.reset(); renderGames(); configureActivity();
        toast('Spiel hinzugefügt.');
      };
      $('#act-game', m).onchange = (e) => { store.set('actGame', e.target.checked); configureActivity(); };
      $('#act-music', m).onchange = (e) => { store.set('actMusic', e.target.checked); configureActivity(); };
      $('#up-avatar', m).onclick = async () => {
        const f = await pickFile('image/png,image/jpeg,image/gif,image/webp');
        if (!f) return;
        try { toast('Wird hochgeladen …'); await saveMe({ avatar: await uploadFile(f) }); toast('Profilbild geändert.'); } catch (e) { toast(e.message, 'error'); }
      };
      const rm = $('#rm-avatar', m);
      if (rm) rm.onclick = async () => { try { await saveMe({ avatar: null }); rm.remove(); } catch (e) { toast(e.message, 'error'); } };

      // ---- Themes ----
      const renderThemes = () => {
        const q = ($('#theme-search', m).value || '').toLowerCase();
        const cur = store.get('themeId', 'bubble');
        const groups = {};
        for (const t of allThemes()) {
          if (q && !t.name.toLowerCase().includes(q) && !(t.group || '').toLowerCase().includes(q)) continue;
          (groups[t.group || 'Eigene Themes'] ||= []).push(t);
        }
        const bad = folderThemes.filter((t) => t.error);
        $('#theme-grid', m).innerHTML = Object.entries(groups).map(([g, list]) => `<div class="theme-group">${esc(g)} (${list.length})</div>`
          + list.map((t) => `<button class="theme-card ${t.id === cur ? 'active' : ''}" data-theme="${esc(t.id)}">${themePreviewHtml(t)}<span class="theme-name">${esc(t.name)}</span></button>`).join('')).join('')
          + (bad.length ? `<div class="theme-group" style="color:var(--danger)">Fehlerhafte Dateien</div>${bad.map((t) => `<p class="small" style="grid-column:1/-1">${esc(t.file)}: ${esc(t.error)}</p>`).join('')}` : '');
      };
      renderThemes();
      $('#theme-search', m).oninput = renderThemes;
      $('#theme-grid', m).addEventListener('click', (e) => {
        const c = e.target.closest('[data-theme]');
        if (!c) return;
        store.set('themeId', c.dataset.theme);
        applyCurrentTheme(); renderThemes();
      });
      $('#theme-grid', m).addEventListener('contextmenu', (e) => {
        const c = e.target.closest('[data-theme]');
        if (!c) return;
        e.preventDefault();
        const t = allThemes().find((x) => x.id === c.dataset.theme);
        const own = t.group === 'Eigene Themes';
        contextMenu(e.clientX, e.clientY, [
          { label: own ? 'Bearbeiten …' : 'Als Vorlage für eigenes Theme', action: () => themeEditor(t, own, renderThemes) },
          { label: 'Exportieren (.json)', action: () => exportTheme(t) },
          own && '-',
          own && { label: 'Löschen', danger: true, action: async () => {
            if (!(await confirmDialog('Theme löschen', `„${t.name}“ löschen?`))) return;
            if (t.file) await bridge.themes.remove(t.file);
            else store.set('localThemes', store.get('localThemes', []).filter((x) => x.id !== t.id));
            await reloadFolderThemes();
            if (store.get('themeId') === t.id) store.set('themeId', 'bubble');
            applyCurrentTheme(); renderThemes();
          } },
        ]);
      });
      $('#theme-new', m).onclick = () => themeEditor(currentTheme(), false, renderThemes);
      $('#theme-import', m).onclick = async () => {
        const f = await pickFile('.json,application/json');
        if (!f) return;
        try {
          const t = JSON.parse(await f.text());
          if (!t || typeof t !== 'object' || !t.name) throw new Error('Das ist keine Theme-Datei (es fehlt "name").');
          await saveThemeObject(t);
          renderThemes();
          toast(`Theme „${t.name}“ importiert.`);
        } catch (e) { toast('Import fehlgeschlagen: ' + e.message, 'error'); }
      };
      const tf = $('#theme-folder', m); if (tf) tf.onclick = () => bridge.themes.openFolder();
      const tr = $('#theme-reload', m); if (tr) tr.onclick = async () => { await reloadFolderThemes(); applyCurrentTheme(); renderThemes(); toast('Themes neu geladen.'); };
      $('#set-motion', m).onchange = (e) => { store.set('reduceMotion', e.target.checked); applyCurrentTheme(); };
      $('#set-style', m).onchange = (e) => { store.set('uiStyle', e.target.value); applyCurrentTheme(); };

      // ---- Schrift ----
      $('#font-ui', m).onchange = (e) => { store.set('uiFont', e.target.value); applyCurrentTheme(); };
      $('#font-chat', m).onchange = (e) => { store.set('chatFont', e.target.value); applyCurrentTheme(); };
      $('#font-size', m).oninput = (e) => { store.set('fontSize', Number(e.target.value)); $('#font-size-val', m).textContent = e.target.value + ' px'; applyCurrentTheme(); };
      $('#font-import', m).onclick = async () => {
        const f = await pickFile('.ttf,.otf,.woff,.woff2');
        if (!f) return;
        if (!bridge.themes) return toast('Eigene Schriften gehen nur in der PC-App.', 'error');
        try {
          const file = await bridge.themes.saveFile(f.name, await f.arrayBuffer());
          const family = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
          const face = new FontFace(family, `url("bubble-file://themes/${encodeURIComponent(file)}")`);
          await face.load(); document.fonts.add(face);
          store.set('customFonts', [...store.get('customFonts', []).filter((x) => x.family !== family), { family, file }]);
          installedFontsCache = null;
          store.set('uiFont', family);
          applyCurrentTheme();
          toast(`Schrift „${family}“ importiert und aktiviert.`);
          closeFn(); openSettings('fonts');
        } catch (e) { toast('Schrift konnte nicht geladen werden: ' + e.message, 'error'); }
      };
      const fc = $('#font-clear', m);
      if (fc) fc.onclick = () => {
        const names = store.get('customFonts', []).map((x) => x.family);
        store.set('customFonts', []);
        if (names.includes(store.get('uiFont'))) store.set('uiFont', '');
        if (names.includes(store.get('chatFont'))) store.set('chatFont', '');
        applyCurrentTheme(); closeFn(); openSettings('fonts');
      };

      // ---- Sprache & Video ----
      const room = () => (S.call && !S.call.connecting ? S.call.room : null);
      let micStream = null; let micRaf = 0; let micCtx = null;
      const stopMicTest = () => {
        cancelAnimationFrame(micRaf);
        micStream?.getTracks().forEach((t) => t.stop()); micStream = null;
        try { micCtx?.close(); } catch { /* egal */ } micCtx = null;
        const bar = $('#mic-meter', m); if (bar) bar.style.width = '0%';
        const b = $('#mic-test', m); if (b) b.textContent = '🎙 Mikro testen';
      };
      cleanup.push(stopMicTest);
      $('#mic-test', m).onclick = async () => {
        if (micStream) return stopMicTest();
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: {
            deviceId: store.get('micId', '') || undefined, noiseSuppression: store.get('noiseSuppression', true),
            echoCancellation: store.get('echoCancellation', true), autoGainControl: store.get('autoGain', true) } });
          micCtx = new AudioContext();
          const an = micCtx.createAnalyser(); an.fftSize = 512;
          micCtx.createMediaStreamSource(micStream).connect(an);
          const data = new Uint8Array(an.fftSize);
          const loop = () => {
            an.getByteTimeDomainData(data);
            let peak = 0; for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
            $('#mic-meter', m).style.width = Math.min(100, (peak / 128) * 160) + '%';
            micRaf = requestAnimationFrame(loop);
          };
          loop();
          $('#mic-test', m).textContent = '⏹ Test stoppen';
        } catch (e) { toast('Mikrofon: ' + e.message, 'error'); stopMicTest(); }
      };
      $('#set-mic', m).onchange = (e) => {
        store.set('micId', e.target.value);
        room()?.switchActiveDevice('audioinput', e.target.value || 'default').catch(() => {});
        if (micStream) { stopMicTest(); $('#mic-test', m).click(); }
      };
      $('#set-mode', m).onchange = async (e) => {
        store.set('inputMode', e.target.value);
        $('#ptt-row', m).classList.toggle('hidden', e.target.value !== 'ptt');
        if (room() && !S.muted && !S.deafened) await room().localParticipant.setMicrophoneEnabled(!isPtt()).catch(() => {});
      };
      $('#ptt-key', m).onclick = (e) => {
        const btn = e.currentTarget;
        btn.textContent = 'Taste drücken …';
        const onKey = (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          if (ev.code !== 'Escape') store.set('pttKey', ev.code);
          btn.textContent = keyLabel(store.get('pttKey', 'KeyV'));
          document.removeEventListener('keydown', onKey, true);
        };
        document.addEventListener('keydown', onKey, true);
      };
      $('#set-ns', m).onchange = (e) => store.set('noiseSuppression', e.target.checked);
      $('#set-ec', m).onchange = (e) => store.set('echoCancellation', e.target.checked);
      $('#set-agc', m).onchange = (e) => store.set('autoGain', e.target.checked);
      $('#set-speaker', m).onchange = (e) => { store.set('speakerId', e.target.value); room()?.switchActiveDevice('audiooutput', e.target.value || 'default').catch(() => {}); };
      $('#set-out', m).oninput = (e) => { store.set('outVolume', e.target.value / 100); $('#out-val', m).textContent = e.target.value + '%'; applyVolumes(); };
      let camStream = null;
      const stopCam = () => { camStream?.getTracks().forEach((t) => t.stop()); camStream = null; const v = $('#cam-prev', m); if (v) { v.srcObject = null; v.classList.add('hidden'); } };
      cleanup.push(stopCam);
      $('#cam-test', m).onclick = async () => {
        if (camStream) return stopCam();
        try {
          camStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: store.get('camId', '') || undefined, width: 1280, height: 720 } });
          const v = $('#cam-prev', m); v.srcObject = camStream; v.classList.remove('hidden');
        } catch (e) { toast('Kamera: ' + e.message, 'error'); }
      };
      $('#set-cam', m).onchange = (e) => {
        store.set('camId', e.target.value);
        if (S.call?.video) room()?.switchActiveDevice('videoinput', e.target.value || 'default').catch(() => {});
        if (camStream) { stopCam(); $('#cam-test', m).click(); }
      };

      // ---- Töne ----
      $('#snd-off', m).onchange = (e) => store.set('soundsOff', e.target.checked);
      $('#snd-vol', m).oninput = (e) => { store.set('notifVolume', Number(e.target.value)); $('#snd-vol-val', m).textContent = Math.round(e.target.value * 100) + '%'; };
      $('#sb-auto', m).onchange = (e) => store.set('sbAutoplay', e.target.checked);
      const renderSlots = () => {
        const cs = store.get('customSounds', {});
        $('#sound-slots', m).innerHTML = Object.entries(SOUND_SLOTS).map(([slot, label]) => `
          <div class="sound-setting"><span class="name">${esc(label)}</span>
            <span class="file">${cs[slot] ? esc(cs[slot].name) : 'Standard'}</span>
            <button class="btn small" data-test-slot="${slot}">▶</button>
            <button class="btn small" data-pick-slot="${slot}">Wählen …</button>
            ${cs[slot] ? `<button class="btn small ghost" data-reset-slot="${slot}">Standard</button>` : ''}</div>`).join('')
          + (bridge.sounds ? '' : '<p class="small muted">Eigene Töne gehen nur in der PC-App.</p>');
      };
      renderSlots();
      let testAudio = null;
      $('#sound-slots', m).addEventListener('click', async (e) => {
        const t = e.target.closest('[data-test-slot]');
        const p = e.target.closest('[data-pick-slot]');
        const r = e.target.closest('[data-reset-slot]');
        if (t) {
          testAudio?.pause(); stopRing();
          const slot = t.dataset.testSlot;
          if (slot === 'ring' || slot === 'ringOut') { startRing(slot === 'ringOut'); setTimeout(stopRing, 4000); } else if (!(testAudio = playCustom(slot))) sounds[slot]?.();
        }
        if (p && bridge.sounds) {
          const f = await pickFile('audio/*');
          if (!f) return;
          try {
            const file = await bridge.sounds.saveFile(f.name, await f.arrayBuffer());
            store.set('customSounds', { ...store.get('customSounds', {}), [p.dataset.pickSlot]: { file, name: f.name } });
            renderSlots();
            toast('Ton gespeichert.');
          } catch (err) { toast(err.message, 'error'); }
        }
        if (r) {
          const cs = store.get('customSounds', {}); delete cs[r.dataset.resetSlot];
          store.set('customSounds', cs); renderSlots();
        }
      });
      cleanup.push(() => { testAudio?.pause(); stopRing(); });

      // ---- Konto ----
      $('#pw-form', m).onsubmit = async (e) => {
        e.preventDefault();
        try { await api('/api/me', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('Passwort geändert.'); } catch (err) { toast(err.message, 'error'); }
      };
      $('#logout', m).onclick = () => { closeFn(); logout(); };

      const obs = new MutationObserver(() => { if (!m.isConnected) { obs.disconnect(); cleanup.forEach((fn) => fn()); cleanup = []; } });
      obs.observe($('#modal-root'), { childList: true });
    },
  });
  void close;
}

// =====================================================================
// Theme-Editor
// =====================================================================
const EDITOR_COLORS = [
  ['accent', 'Akzentfarbe'], ['bg-guilds', 'Gruppenleiste'], ['bg-sidebar', 'Seitenleiste'], ['bg-main', 'Chat-Bereich'],
  ['bg-elev', 'Fenster & Menüs'], ['bg-input', 'Eingabefelder'], ['text', 'Text'], ['text-muted', 'Text (grau)'],
  ['text-strong', 'Überschriften'], ['accent-text', 'Text auf Akzent'], ['success', 'Online / Grün'], ['danger', 'Rot / Gefahr'],
];

function toHex(c) {
  const el = document.createElement('div');
  el.style.color = c; document.body.append(el);
  const m = getComputedStyle(el).color.match(/\d+(\.\d+)?/g) || [0, 0, 0, 1];
  el.remove();
  return { hex: '#' + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, '0')).join(''), alpha: m[3] !== undefined ? Number(m[3]) : 1 };
}
function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return a >= 1 ? hex : `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

async function saveThemeObject(t) {
  const clean = { ...t };
  delete clean.id; delete clean.file; delete clean.group; delete clean.error;
  if (bridge.themes) {
    const file = await bridge.themes.saveJson(clean.name, clean);
    await reloadFolderThemes();
    store.set('themeId', 'file:' + file);
  } else {
    const id = 'local:' + Date.now();
    store.set('localThemes', [...store.get('localThemes', []), { ...clean, id }]);
    store.set('themeId', id);
  }
  applyCurrentTheme();
}

function exportTheme(t) {
  const clean = { ...t };
  delete clean.id; delete clean.file; delete clean.group;
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (t.name || 'theme').replace(/[^a-zA-Z0-9 _-]/g, '_') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Theme exportiert – schick die Datei deinen Freunden!');
}

function themeEditor(base, editingOwn, onDone) {
  const t = JSON.parse(JSON.stringify(base));
  if (!editingOwn) { t.name = base.name + ' (eigenes)'; delete t.file; }
  t.colors = { ...t.colors };
  t.background = { ...(t.background || {}) };
  const original = currentTheme();
  const glassAlpha = () => toHex(themeColor(t, 'bg-main')).alpha;

  modal(`
    <h2>${editingOwn ? 'Theme bearbeiten' : 'Eigenes Theme'}</h2>
    <div class="row"><label>Name<input id="te-name" maxlength="40" value="${esc(t.name)}"></label>
      <label style="max-width:180px">Grundton<select id="te-dark"><option value="1" ${t.dark !== false ? 'selected' : ''}>Dunkel</option><option value="0" ${t.dark === false ? 'selected' : ''}>Hell</option></select></label></div>
    <h3>Farben</h3>
    <div class="editor-grid">${EDITOR_COLORS.map(([k, label]) => `<label class="color-row"><input type="color" data-key="${k}" value="${toHex(themeColor(t, k)).hex}"><span>${label}</span></label>`).join('')}</div>
    <h3>Hintergrund</h3>
    <div class="row">
      <label>Art<select id="te-bgtype">
        ${[['', 'Keiner'], ['color', 'Farbe'], ['gradient', 'Farbverlauf'], ['animated', 'Animierter Farbverlauf'], ['image', 'Bild oder GIF'], ['video', 'Video (MP4/WEBM)']]
    .map(([v, l]) => `<option value="${v}" ${(t.background.type || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label id="te-c1-wrap">Farbe 1<input type="color" id="te-c1" value="#4f46e5"></label>
      <label id="te-c2-wrap">Farbe 2<input type="color" id="te-c2" value="#db2777"></label>
    </div>
    <div class="row" id="te-file-row"><button class="btn small" id="te-file">Datei wählen …</button><span class="small muted" id="te-file-name">${esc(t.background.src || '')}</span>
      <input class="field" id="te-url" placeholder="… oder https-Link zu Bild/GIF/Video" value="${/^https?:/.test(t.background.src || '') ? esc(t.background.src) : ''}" style="flex:1"></div>
    <div class="range-row">Abdunkeln<input type="range" id="te-overlay" min="0" max="0.8" step="0.05" value="${Number((String(t.background.overlay || '').match(/[\d.]+\)$/) || ['0'])[0].replace(')', '')) || 0}"><span class="val" id="te-overlay-val"></span></div>
    <div class="range-row">Flächen-Deckkraft<input type="range" id="te-alpha" min="0.2" max="1" step="0.05" value="${glassAlpha()}"><span class="val" id="te-alpha-val"></span></div>
    <div class="range-row">Glas-Unschärfe<input type="range" id="te-blur" min="0" max="30" step="1" value="${parseInt(t.blur || '0', 10)}"><span class="val" id="te-blur-val"></span></div>
    <div class="range-row">Ecken-Rundung<input type="range" id="te-radius" min="0" max="20" step="1" value="${parseInt(t.radius || '8', 10)}"><span class="val" id="te-radius-val"></span></div>
    <details><summary class="small muted" style="cursor:pointer">Eigenes CSS (für Profis)</summary>
      <textarea class="field" id="te-css" rows="6" style="width:100%;font-family:Consolas,monospace;font-size:12px;margin-top:6px">${esc(t.css || '')}</textarea></details>
    <div class="modal-actions">
      <button class="btn ghost" id="te-cancel">Abbrechen</button>
      <button class="btn" id="te-export">Exportieren</button>
      <button class="btn primary" id="te-save">${bridge.themes ? 'Als Datei speichern' : 'Speichern'}</button>
    </div>`, {
    wide: true,
    onMount(m, close) {
      let saved = false;
      const bgType = $('#te-bgtype', m);
      const sync = () => {
        t.name = $('#te-name', m).value.trim() || 'Mein Theme';
        t.dark = $('#te-dark', m).value === '1';
        $$('input[data-key]', m).forEach((inp) => { t.colors[inp.dataset.key] = inp.value; });
        const a = Number($('#te-alpha', m).value);
        for (const k of ['bg-guilds', 'bg-sidebar', 'bg-main']) t.colors[k] = withAlpha(toHex(t.colors[k]).hex, a);
        t.colors['bg-hover'] = t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        t.colors['bg-active'] = t.dark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.09)';
        t.colors.border = t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
        t.colors.mention = withAlpha(toHex(t.colors.accent).hex, 0.15);
        const type = bgType.value;
        const c1 = $('#te-c1', m).value; const c2 = $('#te-c2', m).value;
        const url = $('#te-url', m).value.trim();
        if (url && (type === 'image' || type === 'video')) t.background.src = url;
        t.background.type = type || undefined;
        if (type === 'color') t.background.value = c1;
        if (type === 'gradient') t.background.value = `linear-gradient(135deg,${c1},${c2})`;
        if (type === 'animated') t.background.value = `linear-gradient(135deg,${c1},${c2},${c1},${c2})`;
        const ov = Number($('#te-overlay', m).value);
        t.background.overlay = ov > 0 ? `rgba(0,0,0,${ov})` : undefined;
        t.blur = $('#te-blur', m).value + 'px';
        t.radius = $('#te-radius', m).value + 'px';
        t.css = $('#te-css', m).value;
        $('#te-c1-wrap', m).classList.toggle('hidden', !['color', 'gradient', 'animated'].includes(type));
        $('#te-c2-wrap', m).classList.toggle('hidden', !['gradient', 'animated'].includes(type));
        $('#te-file-row', m).classList.toggle('hidden', !['image', 'video'].includes(type));
        $('#te-overlay-val', m).textContent = Math.round(ov * 100) + '%';
        $('#te-alpha-val', m).textContent = Math.round(a * 100) + '%';
        $('#te-blur-val', m).textContent = t.blur;
        $('#te-radius-val', m).textContent = t.radius;
        applyTheme(t, appearanceOpts()); // Live-Vorschau
      };
      m.addEventListener('input', sync);
      m.addEventListener('change', sync);
      sync();
      $('#te-file', m).onclick = async () => {
        const type = bgType.value;
        const f = await pickFile(type === 'video' ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/gif,image/webp');
        if (!f) return;
        if (!bridge.themes) { toast('Dateien gehen nur in der PC-App – nutze einen https-Link.', 'error'); return; }
        try {
          toast('Datei wird in den Themes-Ordner kopiert …');
          t.background.src = await bridge.themes.saveFile(f.name, await f.arrayBuffer());
          t.file = t.file || 'neu'; // damit der Pfad im Themes-Ordner gesucht wird
          $('#te-url', m).value = '';
          $('#te-file-name', m).textContent = t.background.src;
          sync();
        } catch (e) { toast(e.message, 'error'); }
      };
      $('#te-export', m).onclick = () => { sync(); exportTheme(t); };
      $('#te-save', m).onclick = async () => {
        sync();
        try {
          if (editingOwn && base.file && base.file !== t.name + '.json') await bridge.themes.remove(base.file);
          if (editingOwn && !base.file) store.set('localThemes', store.get('localThemes', []).filter((x) => x.id !== base.id));
          await saveThemeObject(t);
          saved = true; close(); onDone?.();
          toast('Theme gespeichert und aktiviert.');
        } catch (e) { toast(e.message, 'error'); }
      };
      $('#te-cancel', m).onclick = () => close();
      const obs = new MutationObserver(() => {
        if (!m.isConnected) { obs.disconnect(); if (!saved) applyTheme(original, appearanceOpts()); }
      });
      obs.observe($('#modal-root'), { childList: true });
    },
  });
}

// =====================================================================
// Start
// =====================================================================
function initFeatures() {
  applyCurrentTheme();
  registerCustomFonts().then(() => applyCurrentTheme());
  reloadFolderThemes().then(() => applyCurrentTheme());
  setupUploads();
  if (bridge.activity) {
    bridge.activity.onChange((a) => { myActivity = a; sendActivity(); });
    configureActivity();
  }
  $('#sb-btn').addEventListener('click', () => toggleSoundboard(false));
  // Rechtsklick auf jemanden im Call → Lautstärke
  $('#stage').addEventListener('contextmenu', (e) => {
    const tile = e.target.closest('.tile[data-uid]');
    if (!tile || tile.dataset.uid === String(S.me?.id)) return;
    e.preventDefault();
    volumePopover(e.clientX, e.clientY, Number(tile.dataset.uid));
  });
  // Soundboard-Anzeige aktualisieren, wenn sich der Call-Status ändert
  const origRender = window.renderVoicePanel;
  window.renderVoicePanel = function patched() { origRender(); renderSoundboard(); };
}
