// Bubble – Server
// Konten, Gruppen, Kanäle, Nachrichten (SQLite), Echtzeit (Socket.IO)
// und Zugangs-Tokens für Sprache/Video (LiveKit).

import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AccessToken } from 'livekit-server-sdk';

// ---------- Konfiguration ----------
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || './data';
const JWT_SECRET = process.env.JWT_SECRET || '';
const REGISTRATION_CODE = (process.env.REGISTRATION_CODE || '').trim();
const LK_KEY = process.env.LIVEKIT_API_KEY || '';
const LK_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LK_URL = process.env.LIVEKIT_PUBLIC_URL || '';

if (JWT_SECRET.length < 16) {
  console.error('JWT_SECRET fehlt oder ist zu kurz (mind. 16 Zeichen). Bitte setup.sh ausführen.');
  process.exit(1);
}

// ---------- Datenbank ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'bubble.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS guilds (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  invite_code TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY,
  guild_id INTEGER REFERENCES guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','voice','dm')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dm_members (
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, id);
`);
// Spätere Erweiterungen (bestehende Datenbanken bleiben erhalten)
db.exec(`
CREATE TABLE IF NOT EXISTS sounds (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Allgemein',
  emoji TEXT,
  file TEXT NOT NULL,
  volume REAL NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sounds_user ON sounds(user_id);
`);
for (const sql of ['ALTER TABLE users ADD COLUMN avatar TEXT', 'ALTER TABLE guilds ADD COLUMN icon TEXT', 'ALTER TABLE messages ADD COLUMN sound TEXT']) {
  try { db.exec(sql); } catch { /* Spalte existiert schon */ }
}
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const stmtCache = new Map();
const S = (sql) => {
  let s = stmtCache.get(sql);
  if (!s) { s = db.prepare(sql); stmtCache.set(sql, s); }
  return s;
};

// ---------- Hilfen ----------
const now = () => Date.now();
const COLORS = ['#e8833a', '#5b8def', '#3fb87f', '#e5534b', '#d36ac2', '#20a5c9', '#9a7ff0', '#c9a227'];
const newInviteCode = () => crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8);

const online = new Map();      // userId -> Anzahl offener Verbindungen
const voice = new Map();       // channelId -> Map(userId -> Zustand)

const publicUser = (u) => u && ({ id: u.id, username: u.username, displayName: u.display_name, color: u.color, avatar: u.avatar || null });
const isUploadPath = (p) => typeof p === 'string' && /^\/uploads\/[a-zA-Z0-9_-]+\.(png|jpg|gif|webp)$/.test(p);
const isAudioPath = (p) => typeof p === 'string' && /^\/uploads\/[a-zA-Z0-9_-]+\.(mp3|ogg|wav|webm|m4a)$/.test(p);
const publicSound = (s) => s && ({
  id: s.id, name: s.name, category: s.category, emoji: s.emoji || null, file: s.file, volume: s.volume,
});
const parseSound = (json) => { try { return json ? JSON.parse(json) : null; } catch { return null; } };
const userById = (id) => S('SELECT * FROM users WHERE id=?').get(id);
const getChannel = (id) => S('SELECT * FROM channels WHERE id=?').get(Number(id));
const getGuild = (id) => S('SELECT * FROM guilds WHERE id=?').get(Number(id));
const isMember = (gid, uid) => !!S('SELECT 1 FROM members WHERE guild_id=? AND user_id=?').get(gid, uid);
const dmMemberIds = (chId) => S('SELECT user_id FROM dm_members WHERE channel_id=?').all(chId).map((r) => r.user_id);

function canAccess(uid, ch) {
  if (!ch) return false;
  if (ch.type === 'dm') return !!S('SELECT 1 FROM dm_members WHERE channel_id=? AND user_id=?').get(ch.id, uid);
  return isMember(ch.guild_id, uid);
}

const guildSummary = (g) => ({ id: g.id, name: g.name, ownerId: g.owner_id, inviteCode: g.invite_code, icon: g.icon || null });

function voiceUsers(chId) {
  const m = voice.get(chId);
  if (!m) return [];
  return [...m.values()].map((v) => ({
    userId: v.userId, muted: v.muted, deafened: v.deafened, video: v.video, screen: v.screen,
  }));
}

function guildDetail(gid) {
  const g = getGuild(gid);
  if (!g) return null;
  const channels = S('SELECT id, name, type, position FROM channels WHERE guild_id=? ORDER BY position, id').all(gid);
  const members = S(`SELECT u.* FROM users u JOIN members m ON m.user_id=u.id
                     WHERE m.guild_id=? ORDER BY u.display_name COLLATE NOCASE`).all(gid)
    .map((u) => ({ ...publicUser(u), online: online.has(u.id) }));
  const voiceState = {};
  for (const c of channels) if (c.type === 'voice') voiceState[c.id] = voiceUsers(c.id);
  return { ...guildSummary(g), channels, members, voice: voiceState };
}

function userGuilds(uid) {
  return S(`SELECT g.* FROM guilds g JOIN members m ON m.guild_id=g.id
            WHERE m.user_id=? ORDER BY m.joined_at`).all(uid).map(guildSummary);
}

function userDms(uid) {
  return S(`SELECT c.id, c.created_at, u.id AS uid, u.username, u.display_name, u.color, u.avatar,
              (SELECT MAX(created_at) FROM messages WHERE channel_id=c.id) AS last
            FROM channels c
            JOIN dm_members me ON me.channel_id=c.id AND me.user_id=?
            JOIN dm_members o  ON o.channel_id=c.id AND o.user_id<>?
            JOIN users u ON u.id=o.user_id
            WHERE c.type='dm'
            ORDER BY COALESCE(last, c.created_at) DESC`).all(uid, uid)
    .map((r) => ({
      id: r.id,
      user: { id: r.uid, username: r.username, displayName: r.display_name, color: r.color, avatar: r.avatar || null, online: online.has(r.uid) },
      voice: voiceUsers(r.id),
    }));
}

// Räume aller Leute, die diesen Nutzer "sehen" (gemeinsame Gruppen + DM-Partner)
function peerRooms(uid) {
  const rooms = S('SELECT guild_id FROM members WHERE user_id=?').all(uid).map((r) => `guild:${r.guild_id}`);
  const partners = S(`SELECT DISTINCT o.user_id FROM dm_members me
                      JOIN dm_members o ON o.channel_id=me.channel_id AND o.user_id<>me.user_id
                      WHERE me.user_id=?`).all(uid);
  for (const p of partners) rooms.push(`user:${p.user_id}`);
  return rooms;
}

const sign = (u) => jwt.sign({ uid: u.id }, JWT_SECRET, { expiresIn: '30d' });

// Einfache Bremse gegen Passwort-Raten
const attempts = new Map();
function rateLimited(key, max = 20, windowMs = 15 * 60 * 1000) {
  const t = now();
  const list = (attempts.get(key) || []).filter((x) => t - x < windowMs);
  list.push(t);
  attempts.set(key, list);
  return list.length > max;
}

// ---------- HTTP ----------
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 1e5 });

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  try {
    const p = jwt.verify(token, JWT_SECRET);
    const u = userById(p.uid);
    if (!u) throw new Error('kein Nutzer');
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Nicht angemeldet' });
  }
}

const wrap = (fn) => (req, res) => {
  try {
    const out = fn(req, res);
    if (out && typeof out.then === 'function') {
      out.catch((e) => { console.error(e); res.status(500).json({ error: 'Serverfehler' }); });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Serverfehler' });
  }
};
const fail = (res, code, msg) => res.status(code).json({ error: msg });

function emitToChannel(ch, event, data) {
  if (ch.type === 'dm') {
    io.to(dmMemberIds(ch.id).map((id) => `user:${id}`)).emit(event, data);
  } else {
    io.to(`guild:${ch.guild_id}`).emit(event, data);
  }
}

app.get('/', (req, res) => res.type('text').send('Bubble-Server läuft. Verbinde dich mit der Bubble-App.'));
app.get('/api/health', (req, res) => res.json({
  ok: true, name: 'bubble', registrationCode: !!REGISTRATION_CODE, voice: !!(LK_KEY && LK_SECRET && LK_URL),
}));

app.post('/api/register', wrap(async (req, res) => {
  if (rateLimited('reg:' + req.ip, 10)) return fail(res, 429, 'Zu viele Versuche, bitte später nochmals.');
  const { username, password, displayName, inviteCode } = req.body || {};
  if (REGISTRATION_CODE && String(inviteCode || '').trim() !== REGISTRATION_CODE) {
    return fail(res, 403, 'Falscher Registrierungs-Code.');
  }
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(String(username || ''))) {
    return fail(res, 400, 'Benutzername: 3–24 Zeichen, nur Buchstaben, Zahlen, _ . -');
  }
  if (String(password || '').length < 8) return fail(res, 400, 'Passwort: mindestens 8 Zeichen.');
  if (S('SELECT 1 FROM users WHERE username=?').get(username)) return fail(res, 409, 'Benutzername ist schon vergeben.');
  const name = String(displayName || username).trim().slice(0, 32) || username;
  const hash = await bcrypt.hash(password, 11);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const info = S('INSERT INTO users (username, password_hash, display_name, color, created_at) VALUES (?,?,?,?,?)')
    .run(username, hash, name, color, now());
  const u = userById(info.lastInsertRowid);
  res.json({ token: sign(u), user: publicUser(u) });
}));

app.post('/api/login', wrap(async (req, res) => {
  if (rateLimited('login:' + req.ip)) return fail(res, 429, 'Zu viele Versuche, bitte später nochmals.');
  const { username, password } = req.body || {};
  const u = S('SELECT * FROM users WHERE username=?').get(String(username || ''));
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) {
    return fail(res, 401, 'Benutzername oder Passwort falsch.');
  }
  res.json({ token: sign(u), user: publicUser(u) });
}));

app.get('/api/me', auth, wrap((req, res) => {
  res.json({ user: publicUser(req.user), guilds: userGuilds(req.user.id), dms: userDms(req.user.id) });
}));

app.patch('/api/me', auth, wrap(async (req, res) => {
  const { displayName, color, password, newPassword, avatar } = req.body || {};
  const u = req.user;
  if (avatar !== undefined) {
    if (avatar !== null && !isUploadPath(avatar)) return fail(res, 400, 'Ungültiges Profilbild.');
    S('UPDATE users SET avatar=? WHERE id=?').run(avatar, u.id);
  }
  if (displayName !== undefined) {
    const n = String(displayName).trim().slice(0, 32);
    if (!n) return fail(res, 400, 'Anzeigename darf nicht leer sein.');
    S('UPDATE users SET display_name=? WHERE id=?').run(n, u.id);
  }
  if (color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(color))) return fail(res, 400, 'Ungültige Farbe.');
    S('UPDATE users SET color=? WHERE id=?').run(color, u.id);
  }
  if (newPassword !== undefined) {
    if (!(await bcrypt.compare(String(password || ''), u.password_hash))) return fail(res, 403, 'Aktuelles Passwort ist falsch.');
    if (String(newPassword).length < 8) return fail(res, 400, 'Neues Passwort: mindestens 8 Zeichen.');
    S('UPDATE users SET password_hash=? WHERE id=?').run(await bcrypt.hash(newPassword, 11), u.id);
  }
  const updated = publicUser(userById(u.id));
  io.to([...peerRooms(u.id), `user:${u.id}`]).emit('user:update', updated);
  res.json({ user: updated });
}));

// --- Bilder & GIFs (Profilbild, Gruppen-Icon, Chat) ---
const ascii = (b, from, to) => b.subarray(from, to).toString('ascii');
const UPLOAD_TYPES = {
  'image/png': { ext: 'png', max: 10, ok: (b) => b[0] === 0x89 && ascii(b, 1, 4) === 'PNG' },
  'image/jpeg': { ext: 'jpg', max: 10, ok: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/gif': { ext: 'gif', max: 10, ok: (b) => ascii(b, 0, 4) === 'GIF8' },
  'image/webp': { ext: 'webp', max: 10, ok: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
  // Sounds fürs Soundboard
  'audio/mpeg': { ext: 'mp3', max: 5, ok: (b) => ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  'audio/ogg': { ext: 'ogg', max: 5, ok: (b) => ascii(b, 0, 4) === 'OggS' },
  'audio/wav': { ext: 'wav', max: 5, ok: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE' },
  'audio/webm': { ext: 'webm', max: 5, ok: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  'audio/mp4': { ext: 'm4a', max: 5, ok: (b) => ascii(b, 4, 8) === 'ftyp' },
};
UPLOAD_TYPES['audio/x-wav'] = UPLOAD_TYPES['audio/wav'];
UPLOAD_TYPES['audio/wave'] = UPLOAD_TYPES['audio/wav'];
UPLOAD_TYPES['audio/x-m4a'] = UPLOAD_TYPES['audio/mp4'];
UPLOAD_TYPES['audio/mp3'] = UPLOAD_TYPES['audio/mpeg'];
app.post('/api/upload', auth, express.raw({ type: Object.keys(UPLOAD_TYPES), limit: '10mb' }), wrap((req, res) => {
  if (rateLimited('up:' + req.user.id, 60, 10 * 60 * 1000)) return fail(res, 429, 'Zu viele Uploads, bitte kurz warten.');
  const t = UPLOAD_TYPES[String(req.headers['content-type'] || '').split(';')[0]];
  const buf = req.body;
  if (!t || !Buffer.isBuffer(buf) || buf.length < 12 || !t.ok(buf)) {
    return fail(res, 400, 'Nur Bilder (PNG, JPG, GIF, WEBP) oder Sounds (MP3, OGG, WAV, M4A).');
  }
  if (buf.length > t.max * 1024 * 1024) return fail(res, 400, `Datei zu gross (max. ${t.max} MB).`);
  const name = `${crypto.randomBytes(12).toString('base64url')}.${t.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  res.json({ path: `/uploads/${name}` });
}));
app.use('/uploads', (req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); },
  express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, index: false }));

// --- Soundboard (pro Person, mit Ordnern) ---
app.get('/api/sounds', auth, wrap((req, res) => {
  res.json({ sounds: S('SELECT * FROM sounds WHERE user_id=? ORDER BY category COLLATE NOCASE, name COLLATE NOCASE').all(req.user.id).map(publicSound) });
}));

const cleanCategory = (c) => String(c || 'Allgemein').trim().slice(0, 30) || 'Allgemein';
const cleanEmoji = (e) => (e ? String(e).trim().slice(0, 8) : null);
const cleanVolume = (v) => Math.min(1.5, Math.max(0.05, Number(v) || 1));

app.post('/api/sounds', auth, wrap((req, res) => {
  const { name, category, emoji, file, volume } = req.body || {};
  if (!isAudioPath(file)) return fail(res, 400, 'Bitte zuerst eine Sound-Datei hochladen.');
  const n = String(name || '').trim().slice(0, 32);
  if (!n) return fail(res, 400, 'Bitte einen Namen eingeben.');
  if (S('SELECT COUNT(*) AS c FROM sounds WHERE user_id=?').get(req.user.id).c >= 200) return fail(res, 400, 'Maximal 200 Sounds pro Person.');
  const id = S('INSERT INTO sounds (user_id, name, category, emoji, file, volume, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, n, cleanCategory(category), cleanEmoji(emoji), file, cleanVolume(volume), now()).lastInsertRowid;
  res.json({ sound: publicSound(S('SELECT * FROM sounds WHERE id=?').get(id)) });
}));

app.patch('/api/sounds/:id', auth, wrap((req, res) => {
  const s = S('SELECT * FROM sounds WHERE id=? AND user_id=?').get(Number(req.params.id), req.user.id);
  if (!s) return fail(res, 404, 'Sound nicht gefunden.');
  const b = req.body || {};
  const name = b.name !== undefined ? String(b.name).trim().slice(0, 32) || s.name : s.name;
  S('UPDATE sounds SET name=?, category=?, emoji=?, volume=? WHERE id=?').run(
    name,
    b.category !== undefined ? cleanCategory(b.category) : s.category,
    b.emoji !== undefined ? cleanEmoji(b.emoji) : s.emoji,
    b.volume !== undefined ? cleanVolume(b.volume) : s.volume,
    s.id,
  );
  res.json({ sound: publicSound(S('SELECT * FROM sounds WHERE id=?').get(s.id)) });
}));

// Ganzen Ordner umbenennen
app.post('/api/sounds/rename-category', auth, wrap((req, res) => {
  const from = cleanCategory(req.body?.from);
  const to = cleanCategory(req.body?.to);
  S('UPDATE sounds SET category=? WHERE user_id=? AND category=?').run(to, req.user.id, from);
  res.json({ ok: true });
}));

app.delete('/api/sounds/:id', auth, wrap((req, res) => {
  S('DELETE FROM sounds WHERE id=? AND user_id=?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));

// --- Gruppen ---
app.post('/api/guilds', auth, wrap((req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 50);
  if (!name) return fail(res, 400, 'Bitte einen Namen eingeben.');
  const uid = req.user.id;
  const gid = db.transaction(() => {
    const t = now();
    const g = S('INSERT INTO guilds (name, owner_id, invite_code, created_at) VALUES (?,?,?,?)')
      .run(name, uid, newInviteCode(), t).lastInsertRowid;
    S('INSERT INTO members (guild_id, user_id, joined_at) VALUES (?,?,?)').run(g, uid, t);
    S('INSERT INTO channels (guild_id, name, type, position, created_at) VALUES (?,?,?,?,?)').run(g, 'allgemein', 'text', 0, t);
    S('INSERT INTO channels (guild_id, name, type, position, created_at) VALUES (?,?,?,?,?)').run(g, 'Lounge', 'voice', 1, t);
    S('INSERT INTO channels (guild_id, name, type, position, created_at) VALUES (?,?,?,?,?)').run(g, 'Gaming', 'voice', 2, t);
    return g;
  })();
  io.in(`user:${uid}`).socketsJoin(`guild:${gid}`);
  res.json(guildDetail(gid));
}));

app.post('/api/guilds/join', auth, wrap((req, res) => {
  const code = String(req.body?.code || '').trim();
  const g = S('SELECT * FROM guilds WHERE invite_code=?').get(code);
  if (!g) return fail(res, 404, 'Einladungscode ungültig.');
  S('INSERT OR IGNORE INTO members (guild_id, user_id, joined_at) VALUES (?,?,?)').run(g.id, req.user.id, now());
  io.in(`user:${req.user.id}`).socketsJoin(`guild:${g.id}`);
  io.to(`guild:${g.id}`).emit('guild:update', { guildId: g.id });
  res.json(guildDetail(g.id));
}));

app.get('/api/guilds/:id', auth, wrap((req, res) => {
  const gid = Number(req.params.id);
  if (!isMember(gid, req.user.id)) return fail(res, 404, 'Gruppe nicht gefunden.');
  res.json(guildDetail(gid));
}));

app.post('/api/guilds/:id/leave', auth, wrap((req, res) => {
  const g = getGuild(req.params.id);
  if (!g || !isMember(g.id, req.user.id)) return fail(res, 404, 'Gruppe nicht gefunden.');
  if (g.owner_id === req.user.id) return fail(res, 400, 'Als Besitzer kannst du die Gruppe nur löschen.');
  S('DELETE FROM members WHERE guild_id=? AND user_id=?').run(g.id, req.user.id);
  io.in(`user:${req.user.id}`).socketsLeave(`guild:${g.id}`);
  io.to(`guild:${g.id}`).emit('guild:update', { guildId: g.id });
  res.json({ ok: true });
}));

app.delete('/api/guilds/:id', auth, wrap((req, res) => {
  const g = getGuild(req.params.id);
  if (!g || g.owner_id !== req.user.id) return fail(res, 403, 'Nur der Besitzer kann die Gruppe löschen.');
  io.to(`guild:${g.id}`).emit('guild:deleted', { guildId: g.id });
  io.in(`guild:${g.id}`).socketsLeave(`guild:${g.id}`);
  for (const c of S('SELECT id FROM channels WHERE guild_id=?').all(g.id)) voice.delete(c.id);
  S('DELETE FROM guilds WHERE id=?').run(g.id);
  res.json({ ok: true });
}));

app.post('/api/guilds/:id/invite', auth, wrap((req, res) => {
  const g = getGuild(req.params.id);
  if (!g || g.owner_id !== req.user.id) return fail(res, 403, 'Nur der Besitzer kann den Code erneuern.');
  S('UPDATE guilds SET invite_code=? WHERE id=?').run(newInviteCode(), g.id);
  io.to(`guild:${g.id}`).emit('guild:update', { guildId: g.id });
  res.json(guildDetail(g.id));
}));

app.patch('/api/guilds/:id', auth, wrap((req, res) => {
  const g = getGuild(req.params.id);
  if (!g || g.owner_id !== req.user.id) return fail(res, 403, 'Nur der Besitzer kann die Gruppe ändern.');
  if (req.body?.name !== undefined) {
    const name = String(req.body.name || '').trim().slice(0, 50);
    if (!name) return fail(res, 400, 'Bitte einen Namen eingeben.');
    S('UPDATE guilds SET name=? WHERE id=?').run(name, g.id);
  }
  if (req.body?.icon !== undefined) {
    if (req.body.icon !== null && !isUploadPath(req.body.icon)) return fail(res, 400, 'Ungültiges Icon.');
    S('UPDATE guilds SET icon=? WHERE id=?').run(req.body.icon, g.id);
  }
  io.to(`guild:${g.id}`).emit('guild:update', { guildId: g.id });
  res.json(guildDetail(g.id));
}));

// --- Kanäle ---
app.post('/api/guilds/:id/channels', auth, wrap((req, res) => {
  const g = getGuild(req.params.id);
  if (!g || g.owner_id !== req.user.id) return fail(res, 403, 'Nur der Besitzer kann Kanäle erstellen.');
  const type = req.body?.type === 'voice' ? 'voice' : 'text';
  let name = String(req.body?.name || '').trim().slice(0, 40);
  if (type === 'text') name = name.toLowerCase().replace(/\s+/g, '-');
  if (!name) return fail(res, 400, 'Bitte einen Kanalnamen eingeben.');
  const pos = (S('SELECT MAX(position) AS p FROM channels WHERE guild_id=?').get(g.id).p ?? 0) + 1;
  S('INSERT INTO channels (guild_id, name, type, position, created_at) VALUES (?,?,?,?,?)').run(g.id, name, type, pos, now());
  io.to(`guild:${g.id}`).emit('guild:update', { guildId: g.id });
  res.json(guildDetail(g.id));
}));

app.delete('/api/channels/:id', auth, wrap((req, res) => {
  const ch = getChannel(req.params.id);
  const g = ch && ch.guild_id ? getGuild(ch.guild_id) : null;
  if (!g || g.owner_id !== req.user.id) return fail(res, 403, 'Nur der Besitzer kann Kanäle löschen.');
  S('DELETE FROM channels WHERE id=?').run(ch.id);
  voice.delete(ch.id);
  io.to(`guild:${g.id}`).emit('guild:update', { guildId: g.id });
  res.json({ ok: true });
}));

app.get('/api/channels/:id/messages', auth, wrap((req, res) => {
  const ch = getChannel(req.params.id);
  if (!canAccess(req.user.id, ch)) return fail(res, 404, 'Kanal nicht gefunden.');
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
  const rows = S(`SELECT m.id, m.content, m.sound, m.created_at, u.id AS uid, u.username, u.display_name, u.color, u.avatar
                  FROM messages m JOIN users u ON u.id=m.user_id
                  WHERE m.channel_id=? AND m.id<? ORDER BY m.id DESC LIMIT 50`).all(ch.id, before);
  res.json({
    messages: rows.reverse().map((r) => ({
      id: r.id, channelId: ch.id, content: r.content, sound: parseSound(r.sound), createdAt: r.created_at,
      author: { id: r.uid, username: r.username, displayName: r.display_name, color: r.color, avatar: r.avatar || null },
    })),
  });
}));

app.delete('/api/messages/:id', auth, wrap((req, res) => {
  const m = S('SELECT * FROM messages WHERE id=?').get(Number(req.params.id));
  const ch = m && getChannel(m.channel_id);
  if (!m || !canAccess(req.user.id, ch)) return fail(res, 404, 'Nachricht nicht gefunden.');
  const g = ch.guild_id ? getGuild(ch.guild_id) : null;
  if (m.user_id !== req.user.id && !(g && g.owner_id === req.user.id)) return fail(res, 403, 'Keine Berechtigung.');
  S('DELETE FROM messages WHERE id=?').run(m.id);
  emitToChannel(ch, 'message:deleted', { id: m.id, channelId: ch.id });
  res.json({ ok: true });
}));

// --- Direktnachrichten ---
app.post('/api/dms', auth, wrap((req, res) => {
  const other = req.body?.userId
    ? userById(Number(req.body.userId))
    : S('SELECT * FROM users WHERE username=?').get(String(req.body?.username || '').trim());
  if (!other) return fail(res, 404, 'Diesen Benutzer gibt es nicht.');
  if (other.id === req.user.id) return fail(res, 400, 'Das bist du selbst 🙂');
  let row = S(`SELECT c.id FROM channels c
               JOIN dm_members a ON a.channel_id=c.id AND a.user_id=?
               JOIN dm_members b ON b.channel_id=c.id AND b.user_id=?
               WHERE c.type='dm'`).get(req.user.id, other.id);
  if (!row) {
    const id = db.transaction(() => {
      const c = S('INSERT INTO channels (guild_id, name, type, position, created_at) VALUES (NULL, ?, ?, 0, ?)')
        .run('dm', 'dm', now()).lastInsertRowid;
      S('INSERT INTO dm_members (channel_id, user_id) VALUES (?,?)').run(c, req.user.id);
      S('INSERT INTO dm_members (channel_id, user_id) VALUES (?,?)').run(c, other.id);
      return c;
    })();
    row = { id };
    io.to(`user:${other.id}`).emit('dm:update', {});
  }
  res.json({ id: row.id, user: { ...publicUser(other), online: online.has(other.id) }, voice: voiceUsers(row.id) });
}));

// --- Sprache / Video ---
app.post('/api/rtc/token', auth, wrap(async (req, res) => {
  if (!LK_KEY || !LK_SECRET || !LK_URL) return fail(res, 503, 'Sprachserver ist nicht eingerichtet.');
  const ch = getChannel(req.body?.channelId);
  if (!canAccess(req.user.id, ch) || (ch.type !== 'voice' && ch.type !== 'dm')) {
    return fail(res, 404, 'Sprachkanal nicht gefunden.');
  }
  const at = new AccessToken(LK_KEY, LK_SECRET, {
    identity: String(req.user.id),
    name: req.user.display_name,
    ttl: '12h',
  });
  at.addGrant({ roomJoin: true, room: `ch-${ch.id}`, canPublish: true, canSubscribe: true, canPublishData: true });
  res.json({ url: LK_URL, token: await at.toJwt() });
}));

// ---------- Echtzeit ----------
io.use((socket, next) => {
  try {
    const p = jwt.verify(String(socket.handshake.auth?.token || ''), JWT_SECRET);
    const u = userById(p.uid);
    if (!u) throw new Error('kein Nutzer');
    socket.data.uid = u.id;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

function emitVoice(chId) {
  const ch = getChannel(chId);
  if (ch) emitToChannel(ch, 'voice:update', { channelId: ch.id, guildId: ch.guild_id, users: voiceUsers(ch.id) });
}

function removeFromVoice(uid, exceptSocketId) {
  for (const [chId, m] of voice) {
    const v = m.get(uid);
    if (v && v.socketId !== exceptSocketId) {
      m.delete(uid);
      if (!m.size) voice.delete(chId);
      io.to(v.socketId).emit('voice:kicked', { channelId: chId });
      emitVoice(chId);
    }
  }
}

function leaveVoice(socket) {
  const chId = socket.data.voiceChannel;
  if (!chId) return;
  socket.data.voiceChannel = null;
  const m = voice.get(chId);
  const v = m?.get(socket.data.uid);
  if (v && v.socketId === socket.id) {
    m.delete(socket.data.uid);
    if (!m.size) voice.delete(chId);
  }
  emitVoice(chId);
}

const cleanState = (s = {}) => ({ muted: !!s.muted, deafened: !!s.deafened, video: !!s.video, screen: !!s.screen });

io.on('connection', (socket) => {
  const uid = socket.data.uid;
  socket.join(`user:${uid}`);
  for (const r of S('SELECT guild_id FROM members WHERE user_id=?').all(uid)) socket.join(`guild:${r.guild_id}`);

  const wasOnline = online.has(uid);
  online.set(uid, (online.get(uid) || 0) + 1);
  if (!wasOnline) io.to(peerRooms(uid)).emit('presence', { userId: uid, online: true });

  socket.on('message:send', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const ch = getChannel(payload?.channelId);
    if (!canAccess(uid, ch) || ch.type === 'voice') return reply({ error: 'Kanal nicht gefunden.' });
    let content = String(payload?.content || '').trim();
    let sound = null;
    if (payload?.soundId) {
      const s = S('SELECT * FROM sounds WHERE id=? AND user_id=?').get(Number(payload.soundId), uid);
      if (!s) return reply({ error: 'Sound nicht gefunden.' });
      sound = { name: s.name, emoji: s.emoji || null, file: s.file, volume: s.volume };
      content = `${s.emoji || '🔊'} ${s.name}`;
    }
    if (!content) return reply({ error: 'Leere Nachricht.' });
    if (content.length > 4000) return reply({ error: 'Nachricht ist zu lang (max. 4000 Zeichen).' });
    const t = now();
    const id = S('INSERT INTO messages (channel_id, user_id, content, sound, created_at) VALUES (?,?,?,?,?)')
      .run(ch.id, uid, content, sound ? JSON.stringify(sound) : null, t).lastInsertRowid;
    const msg = { id, channelId: ch.id, guildId: ch.guild_id, content, sound, createdAt: t, author: publicUser(userById(uid)) };
    emitToChannel(ch, 'message:new', msg);
    reply({ ok: true, message: msg });
  });

  socket.on('typing', (payload) => {
    const ch = getChannel(payload?.channelId);
    if (!canAccess(uid, ch)) return;
    const data = { channelId: ch.id, userId: uid };
    if (ch.type === 'dm') socket.to(dmMemberIds(ch.id).map((id) => `user:${id}`)).emit('typing', data);
    else socket.to(`guild:${ch.guild_id}`).emit('typing', data);
  });

  socket.on('voice:join', (payload) => {
    const ch = getChannel(payload?.channelId);
    if (!canAccess(uid, ch) || (ch.type !== 'voice' && ch.type !== 'dm')) return;
    leaveVoice(socket);
    removeFromVoice(uid, socket.id);
    if (!voice.has(ch.id)) voice.set(ch.id, new Map());
    voice.get(ch.id).set(uid, { userId: uid, socketId: socket.id, ...cleanState(payload.state) });
    socket.data.voiceChannel = ch.id;
    emitVoice(ch.id);
  });

  socket.on('voice:state', (payload) => {
    const chId = socket.data.voiceChannel;
    const v = chId && voice.get(chId)?.get(uid);
    if (!v || v.socketId !== socket.id) return;
    Object.assign(v, cleanState(payload?.state));
    emitVoice(chId);
  });

  socket.on('voice:leave', () => leaveVoice(socket));

  // Anrufe in Direktnachrichten
  const forOthersInDm = (chId, fn) => {
    const ch = getChannel(chId);
    if (!canAccess(uid, ch) || ch.type !== 'dm') return;
    for (const other of dmMemberIds(ch.id)) if (other !== uid) fn(ch, other);
  };
  socket.on('call:ring', (p) => forOthersInDm(p?.channelId, (ch, other) => {
    io.to(`user:${other}`).emit('call:incoming', { channelId: ch.id, from: publicUser(userById(uid)), video: !!p.video });
  }));
  socket.on('call:decline', (p) => forOthersInDm(p?.channelId, (ch, other) => {
    io.to(`user:${other}`).emit('call:declined', { channelId: ch.id, userId: uid });
  }));
  socket.on('call:cancel', (p) => forOthersInDm(p?.channelId, (ch, other) => {
    io.to(`user:${other}`).emit('call:cancelled', { channelId: ch.id, userId: uid });
  }));

  socket.on('disconnect', () => {
    leaveVoice(socket);
    const left = (online.get(uid) || 1) - 1;
    if (left <= 0) {
      online.delete(uid);
      io.to(peerRooms(uid)).emit('presence', { userId: uid, online: false });
    } else {
      online.set(uid, left);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Bubble-Server läuft auf Port ${PORT}`);
  if (!LK_KEY || !LK_SECRET || !LK_URL) console.warn('Hinweis: LiveKit ist nicht konfiguriert – Sprache/Video sind deaktiviert.');
  if (!REGISTRATION_CODE) console.warn('Hinweis: Kein REGISTRATION_CODE gesetzt – jeder mit der Adresse kann sich registrieren.');
});
