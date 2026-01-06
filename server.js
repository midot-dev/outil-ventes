const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;


// identifiants fixes (prototype)
const USERNAME = "admin";
const PASSWORD = "1234";

app.use(express.json());
app.use(cookieParser());

// sert tes fichiers (index.html, ventes.html, etc.) depuis le dossier actuel
app.use(express.static(path.join(__dirname)));

// session cookie simple
function estConnecte(req) {
  return req.cookies.session === "ok";
}

function proteger(req, res, next) {
  if (estConnecte(req)) return next();
  return res.redirect("/login.html");
}

// API login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === USERNAME && password === PASSWORD) {
    res.cookie("session", "ok", { httpOnly: true, sameSite: "lax" });
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, message: "Identifiants incorrects" });
});

// API logout
app.post("/api/logout", (req, res) => {
  res.clearCookie("session");
  return res.json({ ok: true });
});

// pages protégées
app.get("/ventes.html", proteger, (req, res) =>
  res.sendFile(path.join(__dirname, "ventes.html"))
);

app.get("/stats.html", proteger, (req, res) =>
  res.sendFile(path.join(__dirname, "stats.html"))
);

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré : http://localhost:${PORT}`);
});
app.get("/api/me", (req, res) => {
  return res.json({ connected: estConnecte(req) });
});
