import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, School } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, CYCLES } from "../lib/format";
import { Modal, Field, Input, Select, Money, Spinner, ErrorBox, Empty, Confirm, useToast } from "../components/ui";
import PageTitle from "../components/PageTitle";

const VIDE = { nom: "", cycle: "elementaire", ordre: 0, capacite: null, frais_inscription: 0, uniforme: 0, mensualite: 0, mensualite_jan_fev: 0, mensualite_cantine: 0, mensualite_cantine_jan_fev: 0, frais_cantine: 0 };

function ClasseForm({ classe, onClose }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState({ ...VIDE, ...(classe || {}) });
  const [error, setError] = useState(null);
  const m = (k) => ({ value: v[k], onChange: (x) => setV({ ...v, [k]: x ?? 0 }) });

  const save = async () => {
    setError(null);
    const { id, annee_id, effectif, filles, ...data } = v;
    try {
      if (classe) await api.put(`/classes/${classe.id}`, data);
      else await api.post("/classes", { ...data, annee_id: s.annee?.id });
      toast(classe ? `Classe ${v.nom} mise à jour` : `Classe ${v.nom} créée`);
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (e) { setError(e); }
  };

  return (
    <Modal wide title={classe ? `Classe ${classe.nom}` : "Nouvelle classe"} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.nom}>Enregistrer</button>
    </>}>
      <div className="stack">
        <ErrorBox error={error} />
        <div className="grid g4">
          <Field label="Nom" required><Input value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} autoFocus placeholder="CE1" /></Field>
          <Field label="Cycle">
            <Select value={v.cycle} onChange={(e) => setV({ ...v, cycle: e.target.value })}>
              {Object.entries(CYCLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Places" hint="Laisser vide si illimité"><Money value={v.capacite} onChange={(x) => setV({ ...v, capacite: x })} /></Field>
          <Field label="Ordre d'affichage"><Money value={v.ordre} onChange={(x) => setV({ ...v, ordre: x ?? 0 })} /></Field>
        </div>
        <section>
          <div className="section-title"><h3>Frais d'inscription</h3></div>
          <div className="grid g3">
            <Field label="Droit d'inscription"><Money {...m("frais_inscription")} /></Field>
            <Field label="Uniforme et tenue de sport"><Money {...m("uniforme")} /></Field>
            <Field label="Inscription cantine"><Money {...m("frais_cantine")} /></Field>
          </div>
        </section>
        <section>
          <div className="section-title"><h3>Mensualités</h3><p>Janvier et février incluent la tranche du mois de juin.</p></div>
          <div className="grid g4">
            <Field label="Sans cantine"><Money {...m("mensualite")} /></Field>
            <Field label="Sans cantine, janv./févr."><Money {...m("mensualite_jan_fev")} /></Field>
            <Field label="Avec cantine"><Money {...m("mensualite_cantine")} /></Field>
            <Field label="Avec cantine, janv./févr."><Money {...m("mensualite_cantine_jan_fev")} /></Field>
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default function Classes() {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const peut = s.peut("classes.ecrire");

  const supprimer = async () => {
    try { await api.del(`/classes/${del.id}`); toast(`Classe ${del.nom} supprimée`); qc.invalidateQueries({ queryKey: ["classes"] }); }
    catch (e) { toast(e.message, "error"); }
    setDel(null);
  };

  const total = data?.reduce((t, c) => t + c.effectif, 0) || 0;

  return (
    <>
      <PageTitle title="Classes et tarifs" subtitle={`${data?.length || 0} classes · ${total} élèves · année ${s.annee?.libelle}`} />
      <div className="panel">
        <div className="panel-head">
          <h3>Grille {s.annee?.libelle}</h3>
          {peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Ajouter une classe</button>}
        </div>
        {isLoading ? <Spinner /> : error ? <div className="panel-body"><ErrorBox error={error} /></div> : !data.length ? (
          <Empty icon={School} title="Aucune classe pour cette année" action={peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Créer la première classe</button>}>
            Créez les classes et leurs tarifs, ou copiez-les depuis une autre année dans Paramètres.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>Classe</th><th>Effectif</th><th className="r">Inscription</th><th className="r hide-m">Uniforme</th>
                <th className="r">Mensualité</th><th className="r hide-m">Janv./févr.</th><th className="r">Avec cantine</th><th className="r hide-m">Janv./févr.</th>{peut && <th />}
              </tr></thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id}>
                    <td><span className="classe-tag">{c.nom}</span> <span className="muted small hide-m">{CYCLES[c.cycle]}</span></td>
                    <td className="num">{c.effectif}{c.capacite ? <span className="muted"> / {c.capacite}</span> : ""} <span className="muted small hide-m">({c.filles} F)</span></td>
                    <td className="r num">{fcfa(c.frais_inscription)}</td>
                    <td className="r num hide-m">{c.uniforme ? fcfa(c.uniforme) : "—"}</td>
                    <td className="r num"><strong>{fcfa(c.mensualite)}</strong></td>
                    <td className="r num hide-m">{fcfa(c.mensualite_jan_fev)}</td>
                    <td className="r num"><strong>{fcfa(c.mensualite_cantine)}</strong></td>
                    <td className="r num hide-m">{fcfa(c.mensualite_cantine_jan_fev)}</td>
                    {peut && <td className="r" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn sm ghost icon" onClick={() => setEdit(c)} aria-label={`Modifier ${c.nom}`}><Pencil size={15} /></button>
                      <button className="btn sm ghost icon" onClick={() => setDel(c)} aria-label={`Supprimer ${c.nom}`}><Trash2 size={15} /></button>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <ClasseForm classe={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {del && <Confirm danger title={`Supprimer la classe ${del.nom} ?`} confirmLabel="Supprimer" message="Seule une classe sans élève peut être supprimée." onConfirm={supprimer} onClose={() => setDel(null)} />}
    </>
  );
}
