import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Plus, Search, Wallet, ChevronRight, Printer, ArrowDownLeft, ArrowUpRight, Receipt, Scale } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, initiales, MODES, MODE_COULEUR, TYPES_COURTS, CATEGORIES, today, dateLongue, libelleLigne, nombre } from "../lib/format";
import { Spinner, ErrorBox, Empty, PageHead, Select } from "../components/ui";
import Encaissement from "../components/Encaissement";

const debutMois = () => today().slice(0, 8) + "01";

function Recus() {
  const s = useSession();
  const nav = useNavigate();
  const [du, setDu] = useState(debutMois());
  const [au, setAu] = useState(today());
  const [mode, setMode] = useState("");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  const f = { annee_id: s.annee?.id, du, au, mode, q: dq, annules: "oui" };
  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["recus", f], queryFn: () => api.get("/recus", f), placeholderData: keepPreviousData });
  const maxMode = Math.max(1, ...(data?.modes || []).map((m) => m.montant));

  return (
    <div className="stack">
      {data && (
        <div className="dash">
          <div className="card c8">
            <div className="stat-strip">
              <div><div className="l">Total encaissé</div><div className="v" style={{ color: "var(--green)" }}>{fcfa(data.total)}</div></div>
              <div><div className="l">Reçus</div><div className="v">{data.nombre}</div></div>
              <div><div className="l">Montant moyen</div><div className="v">{fcfa(data.nombre ? data.total / data.nombre : 0)}</div></div>
              <div><div className="l">Période</div><div className="v" style={{ fontSize: 15 }}>{date(du)}<br />au {date(au)}</div></div>
            </div>
            <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {data.types.map((t) => <span key={t.type} className="badge teal" style={{ height: 30, padding: "0 12px" }}>{TYPES_COURTS[t.type]} · {fcfa(t.montant)}</span>)}
              </div>
            </div>
          </div>
          <div className="card c4">
            <div className="card-head"><h3>Par mode de paiement</h3></div>
            <div className="card-body mode-bars">
              {data.modes.length ? data.modes.map((m) => (
                <div key={m.mode} className="mode-bar">
                  <span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: MODE_COULEUR[m.mode] }} /><strong>{MODES[m.mode]}</strong></span>
                  <div className="track"><i style={{ width: `${(m.montant / maxMode) * 100}%`, background: MODE_COULEUR[m.mode] }} /></div>
                  <span className="amount">{fcfa(m.montant)}</span>
                </div>
              )) : <p className="muted small">Aucun encaissement sur la période.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="with-icon"><Search size={18} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Élève, matricule ou n° de reçu…" /></div>
          <div className="date-range">
            <input className="input" type="date" value={du} onChange={(e) => setDu(e.target.value)} aria-label="Du" />
            <span className="muted">au</span>
            <input className="input" type="date" value={au} onChange={(e) => setAu(e.target.value)} aria-label="Au" />
          </div>
          <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Mode"><option value="">Tous les modes</option>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </div>
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.rows.length ? (
          <Empty icon={Receipt} title="Aucun reçu sur cette période">Changez les dates ou enregistrez un encaissement.</Empty>
        ) : (
          <div className="table-wrap" style={{ opacity: isFetching ? 0.65 : 1 }}>
            <table className="table">
              <thead><tr><th>Reçu</th><th>Élève</th><th className="hide-m">Détail</th><th className="hide-m">Mode</th><th>Date</th><th className="r">Montant</th><th /></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => nav(`/recus/${r.id}`)} style={r.annule ? { opacity: 0.5 } : undefined}>
                    <td><span className="badge teal">{r.numero}</span>{r.annule && <span className="badge coral" style={{ marginLeft: 6 }}>Annulé</span>}</td>
                    <td><div className="person"><span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span><div><strong>{r.nom} {r.prenom}</strong><span>{r.classe} · {r.matricule}</span></div></div></td>
                    <td className="hide-m lines-mini">{(r.lignes || []).map(libelleLigne).join(", ")}</td>
                    <td className="hide-m"><span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: MODE_COULEUR[r.mode] }} />{MODES[r.mode]}</span></td>
                    <td className="num">{date(r.date_paiement)}</td>
                    <td className="r amount" style={r.annule ? { textDecoration: "line-through" } : { color: "var(--green)" }}>{fcfa(r.montant)}</td>
                    <td className="r"><ChevronRight size={18} className="go" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Caisse() {
  const s = useSession();
  const nav = useNavigate();
  const [jour, setJour] = useState(today());
  const { data, isLoading, error } = useQuery({ queryKey: ["caisse", jour], queryFn: () => api.get("/caisse", { date: jour }) });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const modes = Object.entries(data.modes).filter(([, v]) => v.entrees || v.sorties);
  return (
    <div className="stack caisse">
      <div className="card">
        <div className="card-head" style={{ paddingBottom: 16 }}>
          <h3>Journal de caisse du {dateLongue(jour)}</h3>
          <input className="input" type="date" value={jour} max={today()} onChange={(e) => setJour(e.target.value)} style={{ width: 170 }} aria-label="Jour" />
          <button className="btn" onClick={() => window.print()}><Printer size={16} />Imprimer</button>
        </div>
        <div className="stat-strip" style={{ borderTop: "1px solid var(--line)" }}>
          <div><div className="l row" style={{ gap: 6 }}><ArrowDownLeft size={14} />Entrées</div><div className="v" style={{ color: "var(--green)" }}>{fcfa(data.entrees)}</div></div>
          <div><div className="l row" style={{ gap: 6 }}><ArrowUpRight size={14} />Sorties</div><div className="v" style={{ color: "var(--coral)" }}>{fcfa(data.sorties)}</div></div>
          <div><div className="l row" style={{ gap: 6 }}><Scale size={14} />Solde du jour</div><div className="v">{fcfa(data.solde)}</div></div>
          <div><div className="l">Reçus émis</div><div className="v">{data.recus.filter((r) => !r.annule).length}</div></div>
        </div>
        {modes.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Mode</th><th className="r">Entrées</th><th className="r">Sorties</th><th className="r">Solde</th></tr></thead>
              <tbody>{modes.map(([k, v]) => <tr key={k}><td><span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: MODE_COULEUR[k] }} /><strong>{MODES[k]}</strong></span></td><td className="r num">{fcfa(v.entrees)}</td><td className="r num">{fcfa(v.sorties)}</td><td className="r amount">{fcfa(v.entrees - v.sorties)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head" style={{ paddingBottom: 14 }}><h3>Encaissements</h3><span className="badge green">{data.recus.length}</span></div>
        {data.recus.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Heure</th><th>Reçu</th><th>Élève</th><th className="hide-m">Motif</th><th className="hide-m">Mode</th><th className="hide-m">Par</th><th className="r">Montant</th></tr></thead>
            <tbody>{data.recus.map((r) => (
              <tr key={r.id} className="click" onClick={() => nav(`/recus/${r.id}`)} style={r.annule ? { opacity: 0.45, textDecoration: "line-through" } : undefined}>
                <td className="num">{new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</td>
                <td><strong>{r.numero}</strong></td>
                <td>{r.prenom} {r.nom} <span className="muted small">({r.classe})</span></td>
                <td className="hide-m small">{(r.types || "").split(",").map((t) => TYPES_COURTS[t]).join(", ")}</td>
                <td className="hide-m">{MODES[r.mode]}</td>
                <td className="hide-m small muted">{r.encaisse_par_nom}</td>
                <td className="r amount">{fcfa(r.montant)}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <Empty icon={Wallet} title="Aucun encaissement ce jour" />}
      </div>

      <div className="card">
        <div className="card-head" style={{ paddingBottom: 14 }}><h3>Dépenses</h3><span className="badge coral">{data.depenses.length}</span></div>
        {data.depenses.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Libellé</th><th className="hide-m">Catégorie</th><th className="hide-m">Bénéficiaire</th><th className="hide-m">Mode</th><th className="r">Montant</th></tr></thead>
            <tbody>{data.depenses.map((d) => <tr key={d.id}><td><strong>{d.libelle}</strong></td><td className="hide-m">{CATEGORIES[d.categorie]}</td><td className="hide-m">{d.beneficiaire || "—"}</td><td className="hide-m">{MODES[d.mode]}</td><td className="r amount" style={{ color: "var(--coral)" }}>−{fcfa(d.montant)}</td></tr>)}</tbody>
          </table></div>
        ) : <Empty icon={Receipt} title="Aucune dépense ce jour" />}
      </div>
      <p className="small muted print-only">Arrêté le journal de caisse du {dateLongue(jour)} — solde {fcfa(data.solde)}. Signature : ____________________</p>
    </div>
  );
}

export default function Encaissements() {
  const s = useSession();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("vue") || "recus";
  const [enc, setEnc] = useState(false);
  return (
    <>
      <PageHead title="Encaissements" sub={`Paiements des élèves — année ${s.annee?.libelle}`}>
        <div className="tabs">
          <button className={tab === "recus" ? "on" : ""} onClick={() => setParams({})}><Receipt size={16} />Reçus</button>
          <button className={tab === "caisse" ? "on" : ""} onClick={() => setParams({ vue: "caisse" })}><Scale size={16} />Journal de caisse</button>
        </div>
        {s.peut("finances.encaisser") && <button className="btn primary" onClick={() => setEnc(true)}><Plus size={17} />Nouvel encaissement</button>}
      </PageHead>
      {tab === "caisse" ? <Caisse /> : <Recus />}
      {enc && <Encaissement onClose={() => setEnc(false)} onSaved={(r) => { setEnc(false); nav(`/recus/${r.id}`); }} />}
    </>
  );
}
