import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Printer, ArrowLeft, Stethoscope, Users, House, Hospital, Pill, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, dateLongue, fcfa, moisNom } from "../lib/format";
import { Spinner, ErrorBox, Periode, periodes } from "../components/ui";
import { EnTete } from "./Documents";
import Partager from "../components/Partager";

const SUITES = { classe: "Retour en classe", repos: "Repos à l'infirmerie", maison: "Renvoyés à la maison", hopital: "Orientés vers l'hôpital" };
const nomMois = (m) => `${moisNom(m)} ${m.slice(0, 4)}`;

// Barres horizontales simples : libellé, barre, nombre
function Barres({ rows, label, valeur = "n", couleur = "var(--teal)" }) {
  const max = Math.max(1, ...rows.map((r) => r[valeur] || 0));
  if (!rows.length) return <p className="muted small">Aucune donnée.</p>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 38%) 1fr 36px", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label(r)}>{label(r)}</span>
          <span className="fill" style={{ height: 10 }}><i style={{ width: `${((r[valeur] || 0) / max) * 100}%`, background: couleur }} /></span>
          <strong className="num" style={{ textAlign: "right" }}>{r[valeur] || 0}</strong>
        </div>
      ))}
    </div>
  );
}

function Contenu({ data }) {
  const t = data.totaux;
  return (
    <>
      <div className="dash" style={{ marginBottom: 22 }}>
        {[["Passages", t.passages, Stethoscope, "teal"], ["Élèves vus", t.eleves, Users, "azure"], ["Renvoyés à la maison", t.maison, House, "gold"], ["Vers l'hôpital", t.hopital, Hospital, "coral"]].map(([l, n, I, c]) => (
          <div key={l} className="card kpi c3"><div className="top"><span className="label">{l}</span><span className={`ic ${c}`}><I size={20} /></span></div><div className="value">{n}</div></div>
        ))}
      </div>
      <div className="dash" style={{ marginBottom: 22 }}>
        <div className="card c6"><div className="card-head"><h3>Passages par mois</h3></div><div className="card-body"><Barres rows={data.mois} label={(r) => nomMois(r.mois)} /></div></div>
        <div className="card c6"><div className="card-head"><h3>Passages par classe</h3></div><div className="card-body"><Barres rows={data.classes} label={(r) => r.classe} couleur="var(--azure)" /></div></div>
        <div className="card c6"><div className="card-head"><h3>Motifs les plus fréquents</h3></div><div className="card-body"><Barres rows={data.motifs} label={(r) => r.motif} couleur="var(--gold)" /></div></div>
        <div className="card c6"><div className="card-head"><h3>Suite donnée</h3></div><div className="card-body"><Barres rows={data.suites} label={(r) => SUITES[r.suite] || r.suite} couleur="var(--green)" /></div></div>
      </div>
      <div className="dash">
        <div className="card c7">
          <div className="card-head"><h3>Médicaments et matériel</h3><span className="badge teal"><Wallet size={13} />Achats : {fcfa(data.achats.montant)}</span></div>
          {data.produits.length ? <div className="table-wrap"><table className="table">
            <thead><tr><th>Produit</th><th className="r">Donnés</th><th className="r">Entrés</th><th className="r">Périmés</th></tr></thead>
            <tbody>{data.produits.map((p) => <tr key={p.nom}><td><strong>{p.nom}</strong></td><td className="r num">{p.donnes || 0}</td><td className="r num">{p.entres || 0}</td><td className="r num">{p.perimes || 0}</td></tr>)}</tbody>
          </table></div> : <div className="card-body"><p className="muted small">Aucun mouvement de stock sur la période.</p></div>}
        </div>
        <div className="card c5">
          <div className="card-head"><h3>À suivre</h3></div>
          <div className="card-body stack" style={{ gap: 14 }}>
            <div>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Élèves venus 3 fois ou plus</div>
              {data.eleves_frequents.length ? data.eleves_frequents.map((e) => <div key={e.eleve} className="small">{e.eleve} <span className="muted">({e.classe || "—"})</span> : <strong>{e.n}</strong> passages</div>) : <p className="muted small">Aucun.</p>}
            </div>
            <div>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Stock à surveiller aujourd'hui</div>
              {data.alertes_stock.length ? data.alertes_stock.map((p) => <div key={p.nom} className="small"><Pill size={12} /> {p.nom} : <strong style={{ color: p.stock <= p.seuil ? "var(--coral)" : undefined }}>{p.stock} {p.unite}</strong>{p.peremption ? <span className="muted"> · périme le {date(p.peremption)}</span> : ""}</div>) : <p className="muted small">Rien à signaler.</p>}
            </div>
            <div className="small muted">Parents prévenus : {t.parents_prevenus}/{t.passages} passages · Fièvres (≥ 38 °C) : {t.fievres}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export function Rapport() {
  const s = useSession();
  const nav = useNavigate();
  const [du, setDu] = useState(() => periodes(s.annee).annee.du);
  const [au, setAu] = useState(() => periodes(s.annee).annee.au);
  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["infirmerie-rapport", du, au], queryFn: () => api.get("/infirmerie/rapport", { du, au }), placeholderData: keepPreviousData });
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card"><div className="toolbar" style={{ justifyContent: "space-between" }}>
        <Periode annee={s.annee} du={du} au={au} onChange={(d, f) => { setDu(d); setAu(f); }} />
        <button className="btn primary" onClick={() => nav(`/infirmerie/rapport?du=${du}&au=${au}`)}><Printer size={17} />Imprimer ou envoyer</button>
      </div></div>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : <div style={{ opacity: isFetching ? 0.65 : 1 }}><Contenu data={data} /></div>}
    </div>
  );
}

// Version imprimable (A4), avec PDF et envoi WhatsApp
export function RapportImpression() {
  const s = useSession();
  const nav = useNavigate();
  const [p] = useSearchParams();
  const du = p.get("du"), au = p.get("au");
  const { data, isLoading, error } = useQuery({ queryKey: ["infirmerie-rapport", du, au], queryFn: () => api.get("/infirmerie/rapport", { du, au }) });
  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 32 }}><ErrorBox error={error} /></div>;
  const etab = s.etablissement, t = data.totaux;
  const titre = `Rapport de l'infirmerie du ${date(du)} au ${date(au)}`;
  const T = ({ titre: h, rows, cols }) => <><h3 style={{ margin: "18px 0 6px", fontSize: 14, color: "#123f4a" }}>{h}</h3>
    {rows.length ? <table className="b-table d-list"><thead><tr>{cols.map(([l]) => <th key={l}>{l}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{cols.map(([l, f]) => <td key={l}>{f(r)}</td>)}</tr>)}</tbody></table> : <p style={{ fontSize: 12 }}>Aucune donnée.</p>}</>;
  return (
    <div className="print-page">
      <style>{"@page { size: A4 portrait; margin: 0; }"}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(-1)}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>Rapport de l'infirmerie</strong> — {date(du)} au {date(au)}</span>
        <Partager format="A4" nom={`Rapport-infirmerie-${du}-${au}`} message={`${titre} — ${etab.nom}`} />
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      <div className="tickets">
        <article className="doc a4 etat">
          <EnTete etab={etab} />
          <h1 className="d-title">Rapport de l'infirmerie</h1>
          <p className="d-num">Du {dateLongue(du)} au {dateLongue(au)}</p>
          <table className="b-table d-list"><tbody>
            <tr><td>Passages à l'infirmerie</td><td><strong>{t.passages}</strong></td><td>Élèves différents</td><td><strong>{t.eleves}</strong></td></tr>
            <tr><td>Renvoyés à la maison</td><td><strong>{t.maison}</strong></td><td>Orientés vers l'hôpital</td><td><strong>{t.hopital}</strong></td></tr>
            <tr><td>Parents prévenus</td><td><strong>{t.parents_prevenus}</strong></td><td>Fièvres (≥ 38 °C)</td><td><strong>{t.fievres}</strong></td></tr>
            <tr><td>Achats de l'infirmerie</td><td colSpan={3}><strong>{fcfa(data.achats.montant)}</strong> ({data.achats.nombre} achat{data.achats.nombre > 1 ? "s" : ""})</td></tr>
          </tbody></table>
          <T titre="Passages par mois" rows={data.mois} cols={[["Mois", (r) => nomMois(r.mois)], ["Passages", (r) => r.n]]} />
          <T titre="Passages par classe" rows={data.classes} cols={[["Classe", (r) => r.classe], ["Passages", (r) => r.n], ["Élèves", (r) => r.eleves]]} />
          <T titre="Motifs les plus fréquents" rows={data.motifs} cols={[["Motif", (r) => r.motif], ["Passages", (r) => r.n]]} />
          <T titre="Médicaments et matériel" rows={data.produits} cols={[["Produit", (r) => r.nom], ["Donnés", (r) => r.donnes || 0], ["Entrés", (r) => r.entres || 0], ["Périmés", (r) => r.perimes || 0]]} />
          <T titre="Élèves venus 3 fois ou plus" rows={data.eleves_frequents} cols={[["Élève", (r) => r.eleve], ["Classe", (r) => r.classe || "—"], ["Passages", (r) => r.n]]} />
          <T titre="Stock à surveiller" rows={data.alertes_stock} cols={[["Produit", (r) => r.nom], ["En stock", (r) => `${r.stock} ${r.unite}`], ["Alerte à", (r) => r.seuil], ["Péremption", (r) => (r.peremption ? date(r.peremption) : "—")]]} />
          <div className="d-sign"><p>Fait à {etab.ville || "Malika"}, le {dateLongue(new Date().toISOString().slice(0, 10))}</p><p className="d-sign-t">L'infirmerie</p></div>
        </article>
      </div>
    </div>
  );
}
