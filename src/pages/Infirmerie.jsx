import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Stethoscope, Search, HeartPulse, ShieldAlert, House, MessageCircle, Thermometer, CalendarDays, Users, Pill, X, FileBarChart } from "lucide-react";
import { Stock } from "./InfirmerieStock";
import { Rapport } from "./InfirmerieRapport";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, dateLongue, today, initiales, moisNom, telWa } from "../lib/format";
import { Modal, Field, Input, Select, Textarea, Spinner, ErrorBox, Empty, Confirm, PageHead, useToast, Periode, periodes } from "../components/ui";

export const SUITES = { classe: "Retour en classe", repos: "Repos à l'infirmerie", maison: "Renvoyé(e) à la maison", hopital: "Orienté(e) vers l'hôpital" };
const SUITE_BADGE = { classe: "green", repos: "teal", maison: "gold", hopital: "coral" };
export const SuiteBadge = ({ suite }) => <span className={`badge ${SUITE_BADGE[suite] || ""}`}>{SUITES[suite] || suite}</span>;
const MOTIFS = ["Maux de tête", "Maux de ventre", "Fièvre", "Blessure / chute", "Vomissements", "Toux / rhume", "Saignement de nez", "Douleur dentaire", "Malaise", "Piqûre d'insecte"];
const GROUPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const heureMaintenant = () => new Date().toTimeString().slice(0, 5);
const INVALIDER = ["infirmerie", "sante", "infirmerie-alertes", "infirmerie-produits", "infirmerie-mouvements", "infirmerie-rapport"];
export const AUTORISATION = { oui: "Les parents autorisent les médicaments", non: "Les parents n'autorisent PAS les médicaments" };

// Message WhatsApp aux parents après un passage à l'infirmerie
export const messageParents = (etab, p) => {
  const suite = { classe: "Après les soins, l'enfant est retourné(e) en classe.", repos: "L'enfant se repose à l'infirmerie.", maison: "Merci de venir le/la chercher à l'école.", hopital: "Nous l'avons orienté(e) vers une structure de santé : merci de nous contacter rapidement." }[p.suite] || "";
  return `Bonjour, ${etab?.nom || "l'école"} vous informe que ${p.prenom} ${p.nom}${p.classe ? ` (${p.classe})` : ""} est passé(e) à l'infirmerie le ${date(p.date_passage)}${p.heure ? ` à ${p.heure}` : ""}. Motif : ${p.motif}.${p.temperature ? ` Température : ${String(p.temperature).replace(".", ",")} °C.` : ""}${p.soins ? ` Soins : ${p.soins}.` : ""} ${suite}`.trim();
};
export const BoutonParents = ({ p, sm = true }) => {
  const s = useSession();
  if (!p.telephone) return null;
  return <a className={`btn ${sm ? "sm" : ""} wa`} href={`https://wa.me/${telWa(p.telephone)}?text=${encodeURIComponent(messageParents(s.etablissement, p))}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /><span className="hide-m">Prévenir</span></a>;
};

export function ChoixEleve({ onPick }) {
  const s = useSession();
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(() => api.get("/eleves", { q, annee_id: s.annee?.id, limit: 8 }).then((r) => setRes(r.rows)).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="with-icon"><Search size={18} /><input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, prénom ou matricule de l'élève…" /></div>
      <div className="pick-list">
        {q.trim().length < 2 ? <p className="muted small">Tapez au moins deux lettres pour trouver l'élève.</p>
          : !res.length ? <p className="muted small">Aucun élève inscrit ne correspond.</p>
          : res.map((r) => (
            <button key={r.id} className="pick" onClick={() => onPick(r)}>
              <span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span>
              <div className="grow"><strong>{r.nom} {r.prenom}</strong><span>{r.matricule}</span></div>
              <span className={`chip ${r.cycle || ""}`}>{r.classe}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

// Encadré d'alerte : allergies et maladies connues de l'élève
function AlerteSante({ eleveId }) {
  const { data } = useQuery({ queryKey: ["sante", eleveId], queryFn: () => api.get(`/eleves/${eleveId}/sante`), enabled: !!eleveId });
  const f = data?.fiche || {};
  const aut = f.autorisation_medicaments;
  return (
    <>
      {(f.allergies || f.maladies || f.traitements) && (
        <div className="alert" style={{ margin: 0, display: "grid", gap: 4 }}>
          <strong><ShieldAlert size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />À savoir avant de soigner</strong>
          {f.allergies && <span className="small">Allergies : <strong>{f.allergies}</strong></span>}
          {f.maladies && <span className="small">Maladies : {f.maladies}</span>}
          {f.traitements && <span className="small">Traitement : {f.traitements}</span>}
        </div>
      )}
      {data && <div className={`alert ${aut === "oui" ? "info" : ""}`} style={{ margin: 0 }}>
        <Pill size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />
        {aut ? <><strong>{AUTORISATION[aut]}</strong>{aut === "oui" && f.medicaments_autorises ? ` : ${f.medicaments_autorises}` : ""}</> : <><strong>Autorisation des parents inconnue</strong> : ne donnez pas de médicament sans leur accord.</>}
      </div>}
    </>
  );
}

export function PassageForm({ passage, eleve: eleveInit, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [eleve, setEleve] = useState(passage ? { id: passage.eleve_id, nom: passage.nom, prenom: passage.prenom, classe: passage.classe } : eleveInit || null);
  const [v, setV] = useState(passage
    ? { ...passage, date_passage: passage.date_passage?.slice(0, 10), temperature: passage.temperature ?? "" }
    : { date_passage: today(), heure: heureMaintenant(), motif: "", symptomes: "", temperature: "", soins: "", medicaments: "", suite: "classe", parents_prevenus: false, note: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lignes, setLignes] = useState(() => (passage?.produits || []).map((x) => ({ produit_id: String(x.produit_id), quantite: x.quantite })));
  const produits = useQuery({ queryKey: ["infirmerie-produits"], queryFn: () => api.get("/infirmerie/produits") });
  const sante = useQuery({ queryKey: ["sante", eleve?.id], queryFn: () => api.get(`/eleves/${eleve.id}/sante`), enabled: !!eleve?.id });
  const autorise = sante.data?.fiche?.autorisation_medicaments;
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const majLigne = (i, patch) => setLignes((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = async () => {
    setError(null); setBusy(true);
    try {
      const d = { date_passage: v.date_passage, heure: v.heure, motif: v.motif, symptomes: v.symptomes, temperature: v.temperature === "" ? null : Number(String(v.temperature).replace(",", ".")),
        soins: v.soins, medicaments: v.medicaments, suite: v.suite, parents_prevenus: v.parents_prevenus, note: v.note,
        produits: lignes.filter((x) => x.produit_id && Number(x.quantite) > 0).map((x) => ({ produit_id: Number(x.produit_id), quantite: Number(x.quantite) })) };
      if (passage) await api.put(`/infirmerie/${passage.id}`, d); else await api.post("/infirmerie", { ...d, eleve_id: eleve.id });
      toast(passage ? "Passage modifié" : `Passage de ${eleve.prenom} enregistré`);
      INVALIDER.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const grave = v.suite === "maison" || v.suite === "hopital";
  return (
    <Modal title={passage ? "Modifier le passage" : "Passage à l'infirmerie"} icon={<Stethoscope size={20} />} onClose={onClose} footer={eleve && <>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.motif?.trim() || busy}>Enregistrer</button>
    </>}>
      {!eleve ? <ChoixEleve onPick={setEleve} /> : (
        <div className="stack" style={{ gap: 14 }}>
          <ErrorBox error={error} />
          <div className="pick" style={{ cursor: "default" }}>
            <span className="avatar">{initiales(eleve.prenom, eleve.nom)}</span>
            <div className="grow"><strong>{eleve.nom} {eleve.prenom}</strong><span>{eleve.classe || eleve.matricule}</span></div>
            {!passage && !eleveInit && <button className="btn sm ghost" onClick={() => setEleve(null)}>Changer</button>}
          </div>
          <AlerteSante eleveId={eleve.id} />
          <div className="grid g2">
            <Field label="Date"><Input type="date" value={v.date_passage} max={today()} onChange={set("date_passage")} /></Field>
            <Field label="Heure"><Input type="time" value={v.heure || ""} onChange={set("heure")} /></Field>
          </div>
          <Field label="Motif" required>
            <Input value={v.motif} onChange={set("motif")} list="motifs-infirmerie" placeholder="Maux de tête, chute dans la cour…" autoFocus />
            <datalist id="motifs-infirmerie">{MOTIFS.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <div className="grid g2">
            <Field label="Température (°C)"><Input inputMode="decimal" value={v.temperature} onChange={set("temperature")} placeholder="37,5" /></Field>
            <Field label="Suite donnée">
              <Select value={v.suite} onChange={set("suite")}>{Object.entries(SUITES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
            </Field>
          </div>
          <Field label="Symptômes observés"><Input value={v.symptomes || ""} onChange={set("symptomes")} placeholder="Pâle, a vomi une fois…" /></Field>
          <Field label="Soins donnés"><Input value={v.soins || ""} onChange={set("soins")} placeholder="Plaie nettoyée, compresse froide, repos…" /></Field>
          <div>
            <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Médicaments et matériel donnés <span className="muted" style={{ fontWeight: 400 }}>(retirés du stock)</span></div>
            <div className="stack" style={{ gap: 8 }}>
              {lignes.map((l, i) => {
                const pr = produits.data?.find((x) => String(x.id) === String(l.produit_id));
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px auto", gap: 8, alignItems: "center" }}>
                    <Select value={l.produit_id} onChange={(e) => majLigne(i, { produit_id: e.target.value })} aria-label="Produit">
                      <option value="">Choisir…</option>
                      {produits.data?.map((x) => <option key={x.id} value={x.id} disabled={x.stock <= 0 && String(x.id) !== String(l.produit_id)}>{x.nom} — {x.stock} {x.unite}</option>)}
                    </Select>
                    <Input type="number" min={1} value={l.quantite} onChange={(e) => majLigne(i, { quantite: e.target.value })} aria-label="Quantité" title={pr ? pr.unite : ""} />
                    <button className="btn sm ghost icon" onClick={() => setLignes((x) => x.filter((_, j) => j !== i))} aria-label="Retirer"><X size={15} /></button>
                  </div>
                );
              })}
              <div><button className="btn sm" onClick={() => setLignes((x) => [...x, { produit_id: "", quantite: 1 }])} disabled={!produits.data?.length}><Plus size={14} />Ajouter un produit</button>
                {produits.data && !produits.data.length && <span className="xs muted" style={{ marginLeft: 8 }}>Ajoutez d'abord vos produits dans l'onglet « Stock ».</span>}</div>
              {lignes.some((x) => x.produit_id) && autorise !== "oui" && <div className="alert" style={{ margin: 0 }}>{autorise === "non" ? "Les parents n'autorisent pas les médicaments pour cet élève." : "L'autorisation des parents n'est pas enregistrée."} Vérifiez avant de donner un médicament.</div>}
            </div>
          </div>
          <Field label="Autre médicament ou précision" hint="Seulement avec l'accord des parents ou selon le protocole de l'école.">
            <Input value={v.medicaments || ""} onChange={set("medicaments")} placeholder="Nom et dose" />
          </Field>
          <label className="switch-card"><input type="checkbox" checked={v.parents_prevenus} onChange={(e) => setV({ ...v, parents_prevenus: e.target.checked })} /><strong>Parents prévenus</strong></label>
          {grave && !v.parents_prevenus && <div className="alert info" style={{ margin: 0 }}>L'élève quitte l'école : pensez à prévenir les parents (bouton « Prévenir » dans la liste après l'enregistrement).</div>}
          <Field label="Remarque"><Textarea value={v.note || ""} onChange={set("note")} rows={2} /></Field>
        </div>
      )}
    </Modal>
  );
}

export function FicheSanteForm({ eleve, fiche, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState(() => ({ groupe_sanguin: "", allergies: "", maladies: "", traitements: "", vaccins: "", medecin: "", urgence_nom: "", urgence_telephone: "", remarques: "",
    autorisation_medicaments: "", medicaments_autorises: "", autorisation_date: "", autorisation_par: "",
    ...Object.fromEntries(Object.entries(fiche || {}).filter(([, x]) => x != null).map(([k, x]) => [k, k === "autorisation_date" ? String(x).slice(0, 10) : x])) }));
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setError(null);
    try {
      const { groupe_sanguin, allergies, maladies, traitements, vaccins, medecin, urgence_nom, urgence_telephone, remarques, autorisation_medicaments, medicaments_autorises, autorisation_date, autorisation_par } = v;
      await api.put(`/eleves/${eleve.id}/sante`, { groupe_sanguin, allergies, maladies, traitements, vaccins, medecin, urgence_nom, urgence_telephone, remarques,
        autorisation_medicaments, medicaments_autorises, autorisation_date, autorisation_par });
      toast("Fiche santé enregistrée");
      INVALIDER.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal title={`Fiche santé — ${eleve.prenom} ${eleve.nom}`} icon={<HeartPulse size={20} />} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <Field label="Allergies" hint="Aliments, médicaments, piqûres… Elles s'afficheront en alerte à chaque passage."><Input value={v.allergies} onChange={set("allergies")} placeholder="Arachide, pénicilline…" autoFocus /></Field>
        <Field label="Maladies ou problèmes de santé connus"><Input value={v.maladies} onChange={set("maladies")} placeholder="Asthme, drépanocytose, épilepsie…" /></Field>
        <Field label="Traitement en cours"><Input value={v.traitements} onChange={set("traitements")} placeholder="Ventoline en cas de crise…" /></Field>
        <div className="grid g2">
          <Field label="Groupe sanguin"><Select value={v.groupe_sanguin} onChange={set("groupe_sanguin")}><option value="">Inconnu</option>{GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}</Select></Field>
          <Field label="Vaccins"><Input value={v.vaccins} onChange={set("vaccins")} placeholder="À jour, carnet vu le…" /></Field>
          <Field label="Personne à prévenir en urgence"><Input value={v.urgence_nom} onChange={set("urgence_nom")} placeholder="Si différente des parents" /></Field>
          <Field label="Téléphone d'urgence"><Input type="tel" value={v.urgence_telephone} onChange={set("urgence_telephone")} /></Field>
        </div>
        <Field label="Médecin ou structure de santé suivie"><Input value={v.medecin} onChange={set("medecin")} /></Field>
        <div className="card" style={{ padding: 14, display: "grid", gap: 12, background: "var(--surface-2)" }}>
          <strong className="small"><Pill size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />Autorisation des parents pour les médicaments</strong>
          <div className="grid g2">
            <Field label="Les parents autorisent les médicaments ?">
              <Select value={v.autorisation_medicaments} onChange={set("autorisation_medicaments")}><option value="">Pas encore demandé</option><option value="oui">Oui</option><option value="non">Non</option></Select>
            </Field>
            <Field label="Date de l'accord"><Input type="date" value={v.autorisation_date} onChange={set("autorisation_date")} max={today()} /></Field>
          </div>
          {v.autorisation_medicaments === "oui" && <Field label="Médicaments autorisés" hint="Laisser vide si tous les médicaments courants sont autorisés."><Input value={v.medicaments_autorises} onChange={set("medicaments_autorises")} placeholder="Paracétamol, sirop contre la toux…" /></Field>}
          {v.autorisation_medicaments && <Field label="Accord donné par"><Input value={v.autorisation_par} onChange={set("autorisation_par")} placeholder="Mère, père, tuteur… (fiche signée)" /></Field>}
        </div>
        <Field label="Remarques"><Textarea value={v.remarques} onChange={set("remarques")} rows={2} /></Field>
      </div>
    </Modal>
  );
}

// Onglet « Santé » de la fiche élève
export function SanteEleve({ eleve }) {
  const s = useSession();
  const [form, setForm] = useState(false);
  const [passage, setPassage] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["sante", eleve.id], queryFn: () => api.get(`/eleves/${eleve.id}/sante`) });
  const peut = s.peut("infirmerie.ecrire");
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const f = data.fiche || {};
  const I = ({ label, children, fort }) => <><dt>{label}</dt><dd>{children ? (fort ? <span style={{ color: "var(--coral)" }}>{children}</span> : children) : <span className="muted">—</span>}</dd></>;
  return (
    <div className="info-grid">
      <div className="card">
        <div className="card-head"><h3>Fiche santé</h3>{peut && <button className="btn sm" onClick={() => setForm(true)}><Pencil size={14} />{data.fiche ? "Modifier" : "Remplir"}</button>}</div>
        <div className="card-body">
          <dl className="kv">
            <I label="Allergies" fort>{f.allergies}</I>
            <I label="Maladies" fort>{f.maladies}</I>
            <I label="Traitement">{f.traitements}</I>
            <I label="Groupe sanguin">{f.groupe_sanguin}</I>
            <I label="Vaccins">{f.vaccins}</I>
            <I label="Urgence">{[f.urgence_nom, f.urgence_telephone].filter(Boolean).join(" · ")}</I>
            <I label="Médecin">{f.medecin}</I>
            <I label="Médicaments" fort={f.autorisation_medicaments === "non"}>{f.autorisation_medicaments ? `${f.autorisation_medicaments === "oui" ? "Autorisés" : "Non autorisés"}${f.medicaments_autorises ? ` : ${f.medicaments_autorises}` : ""}${f.autorisation_date ? ` (accord du ${date(f.autorisation_date)}${f.autorisation_par ? `, ${f.autorisation_par}` : ""})` : ""}` : null}</I>
            <I label="Remarques">{f.remarques}</I>
          </dl>
          {data.fiche && <p className="xs muted" style={{ marginTop: 14 }}>Mise à jour le {date(f.updated_at)}{f.maj_par_nom ? ` par ${f.maj_par_nom}` : ""}</p>}
        </div>
      </div>
      <div className="card">
        <div className="card-head" style={{ paddingBottom: 14 }}><h3>Passages à l'infirmerie</h3>{peut && <button className="btn sm primary" onClick={() => setPassage("new")}><Plus size={14} />Nouveau passage</button>}</div>
        {data.passages.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Motif</th><th>Suite</th>{peut && <th />}</tr></thead>
            <tbody>{data.passages.map((p) => <tr key={p.id}>
              <td className="num">{date(p.date_passage)}{p.heure && <div className="xs muted">{p.heure}</div>}</td>
              <td><strong>{p.motif}</strong>{p.soins && <div className="xs muted">{p.soins}</div>}{p.produits?.length > 0 && <div className="xs muted"><Pill size={11} /> {p.produits.map((x) => `${x.nom} ×${x.quantite}`).join(", ")}</div>}</td>
              <td><SuiteBadge suite={p.suite} /></td>
              {peut && <td className="r"><button className="btn sm ghost icon" onClick={() => setPassage(p)} aria-label="Modifier"><Pencil size={15} /></button></td>}
            </tr>)}</tbody>
          </table></div>
        ) : <Empty icon={Stethoscope} title="Aucun passage">Cet élève n'est jamais passé à l'infirmerie.</Empty>}
      </div>
      {form && <FicheSanteForm eleve={eleve} fiche={data.fiche} onClose={() => setForm(false)} />}
      {passage && <PassageForm passage={passage === "new" ? null : passage} eleve={eleve} onClose={() => setPassage(null)} />}
    </div>
  );
}

function Alertes() {
  const { data, isLoading, error } = useQuery({ queryKey: ["infirmerie-alertes"], queryFn: () => api.get("/infirmerie/alertes") });
  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 18 }}><ErrorBox error={error} /></div>;
  if (!data.length) return <Empty icon={ShieldAlert} title="Aucun élève signalé">Remplissez la fiche santé d'un élève (onglet « Santé » de sa fiche) pour qu'il apparaisse ici.</Empty>;
  return (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Élève</th><th>Classe</th><th>Allergies</th><th className="hide-m">Maladies</th><th className="hide-m">Traitement</th><th className="hide-m">Urgence</th></tr></thead>
      <tbody>{data.map((e) => <tr key={e.id}>
        <td><Link to={`/eleves/${e.id}`}><strong>{e.nom} {e.prenom}</strong></Link><div className="xs muted">{e.matricule}</div></td>
        <td>{e.classe ? <span className={`chip ${e.cycle || ""}`}>{e.classe}</span> : "—"}</td>
        <td>{e.allergies ? <strong style={{ color: "var(--coral)" }}>{e.allergies}</strong> : <span className="muted">—</span>}</td>
        <td className="hide-m">{e.maladies || <span className="muted">—</span>}</td>
        <td className="hide-m">{e.traitements || <span className="muted">—</span>}</td>
        <td className="hide-m">{e.urgence_telephone || e.telephone || "—"}</td>
      </tr>)}</tbody>
    </table></div>
  );
}

export default function Infirmerie() {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("passages");
  const [du, setDu] = useState(() => periodes(s.annee).annee.du);
  const [au, setAu] = useState(() => periodes(s.annee).annee.au);
  const [suite, setSuite] = useState("");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const f = { du, au, suite };
  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["infirmerie", f], queryFn: () => api.get("/infirmerie", f), placeholderData: keepPreviousData });
  const peut = s.peut("infirmerie.ecrire");
  const supprimer = async () => {
    try { await api.del(`/infirmerie/${del.id}`); toast("Passage supprimé"); INVALIDER.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); }
    catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  const st = data?.stats;

  return (
    <>
      <PageHead title="Infirmerie" sub="Passages à l'infirmerie et élèves à surveiller">
        {peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={17} />Nouveau passage</button>}
      </PageHead>
      {st && (
        <div className="dash" style={{ marginBottom: 22 }}>
          <div className="card kpi c3">
            <div className="top"><span className="label">Aujourd'hui</span><span className="ic teal"><Stethoscope size={20} /></span></div>
            <div className="value">{st.aujourdhui}</div>
            <div className="sub">passage{st.aujourdhui > 1 ? "s" : ""} le {dateLongue(today())}</div>
          </div>
          <div className="card kpi c3">
            <div className="top"><span className="label">Sur la période</span><span className="ic azure"><CalendarDays size={20} /></span></div>
            <div className="value">{st.total}</div>
            <div className="sub"><Users size={14} />{st.eleves} élève{st.eleves > 1 ? "s" : ""} différent{st.eleves > 1 ? "s" : ""}</div>
          </div>
          <div className="card kpi c3">
            <div className="top"><span className="label">Renvoyés à la maison</span><span className="ic gold"><House size={20} /></span></div>
            <div className="value">{st.renvoyes}</div>
            <div className="sub">{st.sans_parents ? <span style={{ color: "var(--coral)" }}>{st.sans_parents} sans parents prévenus</span> : "ou orientés vers l'hôpital"}</div>
          </div>
          <div className="card kpi c3" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => setTab("alertes")}>
            <div className="top"><span className="label">Élèves à surveiller</span><span className="ic coral"><ShieldAlert size={20} /></span></div>
            <div className="value">{st.alertes}</div>
            <div className="sub">allergies ou maladies connues</div>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" className={tab === "passages" ? "on" : ""} onClick={() => setTab("passages")}><Stethoscope size={16} />Passages</button>
        <button role="tab" className={tab === "stock" ? "on" : ""} onClick={() => setTab("stock")}><Pill size={16} />Stock{st && st.stock_bas + st.peremption > 0 ? <span className="count" style={{ background: "var(--coral)", color: "#fff" }}>{st.stock_bas + st.peremption}</span> : null}</button>
        <button role="tab" className={tab === "rapport" ? "on" : ""} onClick={() => setTab("rapport")}><FileBarChart size={16} />Rapport</button>
        <button role="tab" className={tab === "alertes" ? "on" : ""} onClick={() => setTab("alertes")}><ShieldAlert size={16} />Élèves à surveiller{st ? <span className="count">{st.alertes}</span> : null}</button>
      </div>

      {tab === "stock" ? <Stock /> : tab === "rapport" ? <Rapport /> : <div className="card">
        {tab === "alertes" ? <Alertes /> : <>
          <div className="toolbar">
            <Periode annee={s.annee} du={du} au={au} onChange={(d, x) => { setDu(d); setAu(x); }} />
            <Select value={suite} onChange={(e) => setSuite(e.target.value)} aria-label="Suite donnée"><option value="">Toutes les suites</option>{Object.entries(SUITES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          </div>
          {data?.motifs?.length > 0 && <div className="legend" style={{ padding: "0 18px 14px" }}>Motifs fréquents : {data.motifs.map((m) => <span key={m.motif} className="badge">{m.motif.charAt(0).toUpperCase() + m.motif.slice(1)} · {m.nombre}</span>)}</div>}
          {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.rows.length ? (
            <Empty icon={Stethoscope} title="Aucun passage" action={peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Enregistrer un passage</button>}>Aucun passage à l'infirmerie sur cette période.</Empty>
          ) : (
            <div className="table-wrap" style={{ opacity: isFetching ? 0.65 : 1 }}>
              <table className="table">
                <thead><tr><th>Date</th><th>Élève</th><th>Motif</th><th className="hide-m">Soins</th><th>Suite</th><th className="hide-m">Parents</th><th /></tr></thead>
                <tbody>{data.rows.map((p, i) => (
                  <Fragment key={p.id}>{(i === 0 || data.rows[i - 1].date_passage.slice(0, 7) !== p.date_passage.slice(0, 7)) && <tr className="mois-row"><td colSpan={7}>{moisNom(p.date_passage.slice(0, 7))} {p.date_passage.slice(0, 4)}</td></tr>}
                  <tr>
                    <td className="num">{date(p.date_passage)}{p.heure && <div className="xs muted">{p.heure}</div>}</td>
                    <td>
                      <Link to={`/eleves/${p.eleve_id}`}><strong>{p.nom} {p.prenom}</strong></Link>
                      <div className="xs muted">{p.classe || p.matricule}{p.allergies && <span style={{ color: "var(--coral)", fontWeight: 700 }}> · Allergie : {p.allergies}</span>}</div>
                    </td>
                    <td><strong>{p.motif}</strong>{p.temperature != null && <div className="xs muted"><Thermometer size={12} style={{ verticalAlign: "-2px" }} /> {String(p.temperature).replace(".", ",")} °C</div>}</td>
                    <td className="hide-m">{p.soins || p.medicaments || p.produits?.length ? <>{p.soins}{p.produits?.length > 0 && <div className="xs muted"><Pill size={11} /> {p.produits.map((x) => `${x.nom} ×${x.quantite}`).join(", ")}</div>}{p.medicaments && <div className="xs muted">Médicament : {p.medicaments}</div>}</> : <span className="muted">—</span>}</td>
                    <td><SuiteBadge suite={p.suite} /></td>
                    <td className="hide-m">{p.parents_prevenus ? <span className="badge green">Prévenus</span> : <span className="muted">Non</span>}</td>
                    <td className="r" style={{ whiteSpace: "nowrap" }}>
                      <BoutonParents p={p} />
                      {peut && <button className="btn sm ghost icon" onClick={() => setEdit(p)} aria-label="Modifier"><Pencil size={15} /></button>}
                      {peut && <button className="btn sm ghost icon" onClick={() => setDel(p)} aria-label="Supprimer"><Trash2 size={15} /></button>}
                    </td>
                  </tr></Fragment>))}</tbody>
              </table>
            </div>
          )}
        </>}
      </div>}
      {edit && <PassageForm passage={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {del && <Confirm danger title="Supprimer ce passage ?" confirmLabel="Supprimer" message={`${del.prenom} ${del.nom} — ${del.motif} (${date(del.date_passage)})`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </>
  );
}
