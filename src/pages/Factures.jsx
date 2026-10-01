import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useNavigate as useNav } from "react-router-dom";
import { ArrowLeft, Printer, FileText, MessageCircle, Search } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, initiales, moisLong, moisAbr, enLettres, telWa, nombre } from "../lib/format";
import { Select, Spinner, ErrorBox, Empty, PageHead } from "../components/ui";

const moisDe = (a) => { const out = []; if (!a) return out; const d = new Date(a.debut); d.setDate(1); const f = new Date(a.fin); while (d <= f) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() + 1); } return out; };
const moisSuivant = () => { const n = new Date(); const d = n.getDate() >= 20 ? new Date(n.getFullYear(), n.getMonth() + 1, 1) : new Date(n.getFullYear(), n.getMonth(), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export const messageFacture = (r, etab, mois) => `Bonjour ${r.parent || ""}, voici la facture de ${moisLong(mois)} pour ${r.prenom} ${r.nom} (${r.classe}) — ${etab.nom}.
${r.reste_mois ? `Mensualité ${moisLong(mois)} : ${fcfa(r.reste_mois)}\n` : ""}${r.arrieres ? `Mois en retard (${r.mois_retard.map(moisAbr).join(", ")}) : ${fcfa(r.arrieres)}\n` : ""}${r.frais_reste ? `Frais d'inscription, uniforme et tenue restants : ${fcfa(r.frais_reste)}\n` : ""}Total à payer : ${fcfa(r.total)}.
Merci de régler au secrétariat (espèces, Wave ou Orange Money). Facture n° ${r.numero}.`;

export default function Factures() {
  const s = useSession();
  const nav = useNavigate();
  const mois = moisDe(s.annee);
  const def = mois.includes(moisSuivant()) ? moisSuivant() : mois.find((m) => m >= new Date().toISOString().slice(0, 7)) || mois[0];
  const [m, setM] = useState(def);
  const [classe, setClasse] = useState("");
  const [tous, setTous] = useState(false);
  const [q, setQ] = useState("");
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const { data, isLoading, error } = useQuery({ queryKey: ["factures", m, classe, s.annee?.id], queryFn: () => api.get("/factures", { mois: m, classe_id: classe, annee_id: s.annee?.id }), enabled: !!m });
  const rows = (data?.rows || []).filter((r) => (tous || r.total > 0) && (!q || `${r.nom} ${r.prenom} ${r.matricule}`.toLowerCase().includes(q.toLowerCase())));
  const imprimer = (eleve) => nav(`/factures/imprimer?mois=${m}${classe ? `&classe=${classe}` : ""}${eleve ? `&eleve=${eleve}` : ""}${tous ? "&tous=1" : ""}`);

  return (
    <>
      <PageHead title="Factures mensuelles" sub={`À remettre aux élèves en fin de mois — ${moisLong(m)}`}>
        {rows.length > 0 && <button className="btn primary" onClick={() => imprimer()}><Printer size={17} />Imprimer {rows.length} facture{rows.length > 1 ? "s" : ""}</button>}
      </PageHead>
      {data && (
        <div className="dash" style={{ marginBottom: 22 }}>
          <div className="card kpi c4"><div className="top"><span className="label">Factures à remettre</span><span className="ic teal"><FileText size={20} /></span></div><div className="value">{data.a_payer}</div><div className="sub">élèves qui ont un montant à payer</div></div>
          <div className="card kpi c8"><div className="top"><span className="label">Montant total facturé pour {moisLong(m)}</span></div><div className="value">{nombre(data.total)}<small>F</small></div><div className="sub">mensualité du mois + retards + frais d'inscription restants</div></div>
        </div>
      )}
      <div className="card">
        <div className="toolbar">
          <Select value={m} onChange={(e) => setM(e.target.value)} aria-label="Mois">{mois.map((x) => <option key={x} value={x}>Facture de {moisLong(x)}</option>)}</Select>
          <Select value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe"><option value="">Toutes les classes</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select>
          <div className="with-icon"><Search size={18} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un élève…" /></div>
          <span className="spacer" />
          <label className="check small"><input type="checkbox" checked={tous} onChange={(e) => setTous(e.target.checked)} />Inclure les élèves à jour</label>
        </div>
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !rows.length ? (
          <Empty icon={FileText} title="Aucune facture à remettre">Tous les élèves sont à jour pour {moisLong(m)}.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Élève</th><th>Classe</th><th className="r">Mois</th><th className="r hide-m">Retards</th><th className="r hide-m">Frais d'entrée</th><th className="r">Total</th><th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.inscription_id}>
                  <td><div className="person"><span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span><div><strong>{r.nom} {r.prenom}</strong><span>{r.numero}</span></div></div></td>
                  <td><span className={`chip ${r.cycle}`}>{r.classe}</span></td>
                  <td className="r num">{r.reste_mois ? fcfa(r.reste_mois) : <span className="muted">—</span>}</td>
                  <td className="r num hide-m">{r.arrieres ? <span style={{ color: "var(--coral)" }}>{fcfa(r.arrieres)}</span> : <span className="muted">—</span>}</td>
                  <td className="r num hide-m">{r.frais_reste ? fcfa(r.frais_reste) : <span className="muted">—</span>}</td>
                  <td className="r amount">{fcfa(r.total)}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    {r.telephone && r.total > 0 && <a className="btn sm wa" href={`https://wa.me/${telWa(r.telephone)}?text=${encodeURIComponent(messageFacture(r, s.etablissement, m))}`} target="_blank" rel="noreferrer" title="Envoyer par WhatsApp"><MessageCircle size={15} /></a>}
                    <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => imprimer(r.eleve_id)}><Printer size={15} /><span className="hide-m">Imprimer</span></button>
                  </td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Facture({ r, mois, etab }) {
  return (
    <article className="ticket facture">
      <header className="t-head">
        <img src="/logo.png" alt="" />
        <div className="t-school"><strong>{etab.nom}</strong><span>{etab.adresse}</span><span>Tél. {etab.telephones}</span>
          <span>{etab.autorisation && `Autorisation ${etab.autorisation}`}{etab.ninea && ` · NINEA ${etab.ninea}`}</span></div>
      </header>
      <div className="t-title">
        <div><h1>Facture</h1><span className="t-copy">Mois de {moisLong(mois)}</span></div>
        <div className="t-num"><span>N°</span><strong>{r.numero}</strong></div>
      </div>
      <dl className="t-info">
        <div><dt>Élève</dt><dd>{r.prenom} {r.nom}</dd></div>
        <div><dt>Matricule</dt><dd>{r.matricule}</dd></div>
        <div><dt>Classe</dt><dd>{r.classe}</dd></div>
        <div><dt>Date</dt><dd>{date(new Date().toISOString().slice(0, 10))}</dd></div>
      </dl>
      <table className="t-lines">
        <thead><tr><th>Désignation</th><th>Montant</th></tr></thead>
        <tbody>
          {r.du_mois > 0 && <tr><td>Mensualité {moisLong(mois)}{r.paye_mois > 0 ? ` (déjà payé ${fcfa(r.paye_mois)})` : ""}</td><td>{fcfa(r.reste_mois)}</td></tr>}
          {r.arrieres > 0 && <tr><td>Mois en retard : {r.mois_retard.map(moisLong).join(", ")}</td><td>{fcfa(r.arrieres)}</td></tr>}
          {r.frais_reste > 0 && <tr><td>Frais d'inscription, uniforme et tenue restants</td><td>{fcfa(r.frais_reste)}</td></tr>}
          {r.total === 0 && <tr><td>Aucun montant dû pour ce mois. Merci !</td><td>0 F</td></tr>}
        </tbody>
        <tfoot><tr><td>Total à payer</td><td>{fcfa(r.total)}</td></tr></tfoot>
      </table>
      {r.total > 0 && <p className="t-words">Arrêtée la présente facture à la somme de <strong>{enLettres(r.total)} francs CFA</strong>.</p>}
      <p className="t-note" style={{ fontStyle: "normal" }}>Paiement au secrétariat : espèces, Wave ou Orange Money. Merci de présenter cette facture lors du règlement.{mois.endsWith("-01") || mois.endsWith("-02") ? " Janvier et février incluent chacun une moitié de la mensualité de juin." : ""}</p>
      <footer className="t-foot"><div><span>Pour la Direction</span><strong>{etab.directeur || ""}</strong></div><div className="t-sign"><span>Cachet</span></div></footer>
      <p className="t-motto">{etab.slogan}</p>
    </article>
  );
}

export function FacturesImpression() {
  const s = useSession();
  const nav = useNav();
  const [p] = useSearchParams();
  const mois = p.get("mois"), tous = p.get("tous") === "1";
  const { data, isLoading, error } = useQuery({ queryKey: ["factures", mois, p.get("classe") || "", p.get("eleve") || "", s.annee?.id], queryFn: () => api.get("/factures", { mois, classe_id: p.get("classe"), eleve_id: p.get("eleve"), annee_id: s.annee?.id }) });
  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 32 }}><ErrorBox error={error} /></div>;
  const rows = data.rows.filter((r) => tous || p.get("eleve") || r.total > 0);
  return (
    <div className="print-page">
      <style>{"@page { size: A5 portrait; margin: 0; }"}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(-1)}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{rows.length} facture{rows.length > 1 ? "s" : ""}</strong> — {moisLong(mois)}</span>
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      <div className="tickets">{rows.map((r) => <Facture key={r.inscription_id} r={r} mois={mois} etab={s.etablissement} />)}</div>
    </div>
  );
}
