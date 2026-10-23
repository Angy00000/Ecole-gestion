import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, CalendarClock, Trash2, Download } from "lucide-react";
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

// On affiche le nom de l'activité tel qu'il est sur l'emploi du temps papier (la matière sert seulement à la couleur).
const titreCase = (c) => {
  let t = (c.libelle || c.matiere || "").trim(), d = "";
  const p = t.match(/^(.*?)\s*\((.*)\)$/); if (p) { t = p[1]; d = p[2]; }
  const i = t.indexOf(" – "); if (i > 0) { d = t.slice(i + 3) + (d ? ` · ${d}` : ""); t = t.slice(0, i); }
  return [t.charAt(0).toUpperCase() + t.slice(1), d];
};
// Emploi du temps en tableau : une ligne par horaire, une colonne par jour (comme la version papier).
function TableEdt({ data, couleurs, peut, onEdit }) {
  const jours = Object.entries(JOURS).filter(([j]) => Number(j) <= 5 || data.some((c) => c.jour === Number(j)));
  const cle = (c) => `${c.heure_debut.slice(0, 5)}-${c.heure_fin.slice(0, 5)}`;
  const horaires = [...new Set(data.map(cle))].sort();
  const lignes = [];
  horaires.forEach((h, i) => {
    const prev = horaires[i - 1];
    if (prev && prev.slice(6) < h.slice(0, 5)) lignes.push({ pause: true, de: prev.slice(6), a: h.slice(0, 5) });
    lignes.push({ h });
  });
  const fmt = (t) => t.replace(":", "h").replace(/h00$/, "h");
  if (!data.length) return null;
  return (
    <div className="table-wrap edt-table-wrap">
      <table className="edt-table">
        <thead><tr><th className="edt-h">Horaires</th>{jours.map(([j, n]) => <th key={j}>{n}</th>)}</tr></thead>
        <tbody>{lignes.map((l, i) => l.pause ? (
          <tr key={i} className="edt-pause"><td className="edt-h">{fmt(l.de)} – {fmt(l.a)}</td><td colSpan={jours.length}>{l.de >= "11:45" ? "Pause" : "Récréation"}</td></tr>
        ) : (
          <tr key={i}>
            <td className="edt-h">{fmt(l.h.slice(0, 5))} – {fmt(l.h.slice(6))}</td>
            {jours.map(([j]) => {
              const cs = data.filter((c) => c.jour === Number(j) && cle(c) === l.h);
              return <td key={j} className={cs.length ? "" : "vide"} onDoubleClick={() => peut && !cs.length && onEdit({ jour: Number(j), heure_debut: l.h.slice(0, 5), heure_fin: l.h.slice(6) })}>
                {cs.map((c) => (
                  <button key={c.id} className="edt-cell" style={{ "--c": couleurs[c.matiere || c.libelle] }} onClick={() => peut && onEdit(c)}>
                    {(() => { const [t, d] = titreCase(c); return <><strong>{t}</strong>{d && <span>{d}</span>}</>; })()}
                  </button>
                ))}
              </td>;
            })}
          </tr>
        ))}</tbody>
      </table>
    </div>
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
  const qc = useQueryClient();
  const toast = useToast();
  const [imp, setImp] = useState(false);
  const importer = async () => {
    if (!window.confirm("Remplacer les emplois du temps et les matières de PS, MS, GS, CI, CP, CE1, CE2, CM1, CM2 par les emplois du temps officiels ? (les matières qui ont déjà des notes sont gardées)")) return;
    setImp(true);
    try {
      const { default: data } = await import("../lib/edtOfficiel.js");
      const r = await api.post("/emploi/importer", data);
      toast(`${r.creneaux} créneaux et ${r.matieres} matières importés`);
      ["emploi", "classes", "matieres", "evaluations"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) { toast(e.message, "error"); }
    setImp(false);
  };
  const couleurs = {};
  (data || []).forEach((c) => { const k = c.matiere || c.libelle; if (!(k in couleurs)) couleurs[k] = TEINTES[Object.keys(couleurs).length % TEINTES.length]; });
  const hauteur = (H1 - H0) * 64;
  // Impression : A4 paysage, et réduction automatique pour que tout tienne sur une page.
  useEffect(() => {
    const avant = () => {
      const el = document.querySelector(".edt-print");
      if (!el) return;
      el.style.zoom = "";
      el.classList.add("edt-mesure");
      const dispo = 700; // hauteur utile d'une page A4 paysage (px à 96 dpi, marges comprises)
      const h = el.scrollHeight;
      el.classList.remove("edt-mesure");
      if (h > dispo) el.style.zoom = String(Math.max(0.5, dispo / h));
    };
    const apres = () => { const el = document.querySelector(".edt-print"); if (el) el.style.zoom = ""; };
    window.addEventListener("beforeprint", avant); window.addEventListener("afterprint", apres);
    return () => { window.removeEventListener("beforeprint", avant); window.removeEventListener("afterprint", apres); };
  }, []);
  return (
    <div className="edt-page">
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <PageHead title="Emploi du temps" sub={classe ? `${classe.nom}${classe.titulaire ? ` · titulaire ${classe.titulaire}` : ""} · Année scolaire ${s.annee?.libelle || ""}` : ""}>
        <button className="btn" onClick={() => window.print()}><Printer size={17} /><span className="hide-m">Imprimer</span></button>
        {peut && classe && <button className="btn primary" onClick={() => setEdit({})}><Plus size={17} />Ajouter un créneau</button>}
      </PageHead>
      {classes.data && <div className="class-tabs">{classes.data.map((c) => <button key={c.id} className={`class-tab ${c.id === classe?.id ? "on" : ""}`} onClick={() => setClasseId(c.id)}>{c.nom}</button>)}</div>}
      {isLoading || classes.isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : (
        <div className="edt-print">
        <div className="print-only edt-print-head">
          <div><strong>{s.etablissement?.nom}</strong><span>Année scolaire {s.annee?.libelle}</span></div>
          <h1>Emploi du temps — {classe?.nom}</h1>
          <div className="r">{classe?.titulaire && <span>Titulaire : <strong>{classe.titulaire}</strong></span>}</div>
        </div>
        <div className="card edt-card">
          <TableEdt data={data || []} couleurs={couleurs} peut={peut} onEdit={setEdit} />
          {!data?.length && <p className="muted small" style={{ padding: "0 22px 18px" }}>{peut ? "Double-cliquez sur une case ou utilisez « Ajouter un créneau » pour construire l'emploi du temps." : "Aucun créneau pour cette classe."}</p>}
        </div>
        </div>
      )}
      {edit && classe && <Creneau c={edit} classe={classe} onClose={() => setEdit(null)} />}
    </div>
  );
}
