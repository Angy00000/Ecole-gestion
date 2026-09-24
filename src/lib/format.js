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
