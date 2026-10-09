const nf = new Intl.NumberFormat("fr-FR");
export const fcfa = (n) => (n == null ? "—" : nf.format(Math.round(n)).replace(/\u202f|\u00a0/g, " ") + " F");
export const nombre = (n) => (n == null ? "—" : nf.format(n).replace(/\u202f|\u00a0/g, " "));

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const parseDate = (d) => {
  if (!d) return null;
  const s = String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
};
export const date = (d) => { const x = parseDate(d); return x ? `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}` : "—"; };
export const dateLongue = (d) => { const x = parseDate(d); return x ? `${x.getDate()} ${MOIS_LONG[x.getMonth()]} ${x.getFullYear()}` : "—"; };
export const moisCourt = (ym) => { const [y, m] = String(ym).split("-"); return `${MOIS[+m - 1]} ${String(y).slice(2)}`; };
export const dateHeure = (d) => { if (!d) return "—"; const x = new Date(d); return `${date(d)} à ${String(x.getHours()).padStart(2, "0")}h${String(x.getMinutes()).padStart(2, "0")}`; };
export const age = (d) => {
  const x = parseDate(d); if (!x) return null;
  const n = new Date(); let a = n.getFullYear() - x.getFullYear();
  if (n < new Date(n.getFullYear(), x.getMonth(), x.getDate())) a--;
  return a;
};
export const initiales = (prenom, nom) => `${(prenom || "?")[0]}${(nom || "")[0] || ""}`.toUpperCase();
export const today = () => new Date().toISOString().slice(0, 10);

export const ROLES = {
  admin: "Administrateur",
  direction: "Direction",
  comptable: "Comptable",
  secretaire: "Secrétariat",
  professeur: "Enseignant",
};
export const CYCLES = { garderie: "Garderie", prescolaire: "Préscolaire", elementaire: "Élémentaire" };

export const TYPES = {
  inscription: "Droit d'inscription", uniforme: "Uniforme", tenue_sport: "Tenue de sport", cantine: "Inscription cantine",
  mensualite: "Mensualité", fournitures: "Fournitures", cours_vacances: "Cours de vacances", transport: "Transport", autre: "Autre",
  cours_soir: "Cours du soir", cotisation: "Cotisation des fêtes", cantine_jour: "Cantine journalière",
};
export const TYPES_COURTS = { inscription: "Inscription", uniforme: "Uniforme", tenue_sport: "Tenue de sport", cantine: "Cantine", mensualite: "Mensualité", fournitures: "Fournitures", cours_vacances: "Cours de vacances", transport: "Transport", autre: "Autre", cours_soir: "Cours du soir", cotisation: "Cotisation fêtes", cantine_jour: "Cantine du jour" };
export const CATEGORIES_RECETTES = { dons: "Dons", subventions: "Subventions", location: "Location de locaux", evenements: "Fêtes et événements", ventes: "Ventes", cotisations: "Cotisations (APE…)", autre: "Autre" };
export const MODES = { especes: "Espèces", wave: "Wave", orange_money: "Orange Money", cheque: "Chèque", virement: "Virement" };
export const MODE_COULEUR = { especes: "var(--green)", wave: "#1da1f2", orange_money: "#f47b20", cheque: "var(--azure)", virement: "var(--teal)" };
export const CATEGORIES = {
  salaires: "Salaires", loyer: "Loyer", electricite_eau: "Électricité et eau", fournitures: "Fournitures", cantine: "Cantine",
  entretien: "Entretien et réparations", transport: "Transport", communication: "Téléphone et internet", evenements: "Fêtes et événements", impots: "Impôts et taxes", banque_asep: "Banque / Asep", bon_enseignant: "Bon enseignant", petit_dejeuner: "Petit déjeuner personnel", autre: "Autre",
};
const MOIS_L = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const moisLong = (ym) => { if (!ym) return ""; const [y, m] = String(ym).split("-"); return `${MOIS_L[+m - 1]} ${y}`; };
export const moisNom = (ym) => { if (!ym) return ""; const m = String(ym).split("-")[1]; const n = MOIS_L[+m - 1]; return n[0].toUpperCase() + n.slice(1); };
export const libelleLigne = (l) => (l.libelle ? l.libelle : l.type === "mensualite" ? `Mensualité ${moisLong(l.mois)}` : l.type === "cours_soir" && l.mois ? `Cours du soir ${moisLong(l.mois)}` : TYPES[l.type] || l.type);

// Montant en lettres (français, usage au Sénégal : soixante-dix, quatre-vingt-dix).
const U = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const D = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
function sous100(n) {
  if (n < 20) return U[n];
  const d = Math.floor(n / 10), u = n % 10;
  if (d === 7 || d === 9) return `${D[d]}${d === 7 && u === 1 ? "-et-" : "-"}${U[10 + u]}`;
  if (u === 0) return d === 8 ? "quatre-vingts" : D[d];
  if (u === 1 && d !== 8) return `${D[d]}-et-un`;
  return `${D[d]}-${U[u]}`;
}
function sous1000(n) {
  const c = Math.floor(n / 100), r = n % 100;
  const cent = c === 0 ? "" : c === 1 ? "cent" : `${U[c]} cent${r === 0 ? "s" : ""}`;
  return [cent, r ? sous100(r) : ""].filter(Boolean).join(" ");
}
export function enLettres(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return "zéro";
  const parts = [];
  const mds = Math.floor(n / 1e9), mil = Math.floor((n % 1e9) / 1e6), k = Math.floor((n % 1e6) / 1000), r = n % 1000;
  if (mds) parts.push(`${sous1000(mds)} milliard${mds > 1 ? "s" : ""}`);
  if (mil) parts.push(`${sous1000(mil)} million${mil > 1 ? "s" : ""}`);
  if (k) parts.push(k === 1 ? "mille" : `${sous1000(k).replace(/cents$/, "cent").replace(/vingts$/, "vingt")} mille`);
  if (r) parts.push(sous1000(r));
  return parts.join(" ");
}
export const telWa = (t) => { const d = String(t || "").replace(/\D/g, ""); return d.length === 9 ? "221" + d : d; };
const MOIS_ABR = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
export const moisAbr = (ym) => (ym ? MOIS_ABR[+String(ym).split("-")[1] - 1] : "");
export const JOURS = { 1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi" };
export const TRIMESTRES = { 1: "1er trimestre", 2: "2e trimestre", 3: "3e trimestre" };
export const note = (n, d = 2) => (n == null ? "—" : Number(n).toFixed(d).replace(".", ",").replace(/,00$/, ""));
export const trimestreCourant = () => { const m = new Date().getMonth() + 1; return m >= 9 || m <= 0 ? 1 : m <= 3 ? 2 : 3; };
