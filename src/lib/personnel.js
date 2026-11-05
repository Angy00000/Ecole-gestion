// Services du personnel de l'école (l'ordre est celui de l'affichage).
export const SERVICES = {
  direction: { nom: "Direction", ic: "🏛️", poste: "Directrice / Directeur" },
  administration: { nom: "Administration et secrétariat", ic: "🗂️", poste: "Secrétaire, comptable…" },
  enseignant: { nom: "Enseignants", ic: "👩🏾‍🏫", poste: "Instituteur, professeur d'anglais…" },
  surveillance: { nom: "Surveillance", ic: "🧭", poste: "Surveillant(e)" },
  infirmerie: { nom: "Infirmerie", ic: "🩺", poste: "Infirmière" },
  cantine: { nom: "Cantine et cuisine", ic: "🍽️", poste: "Cuisinière, aide-cuisinière" },
  garderie: { nom: "Garderie", ic: "🧸", poste: "Nounou" },
  entretien: { nom: "Entretien et ménage", ic: "🧹", poste: "Agent d'entretien" },
  gardiennage: { nom: "Gardiennage et sécurité", ic: "🛡️", poste: "Gardien" },
  transport: { nom: "Transport", ic: "🚌", poste: "Chauffeur" },
  autre: { nom: "Autres", ic: "👤", poste: "" },
};
export const CONTRATS = { cdi: "CDI", cdd: "CDD", vacataire: "Vacataire", stagiaire: "Stagiaire", benevole: "Bénévole", prestataire: "Prestataire" };
export const TYPES_ABS = { absence: "Absence", retard: "Retard", conge: "Congé", permission: "Permission", maladie: "Maladie", formation: "Formation" };
export const COULEUR_ABS = { absence: "coral", retard: "gold", conge: "teal", permission: "teal", maladie: "rose", formation: "green" };
export const service = (p) => SERVICES[p?.service] || SERVICES.autre;
// Services en plus du service principal (une personne peut être dans plusieurs services).
export const autresServices = (p) => String(p?.autres_services || "").split(",").filter((x) => x && x !== p?.service && SERVICES[x]);
export const tousServices = (p) => [p?.service || "autre", ...autresServices(p)];
export const dansService = (p, k) => tousServices(p).includes(k);
