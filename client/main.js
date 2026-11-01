// Bubble – Hauptprozess (Fenster, Berechtigungen, Bildschirm teilen, Themes-Ordner)
const { app, BrowserWindow, session, desktopCapturer, ipcMain, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let win = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// Eigenes Protokoll, damit Themes Videos, GIFs und Bilder aus dem Themes-Ordner laden können
protocol.registerSchemesAsPrivileged([{
  scheme: 'bubble-file',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

const themesDir = () => path.join(app.getPath('userData'), 'themes');

const EXAMPLE_THEME = {
  name: 'Beispiel: Mein Theme',
  author: 'Du',
  dark: true,
  colors: {
    'bg-guilds': 'rgba(10, 12, 20, 0.85)',
    'bg-sidebar': 'rgba(18, 20, 32, 0.75)',
    'bg-main': 'rgba(24, 26, 40, 0.65)',
    accent: '#ff5fa2',
  },
  blur: '14px',
  background: {
    type: 'animated',
    value: 'linear-gradient(120deg, #1d2b64, #f8cdda, #1d2b64)',
  },
};

const README = `BUBBLE – EIGENE THEMES
==========================

Lege hier .json-Dateien ab, dann tauchen sie in der App unter
Einstellungen → Themes auf (Knopf „Neu laden“ drücken).

Videos, GIFs und Bilder für den Hintergrund legst du einfach in
diesen Ordner und schreibst den Dateinamen ins Theme, z.B.:

{
  "name": "Mein Video-Theme",
  "dark": true,
  "colors": { "accent": "#00d2ff", "bg-main": "rgba(0,0,0,0.55)" },
  "blur": "12px",
  "background": { "type": "video", "src": "regen.mp4", "overlay": "rgba(0,0,0,0.35)" }
}

background.type kann sein:
  "video"     – src = Datei hier im Ordner (mp4/webm) oder https-Link
  "image"     – src = Bild oder GIF (png/jpg/gif/webp) oder https-Link
  "gradient"  – value = CSS-Farbverlauf
  "animated"  – value = CSS-Farbverlauf, der sich langsam bewegt
  "color"     – value = eine Farbe

Alle Farben (alles optional, fehlende kommen vom Standard-Theme):
  bg-app, bg-guilds, bg-sidebar, bg-main, bg-elev, bg-input,
  bg-hover, bg-active, border, text, text-muted, text-strong,
  accent, accent-text, danger, success, warn, mention

Weitere Felder: "font", "radius" (z.B. "12px"), "blur" (Glas-Effekt),
"css" (eigenes CSS für Profis).

Am einfachsten: In der App ein Theme im Editor zusammenklicken und
„Als Datei speichern“ – das landet automatisch hier.
`;

function ensureThemesDir() {
  const dir = themesDir();
  fs.mkdirSync(dir, { recursive: true });
  const readme = path.join(dir, 'LIESMICH.txt');
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, README, 'utf8');
  const example = path.join(dir, 'beispiel.json');
  if (!fs.existsSync(path.join(dir, '.beispiel-erstellt'))) {
    fs.writeFileSync(example, JSON.stringify(EXAMPLE_THEME, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, '.beispiel-erstellt'), '', 'utf8');
  }
  return dir;
}

function ensureSoundsDir() {
  const dir = path.join(app.getPath('userData'), 'sounds');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeName(name, fallbackExt) {
  const base = String(name || 'datei').replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/^\.+/, '').slice(0, 80) || 'datei';
  return path.extname(base) ? base : base + fallbackExt;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    backgroundColor: '#1b1c1f',
    autoHideMenuBar: true,
    title: 'Bubble',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Links im normalen Browser öffnen
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); shell.openExternal(url); }
  });
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  ensureThemesDir();

  // bubble-file://themes/<datei>  oder  bubble-file://sounds/<datei>
  protocol.handle('bubble-file', (request) => {
    const url = new URL(request.url);
    const dir = url.hostname === 'sounds' ? ensureSoundsDir() : themesDir();
    const file = path.normalize(path.join(dir, decodeURIComponent(url.pathname)));
    if (!file.startsWith(dir + path.sep)) return new Response('Nicht erlaubt', { status: 403 });
    return net.fetch(pathToFileURL(file).toString(), { headers: request.headers });
  });

  const allowed = new Set(['media', 'notifications', 'display-capture', 'clipboard-sanitized-write', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => allowed.has(permission));

  // Bildschirm teilen: Quelle wurde vorher in der App gewählt (inkl. Qualität),
  // sonst Auswahl im App-Fenster anzeigen
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (preselected) {
      const choice = preselected;
      preselected = null;
      try {
        const all = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1, height: 1 } });
        const src = all.find((s) => s.id === choice.id);
        if (src) {
          const result = { video: src };
          if (choice.audio && process.platform === 'win32') result.audio = 'loopback';
          callback(result);
          return;
        }
      } catch { /* weiter mit Auswahl */ }
    }
    let sources = [];
    try {
      sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } });
    } catch (e) {
      callback({});
      return;
    }
    ipcMain.removeAllListeners('source-picked');
    ipcMain.once('source-picked', (event, choice) => {
      const src = choice && sources.find((s) => s.id === choice.id);
      if (!src) { callback({}); return; }
      const result = { video: src };
      if (choice.audio && process.platform === 'win32') result.audio = 'loopback';
      callback(result);
    });
    win.webContents.send('pick-source', sources.map((s) => ({
      id: s.id,
      name: s.name,
      isScreen: s.id.startsWith('screen:'),
      thumb: s.thumbnail.toDataURL(),
    })));
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// --- Bildschirm teilen ---
let preselected = null;
ipcMain.handle('screen:sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } });
  return sources.map((s) => ({ id: s.id, name: s.name, isScreen: s.id.startsWith('screen:'), thumb: s.thumbnail.toDataURL() }));
});
ipcMain.on('screen:preselect', (e, choice) => { preselected = choice && choice.id ? choice : null; });

// --- Themes-Ordner ---
ipcMain.handle('themes:list', () => {
  const dir = ensureThemesDir();
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith('.json')) continue;
    try {
      const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (t && typeof t === 'object') out.push({ ...t, id: 'file:' + f, file: f });
    } catch (e) {
      out.push({ id: 'file:' + f, file: f, name: f, error: 'Datei ist kein gültiges JSON: ' + e.message });
    }
  }
  return out;
});

ipcMain.handle('themes:save-json', (e, fileName, theme) => {
  const dir = ensureThemesDir();
  const name = safeName(fileName, '.json').replace(/\.[^.]+$/, '') + '.json';
  fs.writeFileSync(path.join(dir, name), JSON.stringify(theme, null, 2), 'utf8');
  return name;
});

ipcMain.handle('themes:save-file', (e, fileName, data) => {
  const dir = ensureThemesDir();
  if (!data || data.byteLength > 300 * 1024 * 1024) throw new Error('Datei zu gross (max. 300 MB).');
  let name = safeName(fileName, '');
  let i = 1;
  while (fs.existsSync(path.join(dir, name))) {
    const ext = path.extname(name);
    name = `${path.basename(safeName(fileName, ''), ext)}-${i++}${ext}`;
  }
  fs.writeFileSync(path.join(dir, name), Buffer.from(data));
  return name;
});

ipcMain.handle('themes:delete', (e, fileName) => {
  const dir = ensureThemesDir();
  const file = path.normalize(path.join(dir, String(fileName)));
  if (file.startsWith(dir + path.sep) && file.endsWith('.json') && fs.existsSync(file)) fs.unlinkSync(file);
  return true;
});

ipcMain.handle('themes:open-folder', () => shell.openPath(ensureThemesDir()));

// --- Eigene Töne (Klingelton, Benachrichtigung …) ---
ipcMain.handle('sounds:save-file', (e, fileName, data) => {
  const dir = ensureSoundsDir();
  if (!data || data.byteLength > 20 * 1024 * 1024) throw new Error('Datei zu gross (max. 20 MB).');
  const ext = path.extname(safeName(fileName, '.mp3')).toLowerCase();
  if (!['.mp3', '.ogg', '.wav', '.m4a', '.webm', '.aac', '.flac'].includes(ext)) throw new Error('Bitte eine Audiodatei wählen.');
  const name = `${Date.now()}${ext}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(data));
  return name;
});
ipcMain.handle('sounds:open-folder', () => shell.openPath(ensureSoundsDir()));

// --- Aktivität: laufende Spiele und Spotify erkennen (nur Windows) ---
const { execFile } = require('child_process');
const KNOWN_GAMES = {
  'cs2.exe': 'Counter-Strike 2', 'valorant-win64-shipping.exe': 'VALORANT', 'fortniteclient-win64-shipping.exe': 'Fortnite',
  'league of legends.exe': 'League of Legends', 'minecraft.windows.exe': 'Minecraft', 'gta5.exe': 'Grand Theft Auto V',
  'gta5_enhanced.exe': 'Grand Theft Auto V', 'rocketleague.exe': 'Rocket League', 'r5apex.exe': 'Apex Legends',
  'r5apex_dx12.exe': 'Apex Legends', 'cod.exe': 'Call of Duty', 'overwatch.exe': 'Overwatch 2', 'fc24.exe': 'EA SPORTS FC 24',
  'fc25.exe': 'EA SPORTS FC 25', 'fc26.exe': 'EA SPORTS FC 26', 'eldenring.exe': 'Elden Ring', 'robloxplayerbeta.exe': 'Roblox',
  'dota2.exe': 'Dota 2', 'rainbowsix.exe': 'Rainbow Six Siege', 'rainbowsix_vulkan.exe': 'Rainbow Six Siege', 'tslgame.exe': 'PUBG',
  'fallguys_client_game.exe': 'Fall Guys', 'among us.exe': 'Among Us', 'cyberpunk2077.exe': 'Cyberpunk 2077',
  'rdr2.exe': 'Red Dead Redemption 2', 'witcher3.exe': 'The Witcher 3', 'deadbydaylight-win64-shipping.exe': 'Dead by Daylight',
  'rustclient.exe': 'Rust', 'terraria.exe': 'Terraria', 'stardew valley.exe': 'Stardew Valley', 'marvel-win64-shipping.exe': 'Marvel Rivals',
  'helldivers2.exe': 'Helldivers 2', 'palworld-win64-shipping.exe': 'Palworld', 'bg3.exe': "Baldur's Gate 3", 'bg3_dx11.exe': "Baldur's Gate 3",
  'hogwartslegacy.exe': 'Hogwarts Legacy', 'forzahorizon5.exe': 'Forza Horizon 5', 'destiny2.exe': 'Destiny 2',
  'warframe.x64.exe': 'Warframe', 'diablo iv.exe': 'Diablo IV', 'wow.exe': 'World of Warcraft', 'hearthstone.exe': 'Hearthstone',
  'ts4_x64.exe': 'Die Sims 4', 'eurotrucks2.exe': 'Euro Truck Simulator 2', 'phasmophobia.exe': 'Phasmophobia',
  'lethal company.exe': 'Lethal Company', 'geometrydash.exe': 'Geometry Dash', 'osu!.exe': 'osu!', 'brawlhalla.exe': 'Brawlhalla',
  'repo.exe': 'R.E.P.O.', 'schedulei.exe': 'Schedule I', 'thefinals.exe': 'THE FINALS', 'deltaforce-win64-shipping.exe': 'Delta Force',
  'nba2k25.exe': 'NBA 2K25', 'nba2k26.exe': 'NBA 2K26', 'f1_24.exe': 'F1 24', 'f1_25.exe': 'F1 25', 'stalker2-win64-shipping.exe': 'S.T.A.L.K.E.R. 2',
  'witchit-win64-shipping.exe': 'Witch It', 'valheim.exe': 'Valheim', 'satisfactory.exe': 'Satisfactory', 'factorio.exe': 'Factorio',
};
let activityCfg = { game: true, music: true, custom: {} };
let lastActivity = null;
let activityTimer = null;

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function scanActivity() {
  if (process.platform !== 'win32' || !win) return;
  execFile('tasklist', ['/v', '/fo', 'csv', '/nh'], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
    if (err || !win) return;
    let game = null; let music = null;
    const custom = Object.fromEntries(Object.entries(activityCfg.custom || {}).map(([k, v]) => [k.toLowerCase(), v]));
    for (const line of stdout.split(/\r?\n/)) {
      if (!line) continue;
      const cols = parseCsvLine(line);
      const exe = (cols[0] || '').toLowerCase();
      const title = cols[cols.length - 1] || '';
      if (activityCfg.game && !game && (custom[exe] || KNOWN_GAMES[exe])) game = custom[exe] || KNOWN_GAMES[exe];
      // Spotify zeigt beim Abspielen "Interpret - Titel" als Fenstertitel
      if (activityCfg.music && !music && exe === 'spotify.exe' && title.includes(' - ') && !/^spotify/i.test(title)) music = title;
    }
    const next = game || music ? { game, music } : null;
    if (JSON.stringify(next) !== JSON.stringify(lastActivity)) {
      lastActivity = next;
      win.webContents.send('activity', next);
    }
  });
}

ipcMain.on('activity:config', (e, cfg) => {
  activityCfg = { game: cfg?.game !== false, music: cfg?.music !== false, custom: cfg?.custom || {} };
  lastActivity = undefined; // beim nächsten Scan sicher neu senden
  if (!activityTimer) activityTimer = setInterval(scanActivity, 20000);
  scanActivity();
});

// --- Fenster ---
ipcMain.on('flash', () => {
  if (win && !win.isFocused()) win.flashFrame(true);
});
ipcMain.on('focus-window', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
