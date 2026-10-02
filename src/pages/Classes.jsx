import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, School, LayoutGrid, Table2, Receipt, CalendarRange, Settings2, Baby, BookOpen, UserRound } from "lucide-react";
import Matieres from "../components/Matieres";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, CYCLES } from "../lib/format";
import { Modal, Field, Input, Select, Money, Spinner, ErrorBox, Empty, Confirm, useToast, PageHead } from "../components/ui";
const Sec = ({ icon: I, tone, title, sub, children }) => (
  <section className="form-section">
    <div className="head"><span className={`ic ${tone}`}><I size={18} /></span><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div></div>
    {children}
  </section>
);
const COL = { garderie: "var(--gold-ink)", prescolaire: "var(--coral)", elementaire: "var(--teal)" };

const VIDE = { nom: "", cycle: "elementaire", ordre: 0, capacite: null, titulaire_id: null, bareme: 10, frais_inscription: 0, uniforme: 0, tenue_sport: 0, cours_soir: 0, mensualite: 0, mensualite_jan_fev: 0, mensualite_cantine: 0, mensualite_cantine_jan_fev: 0, frais_cantine: 0 };

function ClasseForm({ classe, onClose }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState({ ...VIDE, ...(classe || {}) });
  const [error, setError] = useState(null);
  const m = (k) => ({ value: v[k], onChange: (x) => setV({ ...v, [k]: x ?? 0 }) });
  const ens = useQuery({ queryKey: ["enseignants"], queryFn: () => api.get("/enseignants") });

  const save = async () => {
    setError(null);
    const { id, annee_id, effectif, filles, titulaire, nb_matieres, ...data } = v;
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
    <Modal wide pad={false} title={classe ? `Classe ${classe.nom}` : "Nouvelle classe"} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.nom}>Enregistrer</button>
    </>}>
      <div>
        <ErrorBox error={error} />
        <Sec icon={Settings2} tone="teal" title="Classe">
        <div className="grid g4">
          <Field label="Nom" required><Input value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} autoFocus placeholder="CE1" /></Field>
          <Field label="Cycle">
            <Select value={v.cycle} onChange={(e) => setV({ ...v, cycle: e.target.value })}>
              {Object.entries(CYCLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Places" hint="Laisser vide si illimité"><Money value={v.capacite} onChange={(x) => setV({ ...v, capacite: x })} /></Field>
          <Field label="Ordre d'affichage"><Money value={v.ordre} onChange={(x) => setV({ ...v, ordre: x ?? 0 })} /></Field>
          <Field label="Enseignant titulaire" className="span2">
            <Select value={v.titulaire_id || ""} onChange={(e) => setV({ ...v, titulaire_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Aucun</option>{ens.data?.filter((x) => x.statut === "actif").map((x) => <option key={x.id} value={x.id}>{x.prenom} {x.nom}</option>)}
            </Select>
          </Field>
          <Field label="Moyennes sur" hint="Barème des bulletins"><Select value={v.bareme} onChange={(e) => setV({ ...v, bareme: Number(e.target.value) })}><option value={10}>10</option><option value={20}>20</option></Select></Field>
        </div>
        </Sec>
        <Sec icon={Receipt} tone="gold" title="Frais d'inscription">
          <div className="grid g3">
            <Field label="Droit d'inscription"><Money {...m("frais_inscription")} /></Field>
            <Field label="Uniforme"><Money {...m("uniforme")} /></Field>
            <Field label="Tenue de sport"><Money {...m("tenue_sport")} /></Field>
            <Field label="Inscription cantine"><Money {...m("frais_cantine")} /></Field>
          </div>
        </Sec>
        <Sec icon={CalendarRange} tone="azure" title="Mensualités" sub="Janvier et février incluent chacun une moitié du mois de juin.">
          <div className="grid g4">
            <Field label="Sans cantine"><Money {...m("mensualite")} /></Field>
            <Field label="Sans cantine, janv./févr."><Money {...m("mensualite_jan_fev")} /></Field>
            <Field label="Avec cantine"><Money {...m("mensualite_cantine")} /></Field>
            <Field label="Avec cantine, janv./févr."><Money {...m("mensualite_cantine_jan_fev")} /></Field>
            <Field label="Cours du soir (par mois)" hint="Ajouté à la mensualité des élèves inscrits au cours du soir (case à cocher à l'inscription), d'octobre à mai." className="span2"><Money {...m("cours_soir")} /></Field>
          </div>
        </Sec>
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
  const [mat, setMat] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const peut = s.peut("classes.ecrire");

  const supprimer = async () => {
    try { await api.del(`/classes/${del.id}`); toast(`Classe ${del.nom} supprimée`); qc.invalidateQueries({ queryKey: ["classes"] }); }
    catch (e) { toast(e.message, "error"); }
    setDel(null);
  };

  const total = data?.reduce((t, c) => t + c.effectif, 0) || 0;
  const [vue, setVue] = useState("cartes");

  return (
    <>
      <PageHead title="Classes et tarifs" sub={`${data?.length || 0} classes, ${total} élèves en ${s.annee?.libelle}`}>
        <div className="seg">
          <button className={vue === "cartes" ? "on" : ""} onClick={() => setVue("cartes")} aria-label="Vue en cartes"><LayoutGrid size={16} /></button>
          <button className={vue === "grille" ? "on" : ""} onClick={() => setVue("grille")} aria-label="Grille tarifaire"><Table2 size={16} /></button>
        </div>
        {peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={17} />Ajouter une classe</button>}
      </PageHead>

      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : !data.length ? (
        <div className="card"><Empty icon={School} title="Aucune classe pour cette année" action={peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Créer la première classe</button>}>
          Créez les classes et leurs tarifs, ou reprenez-les d'une autre année dans Paramètres.
        </Empty></div>
      ) : vue === "cartes" ? (
        <div className="class-grid">
          {data.map((c) => {
            const cap = c.capacite || 0;
            const pf = c.effectif ? (c.filles / c.effectif) * 100 : 0;
            return (
              <div key={c.id} className="card class-card">
                {peut && <div className="tools">
                  <button className="btn sm ghost icon" onClick={() => setEdit(c)} aria-label={`Modifier ${c.nom}`}><Pencil size={15} /></button>
                  <button className="btn sm ghost icon" onClick={() => setDel(c)} aria-label={`Supprimer ${c.nom}`}><Trash2 size={15} /></button>
                </div>}
                <div className="head">
                  <span className={`big ${c.cycle}`}>{c.cycle === "garderie" ? <Baby size={24} /> : c.nom.length > 4 ? c.nom.slice(0, 3) : c.nom}</span>
                  <div className="t"><strong>{c.nom}</strong><span>{CYCLES[c.cycle]}</span></div>
                </div>
                <div>
                  <div className="eff"><strong>{c.effectif}</strong><span>{cap ? `sur ${cap} places` : "élèves"}</span></div>
                  <div className="fill" style={{ marginTop: 10 }}>
                    <i style={{ width: `${cap ? (c.filles / cap) * 100 : pf}%`, background: "var(--rose)" }} />
                    <i style={{ width: `${cap ? ((c.effectif - c.filles) / cap) * 100 : c.effectif ? 100 - pf : 0}%`, background: "var(--azure)" }} />
                  </div>
                  <div className="legend xs" style={{ marginTop: 8 }}><span><i className="dot" style={{ background: "var(--rose)" }} />{c.filles} filles</span><span><i className="dot" style={{ background: "var(--azure)" }} />{c.effectif - c.filles} garçons</span></div>
                </div>
                <dl className="tarifs">
                  <dt>Inscription</dt><dd>{fcfa(c.frais_inscription)}</dd>
                  {c.uniforme > 0 && <><dt>Uniforme</dt><dd>{fcfa(c.uniforme)}</dd></>}
                  {c.tenue_sport > 0 && <><dt>Tenue de sport</dt><dd>{fcfa(c.tenue_sport)}</dd></>}
                  <dt>Mensualité</dt><dd>{fcfa(c.mensualite)}</dd>
                  <dt>Avec cantine</dt><dd style={{ color: COL[c.cycle] }}>{fcfa(c.mensualite_cantine)}</dd>
                  {c.cours_soir > 0 && <><dt>Cours du soir (option)</dt><dd>+ {fcfa(c.cours_soir)} / mois</dd></>}
                </dl>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                  <span className="row muted" style={{ gap: 6 }}><UserRound size={15} />{c.titulaire || "Pas de titulaire"}</span>
                  {c.cycle !== "garderie" && <button className="btn sm" onClick={() => setMat(c)}><BookOpen size={14} />{c.nb_matieres} matière{c.nb_matieres > 1 ? "s" : ""}</button>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table" style={{ marginTop: -1 }}>
              <thead><tr>
                <th>Classe</th><th>Effectif</th><th className="r">Inscription</th><th className="r hide-m">Uniforme</th><th className="r hide-m">Tenue sport</th>
                <th className="r">Mensualité</th><th className="r hide-m">Janv./févr.</th><th className="r">Avec cantine</th><th className="r hide-m">Janv./févr.</th><th className="r hide-m">Cours du soir</th>{peut && <th />}
              </tr></thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id}>
                    <td><span className={`chip ${c.cycle}`}>{c.nom}</span></td>
                    <td className="num">{c.effectif}{c.capacite ? <span className="muted"> / {c.capacite}</span> : ""}</td>
                    <td className="r num">{fcfa(c.frais_inscription)}</td>
                    <td className="r num hide-m">{c.uniforme ? fcfa(c.uniforme) : "—"}</td>
                    <td className="r num hide-m">{c.tenue_sport ? fcfa(c.tenue_sport) : "—"}</td>
                    <td className="r num"><strong>{fcfa(c.mensualite)}</strong></td>
                    <td className="r num hide-m">{fcfa(c.mensualite_jan_fev)}</td>
                    <td className="r num"><strong>{fcfa(c.mensualite_cantine)}</strong></td>
                    <td className="r num hide-m">{fcfa(c.mensualite_cantine_jan_fev)}</td>
                    <td className="r num hide-m">{c.cours_soir ? `+ ${fcfa(c.cours_soir)}` : "—"}</td>
                    {peut && <td className="r" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn sm ghost icon" onClick={() => setEdit(c)} aria-label={`Modifier ${c.nom}`}><Pencil size={15} /></button>
                      <button className="btn sm ghost icon" onClick={() => setDel(c)} aria-label={`Supprimer ${c.nom}`}><Trash2 size={15} /></button>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {mat && <Matieres classe={mat} onClose={() => setMat(null)} />}
      {edit && <ClasseForm classe={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {del && <Confirm danger title={`Supprimer la classe ${del.nom} ?`} confirmLabel="Supprimer" message="Seule une classe sans élève peut être supprimée." onConfirm={supprimer} onClose={() => setDel(null)} />}
    </>
  );
}
