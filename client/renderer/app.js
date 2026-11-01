'use strict';
/* Bubble – Oberfläche
   Gruppen & Kanäle, Chat-Blasen, Sprachkanäle, Anrufe, Video, Bildschirm teilen. */

const { Room, RoomEvent, Track } = window.LivekitClient;
const bridge = window.bubble || { onPickSource() {}, pickSource() {}, flash() {}, focusWindow() {}, platform: 'web' };

// ---------- Kleine Helfer ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = {
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/>',
  screen: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
  speaker: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  mug: '<path d="M5 9h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 12h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2"/><path d="M5 9a2.5 2.5 0 0 1 2.5-3 3 3 0 0 1 5 0A2.5 2.5 0 0 1 15 9"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
};
function icon(name, size = 20, extra = '') {
  let body = P[name] || '';
  if (name === 'micOff') body = P.mic + '<path d="M3 3l18 18"/>';
  if (name === 'headphonesOff') body = P.headphones + '<path d="M3 3l18 18"/>';
  if (name === 'videoOff') body = P.video + '<path d="M3 3l18 18"/>';
  if (name === 'hangup') body = `<g transform="rotate(135 12 12)">${P.phone}</g>`;
  return `<svg class="ic ${extra}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function logo(size = 32) {
  return `<img class="logo-img" src="../assets/icon.png" width="${size}" height="${size}" alt="Bubble" draggable="false">`;
}

const store = {
  get(k, d) { try { const v = localStorage.getItem('st.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('st.' + k, JSON.stringify(v)); } catch { /* egal */ } },
  del(k) { try { localStorage.removeItem('st.' + k); } catch { /* egal */ } },
};

const COLORS = ['#e8833a', '#5b8def', '#3fb87f', '#e5534b', '#d36ac2', '#20a5c9', '#9a7ff0', '#c9a227'];

// ---------- Zustand ----------
const S = {
  serverUrl: store.get('serverUrl', ''),
  token: store.get('token', null),
  me: null,
  guilds: [],
  dms: [],
  details: new Map(),        // guildId -> Detail (Kanäle, Mitglieder, Voice)
  view: { kind: 'home' },    // home | guild | dm
  messages: new Map(),       // channelId -> [Nachrichten]
  hasMore: new Map(),
  unread: new Set(),
  users: new Map(),          // userId -> Nutzer
  online: new Set(),
  voice: new Map(),          // channelId -> [Teilnehmer]
  typing: new Map(),         // channelId -> Map(userId -> Timer)
  socket: null,
  connected: false,
  call: null,                // { channelId, room, connecting, video, screen }
  muted: store.get('muted', false),
  deafened: false,
  speaking: new Set(),
  focusTile: null,
  ringing: null,
  outgoing: null,
};

// ---------- Allgemeine UI-Helfer ----------
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.classList.add('out'), 3500);
  setTimeout(() => t.remove(), 4000);
}

function initial(name) { return (String(name || '?').trim()[0] || '?').toUpperCase(); }
function guildInitials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}
const fileUrl = (p) => (p ? (/^https?:/i.test(p) ? p : S.serverUrl + p) : '');
function avatar(user, size = 32, extra = '') {
  const u = user || {};
  const inner = u.avatar
    ? `<img src="${esc(fileUrl(u.avatar))}" alt="" draggable="false" loading="lazy">`
    : esc(initial(u.displayName || u.username));
  return `<div class="avatar ${extra}" data-speak-uid="${esc(u.id)}" style="width:${size}px;height:${size}px;background:${esc(u.color || '#555')};font-size:${Math.round(size * 0.45)}px">${inner}</div>`;
}
function statusDot(uid) { return `<span class="status-dot ${S.online.has(uid) ? 'on' : ''}"></span>`; }

const fmtTime = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });
const fmtDate = new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
function formatWhen(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diffDays === 0) return 'Heute um ' + fmtTime.format(d);
  if (diffDays === 1) return 'Gestern um ' + fmtTime.format(d);
  return fmtDate.format(d) + ' ' + fmtTime.format(d);
}

function modal(html, { onMount, wide = false } = {}) {
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog">${html}</div>`;
  root.append(wrap);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  $$('[data-close]', wrap).forEach((b) => b.addEventListener('click', close));
  onMount?.(wrap.firstElementChild, close);
  const first = $('input, textarea, select', wrap);
  if (first) setTimeout(() => first.focus(), 30);
  return close;
}

function contextMenu(x, y, items) {
  const root = $('#menu-root');
  root.innerHTML = '';
  const m = document.createElement('div');
  m.className = 'menu';
  m.innerHTML = items.filter(Boolean).map((it, i) => it === '-' ? '<div class="menu-sep"></div>'
    : `<button class="menu-item ${it.danger ? 'danger' : ''}" data-i="${i}">${esc(it.label)}</button>`).join('');
  root.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  const close = () => { root.innerHTML = ''; document.removeEventListener('mousedown', outside, true); };
  const outside = (e) => { if (!m.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    close();
    items.filter(Boolean)[Number(b.dataset.i)].action();
  });
}

function confirmDialog(title, text, okLabel = 'Löschen') {
  return new Promise((resolve) => {
    let done = false;
    const close = modal(`
      <h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <div class="modal-actions"><button class="btn ghost" data-close>Abbrechen</button><button class="btn danger" id="ok">${esc(okLabel)}</button></div>`, {
      onMount(m, c) { $('#ok', m).onclick = () => { done = true; c(); resolve(true); }; },
    });
    const obs = new MutationObserver(() => { if (!done && !$('#modal-root').contains($('#ok'))) { obs.disconnect(); resolve(false); } });
    obs.observe($('#modal-root'), { childList: true });
    void close;
  });
}

// ---------- Töne ----------
let audioCtx = null;
function tone(freqs, dur = 0.12, gap = 0.02, vol = 0.08) {
  try {
    audioCtx = audioCtx || new AudioContext();
    let t = audioCtx.currentTime;
    for (const f of freqs) {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + dur + 0.02);
      t += dur + gap;
    }
  } catch { /* kein Ton */ }
}
// Eigene Töne (lokal im Sounds-Ordner gespeichert, in den Einstellungen wählbar)
const SOUND_SLOTS = {
  message: 'Neue Nachricht',
  connected: 'Call verbunden (du bist drin)',
  ring: 'Klingelton (eingehender Anruf)',
  ringOut: 'Freizeichen (ausgehender Anruf)',
  join: 'Jemand kommt in den Call',
  leave: 'Jemand verlässt den Call',
  mute: 'Stummschalten',
  unmute: 'Stummschaltung aufheben',
};
const customSoundUrl = (slot) => {
  const c = store.get('customSounds', {})[slot];
  return c && c.file ? 'bubble-file://sounds/' + encodeURIComponent(c.file) : '';
};
const notifVolume = () => store.get('notifVolume', 0.8);
function playCustom(slot, loop = false) {
  const url = customSoundUrl(slot);
  if (!url || store.get('soundsOff', false)) return null;
  const a = new Audio(url);
  a.volume = Math.min(1, notifVolume());
  a.loop = loop;
  const sink = store.get('speakerId', '');
  if (sink && a.setSinkId) a.setSinkId(sink).catch(() => {});
  a.play().catch(() => {});
  return a;
}
function playSlot(slot, fallback) {
  if (store.get('soundsOff', false)) return;
  if (!playCustom(slot)) fallback();
}
const sounds = {
  connected: () => playSlot('connected', () => tone([523, 659, 784, 1047], 0.09, 0.015, 0.08 * notifVolume())),
  join: () => playSlot('join', () => tone([520, 780], 0.12, 0.02, 0.08 * notifVolume())),
  leave: () => playSlot('leave', () => tone([780, 520], 0.12, 0.02, 0.08 * notifVolume())),
  message: () => playSlot('message', () => tone([880], 0.08, 0, 0.05 * notifVolume())),
  mute: () => playSlot('mute', () => tone([400], 0.07, 0.02, 0.08 * notifVolume())),
  unmute: () => playSlot('unmute', () => tone([600], 0.07, 0.02, 0.08 * notifVolume())),
};
let ringTimer = null;
let ringAudio = null;
function startRing(outgoing = false) {
  stopRing();
  ringAudio = playCustom(outgoing ? 'ringOut' : 'ring', true);
  if (ringAudio || store.get('soundsOff', false)) return;
  const v = notifVolume();
  const play = () => (outgoing ? tone([440, 440], 0.4, 0.2, 0.05 * v) : tone([660, 880, 660, 880], 0.15, 0.03, 0.09 * v));
  play();
  ringTimer = setInterval(play, outgoing ? 3000 : 2000);
}
function stopRing() {
  clearInterval(ringTimer); ringTimer = null;
  if (ringAudio) { ringAudio.pause(); ringAudio = null; }
}

// Sound-Nachricht im Chat abspielen
let chatSoundAudio = null;
function playChatSound(file, vol = 1) {
  if (chatSoundAudio) chatSoundAudio.pause();
  const a = new Audio(fileUrl(file));
  a.volume = Math.min(1, (Number(vol) || 1) * store.get('sbVolume', 0.8));
  const sink = store.get('speakerId', '');
  if (sink && a.setSinkId) a.setSinkId(sink).catch(() => {});
  a.play().catch(() => {});
  chatSoundAudio = a;
}

// ---------- Server-Zugriff ----------
async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(S.serverUrl + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error('Server nicht erreichbar. Stimmt die Adresse?');
  }
  let data = null;
  try { data = await res.json(); } catch { /* keine JSON-Antwort */ }
  if (res.status === 401 && S.token && !opts.noLogout) { logout(); }
  if (!res.ok) throw new Error(data?.error || `Fehler ${res.status}`);
  return data;
}

function cacheUser(u) {
  if (!u) return;
  const prev = S.users.get(u.id) || {};
  S.users.set(u.id, { ...prev, ...u });
  if (u.online === true) S.online.add(u.id);
  if (u.online === false) S.online.delete(u.id);
}
const userOf = (id) => S.users.get(Number(id)) || { id, displayName: 'Unbekannt', color: '#555' };

// ---------- Anmeldung ----------
function normalizeUrl(u) {
  u = String(u || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

function showAuth(mode = 'login', error = '') {
  $('#app').classList.add('hidden');
  const a = $('#auth');
  a.classList.remove('hidden');
  const reg = mode === 'register';
  a.innerHTML = `
    <form class="auth-card" id="auth-form" autocomplete="on">
      <div class="auth-logo">${logo(40)}</div>
      <h1>${reg ? 'Konto erstellen' : 'Willkommen zurück!'}</h1>
      <p class="muted">${reg ? 'Schön, dass du dabei bist.' : 'Melde dich an, um mit deinen Freunden zu reden.'}</p>
      <label>Server-Adresse<input name="server" placeholder="meinegruppe.duckdns.org" value="${esc(S.serverUrl)}" required></label>
      <label>Benutzername<input name="username" autocomplete="username" required></label>
      ${reg ? '<label>Anzeigename <span class="muted small">(optional)</span><input name="displayName" maxlength="32"></label>' : ''}
      <label>Passwort<input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required minlength="${reg ? 8 : 1}"></label>
      ${reg ? '<label>Registrierungs-Code <span class="muted small">(vom Server-Besitzer)</span><input name="inviteCode"></label>' : ''}
      <div class="auth-error">${esc(error)}</div>
      <button class="btn primary block" type="submit">${reg ? 'Registrieren' : 'Anmelden'}</button>
      <p class="small muted">${reg ? 'Schon ein Konto?' : 'Noch kein Konto?'} <a href="#" id="auth-switch">${reg ? 'Anmelden' : 'Registrieren'}</a></p>
    </form>`;
  $('#auth-switch').onclick = (e) => { e.preventDefault(); showAuth(reg ? 'login' : 'register'); };
  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    S.serverUrl = normalizeUrl(f.server);
    S.token = null;
    try {
      const res = await api(reg ? '/api/register' : '/api/login', { body: f, noLogout: true });
      S.token = res.token;
      store.set('serverUrl', S.serverUrl);
      store.set('token', S.token);
      boot();
    } catch (err) {
      $('.auth-error').textContent = err.message;
      btn.disabled = false;
    }
  };
}

function logout() {
  if (S.call) leaveVoice(true);
  S.socket?.disconnect();
  S.socket = null;
  S.token = null;
  store.del('token');
  S.details.clear(); S.messages.clear(); S.unread.clear(); S.voice.clear();
  showAuth('login');
}

// ---------- Start ----------
async function boot() {
  if (!S.serverUrl || !S.token) return showAuth('login');
  try {
    const me = await api('/api/me');
    S.me = me.user; cacheUser(me.user);
    S.guilds = me.guilds;
    setDms(me.dms);
  } catch (e) {
    return showAuth('login', S.token ? e.message : '');
  }
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  connectSocket();
  const last = store.get('lastView', null);
  if (last?.kind === 'guild' && S.guilds.some((g) => g.id === last.guildId)) await openGuild(last.guildId, last.channelId);
  else if (last?.kind === 'dm' && S.dms.some((d) => d.id === last.channelId)) await openDm(last.channelId);
  else openHome();
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}

function setDms(list) {
  S.dms = list;
  for (const d of list) { cacheUser(d.user); S.voice.set(d.id, d.voice || []); }
}

async function refreshMe() {
  try {
    const me = await api('/api/me');
    S.me = me.user; cacheUser(me.user);
    S.guilds = me.guilds;
    setDms(me.dms);
    render();
  } catch { /* später erneut */ }
}

// ---------- Echtzeit ----------
function connectSocket() {
  S.socket?.disconnect();
  const s = window.io(S.serverUrl, { auth: { token: S.token }, transports: ['websocket'], reconnectionDelayMax: 8000 });
  S.socket = s;
  s.on('connect', async () => {
    const wasDown = !S.connected && S.everConnected;
    S.connected = true; S.everConnected = true;
    $('#conn-banner').classList.add('hidden');
    if (S.call && !S.call.connecting) emitVoice(true);
    if (typeof sendActivity === 'function') sendActivity(true);
    if (wasDown) {
      await refreshMe();
      if (S.view.kind === 'guild') await loadGuild(S.view.guildId, true);
      const ch = S.view.channelId;
      if (ch && S.messages.has(ch)) { S.messages.delete(ch); await loadMessages(ch); renderMessages(true); }
      render();
    }
  });
  s.on('disconnect', () => { S.connected = false; $('#conn-banner').classList.remove('hidden'); });
  s.on('connect_error', (e) => { if (e.message === 'unauthorized') logout(); else $('#conn-banner').classList.remove('hidden'); });

  s.on('message:new', onMessage);
  s.on('message:deleted', ({ id, channelId }) => {
    const list = S.messages.get(channelId);
    if (!list) return;
    S.messages.set(channelId, list.filter((m) => m.id !== id));
    if (S.view.channelId === channelId) renderMessages(true);
  });
  s.on('typing', ({ channelId, userId }) => {
    if (!S.typing.has(channelId)) S.typing.set(channelId, new Map());
    const m = S.typing.get(channelId);
    clearTimeout(m.get(userId));
    m.set(userId, setTimeout(() => { m.delete(userId); renderTyping(); }, 4000));
    renderTyping();
  });
  s.on('presence', ({ userId, online }) => {
    if (online) S.online.add(userId); else S.online.delete(userId);
    for (const d of S.details.values()) { const m = d.members.find((x) => x.id === userId); if (m) m.online = online; }
    renderSidebar(); renderMembers(); renderHeader();
  });
  s.on('voice:update', ({ channelId, users }) => {
    const before = (S.voice.get(channelId) || []).length;
    S.voice.set(channelId, users);
    // Ausgehender Anruf: jemand ist beigetreten
    if (S.outgoing === channelId && users.some((u) => u.userId !== S.me.id)) { S.outgoing = null; stopRing(); }
    // Jemand ruft an, legt aber wieder auf, bevor wir abnehmen
    if (S.ringing?.channelId === channelId && users.length === 0 && before > 0) closeIncoming();
    renderSidebar(); renderHeader(); renderMain();
  });
  s.on('voice:kicked', ({ channelId }) => {
    if (S.call?.channelId === channelId) { leaveVoice(false); toast('Du bist jetzt auf einem anderen Gerät im Sprachkanal.'); }
  });
  s.on('guild:update', async ({ guildId }) => {
    if (!S.guilds.some((g) => g.id === guildId)) { await refreshMe(); return; }
    await loadGuild(guildId, true);
    const fresh = S.details.get(guildId);
    if (fresh) S.guilds = S.guilds.map((g) => (g.id === guildId ? { id: fresh.id, name: fresh.name, ownerId: fresh.ownerId, inviteCode: fresh.inviteCode, icon: fresh.icon } : g));
    if (S.view.kind === 'guild' && S.view.guildId === guildId && fresh && !fresh.channels.some((c) => c.id === S.view.channelId)) {
      await openGuild(guildId);
    } else render();
  });
  s.on('guild:deleted', ({ guildId }) => {
    S.guilds = S.guilds.filter((g) => g.id !== guildId);
    const d = S.details.get(guildId);
    S.details.delete(guildId);
    if (d && S.call && d.channels.some((c) => c.id === S.call.channelId)) leaveVoice(false);
    if (S.view.kind === 'guild' && S.view.guildId === guildId) { toast('Die Gruppe wurde gelöscht.'); openHome(); } else render();
  });
  s.on('dm:update', refreshMe);
  s.on('user:update', (u) => {
    cacheUser(u);
    if (u.id === S.me.id) S.me = { ...S.me, ...u };
    for (const d of S.details.values()) { const m = d.members.find((x) => x.id === u.id); if (m) Object.assign(m, u); }
    for (const d of S.dms) if (d.user.id === u.id) Object.assign(d.user, u);
    render();
  });
  s.on('call:incoming', onIncomingCall);
  s.on('activity', ({ userId, activity }) => {
    const u = S.users.get(userId);
    if (u) u.activity = activity;
    renderMembers(); renderSidebar();
    if (typeof refreshProfileCard === 'function') refreshProfileCard(userId);
  });
  s.on('call:declined', ({ channelId, userId }) => {
    if (S.outgoing === channelId) {
      S.outgoing = null; stopRing();
      toast(`${userOf(userId).displayName} hat den Anruf abgelehnt.`);
      if (S.call?.channelId === channelId && (S.voice.get(channelId) || []).every((u) => u.userId === S.me.id)) leaveVoice(true);
    }
  });
  s.on('call:cancelled', ({ channelId }) => { if (S.ringing?.channelId === channelId) closeIncoming(); });
}

// ---------- Daten laden ----------
async function loadGuild(gid, force = false) {
  if (!force && S.details.has(gid)) return S.details.get(gid);
  const d = await api(`/api/guilds/${gid}`);
  S.details.set(gid, d);
  for (const m of d.members) cacheUser(m);
  for (const [chId, users] of Object.entries(d.voice || {})) S.voice.set(Number(chId), users);
  return d;
}

async function loadMessages(chId, older = false) {
  if (!older && S.messages.has(chId)) return;
  const list = S.messages.get(chId) || [];
  const before = older && list[0] ? `?before=${list[0].id}` : '';
  const res = await api(`/api/channels/${chId}/messages${before}`);
  for (const m of res.messages) cacheUser(m.author);
  S.messages.set(chId, older ? [...res.messages, ...list] : res.messages);
  S.hasMore.set(chId, res.messages.length === 50);
}

// ---------- Navigation ----------
function currentChannel() {
  if (S.view.kind === 'guild') {
    const d = S.details.get(S.view.guildId);
    return d?.channels.find((c) => c.id === S.view.channelId) || null;
  }
  if (S.view.kind === 'dm') {
    const dm = S.dms.find((d) => d.id === S.view.channelId);
    return dm ? { id: dm.id, type: 'dm', name: dm.user.displayName, user: dm.user } : null;
  }
  return null;
}

function saveView() { store.set('lastView', S.view); }

function openHome() {
  S.view = { kind: 'home' };
  saveView();
  render();
}

async function openGuild(gid, channelId) {
  let d;
  try { d = await loadGuild(gid); } catch (e) { toast(e.message, 'error'); return openHome(); }
  const ch = (channelId && d.channels.find((c) => c.id === channelId && c.type === 'text'))
    || d.channels.find((c) => c.type === 'text')
    || (channelId && d.channels.find((c) => c.id === channelId))
    || d.channels[0];
  S.view = { kind: 'guild', guildId: gid, channelId: ch?.id };
  saveView();
  if (ch?.type === 'text') await openTextChannel(ch.id); else render();
}

async function openTextChannel(chId) {
  S.view = { ...S.view, channelId: chId };
  saveView();
  S.unread.delete(chId);
  render();
  try { await loadMessages(chId); } catch (e) { toast(e.message, 'error'); }
  if (S.view.channelId === chId) { renderMessages(); $('#input').focus(); }
  updateTitle();
}

async function openChannel(ch) {
  if (ch.type === 'voice') {
    S.view = { ...S.view, channelId: ch.id };
    saveView();
    render();
    if (S.call?.channelId !== ch.id) await joinVoice(ch.id);
  } else {
    await openTextChannel(ch.id);
  }
}

async function openDm(chId) {
  if (!S.dms.some((d) => d.id === chId)) await refreshMe();
  S.view = { kind: 'dm', channelId: chId };
  await openTextChannel(chId);
}

async function startDmWith(userOrName) {
  try {
    const body = typeof userOrName === 'number' ? { userId: userOrName } : { username: userOrName };
    const dm = await api('/api/dms', { body });
    if (!S.dms.some((d) => d.id === dm.id)) S.dms.unshift(dm);
    cacheUser(dm.user);
    S.voice.set(dm.id, dm.voice || []);
    await openDm(dm.id);
    return dm;
  } catch (e) { toast(e.message, 'error'); return null; }
}

// ---------- Nachrichten ----------
function onMessage(msg) {
  cacheUser(msg.author);
  const list = S.messages.get(msg.channelId);
  if (list && !list.some((m) => m.id === msg.id)) list.push(msg);
  const typing = S.typing.get(msg.channelId);
  if (typing) { clearTimeout(typing.get(msg.author.id)); typing.delete(msg.author.id); renderTyping(); }

  const viewing = S.view.channelId === msg.channelId;
  const mine = msg.author.id === S.me.id;
  if (viewing) renderMessages(true, mine);
  if (msg.sound && viewing && !mine && !S.deafened && store.get('sbAutoplay', true)) playChatSound(msg.sound.file, msg.sound.volume);
  if (mine) return;

  const isDm = !msg.guildId;
  if (isDm && !S.dms.some((d) => d.id === msg.channelId)) refreshMe();
  if (isDm) { // DM nach oben schieben
    const i = S.dms.findIndex((d) => d.id === msg.channelId);
    if (i > 0) S.dms.unshift(...S.dms.splice(i, 1));
  }
  if (!viewing || !document.hasFocus()) {
    if (!viewing) S.unread.add(msg.channelId);
    const mention = new RegExp(`@${S.me.username}\\b`, 'i').test(msg.content);
    if (isDm || mention) {
      sounds.message();
      notify(msg.author.displayName, msg.content, () => (isDm ? openDm(msg.channelId) : openGuild(msg.guildId, msg.channelId)));
      bridge.flash();
    }
  }
  renderGuildBar(); renderSidebar(); updateTitle();
}

function notify(title, body, onClick) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body: String(body).slice(0, 180), silent: true });
    n.onclick = () => { bridge.focusWindow(); onClick?.(); n.close(); };
  } catch { /* egal */ }
}

function updateTitle() {
  const n = S.unread.size;
  document.title = n ? `(${n}) Bubble` : 'Bubble';
}

function formatContent(text) {
  let s = esc(text);
  s = s.replace(/```([\s\S]+?)```/g, (_, c) => `<pre>${c.replace(/^\n/, '')}</pre>`);
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(https?:\/\/[^\s<>"']+)/g, (url) => {
    const clean = url.replace(/[.,!?)]+$/, '');
    const rest = url.slice(clean.length);
    const isImg = /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(clean);
    return `<a href="${clean}" target="_blank" rel="noopener">${clean}</a>${rest}`
      + (isImg ? `<br><img class="embed" src="${clean}" loading="lazy" alt="">` : '');
  });
  s = s.replace(/(^|\s)@([a-zA-Z0-9_.-]{3,24})/g, (m, pre, name) => {
    const me = S.me && name.toLowerCase() === S.me.username.toLowerCase();
    return `${pre}<span class="mention ${me ? 'me' : ''}">@${name}</span>`;
  });
  return s.replace(/\n/g, '<br>');
}

function renderMessages(keepScroll = false, forceBottom = false) {
  const box = $('#messages');
  const ch = currentChannel();
  if (!ch || ch.type === 'voice') { box.innerHTML = ''; return; }
  const list = S.messages.get(ch.id);
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const prevHeight = box.scrollHeight; const prevTop = box.scrollTop;

  if (!list) { box.innerHTML = '<div class="loading">Lade Nachrichten …</div>'; return; }

  const title = ch.type === 'dm' ? esc(ch.user.displayName) : '#' + esc(ch.name);
  let html = '';
  if (S.hasMore.get(ch.id)) html += '<button class="load-more" id="load-more">Ältere Nachrichten laden</button>';
  else html += `<div class="chat-start">${ch.type === 'dm' ? avatar(ch.user, 72) : `<div class="chat-start-icon">${icon('hash', 40)}</div>`}
      <h2>${ch.type === 'dm' ? title : 'Willkommen in ' + title + '!'}</h2>
      <p class="muted">${ch.type === 'dm' ? `Das ist der Anfang deiner Unterhaltung mit <strong>${esc(ch.user.displayName)}</strong>.` : 'Das ist der Anfang dieses Kanals.'}</p></div>`;

  let prev = null; let lastDay = '';
  for (const m of list) {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) {
      html += `<div class="day-divider"><span>${fmtDate.format(new Date(m.createdAt))}</span></div>`;
      lastDay = day; prev = null;
    }
    const grouped = prev && prev.author.id === m.author.id && m.createdAt - prev.createdAt < 5 * 60 * 1000;
    const author = userOf(m.author.id);
    const canDelete = m.author.id === S.me.id || (S.view.kind === 'guild' && S.details.get(S.view.guildId)?.ownerId === S.me.id);
    const mentionsMe = new RegExp(`@${S.me.username}\\b`, 'i').test(m.content);
    const mine = m.author.id === S.me.id;
    html += `<div class="msg ${grouped ? 'grouped' : ''} ${mentionsMe ? 'mentioned' : ''} ${mine ? 'mine' : ''}" data-id="${m.id}">
      ${grouped ? `<span class="msg-time-side">${fmtTime.format(new Date(m.createdAt))}</span>` : avatar(author, 40, 'msg-avatar')}
      <div class="msg-body">
        ${grouped ? '' : `<div class="msg-head"><span class="msg-author" style="color:${esc(author.color)}">${esc(author.displayName)}</span><span class="msg-time">${formatWhen(m.createdAt)}</span></div>`}
        <div class="msg-content">${m.sound
    ? `<button class="sound-msg" data-play-file="${esc(m.sound.file)}" data-vol="${Number(m.sound.volume) || 1}"><span class="play">▶</span><span class="emoji">${esc(m.sound.emoji || '🔊')}</span><span>${esc(m.sound.name)}</span></button>`
    : formatContent(m.content)}<span class="bubble-time">${fmtTime.format(new Date(m.createdAt))}</span></div>
      </div>
      ${canDelete ? `<button class="msg-delete" title="Löschen" data-del="${m.id}">${icon('trash', 16)}</button>` : ''}
    </div>`;
    prev = m;
  }
  box.innerHTML = html;
  box.classList.toggle('bubbles', !document.body.classList.contains('layout-classic'));
  $('#load-more')?.addEventListener('click', loadOlder);

  if (forceBottom || !keepScroll || atBottom) box.scrollTop = box.scrollHeight;
  else if (keepScroll === 'older') box.scrollTop = box.scrollHeight - prevHeight + prevTop;
  else box.scrollTop = prevTop;
}

async function loadOlder() {
  const ch = currentChannel();
  if (!ch) return;
  try { await loadMessages(ch.id, true); renderMessages('older'); } catch (e) { toast(e.message, 'error'); }
}

function renderTyping() {
  const ch = currentChannel();
  const box = $('#typing');
  const m = ch && S.typing.get(ch.id);
  const names = m ? [...m.keys()].filter((id) => id !== S.me?.id).map((id) => userOf(id).displayName) : [];
  if (!names.length) { box.innerHTML = ''; return; }
  const who = names.length === 1 ? `<strong>${esc(names[0])}</strong> schreibt` : names.length < 4
    ? `<strong>${names.map(esc).join(', ')}</strong> schreiben` : 'Mehrere Leute schreiben';
  box.innerHTML = `<span class="dots"><i></i><i></i><i></i></span> ${who} …`;
}

// Eingabefeld
let lastTypingSent = 0;
function setupComposer() {
  const input = $('#input');
  const resize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 220) + 'px'; };
  input.addEventListener('input', () => {
    resize();
    const ch = currentChannel();
    if (ch && Date.now() - lastTypingSent > 2500 && input.value.trim()) {
      lastTypingSent = Date.now();
      S.socket?.emit('typing', { channelId: ch.id });
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  $('#composer').addEventListener('submit', (e) => { e.preventDefault(); send(); });

  function send() {
    const ch = currentChannel();
    const content = input.value.trim();
    if (!ch || !content) return;
    if (!S.connected) { toast('Keine Verbindung zum Server.', 'error'); return; }
    input.value = ''; resize(); lastTypingSent = 0;
    S.socket.emit('message:send', { channelId: ch.id, content }, (res) => {
      if (res?.error) { toast(res.error, 'error'); input.value = content; resize(); }
    });
  }

  $('#messages').addEventListener('click', async (e) => {
    const snd = e.target.closest('[data-play-file]');
    if (snd) { playChatSound(snd.dataset.playFile, snd.dataset.vol); return; }
    const img = e.target.closest('img.embed');
    if (img) {
      const lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = `<img src="${esc(img.src)}" alt="">`;
      lb.onclick = () => lb.remove();
      document.body.append(lb);
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      if (e.shiftKey || await confirmDialog('Nachricht löschen', 'Willst du diese Nachricht wirklich löschen?')) {
        try { await api(`/api/messages/${del.dataset.del}`, { method: 'DELETE' }); } catch (err) { toast(err.message, 'error'); }
      }
      return;
    }
    const author = e.target.closest('.msg-author, .msg-avatar');
    if (author) {
      const id = Number(e.target.closest('.msg').dataset.id);
      const ch = currentChannel();
      const m = S.messages.get(ch.id)?.find((x) => x.id === id);
      if (m) userMenu(e.clientX, e.clientY, m.author.id);
    }
  });
  $('#messages').addEventListener('scroll', () => {
    const box = $('#messages');
    if (box.scrollTop < 40 && S.hasMore.get(S.view.channelId) && !box.dataset.loading) {
      box.dataset.loading = '1';
      loadOlder().finally(() => { delete box.dataset.loading; });
    }
  });
}

// ---------- Sprache & Video ----------
const videoEls = new Map(); // mediaStreamTrack.id -> { track, el }

function voicePayload() {
  return { muted: S.muted, deafened: S.deafened, video: !!S.call?.video, screen: !!S.call?.screen };
}
function emitVoice(join = false) {
  if (!S.call) return;
  S.socket?.emit(join ? 'voice:join' : 'voice:state', { channelId: S.call.channelId, state: voicePayload() });
}

function channelLabel(chId) {
  for (const d of S.details.values()) {
    const c = d.channels.find((x) => x.id === chId);
    if (c) return { title: c.name, sub: d.name };
  }
  const dm = S.dms.find((d) => d.id === chId);
  if (dm) return { title: dm.user.displayName, sub: 'Anruf' };
  return { title: 'Sprachkanal', sub: '' };
}

async function joinVoice(channelId, { video = false } = {}) {
  if (S.call?.channelId === channelId) return;
  if (S.call) await leaveVoice(false);
  let tok;
  try { tok = await api('/api/rtc/token', { body: { channelId } }); } catch (e) { toast(e.message, 'error'); return; }

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    webAudioMix: true,
    audioCaptureDefaults: {
      deviceId: store.get('micId', '') || undefined,
      echoCancellation: store.get('echoCancellation', true),
      noiseSuppression: store.get('noiseSuppression', true),
      autoGainControl: store.get('autoGain', true),
    },
    videoCaptureDefaults: {
      deviceId: store.get('camId', '') || undefined,
      resolution: { width: 1280, height: 720, frameRate: 30 },
    },
    publishDefaults: {
      screenShareEncoding: { maxBitrate: 4_000_000, maxFramerate: 30 },
    },
  });
  S.call = { channelId, room, connecting: true, video: false, screen: false };
  wireRoom(room);
  render();

  try {
    await room.connect(tok.url, tok.token);
  } catch (e) {
    toast('Sprachverbindung fehlgeschlagen: ' + e.message, 'error');
    S.call = null;
    room.disconnect();
    render();
    return;
  }
  if (S.call?.room !== room) return; // inzwischen verlassen
  const speaker = store.get('speakerId', '');
  if (speaker) room.switchActiveDevice('audiooutput', speaker).catch(() => {});
  if (!S.muted && !S.deafened && !isPtt()) {
    try { await room.localParticipant.setMicrophoneEnabled(true); } catch (e) { toast('Mikrofon nicht verfügbar: ' + e.message, 'error'); }
  }
  applyVolumes();
  S.call.connecting = false;
  sounds.connected();
  emitVoice(true);
  if (video) await toggleCamera(true);
  render();
}

async function leaveVoice(playSound = true) {
  const call = S.call;
  if (!call) return;
  S.call = null;
  S.focusTile = null;
  if (S.outgoing === call.channelId) {
    S.socket?.emit('call:cancel', { channelId: call.channelId });
    S.outgoing = null; stopRing();
  }
  S.socket?.emit('voice:leave');
  if (typeof resetSoundboardTrack === 'function') resetSoundboardTrack();
  try { await call.room.disconnect(); } catch { /* egal */ }
  for (const { track, el } of videoEls.values()) { try { track.detach(el); } catch { /* egal */ } }
  videoEls.clear();
  $('#audio-sink').innerHTML = '';
  S.speaking.clear();
  if (playSound) sounds.leave();
  render();
}

function wireRoom(room) {
  const mine = () => S.call?.room === room;
  room
    .on(RoomEvent.TrackSubscribed, (track) => {
      if (!mine()) return;
      if (track.kind === 'audio') {
        const el = track.attach();
        el.muted = S.deafened;
        $('#audio-sink').append(el);
        applyVolumes();
      }
      renderStage();
    })
    .on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
      if (mine()) renderStage();
    })
    .on(RoomEvent.ParticipantConnected, (p) => {
      if (!mine()) return;
      sounds.join();
      toast(`${participantName(p)} ist dazugekommen`);
      renderStage();
    })
    .on(RoomEvent.ParticipantDisconnected, (p) => {
      if (!mine()) return;
      sounds.leave();
      toast(`${participantName(p)} hat den Call verlassen`);
      renderStage();
    })
    .on(RoomEvent.LocalTrackPublished, () => { if (mine()) renderStage(); })
    .on(RoomEvent.LocalTrackUnpublished, (pub) => {
      if (!mine()) return;
      if (pub.source === Track.Source.ScreenShare && S.call.screen) { S.call.screen = false; emitVoice(); renderVoicePanel(); }
      if (pub.source === Track.Source.Camera && S.call.video) { S.call.video = false; emitVoice(); renderVoicePanel(); }
      renderStage();
    })
    .on(RoomEvent.TrackMuted, () => { if (mine()) renderStage(); })
    .on(RoomEvent.TrackUnmuted, () => { if (mine()) renderStage(); })
    .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      if (!mine()) return;
      S.speaking = new Set(speakers.map((p) => String(p.identity)));
      updateSpeaking();
    })
    .on(RoomEvent.Reconnecting, () => { if (mine()) { S.call.reconnecting = true; renderVoicePanel(); } })
    .on(RoomEvent.Reconnected, () => { if (mine()) { S.call.reconnecting = false; renderVoicePanel(); } })
    .on(RoomEvent.Disconnected, () => {
      if (mine()) { toast('Sprachverbindung getrennt.'); leaveVoice(false); }
    });
}

// Lautstärke: Gesamt-Ausgabe × pro Person (Rechtsklick auf jemanden im Call)
function userVolume(uid) { return store.get('userVol.' + uid, 1); }
function applyVolumes() {
  const room = S.call?.room;
  if (!room) return;
  const master = store.get('outVolume', 1);
  for (const p of room.remoteParticipants.values()) {
    try { p.setVolume(S.deafened ? 0 : master * userVolume(p.identity)); } catch { /* egal */ }
  }
}

// Push-to-Talk (funktioniert, solange das Bubble-Fenster aktiv ist)
const isPtt = () => store.get('inputMode', 'voice') === 'ptt';
let pttDown = false;
async function setPtt(down) {
  if (pttDown === down) return;
  pttDown = down;
  if (!S.call?.room || S.call.connecting || S.muted || S.deafened) return;
  try { await S.call.room.localParticipant.setMicrophoneEnabled(down); } catch { /* egal */ }
  if (down) sounds.unmute(); else sounds.mute();
}
document.addEventListener('keydown', (e) => {
  if (!isPtt() || e.repeat || e.code !== store.get('pttKey', 'KeyV')) return;
  if (e.target.closest && e.target.closest('input, textarea, select') && !e.ctrlKey && !e.altKey) return;
  setPtt(true);
});
document.addEventListener('keyup', (e) => { if (isPtt() && e.code === store.get('pttKey', 'KeyV')) setPtt(false); });
window.addEventListener('blur', () => { if (isPtt()) setPtt(false); });

function updateSpeaking() {
  $$('[data-speak-uid]').forEach((e) => e.classList.toggle('speaking', S.call ? S.speaking.has(e.dataset.speakUid) : false));
  $$('.tile[data-uid]').forEach((e) => e.classList.toggle('speaking', S.speaking.has(e.dataset.uid)));
}

async function toggleMute() {
  if (S.deafened) { toggleDeafen(); return; }
  S.muted = !S.muted;
  store.set('muted', S.muted);
  (S.muted ? sounds.mute : sounds.unmute)();
  if (S.call?.room && !S.call.connecting) {
    try { await S.call.room.localParticipant.setMicrophoneEnabled(!S.muted && (!isPtt() || pttDown)); } catch (e) { toast('Mikrofon: ' + e.message, 'error'); }
    emitVoice();
  }
  renderUserPanel(); renderSidebar(); renderStage();
}

async function toggleDeafen() {
  S.deafened = !S.deafened;
  (S.deafened ? sounds.mute : sounds.unmute)();
  $$('#audio-sink audio').forEach((a) => { a.muted = S.deafened; });
  applyVolumes();
  if (S.call?.room && !S.call.connecting) {
    const micOn = !S.deafened && !S.muted && (!isPtt() || pttDown);
    try { await S.call.room.localParticipant.setMicrophoneEnabled(micOn); } catch { /* egal */ }
    emitVoice();
  }
  renderUserPanel(); renderSidebar(); renderStage();
}

async function toggleCamera(force) {
  if (!S.call || S.call.connecting) return;
  const on = typeof force === 'boolean' ? force : !S.call.video;
  try {
    await S.call.room.localParticipant.setCameraEnabled(on);
    S.call.video = on;
  } catch (e) { toast('Kamera: ' + e.message, 'error'); S.call.video = false; }
  emitVoice(); renderVoicePanel(); renderStage();
}

// Qualitätsstufen beim Bildschirm teilen
const SCREEN_RES = {
  '720': { width: 1280, height: 720, label: '720p', bitrate: { 15: 1.2e6, 30: 2.5e6, 60: 3.5e6 } },
  '1080': { width: 1920, height: 1080, label: '1080p', bitrate: { 15: 2.5e6, 30: 4.5e6, 60: 7e6 } },
  '1440': { width: 2560, height: 1440, label: '1440p (2K)', bitrate: { 15: 4e6, 30: 7e6, 60: 10e6 } },
};

function pickScreen() {
  return new Promise(async (resolve) => {
    let sources = [];
    try { sources = await bridge.screen.sources(); } catch { /* Fallback: Auswahl im System-Dialog */ return resolve({ fallback: true }); }
    let res = store.get('screenRes', '1080');
    let fps = store.get('screenFps', 30);
    let chosen = sources[0]?.id;
    let done = false;
    const qBtns = () => Object.entries(SCREEN_RES).map(([k, r]) => `<button class="q-opt ${k === res ? 'active' : ''}" data-res="${k}"><strong>${r.label}</strong><span>${r.width}×${r.height}</span></button>`).join('');
    const fBtns = () => [15, 30, 60].map((f) => `<button class="q-opt ${f === fps ? 'active' : ''}" data-fps="${f}"><strong>${f} FPS</strong><span>${f === 60 ? 'flüssig, für Games' : f === 30 ? 'Standard' : 'spart Daten'}</span></button>`).join('');
    modal(`
      <h2>Bildschirm übertragen</h2>
      <div class="source-grid">
        ${sources.map((s) => `<button class="source ${s.id === chosen ? 'active' : ''}" data-id="${esc(s.id)}"><img src="${s.thumb}" alt=""><span>${esc(s.isScreen ? '🖥 ' + s.name : s.name)}</span></button>`).join('')}
      </div>
      <h3>Auflösung</h3><div class="quality-grid" id="q-res">${qBtns()}</div>
      <h3>Bildrate</h3><div class="quality-grid" id="q-fps">${fBtns()}</div>
      ${bridge.platform === 'win32' ? `<label class="check"><input type="checkbox" id="share-audio" ${store.get('screenAudio', true) ? 'checked' : ''}> Ton vom PC mitübertragen</label>` : ''}
      <p class="small muted">Für 1440p mit 60 FPS brauchst du ca. 10 Mbit/s Upload. Deine Freunde sehen die volle Qualität, wenn sie dein Bild gross oder im Vollbild anschauen.</p>
      <div class="modal-actions"><button class="btn ghost" data-close>Abbrechen</button><button class="btn primary" id="go">Live gehen</button></div>`, {
      wide: true,
      onMount(m, close) {
        m.addEventListener('click', (e) => {
          const src = e.target.closest('.source');
          if (src) { chosen = src.dataset.id; $$('.source', m).forEach((x) => x.classList.toggle('active', x === src)); }
          const r = e.target.closest('[data-res]');
          if (r) { res = r.dataset.res; $('#q-res', m).innerHTML = qBtns(); }
          const f = e.target.closest('[data-fps]');
          if (f) { fps = Number(f.dataset.fps); $('#q-fps', m).innerHTML = fBtns(); }
        });
        $('#go', m).onclick = () => {
          if (!chosen) return toast('Bitte einen Bildschirm oder ein Fenster wählen.');
          const audio = !!$('#share-audio', m)?.checked;
          store.set('screenRes', res); store.set('screenFps', fps); store.set('screenAudio', audio);
          done = true;
          close();
          resolve({ id: chosen, audio, res, fps });
        };
        const obs = new MutationObserver(() => { if (!m.isConnected) { obs.disconnect(); if (!done) resolve(null); } });
        obs.observe($('#modal-root'), { childList: true });
      },
    });
  });
}

async function toggleScreen() {
  if (!S.call || S.call.connecting) return;
  const on = !S.call.screen;
  try {
    if (on) {
      const pick = await pickScreen();
      if (!pick) return;
      if (pick.fallback) {
        await S.call.room.localParticipant.setScreenShareEnabled(true, { audio: true });
      } else {
        const r = SCREEN_RES[pick.res] || SCREEN_RES['1080'];
        bridge.screen.preselect({ id: pick.id, audio: pick.audio });
        await S.call.room.localParticipant.setScreenShareEnabled(true, {
          audio: pick.audio,
          resolution: { width: r.width, height: r.height, frameRate: pick.fps },
          contentHint: pick.fps >= 60 ? 'motion' : 'detail',
        }, {
          screenShareEncoding: { maxBitrate: r.bitrate[pick.fps] || 4.5e6, maxFramerate: pick.fps },
          simulcast: true,
        });
      }
    } else {
      await S.call.room.localParticipant.setScreenShareEnabled(false);
    }
    S.call.screen = on && !!S.call.room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
  } catch (e) {
    if (!/denied|abort|cancel|Permission/i.test(e.message)) toast('Bildschirm teilen: ' + e.message, 'error');
    S.call.screen = false;
  }
  emitVoice(); renderVoicePanel(); renderStage();
}

// Auswahl beim Bildschirm teilen
bridge.onPickSource((sources) => {
  let picked = false;
  const close = modal(`
    <h2>Was möchtest du teilen?</h2>
    <div class="source-grid">
      ${sources.map((s) => `<button class="source" data-id="${esc(s.id)}"><img src="${s.thumb}" alt=""><span>${esc(s.isScreen ? '🖥 ' + s.name : s.name)}</span></button>`).join('')}
    </div>
    ${bridge.platform === 'win32' ? '<label class="check"><input type="checkbox" id="share-audio"> Ton vom PC mitübertragen</label>' : ''}
    <div class="modal-actions"><button class="btn ghost" data-close>Abbrechen</button></div>`, {
    wide: true,
    onMount(m, c) {
      $$('.source', m).forEach((b) => b.addEventListener('click', () => {
        picked = true;
        bridge.pickSource({ id: b.dataset.id, audio: !!$('#share-audio', m)?.checked });
        c();
      }));
    },
  });
  const obs = new MutationObserver(() => {
    if (!$('.source-grid')) { obs.disconnect(); if (!picked) bridge.pickSource(null); }
  });
  obs.observe($('#modal-root'), { childList: true });
  void close;
});

function participantName(p) {
  if (p.identity === String(S.me.id)) return S.me.displayName;
  return userOf(Number(p.identity)).displayName || p.name || 'Unbekannt';
}

function videoFor(track) {
  const key = track.mediaStreamTrack?.id || track.sid;
  let entry = videoEls.get(key);
  if (!entry) {
    const el = track.attach();
    el.autoplay = true; el.playsInline = true; el.muted = true;
    entry = { track, el };
    videoEls.set(key, entry);
  }
  return { key, el: entry.el };
}

function renderStage() {
  const stage = $('#stage');
  const ch = currentChannel();
  if (!S.call?.room || !ch || ch.id !== S.call.channelId) {
    stage.innerHTML = '';
    for (const [key, { track, el }] of videoEls) { try { track.detach(el); } catch { /* egal */ } videoEls.delete(key); }
    return;
  }
  const room = S.call.room;
  const parts = [room.localParticipant, ...room.remoteParticipants.values()];
  const tiles = [];
  for (const p of parts) {
    const uid = String(p.identity);
    const u = uid === String(S.me.id) ? S.me : userOf(Number(uid));
    const isLocal = p === room.localParticipant;
    const vstate = (S.voice.get(ch.id) || []).find((x) => String(x.userId) === uid) || {};
    const muted = isLocal ? (S.muted || S.deafened) : !!vstate.muted;
    const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
    if (screenPub?.track && !screenPub.isMuted) tiles.push({ key: uid + ':screen', uid, u, track: screenPub.track, label: `${participantName(p)} – Bildschirm`, screen: true, isLocal });
    const camPub = p.getTrackPublication(Track.Source.Camera);
    tiles.push({ key: uid + ':cam', uid, u, track: camPub?.track && !camPub.isMuted ? camPub.track : null, label: participantName(p), muted, deafened: isLocal ? S.deafened : !!vstate.deafened, isLocal });
  }
  if (S.focusTile && !tiles.some((t) => t.key === S.focusTile)) S.focusTile = null;

  const used = new Set();
  stage.innerHTML = '';
  stage.className = 'stage' + (S.focusTile ? ' focused' : '') + ` n${Math.min(tiles.length, 9)}`;
  const grid = document.createElement('div');
  grid.className = 'tiles';
  for (const t of tiles) {
    const div = document.createElement('div');
    div.className = 'tile' + (t.screen ? ' screen' : '') + (S.focusTile === t.key ? ' big' : '') + (S.speaking.has(t.uid) && !t.screen ? ' speaking' : '');
    if (!t.screen) div.dataset.uid = t.uid;
    if (t.track) {
      const { key, el } = videoFor(t.track);
      used.add(key);
      el.className = t.isLocal && !t.screen ? 'mirror' : '';
      div.append(el);
    } else {
      div.innerHTML = `<div class="tile-avatar">${avatar(t.u, 84)}</div>`;
    }
    const label = document.createElement('div');
    label.className = 'tile-label';
    label.innerHTML = `${t.muted ? icon('micOff', 14) : ''}${t.deafened ? icon('headphonesOff', 14) : ''}<span>${esc(t.label)}</span>`;
    div.append(label);
    if (t.track) {
      const fs = document.createElement('button');
      fs.className = 'tile-fs'; fs.title = 'Vollbild'; fs.innerHTML = icon('maximize', 16);
      fs.onclick = (e) => { e.stopPropagation(); div.querySelector('video')?.requestFullscreen?.(); };
      div.append(fs);
    }
    div.addEventListener('click', () => { S.focusTile = S.focusTile === t.key ? null : t.key; renderStage(); });
    grid.append(div);
  }
  stage.append(grid);

  const bar = document.createElement('div');
  bar.className = 'stage-controls';
  bar.innerHTML = `
    <button class="round ${S.muted || S.deafened ? 'off' : ''}" data-act="mute" title="Mikrofon">${icon(S.muted || S.deafened ? 'micOff' : 'mic', 22)}</button>
    <button class="round ${S.call.video ? 'on' : ''}" data-act="cam" title="Kamera">${icon(S.call.video ? 'video' : 'videoOff', 22)}</button>
    <button class="round ${S.call.screen ? 'on' : ''}" data-act="screen" title="Bildschirm teilen">${icon('screen', 22)}</button>
    <button class="round" data-act="sb" title="Soundboard">🔊</button>
    <button class="round ${S.deafened ? 'off' : ''}" data-act="deafen" title="Ton aus">${icon(S.deafened ? 'headphonesOff' : 'headphones', 22)}</button>
    <button class="round hang" data-act="leave" title="Auflegen">${icon('hangup', 22)}</button>`;
  bar.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'mute') toggleMute();
    if (a === 'cam') toggleCamera();
    if (a === 'screen') toggleScreen();
    if (a === 'deafen') toggleDeafen();
    if (a === 'leave') leaveVoice(true);
    if (a === 'sb') toggleSoundboard(true);
  });
  stage.append(bar);

  for (const [key, { track, el }] of videoEls) {
    if (!used.has(key)) { try { track.detach(el); } catch { /* egal */ } videoEls.delete(key); }
  }
}

// ---------- Anrufe ----------
async function startCall(dmId, video = false) {
  if (S.view.channelId !== dmId) await openDm(dmId);
  const othersIn = (S.voice.get(dmId) || []).some((u) => u.userId !== S.me.id);
  await joinVoice(dmId, { video });
  if (!S.call || S.call.channelId !== dmId) return;
  if (!othersIn) {
    S.outgoing = dmId;
    S.socket?.emit('call:ring', { channelId: dmId, video });
    startRing(true);
    setTimeout(() => {
      if (S.outgoing === dmId) {
        S.outgoing = null; stopRing();
        S.socket?.emit('call:cancel', { channelId: dmId });
        toast('Niemand hat abgenommen.');
        if (S.call?.channelId === dmId && (S.voice.get(dmId) || []).every((u) => u.userId === S.me.id)) leaveVoice(true);
      }
    }, 35000);
  }
}

function onIncomingCall({ channelId, from, video }) {
  cacheUser(from);
  if (S.call?.channelId === channelId) return;
  closeIncoming();
  S.ringing = { channelId, from, video };
  startRing(false);
  bridge.flash();
  notify(`${from.displayName} ruft an`, video ? 'Videoanruf' : 'Sprachanruf', () => {});
  const close = modal(`
    <div class="call-incoming">
      <div class="pulse">${avatar(from, 96)}</div>
      <h2>${esc(from.displayName)}</h2>
      <p class="muted">${video ? 'Videoanruf' : 'Sprachanruf'} …</p>
      <div class="call-actions">
        <button class="round hang big" id="decline" title="Ablehnen">${icon('hangup', 26)}</button>
        <button class="round accept big" id="accept-audio" title="Annehmen">${icon('phone', 26)}</button>
        ${video ? `<button class="round accept big" id="accept-video" title="Mit Video annehmen">${icon('video', 26)}</button>` : ''}
      </div>
    </div>`, {
    onMount(m, c) {
      $('#decline', m).onclick = () => { S.socket?.emit('call:decline', { channelId }); c(); };
      $('#accept-audio', m).onclick = async () => { c(); await openDm(channelId); await joinVoice(channelId); };
      const av = $('#accept-video', m);
      if (av) av.onclick = async () => { c(); await openDm(channelId); await joinVoice(channelId, { video: true }); };
    },
  });
  S.ringing.close = () => { close(); };
  const obs = new MutationObserver(() => {
    if (!$('.call-incoming')) { obs.disconnect(); stopRing(); S.ringing = null; }
  });
  obs.observe($('#modal-root'), { childList: true });
  S.ringing.timer = setTimeout(() => { if (S.ringing?.channelId === channelId) closeIncoming(); }, 40000);
}

function closeIncoming() {
  if (!S.ringing) return;
  clearTimeout(S.ringing.timer);
  S.ringing.close?.();
  S.ringing = null;
  stopRing();
}

// ---------- Rendering ----------
function render() {
  if (!S.me) return;
  renderGuildBar();
  renderSidebar();
  renderHeader();
  renderMain();
  renderMembers();
  renderVoicePanel();
  renderUserPanel();
  renderTyping();
  updateTitle();
}

function renderGuildBar() {
  const dmUnread = S.dms.some((d) => S.unread.has(d.id));
  const nav = $('#guilds');
  nav.innerHTML = `
    <button class="guild-btn home ${S.view.kind !== 'guild' ? 'active' : ''}" data-home title="Direktnachrichten">${logo(26)}${dmUnread ? '<span class="pill-dot"></span>' : ''}</button>
    <div class="guild-sep"></div>
    ${S.guilds.map((g) => {
    const d = S.details.get(g.id);
    const unread = d ? d.channels.some((c) => S.unread.has(c.id)) : false;
    const inVoice = d && S.call && d.channels.some((c) => c.id === S.call.channelId);
    const gIcon = (d && d.icon !== undefined ? d.icon : g.icon);
    return `<button class="guild-btn ${gIcon ? 'has-icon' : ''} ${S.view.kind === 'guild' && S.view.guildId === g.id ? 'active' : ''} ${unread ? 'unread' : ''}" data-guild="${g.id}" title="${esc(g.name)}">
        ${gIcon ? `<img src="${esc(fileUrl(gIcon))}" alt="" draggable="false">` : esc(guildInitials(g.name))}${inVoice ? `<span class="voice-badge">${icon('speaker', 10)}</span>` : ''}</button>`;
  }).join('')}
    <button class="guild-btn add" data-add title="Gruppe erstellen oder beitreten">${icon('plus', 24)}</button>`;
}

function renderSidebar() {
  const head = $('#sidebar-header');
  const list = $('#channel-list');
  if (S.view.kind !== 'guild') {
    head.innerHTML = '<div class="sidebar-title">Direktnachrichten</div>';
    head.classList.remove('clickable');
    list.innerHTML = `
      <div class="cat"><span>Unterhaltungen</span><button class="cat-add" data-new-dm title="Neue Unterhaltung">${icon('plus', 16)}</button></div>
      ${S.dms.length ? S.dms.map((d) => {
    const inCall = (S.voice.get(d.id) || []).length > 0;
    return `<button class="dm-item ${S.view.channelId === d.id ? 'active' : ''} ${S.unread.has(d.id) ? 'unread' : ''}" data-dm="${d.id}">
          <span class="av-wrap">${avatar(d.user, 32)}${statusDot(d.user.id)}</span>
          <span class="member-info"><span class="dm-name">${esc(userOf(d.user.id).displayName)}</span>${activityLine(userOf(d.user.id).activity)}</span>
          ${inCall ? `<span class="in-call" title="Anruf läuft">${icon('phone', 14)}</span>` : ''}
        </button>`;
  }).join('') : '<p class="muted small pad">Noch keine Unterhaltungen. Klick auf + oder auf jemanden in einer Gruppe.</p>'}`;
    return;
  }
  const d = S.details.get(S.view.guildId);
  if (!d) { head.innerHTML = ''; list.innerHTML = ''; return; }
  const owner = d.ownerId === S.me.id;
  head.innerHTML = `<div class="sidebar-title">${esc(d.name)}</div>${icon('chevron', 18)}`;
  head.classList.add('clickable');

  const text = d.channels.filter((c) => c.type === 'text');
  const voiceCh = d.channels.filter((c) => c.type === 'voice');
  list.innerHTML = `
    <div class="cat"><span>Textkanäle</span>${owner ? `<button class="cat-add" data-new-ch="text" title="Kanal erstellen">${icon('plus', 16)}</button>` : ''}</div>
    ${text.map((c) => `<button class="ch ${S.view.channelId === c.id ? 'active' : ''} ${S.unread.has(c.id) ? 'unread' : ''}" data-ch="${c.id}">${icon('hash', 18)}<span>${esc(c.name)}</span></button>`).join('')}
    <div class="cat"><span>Sprachkanäle</span>${owner ? `<button class="cat-add" data-new-ch="voice" title="Kanal erstellen">${icon('plus', 16)}</button>` : ''}</div>
    ${voiceCh.map((c) => {
    const users = S.voice.get(c.id) || [];
    return `<button class="ch voice ${S.view.channelId === c.id ? 'active' : ''} ${S.call?.channelId === c.id ? 'connected' : ''}" data-ch="${c.id}">${icon('speaker', 18)}<span>${esc(c.name)}</span>${users.length ? `<span class="count">${users.length}</span>` : ''}</button>
      ${users.length ? `<div class="voice-users">${users.map((v) => {
    const u = v.userId === S.me.id ? S.me : userOf(v.userId);
    return `<div class="voice-user" data-user="${v.userId}">${avatar(u, 22)}<span>${esc(u.displayName)}</span>
          <span class="vu-icons">${v.screen ? '<span class="live">LIVE</span>' : ''}${v.video ? icon('video', 14) : ''}${v.muted ? icon('micOff', 14) : ''}${v.deafened ? icon('headphonesOff', 14) : ''}</span></div>`;
  }).join('')}</div>` : ''}`;
  }).join('')}`;
  updateSpeaking();
}

function renderHeader() {
  const h = $('#main-header');
  const ch = currentChannel();
  if (!ch) {
    h.innerHTML = `<div class="hdr-title">${logo(22)}<span>Bubble</span></div>`;
    return;
  }
  if (ch.type === 'dm') {
    const callUsers = S.voice.get(ch.id) || [];
    const inThisCall = S.call?.channelId === ch.id;
    h.innerHTML = `
      <div class="hdr-title"><span class="av-wrap">${avatar(ch.user, 26)}${statusDot(ch.user.id)}</span><span>${esc(ch.user.displayName)}</span><span class="muted small">@${esc(ch.user.username)}</span></div>
      <div class="hdr-actions">
        ${!inThisCall && callUsers.length ? '<button class="btn small success" data-join-call>Anruf läuft – beitreten</button>' : ''}
        ${!inThisCall ? `<button class="icon-btn" data-call="audio" title="Sprachanruf">${icon('phone', 20)}</button>
        <button class="icon-btn" data-call="video" title="Videoanruf">${icon('video', 20)}</button>` : ''}
      </div>`;
    return;
  }
  const d = S.details.get(S.view.guildId);
  h.innerHTML = `
    <div class="hdr-title">${icon(ch.type === 'voice' ? 'speaker' : 'hash', 22)}<span>${esc(ch.name)}</span></div>
    <div class="hdr-actions"><button class="icon-btn ${store.get('hideMembers', false) ? '' : 'active'}" data-toggle-members title="Mitglieder">${icon('users', 20)}</button>
    <span class="muted small">${d ? d.members.filter((m) => S.online.has(m.id)).length + ' online' : ''}</span></div>`;
}

function renderMain() {
  const main = $('#main');
  const ch = currentChannel();
  main.classList.remove('mode-text', 'mode-voice', 'mode-call', 'mode-empty');
  const empty = $('#empty');
  if (!ch) {
    main.classList.add('mode-empty');
    const tips = S.guilds.length
      ? 'Wähle links eine Gruppe oder eine Unterhaltung.'
      : 'Erstelle links mit <strong>+</strong> eine Gruppe und schick deinen Freunden den Einladungscode.';
    empty.innerHTML = `<div class="empty-inner">${logo(64)}<h2>Willkommen bei Bubble, ${esc(S.me.displayName)}!</h2><p class="muted">${tips}</p></div>`;
    renderStage();
    return;
  }
  const inThisCall = S.call?.channelId === ch.id;
  if (ch.type === 'voice') {
    if (inThisCall) {
      main.classList.add('mode-voice');
      if (S.call.connecting) $('#stage').innerHTML = '<div class="loading">Verbinde …</div>';
      else renderStage();
    } else {
      main.classList.add('mode-empty');
      const users = S.voice.get(ch.id) || [];
      empty.innerHTML = `<div class="empty-inner">${icon('speaker', 56)}<h2>${esc(ch.name)}</h2>
        <p class="muted">${users.length ? users.map((u) => esc(userOf(u.userId).displayName)).join(', ') + ' ' + (users.length === 1 ? 'ist' : 'sind') + ' gerade hier.' : 'Niemand ist gerade hier.'}</p>
        <button class="btn primary" data-join-voice="${ch.id}">Beitreten</button></div>`;
      renderStage();
    }
    return;
  }
  if (ch.type === 'dm' && inThisCall) {
    main.classList.add('mode-call');
    if (S.call.connecting) $('#stage').innerHTML = '<div class="loading">Verbinde …</div>';
    else renderStage();
  } else {
    main.classList.add('mode-text');
    renderStage();
  }
  $('#input').placeholder = ch.type === 'dm' ? `Nachricht an @${ch.user.displayName}` : `Nachricht an #${ch.name}`;
}

function renderMembers() {
  const aside = $('#members');
  const show = S.view.kind === 'guild' && !store.get('hideMembers', false);
  aside.classList.toggle('hidden', !show);
  if (!show) return;
  const d = S.details.get(S.view.guildId);
  if (!d) { aside.innerHTML = ''; return; }
  const on = d.members.filter((m) => S.online.has(m.id));
  const off = d.members.filter((m) => !S.online.has(m.id));
  const row = (m) => `<button class="member ${S.online.has(m.id) ? '' : 'offline'}" data-user="${m.id}">
      <span class="av-wrap">${avatar(userOf(m.id), 32)}${statusDot(m.id)}</span>
      <span class="member-info"><span class="member-name">${esc(userOf(m.id).displayName)}${m.id === d.ownerId ? ' <span class="crown" title="Besitzer">★</span>' : ''}</span>
      ${activityLine(userOf(m.id).activity)}</span></button>`;
  aside.innerHTML = `
    <div class="cat"><span>Online – ${on.length}</span></div>${on.map(row).join('')}
    ${off.length ? `<div class="cat"><span>Offline – ${off.length}</span></div>${off.map(row).join('')}` : ''}`;
}

function renderVoicePanel() {
  const p = $('#voice-panel');
  if (!S.call) { p.classList.add('hidden'); p.innerHTML = ''; return; }
  p.classList.remove('hidden');
  const { title, sub } = channelLabel(S.call.channelId);
  const status = S.call.connecting ? 'Verbinde …' : S.call.reconnecting ? 'Verbindung wackelt …' : 'Sprache verbunden';
  p.innerHTML = `
    <div class="vp-top">
      <button class="vp-info" data-goto-call>
        <span class="vp-status ${S.call.connecting || S.call.reconnecting ? 'warn' : ''}">${status}</span>
        <span class="vp-where">${esc(title)}${sub ? ' / ' + esc(sub) : ''}</span>
      </button>
      <button class="icon-btn" data-act="leave" title="Trennen">${icon('hangup', 20)}</button>
    </div>
    <div class="vp-actions">
      <button class="vp-btn ${S.call.video ? 'on' : ''}" data-act="cam">${icon('video', 18)}<span>Kamera</span></button>
      <button class="vp-btn ${S.call.screen ? 'on' : ''}" data-act="screen">${icon('screen', 18)}<span>Bildschirm</span></button>
    </div>`;
}

function renderUserPanel() {
  const p = $('#user-panel');
  if (!S.me) return;
  p.innerHTML = `
    <button class="up-me" data-settings title="Einstellungen">
      <span class="av-wrap">${avatar(S.me, 32)}<span class="status-dot ${S.connected ? 'on' : ''}"></span></span>
      <span class="up-names"><span class="up-name">${esc(S.me.displayName)}</span><span class="up-user">@${esc(S.me.username)}</span></span>
    </button>
    <button class="icon-btn ${S.muted || S.deafened ? 'danger' : ''}" data-act="mute" title="${S.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}">${icon(S.muted || S.deafened ? 'micOff' : 'mic', 20)}</button>
    <button class="icon-btn ${S.deafened ? 'danger' : ''}" data-act="deafen" title="${S.deafened ? 'Ton an' : 'Ton aus'}">${icon(S.deafened ? 'headphonesOff' : 'headphones', 20)}</button>
    <button class="icon-btn" data-settings title="Einstellungen">${icon('settings', 20)}</button>`;
}

// ---------- Menüs & Dialoge ----------
// Kurze Zeile unter dem Namen: was jemand spielt oder hört
function activityLine(a) {
  if (!a) return '';
  if (a.game) return `<span class="act-line">🎮 Spielt <strong>${esc(a.game)}</strong></span>`;
  if (a.music) return `<span class="act-line">🎵 ${esc(a.music)}</span>`;
  return '';
}

function userMenu(x, y, uid) {
  if (uid === S.me.id) { openSettings(); return; }
  const u = userOf(uid);
  const inMyCall = S.call?.room && [...S.call.room.remoteParticipants.values()].some((p) => String(p.identity) === String(uid));
  contextMenu(x, y, [
    inMyCall && { label: `Lautstärke von ${u.displayName} …`, action: () => volumePopover(x, y, uid) },
    { label: `Nachricht an ${u.displayName}`, action: () => startDmWith(uid) },
    { label: 'Anrufen', action: async () => { const dm = await startDmWith(uid); if (dm) startCall(dm.id, false); } },
    { label: 'Videoanruf', action: async () => { const dm = await startDmWith(uid); if (dm) startCall(dm.id, true); } },
  ]);
}

function guildMenu(x, y) {
  const d = S.details.get(S.view.guildId);
  if (!d) return;
  const owner = d.ownerId === S.me.id;
  contextMenu(x, y, [
    { label: 'Freunde einladen', action: () => inviteDialog(d) },
    owner && { label: 'Textkanal erstellen', action: () => newChannelDialog('text') },
    owner && { label: 'Sprachkanal erstellen', action: () => newChannelDialog('voice') },
    owner && { label: 'Gruppe umbenennen', action: () => renameGuildDialog(d) },
    owner && { label: 'Gruppen-Icon ändern (auch GIF)', action: () => changeGuildIcon(d) },
    owner && d.icon && { label: 'Gruppen-Icon entfernen', action: () => api(`/api/guilds/${d.id}`, { method: 'PATCH', body: { icon: null } }).catch((e) => toast(e.message, 'error')) },
    '-',
    owner
      ? { label: 'Gruppe löschen', danger: true, action: async () => {
        if (await confirmDialog('Gruppe löschen', `„${d.name}“ mit allen Kanälen und Nachrichten wirklich löschen?`)) {
          try { await api(`/api/guilds/${d.id}`, { method: 'DELETE' }); } catch (e) { toast(e.message, 'error'); }
        }
      } }
      : { label: 'Gruppe verlassen', danger: true, action: async () => {
        if (await confirmDialog('Gruppe verlassen', `Willst du „${d.name}“ wirklich verlassen?`, 'Verlassen')) {
          try {
            await api(`/api/guilds/${d.id}/leave`, { method: 'POST' });
            if (S.call && d.channels.some((c) => c.id === S.call.channelId)) leaveVoice(true);
            S.guilds = S.guilds.filter((g) => g.id !== d.id); S.details.delete(d.id); openHome();
          } catch (e) { toast(e.message, 'error'); }
        }
      } },
  ]);
}

function inviteDialog(d) {
  const owner = d.ownerId === S.me.id;
  modal(`
    <h2>Freunde zu „${esc(d.name)}“ einladen</h2>
    <p class="muted">Schick diesen Code deinen Freunden. Sie klicken links auf <strong>+</strong> → „Beitreten“.</p>
    <div class="invite-box"><code id="inv">${esc(d.inviteCode)}</code><button class="btn primary" id="copy">${icon('copy', 16)} Kopieren</button></div>
    <p class="small muted">Neue Freunde brauchen ausserdem die Server-Adresse <strong>${esc(S.serverUrl.replace(/^https?:\/\//, ''))}</strong> und den Registrierungs-Code.</p>
    <div class="modal-actions">${owner ? '<button class="btn ghost" id="reset">Neuen Code erstellen</button>' : ''}<button class="btn" data-close>Fertig</button></div>`, {
    onMount(m) {
      $('#copy', m).onclick = () => { navigator.clipboard.writeText($('#inv', m).textContent); toast('Code kopiert!'); };
      const r = $('#reset', m);
      if (r) r.onclick = async () => {
        try { const nd = await api(`/api/guilds/${d.id}/invite`, { method: 'POST' }); S.details.set(d.id, nd); $('#inv', m).textContent = nd.inviteCode; toast('Neuer Code erstellt – der alte gilt nicht mehr.'); } catch (e) { toast(e.message, 'error'); }
      };
    },
  });
}

function renameGuildDialog(d) {
  modal(`<h2>Gruppe umbenennen</h2>
    <form id="f"><label>Name<input name="name" maxlength="50" value="${esc(d.name)}" required></label>
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary">Speichern</button></div></form>`, {
    onMount(m, close) {
      $('#f', m).onsubmit = async (e) => {
        e.preventDefault();
        try { await api(`/api/guilds/${d.id}`, { method: 'PATCH', body: { name: e.target.name.value } }); close(); } catch (err) { toast(err.message, 'error'); }
      };
    },
  });
}

function newChannelDialog(type) {
  modal(`<h2>${type === 'voice' ? 'Sprachkanal' : 'Textkanal'} erstellen</h2>
    <form id="f"><label>Kanalname<input name="name" maxlength="40" placeholder="${type === 'voice' ? 'z.B. Zocken' : 'z.B. memes'}" required></label>
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary">Erstellen</button></div></form>`, {
    onMount(m, close) {
      $('#f', m).onsubmit = async (e) => {
        e.preventDefault();
        try {
          const d = await api(`/api/guilds/${S.view.guildId}/channels`, { body: { name: e.target.name.value, type } });
          S.details.set(d.id, d);
          close(); render();
        } catch (err) { toast(err.message, 'error'); }
      };
    },
  });
}

function addGuildDialog() {
  modal(`
    <h2>Gruppe hinzufügen</h2>
    <div class="tabs"><button class="tab active" data-tab="create">Erstellen</button><button class="tab" data-tab="join">Beitreten</button></div>
    <form id="f-create" class="tab-pane"><label>Name der Gruppe<input name="name" maxlength="50" placeholder="z.B. Die Jungs" required></label>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary">Erstellen</button></div></form>
    <form id="f-join" class="tab-pane hidden"><label>Einladungscode<input name="code" placeholder="z.B. aB3dE9xQ" required></label>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary">Beitreten</button></div></form>`, {
    onMount(m, close) {
      $$('.tab', m).forEach((t) => t.addEventListener('click', () => {
        $$('.tab', m).forEach((x) => x.classList.toggle('active', x === t));
        $('#f-create', m).classList.toggle('hidden', t.dataset.tab !== 'create');
        $('#f-join', m).classList.toggle('hidden', t.dataset.tab !== 'join');
        $(`#f-${t.dataset.tab} input`, m).focus();
      }));
      const done = async (d) => {
        S.details.set(d.id, d);
        for (const mem of d.members) cacheUser(mem);
        if (!S.guilds.some((g) => g.id === d.id)) S.guilds.push({ id: d.id, name: d.name, ownerId: d.ownerId, inviteCode: d.inviteCode, icon: d.icon });
        close();
        await openGuild(d.id);
      };
      $('#f-create', m).onsubmit = async (e) => {
        e.preventDefault();
        try { await done(await api('/api/guilds', { body: { name: e.target.name.value } })); } catch (err) { toast(err.message, 'error'); }
      };
      $('#f-join', m).onsubmit = async (e) => {
        e.preventDefault();
        try { await done(await api('/api/guilds/join', { body: { code: e.target.code.value } })); } catch (err) { toast(err.message, 'error'); }
      };
    },
  });
}

function newDmDialog() {
  modal(`<h2>Neue Unterhaltung</h2>
    <form id="f"><label>Benutzername<input name="username" placeholder="z.B. max" required></label>
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary">Los</button></div></form>`, {
    onMount(m, close) {
      $('#f', m).onsubmit = async (e) => {
        e.preventDefault();
        const dm = await startDmWith(e.target.username.value.trim());
        if (dm) close();
      };
    },
  });
}

// ---------- Klicks verteilen ----------
function setupEvents() {
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, [data-user]');
    if (!t) return;
    const ds = t.dataset;
    if ('home' in ds) return openHome();
    if (ds.guild) return openGuild(Number(ds.guild), store.get('lastChannel.' + ds.guild, undefined));
    if ('add' in ds) return addGuildDialog();
    if ('newDm' in ds) return newDmDialog();
    if (ds.newCh) return newChannelDialog(ds.newCh);
    if (ds.dm) return openDm(Number(ds.dm));
    if (ds.ch) {
      const d = S.details.get(S.view.guildId);
      const ch = d?.channels.find((c) => c.id === Number(ds.ch));
      if (ch) { if (ch.type === 'text') store.set('lastChannel.' + d.id, ch.id); return openChannel(ch); }
    }
    if (ds.joinVoice) return joinVoice(Number(ds.joinVoice));
    if (ds.call) { const ch = currentChannel(); if (ch?.type === 'dm') return startCall(ch.id, ds.call === 'video'); }
    if ('joinCall' in ds) { const ch = currentChannel(); if (ch) return joinVoice(ch.id); }
    if ('gotoCall' in ds && S.call) {
      const id = S.call.channelId;
      if (S.dms.some((d) => d.id === id)) return openDm(id);
      for (const d of S.details.values()) if (d.channels.some((c) => c.id === id)) { S.view = { kind: 'guild', guildId: d.id, channelId: id }; saveView(); return render(); }
    }
    if ('settings' in ds) return openSettings();
    if ('toggleMembers' in ds) { store.set('hideMembers', !store.get('hideMembers', false)); renderMembers(); renderHeader(); return; }
    if (ds.user && t.closest('#members, #channel-list')) return userMenu(e.clientX, e.clientY, Number(ds.user));
    if (ds.act && t.closest('#user-panel, #voice-panel')) {
      if (ds.act === 'mute') return toggleMute();
      if (ds.act === 'deafen') return toggleDeafen();
      if (ds.act === 'cam') return toggleCamera();
      if (ds.act === 'screen') return toggleScreen();
      if (ds.act === 'leave') return leaveVoice(true);
    }
  });

  $('#sidebar-header').addEventListener('click', (e) => {
    if (S.view.kind !== 'guild') return;
    const r = $('#sidebar-header').getBoundingClientRect();
    guildMenu(r.left + 8, r.bottom + 4);
    e.stopPropagation();
  });

  $('#channel-list').addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-ch]');
    if (!b || S.view.kind !== 'guild') return;
    const d = S.details.get(S.view.guildId);
    if (d?.ownerId !== S.me.id) return;
    e.preventDefault();
    const ch = d.channels.find((c) => c.id === Number(b.dataset.ch));
    contextMenu(e.clientX, e.clientY, [{
      label: 'Kanal löschen', danger: true,
      action: async () => {
        if (await confirmDialog('Kanal löschen', `„${ch.name}“ wirklich löschen? Alle Nachrichten darin gehen verloren.`)) {
          try { await api(`/api/channels/${ch.id}`, { method: 'DELETE' }); } catch (err) { toast(err.message, 'error'); }
        }
      },
    }]);
  });

  $('#guilds').addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-guild]');
    if (!b) return;
    e.preventDefault();
    openGuild(Number(b.dataset.guild)).then(() => guildMenu(e.clientX, e.clientY));
  });

  // Tastenkürzel: Strg+Shift+M = stumm, Strg+Shift+D = Ton aus
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') { e.preventDefault(); toggleMute(); }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); toggleDeafen(); }
  });

  window.addEventListener('focus', () => {
    const ch = S.view.channelId;
    if (ch && S.unread.delete(ch)) { renderGuildBar(); renderSidebar(); updateTitle(); }
  });
  window.addEventListener('beforeunload', () => { if (S.call) S.call.room.disconnect(); });
}

// ---------- Los geht's ----------
window.addEventListener('DOMContentLoaded', () => {
  setupComposer();
  setupEvents();
  if (typeof initFeatures === 'function') initFeatures();
  boot();
});
