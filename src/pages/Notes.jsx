import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen, ClipboardList, Trophy, Printer, Pencil, Trash2, Save, FileText, MessageSquareText } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, initiales, note, TRIMESTRES, trimestreCourant, today } from "../lib/format";
import { Modal, Field, Input, Select, Textarea, Spinner, ErrorBox, Empty, Confirm, PageHead, useToast } from "../components/ui";

function EvalForm({ classe, trimestre, ev, onClose, onSaved }) {
  const toast = useToast();
  const qc = useQueryClient();
  const mats = useQuery({ queryKey: ["matieres", classe.id], queryFn: () => api.get(`/classes/${classe.id}/matieres`) });
  const [v, setV] = useState(ev ? { ...ev, date_eval: ev.date_eval.slice(0, 10) } : { matiere_id: "", type: "devoir", libelle: "", date_eval: today(), bareme: "", trimestre });
  const [error, setError] = useState(null);
  const save = async () => {
    setError(null);
    try {
      const d = { classe_id: classe.id, matiere_id: v.matiere_id, trimestre: v.trimestre, type: v.type, libelle: v.libelle, date_eval: v.date_eval, bareme: v.bareme || null };
      const r = ev ? await api.put(`/evaluations/${ev.id}`, d) : await api.post("/evaluations", d);
      toast(ev ? "Évaluation modifiée" : "Évaluation créée"); qc.invalidateQueries({ queryKey: ["evaluations"] }); onSaved(r);
    } catch (e) { setError(e); }
  };
  const m = mats.data?.find((x) => x.id == v.matiere_id);
  return (
    <Modal title={ev ? "Modifier l'évaluation" : `Nouvelle évaluation — ${classe.nom}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.matiere_id}>{ev ? "Enregistrer" : "Créer et saisir les notes"}</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <Field label="Matière" required><Select value={v.matiere_id} onChange={(e) => setV({ ...v, matiere_id: e.target.value })} autoFocus>
          <option value="">Choisir…</option>{mats.data?.map((x) => <option key={x.id} value={x.id}>{x.nom} (coef. {Number(x.coefficient)})</option>)}
        </Select></Field>
        <Field label="Type"><div className="seg full">
          <button type="button" className={v.type === "devoir" ? "on" : ""} onClick={() => setV({ ...v, type: "devoir" })}>Devoir</button>
          <button type="button" className={v.type === "composition" ? "on" : ""} onClick={() => setV({ ...v, type: "composition" })}>Composition</button>
        </div></Field>
        <div className="grid g3">
          <Field label="Trimestre"><Select value={v.trimestre} onChange={(e) => setV({ ...v, trimestre: Number(e.target.value) })}>{Object.entries(TRIMESTRES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Date"><Input type="date" value={v.date_eval} onChange={(e) => setV({ ...v, date_eval: e.target.value })} /></Field>
          <Field label="Noté sur"><Input type="number" min="1" value={v.bareme || ""} placeholder={m ? String(m.bareme) : "10"} onChange={(e) => setV({ ...v, bareme: e.target.value })} /></Field>
        </div>
        <Field label="Intitulé" hint="Facultatif"><Input value={v.libelle || ""} onChange={(e) => setV({ ...v, libelle: e.target.value })} placeholder="Dictée n°2, problèmes…" /></Field>
        <p className="xs muted">Dans la moyenne du trimestre, une composition compte deux fois plus qu'un devoir.</p>
      </div>
    </Modal>
  );
}

function Saisie({ evaluationId, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["notes", evaluationId], queryFn: () => api.get(`/evaluations/${evaluationId}/notes`) });
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);
  const refs = useRef([]);
  useEffect(() => { if (data) setVals(Object.fromEntries(data.notes.map((n) => [n.inscription_id, { note: n.note ?? "", absent: n.absent }]))); }, [data]);
  if (isLoading) return <Modal title="Saisie des notes" onClose={onClose}><Spinner /></Modal>;
  if (error) return <Modal title="Saisie des notes" onClose={onClose}><ErrorBox error={error} /></Modal>;
  const ev = data.evaluation;
  const saisies = Object.values(vals).filter((x) => x.note !== "" || x.absent).length;
  const valeurs = Object.values(vals).filter((x) => x.note !== "" && !x.absent).map((x) => Number(String(x.note).replace(",", ".")));
  const moy = valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/evaluations/${evaluationId}/notes`, { notes: data.notes.map((n) => ({ inscription_id: n.inscription_id, note: vals[n.inscription_id]?.absent ? null : vals[n.inscription_id]?.note, absent: vals[n.inscription_id]?.absent })) });
      toast(`${saisies} note${saisies > 1 ? "s" : ""} enregistrée${saisies > 1 ? "s" : ""}`);
      ["evaluations", "notes", "bulletins"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onClose();
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };
  const invalide = (x) => x !== "" && (isNaN(Number(String(x).replace(",", "."))) || Number(String(x).replace(",", ".")) < 0 || Number(String(x).replace(",", ".")) > ev.bareme);
  return (
    <Modal wide pad={false} title={`${ev.matiere} — ${ev.type === "composition" ? "Composition" : "Devoir"}${ev.libelle ? ` : ${ev.libelle}` : ""}`} onClose={onClose}
      icon={<span className="chip" style={{ height: 34 }}>{ev.classe}</span>}
      footer={<>
        <span className="muted small" style={{ marginRight: "auto" }}>{saisies} / {data.notes.length} saisies · moyenne {note(moy)} / {ev.bareme}</span>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" onClick={save} disabled={busy || Object.values(vals).some((x) => invalide(x.note))}><Save size={16} />Enregistrer les notes</button>
      </>}>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th style={{ width: 40 }}>#</th><th>Élève</th><th style={{ width: 150 }}>Note / {ev.bareme}</th><th style={{ width: 110 }}>Absent</th></tr></thead>
          <tbody>
            {data.notes.map((n, i) => {
              const v = vals[n.inscription_id] || { note: "", absent: false };
              return (
                <tr key={n.inscription_id}>
                  <td className="muted num">{i + 1}</td>
                  <td><div className="person"><span className={`avatar ${n.sexe || ""}`}>{initiales(n.prenom, n.nom)}</span><div><strong>{n.nom} {n.prenom}</strong><span>{n.matricule}</span></div></div></td>
                  <td><input ref={(el) => (refs.current[i] = el)} className={`input num note-in ${invalide(v.note) ? "bad" : ""}`} inputMode="decimal" value={v.absent ? "" : v.note} disabled={v.absent}
                    onChange={(e) => setVals({ ...vals, [n.inscription_id]: { ...v, note: e.target.value } })}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); refs.current[i + 1]?.focus(); refs.current[i + 1]?.select(); } if (e.key === "ArrowUp") { e.preventDefault(); refs.current[i - 1]?.focus(); } }}
                    autoFocus={i === 0} aria-label={`Note de ${n.prenom} ${n.nom}`} /></td>
                  <td><label className="check small"><input type="checkbox" checked={v.absent} onChange={(e) => setVals({ ...vals, [n.inscription_id]: { note: "", absent: e.target.checked } })} />Absent</label></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.notes.length && <Empty title="Aucun élève dans cette classe" />}
      </div>
    </Modal>
  );
}

function Recap({ classe, trimestre }) {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [obs, setObs] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["bulletins", classe.id, trimestre], queryFn: () => api.get("/bulletins", { classe_id: classe.id, trimestre }) });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const B = data.classe.bareme;
  const tri = [...data.eleves].sort((a, b) => (a.rang || 999) - (b.rang || 999));
  const saveObs = async () => {
    try { await api.put("/appreciations", { inscription_id: obs.inscription_id, trimestre, observation: obs.observation, decision: obs.decision }); toast("Appréciation enregistrée"); qc.invalidateQueries({ queryKey: ["bulletins"] }); setObs(null); }
    catch (e) { toast(e.message, "error"); }
  };
  return (
    <div className="stack">
      <div className="card">
        <div className="stat-strip">
          <div><div className="l">Moyenne de la classe</div><div className="v">{note(data.stats.moyenne)}<small className="muted" style={{ fontSize: 14 }}> / {B}</small></div></div>
          <div><div className="l">Plus forte moyenne</div><div className="v" style={{ color: "var(--green)" }}>{note(data.stats.max)}</div></div>
          <div><div className="l">Plus faible moyenne</div><div className="v" style={{ color: "var(--coral)" }}>{note(data.stats.min)}</div></div>
          <div><div className="l">Moyenne ≥ {B / 2}</div><div className="v">{data.stats.admis} / {data.stats.classes}</div></div>
        </div>
      </div>
      <div className="card">
        <div className="card-head" style={{ paddingBottom: 14 }}>
          <h3>Classement — {TRIMESTRES[trimestre]}</h3>
          <button className="btn primary" onClick={() => nav(`/bulletins/imprimer?classe=${classe.id}&trimestre=${trimestre}`)} disabled={!data.stats.classes}><Printer size={16} />Imprimer les bulletins</button>
        </div>
        {!data.eleves.length ? <Empty title="Aucun élève" /> : (
          <div className="table-wrap">
            <table className="table recap-table">
              <thead><tr><th>Rang</th><th>Élève</th>{data.matieres.map((m) => <th key={m.id} className="r" title={m.nom}>{m.nom.length > 12 ? m.nom.slice(0, 11) + "…" : m.nom}<div className="xs muted">coef. {Number(m.coefficient)}</div></th>)}<th className="r">Moyenne</th><th className="hide-m">Appréciation</th><th /></tr></thead>
              <tbody>
                {tri.map((e) => (
                  <tr key={e.inscription_id}>
                    <td>{e.rang ? <span className={`rank r${Math.min(e.rang, 4)}`}>{e.rang}{e.rang === 1 ? (e.sexe === "F" ? "re" : "er") : "e"}</span> : <span className="muted">—</span>}</td>
                    <td><div className="person"><span className={`avatar ${e.sexe || ""}`}>{initiales(e.prenom, e.nom)}</span><div><strong>{e.nom} {e.prenom}</strong><span>{e.absences ? `${e.absences} absence${e.absences > 1 ? "s" : ""}` : e.matricule}</span></div></div></td>
                    {e.lignes.map((l) => <td key={l.matiere_id} className="r num" style={l.moyenne != null && l.moyenne < l.bareme / 2 ? { color: "var(--coral)" } : undefined}>{note(l.moyenne)}</td>)}
                    <td className="r"><strong className="amount" style={{ color: e.moyenne == null ? "var(--muted)" : e.moyenne >= B / 2 ? "var(--green)" : "var(--coral)" }}>{note(e.moyenne)}</strong></td>
                    <td className="hide-m small">{e.observation || <span className="muted">{e.mention || "—"}</span>}</td>
                    <td className="r">{s.peut("pedagogie.ecrire") && <button className="btn sm ghost icon" onClick={() => setObs({ ...e, observation: e.observation || e.mention || "" })} aria-label="Appréciation"><MessageSquareText size={16} /></button>}</td>
                  </tr>
                ))}
                <tr style={{ background: "var(--surface-2)" }}><td /><td><strong>Moyenne de la classe</strong></td>{data.stats.par_matiere.map((v, i) => <td key={i} className="r num"><strong>{note(v)}</strong></td>)}<td className="r amount">{note(data.stats.moyenne)}</td><td className="hide-m" /><td /></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      {obs && (
        <Modal title={`Appréciation — ${obs.prenom} ${obs.nom}`} onClose={() => setObs(null)} footer={<><button className="btn" onClick={() => setObs(null)}>Annuler</button><button className="btn primary" onClick={saveObs}>Enregistrer</button></>}>
          <div className="stack" style={{ gap: 14 }}>
            <p className="small muted">Moyenne {note(obs.moyenne)} / {B}{obs.rang ? `, rang ${obs.rang} sur ${data.stats.classes}` : ""}.</p>
            <Field label="Appréciation du maître"><Textarea value={obs.observation || ""} onChange={(e) => setObs({ ...obs, observation: e.target.value })} autoFocus /></Field>
            {trimestre === 3 && <Field label="Décision de fin d'année"><Select value={obs.decision || ""} onChange={(e) => setObs({ ...obs, decision: e.target.value })}>
              <option value="">—</option><option>Admis(e) en classe supérieure</option><option>Redouble</option><option>Admis(e) sous réserve</option>
            </Select></Field>}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function Notes() {
  const s = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const notables = classes.data?.filter((c) => c.nb_matieres > 0) || [];
  const classeId = Number(params.get("classe")) || notables[0]?.id;
  const trimestre = Number(params.get("t")) || trimestreCourant();
  const vue = params.get("vue") || "evaluations";
  const classe = notables.find((c) => c.id === classeId);
  const set = (k, v) => { const p = Object.fromEntries(params); p[k] = v; setParams(p); };
  const [form, setForm] = useState(null);
  const [saisie, setSaisie] = useState(null);
  const [del, setDel] = useState(null);
  const evs = useQuery({ queryKey: ["evaluations", classeId, trimestre], queryFn: () => api.get("/evaluations", { classe_id: classeId, trimestre }), enabled: !!classeId });
  const peut = s.peut("pedagogie.ecrire");

  const groupes = {};
  (evs.data || []).forEach((e) => { (groupes[e.matiere] ||= []).push(e); });
  const supprimer = async () => {
    try { await api.del(`/evaluations/${del.id}`); toast("Évaluation supprimée"); qc.invalidateQueries({ queryKey: ["evaluations"] }); qc.invalidateQueries({ queryKey: ["bulletins"] }); } catch (e) { toast(e.message, "error"); }
    setDel(null);
  };

  return (
    <>
      <PageHead title="Notes et bulletins" sub={classe ? `${classe.nom} · ${TRIMESTRES[trimestre]} · ${classe.effectif} élèves` : ""}>
        <div className="tabs">
          <button className={vue === "evaluations" ? "on" : ""} onClick={() => set("vue", "evaluations")}><ClipboardList size={16} />Évaluations</button>
          <button className={vue === "bulletins" ? "on" : ""} onClick={() => set("vue", "bulletins")}><Trophy size={16} />Classement et bulletins</button>
        </div>
        {peut && vue === "evaluations" && classe && <button className="btn primary" onClick={() => setForm("new")}><Plus size={17} />Nouvelle évaluation</button>}
      </PageHead>

      {classes.isLoading ? <Spinner /> : !notables.length ? (
        <div className="card"><Empty icon={BookOpen} title="Aucune matière configurée">Ajoutez les matières des classes depuis « Classes et tarifs ».</Empty></div>
      ) : <>
        <div className="row" style={{ flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <div className="class-tabs" style={{ flex: 1, padding: 0 }}>
            {notables.map((c) => <button key={c.id} className={`class-tab ${c.id === classeId ? "on" : ""}`} onClick={() => set("classe", c.id)}>{c.nom} <span className="n">{c.effectif}</span></button>)}
          </div>
          <div className="seg">{[1, 2, 3].map((t) => <button key={t} className={t === trimestre ? "on" : ""} onClick={() => set("t", t)}>T{t}</button>)}</div>
        </div>

        {vue === "bulletins" && classe ? <Recap classe={classe} trimestre={trimestre} /> : evs.isLoading ? <Spinner /> : evs.error ? <ErrorBox error={evs.error} /> : !evs.data.length ? (
          <div className="card"><Empty icon={ClipboardList} title={`Aucune évaluation au ${TRIMESTRES[trimestre]}`} action={peut && <button className="btn primary" onClick={() => setForm("new")}><Plus size={16} />Créer la première évaluation</button>}>
            Créez un devoir ou une composition, puis saisissez les notes des élèves.
          </Empty></div>
        ) : (
          <div className="eval-grid">
            {Object.entries(groupes).map(([mat, list]) => (
              <div key={mat} className="card">
                <div className="card-head" style={{ paddingBottom: 12 }}><h3>{mat}</h3><span className="badge">{list.length}</span></div>
                <ul className="feed" style={{ paddingTop: 0 }}>
                  {list.map((e) => (
                    <li key={e.id} onClick={() => setSaisie(e.id)}>
                      <span className={`ic ${e.type === "composition" ? "gold" : "teal"}`} style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center" }}><FileText size={17} /></span>
                      <div className="grow"><strong>{e.type === "composition" ? "Composition" : "Devoir"}{e.libelle ? ` — ${e.libelle}` : ""}</strong><span>{date(e.date_eval)} · sur {e.bareme} · {e.saisies}/{e.effectif} notes</span></div>
                      <span className="amount" title="Moyenne">{note(e.moyenne)}</span>
                      {peut && <span className="row" style={{ gap: 0 }} onClick={(x) => x.stopPropagation()}>
                        <button className="btn sm ghost icon" onClick={() => setForm(e)} aria-label="Modifier"><Pencil size={14} /></button>
                        <button className="btn sm ghost icon" onClick={() => setDel(e)} aria-label="Supprimer"><Trash2 size={14} /></button>
                      </span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </>}
      {form && classe && <EvalForm classe={classe} trimestre={trimestre} ev={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={(r) => { setForm(null); if (form === "new") setSaisie(r.id); }} />}
      {saisie && <Saisie evaluationId={saisie} onClose={() => setSaisie(null)} />}
      {del && <Confirm danger title="Supprimer cette évaluation ?" confirmLabel="Supprimer" message="Toutes les notes saisies pour cette évaluation seront effacées." onConfirm={supprimer} onClose={() => setDel(null)} />}
    </>
  );
}
