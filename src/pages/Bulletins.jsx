import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { note, date, TRIMESTRES } from "../lib/format";
import { Spinner, ErrorBox } from "../components/ui";

function Bulletin({ e, data, etab }) {
  const B = data.classe.bareme;
  const eff = data.stats.classes;
  return (
    <article className="bulletin">
      <header className="b-head">
        <div className="b-rep"><strong>République du Sénégal</strong><span>Un Peuple – Un But – Une Foi</span><span>Ministère de l'Éducation nationale</span></div>
        <div className="b-school"><img src="/logo.png" alt="" /><div><strong>{etab.nom}</strong><span>{etab.adresse} · Tél. {etab.telephones}</span><span>Autorisation {etab.autorisation}</span></div></div>
      </header>
      <div className="b-title">
        <h1>Bulletin de notes</h1>
        <span>{TRIMESTRES[data.trimestre]} · Année scolaire {data.classe.annee}</span>
      </div>
      <div className="b-ident">
        <div><span>Élève</span><strong>{e.prenom} {e.nom}</strong></div>
        <div><span>Matricule</span><strong>{e.matricule}</strong></div>
        <div><span>Né(e) le</span><strong>{e.date_naissance ? date(e.date_naissance) : "—"}{e.lieu_naissance ? ` à ${e.lieu_naissance}` : ""}</strong></div>
        <div><span>Classe</span><strong>{data.classe.nom} · {data.stats.effectif} élèves</strong></div>
      </div>
      <table className="b-table">
        <thead><tr><th>Matières</th><th>Coef.</th><th>Moyenne</th><th>Moy. × coef.</th><th>Moy. classe</th><th>Appréciation</th></tr></thead>
        <tbody>
          {e.lignes.map((l, i) => {
            const pond = l.moyenne != null ? (l.moyenne / l.bareme) * B * l.coefficient : null;
            const x = l.moyenne != null ? (l.moyenne / l.bareme) * 20 : null;
            const app = x == null ? "" : x >= 16 ? "Très bien" : x >= 14 ? "Bien" : x >= 12 ? "Assez bien" : x >= 10 ? "Passable" : "Insuffisant";
            return (
              <tr key={l.matiere_id}>
                <td>{l.matiere}{l.enseignant ? <small>{l.enseignant}</small> : null}</td>
                <td>{l.coefficient}</td>
                <td><strong>{note(l.moyenne)}</strong><small>/{l.bareme}</small></td>
                <td>{note(pond)}</td>
                <td>{note(data.stats.par_matiere[i])}</td>
                <td>{app}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="b-results">
        <div className="b-big"><span>Moyenne générale</span><strong>{note(e.moyenne)}<small> / {B}</small></strong></div>
        <div><span>Rang</span><strong>{e.rang ? `${e.rang}${e.rang === 1 ? (e.sexe === "F" ? "re" : "er") : "e"} / ${eff}` : "—"}</strong></div>
        <div><span>Moyenne de la classe</span><strong>{note(data.stats.moyenne)}</strong></div>
        <div><span>Plus forte / plus faible</span><strong>{note(data.stats.max)} / {note(data.stats.min)}</strong></div>
        <div><span>Absences</span><strong>{e.absences}{e.absences_justifiees ? ` (${e.absences_justifiees} justifiée${e.absences_justifiees > 1 ? "s" : ""})` : ""}{e.retards ? ` · ${e.retards} retard${e.retards > 1 ? "s" : ""}` : ""}</strong></div>
      </div>
      <div className="b-obs">
        <div className="b-box"><span>Appréciation du maître</span><p>{e.observation || e.mention || ""}</p>{e.decision && <p className="b-dec">Décision : <strong>{e.decision}</strong></p>}</div>
        <div className="b-sigs">
          <div className="b-box"><span>Le maître{data.classe.titulaire ? ` — ${data.classe.titulaire}` : ""}</span></div>
          <div className="b-box"><span>La Direction</span></div>
          <div className="b-box"><span>Signature du parent</span></div>
        </div>
      </div>
      <p className="b-motto">{etab.slogan}</p>
    </article>
  );
}

export default function Bulletins() {
  const s = useSession();
  const nav = useNavigate();
  const [p] = useSearchParams();
  const classe = p.get("classe"), trimestre = p.get("trimestre") || 1, seul = p.get("eleve");
  const { data, isLoading, error } = useQuery({ queryKey: ["bulletins", Number(classe), Number(trimestre)], queryFn: () => api.get("/bulletins", { classe_id: classe, trimestre }) });
  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 32 }}><ErrorBox error={error} /></div>;
  const eleves = data.eleves.filter((e) => !seul || String(e.eleve_id) === seul);
  return (
    <div className="print-page">
      <style>{"@page { size: A4 portrait; margin: 0; }"}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(-1)}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{eleves.length} bulletin{eleves.length > 1 ? "s" : ""}</strong> — {data.classe.nom}, {TRIMESTRES[data.trimestre]}</span>
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      <div className="tickets">{eleves.map((e) => <Bulletin key={e.inscription_id} e={e} data={data} etab={s.etablissement} />)}</div>
    </div>
  );
}
