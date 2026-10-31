// Constantes et modèles du module Événements (anniversaires, fêtes, kermesses…).
export const TYPES_EVT = {
  anniversaire: "Anniversaire de l'école",
  fin_annee: "Fête de fin d'année",
  kermesse: "Kermesse",
  noel: "Arbre de Noël",
  culturelle: "Journée culturelle",
  remise_prix: "Remise des prix",
  reunion: "Réunion / assemblée des parents",
  autre: "Autre événement",
};
export const ICONES_EVT = { anniversaire: "🎉", fin_annee: "🎓", kermesse: "🎪", noel: "🎄", culturelle: "🥁", remise_prix: "🏆", reunion: "🤝", autre: "📅" };

export const THEMES_EVT = {
  prestige: { nom: "Prestige", sub: "Noir et or, élégant", couleurs: ["#14110b", "#c9a227", "#f6e7b4"] },
  ecole: { nom: "École", sub: "Bleu-vert et or de l'école", couleurs: ["#0b3f4a", "#1f7a8c", "#f2c14e"] },
  festif: { nom: "Festif", sub: "Bleu, jaune et couleurs vives", couleurs: ["#1d4fa3", "#f2c14e", "#e0673f"] },
  perso: { nom: "Personnalisé", sub: "Vos propres couleurs", couleurs: ["#5b2a86", "#8e44ad", "#f2c14e"] },
};
export const COULEURS_PERSO = { fond: "#4a1d6e", fond2: "#8e44ad", accent: "#f2c14e", texte: "#ffffff" };

// Couleurs personnalisées → variables CSS des supports (thème « perso »).
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const melange = (h, avec, t) => { const a = hexRgb(h), b = hexRgb(avec); return `#${a.map((x, i) => Math.round(x + (b[i] - x) * t).toString(16).padStart(2, "0")).join("")}`; };
export function styleTheme(e) {
  if (e?.theme !== "perso") return undefined;
  const c = { ...COULEURS_PERSO, ...Object.fromEntries(Object.entries(e.couleurs || {}).filter(([, v]) => v)) };
  const [r, g, b] = hexRgb(c.texte);
  return {
    "--e-bg": c.fond, "--e-bg2": c.fond2, "--e-or": c.accent, "--e-or2": melange(c.accent, "#ffffff", 0.55),
    "--e-texte": c.texte, "--e-doux": `rgba(${r},${g},${b},.78)`, "--e-papier": melange(c.accent, "#ffffff", 0.93), "--e-encre": c.fond, "--e-ligne": c.accent,
  };
}

export const STATUTS_EVT = { preparation: "En préparation", termine: "Terminé", annule: "Annulé" };
export const STATUTS_CARTE = { disponible: "Disponible", remise: "Chez un vendeur", vendue: "Vendue", annulee: "Annulée" };
export const COULEUR_CARTE = { disponible: "", remise: "gold", vendue: "green", annulee: "coral" };
export const STATUTS_INVITE = { a_inviter: "À inviter", invite: "Invitation remise", confirme: "A confirmé", excuse: "Excusé" };
export const COULEUR_INVITE = { a_inviter: "", invite: "teal", confirme: "green", excuse: "coral" };
export const CATEGORIES_INVITE = { officiel: "Autorité / officiel", partenaire: "Partenaire / sponsor", parent: "Parent d'élève", ancien: "Ancien élève", personnel: "Personnel de l'école", invite: "Invité" };
export const CIVILITES = ["M.", "Mme", "Mlle", "Dr", "Pr", "Abbé", "Père", "Sœur", "Imam", "S.E.", "Hon."];
export const POSTES_BUDGET = ["Sonorisation", "Décoration", "Restauration", "Location (chaises, bâches)", "Impression", "Tenues et costumes", "Cadeaux et distinctions", "Transport", "Animation", "Sponsor", "Don", "Participation des parents", "Autre"];

const anneeDe = (d) => Number(String(d || new Date().toISOString()).slice(0, 4));
export const FONDATION = 2006;

/** Valeurs de départ d'un nouvel événement selon son type (tout reste modifiable). */
export function modeleEvt(type, etab, dateEvt) {
  const ecole = etab?.nom || "l'école";
  const an = anneeDe(dateEvt);
  const base = { type, theme: "ecole", slogan: etab?.slogan || "", contact: (etab?.telephones || "").split("/")[0].trim(), lieu: "Dans l'enceinte de l'école", programme: [] };
  switch (type) {
    case "anniversaire": {
      const n = Math.max(1, an - FONDATION);
      return { ...base, theme: "prestige", titre: `Les ${n} ans de ${ecole}`, accroche: `${n} ans`, sous_titre: `${FONDATION} – ${an}`,
        programme: [{ heure: "15h00", titre: "Accueil des invités" }, { heure: "16h00", titre: "Mot de bienvenue et discours officiels" }, { heure: "16h45", titre: "Rétrospective : 20 ans d'histoire" },
          { heure: "17h30", titre: "Spectacle des élèves", detail: "Chants, danses, théâtre, majorettes" }, { heure: "19h00", titre: "Distinctions et remerciements" }, { heure: "20h00", titre: "Cocktail" }] };
    }
    case "fin_annee":
      return { ...base, theme: "festif", titre: `Fête de fin d'année ${an - 1}-${an}`, accroche: "Fête de fin d'année", sous_titre: `Année scolaire ${an - 1}-${an}`,
        programme: [{ heure: "15h00", titre: "Accueil des parents" }, { heure: "15h30", titre: "Spectacle des élèves" }, { heure: "17h30", titre: "Remise des prix d'excellence" }, { heure: "18h30", titre: "Clôture" }] };
    case "kermesse":
      return { ...base, theme: "festif", titre: `Kermesse ${an}`, accroche: "Kermesse", sous_titre: "Jeux · Stands · Tombola",
        programme: [{ heure: "10h00", titre: "Ouverture des stands" }, { heure: "11h00", titre: "Jeux et animations" }, { heure: "16h00", titre: "Tirage de la tombola" }, { heure: "18h00", titre: "Clôture" }] };
    case "noel":
      return { ...base, theme: "festif", titre: `Arbre de Noël ${an}`, accroche: "Joyeux Noël", sous_titre: "La fête des enfants",
        programme: [{ heure: "15h00", titre: "Accueil des enfants" }, { heure: "15h30", titre: "Chants et spectacle" }, { heure: "17h00", titre: "Arrivée du Père Noël et cadeaux" }, { heure: "18h00", titre: "Goûter" }] };
    case "culturelle":
      return { ...base, titre: `Journée culturelle ${an}`, accroche: "Journée culturelle", sous_titre: "Traditions, danses et saveurs",
        programme: [{ heure: "09h00", titre: "Défilé en tenues traditionnelles" }, { heure: "10h30", titre: "Danses et chants" }, { heure: "12h30", titre: "Dégustation de plats" }, { heure: "15h00", titre: "Clôture" }] };
    case "remise_prix":
      return { ...base, theme: "prestige", titre: `Cérémonie de remise des prix ${an}`, accroche: "Prix d'excellence", sous_titre: `Année scolaire ${an - 1}-${an}`,
        programme: [{ heure: "15h00", titre: "Accueil" }, { heure: "15h30", titre: "Discours" }, { heure: "16h00", titre: "Remise des prix" }, { heure: "17h30", titre: "Photo de famille et cocktail" }] };
    case "reunion":
      return { ...base, titre: "Assemblée générale des parents", accroche: "Réunion des parents", sous_titre: "Ensemble pour nos enfants",
        programme: [{ heure: "10h00", titre: "Accueil" }, { heure: "10h15", titre: "Mot de la Direction" }, { heure: "10h45", titre: "Questions des parents" }, { heure: "12h00", titre: "Fin" }] };
    default:
      return { ...base, titre: "", accroche: "", sous_titre: "" };
  }
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « samedi 19 décembre 2026 » */
export const jourLong = (d) => {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const x = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${JOURS[x.getDay()]} ${x.getDate()}${x.getDate() === 1 ? "er" : ""} ${MOIS[x.getMonth()]} ${x.getFullYear()}`;
};
export const quand = (e) => [jourLong(e.date_evt), e.heure && `à ${e.heure}`].filter(Boolean).join(" ");
export const nomInvite = (i) => [i.civilite, i.nom].filter(Boolean).join(" ");

export const messageInvitation = (i, e, etab) =>
  `Bonjour ${nomInvite(i)},\n\n${etab?.nom || "L'école"} a l'honneur de vous inviter à « ${e.titre} »${e.date_evt ? `, le ${quand(e)}` : ""}${e.lieu ? ` — ${e.lieu}` : ""}.\n\n` +
  `Invitation n° ${String(i.id).padStart(3, "0")}${i.places > 1 ? ` valable pour ${i.places} personnes` : ""}.\nMerci de nous confirmer votre présence${e.contact ? ` au ${e.contact}` : ""}.\n\nAvec nos salutations distinguées.`;

export const messageCarte = (c, e, etab) =>
  `Bonjour ${c.detenteur || ""},\n\nMerci pour votre soutien à « ${e.titre} » ! 🙏\nCarte de soutien n° ${String(c.numero).padStart(4, "0")} — ${new Intl.NumberFormat("fr-FR").format(c.paye || c.montant).replace(/ | /g, " ")} F.\n\n${etab?.nom || ""}`;
