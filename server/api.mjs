// ═══════════════════════════════════════════════════════════════════════════
//  Ecole-gestion — API v2
//  Hébergée sur Neon Functions. Aucune dépendance : SQL via l'endpoint HTTP.
// ═══════════════════════════════════════════════════════════════════════════
import crypto from "node:crypto";

// ── SQL ────────────────────────────────────────────────────────────────────
const CONN = process.env.DATABASE_URL;
const HOST = new URL(CONN).hostname;
const PARSE = {
  16: (v) => v === "t", 20: Number, 21: Number, 23: Number, 700: Number, 701: Number, 1700: Number,
  114: JSON.parse, 3802: JSON.parse,
};
const toParam = (p) => (p === undefined || p === null ? null : typeof p === "object" ? JSON.stringify(p) : String(p));
const mapRows = (b) => {
  const f = b.fields || [];
  return (b.rows || []).map((row) => {
    const o = {};
    for (const { name, dataTypeID } of f) {
      const v = row[name];
      o[name] = v == null ? null : PARSE[dataTypeID] ? PARSE[dataTypeID](v) : v;
    }
    return o;
  });
};
const post = async (body) => {
  const r = await fetch(`https://${HOST}/sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Neon-Connection-String": CONN, "Neon-Raw-Text-Output": "true" },
    body: JSON.stringify(body),
  });
  const b = await r.json();
  if (!r.ok) throw new HttpError(400, humanize(b.message || `Erreur base ${r.status}`));
  return b;
};
const q = async (query, params = []) => mapRows(await post({ query, params: params.map(toParam) }));
const one = async (query, params) => (await q(query, params))[0] || null;
const tx = async (list) => (await post({ queries: list.map(([query, params = []]) => ({ query, params: params.map(toParam) })) })).results.map(mapRows);

const humanize = (m) => {
  if (/duplicate key.*email/i.test(m)) return "Cet email est déjà utilisé.";
  if (/duplicate key.*matricule/i.test(m)) return "Ce matricule existe déjà.";
  if (/duplicate key.*eleve_id, annee_id/i.test(m) || /inscriptions_eleve_id_annee_id/i.test(m)) return "Cet élève est déjà inscrit pour cette année.";
  if (/duplicate key.*annee_id, nom/i.test(m)) return "Une classe porte déjà ce nom pour cette année.";
  if (/violates foreign key/i.test(m)) return "Impossible : cet élément est utilisé ailleurs.";
  if (/invalid input syntax for type date/i.test(m)) return "Date invalide.";
  return m;
};

// ── Erreurs & réponses ────────────────────────────────────────────────────
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS } });

// ── Sessions signées ──────────────────────────────────────────────────────
let SECRET;
const secret = async () => (SECRET ||= (await one("select value from public.app_secret where key='auth'")).value);
const b64 = (s) => Buffer.from(s).toString("base64url");
const hmac = (p, k) => crypto.createHmac("sha256", k).update(p).digest("base64url");
const makeToken = async (u) => {
  const p = b64(JSON.stringify({ id: u.id, role: u.role, exp: Date.now() + 12 * 3600e3 }));
  return `${p}.${hmac(p, await secret())}`;
};
const readToken = async (t) => {
  try {
    const [p, s] = (t || "").split(".");
    if (!p || !s) return null;
    const good = hmac(p, await secret());
    if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
};

// ── Droits ────────────────────────────────────────────────────────────────
const DROITS = {
  admin:      ["*"],
  direction:  ["eleves.lire", "eleves.ecrire", "eleves.supprimer", "classes.ecrire", "etablissement.ecrire", "annees.ecrire", "journal.lire",
               "finances.lire", "finances.encaisser", "finances.annuler", "depenses.lire", "depenses.ecrire",
               "pedagogie.lire", "pedagogie.ecrire", "enseignants.ecrire", "absences.ecrire"],
  comptable:  ["eleves.lire", "finances.lire", "finances.encaisser", "depenses.lire", "depenses.ecrire"],
  secretaire: ["eleves.lire", "eleves.ecrire", "pedagogie.lire", "absences.ecrire"],
  professeur: ["eleves.lire", "pedagogie.lire", "pedagogie.ecrire", "absences.ecrire"],
};
const CODES_DROITS = ["eleves.lire", "eleves.ecrire", "eleves.supprimer", "classes.ecrire", "pedagogie.lire", "pedagogie.ecrire", "absences.ecrire", "enseignants.ecrire",
  "finances.lire", "finances.encaisser", "finances.annuler", "depenses.lire", "depenses.ecrire", "etablissement.ecrire", "annees.ecrire", "journal.lire", "utilisateurs"];
const LIBELLES_ROLES = { admin: "Administrateur", direction: "Direction", comptable: "Comptable", secretaire: "Secrétariat", professeur: "Enseignant" };
// Rôles créés ou modifiés dans Paramètres (table app.roles), rechargés toutes les 30 s.
let ROLES_PERSO = {}, ROLES_AT = 0;
const chargerRoles = async (force) => {
  if (!force && Date.now() - ROLES_AT < 30e3) return;
  const rows = await q("select code, libelle, droits, classe_seule from app.roles");
  ROLES_PERSO = Object.fromEntries(rows.map((x) => [x.code, x]));
  ROLES_AT = Date.now();
};
const droitsRole = (role) => (role === "admin" ? ["*"] : ROLES_PERSO[role]?.droits || DROITS[role] || []);
const tousLesRoles = () => {
  const out = {};
  for (const code of Object.keys(DROITS)) out[code] = { code, libelle: ROLES_PERSO[code]?.libelle || LIBELLES_ROLES[code], droits: droitsRole(code), systeme: true, classe_seule: ROLES_PERSO[code]?.classe_seule ?? code === "professeur" };
  for (const [code, x] of Object.entries(ROLES_PERSO)) if (!out[code]) out[code] = { code, libelle: x.libelle, droits: x.droits, systeme: false, classe_seule: x.classe_seule };
  return out;
};
// Droits effectifs : ceux choisis pour la personne (s'ils existent), sinon ceux de son rôle. L'administrateur a toujours tout.
const droitsDe = (u) => {
  if (!u) return [];
  if (typeof u === "string") return droitsRole(u);
  if (u.role === "admin") return ["*"];
  return Array.isArray(u.droits) ? u.droits : droitsRole(u.role);
};
const peut = (u, droit) => droitsDe(u).some((d) => d === "*" || d === droit);
// Pour les comptes sans accès aux finances (secrétaire…) : on retire tous les montants des réponses.
const ARGENT_CLASSE = ["frais_inscription", "uniforme", "tenue_sport", "cours_soir", "mensualite", "mensualite_jan_fev", "mensualite_cantine", "mensualite_cantine_jan_fev", "frais_cantine", "prix_uniforme", "prix_tenue", "prix_cours_soir"];
const ARGENT_INSC = ["mensualite_speciale", "reduction_inscription", "frais_reste", "montant_uniforme", "montant_tenue", "montant_frais_cantine", "montant_cantine_mois", "montant_cours_soir"];
const sansArgent = (ctx, row) => {
  if (!row || peut(ctx.user, "finances.lire")) return row;
  const o = { ...row };
  if (typeof o.mensualite_cantine === "number") o.cantine_dispo = o.mensualite_cantine > 0;
  if (typeof o.cours_soir === "number") o.cours_soir_dispo = o.cours_soir > 0;
  if (typeof o.prix_cours_soir === "number") o.cours_soir_dispo = o.prix_cours_soir > 0;
  // Les cases cochées (uniforme, cantine, cours_soir de l'inscription) sont des booléens : on les garde.
  for (const k of ARGENT_CLASSE) if (typeof o[k] === "number") delete o[k];
  for (const k of ARGENT_INSC) delete o[k];
  return o;
};
// Enseignant limité à sa classe : classes dont il est titulaire (via la fiche enseignant liée à son compte).
const classesAutorisees = async (ctx) => {
  if (!ctx.user?.classe_seule || ctx.user.role === "admin") return null;
  if (ctx._classes) return ctx._classes;
  const rows = await q("select c.id from app.classes c join app.enseignants e on e.id=c.titulaire_id where e.utilisateur_id=$1", [ctx.user.id]);
  return (ctx._classes = rows.map((x) => x.id));
};
const verifierClasse = async (ctx, classeId) => {
  const ok = await classesAutorisees(ctx);
  if (ok && classeId != null && classeId !== "" && !ok.includes(Number(classeId))) fail(403, "Vous n'avez accès qu'à votre classe.");
};
const verifierEleve = async (ctx, eleveId) => {
  const ok = await classesAutorisees(ctx);
  if (!ok) return;
  const r = await one("select 1 as ok from app.inscriptions where eleve_id=$1 and classe_id = any($2::int[])", [eleveId, `{${ok.join(",")}}`]);
  if (!r) fail(403, "Vous n'avez accès qu'aux élèves de votre classe.");
};
// Espace enseignant : un compte limité à sa classe n'a accès qu'à ses élèves, ses notes, ses absences et son emploi du temps.
const ESPACE_PROF = new Set(["GET /auth/me", "POST /auth/password", "GET /bootstrap", "GET /annees", "GET /classes", "GET /dashboard",
  "GET /eleves", "GET /eleves/:id", "GET /classes/:id/matieres", "GET /evaluations", "POST /evaluations", "PUT /evaluations/:id", "DELETE /evaluations/:id",
  "GET /evaluations/:id/notes", "PUT /evaluations/:id/notes", "GET /bulletins", "PUT /appreciations", "GET /appel", "PUT /appel",
  "GET /absences", "PUT /absences/:id", "DELETE /absences/:id", "GET /emploi"]);
const espaceProf = (u) => !!u?.classe_seule && u.role !== "admin";
const exige = (ctx, droit) => { if (!peut(ctx.user, droit)) fail(403, "Vous n'avez pas les droits pour cette action."); };

const journal = async (ctx, action, entite, entite_id, details) => {
  await q("insert into app.journal (utilisateur_id, action, entite, entite_id, details) values ($1,$2,$3,$4,$5)",
    [ctx.user?.id, action, entite, entite_id, details || null]).catch(() => {});
  await gardien(ctx, action, entite, entite_id, details || {}).catch((e) => console.error("gardien", e));
};

// ── Le Gardien : prévient la direction des opérations sensibles (comme dans AngyOS) ──
const F = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} F`;
const MOIS_G = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisG = (m) => { if (!m) return ""; const [y, mo] = String(m).slice(0, 7).split("-"); return `${MOIS_G[Number(mo) - 1]} ${y}`; };
const voitGardien = (u) => !!u && (u.role === "admin" || u.role === "direction" || peut(u, "journal.lire"));
const alerter = (ctx, kind, niveau, titre, message, lien, cle) =>
  q("insert into app.alertes (kind, niveau, titre, message, lien, auteur_id, auteur, cle) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (cle) do nothing",
    [kind, niveau, titre.slice(0, 120), message.slice(0, 600), lien || null, ctx.user?.id || null, ctx.user ? `${ctx.user.prenom} ${ctx.user.nom}`.trim() : null, cle || null]);
const eleveDeRecu = (id) => one("select e.id, e.prenom, e.nom, c.nom as classe from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id where r.id=$1", [id]);
const eleveDeInsc = (id) => one("select e.id, e.prenom, e.nom, c.nom as classe from app.inscriptions i join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id where i.id=$1", [id]);
const nomEl = (e) => e ? `${e.prenom} ${e.nom} (${e.classe})` : "un élève";
async function gardien(ctx, action, entite, id, d) {
  const qui = ctx.user ? `${ctx.user.prenom} ${ctx.user.nom}`.trim() : "quelqu'un";
  const k = `${action}:${entite}`;
  if (k === "annulation:recu") {
    const e = await eleveDeRecu(id);
    return alerter(ctx, "recu_annule", "grave", "Reçu annulé", `Le reçu n° ${d.numero} de ${F(d.montant)} pour ${nomEl(e)} a été annulé par ${qui}. Motif : ${d.motif || "—"}.`, `/recus/${id}`);
  }
  if (k === "suppression:recu")
    return alerter(ctx, "recu_supprime", "grave", "Reçu supprimé", `Le reçu n° ${d.numero} de ${F(d.montant)} (${d.eleve}) a été supprimé par ${qui}. Détail : ${d.detail || "—"}.`, null);
  if (k === "modification:recu") {
    const e = await eleveDeRecu(id);
    if (d.ligne_retiree) return alerter(ctx, "recu_modifie", "attention", "Ligne retirée d'un reçu",
      `${qui} a retiré « ${d.ligne_retiree}${d.mois ? " " + moisG(d.mois) : ""} » (${F(d.montant)}) du reçu n° ${d.numero} de ${nomEl(e)}. Motif : ${d.motif || "—"}.`, `/recus/${id}`);
    const baisse = Number(d.apres) < Number(d.avant);
    return alerter(ctx, "recu_modifie", baisse ? "grave" : "attention", baisse ? "Reçu modifié à la baisse" : "Reçu modifié",
      `${qui} a modifié le reçu n° ${d.numero} de ${nomEl(e)} : ${F(d.avant)} → ${F(d.apres)}. Motif : ${d.motif || "—"}.`, `/recus/${id}`);
  }
  if (k === "encaissement:recu") {
    const r = await one(`select r.inscription_id, r.montant, r.date_paiement, (current_date - r.date_paiement) as retard,
        (select count(*) from app.recus x where x.inscription_id=r.inscription_id and x.id<>r.id and not x.annule and x.montant=r.montant and x.created_at > now() - interval '15 minutes') as doublons
      from app.recus r where r.id=$1`, [id]);
    if (!r) return;
    const e = await eleveDeRecu(id);
    if (Number(r.doublons) > 0) await alerter(ctx, "doublon", "attention", "Encaissement en double ?", `${qui} a enregistré deux fois ${F(r.montant)} pour ${nomEl(e)} en moins de 15 minutes (reçu n° ${d.numero}). Vérifiez qu'il ne s'agit pas d'une erreur.`, `/recus/${id}`);
    if (Number(r.retard) > 7) await alerter(ctx, "antidate", "attention", "Paiement antidaté", `Le reçu n° ${d.numero} de ${F(r.montant)} pour ${nomEl(e)} a été daté de ${r.retard} jours en arrière par ${qui}.`, `/recus/${id}`);
    return;
  }
  if (k === "suppression:depense" && d.montant != null)
    return alerter(ctx, "depense_supprimee", "attention", "Dépense supprimée", `${qui} a supprimé la dépense « ${d.libelle} » de ${F(d.montant)}.`, "/depenses");
  if (k === "modification:depense" && d.avant != null && Number(d.avant) !== Number(d.montant))
    return alerter(ctx, "depense_modifiee", "attention", "Dépense modifiée", `${qui} a modifié la dépense « ${d.libelle} » : ${F(d.avant)} → ${F(d.montant)}.`, "/depenses");
  if (k === "suppression:recette" && d.montant != null)
    return alerter(ctx, "recette_supprimee", "grave", "Recette supprimée", `${qui} a supprimé la recette « ${d.libelle} » de ${F(d.montant)}.`, "/recettes");
  if (k === "modification:recette" && d.avant != null && Number(d.montant) < Number(d.avant))
    return alerter(ctx, "recette_modifiee", "grave", "Recette modifiée à la baisse", `${qui} a modifié la recette « ${d.libelle} » : ${F(d.avant)} → ${F(d.montant)}.`, "/recettes");
  if (k === "suppression:eleve" || k === "sortie:eleve")
    return alerter(ctx, "eleve_retire", "attention", k === "sortie:eleve" ? "Élève sorti de l'école" : "Élève supprimé",
      `${qui} a ${k === "sortie:eleve" ? "marqué comme sorti" : "supprimé"} ${d.nom || "un élève"}.`, k === "sortie:eleve" ? `/eleves/${id}` : null);
  if ((action === "mois_retire") && entite === "inscription") {
    const e = await eleveDeInsc(id);
    return alerter(ctx, "mois_retire", "attention", "Mois retiré de la scolarité", `${qui} a retiré ${moisG(d.mois)} de la scolarité de ${nomEl(e)} (plus rien à payer pour ce mois). Motif : ${d.motif || "—"}.`, e ? `/eleves/${e.id}` : null);
  }
  if (k === "modification:inscription") {
    if (!d.faveurs) return;
    d = d.faveurs;
    const faveurs = [];
    if (d.gratuit === true) faveurs.push("scolarité gratuite");
    if (d.inscription_offerte === true) faveurs.push("inscription offerte");
    if (Number(d.reduction_inscription) > 0) faveurs.push(`réduction de ${F(d.reduction_inscription)} sur l'inscription`);
    if (Number(d.mensualite_speciale) > 0) faveurs.push(`mensualité spéciale de ${F(d.mensualite_speciale)}`);
    if (!faveurs.length) return;
    const e = await eleveDeInsc(id);
    return alerter(ctx, "faveur", "attention", "Réduction accordée", `${qui} a accordé à ${nomEl(e)} : ${faveurs.join(", ")}.`, e ? `/eleves/${e.id}` : null);
  }
  if (k === "creation:mouvement_stock" && (d.sens === "sortie" || (d.sens === "ajustement" && Number(d.quantite) < 0)))
    return alerter(ctx, "retrait_stock", "attention", "Stock retiré à la main", `${qui} a retiré ${Math.abs(d.quantite)} × ${d.article} du stock (${d.sens === "sortie" ? "sortie" : "ajustement"}).`, "/fournitures");
  if (k === "suppression:mouvement_stock")
    return alerter(ctx, "retrait_stock", "attention", "Mouvement de stock supprimé", `${qui} a supprimé un mouvement de stock (${d.sens}, ${d.quantite}).`, "/fournitures");
  if (k === "suppression:evaluation")
    return alerter(ctx, "notes_supprimees", "attention", "Évaluation supprimée", `${qui} a supprimé une évaluation${d.libelle ? ` « ${d.libelle} »` : ""} et toutes ses notes.`, "/notes");
  if (entite === "utilisateur" && (action === "creation" || action === "modification"))
    return alerter(ctx, "acces", "info", action === "creation" ? "Nouveau compte créé" : "Compte modifié", `${qui} a ${action === "creation" ? "créé le compte" : "modifié le compte"} ${d.email || ""}${d.role ? ` (rôle : ${d.role})` : ""}${d.droits ? " — accès changés" : ""}${d.mot_de_passe ? " — mot de passe réinitialisé" : ""}${d.actif === false ? " — compte désactivé" : ""}.`, "/parametres/utilisateurs");
  if (entite === "role" && action !== "creation")
    return alerter(ctx, "acces", "info", "Rôle modifié", `${qui} a ${action === "suppression" ? "supprimé" : "modifié"} le rôle « ${d.code} ».`, "/parametres/roles");
}

// Bilan de la journée : envoyé à partir de 18 h (heure de Dakar) à la première consultation ;
// si personne n'a ouvert le logiciel le soir, il arrive le lendemain matin (bilan de la veille).
async function bilanJour(decalage) {
  const r = await one(`select (current_date - $1::int)::text as jour,
      (select coalesce(sum(montant),0) from app.recus where not annule and created_at::date = current_date - $1::int) as encaisse,
      (select count(*) from app.recus where not annule and created_at::date = current_date - $1::int) as nb,
      (select coalesce(sum(montant),0) from app.depenses where created_at::date = current_date - $1::int) as depenses,
      (select count(*) from app.inscriptions where created_at::date = current_date - $1::int) as inscriptions,
      (select count(*) from app.absences where date_absence = current_date - $1::int) as absences,
      (select count(*) from app.alertes where kind<>'resume' and created_at::date = current_date - $1::int) as alertes,
      exists (select 1 from app.alertes where cle = 'resume-' || (current_date - $1::int)::text) as deja`, [decalage]).catch(() => null);
  if (!r || r.deja || (Number(r.nb) === 0 && Number(r.depenses) === 0 && Number(r.alertes) === 0)) return;
  const [, m, j] = r.jour.split("-");
  const msg = `Encaissé : ${F(r.encaisse)} (${r.nb} reçu${r.nb > 1 ? "s" : ""}) · Dépenses : ${F(r.depenses)} · Reste en caisse du jour : ${F(r.encaisse - r.depenses)} · Nouvelles inscriptions : ${r.inscriptions}` +
    (Number(r.absences) ? ` · Absences : ${r.absences}` : "") +
    (Number(r.alertes) ? ` · ${r.alertes} alerte${r.alertes > 1 ? "s" : ""} du Gardien.` : " · Aucune opération suspecte.");
  await alerter({}, "resume", "info", `${decalage ? "Bilan du" : "Bilan de la journée —"} ${Number(j)} ${MOIS_G[Number(m) - 1]}`, msg, "/rapports", `resume-${r.jour}`);
}
async function bilanVeille() {
  if (new Date().getUTCHours() >= 18) await bilanJour(0);
  await bilanJour(1);
}

// ── Validation ────────────────────────────────────────────────────────────
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && k in obj).map((k) => [k, obj[k] === "" ? null : obj[k]]));
const COLS_ELEVE = ["nom","prenom","sexe","date_naissance","lieu_naissance","adresse","pere_nom","pere_prenom","pere_profession","pere_telephone","mere_nom","mere_prenom","mere_profession","mere_telephone","tuteur_nom","tuteur_telephone","observations","statut"];
const COLS_CLASSE = ["nom","cycle","ordre","capacite","titulaire_id","bareme","frais_inscription","uniforme","tenue_sport","cours_soir","mensualite","mensualite_jan_fev","mensualite_cantine","mensualite_cantine_jan_fev","frais_cantine"];
const COLS_INSC = ["classe_id","cantine","cours_soir","uniforme","tenue_sport","reduction_inscription","statut","mensualite_speciale","gratuit","inscription_offerte","date_inscription","type","cantine_debut","cantine_fin","cours_soir_debut","cours_soir_fin"];
const COLS_ETAB = ["nom","slogan","adresse","telephones","email","site_web","ninea","bp","autorisation","logo","directeur","ville","fiche_infos","textes"];
const insertSql = (table, data) => {
  const k = Object.keys(data);
  return [`insert into ${table} (${k.join(",")}) values (${k.map((_, i) => `$${i + 1}`).join(",")}) returning *`, k.map((c) => data[c])];
};
const updateSql = (table, id, data, extra = "") => {
  const k = Object.keys(data);
  if (!k.length) fail(400, "Rien à modifier.");
  return [`update ${table} set ${k.map((c, i) => `${c}=$${i + 1}`).join(",")}${extra} where id=$${k.length + 1} returning *`, [...k.map((c) => data[c]), id]];
};
const requis = (obj, champs) => {
  for (const [k, label] of champs) if (obj?.[k] == null || String(obj[k]).trim() === "") fail(400, `${label} est obligatoire.`);
};
const USER_COLS = "id, nom, prenom, email, role, actif, dernier_login, created_at, droits, classe_seule";
const anneeCourante = async (id) => id ? Number(id) : (await one("select id from app.annees where active"))?.id;

// ═══════════════════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════════════════
const routes = [];
const route = (method, pattern, handler, { public: pub = false } = {}) => {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$");
  routes.push({ method, re, keys, handler, pub, pattern });
};

// ── Authentification ──────────────────────────────────────────────────────
const MAX_ECHECS = 5, BLOCAGE_MIN = 15;
route("POST", "/auth/login", async ({ body }) => {
  const email = String(body.email || "").trim().toLowerCase();
  const { n } = await one(`select count(*) as n from app.echecs_connexion where lower(email)=$1 and created_at > now() - interval '${BLOCAGE_MIN} minutes'`, [email]);
  if (n >= MAX_ECHECS) fail(429, `Trop de tentatives échouées pour ce compte. Réessayez dans ${BLOCAGE_MIN} minutes.`);
  const u = await one(
    `update app.utilisateurs set dernier_login = now()
     where lower(email)=lower($1) and actif and mot_de_passe = crypt($2, mot_de_passe)
     returning ${USER_COLS}`, [body.email?.trim() || "", body.mot_de_passe || ""]);
  if (!u) {
    await q("insert into app.echecs_connexion (email) values ($1)", [email]);
    const reste = MAX_ECHECS - n - 1;
    fail(401, reste > 0 ? `Email ou mot de passe incorrect. ${reste} essai${reste > 1 ? "s" : ""} restant${reste > 1 ? "s" : ""} avant blocage.` : `Email ou mot de passe incorrect. Compte bloqué ${BLOCAGE_MIN} minutes.`);
  }
  await q("delete from app.echecs_connexion where lower(email)=$1 or created_at < now() - interval '1 day'", [email]);
  await journal({ user: u }, "connexion", "utilisateur", u.id);
  return { user: u, token: await makeToken(u) };
}, { public: true });

route("GET", "/auth/me", async (ctx) => ({ user: ctx.user }));

route("POST", "/auth/password", async (ctx) => {
  const { ancien, nouveau } = ctx.body;
  if (!nouveau || nouveau.length < 8) fail(400, "Le nouveau mot de passe doit faire au moins 8 caractères.");
  const r = await one(`update app.utilisateurs set mot_de_passe = crypt($1, gen_salt('bf'))
    where id=$2 and mot_de_passe = crypt($3, mot_de_passe) returning id`, [nouveau, ctx.user.id, ancien || ""]);
  if (!r) fail(400, "L'ancien mot de passe est incorrect.");
  await journal(ctx, "changement_mot_de_passe", "utilisateur", ctx.user.id);
  return { ok: true };
});

// ── Démarrage de l'app : tout le référentiel en un appel ──────────────────
route("GET", "/bootstrap", async (ctx) => {
  const [[etab], annees, types] = await tx([
    ["select * from app.etablissement where id=1"],
    ["select * from app.annees order by debut desc"],
    ["select * from app.types_paiement where actif order by libelle"],
  ]);
  const argent = peut(ctx.user, "finances.lire");
  const sansFrais = (a) => argent ? a : Object.fromEntries(Object.entries(a).filter(([k]) => !k.startsWith("frais_")));
  return { user: ctx.user, etablissement: etab, annees: annees.map(sansFrais), types_paiement: argent ? types : [], droits: droitsDe(ctx.user), gardien: voitGardien(ctx.user), classes_autorisees: await classesAutorisees(ctx),
    roles: Object.fromEntries(Object.values(tousLesRoles()).map((x) => [x.code, x.libelle])) };
});

// ── Établissement ─────────────────────────────────────────────────────────
route("PUT", "/etablissement", async (ctx) => {
  exige(ctx, "etablissement.ecrire");
  const d = pick(ctx.body, COLS_ETAB);
  if ("nom" in d) requis(d, [["nom", "Le nom de l'école"]]);
  const r = await one(...updateSql("app.etablissement", 1, d, ", updated_at=now()"));
  await journal(ctx, "modification", "etablissement", 1);
  return r;
});

// ── Années scolaires ──────────────────────────────────────────────────────
route("GET", "/annees", async (ctx) => (await q(
  `select a.*, (select count(*) from app.inscriptions i where i.annee_id=a.id and i.statut='active') as effectif
   from app.annees a order by debut desc`)).map((a) => peut(ctx.user, "finances.lire") ? a : Object.fromEntries(Object.entries(a).filter(([k]) => !k.startsWith("frais_")))));

route("POST", "/annees", async (ctx) => {
  exige(ctx, "annees.ecrire");
  const { libelle, debut, fin, copier_de } = ctx.body;
  requis(ctx.body, [["libelle", "Le libellé"], ["debut", "La date de début"], ["fin", "La date de fin"]]);
  const a = await one("insert into app.annees (libelle, debut, fin) values ($1,$2,$3) returning *", [libelle, debut, fin]);
  if (copier_de) await tx([
    [`insert into app.classes (annee_id, ${COLS_CLASSE.join(",")})
     select $1, ${COLS_CLASSE.join(",")} from app.classes where annee_id=$2`, [a.id, copier_de]],
    [`insert into app.matieres (classe_id, nom, coefficient, bareme, ordre, enseignant_id)
     select cn.id, m.nom, m.coefficient, m.bareme, m.ordre, m.enseignant_id
     from app.matieres m join app.classes co on co.id=m.classe_id and co.annee_id=$2
     join app.classes cn on cn.annee_id=$1 and cn.nom=co.nom`, [a.id, copier_de]],
  ]);
  await journal(ctx, "creation", "annee", a.id, { libelle });
  return a;
});

route("PUT", "/annees/:id", async (ctx) => {
  exige(ctx, "annees.ecrire");
  return one(...updateSql("app.annees", ctx.params.id, pick(ctx.body, ["libelle", "debut", "fin", "frais_cours_soir", "frais_cantine_jour", "frais_cotisation", "frais_fournitures", "frais_cours_vacances"])));
});

route("POST", "/annees/:id/activer", async (ctx) => {
  exige(ctx, "annees.ecrire");
  await tx([
    ["update app.annees set active=false where active"],
    ["update app.annees set active=true where id=$1", [ctx.params.id]],
  ]);
  await journal(ctx, "activation", "annee", Number(ctx.params.id));
  return { ok: true };
});

// ── Classes & tarifs ──────────────────────────────────────────────────────
route("GET", "/classes", async (ctx) => {
  const annee = await anneeCourante(ctx.query.annee_id);
  return q(`select c.*, t.prenom || ' ' || t.nom as titulaire,
      (select count(*) from app.matieres m where m.classe_id=c.id) as nb_matieres,
      (select count(*) from app.inscriptions i where i.classe_id=c.id and i.statut='active') as effectif,
      (select count(*) filter (where e.sexe='F') from app.inscriptions i join app.eleves e on e.id=i.eleve_id where i.classe_id=c.id and i.statut='active') as filles
    from app.classes c left join app.enseignants t on t.id=c.titulaire_id where c.annee_id=$1 order by c.ordre, c.nom`, [annee]).then(async (rows) => { const ok = await classesAutorisees(ctx); return rows.filter((x) => !ok || ok.includes(x.id)).map((x) => sansArgent(ctx, x)); });
});

route("POST", "/classes", async (ctx) => {
  exige(ctx, "classes.ecrire");
  const d = pick(ctx.body, COLS_CLASSE);
  requis(d, [["nom", "Le nom de la classe"]]);
  d.annee_id = await anneeCourante(ctx.body.annee_id);
  const r = await one(...insertSql("app.classes", d));
  await journal(ctx, "creation", "classe", r.id, { nom: r.nom });
  return r;
});

route("PUT", "/classes/:id", async (ctx) => {
  exige(ctx, "classes.ecrire");
  const r = await one(...updateSql("app.classes", ctx.params.id, pick(ctx.body, COLS_CLASSE)));
  await journal(ctx, "modification", "classe", r.id, { nom: r.nom });
  return r;
});

route("DELETE", "/classes/:id", async (ctx) => {
  exige(ctx, "classes.ecrire");
  const n = await one("select count(*) as n from app.inscriptions where classe_id=$1", [ctx.params.id]);
  if (n.n > 0) fail(400, `Impossible : ${n.n} élève(s) sont inscrits dans cette classe.`);
  await q("delete from app.classes where id=$1", [ctx.params.id]);
  await journal(ctx, "suppression", "classe", Number(ctx.params.id));
  return { ok: true };
});

// ── Tableau de bord ───────────────────────────────────────────────────────
route("GET", "/dashboard", async (ctx) => {
  const annee = await anneeCourante(ctx.query.annee_id);
  const voitFinances = peut(ctx.user, "finances.lire");
  const okCl = await classesAutorisees(ctx);
  const filtre = okCl ? ` and i.classe_id = any('{${okCl.join(",") || 0}}'::int[])` : "";
  const filtreC = okCl ? ` and c.id = any('{${okCl.join(",") || 0}}'::int[])` : "";
  const [[eff], classes, recentes, [fin], paiements, evolution] = await tx([
    [`select count(*) as total,
        count(*) filter (where e.sexe='F') as filles,
        count(*) filter (where e.sexe='M') as garcons,
        count(*) filter (where i.type='nouvelle') as nouveaux,
        count(*) filter (where i.type='reinscription') as reinscrits,
        count(*) filter (where i.cantine) as cantine
      from app.inscriptions i join app.eleves e on e.id=i.eleve_id
      where i.annee_id=$1 and i.statut='active'${filtre}`, [annee]],
    [`select c.id, c.nom, c.cycle, c.capacite, count(i.id) as effectif
      from app.classes c left join app.inscriptions i on i.classe_id=c.id and i.statut='active'
      where c.annee_id=$1${filtreC} group by c.id order by c.ordre`, [annee]],
    [`select e.id, e.matricule, e.nom, e.prenom, e.sexe, c.nom as classe, c.cycle, i.date_inscription, i.type
      from app.inscriptions i join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id
      where i.annee_id=$1${filtre} order by i.created_at desc limit 6`, [annee]],
    [`select coalesce(sum(r.montant) filter (where r.date_paiement=current_date),0) as jour,
        coalesce(sum(r.montant) filter (where date_trunc('month',r.date_paiement)=date_trunc('month',current_date)),0) as mois,
        coalesce(sum(r.montant),0) as annee,
        count(*) filter (where r.date_paiement=current_date) as nb_jour,
        (select coalesce(sum(d.montant),0) from app.depenses d where date_trunc('month',d.date_depense)=date_trunc('month',current_date)) as depenses_mois
      from app.recus r join app.inscriptions i on i.id=r.inscription_id
      where i.annee_id=$1 and not r.annule`, [annee]],
    [`select r.id, r.numero, r.montant, r.mode, r.date_paiement, e.id as eleve_id, e.nom, e.prenom,
        (select string_agg(distinct p.type, ',') from app.paiements p where p.recu_id=r.id) as types
      from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id
      where i.annee_id=$1 and not r.annule order by r.created_at desc limit 6`, [annee]],
    [`select to_char(d, 'YYYY-MM') as mois, coalesce(sum(r.montant),0) as montant
      from generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') d
      left join app.recus r on date_trunc('month', r.date_paiement)=d and not r.annule
      group by d order by d`],
  ]);
  let impayes = null;
  if (voitFinances) {
    const r = await one(`select coalesce(sum(reste),0) as total, count(*) filter (where reste > 0) as eleves from (${SQL_IMPAYES}) x`, [annee, new Date().toISOString().slice(0, 10)]);
    impayes = r;
  }
  return {
    effectif: eff, classes, recentes,
    finances: voitFinances ? { ...fin, paiements, evolution, impayes } : null,
  };
});

// ── Élèves ────────────────────────────────────────────────────────────────
const SORTS = { nom: "e.nom, e.prenom", matricule: "e.matricule", classe: "c.ordre, e.nom", recent: "e.created_at desc" };

route("GET", "/eleves", async (ctx) => {
  exige(ctx, "eleves.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  const { q: recherche, classe_id, sexe, statut = "actif", sort = "nom", inscrits = "oui" } = ctx.query;
  const limit = Math.min(Number(ctx.query.limit) || 50, 500);
  const page = Math.max(Number(ctx.query.page) || 1, 1);
  const where = ["1=1"]; const p = [annee];
  if (statut !== "tous") { p.push(statut); where.push(`e.statut=$${p.length}`); }
  if (inscrits === "oui") where.push("i.id is not null");
  if (inscrits === "non") where.push("i.id is null");
  if (classe_id) { p.push(classe_id); where.push(`i.classe_id=$${p.length}`); }
  const okCl = await classesAutorisees(ctx);
  if (okCl) { p.push(`{${okCl.join(",") || 0}}`); where.push(`i.classe_id = any($${p.length}::int[])`); }
  if (sexe) { p.push(sexe); where.push(`e.sexe=$${p.length}`); }
  if (recherche) {
    p.push(`%${recherche.trim().toLowerCase()}%`);
    where.push(`(lower(e.nom || ' ' || e.prenom) like $${p.length} or lower(e.prenom || ' ' || e.nom) like $${p.length}
      or lower(e.matricule) like $${p.length} or coalesce(e.pere_telephone,'') || coalesce(e.mere_telephone,'') || coalesce(e.tuteur_telephone,'') like $${p.length})`);
  }
  const base = `from app.eleves e
    left join app.inscriptions i on i.eleve_id=e.id and i.annee_id=$1
    left join app.classes c on c.id=i.classe_id
    where ${where.join(" and ")}`;
  const [rows, [{ total }]] = await tx([
    [`select e.id, e.matricule, e.nom, e.prenom, e.sexe, e.date_naissance, e.statut,
        coalesce(e.mere_telephone, e.pere_telephone, e.tuteur_telephone) as telephone,
        nullif(trim(coalesce(e.pere_prenom,'') || ' ' || coalesce(e.pere_nom,'')), '') as pere, e.pere_telephone,
        nullif(trim(coalesce(e.mere_prenom,'') || ' ' || coalesce(e.mere_nom,'')), '') as mere, e.mere_telephone, e.tuteur_nom, e.tuteur_telephone, e.lieu_naissance, e.adresse,
        i.date_inscription, 
        i.id as inscription_id, i.cantine, i.cours_soir, i.type as type_inscription, i.statut as statut_inscription, i.gratuit, i.mensualite_speciale, i.inscription_offerte, i.reduction_inscription, i.uniforme as a_uniforme, i.tenue_sport as a_tenue,
        case when i.id is null then null else (case when i.inscription_offerte then 0 else greatest(c.frais_inscription - i.reduction_inscription, 0) end + case when i.uniforme then c.uniforme else 0 end + case when i.tenue_sport then c.tenue_sport else 0 end + case when i.cantine then c.frais_cantine else 0 end)
          - coalesce((select sum(pa.montant) from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule where pa.inscription_id=i.id and pa.type in ('inscription','uniforme','tenue_sport','cantine')),0) end as frais_reste,
        c.id as classe_id, c.nom as classe, c.cycle
      ${base} order by ${SORTS[sort] || SORTS.nom} limit ${limit} offset ${(page - 1) * limit}`, p],
    [`select count(*) as total ${base}`, p],
  ]);
  return { rows: rows.map((x) => sansArgent(ctx, x)), total, page, limit };
});

route("GET", "/eleves/:id", async (ctx) => {
  await verifierEleve(ctx, ctx.params.id);
  exige(ctx, "eleves.lire");
  const id = ctx.params.id;
  const [[eleve], inscriptions, paiements] = await tx([
    ["select * from app.eleves where id=$1", [id]],
    [`select i.*, a.libelle as annee, a.active as annee_active, a.debut::text as annee_debut, c.nom as classe, c.cycle,
        c.frais_inscription, c.uniforme as prix_uniforme, c.tenue_sport as prix_tenue, c.mensualite, c.mensualite_jan_fev, c.mensualite_cantine, c.mensualite_cantine_jan_fev, c.frais_cantine, c.cours_soir as prix_cours_soir
      from app.inscriptions i join app.annees a on a.id=i.annee_id join app.classes c on c.id=i.classe_id
      where i.eleve_id=$1 order by a.debut desc`, [id]],
    peut(ctx.user, "finances.lire")
      ? [`select r.*, a.libelle as annee, i.annee_id, u.prenom || ' ' || u.nom as encaisse_par_nom,
            (select json_agg(json_build_object('type', p.type, 'mois', to_char(p.mois,'YYYY-MM'), 'montant', p.montant, 'libelle', p.libelle) order by p.mois nulls first, p.id) from app.paiements p where p.recu_id=r.id) as lignes
          from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.annees a on a.id=i.annee_id
          left join app.utilisateurs u on u.id=r.encaisse_par
          where i.eleve_id=$1 order by r.date_paiement desc, r.id desc`, [id]]
      : ["select null where false"],
  ]);
  if (!eleve) fail(404, "Élève introuvable.");
  const absences = peut(ctx.user, "pedagogie.lire") ? await q(`select a.id, a.date_absence, a.moment, a.type, a.justifiee, a.motif, i.annee_id
    from app.absences a join app.inscriptions i on i.id=a.inscription_id where i.eleve_id=$1 order by a.date_absence desc limit 100`, [id]) : [];
  return { eleve, inscriptions: inscriptions.map((i) => sansArgent(ctx, i)), paiements, absences };
});

const prochainMatricule = async (anneeId) => {
  const a = await one("select extract(year from debut)::int as an from app.annees where id=$1", [anneeId]);
  const r = await one(
    `select coalesce(max(nullif(split_part(matricule,'-',2),'')::int),0)+1 as n from app.eleves
     where matricule like $1 and split_part(matricule,'-',2) ~ '^[0-9]+$'`, [`${a.an}-%`]);
  return `${a.an}-${String(r.n).padStart(3, "0")}`;
};

route("GET", "/eleves-matricule", async (ctx) => ({ matricule: await prochainMatricule(await anneeCourante(ctx.query.annee_id)) }));

// Sans accès aux finances, on ne peut pas toucher à la formule ni aux réductions.
const FORMULE = ["mensualite_speciale", "gratuit", "inscription_offerte", "reduction_inscription"];
const sansFormule = (ctx, ins) => {
  if (!ins || peut(ctx.user, "finances.lire")) return ins;
  const o = { ...ins }; for (const k of FORMULE) delete o[k]; return o;
};
route("POST", "/eleves", async (ctx) => {
  exige(ctx, "eleves.ecrire");
  const e = pick(ctx.body.eleve, COLS_ELEVE);
  const ins = sansFormule(ctx, ctx.body.inscription);
  requis(e, [["nom", "Le nom"], ["prenom", "Le prénom"], ["sexe", "Le sexe"]]);
  requis(ins, [["classe_id", "La classe"]]);
  const annee = await anneeCourante(ins.annee_id);
  e.matricule = ctx.body.eleve.matricule?.trim() || await prochainMatricule(annee);
  e.nom = e.nom.trim().toUpperCase();
  e.prenom = e.prenom.trim();
  const k = Object.keys(e);
  const r = await one(
    `with e as (insert into app.eleves (${k.join(",")}) values (${k.map((_, i) => `$${i + 1}`).join(",")}) returning *),
     i as (insert into app.inscriptions (eleve_id, annee_id, classe_id, type, cantine, date_inscription, mensualite_speciale, gratuit, inscription_offerte, uniforme, tenue_sport, reduction_inscription, cours_soir)
           select e.id, $${k.length + 1}, $${k.length + 2}, $${k.length + 3}, $${k.length + 4}, coalesce($${k.length + 5}::date, current_date), $${k.length + 6}::int, $${k.length + 7}::boolean, $${k.length + 8}::boolean, $${k.length + 9}::boolean, $${k.length + 10}::boolean, $${k.length + 11}::int, $${k.length + 12}::boolean from e returning id)
     select e.id, e.matricule, e.nom, e.prenom, (select id from i) as inscription_id from e`,
    [...k.map((c) => e[c]), annee, ins.classe_id, ins.type || "nouvelle", !!ins.cantine, ins.date_inscription || null, ins.gratuit ? null : (Number(ins.mensualite_speciale) || null), !!ins.gratuit, !!ins.inscription_offerte, !!ins.uniforme, !!ins.tenue_sport, ins.inscription_offerte ? 0 : Math.max(0, Number(ins.reduction_inscription) || 0), !!ins.cours_soir]);
  await journal(ctx, "inscription", "eleve", r.id, { matricule: r.matricule, nom: `${r.prenom} ${r.nom}` });
  return r;
});

route("PUT", "/eleves/:id", async (ctx) => {
  exige(ctx, "eleves.ecrire");
  await verifierEleve(ctx, ctx.params.id);
  const d = pick(ctx.body, COLS_ELEVE);
  if (d.nom) d.nom = d.nom.trim().toUpperCase();
  const r = await one(...updateSql("app.eleves", ctx.params.id, d, ", updated_at=now()"));
  if (!r) fail(404, "Élève introuvable.");
  await journal(ctx, "modification", "eleve", r.id, { champs: Object.keys(d) });
  return r;
});

route("DELETE", "/eleves/:id", async (ctx) => {
  exige(ctx, "eleves.supprimer");
  const el = await one("select prenom, nom from app.eleves where id=$1", [ctx.params.id]);
  const nomE = el ? `${el.prenom} ${el.nom}` : null;
  const n = await one(`select count(*) as n from app.recus r join app.inscriptions i on i.id=r.inscription_id where i.eleve_id=$1`, [ctx.params.id]);
  if (n.n > 0) {
    await tx([
      ["update app.eleves set statut='sorti', updated_at=now() where id=$1", [ctx.params.id]],
      // L'élève sorti ne compte plus dans les effectifs, les impayés ni les factures de l'année en cours.
      ["update app.inscriptions set statut='abandon' where eleve_id=$1 and statut='active' and annee_id=(select id from app.annees where active)", [ctx.params.id]],
    ]);
    await journal(ctx, "sortie", "eleve", Number(ctx.params.id), { nom: nomE });
    return { ok: true, archive: true };
  }
  await q("delete from app.eleves where id=$1", [ctx.params.id]);
  await journal(ctx, "suppression", "eleve", Number(ctx.params.id), { nom: nomE });
  return { ok: true, archive: false };
});

// ── Inscriptions / réinscriptions ─────────────────────────────────────────
route("POST", "/eleves/:id/inscriptions", async (ctx) => {
  exige(ctx, "eleves.ecrire");
  requis(ctx.body, [["classe_id", "La classe"]]);
  ctx.body = sansFormule(ctx, ctx.body);
  const annee = await anneeCourante(ctx.body.annee_id);
  const r = await one(
    `insert into app.inscriptions (eleve_id, annee_id, classe_id, type, cantine, date_inscription, mensualite_speciale, gratuit, inscription_offerte, uniforme, tenue_sport, reduction_inscription, cours_soir)
     values ($1,$2,$3,$4,$5,coalesce($6::date,current_date),$7::int,$8::boolean,$9::boolean,$10::boolean,$11::boolean,$12::int,$13::boolean) returning *`,
    [ctx.params.id, annee, ctx.body.classe_id, ctx.body.type || "reinscription", !!ctx.body.cantine, ctx.body.date_inscription || null,
     ctx.body.gratuit ? null : (Number(ctx.body.mensualite_speciale) || null), !!ctx.body.gratuit, !!ctx.body.inscription_offerte, !!ctx.body.uniforme, !!ctx.body.tenue_sport, ctx.body.inscription_offerte ? 0 : Math.max(0, Number(ctx.body.reduction_inscription) || 0), !!ctx.body.cours_soir]);
  await q("update app.eleves set statut='actif' where id=$1", [ctx.params.id]);
  await journal(ctx, "reinscription", "eleve", Number(ctx.params.id), { annee_id: annee });
  return r;
});

route("PUT", "/inscriptions/:id", async (ctx) => {
  exige(ctx, "eleves.ecrire");
  if (ctx.body.classe_id) {
    const ok = await one("select 1 as ok from app.classes c join app.inscriptions i on i.annee_id=c.annee_id where c.id=$1 and i.id=$2", [ctx.body.classe_id, ctx.params.id]);
    if (!ok) fail(400, "Cette classe n'appartient pas à la même année scolaire.");
  }
  const av = await one("select gratuit, inscription_offerte, reduction_inscription, mensualite_speciale from app.inscriptions where id=$1", [ctx.params.id]);
  const r = await one(...updateSql("app.inscriptions", ctx.params.id, pick(sansFormule(ctx, ctx.body), COLS_INSC)));
  // Pour le Gardien : seulement les avantages qui viennent d'être accordés
  const nouv = {};
  if (r.gratuit && !av?.gratuit) nouv.gratuit = true;
  if (r.inscription_offerte && !av?.inscription_offerte) nouv.inscription_offerte = true;
  if (Number(r.reduction_inscription) > Number(av?.reduction_inscription || 0)) nouv.reduction_inscription = r.reduction_inscription;
  if (r.mensualite_speciale && Number(r.mensualite_speciale) !== Number(av?.mensualite_speciale || 0)) nouv.mensualite_speciale = r.mensualite_speciale;
  await journal(ctx, "modification", "inscription", r.id, { ...pick(ctx.body, COLS_INSC), faveurs: nouv });
  return r;
});


// ═══ FINANCES ══════════════════════════════════════════════════════════════
const MODES = ["especes", "wave", "orange_money", "cheque", "virement"];
const TYPES_LIGNE = ["inscription", "uniforme", "tenue_sport", "cantine", "mensualite", "fournitures", "cours_vacances", "transport", "autre", "cours_soir", "cotisation", "cantine_jour", "article"];
const TYPES_MOIS = ["mensualite", "cours_soir"];

// Reste à payer par inscription, mois échus jusqu'à $2 (date). Paramètres : $1 année.
const SQL_IMPAYES = `
  with ins as (
    select i.id, i.eleve_id, i.classe_id, i.cantine,
      case when i.inscription_offerte then 0 else greatest(c.frais_inscription - i.reduction_inscription, 0) end + case when i.uniforme then c.uniforme else 0 end + case when i.tenue_sport then c.tenue_sport else 0 end + case when i.cantine then c.frais_cantine else 0 end as frais
    from app.inscriptions i join app.classes c on c.id=i.classe_id
    where i.annee_id=$1 and i.statut='active'),
  m as (select d from app.mois_annee($1) d where d <= $2::date),
  pay as (
    select p.inscription_id, p.type, p.mois, sum(p.montant) as montant
    from app.paiements p join app.recus r on r.id=p.recu_id and not r.annule
    group by 1,2,3),
  lignes as (
    select ins.id, m.d, app.du_mois(ins.id, m.d) as du,
      coalesce((select montant from pay where pay.inscription_id=ins.id and pay.type='mensualite' and pay.mois=m.d),0) as paye
    from ins cross join m)
  select ins.id as inscription_id, ins.eleve_id, ins.classe_id, ins.cantine, ins.frais,
    coalesce((select sum(montant) from pay where pay.inscription_id=ins.id and pay.type in ('inscription','uniforme','tenue_sport','cantine')),0) as frais_payes,
    coalesce((select sum(du) from lignes l where l.id=ins.id),0) as mens_dues,
    coalesce((select sum(least(paye,du)) from lignes l where l.id=ins.id),0) as mens_payees,
    coalesce((select count(*) from lignes l where l.id=ins.id and l.du > l.paye),0) as mois_impayes,
    (select string_agg(to_char(l.d,'YYYY-MM'), ',' order by l.d) from lignes l where l.id=ins.id and l.du > l.paye) as liste_mois,
    greatest(ins.frais - coalesce((select sum(montant) from pay where pay.inscription_id=ins.id and pay.type in ('inscription','uniforme','tenue_sport','cantine')),0), 0)
      + coalesce((select sum(greatest(du - paye, 0)) from lignes l where l.id=ins.id),0) as reste
  from ins`;

const situation = async (inscriptionId, exclure = 0) => {
  const [[ins], lignes] = await tx([
    [`select i.*, c.nom as classe, c.cycle, c.frais_inscription, c.uniforme as prix_uniforme, c.tenue_sport as prix_tenue, c.frais_cantine, a.libelle as annee
      from app.inscriptions i join app.classes c on c.id=i.classe_id join app.annees a on a.id=i.annee_id where i.id=$1`, [inscriptionId]],
    [`with i as (select i.*, c.frais_inscription, c.uniforme as prix_uniforme, c.tenue_sport as prix_tenue, c.frais_cantine from app.inscriptions i join app.classes c on c.id=i.classe_id where i.id=$1),
      pay as (select p.type, p.mois, sum(p.montant) as m from app.paiements p join app.recus r on r.id=p.recu_id and not r.annule where p.inscription_id=$1 and r.id <> $2 group by 1,2)
      select 'frais' as groupe, x.code as type, null::text as mois, x.ordre, x.du, coalesce((select sum(m) from pay where pay.type=x.code),0) as paye
      from i, lateral (values ('inscription', 1, case when i.inscription_offerte then 0 else greatest(i.frais_inscription - i.reduction_inscription, 0) end), ('uniforme', 2, case when i.uniforme then i.prix_uniforme else 0 end), ('tenue_sport', 3, case when i.tenue_sport then i.prix_tenue else 0 end), ('cantine', 4, case when i.cantine then i.frais_cantine else 0 end)) x(code, ordre, du)
      where x.du > 0 or exists (select 1 from pay where pay.type=x.code)
      union all
      select 'mois', 'mensualite', to_char(d,'YYYY-MM'), 10, app.du_mois($1, d), coalesce((select m from pay where pay.type='mensualite' and pay.mois=d),0)
      from app.mois_annee((select annee_id from i)) d
      union all
      select 'autre', p.type, null, 20, 0, sum(p.m) from pay p where p.type not in ('inscription','uniforme','tenue_sport','cantine','mensualite') group by p.type
      order by 4, 3`, [inscriptionId, exclure || 0]],
  ]);
  if (!ins) fail(404, "Inscription introuvable.");
  const mois = new Date().toISOString().slice(0, 7);
  const totalDu = lignes.reduce((t, l) => t + l.du, 0);
  const totalPaye = lignes.filter((l) => l.groupe !== "autre").reduce((t, l) => t + Math.min(l.paye, l.du), 0);
  const echu = lignes.filter((l) => l.groupe === "frais" || (l.groupe === "mois" && l.mois <= mois)).reduce((t, l) => t + Math.max(l.du - l.paye, 0), 0);
  return { inscription: ins, lignes, total_du: totalDu, total_paye: totalPaye, reste_annee: Math.max(totalDu - totalPaye, 0), reste_echu: echu };
};

// Retirer (ou rétablir) un mois de la scolarité d'un élève : il n'est plus dû, donc plus d'arriéré.
route("PUT", "/inscriptions/:id/mois-retires", async (ctx) => {
  exige(ctx, "finances.annuler");
  const { mois, retirer, motif } = ctx.body || {};
  if (!/^\d{4}-\d{2}$/.test(mois || "")) fail(400, "Mois invalide.");
  if (retirer) {
    const p = await one(`select coalesce(sum(pa.montant),0) as m from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule
      where pa.inscription_id=$1 and pa.type='mensualite' and pa.mois=$2::date`, [ctx.params.id, `${mois}-01`]);
    if (p.m > 0) fail(400, "Ce mois a déjà été payé (en partie ou en totalité) : retirez d'abord la ligne du reçu.");
  }
  const r = await one(`update app.inscriptions set mois_retires = case when $3::boolean
      then (select coalesce(jsonb_agg(distinct v), '[]') from jsonb_array_elements_text(mois_retires || to_jsonb($2::text)) v)
      else coalesce((select jsonb_agg(v) from jsonb_array_elements_text(mois_retires) v where v <> $2), '[]') end
    where id=$1 returning id, mois_retires`, [ctx.params.id, mois, !!retirer]);
  if (!r) fail(404, "Inscription introuvable.");
  await journal(ctx, retirer ? "mois_retire" : "mois_retabli", "inscription", r.id, { mois, motif: motif || null });
  return r;
});

route("GET", "/inscriptions/:id/situation", async (ctx) => { exige(ctx, "finances.lire"); return situation(ctx.params.id, Number(ctx.query.exclure_recu) || 0); });

const recuComplet = async (id) => {
  const [[r], lignes] = await tx([
    [`select r.*, e.id as eleve_id, e.matricule, e.nom, e.prenom, e.sexe, c.nom as classe, a.libelle as annee, i.annee_id,
        u.prenom || ' ' || u.nom as encaisse_par_nom, ua.prenom || ' ' || ua.nom as annule_par_nom,
        coalesce(e.mere_telephone, e.pere_telephone, e.tuteur_telephone) as telephone,
        coalesce(nullif(trim(coalesce(e.pere_prenom,'') || ' ' || coalesce(e.pere_nom,'')), ''), nullif(trim(coalesce(e.mere_prenom,'') || ' ' || coalesce(e.mere_nom,'')), '')) as parent
      from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id
      join app.classes c on c.id=i.classe_id join app.annees a on a.id=i.annee_id
      left join app.utilisateurs u on u.id=r.encaisse_par left join app.utilisateurs ua on ua.id=r.annule_par
      where r.id=$1`, [id]],
    ["select id, type, to_char(mois,'YYYY-MM') as mois, montant, libelle from app.paiements where recu_id=$1 order by mois nulls first, id", [id]],
  ]);
  if (!r) fail(404, "Reçu introuvable.");
  return { ...r, lignes };
};

route("GET", "/recus/:id", async (ctx) => {
  exige(ctx, "finances.lire");
  const r = await recuComplet(ctx.params.id);
  const sit = await situation(r.inscription_id);
  const historique = await q(`select m.id, m.motif, m.avant, m.apres, m.created_at, u.prenom || ' ' || u.nom as par
    from app.recus_modifications m left join app.utilisateurs u on u.id=m.modifie_par where m.recu_id=$1 order by m.created_at desc`, [ctx.params.id]);
  return { recu: r, situation: { reste_annee: sit.reste_annee, reste_echu: sit.reste_echu, total_du: sit.total_du, total_paye: sit.total_paye, lignes: sit.lignes, gratuit: sit.inscription.gratuit, mensualite_speciale: sit.inscription.mensualite_speciale }, historique, modifiable: !r.annule && peutModifierRecu(ctx, r), supprimable: peutSupprimerRecu(ctx, r) };
});

route("GET", "/recus", async (ctx) => {
  exige(ctx, "finances.lire");
  const { du, au, mode, q: rech, annules } = ctx.query;
  const annee = await anneeCourante(ctx.query.annee_id);
  const where = ["i.annee_id=$1"]; const p = [annee];
  if (du) { p.push(du); where.push(`r.date_paiement >= $${p.length}`); }
  if (au) { p.push(au); where.push(`r.date_paiement <= $${p.length}`); }
  if (mode) { p.push(mode); where.push(`r.mode = $${p.length}`); }
  if (annules !== "oui") where.push("not r.annule");
  const type = TYPES_LIGNE.includes(ctx.query.type) ? ctx.query.type : null;
  if (type) { p.push(type); where.push(`exists (select 1 from app.paiements px where px.recu_id=r.id and px.type=$${p.length})`); }
  if (rech) { p.push(`%${rech.toLowerCase()}%`); where.push(`(lower(e.nom||' '||e.prenom) like $${p.length} or lower(e.prenom||' '||e.nom) like $${p.length} or lower(r.numero) like $${p.length} or lower(e.matricule) like $${p.length})`); }
  const base = `from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id where ${where.join(" and ")}`;
  const [rows, [tot], modes, types] = await tx([
    [`select r.id, r.numero, r.date_paiement, r.mode, r.montant, r.annule, r.created_at, e.id as eleve_id,
        ${type ? `(select sum(px.montant) from app.paiements px where px.recu_id=r.id and px.type='${type}') as montant_type,` : ""} e.nom, e.prenom, e.sexe, e.matricule, c.nom as classe, c.cycle,
        (select json_agg(json_build_object('type', p.type, 'mois', to_char(p.mois,'YYYY-MM'), 'montant', p.montant, 'libelle', p.libelle) order by p.mois nulls first) from app.paiements p where p.recu_id=r.id) as lignes
      ${base} order by r.date_paiement desc, r.id desc limit 300`, p],
    [`select coalesce(sum(${type ? `(select sum(px.montant) from app.paiements px where px.recu_id=r.id and px.type='${type}')` : "r.montant"}) filter (where not r.annule),0) as total,
        count(*) filter (where not r.annule) as nombre, count(distinct e.id) filter (where not r.annule) as eleves ${base}`, p],
    [`select r.mode, sum(r.montant) as montant, count(*) as nombre ${base} and not r.annule group by r.mode order by 2 desc`, p],
    [`select pa.type, sum(pa.montant) as montant from app.paiements pa join app.recus r on r.id=pa.recu_id join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id where ${where.join(" and ")} and not r.annule group by pa.type order by 2 desc`, p],
  ]);
  return { rows, total: tot.total, nombre: tot.nombre, modes, types };
});

const lignesValides = (b) => {
  if (!MODES.includes(b.mode || "especes")) fail(400, "Mode de paiement invalide.");
  const lignes = (b.lignes || []).filter((l) => Number(l.montant) > 0);
  if (!lignes.length) fail(400, "Ajoutez au moins une ligne avec un montant.");
  for (const l of lignes) {
    if (!TYPES_LIGNE.includes(l.type)) fail(400, "Type de paiement invalide.");
    if (TYPES_MOIS.includes(l.type) && !/^\d{4}-\d{2}$/.test(l.mois || "")) fail(400, "Précisez le mois pour chaque mensualité ou cours du soir.");
    if (!Number.isInteger(Number(l.montant))) fail(400, "Montant invalide.");
    if (l.type === "autre" && !String(l.libelle || "").trim()) fail(400, "Précisez le motif du paiement « Autre ».");
  }
  return lignes;
};
const valeursLignes = (lignes, params) => lignes.map((l) => { params.push(l.type, TYPES_MOIS.includes(l.type) ? `${l.mois}-01` : null, Number(l.montant), l.libelle ? String(l.libelle).trim() : null); const n = params.length; return `($${n - 3}, $${n - 2}::date, $${n - 1}::int, $${n}::text)`; });

// Refuse d'encaisser un frais ou un mois déjà soldé (ou au-delà de ce qui reste dû).
const verifierDejaPaye = async (inscriptionId, lignes, exclure = 0) => {
  const sit = await situation(inscriptionId, exclure);
  const cumul = {};
  for (const l of lignes) {
    const estMois = l.type === "mensualite", estFrais = ["inscription", "uniforme", "tenue_sport", "cantine"].includes(l.type);
    if (!estMois && !estFrais) continue;
    const s = sit.lignes.find((x) => x.type === l.type && (estMois ? x.mois === l.mois : true));
    if (!s) continue;
    const k = `${l.type}|${l.mois || ""}`;
    cumul[k] = (cumul[k] || 0) + Number(l.montant);
    const reste = Math.max(s.du - s.paye, 0);
    const nom = estMois ? `La mensualité de ${["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"][Number(l.mois.slice(5, 7)) - 1]} ${l.mois.slice(0, 4)}` : ({ inscription: "Le droit d'inscription", uniforme: "L'uniforme", tenue_sport: "La tenue de sport", cantine: "L'inscription cantine" })[l.type];
    if (reste === 0) fail(400, `${nom} est déjà entièrement payé(e).`);
    if (cumul[k] > reste) fail(400, `${nom} : il ne reste que ${reste} F à payer.`);
  }
};

route("POST", "/recus", async (ctx) => {
  exige(ctx, "finances.encaisser");
  const b = ctx.body;
  requis(b, [["inscription_id", "L'élève"]]);
  const lignes = lignesValides(b);
  const ins = await one("select i.id, a.libelle from app.inscriptions i join app.annees a on a.id=i.annee_id where i.id=$1", [b.inscription_id]);
  if (!ins) fail(404, "Inscription introuvable.");
  await verifierDejaPaye(b.inscription_id, lignes);
  const prefixe = "R" + ins.libelle.replace(/^\d{2}(\d{2})-\d{2}(\d{2})$/, "$1$2");
  const total = lignes.reduce((t, l) => t + Number(l.montant), 0);
  const params = [b.inscription_id, b.date_paiement || null, b.mode || "especes", total, b.reference || null, b.note || null, ctx.user.id, prefixe];
  const values = valeursLignes(lignes, params);
  const r = await one(
    `with r as (
       insert into app.recus (numero, inscription_id, date_paiement, mode, montant, reference, note, encaisse_par)
       values ($8::text || '-' || lpad(nextval('app.recu_seq')::text, 5, '0'), $1::int, coalesce($2::date, current_date), $3::text, $4::int, $5::text, $6::text, $7::int) returning *),
     l as (insert into app.paiements (recu_id, inscription_id, type, mois, montant, libelle)
       select r.id, r.inscription_id, v.type, v.mois, v.montant, v.libelle from r, (values ${values.join(",")}) v(type, mois, montant, libelle) returning id)
     select r.id, r.numero, r.montant, (select count(*) from l) as lignes from r`, params);
  await journal(ctx, "encaissement", "recu", r.id, { numero: r.numero, montant: r.montant });
  return r;
});



// ── Factures mensuelles (avis de paiement) ──
route("GET", "/factures", async (ctx) => {
  exige(ctx, "finances.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  if (!/^\d{4}-\d{2}$/.test(ctx.query.mois || "")) fail(400, "Choisissez le mois de la facture.");
  if (ctx.query.mois > new Date().toISOString().slice(0, 7)) fail(400, "Ce mois n'a pas encore commencé : on ne peut pas encore le facturer.");
  const m1 = `${ctx.query.mois}-01`;
  const p = [annee, m1]; const w = ["1=1"];
  if (ctx.query.classe_id) { p.push(ctx.query.classe_id); w.push(`x.classe_id=$${p.length}`); }
  if (ctx.query.eleve_id) { p.push(ctx.query.eleve_id); w.push(`x.eleve_id=$${p.length}`); }
  const rows = await q(`select x.*, e.matricule, e.nom, e.prenom, e.sexe, c.nom as classe, c.cycle, c.ordre,
      coalesce(e.mere_telephone, e.pere_telephone, e.tuteur_telephone) as telephone,
      coalesce(nullif(trim(coalesce(e.mere_prenom,'')||' '||coalesce(e.mere_nom,'')),''), nullif(trim(coalesce(e.pere_prenom,'')||' '||coalesce(e.pere_nom,'')),''), e.tuteur_nom) as parent,
      app.du_mois(x.inscription_id, $2::date) as du_mois,
      coalesce((select sum(pa.montant) from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule
        where pa.inscription_id=x.inscription_id and pa.type='mensualite' and pa.mois=$2::date),0) as paye_mois,
      exists (select 1 from app.mois_annee($1) d where d = $2::date) as mois_dans_annee
    from (${SQL_IMPAYES}) x join app.eleves e on e.id=x.eleve_id join app.classes c on c.id=x.classe_id
    where ${w.join(" and ")} order by c.ordre, e.nom, e.prenom`, p);
  const out = rows.map((r) => {
    const resteMois = Math.max(r.du_mois - r.paye_mois, 0);
    const fraisReste = Math.max(r.frais - r.frais_payes, 0);
    const arrieres = Math.max(r.reste - resteMois - fraisReste, 0);
    const moisRetard = (r.liste_mois || "").split(",").filter((m) => m && m < ctx.query.mois);
    return { ...r, reste_mois: resteMois, frais_reste: fraisReste, arrieres, mois_retard: moisRetard, total: r.reste,
      numero: `F${ctx.query.mois.replace("-", "").slice(2)}-${r.matricule}` };
  });
  // Détail ligne par ligne : chaque frais et chaque mois en retard avec payé / dû / reste
  const ids = `{${out.map((r) => r.inscription_id).join(",")}}`;
  if (out.length) {
    const [frais, retards] = await tx([
      [`select i.id,
          case when i.inscription_offerte then 0 else greatest(c.frais_inscription - i.reduction_inscription, 0) end as du_inscription,
          case when i.uniforme then c.uniforme else 0 end as du_uniforme,
          case when i.tenue_sport then c.tenue_sport else 0 end as du_tenue_sport,
          case when i.cantine then c.frais_cantine else 0 end as du_cantine,
          (select coalesce(json_object_agg(t, m), '{}') from (select pa.type as t, sum(pa.montant) as m from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule
            where pa.inscription_id=i.id and pa.type in ('inscription','uniforme','tenue_sport','cantine') group by pa.type) z) as payes
        from app.inscriptions i join app.classes c on c.id=i.classe_id where i.id = any($1::int[])`, [ids]],
      [`select i.id, to_char(d,'YYYY-MM') as mois, app.du_mois(i.id, d) as du,
          coalesce((select sum(pa.montant) from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule
            where pa.inscription_id=i.id and pa.type='mensualite' and pa.mois=d),0) as paye
        from app.inscriptions i cross join app.mois_annee($2) d
        where i.id = any($1::int[]) and d < $3::date and app.du_mois(i.id, d) > coalesce((select sum(pa.montant) from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule
            where pa.inscription_id=i.id and pa.type='mensualite' and pa.mois=d),0)
        order by i.id, d`, [ids, annee, m1]],
    ]);
    const LIB = { inscription: "Droit d'inscription", uniforme: "Uniforme", tenue_sport: "Tenue de sport", cantine: "Inscription cantine" };
    out.forEach((r) => {
      const f = frais.find((x) => x.id === r.inscription_id);
      r.details_frais = f ? Object.keys(LIB).map((t) => ({ type: t, libelle: LIB[t], du: f[`du_${t}`], paye: Math.min(f.payes?.[t] || 0, f[`du_${t}`]) }))
        .filter((x) => x.du > x.paye).map((x) => ({ ...x, reste: x.du - x.paye })) : [];
      r.details_retards = retards.filter((x) => x.id === r.inscription_id).map((x) => ({ mois: x.mois, du: x.du, paye: x.paye, reste: x.du - x.paye }));
    });
  }
  return { mois: ctx.query.mois, rows: out, total: out.reduce((t, r) => t + r.total, 0), a_payer: out.filter((r) => r.total > 0).length };
});


// ── Suppression d'un reçu (erreur à l'encaissement, le jour même uniquement) ──
const memeJour = (r) => String(r.created_at).slice(0, 10) === new Date().toISOString().slice(0, 10);
const peutSupprimerRecu = (ctx, r) => memeJour(r) && (peut(ctx.user, "finances.annuler") || (peut(ctx.user, "finances.encaisser") && r.encaisse_par === ctx.user.id));
route("DELETE", "/recus/:id", async (ctx) => {
  exige(ctx, "finances.encaisser");
  const r = await recuComplet(ctx.params.id);
  if (!peutSupprimerRecu(ctx, r)) fail(403, memeJour(r)
    ? "Seuls la direction et la personne qui a encaissé peuvent supprimer ce reçu."
    : "Un reçu ne peut être supprimé que le jour même. Utilisez « Modifier » ou « Annuler ».");
  await q("delete from app.recus where id=$1", [ctx.params.id]);
  await journal(ctx, "suppression", "recu", Number(ctx.params.id), {
    numero: r.numero, montant: r.montant, eleve: `${r.prenom} ${r.nom}`, mode: r.mode,
    detail: r.lignes.map((l) => `${l.type}${l.mois ? " " + l.mois : ""} ${l.montant}`).join(", "),
  });
  return { ok: true, eleve_id: r.eleve_id };
});

// ── Modification d'un reçu (corrections) ──
const peutModifierRecu = (ctx, r) => peut(ctx.user, "finances.annuler")
  || (peut(ctx.user, "finances.encaisser") && r.encaisse_par === ctx.user.id && String(r.created_at).slice(0, 10) === new Date().toISOString().slice(0, 10));
route("PUT", "/recus/:id", async (ctx) => {
  exige(ctx, "finances.encaisser");
  const b = ctx.body;
  requis(b, [["motif", "Le motif de la modification"]]);
  const avant = await recuComplet(ctx.params.id);
  if (avant.annule) fail(400, "Un reçu annulé ne peut pas être modifié.");
  if (avant.lignes.some((l) => l.type === "article")) fail(400, "Un reçu de vente de fournitures ne se modifie pas : supprimez-le (le jour même) ou annulez-le, puis refaites la vente.");
  if (!peutModifierRecu(ctx, avant)) fail(403, "Seule la direction peut modifier ce reçu. La personne qui a encaissé peut le corriger uniquement le jour même.");
  const lignes = lignesValides(b);
  await verifierDejaPaye(avant.inscription_id, lignes, avant.id);
  const total = lignes.reduce((t, l) => t + Number(l.montant), 0);
  const params = [ctx.params.id, b.date_paiement || null, b.mode || "especes", total, b.reference || null, b.note || null];
  const values = valeursLignes(lignes, params);
  await tx([
    [`update app.recus set date_paiement=coalesce($2::date, date_paiement), mode=$3::text, montant=$4::int, reference=$5::text, note=$6::text where id=$1::int`, params.slice(0, 6)],
    ["delete from app.paiements where recu_id=$1", [ctx.params.id]],
    [`insert into app.paiements (recu_id, inscription_id, type, mois, montant, libelle)
      select $1::int, (select inscription_id from app.recus where id=$1::int), v.type, v.mois, v.montant, v.libelle from (values ${values.join(",").replace(/\$(\d+)/g, (m, n) => `$${Number(n) - 5}`)}) v(type, mois, montant, libelle)`, [ctx.params.id, ...params.slice(6)]],
  ]);
  const apres = await recuComplet(ctx.params.id);
  const resume = (r) => ({ date: r.date_paiement, mode: r.mode, montant: r.montant, reference: r.reference, lignes: r.lignes });
  await q("insert into app.recus_modifications (recu_id, modifie_par, motif, avant, apres) values ($1,$2,$3,$4,$5)", [ctx.params.id, ctx.user.id, b.motif, resume(avant), resume(apres)]);
  await journal(ctx, "modification", "recu", Number(ctx.params.id), { numero: avant.numero, avant: avant.montant, apres: apres.montant, motif: b.motif });
  return { ok: true, id: Number(ctx.params.id), numero: apres.numero, montant: apres.montant };
});

// Retirer une seule ligne (ex. une mensualité cochée par erreur) sans toucher au reste du reçu.
route("POST", "/recus/:id/retirer-ligne", async (ctx) => {
  exige(ctx, "finances.encaisser");
  const b = ctx.body;
  requis(b, [["motif", "Le motif"]]);
  const avant = await recuComplet(ctx.params.id);
  if (avant.annule) fail(400, "Ce reçu est annulé.");
  if (!peutModifierRecu(ctx, avant)) fail(403, "Seule la direction peut modifier ce reçu. La personne qui a encaissé peut le corriger uniquement le jour même.");
  const ligne = avant.lignes.find((l) => l.id === Number(b.paiement_id));
  if (!ligne) fail(404, "Ligne introuvable sur ce reçu.");
  if (ligne.type === "article") fail(400, "Une vente de fournitures s'annule avec le reçu entier.");
  if (avant.lignes.length === 1) fail(400, "C'est la seule ligne du reçu : supprimez ou annulez le reçu entier.");
  await tx([
    ["delete from app.paiements where id=$1 and recu_id=$2", [ligne.id, avant.id]],
    ["update app.recus set montant = montant - $2 where id=$1", [avant.id, ligne.montant]],
  ]);
  const apres = await recuComplet(ctx.params.id);
  const resume = (r) => ({ date: r.date_paiement, mode: r.mode, montant: r.montant, reference: r.reference, lignes: r.lignes });
  await q("insert into app.recus_modifications (recu_id, modifie_par, motif, avant, apres) values ($1,$2,$3,$4,$5)", [avant.id, ctx.user.id, b.motif, resume(avant), resume(apres)]);
  await journal(ctx, "modification", "recu", avant.id, { numero: avant.numero, ligne_retiree: ligne.type, mois: ligne.mois, montant: ligne.montant, motif: b.motif });
  return { ok: true, montant: apres.montant };
});

route("POST", "/recus/:id/annuler", async (ctx) => {
  exige(ctx, "finances.annuler");
  requis(ctx.body, [["motif", "Le motif d'annulation"]]);
  const r = await one(`update app.recus set annule=true, annule_motif=$2, annule_par=$3, annule_le=now() where id=$1 and not annule returning id, numero, montant`,
    [ctx.params.id, ctx.body.motif, ctx.user.id]);
  if (!r) fail(400, "Ce reçu est déjà annulé ou n'existe pas.");
  await journal(ctx, "annulation", "recu", r.id, { numero: r.numero, montant: r.montant, motif: ctx.body.motif });
  return { ok: true };
});

route("GET", "/impayes", async (ctx) => {
  exige(ctx, "finances.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  const jusqua = /^\d{4}-\d{2}$/.test(ctx.query.mois || "") ? `${ctx.query.mois}-01` : new Date().toISOString().slice(0, 10);
  const p = [annee, jusqua]; const where = ["x.reste > 0"];
  if (ctx.query.classe_id) { p.push(ctx.query.classe_id); where.push(`x.classe_id=$${p.length}`); }
  if (ctx.query.q) { p.push(`%${ctx.query.q.toLowerCase()}%`); where.push(`(lower(e.nom||' '||e.prenom) like $${p.length} or lower(e.prenom||' '||e.nom) like $${p.length} or lower(e.matricule) like $${p.length})`); }
  const rows = await q(`select x.*, e.matricule, e.nom, e.prenom, e.sexe, c.nom as classe, c.cycle,
      coalesce(e.mere_telephone, e.pere_telephone, e.tuteur_telephone) as telephone,
      coalesce(nullif(trim(coalesce(e.mere_prenom,'')||' '||coalesce(e.mere_nom,'')),''), nullif(trim(coalesce(e.pere_prenom,'')||' '||coalesce(e.pere_nom,'')),'')) as parent
    from (${SQL_IMPAYES}) x join app.eleves e on e.id=x.eleve_id join app.classes c on c.id=x.classe_id
    where ${where.join(" and ")} order by x.reste desc, e.nom`, p);
  const parClasse = {};
  rows.forEach((r) => { parClasse[r.classe] = (parClasse[r.classe] || 0) + r.reste; });
  return { rows, total: rows.reduce((t, r) => t + r.reste, 0), jusqua, par_classe: parClasse };
});

route("GET", "/caisse", async (ctx) => {
  exige(ctx, "finances.lire");
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date || "") ? ctx.query.date : new Date().toISOString().slice(0, 10);
  const [recus, depenses, recettes] = await tx([
    [`select r.id, r.numero, r.mode, r.montant, r.annule, r.created_at, e.nom, e.prenom, e.matricule, c.nom as classe,
        u.prenom || ' ' || u.nom as encaisse_par_nom,
        (select string_agg(distinct p.type, ',') from app.paiements p where p.recu_id=r.id) as types
      from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id
      left join app.utilisateurs u on u.id=r.encaisse_par where r.date_paiement=$1 order by r.created_at`, [jour]],
    [`select d.*, u.prenom || ' ' || u.nom as saisi_par_nom from app.depenses d left join app.utilisateurs u on u.id=d.saisi_par where d.date_depense=$1 order by d.created_at`, [jour]],
    [`select x.*, u.prenom || ' ' || u.nom as saisi_par_nom from app.recettes x left join app.utilisateurs u on u.id=x.saisi_par where x.date_recette=$1 order by x.created_at`, [jour]],
  ]);
  const modes = {};
  for (const m of MODES) modes[m] = { entrees: 0, sorties: 0 };
  recus.filter((r) => !r.annule).forEach((r) => (modes[r.mode].entrees += r.montant));
  depenses.forEach((d) => (modes[d.mode].sorties += d.montant));
  recettes.forEach((x) => (modes[x.mode].entrees += x.montant));
  const entrees = recus.filter((r) => !r.annule).reduce((t, r) => t + r.montant, 0) + recettes.reduce((t, x) => t + x.montant, 0);
  const sorties = depenses.reduce((t, d) => t + d.montant, 0);
  return { date: jour, recus, depenses, recettes, modes, entrees, sorties, solde: entrees - sorties };
});

// ── Dépenses ──
const COLS_DEP = ["date_depense", "categorie", "libelle", "montant", "mode", "beneficiaire", "reference", "note"];
route("GET", "/depenses", async (ctx) => {
  exige(ctx, "depenses.lire");
  const { du, au, categorie } = ctx.query;
  const where = ["1=1"]; const p = [];
  if (du) { p.push(du); where.push(`d.date_depense >= $${p.length}`); }
  if (au) { p.push(au); where.push(`d.date_depense <= $${p.length}`); }
  if (categorie) { p.push(categorie); where.push(`d.categorie = $${p.length}`); }
  const w = where.join(" and ");
  const [rows, cats, [tot]] = await tx([
    [`select d.*, u.prenom || ' ' || u.nom as saisi_par_nom from app.depenses d left join app.utilisateurs u on u.id=d.saisi_par where ${w} order by d.date_depense desc, d.id desc limit 500`, p],
    [`select categorie, sum(montant) as montant, count(*) as nombre from app.depenses d where ${w} group by 1 order by 2 desc`, p],
    [`select coalesce(sum(montant),0) as total, count(*) as nombre from app.depenses d where ${w}`, p],
  ]);
  return { rows, categories: cats, total: tot.total, nombre: tot.nombre };
});
route("POST", "/depenses", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const d = pick(ctx.body, COLS_DEP);
  requis(d, [["libelle", "Le libellé"], ["montant", "Le montant"]]);
  if (!(Number(d.montant) > 0)) fail(400, "Le montant doit être positif.");
  d.saisi_par = ctx.user.id;
  d.annee_id = await anneeCourante(ctx.body.annee_id);
  const r = await one(...insertSql("app.depenses", d));
  await journal(ctx, "creation", "depense", r.id, { libelle: r.libelle, montant: r.montant });
  return r;
});
route("PUT", "/depenses/:id", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const av = await one("select montant from app.depenses where id=$1", [ctx.params.id]);
  const r = await one(...updateSql("app.depenses", ctx.params.id, pick(ctx.body, COLS_DEP)));
  await journal(ctx, "modification", "depense", r.id, { libelle: r.libelle, montant: r.montant, avant: av?.montant });
  return r;
});
route("DELETE", "/depenses/:id", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const r = await one("delete from app.depenses where id=$1 returning id, libelle, montant", [ctx.params.id]);
  await journal(ctx, "suppression", "depense", Number(ctx.params.id), r);
  return { ok: true };
});






// ── Sauvegarde complète des données ──
route("GET", "/sauvegarde", async (ctx) => {
  exige(ctx, "etablissement.ecrire");
  const T = {
    eleves: "select * from app.eleves order by nom, prenom",
    inscriptions: `select i.*, a.libelle as annee, c.nom as classe, e.matricule, e.nom, e.prenom from app.inscriptions i join app.annees a on a.id=i.annee_id join app.classes c on c.id=i.classe_id join app.eleves e on e.id=i.eleve_id order by a.debut, c.ordre, e.nom`,
    recus: `select r.*, e.matricule, e.nom, e.prenom, u.prenom || ' ' || u.nom as encaisse_par_nom from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id left join app.utilisateurs u on u.id=r.encaisse_par order by r.id`,
    paiements: "select p.*, r.numero from app.paiements p join app.recus r on r.id=p.recu_id order by p.id",
    depenses: "select * from app.depenses order by date_depense, id",
    articles: "select * from app.articles order by nom",
    mouvements_stock: "select m.*, a.nom as article from app.mouvements_stock m join app.articles a on a.id=m.article_id order by m.date_mouvement, m.id",
    recettes: "select * from app.recettes order by date_recette, id",
    classes: "select c.*, a.libelle as annee from app.classes c join app.annees a on a.id=c.annee_id order by a.debut, c.ordre",
    matieres: "select m.*, c.nom as classe from app.matieres m join app.classes c on c.id=m.classe_id order by c.id, m.ordre",
    enseignants: "select * from app.enseignants order by nom",
    evaluations: "select ev.*, m.nom as matiere, c.nom as classe from app.evaluations ev join app.matieres m on m.id=ev.matiere_id join app.classes c on c.id=ev.classe_id order by ev.id",
    notes: "select n.*, e.matricule, e.nom, e.prenom from app.notes n join app.inscriptions i on i.id=n.inscription_id join app.eleves e on e.id=i.eleve_id order by n.evaluation_id",
    appreciations: "select * from app.appreciations",
    absences: "select a.*, e.matricule, e.nom, e.prenom from app.absences a join app.inscriptions i on i.id=a.inscription_id join app.eleves e on e.id=i.eleve_id order by a.date_absence",
    emploi_temps: "select * from app.emploi_temps order by classe_id, jour, heure_debut",
    annees: "select * from app.annees order by debut",
    etablissement: "select * from app.etablissement",
    utilisateurs: "select id, nom, prenom, email, role, actif, dernier_login, created_at from app.utilisateurs order by id",
    types_paiement: "select * from app.types_paiement",
  };
  const noms = Object.keys(T);
  const res = await tx(noms.map((n) => [T[n]]));
  await q("update app.etablissement set derniere_sauvegarde=now() where id=1");
  await journal(ctx, "sauvegarde", "etablissement", 1);
  return { date: new Date().toISOString(), tables: Object.fromEntries(noms.map((n, i) => [n, res[i]])) };
});

// ── Types de paiement personnalisés ──
route("GET", "/types-paiement", async (ctx) => { exige(ctx, "finances.lire"); return q("select * from app.types_paiement order by actif desc, libelle"); });
route("POST", "/types-paiement", async (ctx) => {
  exige(ctx, "etablissement.ecrire");
  requis(ctx.body, [["libelle", "Le nom du type"]]);
  const r = await one("insert into app.types_paiement (libelle, montant) values ($1, $2) returning *", [ctx.body.libelle.trim(), Number(ctx.body.montant) || 0]);
  await journal(ctx, "creation", "type_paiement", r.id, { libelle: r.libelle });
  return r;
});
route("PUT", "/types-paiement/:id", async (ctx) => {
  exige(ctx, "etablissement.ecrire");
  return one(...updateSql("app.types_paiement", ctx.params.id, pick(ctx.body, ["libelle", "montant", "actif"])));
});
route("DELETE", "/types-paiement/:id", async (ctx) => {
  exige(ctx, "etablissement.ecrire");
  await q("delete from app.types_paiement where id=$1", [ctx.params.id]);
  return { ok: true };
});

// ── Services : cantine, uniformes, fournitures, cours du soir, cotisations ──
const SERVICES = {
  uniforme:    { du: "case when i.uniforme then c.uniforme else 0 end + case when i.tenue_sport then c.tenue_sport else 0 end", types: ["uniforme", "tenue_sport"] },
  fournitures: { du: "a.frais_fournitures", types: ["fournitures"] },
  cotisation:  { du: "a.frais_cotisation", types: ["cotisation"] },
  cantine:     { du: "case when i.cantine then c.frais_cantine else 0 end", types: ["cantine", "cantine_jour"] },
  cours_soir:  { du: "null::int", types: ["cours_soir"] },
};
route("GET", "/services/:type", async (ctx) => {
  exige(ctx, "finances.lire");
  const sv = SERVICES[ctx.params.type];
  if (!sv) fail(404, "Service inconnu.");
  const annee = await anneeCourante(ctx.query.annee_id);
  const p = [annee, sv.types]; const w = ["i.annee_id=$1", "i.statut='active'"];
  if (ctx.query.classe_id) { p.push(ctx.query.classe_id); w.push(`i.classe_id=$${p.length}`); }
  const rows = await q(`select i.id as inscription_id, e.id as eleve_id, e.matricule, e.nom, e.prenom, e.sexe, c.nom as classe, c.cycle, i.cantine, i.uniforme as a_uniforme, i.tenue_sport as a_tenue, i.fournitures_remises, i.cours_soir as inscrit_soir, c.cours_soir > 0 as soir_dispo,
      coalesce(e.mere_telephone, e.pere_telephone, e.tuteur_telephone) as telephone,
      ${sv.du} as du,
      ${ctx.params.type === "cours_soir"
        // Compris dans la mensualité : part cours du soir de chaque mois payé (+ éventuels paiements séparés)
        ? `case when i.cours_soir and c.cours_soir > 0 then coalesce((select sum(least(x.m, c.cours_soir)) from (select pa.mois, sum(pa.montant) as m from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule where pa.inscription_id=i.id and pa.type='mensualite' group by pa.mois) x),0) else 0 end
           + coalesce((select sum(pa.montant) from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule where pa.inscription_id=i.id and pa.type='cours_soir'),0) as paye,`
        : `coalesce((select sum(pa.montant) from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule where pa.inscription_id=i.id and pa.type = any($2::text[])),0) as paye,`}
      coalesce((select sum(pa.montant) from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule where pa.inscription_id=i.id and pa.type='cantine_jour'),0) as paye_jour,
      (select string_agg(distinct to_char(pa.mois,'YYYY-MM'), ',') from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule where pa.inscription_id=i.id and pa.type = any(${ctx.params.type === "cours_soir" ? "'{mensualite,cours_soir}'" : "$2"}::text[]) and pa.mois is not null${ctx.params.type === "cours_soir" ? " and i.cours_soir" : ""}) as mois,
      (select max(r.date_paiement) from app.paiements pa join app.recus r on r.id=pa.recu_id and not r.annule where pa.inscription_id=i.id and pa.type = any($2::text[])) as dernier
    from app.inscriptions i join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id join app.annees a on a.id=i.annee_id
    where ${w.join(" and ")} order by c.ordre, e.nom, e.prenom`, [annee, `{${sv.types.join(",")}}`, ...p.slice(2)]);
  const total = rows.reduce((t, r) => t + r.paye, 0);
  const attendu = rows.reduce((t, r) => t + (r.du || 0), 0);
  return { type: ctx.params.type, rows, total, attendu, payeurs: rows.filter((r) => r.paye > 0).length };
});

// ═══ FOURNITURES : stock, mouvements, ventes ═══════════════════════════════
const COLS_ART = ["nom", "categorie", "unite", "prix_achat", "prix_vente", "seuil", "actif"];
const SQL_STOCK = `coalesce((select sum(case when m.sens in ('entree','ajustement') then m.quantite else -m.quantite end)
  from app.mouvements_stock m left join app.recus r on r.id=m.recu_id where m.article_id=a.id and not coalesce(r.annule, false)), 0)`;
const stockDe = async (id) => (await one(`select ${SQL_STOCK} as stock from app.articles a where a.id=$1`, [id]))?.stock ?? 0;

route("GET", "/articles", async (ctx) => {
  exige(ctx, "finances.lire");
  return q(`select a.*, ${SQL_STOCK} as stock,
      coalesce((select sum(m.quantite) from app.mouvements_stock m join app.recus r on r.id=m.recu_id and not r.annule where m.article_id=a.id and m.sens='vente'),0) as vendus
    from app.articles a order by a.actif desc, a.nom`);
});
route("POST", "/articles", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const d = pick(ctx.body, COLS_ART);
  requis(d, [["nom", "Le nom de l'article"]]);
  const r = await one(...insertSql("app.articles", d));
  if (Number(ctx.body.stock_initial) > 0)
    await q("insert into app.mouvements_stock (article_id, sens, quantite, prix_unitaire, note, saisi_par) values ($1,'ajustement',$2,$3,'Stock initial',$4)", [r.id, Number(ctx.body.stock_initial), r.prix_achat, ctx.user.id]);
  await journal(ctx, "creation", "article", r.id, { nom: r.nom });
  return r;
});
route("PUT", "/articles/:id", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const r = await one(...updateSql("app.articles", ctx.params.id, pick(ctx.body, COLS_ART)));
  await journal(ctx, "modification", "article", r.id, { nom: r.nom });
  return r;
});

route("GET", "/mouvements", async (ctx) => {
  exige(ctx, "finances.lire");
  const w = ["1=1"]; const p = [];
  if (ctx.query.article_id) { p.push(ctx.query.article_id); w.push(`m.article_id=$${p.length}`); }
  if (ctx.query.sens) { p.push(ctx.query.sens); w.push(`m.sens=$${p.length}`); }
  if (ctx.query.du) { p.push(ctx.query.du); w.push(`m.date_mouvement >= $${p.length}`); }
  if (ctx.query.au) { p.push(ctx.query.au); w.push(`m.date_mouvement <= $${p.length}`); }
  return q(`select m.*, a.nom as article, a.unite, c.nom as classe, r.numero as recu_numero, r.annule as recu_annule,
      e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, u.prenom || ' ' || u.nom as saisi_par_nom
    from app.mouvements_stock m join app.articles a on a.id=m.article_id left join app.classes c on c.id=m.classe_id
    left join app.recus r on r.id=m.recu_id left join app.inscriptions i on i.id=r.inscription_id left join app.eleves e on e.id=i.eleve_id
    left join app.utilisateurs u on u.id=m.saisi_par
    where ${w.join(" and ")} order by m.date_mouvement desc, m.id desc limit 500`, p);
});
route("POST", "/mouvements", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const b = ctx.body;
  if (!["entree", "sortie", "ajustement"].includes(b.sens)) fail(400, "Type de mouvement invalide.");
  const qte = Number(b.quantite);
  if (!Number.isInteger(qte) || qte === 0 || (b.sens !== "ajustement" && qte < 0)) fail(400, "Quantité invalide.");
  const art = await one("select * from app.articles where id=$1", [b.article_id]);
  if (!art) fail(404, "Article introuvable.");
  const stock = await stockDe(art.id);
  if ((b.sens === "sortie" && qte > stock) || (b.sens === "ajustement" && stock + qte < 0)) fail(400, `Stock insuffisant : il reste ${stock} ${art.unite}(s) de ${art.nom}.`);
  const pu = Math.max(Number(b.prix_unitaire) || 0, 0);
  let depenseId = null;
  if (b.sens === "entree" && b.creer_depense && pu * qte > 0) {
    const d = await one(...insertSql("app.depenses", { date_depense: b.date_mouvement || new Date().toISOString().slice(0, 10), categorie: "fournitures",
      libelle: `Achat ${art.nom} × ${qte}`, montant: pu * qte, mode: MODES.includes(b.mode) ? b.mode : "especes", beneficiaire: b.destinataire || null,
      saisi_par: ctx.user.id, annee_id: await anneeCourante() }));
    depenseId = d.id;
  }
  const r = await one(...insertSql("app.mouvements_stock", { article_id: art.id, sens: b.sens, quantite: qte, prix_unitaire: pu,
    date_mouvement: b.date_mouvement || null, destinataire: b.destinataire || null, classe_id: b.classe_id || null, note: b.note || null,
    depense_id: depenseId, saisi_par: ctx.user.id }));
  if (b.sens === "entree" && pu > 0 && pu !== art.prix_achat) await q("update app.articles set prix_achat=$2 where id=$1", [art.id, pu]);
  await journal(ctx, "creation", "mouvement_stock", r.id, { article: art.nom, sens: b.sens, quantite: qte });
  return r;
});
route("DELETE", "/mouvements/:id", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const m = await one("select * from app.mouvements_stock where id=$1", [ctx.params.id]);
  if (!m) fail(404, "Mouvement introuvable.");
  if (m.sens === "vente") fail(400, "Une vente s'annule depuis son reçu.");
  if (m.sens === "entree" || (m.sens === "ajustement" && m.quantite > 0)) {
    const stock = await stockDe(m.article_id);
    if (stock - m.quantite < 0) fail(400, "Impossible : une partie de ce stock a déjà été sortie ou vendue.");
  }
  await q("delete from app.mouvements_stock where id=$1", [m.id]);
  await journal(ctx, "suppression", "mouvement_stock", m.id, { sens: m.sens, quantite: m.quantite });
  return { ok: true, depense_id: m.depense_id };
});

// Liste des fournitures demandées par classe (pour les parents) et besoins pour les kits.
route("GET", "/fournitures-classes", async (ctx) => {
  exige(ctx, "eleves.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  return q(`select f.*, c.nom as classe, c.ordre as classe_ordre, a.nom as article, a.unite, a.prix_vente,
      ${SQL_STOCK.replace(/a\.id/g, "f.article_id")} as stock,
      (select count(*) from app.inscriptions i where i.classe_id=c.id and i.statut='active') as effectif
    from app.fournitures_classe f join app.classes c on c.id=f.classe_id and c.annee_id=$1 left join app.articles a on a.id=f.article_id
    order by c.ordre, f.ordre, f.id`, [annee]);
});
route("PUT", "/classes/:id/fournitures", async (ctx) => {
  exige(ctx, "classes.ecrire");
  const items = (ctx.body.items || []).filter((x) => String(x.libelle || "").trim());
  const list = [["delete from app.fournitures_classe where classe_id=$1", [ctx.params.id]]];
  items.forEach((x, i) => list.push(["insert into app.fournitures_classe (classe_id, article_id, libelle, quantite, remarque, ordre) values ($1,$2,$3,$4,$5,$6)",
    [ctx.params.id, x.article_id || null, String(x.libelle).trim(), Math.max(1, Number(x.quantite) || 1), x.remarque || null, i + 1]]));
  await tx(list);
  await journal(ctx, "modification", "fournitures_classe", Number(ctx.params.id), { articles: items.length });
  return { ok: true, nombre: items.length };
});

route("POST", "/ventes", async (ctx) => {
  exige(ctx, "finances.encaisser");
  const b = ctx.body;
  requis(b, [["inscription_id", "L'élève"]]);
  if (!MODES.includes(b.mode || "especes")) fail(400, "Mode de paiement invalide.");
  const items = (b.articles || []).filter((x) => Number(x.quantite) > 0);
  if (!items.length) fail(400, "Ajoutez au moins un article.");
  const arts = await q("select a.*, " + SQL_STOCK + " as stock from app.articles a where a.id = any($1::int[])", [`{${items.map((x) => Number(x.article_id)).join(",")}}`]);
  const lignes = items.map((x) => {
    const a = arts.find((y) => y.id === Number(x.article_id));
    if (!a) fail(404, "Article introuvable.");
    const qte = Number(x.quantite), pu = Number(x.prix ?? a.prix_vente);
    if (!Number.isInteger(qte) || !Number.isInteger(pu) || pu <= 0) fail(400, `Prix ou quantité invalide pour ${a.nom}.`);
    const deja = items.filter((y) => Number(y.article_id) === a.id).reduce((t, y) => t + Number(y.quantite), 0);
    if (deja > a.stock) fail(400, `Stock insuffisant : il reste ${a.stock} ${a.unite}(s) de ${a.nom}.`);
    return { a, qte, pu };
  });
  const ins = await one("select i.id, a.libelle from app.inscriptions i join app.annees a on a.id=i.annee_id where i.id=$1", [b.inscription_id]);
  if (!ins) fail(404, "Inscription introuvable.");
  const prefixe = "R" + ins.libelle.replace(/^\d{2}(\d{2})-\d{2}(\d{2})$/, "$1$2");
  const total = lignes.reduce((t, l) => t + l.qte * l.pu, 0);
  const p = [b.inscription_id, b.date_paiement || null, b.mode || "especes", total, b.reference || null, b.note || null, ctx.user.id, prefixe];
  const vals = lignes.map((l) => { p.push(l.a.id, l.qte, l.pu, `${l.a.nom} × ${l.qte}`); const n = p.length; return `($${n - 3}::int, $${n - 2}::int, $${n - 1}::int, $${n}::text)`; });
  const r = await one(
    `with r as (
       insert into app.recus (numero, inscription_id, date_paiement, mode, montant, reference, note, encaisse_par)
       values ($8::text || '-' || lpad(nextval('app.recu_seq')::text, 5, '0'), $1::int, coalesce($2::date, current_date), $3::text, $4::int, $5::text, $6::text, $7::int) returning *),
     v(article_id, quantite, pu, libelle) as (values ${vals.join(",")}),
     l as (insert into app.paiements (recu_id, inscription_id, type, montant, libelle) select r.id, r.inscription_id, 'article', v.quantite * v.pu, v.libelle from r, v returning id),
     m as (insert into app.mouvements_stock (article_id, date_mouvement, sens, quantite, prix_unitaire, recu_id, saisi_par)
       select v.article_id, r.date_paiement, 'vente', v.quantite, v.pu, r.id, $7::int from r, v returning id)
     select r.id, r.numero, r.montant, (select count(*) from l) as lignes, (select count(*) from m) as mouvements from r`, p);
  await journal(ctx, "vente", "recu", r.id, { numero: r.numero, montant: r.montant });
  return r;
});

route("PUT", "/inscriptions/:id/fournitures-remises", async (ctx) => {
  exige(ctx, "finances.encaisser");
  const r = await one("update app.inscriptions set fournitures_remises=$2 where id=$1 returning id, fournitures_remises", [ctx.params.id, ctx.body.remis ? (ctx.body.date || new Date().toISOString().slice(0, 10)) : null]);
  if (!r) fail(404, "Inscription introuvable.");
  await journal(ctx, "modification", "inscription", r.id, { fournitures_remises: r.fournitures_remises });
  return r;
});

// ── Recettes diverses (hors élèves) ──
const COLS_REC = ["date_recette", "categorie", "libelle", "montant", "mode", "payeur", "reference", "note"];
route("GET", "/recettes", async (ctx) => {
  exige(ctx, "depenses.lire");
  const { du, au, categorie } = ctx.query;
  const where = ["1=1"]; const p = [];
  if (du) { p.push(du); where.push(`x.date_recette >= $${p.length}`); }
  if (au) { p.push(au); where.push(`x.date_recette <= $${p.length}`); }
  if (categorie) { p.push(categorie); where.push(`x.categorie = $${p.length}`); }
  const w = where.join(" and ");
  const [rows, cats, [tot]] = await tx([
    [`select x.*, u.prenom || ' ' || u.nom as saisi_par_nom from app.recettes x left join app.utilisateurs u on u.id=x.saisi_par where ${w} order by x.date_recette desc, x.id desc limit 500`, p],
    [`select categorie, sum(montant) as montant, count(*) as nombre from app.recettes x where ${w} group by 1 order by 2 desc`, p],
    [`select coalesce(sum(montant),0) as total, count(*) as nombre from app.recettes x where ${w}`, p],
  ]);
  return { rows, categories: cats, total: tot.total, nombre: tot.nombre };
});
route("POST", "/recettes", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const d = pick(ctx.body, COLS_REC);
  requis(d, [["libelle", "Le libellé"], ["montant", "Le montant"]]);
  if (!(Number(d.montant) > 0)) fail(400, "Le montant doit être positif.");
  d.saisi_par = ctx.user.id;
  d.annee_id = await anneeCourante(ctx.body.annee_id);
  const r = await one(...insertSql("app.recettes", d));
  await journal(ctx, "creation", "recette", r.id, { libelle: r.libelle, montant: r.montant });
  return r;
});
route("PUT", "/recettes/:id", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const av = await one("select montant from app.recettes where id=$1", [ctx.params.id]);
  const r = await one(...updateSql("app.recettes", ctx.params.id, pick(ctx.body, COLS_REC)));
  await journal(ctx, "modification", "recette", r.id, { libelle: r.libelle, montant: r.montant, avant: av?.montant });
  return r;
});
route("DELETE", "/recettes/:id", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const r = await one("delete from app.recettes where id=$1 returning id, libelle, montant", [ctx.params.id]);
  await journal(ctx, "suppression", "recette", Number(ctx.params.id), r);
  return { ok: true };
});

// ── Rapport financier sur une période ──
route("GET", "/rapport", async (ctx) => {
  exige(ctx, "finances.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  const a = await one("select * from app.annees where id=$1", [annee]);
  const debutAnnee = (await one(`select least($2::date, (select min(r.date_paiement) from app.recus r join app.inscriptions i on i.id=r.inscription_id where i.annee_id=$1))::text as d`, [annee, `${a.debut.slice(0, 4)}-07-01`])).d;
  const du = ctx.query.du || debutAnnee, au = ctx.query.au || new Date().toISOString().slice(0, 10);
  const voitDepenses = peut(ctx.user, "depenses.lire");
  const [parType, parMode, parMois, recettes, depenses, parClasse, [nb]] = await tx([
    [`select p.type, sum(p.montant) as montant, count(distinct r.id) as recus from app.paiements p join app.recus r on r.id=p.recu_id
      where not r.annule and r.date_paiement between $1 and $2 group by 1 order by 2 desc`, [du, au]],
    [`select r.mode, sum(r.montant) as montant, count(*) as nombre from app.recus r where not r.annule and r.date_paiement between $1 and $2 group by 1 order by 2 desc`, [du, au]],
    [`select to_char(d,'YYYY-MM') as mois,
        coalesce((select sum(montant) from app.recus r where not r.annule and date_trunc('month', r.date_paiement)=d and r.date_paiement between $1 and $2),0) as eleves,
        coalesce((select sum(montant) from app.recettes x where date_trunc('month', x.date_recette)=d and x.date_recette between $1 and $2),0) as autres,
        coalesce((select sum(montant) from app.depenses y where date_trunc('month', y.date_depense)=d and y.date_depense between $1 and $2),0) as depenses
      from generate_series(date_trunc('month', $1::date), date_trunc('month', $2::date), interval '1 month') d order by d`, [du, au]],
    [`select categorie, sum(montant) as montant, count(*) as nombre from app.recettes where date_recette between $1 and $2 group by 1 order by 2 desc`, [du, au]],
    [`select categorie, sum(montant) as montant, count(*) as nombre from app.depenses where date_depense between $1 and $2 group by 1 order by 2 desc`, [du, au]],
    [`select c.nom as classe, c.ordre, sum(r.montant) as montant from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.classes c on c.id=i.classe_id
      where not r.annule and r.date_paiement between $1 and $2 group by c.nom, c.ordre order by c.ordre`, [du, au]],
    [`select count(*) as recus, count(distinct inscription_id) as eleves from app.recus where not annule and date_paiement between $1 and $2`, [du, au]],
  ]);
  const imp = await one(`select coalesce(sum(reste),0) as total, count(*) filter (where reste > 0) as eleves from (${SQL_IMPAYES}) x`, [annee, au]);
  const totEleves = parMode.reduce((t, m) => t + m.montant, 0);
  const totAutres = recettes.reduce((t, m) => t + m.montant, 0);
  const totDep = voitDepenses ? depenses.reduce((t, m) => t + m.montant, 0) : null;
  return { du, au, debut_annee: debutAnnee, annee: a.libelle, par_type: parType, par_mode: parMode, par_mois: parMois.map((m) => voitDepenses ? m : { ...m, depenses: null }),
    recettes, depenses: voitDepenses ? depenses : [], par_classe: parClasse, nb,
    totaux: { eleves: totEleves, autres: totAutres, entrees: totEleves + totAutres, depenses: totDep, solde: totDep == null ? null : totEleves + totAutres - totDep },
    impayes: imp };
});

// ═══ PÉDAGOGIE ═════════════════════════════════════════════════════════════
const COLS_ENS = ["nom", "prenom", "sexe", "telephone", "email", "adresse", "specialite", "diplome", "date_embauche", "salaire", "statut", "observations"];
route("GET", "/enseignants", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  return q(`select e.*,
      (select string_agg(c.nom, ', ' order by c.ordre) from app.classes c where c.titulaire_id=e.id and c.annee_id=$1) as classes_titulaire,
      (select string_agg(distinct m.nom, ', ') from app.matieres m join app.classes c on c.id=m.classe_id and c.annee_id=$1 where m.enseignant_id=e.id) as matieres,
      (select count(*) from app.emploi_temps t join app.classes c on c.id=t.classe_id and c.annee_id=$1 where t.enseignant_id=e.id) as creneaux,
      (select c.id from app.classes c where c.titulaire_id=e.id and c.annee_id=$1 order by c.ordre limit 1) as classe_id,
      (select u.email from app.utilisateurs u where u.id=e.utilisateur_id) as compte
    from app.enseignants e order by e.statut, e.nom, e.prenom`, [annee]).then((rows) => peut(ctx.user, "finances.lire") ? rows : rows.map(({ salaire, ...x }) => x));
});
// École primaire : un enseignant titulaire par classe.
const affecterClasse = async (ensId, classeId) => {
  const annee = await anneeCourante();
  await q("update app.classes set titulaire_id=null where titulaire_id=$1 and annee_id=$2", [ensId, annee]);
  if (classeId) await q("update app.classes set titulaire_id=$1 where id=$2", [ensId, classeId]);
};
route("POST", "/enseignants", async (ctx) => {
  exige(ctx, "enseignants.ecrire");
  const d = pick(ctx.body, COLS_ENS);
  requis(d, [["nom", "Le nom"], ["prenom", "Le prénom"]]);
  d.nom = d.nom.trim().toUpperCase();
  const r = await one(...insertSql("app.enseignants", d));
  if ("classe_id" in ctx.body) await affecterClasse(r.id, ctx.body.classe_id);
  await journal(ctx, "creation", "enseignant", r.id, { nom: `${r.prenom} ${r.nom}` });
  return r;
});
route("PUT", "/enseignants/:id", async (ctx) => {
  exige(ctx, "enseignants.ecrire");
  const d = pick(ctx.body, COLS_ENS);
  if (d.nom) d.nom = d.nom.trim().toUpperCase();
  const r = Object.keys(d).length ? await one(...updateSql("app.enseignants", ctx.params.id, d)) : { id: Number(ctx.params.id) };
  if ("classe_id" in ctx.body) await affecterClasse(r.id, ctx.body.classe_id);
  await journal(ctx, "modification", "enseignant", r.id);
  return r;
});
route("DELETE", "/enseignants/:id", async (ctx) => {
  exige(ctx, "enseignants.ecrire");
  const id = ctx.params.id;
  await tx([
    ["update app.classes set titulaire_id=null where titulaire_id=$1", [id]],
    ["update app.matieres set enseignant_id=null where enseignant_id=$1", [id]],
    ["update app.emploi_temps set enseignant_id=null where enseignant_id=$1", [id]],
    ["delete from app.enseignants where id=$1", [id]],
  ]);
  await journal(ctx, "suppression", "enseignant", Number(id));
  return { ok: true };
});

// ── Matières ──
route("GET", "/classes/:id/matieres", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  await verifierClasse(ctx, ctx.params.id);
  return q(`select m.*, e.prenom || ' ' || e.nom as enseignant from app.matieres m left join app.enseignants e on e.id=m.enseignant_id
    where m.classe_id=$1 order by m.ordre, m.nom`, [ctx.params.id]);
});
route("POST", "/matieres", async (ctx) => {
  exige(ctx, "classes.ecrire");
  const d = pick(ctx.body, ["classe_id", "nom", "coefficient", "bareme", "ordre", "enseignant_id"]);
  requis(d, [["classe_id", "La classe"], ["nom", "Le nom de la matière"]]);
  return one(...insertSql("app.matieres", d));
});
route("PUT", "/matieres/:id", async (ctx) => {
  exige(ctx, "classes.ecrire");
  return one(...updateSql("app.matieres", ctx.params.id, pick(ctx.body, ["nom", "coefficient", "bareme", "ordre", "enseignant_id"])));
});
route("DELETE", "/matieres/:id", async (ctx) => {
  exige(ctx, "classes.ecrire");
  const n = await one("select count(*) as n from app.evaluations where matiere_id=$1", [ctx.params.id]);
  if (n.n > 0) fail(400, `Impossible : ${n.n} évaluation(s) existent pour cette matière.`);
  await q("delete from app.matieres where id=$1", [ctx.params.id]);
  return { ok: true };
});

// ── Évaluations & notes ──
const verifierEvaluation = async (ctx, id) => {
  if (!(await classesAutorisees(ctx))) return;
  const ev = await one("select classe_id from app.evaluations where id=$1", [id]);
  if (ev) await verifierClasse(ctx, ev.classe_id);
};
const verifierAbsence = async (ctx, id) => {
  if (!(await classesAutorisees(ctx))) return;
  const a = await one("select i.classe_id from app.absences a join app.inscriptions i on i.id=a.inscription_id where a.id=$1", [id]);
  if (a) await verifierClasse(ctx, a.classe_id);
};
route("GET", "/evaluations", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  const { classe_id, trimestre } = ctx.query;
  requis(ctx.query, [["classe_id", "La classe"]]);
  const p = [classe_id]; let w = "ev.classe_id=$1";
  if (trimestre) { p.push(trimestre); w += " and ev.trimestre=$2"; }
  return q(`select ev.*, m.nom as matiere, m.ordre as matiere_ordre,
      (select count(*) from app.notes n where n.evaluation_id=ev.id and (n.note is not null or n.absent)) as saisies,
      (select round(avg(n.note), 2) from app.notes n where n.evaluation_id=ev.id and n.note is not null) as moyenne,
      (select count(*) from app.inscriptions i where i.classe_id=ev.classe_id and i.statut='active') as effectif
    from app.evaluations ev join app.matieres m on m.id=ev.matiere_id where ${w}
    order by ev.trimestre, m.ordre, ev.date_eval, ev.id`, p);
});
route("POST", "/evaluations", async (ctx) => {
  exige(ctx, "pedagogie.ecrire");
  const d = pick(ctx.body, ["classe_id", "matiere_id", "trimestre", "type", "libelle", "date_eval", "bareme"]);
  requis(d, [["classe_id", "La classe"], ["matiere_id", "La matière"], ["trimestre", "Le trimestre"]]);
  if (!d.bareme) d.bareme = (await one("select bareme from app.matieres where id=$1", [d.matiere_id])).bareme;
  d.created_by = ctx.user.id;
  const r = await one(...insertSql("app.evaluations", d));
  await journal(ctx, "creation", "evaluation", r.id, { type: r.type, trimestre: r.trimestre });
  return r;
});
route("PUT", "/evaluations/:id", async (ctx) => {
  exige(ctx, "pedagogie.ecrire");
  await verifierEvaluation(ctx, ctx.params.id);
  return one(...updateSql("app.evaluations", ctx.params.id, pick(ctx.body, ["matiere_id", "trimestre", "type", "libelle", "date_eval", "bareme"])));
});
route("DELETE", "/evaluations/:id", async (ctx) => {
  exige(ctx, "pedagogie.ecrire");
  await verifierEvaluation(ctx, ctx.params.id);
  const ev = await one("select e.libelle, c.nom as classe from app.evaluations e left join app.classes c on c.id=e.classe_id where e.id=$1", [ctx.params.id]).catch(() => null);
  await q("delete from app.evaluations where id=$1", [ctx.params.id]);
  await journal(ctx, "suppression", "evaluation", Number(ctx.params.id), ev ? { libelle: `${ev.libelle}${ev.classe ? " (" + ev.classe + ")" : ""}` } : null);
  return { ok: true };
});
route("GET", "/evaluations/:id/notes", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  await verifierEvaluation(ctx, ctx.params.id);
  const [[ev], rows] = await tx([
    [`select ev.*, m.nom as matiere, c.nom as classe from app.evaluations ev join app.matieres m on m.id=ev.matiere_id join app.classes c on c.id=ev.classe_id where ev.id=$1`, [ctx.params.id]],
    [`select i.id as inscription_id, e.id as eleve_id, e.matricule, e.nom, e.prenom, e.sexe, n.note, coalesce(n.absent,false) as absent
      from app.inscriptions i join app.eleves e on e.id=i.eleve_id
      left join app.notes n on n.inscription_id=i.id and n.evaluation_id=$1
      where i.classe_id=(select classe_id from app.evaluations where id=$1) and i.statut='active' order by e.nom, e.prenom`, [ctx.params.id]],
  ]);
  if (!ev) fail(404, "Évaluation introuvable.");
  return { evaluation: ev, notes: rows };
});
route("PUT", "/evaluations/:id/notes", async (ctx) => {
  exige(ctx, "pedagogie.ecrire");
  await verifierEvaluation(ctx, ctx.params.id);
  const ev = await one("select bareme from app.evaluations where id=$1", [ctx.params.id]);
  if (!ev) fail(404, "Évaluation introuvable.");
  const list = (ctx.body.notes || []).map((n) => {
    const note = n.note === "" || n.note == null ? null : Number(String(n.note).replace(",", "."));
    if (note != null && (isNaN(note) || note < 0 || note > ev.bareme)) fail(400, `Note invalide (${n.note}) : elle doit être entre 0 et ${ev.bareme}.`);
    return [`insert into app.notes (evaluation_id, inscription_id, note, absent, updated_at) values ($1,$2,$3,$4,now())
      on conflict (evaluation_id, inscription_id) do update set note=excluded.note, absent=excluded.absent, updated_at=now()`,
      [ctx.params.id, n.inscription_id, note, !!n.absent]];
  });
  if (list.length) await tx(list);
  await journal(ctx, "saisie_notes", "evaluation", Number(ctx.params.id), { nombre: list.length });
  return { ok: true, nombre: list.length };
});

// ── Bulletins ──
const TRIMESTRES = { 1: [10, 11, 12], 2: [1, 2, 3], 3: [4, 5, 6] };
const mention = (m, b) => {
  const x = (m / b) * 20;
  return x >= 16 ? "Excellent travail" : x >= 14 ? "Très bien" : x >= 12 ? "Bien" : x >= 10 ? "Assez bien" : x >= 8 ? "Passable, peut mieux faire" : "Insuffisant, doit redoubler d'efforts";
};
route("GET", "/bulletins", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  const { classe_id } = ctx.query;
  const tri = Number(ctx.query.trimestre) || 1;
  requis(ctx.query, [["classe_id", "La classe"]]);
  const [[classe], matieres, eleves, notes, apps, abs] = await tx([
    [`select c.*, a.libelle as annee, a.debut, a.fin, t.prenom || ' ' || t.nom as titulaire from app.classes c join app.annees a on a.id=c.annee_id left join app.enseignants t on t.id=c.titulaire_id where c.id=$1`, [classe_id]],
    [`select m.*, e.prenom || ' ' || e.nom as enseignant from app.matieres m left join app.enseignants e on e.id=m.enseignant_id where m.classe_id=$1 order by m.ordre, m.nom`, [classe_id]],
    [`select i.id as inscription_id, e.id as eleve_id, e.matricule, e.nom, e.prenom, e.sexe, e.date_naissance, e.lieu_naissance
      from app.inscriptions i join app.eleves e on e.id=i.eleve_id where i.classe_id=$1 and i.statut='active' order by e.nom, e.prenom`, [classe_id]],
    [`select ev.matiere_id, ev.type, ev.bareme, n.inscription_id, n.note from app.notes n join app.evaluations ev on ev.id=n.evaluation_id
      where ev.classe_id=$1 and ev.trimestre=$2 and n.note is not null`, [classe_id, tri]],
    [`select ap.* from app.appreciations ap join app.inscriptions i on i.id=ap.inscription_id where i.classe_id=$1 and ap.trimestre=$2`, [classe_id, tri]],
    [`select ab.inscription_id, count(*) filter (where ab.type='absence') as absences, count(*) filter (where ab.type='absence' and ab.justifiee) as justifiees, count(*) filter (where ab.type='retard') as retards
      from app.absences ab join app.inscriptions i on i.id=ab.inscription_id
      where i.classe_id=$1 and extract(month from ab.date_absence) = any($2::int[]) group by 1`, [classe_id, `{${TRIMESTRES[tri].join(",")}}`]],
  ]);
  if (!classe) fail(404, "Classe introuvable.");
  const B = classe.bareme;
  const res = eleves.map((el) => {
    let somme = 0, coefs = 0;
    const lignes = matieres.map((m) => {
      const ns = notes.filter((n) => n.inscription_id === el.inscription_id && n.matiere_id === m.id);
      // Composition comptant double par rapport aux devoirs
      let tot = 0, poids = 0;
      ns.forEach((n) => { const w = n.type === "composition" ? 2 : 1; tot += (n.note / n.bareme) * m.bareme * w; poids += w; });
      const moy = poids ? tot / poids : null;
      if (moy != null) { somme += (moy / m.bareme) * B * Number(m.coefficient); coefs += Number(m.coefficient); }
      return { matiere_id: m.id, matiere: m.nom, coefficient: Number(m.coefficient), bareme: m.bareme, moyenne: moy, enseignant: m.enseignant };
    });
    const ap = apps.find((a) => a.inscription_id === el.inscription_id);
    const ab = abs.find((a) => a.inscription_id === el.inscription_id);
    return { ...el, lignes, moyenne: coefs ? somme / coefs : null, observation: ap?.observation || null, decision: ap?.decision || null,
      absences: ab?.absences || 0, absences_justifiees: ab?.justifiees || 0, retards: ab?.retards || 0 };
  });
  const classes = res.filter((r) => r.moyenne != null).sort((a, b) => b.moyenne - a.moyenne);
  classes.forEach((r, i) => { r.rang = i > 0 && Math.abs(r.moyenne - classes[i - 1].moyenne) < 1e-9 ? classes[i - 1].rang : i + 1; r.mention = mention(r.moyenne, B); });
  const moys = classes.map((r) => r.moyenne);
  // moyennes de classe par matière
  const parMatiere = matieres.map((m, k) => { const v = res.map((r) => r.lignes[k].moyenne).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
  return {
    classe, trimestre: tri, matieres, eleves: res,
    stats: { effectif: res.length, classes: classes.length, moyenne: moys.length ? moys.reduce((a, b) => a + b, 0) / moys.length : null,
      max: moys.length ? Math.max(...moys) : null, min: moys.length ? Math.min(...moys) : null,
      admis: moys.filter((m) => m >= B / 2).length, par_matiere: parMatiere },
  };
});
route("PUT", "/appreciations", async (ctx) => {
  exige(ctx, "pedagogie.ecrire");
  const { inscription_id, trimestre, observation, decision } = ctx.body;
  requis(ctx.body, [["inscription_id", "L'élève"], ["trimestre", "Le trimestre"]]);
  await q(`insert into app.appreciations (inscription_id, trimestre, observation, decision) values ($1,$2,$3,$4)
    on conflict (inscription_id, trimestre) do update set observation=excluded.observation, decision=excluded.decision`,
    [inscription_id, trimestre, observation || null, decision || null]);
  return { ok: true };
});

// ── Absences ──
route("GET", "/appel", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  requis(ctx.query, [["classe_id", "La classe"]]);
  const jour = ctx.query.date || new Date().toISOString().slice(0, 10);
  const rows = await q(`select i.id as inscription_id, e.id as eleve_id, e.matricule, e.nom, e.prenom, e.sexe,
      coalesce(e.mere_telephone, e.pere_telephone, e.tuteur_telephone) as telephone,
      (select json_agg(json_build_object('id', a.id, 'type', a.type, 'moment', a.moment, 'justifiee', a.justifiee, 'motif', a.motif)) from app.absences a where a.inscription_id=i.id and a.date_absence=$2) as marques
    from app.inscriptions i join app.eleves e on e.id=i.eleve_id where i.classe_id=$1 and i.statut='active' order by e.nom, e.prenom`, [ctx.query.classe_id, jour]);
  return { date: jour, rows };
});
route("PUT", "/appel", async (ctx) => {
  exige(ctx, "absences.ecrire");
  const { classe_id, date: jour, items } = ctx.body;
  requis(ctx.body, [["classe_id", "La classe"], ["date", "La date"]]);
  const list = [[`delete from app.absences a using app.inscriptions i where a.inscription_id=i.id and i.classe_id=$1 and a.date_absence=$2`, [classe_id, jour]]];
  (items || []).filter((it) => it.statut === "absent" || it.statut === "retard").forEach((it) => list.push([
    `insert into app.absences (inscription_id, date_absence, moment, type, justifiee, motif, saisi_par) values ($1,$2,$3,$4,$5,$6,$7)`,
    [it.inscription_id, jour, it.moment || "journee", it.statut === "retard" ? "retard" : "absence", !!it.justifiee, it.motif || null, ctx.user.id]]));
  await tx(list);
  await journal(ctx, "appel", "classe", Number(classe_id), { date: jour, absents: list.length - 1 });
  return { ok: true, marques: list.length - 1 };
});
route("GET", "/absences", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  const { du, au, classe_id, eleve_id } = ctx.query;
  const p = [annee]; const w = ["i.annee_id=$1"];
  if (du) { p.push(du); w.push(`a.date_absence >= $${p.length}`); }
  if (au) { p.push(au); w.push(`a.date_absence <= $${p.length}`); }
  if (classe_id) { p.push(classe_id); w.push(`i.classe_id=$${p.length}`); }
  if (eleve_id) { p.push(eleve_id); w.push(`i.eleve_id=$${p.length}`); }
  const okCl = await classesAutorisees(ctx);
  if (okCl) { p.push(`{${okCl.join(",") || 0}}`); w.push(`i.classe_id = any($${p.length}::int[])`); }
  const base = `from app.absences a join app.inscriptions i on i.id=a.inscription_id join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id where ${w.join(" and ")}`;
  const [rows, parEleve, [tot]] = await tx([
    [`select a.*, e.id as eleve_id, e.nom, e.prenom, e.sexe, e.matricule, c.nom as classe, c.cycle ${base} order by a.date_absence desc, e.nom limit 500`, p],
    [`select e.id as eleve_id, e.nom, e.prenom, e.sexe, c.nom as classe, c.cycle, count(*) filter (where a.type='absence') as absences,
        count(*) filter (where a.type='absence' and not a.justifiee) as non_justifiees, count(*) filter (where a.type='retard') as retards,
        coalesce(e.mere_telephone, e.pere_telephone, e.tuteur_telephone) as telephone
      ${base} group by e.id, c.nom, c.cycle order by 7 desc, 6 desc limit 30`, p],
    [`select count(*) filter (where a.type='absence') as absences, count(*) filter (where a.type='absence' and not a.justifiee) as non_justifiees, count(*) filter (where a.type='retard') as retards ${base}`, p],
  ]);
  return { rows, par_eleve: parEleve, ...tot };
});
route("PUT", "/absences/:id", async (ctx) => {
  exige(ctx, "absences.ecrire");
  await verifierAbsence(ctx, ctx.params.id);
  return one(...updateSql("app.absences", ctx.params.id, pick(ctx.body, ["justifiee", "motif", "moment"])));
});
route("DELETE", "/absences/:id", async (ctx) => {
  exige(ctx, "absences.ecrire");
  await verifierAbsence(ctx, ctx.params.id);
  await q("delete from app.absences where id=$1", [ctx.params.id]);
  return { ok: true };
});

// ── Emploi du temps ──
route("GET", "/emploi", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  const p = [annee]; let w = "c.annee_id=$1";
  if (ctx.query.classe_id) { p.push(ctx.query.classe_id); w += ` and t.classe_id=$${p.length}`; }
  const okCl = await classesAutorisees(ctx);
  if (okCl) { p.push(`{${okCl.join(",") || 0}}`); w += ` and t.classe_id = any($${p.length}::int[])`; }
  if (ctx.query.enseignant_id) { p.push(ctx.query.enseignant_id); w += ` and t.enseignant_id=$${p.length}`; }
  return q(`select t.id, t.classe_id, t.jour, to_char(t.heure_debut,'HH24:MI') as heure_debut, to_char(t.heure_fin,'HH24:MI') as heure_fin,
      t.matiere_id, t.libelle, t.enseignant_id, t.salle, m.nom as matiere, c.nom as classe, e.prenom || ' ' || e.nom as enseignant
    from app.emploi_temps t join app.classes c on c.id=t.classe_id left join app.matieres m on m.id=t.matiere_id left join app.enseignants e on e.id=t.enseignant_id
    where ${w} order by t.jour, t.heure_debut, t.id`, p);
});
// Import des emplois du temps officiels : remplace matières (sans évaluation) et créneaux des classes concernées.
route("POST", "/emploi/importer", async (ctx) => {
  exige(ctx, "classes.ecrire");
  const { slots, mats } = ctx.body || {};
  const annee = await anneeCourante();
  const classes = await q("select id, nom, bareme from app.classes where annee_id=$1", [annee]);
  let n = 0, m = 0;
  for (const c of classes) {
    if (!slots?.[c.nom]) continue;
    await tx([
      ["delete from app.emploi_temps where classe_id=$1", [c.id]],
      ["delete from app.matieres x where x.classe_id=$1 and not exists (select 1 from app.evaluations e where e.matiere_id=x.id)", [c.id]],
    ]);
    const exist = await q("select id, nom from app.matieres where classe_id=$1", [c.id]);
    const ids = Object.fromEntries(exist.map((x) => [x.nom, x.id]));
    for (const [i, nom] of (mats[c.nom] || []).entries()) {
      if (ids[nom]) continue;
      ids[nom] = (await one("insert into app.matieres (classe_id, nom, coefficient, bareme, ordre) values ($1,$2,1,$3,$4) returning id", [c.id, nom, c.bareme || 10, i + 1])).id; m++;
    }
    const rows = slots[c.nom].filter((r) => r[0] >= 1 && r[0] <= 6);
    for (let k = 0; k < rows.length; k += 40) {
      const part = rows.slice(k, k + 40), p = [c.id];
      const vals = part.map((r) => { p.push(r[0], r[1], r[2], r[4] ? ids[r[4]] ?? null : null, String(r[3]).slice(0, 200)); const b = p.length; return `($1,$${b - 4}::int,$${b - 3}::time,$${b - 2}::time,$${b - 1}::int,$${b})`; });
      await q(`insert into app.emploi_temps (classe_id, jour, heure_debut, heure_fin, matiere_id, libelle) values ${vals.join(",")}`, p);
      n += part.length;
    }
  }
  await journal(ctx, "import", "emploi_temps", null, { creneaux: n, matieres: m });
  return { ok: true, creneaux: n, matieres: m };
});
const COLS_EDT = ["classe_id", "jour", "heure_debut", "heure_fin", "matiere_id", "libelle", "enseignant_id", "salle"];
const conflitEdt = async (d, id) => {
  if (!d.enseignant_id) return;
  const c = await one(`select c.nom from app.emploi_temps t join app.classes c on c.id=t.classe_id
    where t.enseignant_id=$1 and t.jour=$2 and t.heure_debut < $4::time and t.heure_fin > $3::time and t.id <> coalesce($5, 0) limit 1`,
    [d.enseignant_id, d.jour, d.heure_debut, d.heure_fin, id || null]);
  if (c) fail(400, `Cet enseignant a déjà cours en ${c.nom} sur ce créneau.`);
};
route("POST", "/emploi", async (ctx) => {
  exige(ctx, "classes.ecrire");
  const d = pick(ctx.body, COLS_EDT);
  requis(d, [["classe_id", "La classe"], ["jour", "Le jour"], ["heure_debut", "L'heure de début"], ["heure_fin", "L'heure de fin"]]);
  await conflitEdt(d);
  return one(...insertSql("app.emploi_temps", d));
});
route("PUT", "/emploi/:id", async (ctx) => {
  exige(ctx, "classes.ecrire");
  const d = pick(ctx.body, COLS_EDT);
  await conflitEdt({ ...d }, Number(ctx.params.id));
  return one(...updateSql("app.emploi_temps", ctx.params.id, d));
});
route("DELETE", "/emploi/:id", async (ctx) => {
  exige(ctx, "classes.ecrire");
  await q("delete from app.emploi_temps where id=$1", [ctx.params.id]);
  return { ok: true };
});

// ── Utilisateurs (admin) ──────────────────────────────────────────────────
route("GET", "/droits", async (ctx) => {
  exige(ctx, "utilisateurs");
  const R = tousLesRoles();
  return { codes: CODES_DROITS, roles: Object.fromEntries(Object.entries(R).map(([k, x]) => [k, x.droits])), liste: Object.values(R),
    nb: Object.fromEntries((await q("select role, count(*) as n from app.utilisateurs group by role")).map((x) => [x.role, x.n])) };
});
const slug = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
route("POST", "/roles", async (ctx) => {
  exige(ctx, "utilisateurs");
  requis(ctx.body, [["libelle", "Le nom du rôle"]]);
  const code = slug(ctx.body.libelle);
  if (!code || DROITS[code] || ROLES_PERSO[code]) fail(400, "Un rôle porte déjà ce nom.");
  await q("insert into app.roles (code, libelle, droits, classe_seule) values ($1,$2,$3::jsonb,$4)", [code, ctx.body.libelle.trim(), droitsValides(ctx.body.droits) || "[]", !!ctx.body.classe_seule]);
  await chargerRoles(true);
  await journal(ctx, "creation", "role", null, { code, libelle: ctx.body.libelle });
  return tousLesRoles()[code];
});
route("PUT", "/roles/:code", async (ctx) => {
  exige(ctx, "utilisateurs");
  const code = ctx.params.code;
  if (code === "admin") fail(400, "Le rôle Administrateur a toujours tous les droits.");
  const R = tousLesRoles()[code];
  if (!R) fail(404, "Rôle introuvable.");
  await q(`insert into app.roles (code, libelle, droits, classe_seule) values ($1,$2,$3::jsonb,$4)
    on conflict (code) do update set libelle=excluded.libelle, droits=excluded.droits, classe_seule=excluded.classe_seule`,
    [code, (ctx.body.libelle || R.libelle).trim(), droitsValides(ctx.body.droits ?? R.droits), ctx.body.classe_seule ?? R.classe_seule]);
  await chargerRoles(true);
  await journal(ctx, "modification", "role", null, { code });
  return tousLesRoles()[code];
});
route("DELETE", "/roles/:code", async (ctx) => {
  exige(ctx, "utilisateurs");
  const code = ctx.params.code;
  const n = await one("select count(*) as n from app.utilisateurs where role=$1", [code]);
  if (n.n > 0) fail(400, `Ce rôle est utilisé par ${n.n} compte(s). Changez-leur de rôle d'abord.`);
  await q("delete from app.roles where code=$1", [code]);
  await chargerRoles(true);
  await journal(ctx, "suppression", "role", null, { code });
  return { ok: true, systeme: !!DROITS[code] };
});
const droitsValides = (x) => (Array.isArray(x) ? JSON.stringify([...new Set(x.filter((c) => CODES_DROITS.includes(c)))]) : null);
// Compte enseignant : on choisit directement sa classe ; la fiche enseignant est créée et liée automatiquement.
const classePourCompte = async (userId, classeId) => {
  let e = await one("select id from app.enseignants where utilisateur_id=$1", [userId]);
  if (!e && !classeId) return;
  if (!e) {
    const u = await one("select nom, prenom, email from app.utilisateurs where id=$1", [userId]);
    e = await one("insert into app.enseignants (nom, prenom, email, statut, utilisateur_id) values (upper($1), $2, $3, 'actif', $4) returning id", [u.nom, u.prenom, u.email, userId]);
  }
  await affecterClasse(e.id, classeId || null);
};
const lierEnseignant = async (userId, ensId) => {
  await q("update app.enseignants set utilisateur_id=null where utilisateur_id=$1", [userId]);
  if (ensId) await q("update app.enseignants set utilisateur_id=$1 where id=$2", [userId, ensId]);
};
route("GET", "/utilisateurs", async (ctx) => {
  exige(ctx, "utilisateurs");
  return q(`select ${USER_COLS.split(", ").map((c) => "u." + c).join(", ")}, e.id as enseignant_id, e.prenom || ' ' || e.nom as enseignant,
      (select string_agg(c.nom, ', ' order by c.ordre) from app.classes c join app.annees a on a.id=c.annee_id and a.active where c.titulaire_id=e.id) as classes,
      (select c.id from app.classes c join app.annees a on a.id=c.annee_id and a.active where c.titulaire_id=e.id order by c.ordre limit 1) as classe_id
    from app.utilisateurs u left join app.enseignants e on e.utilisateur_id=u.id order by u.nom, u.prenom`);
});

route("POST", "/utilisateurs", async (ctx) => {
  exige(ctx, "utilisateurs");
  const b = ctx.body;
  requis(b, [["nom", "Le nom"], ["prenom", "Le prénom"], ["email", "L'email"], ["mot_de_passe", "Le mot de passe"], ["role", "Le rôle"]]);
  if (!tousLesRoles()[b.role]) fail(400, "Rôle inconnu.");
  if (b.mot_de_passe.length < 8) fail(400, "Le mot de passe doit faire au moins 8 caractères.");
  const r = await one(`insert into app.utilisateurs (nom, prenom, email, mot_de_passe, role, droits, classe_seule)
    values ($1,$2,lower($3),crypt($4, gen_salt('bf')),$5,$6::jsonb,$7) returning ${USER_COLS}`, [b.nom.trim(), b.prenom.trim(), b.email.trim(), b.mot_de_passe, b.role, droitsValides(b.droits), !!b.classe_seule]);
  if (b.enseignant_id) await lierEnseignant(r.id, b.enseignant_id);
  if ("classe_id" in b) await classePourCompte(r.id, b.classe_id);
  await journal(ctx, "creation", "utilisateur", r.id, { email: r.email, role: r.role });
  return r;
});

route("PUT", "/utilisateurs/:id", async (ctx) => {
  exige(ctx, "utilisateurs");
  const d = pick(ctx.body, ["nom", "prenom", "email", "role", "actif", "classe_seule"]);
  if (d.role && !tousLesRoles()[d.role]) fail(400, "Rôle inconnu.");
  if ("droits" in ctx.body) d.droits = droitsValides(ctx.body.droits);
  if (Number(ctx.params.id) === ctx.user.id && (d.actif === false || (d.role && d.role !== "admin")))
    fail(400, "Vous ne pouvez pas retirer vos propres droits d'administrateur.");
  const list = [];
  if (Object.keys(d).length) list.push(updateSql("app.utilisateurs", ctx.params.id, d));
  if (ctx.body.mot_de_passe) {
    if (ctx.body.mot_de_passe.length < 8) fail(400, "Le mot de passe doit faire au moins 8 caractères.");
    list.push(["update app.utilisateurs set mot_de_passe=crypt($1, gen_salt('bf')) where id=$2", [ctx.body.mot_de_passe, ctx.params.id]]);
  }
  if (list.length) await tx(list);
  if ("enseignant_id" in ctx.body) await lierEnseignant(Number(ctx.params.id), ctx.body.enseignant_id);
  if ("classe_id" in ctx.body) await classePourCompte(Number(ctx.params.id), ctx.body.classe_id);
  const cible = await one("select email from app.utilisateurs where id=$1", [ctx.params.id]);
  await journal(ctx, "modification", "utilisateur", Number(ctx.params.id), { ...d, email: cible?.email, droits: "droits" in ctx.body ? true : undefined, mot_de_passe: ctx.body.mot_de_passe ? "réinitialisé" : undefined });
  return one(`select ${USER_COLS} from app.utilisateurs where id=$1`, [ctx.params.id]);
});

// ── Journal ───────────────────────────────────────────────────────────────
route("GET", "/alertes", async (ctx) => {
  if (!voitGardien(ctx.user)) fail(403, "Le Gardien est réservé à la direction.");
  await bilanVeille().catch(() => {});
  const lim = Math.min(Number(ctx.query.limit) || 50, 200);
  const [rows, [vu]] = await tx([
    ["select a.*, (a.auteur_id = $2) as moi from app.alertes a order by a.created_at desc limit $1", [lim, ctx.user.id]],
    ["select vu_jusqua from app.alertes_vues where utilisateur_id=$1", [ctx.user.id]],
  ]);
  const depuis = vu?.vu_jusqua || "1970-01-01";
  const n = await one("select count(*) as n from app.alertes where created_at > $1 and coalesce(auteur_id,0) <> $2", [depuis, ctx.user.id]);
  return { rows, non_lues: Number(n.n), vu_jusqua: vu?.vu_jusqua || null };
});
route("POST", "/alertes/vues", async (ctx) => {
  if (!voitGardien(ctx.user)) fail(403, "Le Gardien est réservé à la direction.");
  await q("insert into app.alertes_vues (utilisateur_id, vu_jusqua) values ($1, now()) on conflict (utilisateur_id) do update set vu_jusqua=now()", [ctx.user.id]);
  return { ok: true };
});
route("GET", "/journal", async (ctx) => {
  exige(ctx, "journal.lire");
  return q(`select j.*, u.prenom || ' ' || u.nom as utilisateur from app.journal j
    left join app.utilisateurs u on u.id=j.utilisateur_id order by j.created_at desc limit $1`, [Math.min(Number(ctx.query.limit) || 100, 500)]);
});

// ── Santé ─────────────────────────────────────────────────────────────────
route("GET", "/", async () => {
  const [[base], [a]] = await tx([
    ["select (select count(*) from app.eleves) as eleves, (select count(*) from app.classes) as classes, now() as heure"],
    ["select libelle from app.annees where active"],
  ]);
  return { ok: true, service: "ecole-gestion api v2", annee: a?.libelle, base };
}, { public: true });

// ═══════════════════════════════════════════════════════════════════════════
export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api(\/v2)?/, "") || "/";
    try {
      for (const r of routes) {
        if (r.method !== request.method) continue;
        const m = path.match(r.re);
        if (!m) continue;
        const ctx = {
          params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])),
          query: Object.fromEntries(url.searchParams),
          body: ["POST", "PUT"].includes(request.method) ? await request.json().catch(() => ({})) : {},
        };
        if (!r.pub) {
          const t = await readToken((request.headers.get("authorization") || "").replace(/^Bearer /, ""));
          if (!t) fail(401, "Session expirée, reconnectez-vous.");
          ctx.user = await one(`select ${USER_COLS} from app.utilisateurs where id=$1 and actif`, [t.id]);
          if (!ctx.user) fail(401, "Compte désactivé.");
          await chargerRoles();
          if (espaceProf(ctx.user) && !ESPACE_PROF.has(`${r.method} ${r.pattern}`)) fail(403, "L'espace enseignant donne accès seulement à votre classe : élèves, notes, absences et emploi du temps.");
          await verifierClasse(ctx, ctx.query.classe_id ?? ctx.body?.classe_id);
        }
        return json(await r.handler(ctx));
      }
      return json({ error: "Route inconnue." }, 404);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      return json({ error: e.message || "Erreur serveur." }, e.status || 500);
    }
  },
};
