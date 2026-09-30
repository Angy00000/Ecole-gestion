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
  secretaire: ["eleves.lire", "eleves.ecrire", "finances.lire", "finances.encaisser", "pedagogie.lire", "absences.ecrire"],
  professeur: ["eleves.lire", "pedagogie.lire", "pedagogie.ecrire", "absences.ecrire"],
};
const peut = (role, droit) => (DROITS[role] || []).some((d) => d === "*" || d === droit);
const exige = (ctx, droit) => { if (!peut(ctx.user.role, droit)) fail(403, "Vous n'avez pas les droits pour cette action."); };

const journal = (ctx, action, entite, entite_id, details) =>
  q("insert into app.journal (utilisateur_id, action, entite, entite_id, details) values ($1,$2,$3,$4,$5)",
    [ctx.user?.id, action, entite, entite_id, details || null]).catch(() => {});

// ── Validation ────────────────────────────────────────────────────────────
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && k in obj).map((k) => [k, obj[k] === "" ? null : obj[k]]));
const COLS_ELEVE = ["nom","prenom","sexe","date_naissance","lieu_naissance","adresse","pere_nom","pere_prenom","pere_profession","pere_telephone","mere_nom","mere_prenom","mere_profession","mere_telephone","tuteur_nom","tuteur_telephone","observations","statut"];
const COLS_CLASSE = ["nom","cycle","ordre","capacite","titulaire_id","bareme","frais_inscription","uniforme","mensualite","mensualite_jan_fev","mensualite_cantine","mensualite_cantine_jan_fev","frais_cantine"];
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
  return q(`select c.*, t.prenom || ' ' || t.nom as titulaire,
      (select count(*) from app.matieres m where m.classe_id=c.id) as nb_matieres,
      (select count(*) from app.inscriptions i where i.classe_id=c.id and i.statut='active') as effectif,
      (select count(*) filter (where e.sexe='F') from app.inscriptions i join app.eleves e on e.id=i.eleve_id where i.classe_id=c.id and i.statut='active') as filles
    from app.classes c left join app.enseignants t on t.id=c.titulaire_id where c.annee_id=$1 order by c.ordre, c.nom`, [annee]);
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
    [`select e.id, e.matricule, e.nom, e.prenom, e.sexe, c.nom as classe, c.cycle, i.date_inscription, i.type
      from app.inscriptions i join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id
      where i.annee_id=$1 order by i.created_at desc limit 6`, [annee]],
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
        c.id as classe_id, c.nom as classe, c.cycle
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
    [`select i.*, a.libelle as annee, a.active as annee_active, c.nom as classe, c.cycle,
        c.frais_inscription, c.uniforme, c.mensualite, c.mensualite_jan_fev, c.mensualite_cantine, c.mensualite_cantine_jan_fev, c.frais_cantine
      from app.inscriptions i join app.annees a on a.id=i.annee_id join app.classes c on c.id=i.classe_id
      where i.eleve_id=$1 order by a.debut desc`, [id]],
    peut(ctx.user.role, "finances.lire")
      ? [`select r.*, a.libelle as annee, i.annee_id, u.prenom || ' ' || u.nom as encaisse_par_nom,
            (select json_agg(json_build_object('type', p.type, 'mois', p.mois, 'montant', p.montant) order by p.mois nulls first, p.id) from app.paiements p where p.recu_id=r.id) as lignes
          from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.annees a on a.id=i.annee_id
          left join app.utilisateurs u on u.id=r.encaisse_par
          where i.eleve_id=$1 order by r.date_paiement desc, r.id desc`, [id]]
      : ["select null where false"],
  ]);
  if (!eleve) fail(404, "Élève introuvable.");
  const absences = peut(ctx.user.role, "pedagogie.lire") ? await q(`select a.id, a.date_absence, a.moment, a.type, a.justifiee, a.motif, i.annee_id
    from app.absences a join app.inscriptions i on i.id=a.inscription_id where i.eleve_id=$1 order by a.date_absence desc limit 100`, [id]) : [];
  return { eleve, inscriptions, paiements, absences };
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
  const n = await one(`select count(*) as n from app.recus r join app.inscriptions i on i.id=r.inscription_id where i.eleve_id=$1`, [ctx.params.id]);
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


// ═══ FINANCES ══════════════════════════════════════════════════════════════
const MODES = ["especes", "wave", "orange_money", "cheque", "virement"];
const TYPES_LIGNE = ["inscription", "uniforme", "cantine", "mensualite", "fournitures", "cours_vacances", "transport", "autre"];

// Reste à payer par inscription, mois échus jusqu'à $2 (date). Paramètres : $1 année.
const SQL_IMPAYES = `
  with ins as (
    select i.id, i.eleve_id, i.classe_id, i.cantine,
      c.frais_inscription + c.uniforme + case when i.cantine then c.frais_cantine else 0 end as frais
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
    coalesce((select sum(montant) from pay where pay.inscription_id=ins.id and pay.type in ('inscription','uniforme','cantine')),0) as frais_payes,
    coalesce((select sum(du) from lignes l where l.id=ins.id),0) as mens_dues,
    coalesce((select sum(least(paye,du)) from lignes l where l.id=ins.id),0) as mens_payees,
    coalesce((select count(*) from lignes l where l.id=ins.id and l.du > l.paye),0) as mois_impayes,
    (select string_agg(to_char(l.d,'YYYY-MM'), ',' order by l.d) from lignes l where l.id=ins.id and l.du > l.paye) as liste_mois,
    greatest(ins.frais - coalesce((select sum(montant) from pay where pay.inscription_id=ins.id and pay.type in ('inscription','uniforme','cantine')),0), 0)
      + coalesce((select sum(greatest(du - paye, 0)) from lignes l where l.id=ins.id),0) as reste
  from ins`;

const situation = async (inscriptionId) => {
  const [[ins], lignes] = await tx([
    [`select i.*, c.nom as classe, c.cycle, c.frais_inscription, c.uniforme, c.frais_cantine, a.libelle as annee
      from app.inscriptions i join app.classes c on c.id=i.classe_id join app.annees a on a.id=i.annee_id where i.id=$1`, [inscriptionId]],
    [`with i as (select i.*, c.frais_inscription, c.uniforme, c.frais_cantine from app.inscriptions i join app.classes c on c.id=i.classe_id where i.id=$1),
      pay as (select p.type, p.mois, sum(p.montant) as m from app.paiements p join app.recus r on r.id=p.recu_id and not r.annule where p.inscription_id=$1 group by 1,2)
      select 'frais' as groupe, x.code as type, null::text as mois, x.ordre, x.du, coalesce((select sum(m) from pay where pay.type=x.code),0) as paye
      from i, lateral (values ('inscription', 1, i.frais_inscription), ('uniforme', 2, i.uniforme), ('cantine', 3, case when i.cantine then i.frais_cantine else 0 end)) x(code, ordre, du)
      where x.du > 0 or exists (select 1 from pay where pay.type=x.code)
      union all
      select 'mois', 'mensualite', to_char(d,'YYYY-MM'), 10, app.du_mois($1, d), coalesce((select m from pay where pay.type='mensualite' and pay.mois=d),0)
      from app.mois_annee((select annee_id from i)) d
      union all
      select 'autre', p.type, null, 20, 0, sum(p.m) from pay p where p.type not in ('inscription','uniforme','cantine','mensualite') group by p.type
      order by 4, 3`, [inscriptionId]],
  ]);
  if (!ins) fail(404, "Inscription introuvable.");
  const mois = new Date().toISOString().slice(0, 7);
  const totalDu = lignes.reduce((t, l) => t + l.du, 0);
  const totalPaye = lignes.filter((l) => l.groupe !== "autre").reduce((t, l) => t + Math.min(l.paye, l.du), 0);
  const echu = lignes.filter((l) => l.groupe === "frais" || (l.groupe === "mois" && l.mois <= mois)).reduce((t, l) => t + Math.max(l.du - l.paye, 0), 0);
  return { inscription: ins, lignes, total_du: totalDu, total_paye: totalPaye, reste_annee: Math.max(totalDu - totalPaye, 0), reste_echu: echu };
};

route("GET", "/inscriptions/:id/situation", async (ctx) => { exige(ctx, "finances.lire"); return situation(ctx.params.id); });

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
    ["select type, to_char(mois,'YYYY-MM') as mois, montant from app.paiements where recu_id=$1 order by mois nulls first, id", [id]],
  ]);
  if (!r) fail(404, "Reçu introuvable.");
  return { ...r, lignes };
};

route("GET", "/recus/:id", async (ctx) => {
  exige(ctx, "finances.lire");
  const r = await recuComplet(ctx.params.id);
  const sit = await situation(r.inscription_id);
  return { recu: r, situation: { reste_annee: sit.reste_annee, reste_echu: sit.reste_echu } };
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
  if (rech) { p.push(`%${rech.toLowerCase()}%`); where.push(`(lower(e.nom||' '||e.prenom) like $${p.length} or lower(e.prenom||' '||e.nom) like $${p.length} or lower(r.numero) like $${p.length} or lower(e.matricule) like $${p.length})`); }
  const base = `from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id where ${where.join(" and ")}`;
  const [rows, [tot], modes, types] = await tx([
    [`select r.id, r.numero, r.date_paiement, r.mode, r.montant, r.annule, r.created_at, e.id as eleve_id, e.nom, e.prenom, e.sexe, e.matricule, c.nom as classe, c.cycle,
        (select json_agg(json_build_object('type', p.type, 'mois', to_char(p.mois,'YYYY-MM'), 'montant', p.montant) order by p.mois nulls first) from app.paiements p where p.recu_id=r.id) as lignes
      ${base} order by r.date_paiement desc, r.id desc limit 300`, p],
    [`select coalesce(sum(r.montant) filter (where not r.annule),0) as total, count(*) filter (where not r.annule) as nombre ${base}`, p],
    [`select r.mode, sum(r.montant) as montant, count(*) as nombre ${base} and not r.annule group by r.mode order by 2 desc`, p],
    [`select pa.type, sum(pa.montant) as montant from app.paiements pa join app.recus r on r.id=pa.recu_id join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id where ${where.join(" and ")} and not r.annule group by pa.type order by 2 desc`, p],
  ]);
  return { rows, total: tot.total, nombre: tot.nombre, modes, types };
});

route("POST", "/recus", async (ctx) => {
  exige(ctx, "finances.encaisser");
  const b = ctx.body;
  requis(b, [["inscription_id", "L'élève"]]);
  if (!MODES.includes(b.mode || "especes")) fail(400, "Mode de paiement invalide.");
  const lignes = (b.lignes || []).filter((l) => Number(l.montant) > 0);
  if (!lignes.length) fail(400, "Ajoutez au moins une ligne avec un montant.");
  for (const l of lignes) {
    if (!TYPES_LIGNE.includes(l.type)) fail(400, "Type de paiement invalide.");
    if (l.type === "mensualite" && !/^\d{4}-\d{2}$/.test(l.mois || "")) fail(400, "Précisez le mois de chaque mensualité.");
    if (!Number.isInteger(Number(l.montant))) fail(400, "Montant invalide.");
  }
  const ins = await one("select i.id, a.libelle from app.inscriptions i join app.annees a on a.id=i.annee_id where i.id=$1", [b.inscription_id]);
  if (!ins) fail(404, "Inscription introuvable.");
  const prefixe = "R" + ins.libelle.replace(/^\d{2}(\d{2})-\d{2}(\d{2})$/, "$1$2");
  const total = lignes.reduce((t, l) => t + Number(l.montant), 0);
  const params = [b.inscription_id, b.date_paiement || null, b.mode || "especes", total, b.reference || null, b.note || null, ctx.user.id, prefixe];
  const values = lignes.map((l, k) => { params.push(l.type, l.type === "mensualite" ? `${l.mois}-01` : null, Number(l.montant)); const n = params.length; return `($${n - 2}, $${n - 1}::date, $${n}::int)`; });
  const r = await one(
    `with r as (
       insert into app.recus (numero, inscription_id, date_paiement, mode, montant, reference, note, encaisse_par)
       values ($8::text || '-' || lpad(nextval('app.recu_seq')::text, 5, '0'), $1::int, coalesce($2::date, current_date), $3::text, $4::int, $5::text, $6::text, $7::int) returning *),
     l as (insert into app.paiements (recu_id, inscription_id, type, mois, montant)
       select r.id, r.inscription_id, v.type, v.mois, v.montant from r, (values ${values.join(",")}) v(type, mois, montant) returning id)
     select r.id, r.numero, r.montant, (select count(*) from l) as lignes from r`, params);
  await journal(ctx, "encaissement", "recu", r.id, { numero: r.numero, montant: r.montant });
  return r;
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
  const [recus, depenses] = await tx([
    [`select r.id, r.numero, r.mode, r.montant, r.annule, r.created_at, e.nom, e.prenom, e.matricule, c.nom as classe,
        u.prenom || ' ' || u.nom as encaisse_par_nom,
        (select string_agg(distinct p.type, ',') from app.paiements p where p.recu_id=r.id) as types
      from app.recus r join app.inscriptions i on i.id=r.inscription_id join app.eleves e on e.id=i.eleve_id join app.classes c on c.id=i.classe_id
      left join app.utilisateurs u on u.id=r.encaisse_par where r.date_paiement=$1 order by r.created_at`, [jour]],
    [`select d.*, u.prenom || ' ' || u.nom as saisi_par_nom from app.depenses d left join app.utilisateurs u on u.id=d.saisi_par where d.date_depense=$1 order by d.created_at`, [jour]],
  ]);
  const modes = {};
  for (const m of MODES) modes[m] = { entrees: 0, sorties: 0 };
  recus.filter((r) => !r.annule).forEach((r) => (modes[r.mode].entrees += r.montant));
  depenses.forEach((d) => (modes[d.mode].sorties += d.montant));
  const entrees = recus.filter((r) => !r.annule).reduce((t, r) => t + r.montant, 0);
  const sorties = depenses.reduce((t, d) => t + d.montant, 0);
  return { date: jour, recus, depenses, modes, entrees, sorties, solde: entrees - sorties };
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
  const r = await one(...updateSql("app.depenses", ctx.params.id, pick(ctx.body, COLS_DEP)));
  await journal(ctx, "modification", "depense", r.id, { libelle: r.libelle, montant: r.montant });
  return r;
});
route("DELETE", "/depenses/:id", async (ctx) => {
  exige(ctx, "depenses.ecrire");
  const r = await one("delete from app.depenses where id=$1 returning id, libelle, montant", [ctx.params.id]);
  await journal(ctx, "suppression", "depense", Number(ctx.params.id), r);
  return { ok: true };
});


// ═══ PÉDAGOGIE ═════════════════════════════════════════════════════════════
const COLS_ENS = ["nom", "prenom", "sexe", "telephone", "email", "adresse", "specialite", "diplome", "date_embauche", "salaire", "statut", "observations"];
route("GET", "/enseignants", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  return q(`select e.*,
      (select string_agg(c.nom, ', ' order by c.ordre) from app.classes c where c.titulaire_id=e.id and c.annee_id=$1) as classes_titulaire,
      (select string_agg(distinct m.nom, ', ') from app.matieres m join app.classes c on c.id=m.classe_id and c.annee_id=$1 where m.enseignant_id=e.id) as matieres,
      (select count(*) from app.emploi_temps t join app.classes c on c.id=t.classe_id and c.annee_id=$1 where t.enseignant_id=e.id) as creneaux
    from app.enseignants e order by e.statut, e.nom, e.prenom`, [annee]);
});
route("POST", "/enseignants", async (ctx) => {
  exige(ctx, "enseignants.ecrire");
  const d = pick(ctx.body, COLS_ENS);
  requis(d, [["nom", "Le nom"], ["prenom", "Le prénom"]]);
  d.nom = d.nom.trim().toUpperCase();
  const r = await one(...insertSql("app.enseignants", d));
  await journal(ctx, "creation", "enseignant", r.id, { nom: `${r.prenom} ${r.nom}` });
  return r;
});
route("PUT", "/enseignants/:id", async (ctx) => {
  exige(ctx, "enseignants.ecrire");
  const d = pick(ctx.body, COLS_ENS);
  if (d.nom) d.nom = d.nom.trim().toUpperCase();
  const r = await one(...updateSql("app.enseignants", ctx.params.id, d));
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
  return one(...updateSql("app.evaluations", ctx.params.id, pick(ctx.body, ["matiere_id", "trimestre", "type", "libelle", "date_eval", "bareme"])));
});
route("DELETE", "/evaluations/:id", async (ctx) => {
  exige(ctx, "pedagogie.ecrire");
  await q("delete from app.evaluations where id=$1", [ctx.params.id]);
  await journal(ctx, "suppression", "evaluation", Number(ctx.params.id));
  return { ok: true };
});
route("GET", "/evaluations/:id/notes", async (ctx) => {
  exige(ctx, "pedagogie.lire");
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
  return one(...updateSql("app.absences", ctx.params.id, pick(ctx.body, ["justifiee", "motif", "moment"])));
});
route("DELETE", "/absences/:id", async (ctx) => {
  exige(ctx, "absences.ecrire");
  await q("delete from app.absences where id=$1", [ctx.params.id]);
  return { ok: true };
});

// ── Emploi du temps ──
route("GET", "/emploi", async (ctx) => {
  exige(ctx, "pedagogie.lire");
  const annee = await anneeCourante(ctx.query.annee_id);
  const p = [annee]; let w = "c.annee_id=$1";
  if (ctx.query.classe_id) { p.push(ctx.query.classe_id); w += ` and t.classe_id=$${p.length}`; }
  if (ctx.query.enseignant_id) { p.push(ctx.query.enseignant_id); w += ` and t.enseignant_id=$${p.length}`; }
  return q(`select t.id, t.classe_id, t.jour, to_char(t.heure_debut,'HH24:MI') as heure_debut, to_char(t.heure_fin,'HH24:MI') as heure_fin,
      t.matiere_id, t.libelle, t.enseignant_id, t.salle, m.nom as matiere, c.nom as classe, e.prenom || ' ' || e.nom as enseignant
    from app.emploi_temps t join app.classes c on c.id=t.classe_id left join app.matieres m on m.id=t.matiere_id left join app.enseignants e on e.id=t.enseignant_id
    where ${w} order by t.jour, t.heure_debut`, p);
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
