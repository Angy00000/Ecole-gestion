// ═══════════════════════════════════════════════════════════════════════════
//  Ecole-gestion — Archives officielles (NINEA, autorisation, RCCM, statuts…)
//  Petite fonction Neon séparée de l'API v2 : mêmes sessions, même base.
//  Appelée via /api/archives/* (voir vercel.json).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from "node:crypto";

// ── SQL (endpoint HTTP Neon, comme l'API v2) ──
const CONN = process.env.DATABASE_URL;
const HOST = new URL(CONN).hostname;
const PARSE = { 16: (v) => v === "t", 20: Number, 21: Number, 23: Number, 700: Number, 701: Number, 1700: Number, 114: JSON.parse, 3802: JSON.parse };
const toParam = (p) => (p === undefined || p === null ? null : typeof p === "object" ? JSON.stringify(p) : String(p));
const mapRows = (b) => (b.rows || []).map((row) => {
  const o = {};
  for (const { name, dataTypeID } of b.fields || []) { const v = row[name]; o[name] = v == null ? null : PARSE[dataTypeID] ? PARSE[dataTypeID](v) : v; }
  return o;
});
const post = async (body) => {
  const r = await fetch(`https://${HOST}/sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Neon-Connection-String": CONN, "Neon-Raw-Text-Output": "true" },
    body: JSON.stringify(body),
  });
  const b = await r.json();
  if (!r.ok) throw new HttpError(400, /invalid input syntax for type date/i.test(b.message || "") ? "Date invalide." : b.message || `Erreur base ${r.status}`);
  return b;
};
const q = async (query, params = []) => mapRows(await post({ query, params: params.map(toParam) }));
const one = async (query, params) => (await q(query, params))[0] || null;
const tx = async (list) => (await post({ queries: list.map(([query, params = []]) => ({ query, params: params.map(toParam) })) })).results.map(mapRows);

// ── Réponses ──
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS } });

// ── Sessions : mêmes jetons signés que l'API v2 ──
let SECRET;
const secret = async () => (SECRET ||= (await one("select value from public.app_secret where key='auth'")).value);
const hmac = (p, k) => crypto.createHmac("sha256", k).update(p).digest("base64url");
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
// Accès réservé à qui peut modifier l'établissement (administration, direction, ou rôle qui a ce droit).
const DROIT = "etablissement.ecrire";
const DROITS_DIRECTION = ["direction"];
const autorise = async (u) => {
  if (u.role === "admin") return true;
  let droits = Array.isArray(u.droits) ? u.droits : null;
  if (!droits) {
    const r = await one("select droits from app.roles where code=$1", [u.role]).catch(() => null);
    droits = Array.isArray(r?.droits) ? r.droits : DROITS_DIRECTION.includes(u.role) ? [DROIT] : [];
  }
  return droits.some((d) => d === "*" || d === DROIT);
};

// ── Journal et Gardien (mêmes tables que l'API v2) ──
const qui = (u) => `${u.prenom || ""} ${u.nom || ""}`.trim() || "quelqu'un";
const journal = (u, action, id, details) =>
  q("insert into app.journal (utilisateur_id, action, entite, entite_id, details) values ($1,$2,'archive',$3,$4)", [u.id, action, id, details || null]).catch(() => {});
const alerter = (u, titre, message) =>
  q("insert into app.alertes (kind, niveau, titre, message, lien, auteur_id, auteur, cle) values ('archive_supprimee','grave',$1,$2,'/archives',$3,$4,null) on conflict (cle) do nothing",
    [titre.slice(0, 120), message.slice(0, 600), u.id, qui(u)]).catch(() => {});

// ── Validation ──
const TYPES = ["ninea", "autorisation", "rccm", "statuts", "foncier", "fiscal", "social", "assurance", "contrat", "diplome", "autre"];
const COLS = ["type", "titre", "reference", "organisme", "date_delivrance", "date_expiration", "note"];
const FICHIER_MAX = 3_500_000; // ≈ 2,6 Mo une fois décodé (reste sous les limites du proxy Vercel)
const LISTE = `a.id, a.type, a.titre, a.reference, a.organisme, a.date_delivrance, a.date_expiration, a.note,
  a.created_at, a.updated_at, u.prenom || ' ' || u.nom as ajoute_par_nom`;
const valide = (body = {}) => {
  const d = {};
  for (const k of COLS) if (k in body) d[k] = body[k] === "" ? null : body[k];
  if ("type" in d && !TYPES.includes(d.type)) d.type = "autre";
  for (const k of ["titre", "reference", "organisme"]) if (d[k] != null) d[k] = String(d[k]).trim().slice(0, 200) || null;
  if (d.note != null) d.note = String(d.note).slice(0, 2000);
  return d;
};
// Un fichier (page, recto, verso…) : PDF ou photo encodés en data URL.
const MAX_FICHIERS = 20;
const fichierValide = (body = {}) => {
  const m = /^data:(application\/pdf|image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.fichier || ""));
  if (!m) fail(400, "Fichier invalide : seuls les PDF et les photos (JPEG, PNG, WebP) sont acceptés.");
  if (body.fichier.length > FICHIER_MAX) fail(400, "Fichier trop lourd (2,5 Mo au maximum). Scannez en qualité plus basse ou en plusieurs pages.");
  return { fichier: body.fichier, type: m[1], taille: Math.floor((m[2].length * 3) / 4),
    nom: String(body.fichier_nom || "document").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120) };
};
const FICHIERS_JSON = `coalesce((select json_agg(json_build_object('id', f.id, 'nom', f.nom, 'type', f.type, 'taille', f.taille) order by f.ordre, f.id)
  from app.archives_fichiers f where f.archive_id = a.id), '[]'::json) as fichiers`;

// ── Routes ──
async function traiter(method, chemin, query, body, u) {
  const m = chemin.match(/^\/(\d+)(?:\/(fichier|fichiers)(?:\/(\d+))?)?\/?$/);
  const racine = chemin === "/" || chemin === "";
  if (!racine && !m) fail(404, "Route inconnue.");
  const id = m ? Number(m[1]) : null, sous = m?.[2], fid = m?.[3] ? Number(m[3]) : null;

  // Liste et recherche
  if (method === "GET" && racine) {
    const where = ["1=1"], p = [];
    if (query.type) { p.push(query.type); where.push(`a.type = $${p.length}`); }
    if (query.recherche) { p.push(`%${String(query.recherche).trim().toLowerCase()}%`); where.push(`lower(concat_ws(' ', a.titre, a.reference, a.organisme, a.note, (select string_agg(f.nom, ' ') from app.archives_fichiers f where f.archive_id = a.id))) like $${p.length}`); }
    const [rows, [tot]] = await tx([
      [`select ${LISTE}, ${FICHIERS_JSON} from app.archives a left join app.utilisateurs u on u.id=a.ajoute_par where ${where.join(" and ")} order by a.type, a.titre, a.id`, p],
      [`select count(*) as total, count(*) filter (where date_expiration < current_date) as expires,
          count(*) filter (where date_expiration >= current_date and date_expiration < current_date + 60) as bientot,
          count(*) filter (where not exists (select 1 from app.archives_fichiers f where f.archive_id = a.id)) as sans_scan from app.archives a`],
    ]);
    return { rows, ...tot };
  }
  // Contenu d'un fichier (ou du premier, pour les anciennes versions de la page)
  if (method === "GET" && id && sous) {
    const r = await one(`select f.id, f.fichier, f.nom as fichier_nom, f.type as fichier_type from app.archives_fichiers f
      where f.archive_id=$1 ${fid ? "and f.id=$2" : ""} order by f.ordre, f.id limit 1`, fid ? [id, fid] : [id]);
    if (!r?.fichier) fail(404, "Aucun scan pour ce document.");
    await journal(u, "consultation", id, { fichier: r.fichier_nom });
    return r;
  }
  // Ajouter un fichier à un document
  if (method === "POST" && id && sous === "fichiers" && !fid) {
    const f = fichierValide(body);
    const [ok] = await tx([[`select (select count(*) from app.archives_fichiers where archive_id=$1) as nb, exists (select 1 from app.archives where id=$1) as existe`, [id]]]);
    if (!ok[0].existe) fail(404, "Document introuvable.");
    if (ok[0].nb >= MAX_FICHIERS) fail(400, `${MAX_FICHIERS} fichiers au maximum par document.`);
    const r = await one(`insert into app.archives_fichiers (archive_id, ordre, nom, type, taille, fichier, ajoute_par)
      values ($1, (select coalesce(max(ordre), 0) + 1 from app.archives_fichiers where archive_id=$1), $2, $3, $4, $5, $6)
      returning id, nom, type, taille`, [id, f.nom, f.type, f.taille, f.fichier, u.id]);
    await q("update app.archives set updated_at=now() where id=$1", [id]);
    await journal(u, "ajout_fichier", id, { fichier: r.nom });
    return r;
  }
  // Retirer un fichier
  if (method === "DELETE" && id && sous === "fichiers" && fid) {
    const r = await one("delete from app.archives_fichiers where id=$1 and archive_id=$2 returning id, nom", [fid, id]);
    if (!r) fail(404, "Fichier introuvable.");
    await q("update app.archives set updated_at=now() where id=$1", [id]);
    await journal(u, "retrait_fichier", id, { fichier: r.nom });
    return { ok: true };
  }
  // Créer un document (les fichiers s'ajoutent ensuite, un par un)
  if (method === "POST" && racine) {
    const d = valide(body);
    if (!d.titre) fail(400, "Le titre est obligatoire.");
    d.ajoute_par = u.id;
    const k = Object.keys(d);
    const r = await one(`insert into app.archives (${k.join(",")}) values (${k.map((_, i) => `$${i + 1}`).join(",")}) returning id, type, titre, reference, organisme, date_delivrance, date_expiration, note, created_at`, k.map((c) => d[c]));
    await journal(u, "creation", r.id, { titre: r.titre, type: r.type });
    return r;
  }
  if (method === "PUT" && id && !sous) {
    const d = valide(body);
    if ("titre" in d && !d.titre) fail(400, "Le titre est obligatoire.");
    const k = Object.keys(d);
    if (!k.length) fail(400, "Rien à modifier.");
    const r = await one(`update app.archives set ${k.map((c, i) => `${c}=$${i + 1}`).join(",")}, updated_at=now() where id=$${k.length + 1} returning id, titre, type`, [...k.map((c) => d[c]), id]);
    if (!r) fail(404, "Document introuvable.");
    await journal(u, "modification", r.id, { titre: r.titre });
    return r;
  }
  if (method === "DELETE" && id && !sous) {
    const r = await one(`delete from app.archives where id=$1 returning id, titre, type, reference`, [id]);
    if (!r) fail(404, "Document introuvable.");
    await journal(u, "suppression", r.id, r);
    await alerter(u, "Document officiel supprimé", `${qui(u)} a supprimé le document officiel « ${r.titre} »${r.reference ? ` (n° ${r.reference})` : ""} et ses fichiers des archives de l'école.`);
    return { ok: true };
  }
  fail(404, "Route inconnue.");
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      const url = new URL(request.url);
      const chemin = url.pathname.replace(/^\/api\/archives/, "") || "/";
      const t = await readToken((request.headers.get("authorization") || "").replace(/^Bearer /, ""));
      if (!t || t.parent) fail(401, "Session expirée, reconnectez-vous.");
      const u = await one("select id, nom, prenom, role, droits from app.utilisateurs where id=$1 and actif", [t.id]);
      if (!u) fail(401, "Compte désactivé.");
      if (!(await autorise(u))) fail(403, "Les archives officielles sont réservées à la direction et à l'administration.");
      const body = ["POST", "PUT"].includes(request.method) ? await request.json().catch(() => ({})) : {};
      return json(await traiter(request.method, chemin, Object.fromEntries(url.searchParams), body, u));
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      return json({ error: e.message || "Erreur serveur." }, e.status || 500);
    }
  },
};
