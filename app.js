// ================== AUTH (serveur + cookies) ==================

async function apiLogin(username, password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  (async () => {
  await protegerPages();
  await injecterDeconnexion();
  initLoginPage();
  initRegisterPage();   // ✅ AJOUT
  initVentesPage();
  initStatsPage();
})();


  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Identifiants incorrects");
  }
  return res.json();
}

async function apiLogout() {
  await fetch("/api/logout", { method: "POST" });
}

async function apiMe() {
  const res = await fetch("/api/me");
  return res.json(); // { connected: true/false }
}
async function apiRegister(username, password) {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Impossible de créer le compte");
  }
  return data;
}

function initRegisterPage() {
  const btn = document.getElementById("registerBtn");
  const userInput = document.getElementById("regUsername");
  const passInput = document.getElementById("regPassword");
  const msg = document.getElementById("registerMsg");

  if (!btn || !userInput || !passInput) return;

  btn.addEventListener("click", async () => {
    msg.style.display = "none";

    const username = userInput.value.trim();
    const password = passInput.value;

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      msg.textContent = "Compte créé avec succès ✅";
      msg.style.display = "block";

      setTimeout(() => {
        window.location.href = "/login.html";
      }, 1000);

    } catch (err) {
      msg.textContent = err.message;
      msg.style.display = "block";
    }
  });
}


// Protège ventes.html et stats.html
async function protegerPages() {
  const estPageVentes =
    document.getElementById("btn") &&
    document.getElementById("liste") &&
    document.getElementById("nom") &&
    document.getElementById("montant");

  const estPageStats =
    document.getElementById("statTotal") &&
    document.getElementById("statNb") &&
    document.getElementById("statMoy");

  if (!(estPageVentes || estPageStats)) return;

  const me = await apiMe();
  if (!me.connected) {
    window.location.href = "/login.html";
  }
}

// Ajoute un bouton "Déconnexion" dans la nav si connecté
async function injecterDeconnexion() {
  const navLinks = document.querySelector(".nav__links");
  if (!navLinks) return;
  if (document.getElementById("logoutLink")) return;

  const me = await apiMe();
  if (!me.connected) return;

  const a = document.createElement("a");
  a.href = "#";
  a.id = "logoutLink";
  a.className = "nav__link";
  a.textContent = "Déconnexion";
  a.addEventListener("click", async (e) => {
    e.preventDefault();
    await apiLogout();
    window.location.href = "/login.html";
  });
  navLinks.appendChild(a);
}

// ================== STORAGE VENTES (local pour l'instant) ==================
function lireVentes() {
  try {
    return JSON.parse(localStorage.getItem("ventes")) || [];
  } catch {
    return [];
  }
}

function sauverVentes(ventes) {
  localStorage.setItem("ventes", JSON.stringify(ventes));
}

// ================== OUTILS ==================
function maintenantFR() {
  const d = new Date();
  const jour = d.toLocaleDateString("fr-FR");
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} ${heure}`;
}

function echapperCSV(valeur) {
  const s = String(valeur ?? "");
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ================== LOGIN PAGE ==================
function initLoginPage() {
  const loginBtn = document.getElementById("loginBtn");
  const userInput = document.getElementById("username");
  const passInput = document.getElementById("password");
  const msg = document.getElementById("loginMsg");

  if (!loginBtn || !userInput || !passInput) return;

  async function tenterConnexion() {
  const u = userInput.value.trim();
  const p = passInput.value;

  msg.textContent = "";
  msg.style.display = "none";
  loginBtn.disabled = true; // 🔒 on bloque le bouton

  try {
    await apiLogin(u, p);
    window.location.href = "/ventes.html";
  } catch (err) {
    msg.style.display = "block";
    msg.textContent = err.message;
  } finally {
    loginBtn.disabled = false; // 🔓 on débloque TOUJOURS
  }
}

  loginBtn.addEventListener("click", tenterConnexion);
  passInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tenterConnexion(); });
  userInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tenterConnexion(); });

  // Si déjà connecté, on peut rediriger direct
  apiMe().then(me => {
    if (me.connected) window.location.href = "/ventes.html";
  });
}

// ================== PAGE VENTES ==================
function initVentesPage() {
  const inputNom = document.getElementById("nom");
  const inputMontant = document.getElementById("montant");
  const bouton = document.getElementById("btn");
  const liste = document.getElementById("liste");
  const totalSpan = document.getElementById("total");
  const boutonUndo = document.getElementById("undo");
  const boutonExport = document.getElementById("export");

  if (!inputNom || !inputMontant || !bouton || !liste || !totalSpan || !boutonUndo || !boutonExport) return;

  let ventes = lireVentes();
  let total = 0;

  function majTotal() {
    totalSpan.textContent = total.toFixed(2);
  }

  function ajouterLigne(vente) {
    const li = document.createElement("li");
    li.textContent = `[${vente.dateHeure}] ${vente.nom} - ${vente.montant.toFixed(2)} €`;
    liste.appendChild(li);
  }

  function recalculerEtAfficher() {
    liste.innerHTML = "";
    total = 0;
    for (const v of ventes) {
      ajouterLigne(v);
      total += Number(v.montant) || 0;
    }
    majTotal();
  }

  function ajouterVente() {
    const nom = inputNom.value.trim();
    const montant = Number(inputMontant.value);
    if (nom === "" || !Number.isFinite(montant) || montant <= 0) return;

    const vente = { nom, montant, dateHeure: maintenantFR() };
    ventes.push(vente);
    sauverVentes(ventes);

    ajouterLigne(vente);
    total += montant;
    majTotal();

    inputNom.value = "";
    inputMontant.value = "";
    inputNom.focus();
  }

  function annulerDerniereVente() {
    if (ventes.length === 0) return;

    const derniere = ventes[ventes.length - 1];
    const ok = confirm(`Annuler la dernière vente ?\n\n${derniere.nom} - ${Number(derniere.montant).toFixed(2)} €`);
    if (!ok) return;

    const supprimee = ventes.pop();
    sauverVentes(ventes);

    total -= Number(supprimee.montant) || 0;
    if (total < 0) total = 0;
    majTotal();

    if (liste.lastElementChild) {
      liste.removeChild(liste.lastElementChild);
    } else {
      recalculerEtAfficher();
    }
  }

  function exporterCSV() {
    if (ventes.length === 0) {
      alert("Aucune vente à exporter.");
      return;
    }

    const lignes = [];
    lignes.push(["Date", "Nom", "Montant"].join(";"));

    for (const v of ventes) {
      lignes.push(
        [
          echapperCSV(v.dateHeure),
          echapperCSV(v.nom),
          String(Number(v.montant).toFixed(2)).replace(".", ",")
        ].join(";")
      );
    }

    const contenu = lignes.join("\n");
    const blob = new Blob([contenu], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  bouton.addEventListener("click", ajouterVente);
  inputNom.addEventListener("keydown", (e) => { if (e.key === "Enter") ajouterVente(); });
  inputMontant.addEventListener("keydown", (e) => { if (e.key === "Enter") ajouterVente(); });
  boutonUndo.addEventListener("click", annulerDerniereVente);
  boutonExport.addEventListener("click", exporterCSV);

  recalculerEtAfficher();
}

// ================== PAGE STATS ==================
function initStatsPage() {
  const statTotal = document.getElementById("statTotal");
  const statNb = document.getElementById("statNb");
  const statMoy = document.getElementById("statMoy");
  if (!statTotal || !statNb || !statMoy) return;

  const ventes = lireVentes();
  const nb = ventes.length;
  const total = ventes.reduce((acc, v) => acc + (Number(v.montant) || 0), 0);
  const moy = nb > 0 ? total / nb : 0;

  statTotal.textContent = total.toFixed(2);
  statNb.textContent = String(nb);
  statMoy.textContent = moy.toFixed(2);
}
async function apiRegister(username, password) {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Erreur lors de la création du compte");
  }
  return data;
}

function initRegisterPage() {
  const form = document.getElementById("registerForm");
  const btn = document.getElementById("registerBtn");
  const userInput = document.getElementById("regUsername");
  const passInput = document.getElementById("regPassword");
  const msgErr = document.getElementById("registerMsg");
  const msgOk = document.getElementById("registerOk");

  if (!form || !btn || !userInput || !passInput) return;

  function showError(text) {
    if (msgOk) msgOk.style.display = "none";
    if (msgErr) {
      msgErr.textContent = text;
      msgErr.style.display = "block";
    }
  }

  function showOk(text) {
    if (msgErr) msgErr.style.display = "none";
    if (msgOk) {
      msgOk.textContent = text;
      msgOk.style.display = "block";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // 🔥 IMPORTANT : empêche le rechargement

    const username = userInput.value.trim();
    const password = passInput.value;

    if (username.length < 3) return showError("Nom d’utilisateur trop court (min 3).");
    if (password.length < 6) return showError("Mot de passe trop court (min 6).");

    btn.disabled = true;

    try {
      await apiRegister(username, password);
      showOk("Compte créé ✅ Redirection vers la connexion...");

      setTimeout(() => {
        window.location.href = "/login.html";
      }, 900);
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
    }
  });
}


// ================== INIT GLOBAL ==================
(async () => {
  await protegerPages();
  await injecterDeconnexion();
  initLoginPage();
  initRegisterPage(); // ✅ AJOUTE ÇA
  initVentesPage();
  initStatsPage();
})();
