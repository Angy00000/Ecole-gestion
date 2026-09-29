import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Save, UserCheck, UserX, Clock, BarChart3, MessageCircle, CheckCheck } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, dateLongue, initiales, today, telWa } from "../lib/format";
import { Select, Input, Spinner, ErrorBox, Empty, PageHead, useToast } from "../components/ui";

const MOMENTS = { journee: "Journée", matin: "Matin", apres_midi: "Après-midi" };

function Appel({ classes }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [classeId, setClasseId] = useState(classes[0]?.id);
  const [jour, setJour] = useState(today());
  const [items, setItems] = useState({});
  const [busy, setBusy] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["appel", classeId, jour], queryFn: () => api.get("/appel", { classe_id: classeId, date: jour }), enabled: !!classeId });
  useEffect(() => {
    if (!data) return;
    setItems(Object.fromEntries(data.rows.map((r) => {
      const m = (r.marques || [])[0];
      return [r.inscription_id, m ? { statut: m.type === "retard" ? "retard" : "absent", moment: m.moment, justifiee: m.justifiee, motif: m.motif || "" } : { statut: "present", moment: "journee", justifiee: false, motif: "" }];
    })));
  }, [data]);
  const setIt = (id, patch) => setItems({ ...items, [id]: { ...items[id], ...patch } });
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.put("/appel", { classe_id: classeId, date: jour, items: Object.entries(items).map(([k, v]) => ({ inscription_id: Number(k), ...v })) });
      toast(r.marques ? `Appel enregistré : ${r.marques} absence(s) ou retard(s)` : "Appel enregistré : tout le monde est présent");
      ["appel", "absences", "bulletins", "eleve"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const vals = Object.values(items);
  const nb = (st) => vals.filter((v) => v.statut === st).length;
  const peut = s.peut("absences.ecrire");
  return (
    <div className="card">
      <div className="toolbar">
        <Select value={classeId || ""} onChange={(e) => setClasseId(Number(e.target.value))} aria-label="Classe">{classes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.effectif})</option>)}</Select>
        <Input type="date" value={jour} max={today()} onChange={(e) => setJour(e.target.value)} style={{ width: 170 }} aria-label="Date" />
        <span className="spacer" />
        <span className="badge green" style={{ height: 30 }}><UserCheck size={14} />{nb("present")} présents</span>
        <span className="badge coral" style={{ height: 30 }}><UserX size={14} />{nb("absent")} absents</span>
        <span className="badge gold" style={{ height: 30 }}><Clock size={14} />{nb("retard")} retards</span>
      </div>
      {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.rows.length ? <Empty title="Aucun élève dans cette classe" /> : <>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Élève</th><th>Présence</th><th className="hide-m">Moment</th><th className="hide-m">Justifiée</th><th className="hide-m">Motif</th></tr></thead>
            <tbody>
              {data.rows.map((r) => {
                const it = items[r.inscription_id] || { statut: "present" };
                return (
                  <tr key={r.inscription_id} className={`appel-${it.statut}`}>
                    <td><div className="person"><span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span><div><strong>{r.nom} {r.prenom}</strong><span>{r.matricule}</span></div></div></td>
                    <td><div className="seg presence">
                      <button className={it.statut === "present" ? "on p" : ""} onClick={() => setIt(r.inscription_id, { statut: "present" })} disabled={!peut}>Présent</button>
                      <button className={it.statut === "absent" ? "on a" : ""} onClick={() => setIt(r.inscription_id, { statut: "absent" })} disabled={!peut}>Absent</button>
                      <button className={it.statut === "retard" ? "on r" : ""} onClick={() => setIt(r.inscription_id, { statut: "retard" })} disabled={!peut}>Retard</button>
                    </div></td>
                    <td className="hide-m">{it.statut !== "present" && <Select value={it.moment} onChange={(e) => setIt(r.inscription_id, { moment: e.target.value })} style={{ height: 36 }}>{Object.entries(MOMENTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</td>
                    <td className="hide-m">{it.statut !== "present" && <label className="check small"><input type="checkbox" checked={it.justifiee} onChange={(e) => setIt(r.inscription_id, { justifiee: e.target.checked })} />Oui</label>}</td>
                    <td className="hide-m">{it.statut !== "present" && <Input value={it.motif} onChange={(e) => setIt(r.inscription_id, { motif: e.target.value })} placeholder="Maladie…" style={{ height: 36 }} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {peut && <div className="modal-foot" style={{ borderRadius: "0 0 18px 18px" }}>
          <span className="muted small" style={{ marginRight: "auto" }}>Appel du {dateLongue(jour)}</span>
          <button className="btn" onClick={() => setItems(Object.fromEntries(Object.keys(items).map((k) => [k, { statut: "present", moment: "journee", justifiee: false, motif: "" }])))}><CheckCheck size={16} />Tous présents</button>
          <button className="btn primary" onClick={save} disabled={busy}><Save size={16} />Enregistrer l'appel</button>
        </div>}
      </>}
    </div>
  );
}

function Suivi({ classes }) {
  const s = useSession();
  const nav = useNavigate();
  const [classe, setClasse] = useState("");
  const [du, setDu] = useState(s.annee?.debut?.slice(0, 10) || today());
  const [au, setAu] = useState(today());
  const { data, isLoading, error } = useQuery({ queryKey: ["absences", classe, du, au], queryFn: () => api.get("/absences", { classe_id: classe, du, au, annee_id: s.annee?.id }) });
  const msg = (r) => `Bonjour, l'${s.etablissement.nom} vous informe que ${r.prenom} ${r.nom} (${r.classe}) compte ${r.absences} absence(s) dont ${r.non_justifiees} non justifiée(s) et ${r.retards} retard(s) depuis le ${date(du)}. Merci de prendre contact avec l'école.`;
  return (
    <div className="stack">
      <div className="card">
        <div className="toolbar">
          <Select value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe"><option value="">Toutes les classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select>
          <div className="date-range"><input className="input" type="date" value={du} onChange={(e) => setDu(e.target.value)} /><span className="muted">au</span><input className="input" type="date" value={au} onChange={(e) => setAu(e.target.value)} /></div>
        </div>
        {data && <div className="stat-strip" style={{ borderTop: "1px solid var(--line)" }}>
          <div><div className="l">Absences</div><div className="v" style={{ color: "var(--coral)" }}>{data.absences}</div></div>
          <div><div className="l">Non justifiées</div><div className="v">{data.non_justifiees}</div></div>
          <div><div className="l">Retards</div><div className="v" style={{ color: "var(--gold-600)" }}>{data.retards}</div></div>
          <div><div className="l">Élèves concernés</div><div className="v">{data.par_eleve.length}</div></div>
        </div>}
      </div>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : !data.par_eleve.length ? (
        <div className="card"><Empty icon={CalendarCheck} title="Aucune absence sur la période">Les absences saisies lors de l'appel apparaîtront ici.</Empty></div>
      ) : (
        <div className="card">
          <div className="card-head" style={{ paddingBottom: 14 }}><h3>Élèves les plus absents</h3></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Élève</th><th>Classe</th><th className="r">Absences</th><th className="r hide-m">Non justifiées</th><th className="r hide-m">Retards</th><th /></tr></thead>
            <tbody>{data.par_eleve.map((r) => (
              <tr key={r.eleve_id}>
                <td className="click" style={{ cursor: "pointer" }} onClick={() => nav(`/eleves/${r.eleve_id}`)}><div className="person"><span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span><div><strong>{r.nom} {r.prenom}</strong></div></div></td>
                <td><span className={`chip ${r.cycle}`}>{r.classe}</span></td>
                <td className="r amount" style={{ color: "var(--coral)" }}>{r.absences}</td>
                <td className="r num hide-m">{r.non_justifiees}</td>
                <td className="r num hide-m">{r.retards}</td>
                <td className="r">{r.telephone && <a className="btn sm wa" href={`https://wa.me/${telWa(r.telephone)}?text=${encodeURIComponent(msg(r))}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /><span className="hide-m">Prévenir</span></a>}</td>
              </tr>))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

export default function Absences() {
  const s = useSession();
  const [params, setParams] = useSearchParams();
  const vue = params.get("vue") || "appel";
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  return (
    <>
      <PageHead title="Absences et retards" sub="Appel quotidien et suivi de l'assiduité">
        <div className="tabs">
          <button className={vue === "appel" ? "on" : ""} onClick={() => setParams({})}><CalendarCheck size={16} />Faire l'appel</button>
          <button className={vue === "suivi" ? "on" : ""} onClick={() => setParams({ vue: "suivi" })}><BarChart3 size={16} />Suivi</button>
        </div>
      </PageHead>
      {classes.isLoading ? <Spinner /> : !classes.data?.length ? <div className="card"><Empty title="Aucune classe" /></div>
        : vue === "suivi" ? <Suivi classes={classes.data} /> : <Appel classes={classes.data} />}
    </>
  );
}
