import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, GraduationCap, Phone, Mail, BookOpen, School, CalendarClock } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { initiales, date, fcfa } from "../lib/format";
import { Modal, Field, Input, Select, Money, Textarea, Spinner, ErrorBox, Empty, Confirm, PageHead, useToast } from "../components/ui";

function EnseignantForm({ ens, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState({ nom: "", prenom: "", sexe: "", telephone: "", email: "", adresse: "", specialite: "", diplome: "", salaire: null, statut: "actif", observations: "", ...(ens || {}), date_embauche: ens?.date_embauche?.slice(0, 10) || "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setError(null);
    try {
      const { id, created_at, utilisateur_id, classes_titulaire, matieres, creneaux, ...d } = v;
      if (ens) await api.put(`/enseignants/${ens.id}`, d); else await api.post("/enseignants", d);
      toast(ens ? "Fiche mise à jour" : `${v.prenom} ${v.nom} ajouté(e)`);
      qc.invalidateQueries({ queryKey: ["enseignants"] }); onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal wide title={ens ? `${ens.prenom} ${ens.nom}` : "Nouvel enseignant"} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.nom || !v.prenom}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 16 }}>
        <ErrorBox error={error} />
        <div className="grid g3">
          <Field label="Prénom" required><Input value={v.prenom} onChange={set("prenom")} autoFocus /></Field>
          <Field label="Nom" required><Input value={v.nom} onChange={set("nom")} style={{ textTransform: "uppercase" }} /></Field>
          <Field label="Sexe"><div className="seg full">
            <button type="button" className={v.sexe === "F" ? "on F" : ""} onClick={() => setV({ ...v, sexe: "F" })}>Femme</button>
            <button type="button" className={v.sexe === "M" ? "on M" : ""} onClick={() => setV({ ...v, sexe: "M" })}>Homme</button>
          </div></Field>
          <Field label="Téléphone"><Input type="tel" value={v.telephone || ""} onChange={set("telephone")} /></Field>
          <Field label="Email"><Input type="email" value={v.email || ""} onChange={set("email")} /></Field>
          <Field label="Adresse"><Input value={v.adresse || ""} onChange={set("adresse")} /></Field>
          <Field label="Spécialité"><Input value={v.specialite || ""} onChange={set("specialite")} placeholder="Instituteur, anglais…" /></Field>
          <Field label="Diplôme"><Input value={v.diplome || ""} onChange={set("diplome")} placeholder="CAP, CEAP, licence…" /></Field>
          <Field label="Date d'embauche"><Input type="date" value={v.date_embauche} onChange={set("date_embauche")} /></Field>
          <Field label="Salaire mensuel"><Money value={v.salaire} onChange={(x) => setV({ ...v, salaire: x })} /></Field>
          <Field label="Statut"><Select value={v.statut} onChange={set("statut")}><option value="actif">En poste</option><option value="inactif">Parti / inactif</option></Select></Field>
        </div>
        <Field label="Observations"><Textarea value={v.observations || ""} onChange={set("observations")} /></Field>
      </div>
    </Modal>
  );
}

export default function Enseignants() {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["enseignants", s.annee?.id], queryFn: () => api.get("/enseignants", { annee_id: s.annee?.id }) });
  const peut = s.peut("enseignants.ecrire");
  const supprimer = async () => {
    try { await api.del(`/enseignants/${del.id}`); toast("Enseignant supprimé"); qc.invalidateQueries({ queryKey: ["enseignants"] }); } catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  const actifs = data?.filter((e) => e.statut === "actif").length || 0;
  return (
    <>
      <PageHead title="Enseignants" sub={`${actifs} enseignant${actifs > 1 ? "s" : ""} en poste`}>
        {peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={17} />Ajouter un enseignant</button>}
      </PageHead>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : !data.length ? (
        <div className="card"><Empty icon={GraduationCap} title="Aucun enseignant" action={peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Ajouter le premier enseignant</button>}>
          Ajoutez l'équipe pédagogique pour l'associer aux classes, aux matières et à l'emploi du temps.
        </Empty></div>
      ) : (
        <div className="class-grid">
          {data.map((e) => (
            <div key={e.id} className="card class-card" style={e.statut !== "actif" ? { opacity: 0.6 } : undefined}>
              {peut && <div className="tools">
                <button className="btn sm ghost icon" onClick={() => setEdit(e)} aria-label="Modifier"><Pencil size={15} /></button>
                <button className="btn sm ghost icon" onClick={() => setDel(e)} aria-label="Supprimer"><Trash2 size={15} /></button>
              </div>}
              <div className="head">
                <span className={`avatar ${e.sexe || ""}`} style={{ width: 54, height: 54, borderRadius: 16, fontSize: 17 }}>{initiales(e.prenom, e.nom)}</span>
                <div className="t"><strong>{e.prenom} {e.nom}</strong><span>{e.specialite || "Enseignant"}{e.statut !== "actif" ? " · inactif" : ""}</span></div>
              </div>
              <div className="stack" style={{ gap: 8, fontSize: 13 }}>
                {e.classes_titulaire && <span className="row" style={{ gap: 8 }}><School size={15} className="muted" />Titulaire : <strong>{e.classes_titulaire}</strong></span>}
                {e.matieres && <span className="row" style={{ gap: 8, alignItems: "flex-start" }}><BookOpen size={15} className="muted" style={{ marginTop: 2 }} /><span>{e.matieres}</span></span>}
                {e.creneaux > 0 && <span className="row" style={{ gap: 8 }}><CalendarClock size={15} className="muted" />{e.creneaux} créneau{e.creneaux > 1 ? "x" : ""} par semaine</span>}
              </div>
              <div className="tarifs">
                {e.telephone && <><dt>Téléphone</dt><dd><a href={`tel:${e.telephone.replace(/\s/g, "")}`}>{e.telephone}</a></dd></>}
                {e.date_embauche && <><dt>Depuis</dt><dd>{date(e.date_embauche)}</dd></>}
                {e.diplome && <><dt>Diplôme</dt><dd>{e.diplome}</dd></>}
                {s.peut("depenses.lire") && e.salaire ? <><dt>Salaire</dt><dd>{fcfa(e.salaire)}</dd></> : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <EnseignantForm ens={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {del && <Confirm danger title={`Supprimer ${del.prenom} ${del.nom} ?`} confirmLabel="Supprimer" message="L'enseignant sera retiré des classes, matières et créneaux où il apparaît. Pour garder l'historique, passez-le plutôt en « inactif »." onConfirm={supprimer} onClose={() => setDel(null)} />}
    </>
  );
}
