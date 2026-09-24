import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, today } from "../lib/format";
import { Modal, Field, Input, Select, Textarea, ErrorBox, useToast } from "../components/ui";

const VIDE = {
  nom: "", prenom: "", sexe: "", date_naissance: "", lieu_naissance: "", adresse: "",
  pere_prenom: "", pere_nom: "", pere_profession: "", pere_telephone: "",
  mere_prenom: "", mere_nom: "", mere_profession: "", mere_telephone: "",
  tuteur_nom: "", tuteur_telephone: "", observations: "",
};

// Création (avec inscription) ou modification d'un élève.
export default function EleveForm({ eleve, onClose, onSaved }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const edition = !!eleve;
  const [v, setV] = useState(() => ({ ...VIDE, ...(eleve || {}), date_naissance: eleve?.date_naissance?.slice(0, 10) || "" }));
  const [ins, setIns] = useState({ classe_id: "", cantine: false, date_inscription: today(), type: "nouvelle" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }), enabled: !edition });
  const mat = useQuery({ queryKey: ["matricule", s.annee?.id], queryFn: () => api.get("/eleves-matricule", { annee_id: s.annee?.id }), enabled: !edition });
  const classe = useMemo(() => classes.data?.find((c) => c.id === Number(ins.classe_id)), [classes.data, ins.classe_id]);

  useEffect(() => { if (mat.data && !v.matricule) setV((x) => ({ ...x, matricule: mat.data.matricule })); }, [mat.data]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (edition) {
        const { id, matricule, created_at, updated_at, statut, ...data } = v;
        await api.put(`/eleves/${eleve.id}`, data);
        toast("Fiche de l'élève mise à jour");
        onSaved?.(eleve.id);
      } else {
        const r = await api.post("/eleves", { eleve: v, inscription: { ...ins, annee_id: s.annee?.id } });
        toast(`${r.prenom} ${r.nom} inscrit(e) — matricule ${r.matricule}`);
        onSaved?.(r.id);
      }
      qc.invalidateQueries({ queryKey: ["eleves"] });
      qc.invalidateQueries({ queryKey: ["eleve"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["matricule"] });
    } catch (e) { setError(e); document.querySelector(".modal-body")?.scrollTo({ top: 0, behavior: "smooth" }); }
    setBusy(false);
  };

  const fraisInscription = classe ? classe.frais_inscription + classe.uniforme + (ins.cantine ? classe.frais_cantine : 0) : 0;
  const mensuel = classe ? (ins.cantine ? classe.mensualite_cantine : classe.mensualite) : 0;

  return (
    <Modal wide title={edition ? `Modifier ${eleve.prenom} ${eleve.nom}` : "Inscrire un nouvel élève"} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Enregistrement…" : edition ? "Enregistrer les modifications" : "Inscrire l'élève"}</button>
    </>}>
      <div className="stack">
        <ErrorBox error={error} />

        <section>
          <div className="section-title"><h3>Identité de l'élève</h3></div>
          <div className="grid g3">
            <Field label="Prénom(s)" required><Input value={v.prenom} onChange={set("prenom")} autoFocus /></Field>
            <Field label="Nom" required><Input value={v.nom} onChange={set("nom")} style={{ textTransform: "uppercase" }} /></Field>
            <Field label="Sexe" required>
              <div className="seg" role="radiogroup">
                <button type="button" className={v.sexe === "F" ? "on" : ""} onClick={() => setV({ ...v, sexe: "F" })}>Fille</button>
                <button type="button" className={v.sexe === "M" ? "on" : ""} onClick={() => setV({ ...v, sexe: "M" })}>Garçon</button>
              </div>
            </Field>
            <Field label="Date de naissance"><Input type="date" value={v.date_naissance} onChange={set("date_naissance")} /></Field>
            <Field label="Lieu de naissance"><Input value={v.lieu_naissance || ""} onChange={set("lieu_naissance")} /></Field>
            <Field label="Matricule" hint={edition ? "Non modifiable" : "Généré automatiquement, modifiable"}>
              <Input value={v.matricule || ""} onChange={set("matricule")} disabled={edition} />
            </Field>
            <Field label="Adresse" className="span2"><Input value={v.adresse || ""} onChange={set("adresse")} placeholder="Quartier, rue, villa…" /></Field>
          </div>
        </section>

        <section>
          <div className="section-title"><h3>Parents et tuteur</h3><p>Au moins un numéro joignable est recommandé.</p></div>
          <div className="grid g4">
            <Field label="Prénom du père"><Input value={v.pere_prenom || ""} onChange={set("pere_prenom")} /></Field>
            <Field label="Nom du père"><Input value={v.pere_nom || ""} onChange={set("pere_nom")} /></Field>
            <Field label="Profession"><Input value={v.pere_profession || ""} onChange={set("pere_profession")} /></Field>
            <Field label="Téléphone du père"><Input type="tel" value={v.pere_telephone || ""} onChange={set("pere_telephone")} placeholder="77 000 00 00" /></Field>
            <Field label="Prénom de la mère"><Input value={v.mere_prenom || ""} onChange={set("mere_prenom")} /></Field>
            <Field label="Nom de la mère"><Input value={v.mere_nom || ""} onChange={set("mere_nom")} /></Field>
            <Field label="Profession"><Input value={v.mere_profession || ""} onChange={set("mere_profession")} /></Field>
            <Field label="Téléphone de la mère"><Input type="tel" value={v.mere_telephone || ""} onChange={set("mere_telephone")} placeholder="77 000 00 00" /></Field>
            <Field label="Tuteur (si différent)" className="span2"><Input value={v.tuteur_nom || ""} onChange={set("tuteur_nom")} /></Field>
            <Field label="Téléphone du tuteur" className="span2"><Input type="tel" value={v.tuteur_telephone || ""} onChange={set("tuteur_telephone")} /></Field>
          </div>
        </section>

        {!edition && (
          <section>
            <div className="section-title"><h3>Inscription {s.annee?.libelle}</h3></div>
            <div className="grid g2" style={{ alignItems: "start" }}>
              <div className="grid" style={{ gap: 14 }}>
                <Field label="Classe" required>
                  <Select value={ins.classe_id} onChange={(e) => setIns({ ...ins, classe_id: e.target.value })}>
                    <option value="">Choisir une classe…</option>
                    {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom} — {c.effectif} élève{c.effectif > 1 ? "s" : ""}{c.capacite ? ` / ${c.capacite}` : ""}</option>)}
                  </Select>
                </Field>
                <div className="grid g2">
                  <Field label="Type">
                    <Select value={ins.type} onChange={(e) => setIns({ ...ins, type: e.target.value })}>
                      <option value="nouvelle">Nouvelle inscription</option>
                      <option value="reinscription">Réinscription</option>
                    </Select>
                  </Field>
                  <Field label="Date d'inscription"><Input type="date" value={ins.date_inscription} onChange={(e) => setIns({ ...ins, date_inscription: e.target.value })} /></Field>
                </div>
                <label className="check"><input type="checkbox" checked={ins.cantine} onChange={(e) => setIns({ ...ins, cantine: e.target.checked })} />Inscrit(e) à la cantine</label>
              </div>
              <div className="recap">
                <strong>Frais à régler à l'inscription</strong>
                {classe ? <>
                  <div className="recap-row" style={{ marginTop: 10 }}><span>Droit d'inscription</span><span>{fcfa(classe.frais_inscription)}</span></div>
                  {classe.uniforme > 0 && <div className="recap-row"><span>Uniforme et tenue de sport</span><span>{fcfa(classe.uniforme)}</span></div>}
                  {ins.cantine && <div className="recap-row"><span>Inscription cantine</span><span>{fcfa(classe.frais_cantine)}</span></div>}
                  <div className="recap-row total"><span>Total</span><span>{fcfa(fraisInscription)}</span></div>
                  <p className="small muted" style={{ margin: "10px 0 0" }}>Mensualité ensuite : {fcfa(mensuel)} par mois.</p>
                </> : <p className="small muted" style={{ margin: "8px 0 0" }}>Choisissez une classe pour voir les tarifs.</p>}
              </div>
            </div>
          </section>
        )}

        <Field label="Observations"><Textarea value={v.observations || ""} onChange={set("observations")} placeholder="Santé, allergies, informations utiles…" /></Field>
      </div>
    </Modal>
  );
}
