const express = require("express");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Render / proxies (IMPORTANT pour cookies secure derrière HTTPS)
app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

// ---- Base SQLite ----
const db = new Database(path.join(__dirname, "data.sqlite"));

// Table users
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---- Sessions ----
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "change-moi-en-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // true sur Render (HTTPS)
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    }
  })
);

// ---- Static files ----
app.use(express.static(path.join(__dirname)));

// ---- Helpers ----
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login.html");
}

// ---- API ----

// Qui suis-je ?
app.get("/api/me", (req, res) => {
  if (req.session?.user) {
    return res.json({ connected: true, user: req.session.user });
  }
  return res.json({ connected: false });
});

// Créer un compte (register)
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body || {};
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "");

  if (u.length < 3) return res.status(400).json({ ok: false, message: "Nom d’utilisateur trop court (min 3)." });
  if (p.length < 6) return res.status(400).json({ ok: false, message: "Mot de passe trop court (min 6)." });

  // username unique
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(u);
  if (exists) return res.status(409).json({ ok: false, message: "Nom d’utilisateur déjà pris." });

  const hash = await bcrypt.hash(p, 12);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(u, hash);

  return res.json({ ok: true });
});

// Connexion
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "");

  const userRow = db.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").get(u);
  if (!userRow) return res.status(401).json({ ok: false, message: "Identifiants incorrects" });

  const ok = await bcrypt.compare(p, userRow.password_hash);
  if (!ok) return res.status(401).json({ ok: false, message: "Identifiants incorrects" });

  req.session.user = { id: userRow.id, username: userRow.username };
  return res.json({ ok: true });
});
const bcrypt = require("bcrypt");

// Créer un compte utilisateur
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({
      message: "Nom ≥ 3 caractères, mot de passe ≥ 6 caractères"
    });
  }

  const db = getDb();

  const existing = db.prepare(
    "SELECT id FROM users WHERE username = ?"
  ).get(username);

  if (existing) {
    return res.status(400).json({ message: "Utilisateur déjà existant" });
  }

  const hash = await bcrypt.hash(password, 10);

  db.prepare(
    "INSERT INTO users (username, password) VALUES (?, ?)"
  ).run(username, hash);

  res.json({ success: true });
});


// Déconnexion
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.json({ ok: true });
  });
});

// ---- Pages protégées ----
app.get("/ventes.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "ventes.html"));
});

app.get("/stats.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "stats.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré : http://localhost:${PORT}`);
});
