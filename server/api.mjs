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
  direction:  ["eleves.lire", "eleves.ecrire", "eleves.supprimer", "classes.ecrire", "etablissement.ecrire", "annees.ecrire", "journal.lire", "finances.lire"],
  comptable:  ["eleves.lire", "finances.lire"],
  secretaire: ["eleves.lire", "eleves.ecrire", "finances.lire"],
  professeur: ["eleves.lire"],
};
const peut = (role, droit) => (DROITS[role] || []).some((d) => d === "*" || d === droit);
const exige = (ctx, droit) => { if (!peut(ctx.user.role, droit)) fail(403, "Vous n'avez pas les droits pour cette action."); };

const journal = (ctx, action, entite, entite_id, details) =>
  q("insert into app.journal (utilisateur_id, action, entite, entite_id, details) values ($1,$2,$3,$4,$5)",
    [ctx.user?.id, action, entite, entite_id, details || null]).catch(() => {});

// ── Validation ────────────────────────────────────────────────────────────
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && k in obj).map((k) => [k, obj[k] === "" ? null : obj[k]]));
const COLS_ELEVE = ["nom","prenom","sexe","date_naissance","lieu_naissance","adresse","pere_nom","pere_prenom","pere_profession","pere_telephone","mere_nom","mere_prenom","mere_profession","mere_telephone","tuteur_nom","tuteur_telephone","observations","statut"];
const COLS_CLASSE = ["nom","cycle","ordre","capacite","frais_inscription","uniforme","mensualite","mensualite_jan_fev","mensualite_cantine","mensualite_cantine_jan_fev","frais_cantine"];
const COLS_INSC = ["classe_id","cantine","statut","mensualite_speciale","gratuit","date_inscription","type"];
const COLS_ETAB = ["nom","slogan","adresse","telephones","email","site_web","ninea","bp","autorisation","logo"];
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
const USER_COLS = "id, nom, prenom, email, role, actif, dernier_login, created_at";
const anneeCourante = async (id) => id ? Number(id) : (await one("select id from app.annees where active"))?.id;

// ═══════════════════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════════════════
const routes = [];
const route = (method, pattern, handler, { public: pub = false } = {}) => {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$");
  routes.push({ method, re, keys, handler, pub });
};

// ── Authentification ──────────────────────────────────────────────────────
route("POST", "/auth/login", async ({ body }) => {
  const u = await one(
    `update app.utilisateurs set dernier_login = now()
     where lower(email)=lower($1) and actif and mot_de_passe = crypt($2, mot_de_passe)
     returning ${USER_COLS}`, [body.email?.trim() || "", body.mot_de_passe || ""]);
  if (!u) fail(401, "Email ou mot de passe incorrect.");
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
  const [[etab], annees] = await tx([
    ["select * from app.etablissement where id=1"],
    ["select * from app.annees order by debut desc"],
  ]);
  return { user: ctx.user, etablissement: etab, annees, droits: DROITS[ctx.user.role] };
});

// ── Établissement ─────────────────────────────────────────────────────────
route("PUT", "/etablissement", async (ctx) => {
  exige(ctx, "etablissement.ecrire");
  const d = pick(ctx.body, COLS_ETAB);
  requis(d, [["nom", "Le nom de l'école"]]);
  const r = await one(...updateSql("app.etablissement", 1, d, ", updated_at=now()"));
  await journal(ctx, "modification", "etablissement", 1);
  return r;
});

// ── Années scolaires ──────────────────────────────────────────────────────
route("GET", "/annees", async () => q(
  `select a.*, (select count(*) from app.inscriptions i where i.annee_id=a.id and i.statut='active') as effectif
   from app.annees a order by debut desc`));

route("POST", "/annees", async (ctx) => {
  exige(ctx, "annees.ecrire");
  const { libelle, debut, fin, copier_de } = ctx.body;
  requis(ctx.body, [["libelle", "Le libellé"], ["debut", "La date de début"], ["fin", "La date de fin"]]);
  const a = await one("insert into app.annees (libelle, debut, fin) values ($1,$2,$3) returning *", [libelle, debut, fin]);
  if (copier_de) await q(
    `insert into app.classes (annee_id, ${COLS_CLASSE.join(",")})
     select $1, ${COLS_CLASSE.join(",")} from app.classes where annee_id=$2`, [a.id, copier_de]);
  await journal(ctx, "creation", "annee", a.id, { libelle });
  return a;
});

route("PUT", "/annees/:id", async (ctx) => {
  exige(ctx, "annees.ecrire");
  return one(...updateSql("app.annees", ctx.params.id, pick(ctx.body, ["libelle", "debut", "fin"])));
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
  return q(`select c.*,
      (select count(*) from app.inscriptions i where i.classe_id=c.id and i.statut='active') as effectif,
      (select count(*) filter (where e.sexe='F') from app.inscriptions i join app.eleves e on e.id=i.eleve_id where i.classe_id=c.id and i.statut='active') as filles
    from app.classes c where c.annee_id=$1 order by c.ordre, c.nom`, [annee]);
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
  const voitFinances = peut(ctx.user.role, "finances.lire");
  const [[eff], classes, recentes, [fin], paiements, evolution] = await tx([
    [`select count(*) as total,
        count(*) filter (where e.sexe='F') as filles,
        count(*) filter (where e.sexe='M') as garcons,
        count(*) filter (where i.type='nouvelle') as nouveaux,
        count(*) filter (where i.type='reinscription') as reinscrits,
        count(*) filter (where i.cantine) as cantine
      from app.inscriptions i join app.eleves e on e.id=i.eleve_id
      where i.annee_id=$1 and i.statut='active'`, [annee]],
    [`select c.id, c.nom, c.cycle, c.capacite, count(i.id) as effectif
      from app.classes c left join app.inscriptions i on i.classe_id=c.id and i.statut='active'
      where c.annee_id=$1 group by c.id order by c.ordre`, [annee]],
    [`select e.id, e.matricule, e.nom, e.prenom, e.sexe, c.nom as classe, i.date_inscription, i.type
      from app.inscriptions i join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id
      where i.annee_id=$1 order by i.created_at desc limit 6`, [annee]],
    [`select coalesce(sum(p.montant) filter (where p.date_paiement=current_date),0) as jour,
        coalesce(sum(p.montant) filter (where date_trunc('month',p.date_paiement)=date_trunc('month',current_date)),0) as mois,
        coalesce(sum(p.montant),0) as annee,
        count(*) filter (where p.date_paiement=current_date) as nb_jour
      from app.paiements p join app.inscriptions i on i.id=p.inscription_id
      where i.annee_id=$1 and not p.annule`, [annee]],
    [`select p.id, p.numero, p.type, p.montant, p.mode, p.date_paiement, e.id as eleve_id, e.nom, e.prenom
      from app.paiements p join app.inscriptions i on i.id=p.inscription_id join app.eleves e on e.id=i.eleve_id
      where i.annee_id=$1 and not p.annule order by p.created_at desc limit 6`, [annee]],
    [`select to_char(d, 'YYYY-MM') as mois, coalesce(sum(p.montant),0) as montant
      from generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') d
      left join app.paiements p on date_trunc('month', p.date_paiement)=d and not p.annule
      group by d order by d`],
  ]);
  return {
    effectif: eff, classes, recentes,
    finances: voitFinances ? { ...fin, paiements, evolution } : null,
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
        i.id as inscription_id, i.cantine, i.type as type_inscription, i.statut as statut_inscription,
        c.id as classe_id, c.nom as classe
      ${base} order by ${SORTS[sort] || SORTS.nom} limit ${limit} offset ${(page - 1) * limit}`, p],
    [`select count(*) as total ${base}`, p],
  ]);
  return { rows, total, page, limit };
});

route("GET", "/eleves/:id", async (ctx) => {
  exige(ctx, "eleves.lire");
  const id = ctx.params.id;
  const [[eleve], inscriptions, paiements] = await tx([
    ["select * from app.eleves where id=$1", [id]],
    [`select i.*, a.libelle as annee, a.active as annee_active, c.nom as classe,
        c.frais_inscription, c.uniforme, c.mensualite, c.mensualite_jan_fev, c.mensualite_cantine, c.mensualite_cantine_jan_fev, c.frais_cantine
      from app.inscriptions i join app.annees a on a.id=i.annee_id join app.classes c on c.id=i.classe_id
      where i.eleve_id=$1 order by a.debut desc`, [id]],
    peut(ctx.user.role, "finances.lire")
      ? [`select p.*, a.libelle as annee, u.prenom || ' ' || u.nom as encaisse_par_nom
          from app.paiements p join app.inscriptions i on i.id=p.inscription_id join app.annees a on a.id=i.annee_id
          left join app.utilisateurs u on u.id=p.encaisse_par
          where i.eleve_id=$1 order by p.date_paiement desc, p.id desc`, [id]]
      : ["select null where false"],
  ]);
  if (!eleve) fail(404, "Élève introuvable.");
  return { eleve, inscriptions, paiements };
});

const prochainMatricule = async (anneeId) => {
  const a = await one("select extract(year from debut)::int as an from app.annees where id=$1", [anneeId]);
  const r = await one(
    `select coalesce(max(nullif(split_part(matricule,'-',2),'')::int),0)+1 as n from app.eleves
     where matricule like $1 and split_part(matricule,'-',2) ~ '^[0-9]+$'`, [`${a.an}-%`]);
  return `${a.an}-${String(r.n).padStart(3, "0")}`;
};

route("GET", "/eleves-matricule", async (ctx) => ({ matricule: await prochainMatricule(await anneeCourante(ctx.query.annee_id)) }));

route("POST", "/eleves", async (ctx) => {
  exige(ctx, "eleves.ecrire");
  const e = pick(ctx.body.eleve, COLS_ELEVE);
  const ins = ctx.body.inscription;
  requis(e, [["nom", "Le nom"], ["prenom", "Le prénom"], ["sexe", "Le sexe"]]);
  requis(ins, [["classe_id", "La classe"]]);
  const annee = await anneeCourante(ins.annee_id);
  e.matricule = ctx.body.eleve.matricule?.trim() || await prochainMatricule(annee);
  e.nom = e.nom.trim().toUpperCase();
  e.prenom = e.prenom.trim();
  const k = Object.keys(e);
  const r = await one(
    `with e as (insert into app.eleves (${k.join(",")}) values (${k.map((_, i) => `$${i + 1}`).join(",")}) returning *),
     i as (insert into app.inscriptions (eleve_id, annee_id, classe_id, type, cantine, date_inscription)
           select e.id, $${k.length + 1}, $${k.length + 2}, $${k.length + 3}, $${k.length + 4}, coalesce($${k.length + 5}::date, current_date) from e returning id)
     select e.id, e.matricule, e.nom, e.prenom, (select id from i) as inscription_id from e`,
    [...k.map((c) => e[c]), annee, ins.classe_id, ins.type || "nouvelle", !!ins.cantine, ins.date_inscription || null]);
  await journal(ctx, "inscription", "eleve", r.id, { matricule: r.matricule, nom: `${r.prenom} ${r.nom}` });
  return r;
});

route("PUT", "/eleves/:id", async (ctx) => {
  exige(ctx, "eleves.ecrire");
  const d = pick(ctx.body, COLS_ELEVE);
  if (d.nom) d.nom = d.nom.trim().toUpperCase();
  const r = await one(...updateSql("app.eleves", ctx.params.id, d, ", updated_at=now()"));
  if (!r) fail(404, "Élève introuvable.");
  await journal(ctx, "modification", "eleve", r.id, { champs: Object.keys(d) });
  return r;
});

route("DELETE", "/eleves/:id", async (ctx) => {
  exige(ctx, "eleves.supprimer");
  const n = await one(`select count(*) as n from app.paiements p join app.inscriptions i on i.id=p.inscription_id where i.eleve_id=$1`, [ctx.params.id]);
  if (n.n > 0) {
    await q("update app.eleves set statut='sorti', updated_at=now() where id=$1", [ctx.params.id]);
    await journal(ctx, "sortie", "eleve", Number(ctx.params.id));
    return { ok: true, archive: true };
  }
  await q("delete from app.eleves where id=$1", [ctx.params.id]);
  await journal(ctx, "suppression", "eleve", Number(ctx.params.id));
  return { ok: true, archive: false };
});

// ── Inscriptions / réinscriptions ─────────────────────────────────────────
route("POST", "/eleves/:id/inscriptions", async (ctx) => {
  exige(ctx, "eleves.ecrire");
  requis(ctx.body, [["classe_id", "La classe"]]);
  const annee = await anneeCourante(ctx.body.annee_id);
  const r = await one(
    `insert into app.inscriptions (eleve_id, annee_id, classe_id, type, cantine, date_inscription)
     values ($1,$2,$3,$4,$5,coalesce($6::date,current_date)) returning *`,
    [ctx.params.id, annee, ctx.body.classe_id, ctx.body.type || "reinscription", !!ctx.body.cantine, ctx.body.date_inscription || null]);
  await q("update app.eleves set statut='actif' where id=$1", [ctx.params.id]);
  await journal(ctx, "reinscription", "eleve", Number(ctx.params.id), { annee_id: annee });
  return r;
});

route("PUT", "/inscriptions/:id", async (ctx) => {
  exige(ctx, "eleves.ecrire");
  const r = await one(...updateSql("app.inscriptions", ctx.params.id, pick(ctx.body, COLS_INSC)));
  await journal(ctx, "modification", "inscription", r.id, pick(ctx.body, COLS_INSC));
  return r;
});

// ── Utilisateurs (admin) ──────────────────────────────────────────────────
route("GET", "/utilisateurs", async (ctx) => { exige(ctx, "utilisateurs"); return q(`select ${USER_COLS} from app.utilisateurs order by nom, prenom`); });

route("POST", "/utilisateurs", async (ctx) => {
  exige(ctx, "utilisateurs");
  const b = ctx.body;
  requis(b, [["nom", "Le nom"], ["prenom", "Le prénom"], ["email", "L'email"], ["mot_de_passe", "Le mot de passe"], ["role", "Le rôle"]]);
  if (b.mot_de_passe.length < 8) fail(400, "Le mot de passe doit faire au moins 8 caractères.");
  const r = await one(`insert into app.utilisateurs (nom, prenom, email, mot_de_passe, role)
    values ($1,$2,lower($3),crypt($4, gen_salt('bf')),$5) returning ${USER_COLS}`, [b.nom.trim(), b.prenom.trim(), b.email.trim(), b.mot_de_passe, b.role]);
  await journal(ctx, "creation", "utilisateur", r.id, { email: r.email, role: r.role });
  return r;
});

route("PUT", "/utilisateurs/:id", async (ctx) => {
  exige(ctx, "utilisateurs");
  const d = pick(ctx.body, ["nom", "prenom", "email", "role", "actif"]);
  if (Number(ctx.params.id) === ctx.user.id && (d.actif === false || (d.role && d.role !== "admin")))
    fail(400, "Vous ne pouvez pas retirer vos propres droits d'administrateur.");
  const list = [];
  if (Object.keys(d).length) list.push(updateSql("app.utilisateurs", ctx.params.id, d));
  if (ctx.body.mot_de_passe) {
    if (ctx.body.mot_de_passe.length < 8) fail(400, "Le mot de passe doit faire au moins 8 caractères.");
    list.push(["update app.utilisateurs set mot_de_passe=crypt($1, gen_salt('bf')) where id=$2", [ctx.body.mot_de_passe, ctx.params.id]]);
  }
  if (list.length) await tx(list);
  await journal(ctx, "modification", "utilisateur", Number(ctx.params.id), { ...d, mot_de_passe: ctx.body.mot_de_passe ? "réinitialisé" : undefined });
  return one(`select ${USER_COLS} from app.utilisateurs where id=$1`, [ctx.params.id]);
});

// ── Journal ───────────────────────────────────────────────────────────────
route("GET", "/journal", async (ctx) => {
  exige(ctx, "journal.lire");
  return q(`select j.*, u.prenom || ' ' || u.nom as utilisateur from app.journal j
    left join app.utilisateurs u on u.id=j.utilisateur_id order by j.created_at desc limit $1`, [Math.min(Number(ctx.query.limit) || 100, 500)]);
});

// ── Santé ─────────────────────────────────────────────────────────────────
route("GET", "/", async () => ({ ok: true, service: "ecole-gestion api v2", base: await one(
  "select (select count(*) from app.eleves) as eleves, (select count(*) from app.classes) as classes, now() as heure") }), { public: true });

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
