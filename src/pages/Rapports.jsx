import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowDownLeft, ArrowUpRight, Scale, AlertTriangle, Download } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, moisLong, moisAbr, TYPES_COURTS, MODES, MODE_COULEUR, CATEGORIES, CATEGORIES_RECETTES, today } from "../lib/format";
import { Spinner, ErrorBox, PageHead, Select } from "../components/ui";

const PERIODES = {
  mois: () => [today().slice(0, 8) + "01", today()],
  trimestre: () => { const d = new Date(); const m = Math.floor(d.getMonth() / 3) * 3; return [`${d.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`, today()]; },
  annee: () => ["", ""],
};

function Barres({ data }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.eleves + d.autres, d.depenses || 0)));
  return (
    <div className="rep-bars">
      {data.map((d) => (
        <div key={d.mois} className="rep-col" title={`${moisLong(d.mois)} : entrées ${fcfa(d.eleves + d.autres)}${d.depenses != null ? `, dépenses ${fcfa(d.depenses)}` : ""}`}>
          <div className="rep-pair">
            <div className="rep-in" style={{ height: `${((d.eleves + d.autres) / max) * 100}%` }}><i style={{ height: `${d.eleves + d.autres ? (d.autres / (d.eleves + d.autres)) * 100 : 0}%` }} /></div>
            {d.depenses != null && <div className="rep-out" style={{ height: `${(d.depenses / max) * 100}%` }} />}
          </div>
          <span>{moisAbr(d.mois)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Rapports() {
  const s = useSession();
  const [periode, setPeriode] = useState("annee");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const choisir = (p) => { setPeriode(p); if (p !== "libre") { const [a, b] = PERIODES[p](s.annee); setDu(a); setAu(b); } };
  const { data, isLoading, error } = useQuery({ queryKey: ["rapport", du, au, s.annee?.id], queryFn: () => api.get("/rapport", { du, au, annee_id: s.annee?.id }) });
  const vDu = du || data?.du || "", vAu = au || data?.au || "";

  const exporter = () => {
    const L = [["Rapport financier", `${date(vDu)} au ${date(vAu)}`], [], ["Paiements des élèves"], ...data.par_type.map((t) => [TYPES_COURTS[t.type], t.montant]), ["Total élèves", data.totaux.eleves], [],
      ["Recettes diverses"], ...data.recettes.map((r) => [CATEGORIES_RECETTES[r.categorie], r.montant]), ["Total recettes diverses", data.totaux.autres], [],
      ...(data.totaux.depenses != null ? [["Dépenses"], ...data.depenses.map((d) => [CATEGORIES[d.categorie], d.montant]), ["Total dépenses", data.totaux.depenses], [], ["Solde", data.totaux.solde]] : []),
      [], ["Impayés à date", data.impayes.total]];
    const csv = "\ufeff" + L.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `rapport-${vDu}-${vAu}.csv`; a.click();
  };

  return (
    <div className="rapport">
      <PageHead title="Rapports" sub={`Bilan financier de l'école · ${s.etablissement.nom}`}>
        {data && <button className="btn" onClick={exporter}><Download size={17} /><span className="hide-m">Exporter</span></button>}
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </PageHead>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="toolbar">
          <div className="seg">
            {[["mois", "Ce mois"], ["trimestre", "Ce trimestre"], ["annee", "Année scolaire"], ["libre", "Période libre"]].map(([k, l]) => <button key={k} className={periode === k ? "on" : ""} onClick={() => choisir(k)}>{l}</button>)}
          </div>
          <div className="date-range">
            <input className="input" type="date" value={vDu} onChange={(e) => { setPeriode("libre"); setDu(e.target.value); if (!au) setAu(vAu); }} aria-label="Du" /><span className="muted">au</span>
            <input className="input" type="date" value={vAu} onChange={(e) => { setPeriode("libre"); setAu(e.target.value); if (!du) setDu(vDu); }} aria-label="Au" />
          </div>
        </div>
      </div>

      <p className="print-only" style={{ marginBottom: 12 }}><strong>{s.etablissement.nom}</strong> — Rapport financier du {date(vDu)} au {date(vAu)}</p>

      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : (
        <div className="dash">
          <div className="card kpi c3"><div className="top"><span className="label">Paiements des élèves</span><span className="ic green"><ArrowDownLeft size={20} /></span></div><div className="value">{fcfa(data.totaux.eleves)}</div><div className="sub">{data.nb.recus} reçus · {data.nb.eleves} élèves</div></div>
          <div className="card kpi c3"><div className="top"><span className="label">Recettes diverses</span><span className="ic teal"><ArrowDownLeft size={20} /></span></div><div className="value">{fcfa(data.totaux.autres)}</div><div className="sub">dons, locations, événements…</div></div>
          {data.totaux.depenses != null ? <>
            <div className="card kpi c3"><div className="top"><span className="label">Dépenses</span><span className="ic coral"><ArrowUpRight size={20} /></span></div><div className="value" style={{ color: "var(--coral)" }}>{fcfa(data.totaux.depenses)}</div><div className="sub">sur la période</div></div>
            <div className="card kpi c3" style={{ background: "linear-gradient(160deg, var(--teal-800), var(--teal-900))", color: "#fff", border: 0 }}><div className="top"><span className="label" style={{ color: "#a9d0d8" }}>Solde</span><span className="ic gold"><Scale size={20} /></span></div><div className="value" style={{ color: data.totaux.solde >= 0 ? "var(--gold)" : "#ffb49c" }}>{fcfa(data.totaux.solde)}</div><div className="sub" style={{ color: "#a9d0d8" }}>entrées − dépenses</div></div>
          </> : <div className="card kpi c6"><div className="top"><span className="label">Total des entrées</span></div><div className="value">{fcfa(data.totaux.entrees)}</div></div>}

          <div className="card c8">
            <div className="card-head"><h3>Évolution mensuelle</h3>
              <div className="legend"><span><i className="dot" style={{ background: "var(--teal)" }} />Élèves</span><span><i className="dot" style={{ background: "var(--gold)" }} />Recettes diverses</span>{data.totaux.depenses != null && <span><i className="dot" style={{ background: "var(--coral)" }} />Dépenses</span>}</div>
            </div>
            <div className="card-body"><Barres data={data.par_mois} /></div>
          </div>
          <div className="card c4">
            <div className="card-head"><h3>Par mode de paiement</h3></div>
            <div className="card-body mode-bars">
              {data.par_mode.length ? data.par_mode.map((m) => (
                <div key={m.mode} className="mode-bar"><span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: MODE_COULEUR[m.mode] }} /><strong>{MODES[m.mode]}</strong></span>
                  <div className="track"><i style={{ width: `${(m.montant / data.totaux.eleves) * 100}%`, background: MODE_COULEUR[m.mode] }} /></div><span className="amount">{fcfa(m.montant)}</span></div>
              )) : <p className="muted small">Aucun encaissement.</p>}
              <div className="alert" style={{ marginTop: 10 }}><AlertTriangle size={16} />Impayés au {date(au)} : {fcfa(data.impayes.total)} ({data.impayes.eleves} élèves)</div>
            </div>
          </div>

          <div className="card c4">
            <div className="card-head"><h3>Paiements des élèves</h3></div>
            <table className="table" style={{ marginTop: 14 }}><tbody>
              {data.par_type.map((t) => <tr key={t.type}><td>{TYPES_COURTS[t.type]}</td><td className="r amount">{fcfa(t.montant)}</td></tr>)}
              <tr style={{ background: "var(--surface-2)" }}><td><strong>Total</strong></td><td className="r amount" style={{ color: "var(--green)" }}>{fcfa(data.totaux.eleves)}</td></tr>
            </tbody></table>
          </div>
          <div className="card c4">
            <div className="card-head"><h3>Par classe</h3></div>
            <table className="table" style={{ marginTop: 14 }}><tbody>
              {data.par_classe.map((c) => <tr key={c.classe}><td><span className="chip">{c.classe}</span></td><td className="r amount">{fcfa(c.montant)}</td></tr>)}
              {!data.par_classe.length && <tr><td className="muted">Aucun paiement.</td></tr>}
            </tbody></table>
          </div>
          <div className="card c4">
            <div className="card-head"><h3>{data.totaux.depenses != null ? "Dépenses et recettes diverses" : "Recettes diverses"}</h3></div>
            <table className="table" style={{ marginTop: 14 }}><tbody>
              {data.recettes.map((r) => <tr key={"r" + r.categorie}><td>{CATEGORIES_RECETTES[r.categorie]}</td><td className="r amount" style={{ color: "var(--green)" }}>+{fcfa(r.montant)}</td></tr>)}
              {data.depenses.map((d) => <tr key={"d" + d.categorie}><td>{CATEGORIES[d.categorie]}</td><td className="r amount" style={{ color: "var(--coral)" }}>−{fcfa(d.montant)}</td></tr>)}
              {!data.recettes.length && !data.depenses.length && <tr><td className="muted">Aucun mouvement.</td></tr>}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}
