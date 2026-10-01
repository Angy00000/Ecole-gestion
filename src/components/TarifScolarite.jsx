import { Money } from "./ui";
import { fcfa } from "../lib/format";

// Formule de scolarité : normal, mensualité personnalisée, mensualités offertes, gratuité totale.
export const formule = (v) => (v.gratuit && v.inscription_offerte ? "gratuit_total" : v.gratuit ? "mensualites_offertes" : v.mensualite_speciale ? "perso" : "normal");
export const FORMULES = { normal: "Normal", perso: "Mensualité perso", mensualites_offertes: "Mensualités offertes", gratuit_total: "Gratuité totale" };

export default function TarifScolarite({ value, onChange, normal }) {
  const mode = formule(value);
  const set = (m) => onChange({
    normal: { gratuit: false, inscription_offerte: false, mensualite_speciale: null },
    perso: { gratuit: false, inscription_offerte: false, mensualite_speciale: value.mensualite_speciale || normal || null },
    mensualites_offertes: { gratuit: true, inscription_offerte: false, mensualite_speciale: null },
    gratuit_total: { gratuit: true, inscription_offerte: true, mensualite_speciale: null, reduction_inscription: 0 },
  }[m]);
  const aide = {
    normal: `Tarif de la classe${normal ? ` : ${fcfa(normal)} par mois` : ""}.`,
    perso: "Janvier et février sont majorés de 50 % (part de juin), comme pour les autres élèves.",
    mensualites_offertes: "L'élève paie le droit d'inscription, mais aucune mensualité : il n'apparaîtra jamais dans les impayés de mensualités.",
    gratuit_total: "Ni droit d'inscription ni mensualités. Uniforme, cantine, fournitures, cours du soir et autres paiements restent dus.",
  }[mode];
  return (
    <div className="field">
      <label>Formule de scolarité</label>
      <div className="formules">
        {Object.entries(FORMULES).map(([k, l]) => <button key={k} type="button" className={`formule ${mode === k ? "on" : ""}`} onClick={() => set(k)}>{l}</button>)}
      </div>
      {mode === "perso" && <Money value={value.mensualite_speciale} onChange={(x) => onChange({ gratuit: false, inscription_offerte: false, mensualite_speciale: x })} placeholder="Montant par mois" aria-label="Mensualité personnalisée" />}
      <span className="hint">{aide}</span>
    </div>
  );
}

export function BadgeFormule({ v, style }) {
  const m = formule(v);
  const red = v.reduction_inscription > 0 && !v.inscription_offerte ? <span className="badge gold" style={style}>Réduction inscription −{fcfa(v.reduction_inscription)}</span> : null;
  if (m === "normal") return red;
  const cls = { perso: "gold", mensualites_offertes: "teal", gratuit_total: "green" }[m];
  return <>{red}<span className={`badge ${cls}`} style={style}>{m === "perso" ? `Mensualité perso${v.mensualite_speciale ? ` : ${fcfa(v.mensualite_speciale)}` : ""}` : FORMULES[m]}</span></>;
}

// Réduction (en francs) sur le droit d'inscription.
export function ReductionInscription({ value, onChange, droit }) {
  if (value.inscription_offerte) return null;
  const r = value.reduction_inscription || 0;
  return (
    <div className="field">
      <label>Réduction sur le droit d'inscription</label>
      <Money value={r || null} onChange={(x) => onChange({ reduction_inscription: Math.min(x || 0, droit || x || 0) })} placeholder="0" aria-label="Réduction sur le droit d'inscription" />
      <span className="hint">{r > 0 && droit ? `Droit d'inscription : ${fcfa(droit)} − ${fcfa(r)} = ${fcfa(Math.max(droit - r, 0))}` : "Laisser vide s'il n'y a pas de réduction."}</span>
    </div>
  );
}
