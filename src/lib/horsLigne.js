// Travail hors ligne : copie locale des données (IndexedDB) + file d'attente des saisies faites sans internet.
// - Lecture : chaque réponse GET est gardée sur l'appareil ; sans internet, on ressert la dernière copie.
// - Écriture : encaissements, appel et notes sont mis en attente puis envoyés automatiquement au retour d'internet.

const DB = "esjbm-hors-ligne", V = 1;
let dbP = null;
const ouvrir = () => (dbP ||= new Promise((res, rej) => {
  const r = indexedDB.open(DB, V);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains("cache")) d.createObjectStore("cache");
    if (!d.objectStoreNames.contains("file")) d.createObjectStore("file", { keyPath: "qid", autoIncrement: true });
    if (!d.objectStoreNames.contains("faits")) d.createObjectStore("faits", { keyPath: "qid" });
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const op = async (store, mode, fn) => {
  const d = await ouvrir();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    const r = fn(s); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error);
  });
};
const tout = (store) => op(store, "readonly", (s) => s.getAll());

// ── État partagé (bandeau) ──
const etat = { enLigne: typeof navigator === "undefined" ? true : navigator.onLine, attente: [], copieDu: null, sync: false };
const abonnes = new Set();
const publier = () => abonnes.forEach((f) => f({ ...etat }));
export const surEtat = (f) => { abonnes.add(f); f({ ...etat }); return () => abonnes.delete(f); };
export const etatHorsLigne = () => ({ ...etat });
const majFile = async () => { etat.attente = await tout("file").catch(() => []); publier(); };
export const marquerHorsLigne = (horsLigne) => { if (etat.enLigne === !horsLigne) return; etat.enLigne = !horsLigne; publier(); if (!horsLigne) synchroniser(); };

// ── Copie locale des lectures ──
export const garder = (url, data) => op("cache", "readwrite", (s) => s.put({ data, le: Date.now() }, url)).catch(() => {});
export const relire = async (url) => {
  const c = await op("cache", "readonly", (s) => s.get(url)).catch(() => null);
  if (c) { etat.copieDu = Math.max(etat.copieDu || 0, c.le); publier(); return ajuster(url, c.data); }
  // Liste des élèves : on retombe sur la liste complète gardée et on filtre ici.
  const u = new URL(url, "http://x");
  if (u.pathname === "/eleves") {
    const all = await op("cache", "readonly", (s) => s.get("@eleves-tout")).catch(() => null);
    if (all) {
      const p = u.searchParams, txt = (p.get("q") || "").toLowerCase();
      let rows = all.data.rows.filter((e) => (!p.get("classe_id") || String(e.classe_id) === p.get("classe_id")) && (!p.get("sexe") || e.sexe === p.get("sexe"))
        && (!txt || `${e.prenom} ${e.nom} ${e.matricule}`.toLowerCase().includes(txt)));
      const lim = Number(p.get("limit")) || 50, page = Number(p.get("page")) || 1;
      etat.copieDu = Math.max(etat.copieDu || 0, all.le); publier();
      return { ...all.data, rows: rows.slice((page - 1) * lim, page * lim), total: rows.length, page, limit: lim };
    }
  }
  // Appel : la liste de la classe d'un autre jour sert de base (sans les absences).
  if (u.pathname === "/appel" && u.searchParams.get("classe_id")) {
    const cles = await op("cache", "readonly", (s) => s.getAllKeys()).catch(() => []);
    const k = cles.filter((x) => typeof x === "string" && x.startsWith("/appel?") && new URL(x, "http://x").searchParams.get("classe_id") === u.searchParams.get("classe_id")).pop();
    if (k) {
      const c = await op("cache", "readonly", (s) => s.get(k));
      return { date: u.searchParams.get("date") || c.data.date, rows: c.data.rows.map((r) => ({ ...r, marques: null })) };
    }
  }
  // Sinon : la dernière version gardée de la même page (autre période, autre page de la liste…),
  // mais jamais celle d'une autre classe, d'un autre élève ou d'une autre année.
  const IDENT = ["classe_id", "eleve_id", "inscription_id", "evaluation_id", "annee_id", "type", "trimestre"];
  const cles = await op("cache", "readonly", (s) => s.getAllKeys()).catch(() => []);
  let best = null;
  for (const k of cles) {
    if (typeof k !== "string" || !k.startsWith(u.pathname)) continue;
    const v = new URL(k, "http://x");
    if (v.pathname !== u.pathname || IDENT.some((x) => (v.searchParams.get(x) || "") !== (u.searchParams.get(x) || ""))) continue;
    const c = await op("cache", "readonly", (s) => s.get(k)).catch(() => null);
    if (c && (!best || c.le > best.le)) best = c;
  }
  if (best) { etat.copieDu = Math.max(etat.copieDu || 0, best.le); publier(); return best.data; }
  return undefined;
};
// La situation d'un élève tient compte des encaissements en attente (pas de double encaissement hors ligne).
async function ajuster(url, data) {
  const m = url.match(/^\/inscriptions\/(\d+)\/situation$/);
  if (!m || !data?.lignes) return data;
  const att = (await tout("file").catch(() => [])).filter((x) => x.path === "/recus" && String(x.body.inscription_id) === m[1]);
  if (!att.length) return data;
  const lignes = data.lignes.map((l) => ({ ...l }));
  att.forEach((x) => x.body.lignes.forEach((p) => {
    const l = lignes.find((y) => y.type === p.type && (y.mois || "").slice(0, 7) === (p.mois || "").slice(0, 7));
    if (l) l.paye = Number(l.paye) + Number(p.montant);
  }));
  return { ...data, lignes };
}

// ── File d'attente des saisies ──
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const quand = (d) => `${d.getDate()} ${MOIS[d.getMonth()]} à ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
export const ACCEPTE = (method, path) =>
  (method === "POST" && ["/recus", "/depenses", "/recettes"].includes(path)) || (method === "PUT" && path === "/appel") || (method === "PUT" && /^\/evaluations\/\d+\/notes$/.test(path));
export async function mettreEnAttente(method, path, body, apercu) {
  const now = new Date();
  const item = { method, path, body: { ...body }, apercu: apercu || null, cree_le: now.toISOString(), statut: "attente" };
  if (path === "/recus") {
    item.body.cle_client = `hl-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  const qid = await op("file", "readwrite", (s) => s.add(item));
  if (path === "/recus") {
    const prov = `H-${String(qid).padStart(3, "0")}`;
    item.qid = qid; item.provisoire = prov;
    item.body.note = [item.body.note, `Saisi hors ligne le ${quand(now)} (reçu provisoire ${prov})`].filter(Boolean).join(" · ");
    await op("file", "readwrite", (s) => s.put(item));
  }
  await majFile();
  const montant = path === "/recus" ? item.body.lignes.reduce((t, l) => t + Number(l.montant || 0), 0) : undefined;
  return path === "/recus" ? { id: `h-${qid}`, numero: item.provisoire, montant, hors_ligne: true } : { ok: true, hors_ligne: true };
}
export const elementFile = async (qid) => (await op("file", "readonly", (s) => s.get(Number(qid))).catch(() => null)) || (await op("faits", "readonly", (s) => s.get(Number(qid))).catch(() => null));
export const retirer = async (qid) => { await op("file", "readwrite", (s) => s.delete(Number(qid))); await majFile(); };

// Envoi : dans l'ordre de saisie ; une saisie refusée par le serveur (déjà payé…) reste affichée pour décision.
let envoyer = null;
export const brancher = (fn) => { envoyer = fn; };
let enCours = false;
export async function synchroniser() {
  if (enCours || !envoyer || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  enCours = true; etat.sync = true; publier();
  let ok = 0;
  try {
    const items = (await tout("file")).sort((a, b) => a.qid - b.qid);
    for (const it of items) {
      if (it.statut === "refuse") continue;
      try {
        const r = await envoyer(it.method, it.path, it.body);
        await op("file", "readwrite", (s) => s.delete(it.qid));
        await op("faits", "readwrite", (s) => s.put({ ...it, statut: "envoye", resultat: r, envoye_le: new Date().toISOString() }));
        ok++;
      } catch (e) {
        if (!e.status) { marquerHorsLigne(true); break; }          // plus d'internet : on réessaiera
        if (e.status === 401) break;                              // session expirée : on garde tout
        await op("file", "readwrite", (s) => s.put({ ...it, statut: "refuse", erreur: e.message }));
      }
    }
  } finally {
    enCours = false; etat.sync = false; await majFile();
    if (ok) window.dispatchEvent(new CustomEvent("hors-ligne-envoye", { detail: ok }));
  }
}
export const reessayer = async (qid) => {
  const it = await op("file", "readonly", (s) => s.get(Number(qid)));
  if (it) await op("file", "readwrite", (s) => s.put({ ...it, statut: "attente", erreur: null }));
  await majFile(); synchroniser();
};
export const viderCopie = () => op("cache", "readwrite", (s) => s.clear()).catch(() => {});

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { etat.enLigne = true; publier(); synchroniser(); });
  window.addEventListener("offline", () => { etat.enLigne = false; publier(); });
  setInterval(() => { if (etat.attente.some((x) => x.statut !== "refuse")) synchroniser(); }, 30e3);
  majFile();
}
