import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, CalendarClock, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { JOURS } from "../lib/format";
import { Modal, Field, Input, Select, Spinner, ErrorBox, Empty, PageHead, useToast } from "../components/ui";

const TEINTES = ["#1f7a8c", "#d9a21f", "#e0673f", "#3b82c4", "#d9577f", "#22976b", "#8b6fd6", "#5a8f9c"];
const H0 = 8, H1 = 17;
const min = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

function Creneau({ c, classe, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const mats = useQuery({ queryKey: ["matieres", classe.id], queryFn: () => api.get(`/classes/${classe.id}/matieres`) });
  const ens = useQuery({ queryKey: ["enseignants"], queryFn: () => api.get("/enseignants") });
  const [v, setV] = useState(c?.id ? { ...c } : { jour: c?.jour || 1, heure_debut: c?.heure_debut || "08:00", heure_fin: c?.heure_fin || "09:00", matiere_id: "", libelle: "", enseignant_id: classe.titulaire_id || "", salle: "" });
  const [error, setError] = useState(null);
  const save = async () => {
    setError(null);
    try {
      const d = { classe_id: classe.id, jour: Number(v.jour), heure_debut: v.heure_debut, heure_fin: v.heure_fin, matiere_id: v.matiere_id || null, libelle: v.libelle || null, enseignant_id: v.enseignant_id || null, salle: v.salle || null };
      if (c?.id) await api.put(`/emploi/${c.id}`, d); else await api.post("/emploi", d);
      toast("Créneau enregistré"); qc.invalidateQueries({ queryKey: ["emploi"] }); qc.invalidateQueries({ queryKey: ["enseignants"] }); onClose();
    } catch (e) { setError(e); }
  };
  const suppr = async () => { await api.del(`/emploi/${c.id}`); toast("Créneau supprimé"); qc.invalidateQueries({ queryKey: ["emploi"] }); onClose(); };
  return (
    <Modal title={c?.id ? "Modifier le créneau" : `Nouveau créneau — ${classe.nom}`} onClose={onClose} footer={<>
      {c?.id && <button className="btn danger" style={{ marginRight: "auto" }} onClick={suppr}><Trash2 size={15} />Supprimer</button>}
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.matiere_id && !v.libelle}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <div className="grid g3">
          <Field label="Jour"><Select value={v.jour} onChange={(e) => setV({ ...v, jour: e.target.value })}>{Object.entries(JOURS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Début"><Input type="time" value={v.heure_debut} onChange={(e) => setV({ ...v, heure_debut: e.target.value })} /></Field>
          <Field label="Fin"><Input type="time" value={v.heure_fin} onChange={(e) => setV({ ...v, heure_fin: e.target.value })} /></Field>
        </div>
        <Field label="Matière"><Select value={v.matiere_id || ""} onChange={(e) => setV({ ...v, matiere_id: e.target.value })}><option value="">Autre activité…</option>{mats.data?.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}</Select></Field>
        {!v.matiere_id && <Field label="Activité"><Input value={v.libelle || ""} onChange={(e) => setV({ ...v, libelle: e.target.value })} placeholder="Récréation, sport, prière…" /></Field>}
        <div className="grid g2">
          <Field label="Enseignant"><Select value={v.enseignant_id || ""} onChange={(e) => setV({ ...v, enseignant_id: e.target.value })}><option value="">—</option>{ens.data?.filter((x) => x.statut === "actif").map((x) => <option key={x.id} value={x.id}>{x.prenom} {x.nom}</option>)}</Select></Field>
          <Field label="Salle"><Input value={v.salle || ""} onChange={(e) => setV({ ...v, salle: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}

export default function Emploi() {
  const s = useSession();
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const [classeId, setClasseId] = useState(null);
  const classe = classes.data?.find((c) => c.id === classeId) || classes.data?.[0];
  const { data, isLoading, error } = useQuery({ queryKey: ["emploi", classe?.id], queryFn: () => api.get("/emploi", { classe_id: classe.id }), enabled: !!classe });
  const [edit, setEdit] = useState(null);
  const peut = s.peut("classes.ecrire");
  const couleurs = {};
  (data || []).forEach((c) => { const k = c.matiere || c.libelle; if (!(k in couleurs)) couleurs[k] = TEINTES[Object.keys(couleurs).length % TEINTES.length]; });
  const hauteur = (H1 - H0) * 64;
  return (
    <>
      <PageHead title="Emploi du temps" sub={classe ? `${classe.nom}${classe.titulaire ? ` · titulaire ${classe.titulaire}` : ""}` : ""}>
        <button className="btn" onClick={() => window.print()}><Printer size={17} /><span className="hide-m">Imprimer</span></button>
        {peut && classe && <button className="btn primary" onClick={() => setEdit({})}><Plus size={17} />Ajouter un créneau</button>}
      </PageHead>
      {classes.data && <div className="class-tabs">{classes.data.map((c) => <button key={c.id} className={`class-tab ${c.id === classe?.id ? "on" : ""}`} onClick={() => setClasseId(c.id)}>{c.nom}</button>)}</div>}
      {isLoading || classes.isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : (
        <div className="card edt-card">
          <div className="edt" style={{ "--h": `${hauteur}px` }}>
            <div className="edt-hours">{Array.from({ length: H1 - H0 + 1 }, (_, i) => <span key={i} style={{ top: i * 64 }}>{String(H0 + i).padStart(2, "0")}h</span>)}</div>
            {Object.entries(JOURS).map(([j, nom]) => (
              <div key={j} className="edt-day">
                <div className="edt-dname">{nom}</div>
                <div className="edt-col" onDoubleClick={(e) => { if (!peut) return; const y = e.nativeEvent.offsetY; const h = H0 + Math.floor(y / 64); setEdit({ jour: Number(j), heure_debut: `${String(h).padStart(2, "0")}:00`, heure_fin: `${String(h + 1).padStart(2, "0")}:00` }); }}>
                  {Array.from({ length: H1 - H0 }, (_, i) => <i key={i} style={{ top: i * 64 }} />)}
                  {(data || []).filter((c) => c.jour === Number(j)).map((c) => {
                    const top = ((min(c.heure_debut) - H0 * 60) / 60) * 64, h = ((min(c.heure_fin) - min(c.heure_debut)) / 60) * 64;
                    const col = couleurs[c.matiere || c.libelle];
                    return (
                      <button key={c.id} className="slot" style={{ top, height: h - 3, "--c": col }} onClick={() => peut && setEdit(c)}>
                        <strong>{c.matiere || c.libelle}</strong>
                        <span>{c.heure_debut} – {c.heure_fin}</span>
                        {h > 60 && c.enseignant && <span>{c.enseignant}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {!data?.length && <p className="muted small" style={{ padding: "0 22px 18px" }}>{peut ? "Double-cliquez sur une case ou utilisez « Ajouter un créneau » pour construire l'emploi du temps." : "Aucun créneau pour cette classe."}</p>}
        </div>
      )}
      {edit && classe && <Creneau c={edit} classe={classe} onClose={() => setEdit(null)} />}
    </>
  );
}
