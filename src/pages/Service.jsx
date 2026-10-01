import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Wallet, Search, Utensils, Shirt, PencilRuler, MoonStar, PartyPopper, CheckCircle2, Clock, Printer } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, initiales, moisAbr, nombre } from "../lib/format";
import { Select, Spinner, ErrorBox, Empty, PageHead } from "../components/ui";
import Encaissement from "../components/Encaissement";

const CONF = {
  cantine: { titre: "Cantine", icon: Utensils, tone: "coral", sub: "Demi-pensionnaires et repas payés au jour", attendu: "Inscriptions cantine attendues" },
  uniforme: { titre: "Uniformes et tenues de sport", icon: Shirt, tone: "teal", sub: "Uniformes et tenues de sport commandés à l'inscription", attendu: "Total attendu" },
  fournitures: { titre: "Fournitures", icon: PencilRuler, tone: "gold", sub: "Paiements des fournitures scolaires", attendu: "Total attendu" },
  cours_soir: { titre: "Cours du soir", icon: MoonStar, tone: "azure", sub: "Élèves inscrits aux cours du soir et mois payés", attendu: null },
  cotisation: { titre: "Cotisation des fêtes", icon: PartyPopper, tone: "rose", sub: "Cotisations pour les fêtes de l'école", attendu: "Total attendu" },
};

export default function Service() {
  const { type } = useParams();
  const c = CONF[type];
  const s = useSession();
  const nav = useNavigate();
  const [classe, setClasse] = useState("");
  const [filtre, setFiltre] = useState(type === "cours_soir" ? "payeurs" : type === "cantine" ? "cantine" : "tous");
  const [q, setQ] = useState("");
  const [enc, setEnc] = useState(null);
  useEffect(() => { setFiltre(type === "cours_soir" ? "payeurs" : type === "cantine" ? "cantine" : "tous"); }, [type]);
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const { data, isLoading, error } = useQuery({ queryKey: ["service", type, s.annee?.id, classe], queryFn: () => api.get(`/services/${type}`, { annee_id: s.annee?.id, classe_id: classe }) });
  if (!c) return <Empty title="Rubrique inconnue" />;

  const statut = (r) => r.du == null ? (r.paye > 0 ? "paye" : "aucun") : r.du === 0 ? (r.paye > 0 ? "paye" : "non_concerne") : r.paye >= r.du ? "paye" : r.paye > 0 ? "partiel" : "du";
  const rows = (data?.rows || []).filter((r) => {
    const st = statut(r);
    if (q && !`${r.nom} ${r.prenom} ${r.matricule}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filtre === "payes") return st === "paye";
    if (filtre === "non_payes") return st === "du" || st === "partiel";
    if (filtre === "payeurs") return r.paye > 0;
    if (filtre === "cantine") return r.cantine || r.paye > 0;
    return true;
  });
  const exporter = () => {
    const L = [["Matricule", "Nom", "Prénom", "Classe", ...(type === "cantine" ? ["Demi-pensionnaire"] : []), "Attendu", "Payé", "Reste", ...(type === "cours_soir" ? ["Mois payés"] : []), "Dernier paiement"],
      ...rows.map((r) => [r.matricule, r.nom, r.prenom, r.classe, ...(type === "cantine" ? [r.cantine ? "Oui" : "Non"] : []), r.du ?? "", r.paye, r.du ? Math.max(r.du - r.paye, 0) : "", ...(type === "cours_soir" ? [r.mois || ""] : []), r.dernier || ""])];
    const csv = "\ufeff" + L.map((x) => x.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `${type}-${s.annee?.libelle}.csv`; a.click();
  };
  const I = c.icon;
  const nbDus = (data?.rows || []).filter((r) => ["du", "partiel"].includes(statut(r))).length;

  return (
    <>
      <PageHead title={c.titre} sub={`${c.sub} — ${s.annee?.libelle}`}>
        {rows.length > 0 && <button className="btn" onClick={exporter}><Download size={17} /><span className="hide-m">Exporter en Excel</span></button>}
        {rows.length > 0 && <button className="btn primary" onClick={() => nav(`/documents?type=service&svc=${type}&filtre=${filtre}${classe ? `&classe=${classe}` : ""}`)}><Printer size={17} />Imprimer par classe</button>}
      </PageHead>
      {data && (
        <div className="dash" style={{ marginBottom: 22 }}>
          <div className="card kpi c4"><div className="top"><span className="label">Total encaissé</span><span className={`ic ${c.tone}`}><I size={20} /></span></div><div className="value" style={{ color: "var(--green)" }}>{nombre(data.total)}<small>F</small></div><div className="sub">{data.payeurs} élève{data.payeurs > 1 ? "s" : ""} ont payé</div></div>
          {c.attendu ? <>
            <div className="card kpi c4"><div className="top"><span className="label">{c.attendu}</span><span className="ic teal"><CheckCircle2 size={20} /></span></div><div className="value">{nombre(data.attendu)}<small>F</small></div><div className="sub">{data.attendu ? `${Math.round((Math.min(data.total, data.attendu) / data.attendu) * 100)} % encaissé` : "Aucun montant fixé pour cette année"}</div></div>
            <div className="card kpi c4"><div className="top"><span className="label">Élèves qui doivent encore</span><span className="ic coral"><Clock size={20} /></span></div><div className="value" style={{ color: nbDus ? "var(--coral)" : "var(--green)" }}>{nbDus}</div><div className="sub">reste {fcfa(Math.max(data.attendu - data.total, 0))}</div></div>
          </> : <div className="card kpi c8"><div className="top"><span className="label">Élèves inscrits aux cours du soir</span><span className="ic azure"><MoonStar size={20} /></span></div><div className="value">{data.payeurs}</div><div className="sub">ayant payé au moins un mois — tarif {fcfa(s.annee?.frais_cours_soir)} par mois</div></div>}
        </div>
      )}
      <div className="card">
        <div className="toolbar">
          <div className="with-icon"><Search size={18} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un élève…" /></div>
          <Select value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe"><option value="">Toutes les classes</option>{classes.data?.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Select>
          <span className="spacer" />
          <div className="seg">
            {type === "cantine" && <button className={filtre === "cantine" ? "on" : ""} onClick={() => setFiltre("cantine")}>À la cantine</button>}
            {type === "cours_soir" && <button className={filtre === "payeurs" ? "on" : ""} onClick={() => setFiltre("payeurs")}>Inscrits</button>}
            <button className={filtre === "tous" ? "on" : ""} onClick={() => setFiltre("tous")}>Tous</button>
            {c.attendu && type !== "cantine" && <><button className={filtre === "payes" ? "on" : ""} onClick={() => setFiltre("payes")}>Payé</button><button className={filtre === "non_payes" ? "on" : ""} onClick={() => setFiltre("non_payes")}>Non payé</button></>}
            {type === "cantine" && <button className={filtre === "non_payes" ? "on" : ""} onClick={() => setFiltre("non_payes")}>Non payé</button>}
          </div>
        </div>
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !rows.length ? (
          <Empty icon={I} title="Aucun élève dans cette liste">{filtre !== "tous" ? "Changez le filtre pour voir tous les élèves." : ""}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Élève</th><th>Classe</th>{type === "uniforme" && <th className="hide-m">Commandé</th>}{type === "cantine" && <th className="hide-m">Demi-pension</th>}{c.attendu && <th className="r hide-m">Attendu</th>}<th className="r">Payé</th>{type === "cours_soir" && <th className="hide-m">Mois payés</th>}<th>État</th><th className="hide-m">Dernier paiement</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const st = statut(r);
                  return (
                    <tr key={r.inscription_id}>
                      <td className="click" style={{ cursor: "pointer" }} onClick={() => nav(`/eleves/${r.eleve_id}`)}><div className="person"><span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span><div><strong>{r.nom} {r.prenom}</strong><span>{r.matricule}</span></div></div></td>
                      <td><span className={`chip ${r.cycle}`}>{r.classe}</span></td>
                      {type === "uniforme" && <td className="hide-m">{[r.a_uniforme && "Uniforme", r.a_tenue && "Tenue"].filter(Boolean).join(" + ") || <span className="muted">Rien commandé</span>}</td>}
                      {type === "cantine" && <td className="hide-m">{r.cantine ? <span className="badge coral"><Utensils size={12} />Oui</span> : <span className="muted">Au jour</span>}</td>}
                      {c.attendu && <td className="r num hide-m">{r.du ? fcfa(r.du) : "—"}</td>}
                      <td className="r amount" style={{ color: r.paye ? "var(--green)" : "var(--muted)" }}>{fcfa(r.paye)}{type === "cantine" && r.paye_jour > 0 && <div className="xs muted">dont {fcfa(r.paye_jour)} au jour</div>}</td>
                      {type === "cours_soir" && <td className="hide-m"><div className="row" style={{ flexWrap: "wrap", gap: 4 }}>{(r.mois || "").split(",").filter(Boolean).sort().map((m) => <span key={m} className="badge azure" style={{ background: "var(--azure-50)", color: "var(--azure)" }}>{moisAbr(m)}</span>)}</div></td>}
                      <td>{st === "paye" ? <span className="badge green">Payé</span> : st === "partiel" ? <span className="badge gold">Reste {fcfa(r.du - r.paye)}</span> : st === "du" ? <span className="badge coral">Non payé</span> : <span className="muted small">—</span>}</td>
                      <td className="hide-m num">{r.dernier ? date(r.dernier) : "—"}</td>
                      <td className="r">{s.peut("finances.encaisser") && <button className="btn sm" onClick={() => setEnc(r)}><Wallet size={15} /><span className="hide-m">Encaisser</span></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {enc && <Encaissement inscriptionId={enc.inscription_id} eleve={enc} preset={type} onClose={() => setEnc(null)} onSaved={(r) => { setEnc(null); nav(`/recus/${r.id}`); }} />}
    </>
  );
}
