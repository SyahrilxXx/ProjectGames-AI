const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); }
  catch { return []; }
}
function writeUsers(users) {
  const temp = USERS_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(users, null, 2));
  fs.renameSync(temp, USERS_FILE);
}
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}
function verifyPassword(password, user) {
  const candidate = crypto.scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.passwordHash, "hex");
  return stored.length === candidate.length && crypto.timingSafeEqual(candidate, stored);
}
const SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(48).toString("hex");
function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, username: user.username, exp: Date.now() + 7*24*60*60*1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return payload + "." + sig;
}
function getTokenUser(token) {
  try {
    const [payload, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Date.now()) return null;
    const user = readUsers().find(u => u.id === data.id);
    return user ? { id: user.id, username: user.username } : null;
  } catch { return null; }
}
function cleanUser(u) { return { id: u.id, username: u.username, createdAt: u.createdAt }; }

app.post("/api/register", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username))
    return res.status(400).json({ error: "Username harus 3–16 karakter (huruf, angka, underscore)." });
  if (password.length < 8 || password.length > 72)
    return res.status(400).json({ error: "Password harus 8–72 karakter." });
  const users = readUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ error: "Username sudah digunakan." });
  const { salt, hash } = hashPassword(password);
  const user = { id: crypto.randomUUID(), username, salt, passwordHash: hash, createdAt: new Date().toISOString(), xp: 0 };
  users.push(user); writeUsers(users);
  res.json({ token: makeToken(user), user: cleanUser(user) });
});
app.post("/api/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = readUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !verifyPassword(password, user))
    return res.status(401).json({ error: "Username atau password tidak sesuai." });
  res.json({ token: makeToken(user), user: cleanUser(user) });
});
app.get("/api/me", (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = getTokenUser(token);
  if (!user) return res.status(401).json({ error: "Sesi berakhir. Silakan login kembali." });
  res.json({ user });
});

const players = new Map();
const WORLD = { width: 1800, height: 1100 };
io.use((socket, next) => {
  const user = getTokenUser(socket.handshake.auth?.token || "");
  if (!user) return next(new Error("AUTH_REQUIRED"));
  socket.user = user; next();
});
io.on("connection", socket => {
  const existing = [...players.values()].find(p => p.id === socket.user.id);
  if (existing) {
    const old = io.sockets.sockets.get(existing.socketId);
    if (old) old.disconnect(true);
  }
  const player = { id: socket.user.id, username: socket.user.username, x: 900 + Math.random()*80-40, y: 550 + Math.random()*80-40, color: ["#55d9f4","#8d88ff","#61dfb3","#f0c66b","#ff8ca8"][Math.floor(Math.random()*5)], socketId: socket.id };
  players.set(socket.id, player);
  socket.emit("world:init", { selfId: socket.id, world: WORLD, players: [...players.values()].map(({socketId,...p})=>p) });
  socket.broadcast.emit("player:joined", (({socketId,...p})=>p)(player));
  socket.on("player:move", data => {
    const p = players.get(socket.id); if (!p) return;
    const x = Number(data?.x), y = Number(data?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    p.x = Math.max(24, Math.min(WORLD.width-24, x));
    p.y = Math.max(24, Math.min(WORLD.height-24, y));
    socket.broadcast.emit("player:moved", { id:p.id, x:p.x, y:p.y });
  });
  socket.on("world:chat", raw => {
    const message = String(raw || "").trim().slice(0,120);
    if (!message) return;
    io.emit("world:chat", { username: socket.user.username, message, at: Date.now() });
  });
  socket.on("world:emote", emote => {
    const allowed = ["wave","spark","dance"];
    if (allowed.includes(emote)) io.emit("player:emote", { id:socket.user.id, emote });
  });
  socket.on("disconnect", () => {
    const p=players.get(socket.id); players.delete(socket.id);
    if (p) socket.broadcast.emit("player:left", { id:p.id });
  });
});
server.listen(PORT, () => console.log(`NEXORA Multiplayer running at http://localhost:${PORT}`));
