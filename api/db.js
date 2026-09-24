// API sécurisée : l'app parle à cette fonction, qui seule connaît la base Neon.
import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

let sql;
const SECRET = process.env.AUTH_SECRET;
const TABLES = ["eleves","paiements","depenses","recettes","notes","absences","professeurs","utilisateurs","config"];
const ADMIN_ONLY = ["utilisateurs","config"];          // écriture réservée aux admins
const USER_COLS = "id,created_at,nom,prenom,email,role,actif"; // jamais le mot de passe
const COL = /^[a-z_][a-z0-9_]*$/;
const DAYS = 30;

// ── Jeton de session signé ──────────────────────────────────────────────
const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (p) => crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
const makeToken = (u) => {
  const p = b64(JSON.stringify({ id: u.id, role: u.role, exp: Date.now() + DAYS * 864e5 }));
  return `${p}.${sign(p)}`;
};
const readToken = (t) => {
  if (!t || !t.includes(".")) return null;
  const [p, s] = t.split(".");
  const good = sign(p);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  const d = JSON.parse(Buffer.from(p, "base64url").toString());
  return d.exp > Date.now() ? d : null;
};

// ── Utilitaires SQL ─────────────────────────────────────────────────────
const cols = (data) => {
  const keys = Object.keys(data || {}).filter((k) => k !== "id" && k !== "created_at");
  if (!keys.every((k) => COL.test(k))) throw new Error("Colonne invalide");
  return keys;
};
const hashIfPwd = (k, i) => (k === "mot_de_passe" ? `crypt($${i}, gen_salt('bf'))` : `$${i}`);
const val = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);
const ret = (t) => (t === "utilisateurs" ? USER_COLS : "*");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST uniquement" });
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET)
    return res.status(503).json({ error: "Configuration serveur incomplète (DATABASE_URL / AUTH_SECRET)" });
  sql ||= neon(process.env.DATABASE_URL);
  const { action, table, id, data, token } = req.body || {};
  try {
    // Public : lecture de la config (nom, couleur de l'école sur l'écran de connexion)
    if (action === "config_get") {
      const r = await sql.query("select data from config order by id desc limit 1");
      return res.json(r);
    }

    // Public : connexion
    if (action === "login") {
      const { email, mdp } = data || {};
      const r = await sql.query(
        `select ${USER_COLS} from utilisateurs
         where lower(email)=lower($1) and actif and mot_de_passe = crypt($2, mot_de_passe) limit 1`,
        [email || "", mdp || ""]
      );
      if (!r.length) return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      return res.json({ user: r[0], token: makeToken(r[0]) });
    }

    // Première installation : on autorise l'écriture de la config tant qu'il n'y en a pas
    const session = readToken(token);
    if (action === "config_save") {
      const exist = await sql.query("select id from config order by id desc limit 1");
      if (exist.length && session?.role !== "admin") return res.status(403).json({ error: "Réservé à l'admin" });
      if (exist.length) await sql.query("update config set data=$1 where id=$2", [JSON.stringify(data), exist[0].id]);
      else await sql.query("insert into config (data) values ($1)", [JSON.stringify(data)]);
      return res.json({ ok: true });
    }

    // Tout le reste exige une session valide
    if (!session) return res.status(401).json({ error: "Session expirée" });

    if (action === "change_password") {
      const { ancien, nouveau } = data || {};
      if (!nouveau || nouveau.length < 6) return res.status(400).json({ error: "Minimum 6 caractères" });
      const r = await sql.query(
        `update utilisateurs set mot_de_passe = crypt($1, gen_salt('bf'))
         where id=$2 and mot_de_passe = crypt($3, mot_de_passe) returning id`,
        [nouveau, session.id, ancien || ""]
      );
      if (!r.length) return res.status(400).json({ error: "Ancien mot de passe incorrect" });
      return res.json({ ok: true });
    }

    if (!TABLES.includes(table)) return res.status(400).json({ error: "Table inconnue" });
    if (action !== "get" && ADMIN_ONLY.includes(table) && session.role !== "admin")
      return res.status(403).json({ error: "Réservé à l'admin" });

    if (action === "get") {
      return res.json(await sql.query(`select ${ret(table)} from ${table} order by id desc`));
    }
    if (action === "add") {
      const k = cols(data);
      const q = `insert into ${table} (${k.join(",")}) values (${k.map((c, i) => hashIfPwd(c, i + 1)).join(",")}) returning ${ret(table)}`;
      return res.json(await sql.query(q, k.map((c) => val(data[c]))));
    }
    if (action === "patch") {
      const k = cols(data);
      if (!k.length) return res.json({ ok: true });
      const q = `update ${table} set ${k.map((c, i) => `${c}=${hashIfPwd(c, i + 1)}`).join(",")} where id=$${k.length + 1}`;
      await sql.query(q, [...k.map((c) => val(data[c])), id]);
      return res.json({ ok: true });
    }
    if (action === "del") {
      await sql.query(`delete from ${table} where id=$1`, [id]);
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: "Action inconnue" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
