import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Users, Phone, School, BookOpen, Search, Printer, CalendarX2, Wallet, CheckCircle2, Undo2, FileText, ArrowLeft, UserX, Clock,
} from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { initiales, date, fcfa, today, MODES } from "../lib/format";
import { Modal, Field, Input, Select, Money, Textarea, Spinner, ErrorBox, Empty, Confirm, PageHead, useToast } from "../components/ui";
import Partager from "../components/Partager";
import { EnTete } from "./Documents";
import { SERVICES, CONTRATS, TYPES_ABS, COULEUR_ABS, service } from "../lib/personnel";

const MOIS_L = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisLib = (m) => { const [y, mo] = String(m).slice(0, 7).split("-"); return `${MOIS_L[Number(mo) - 1]} ${y}`; };
const moisCourant = () => new Date().toISOString().slice(0, 7);
const nomP = (p) => `${p.prenom} ${p.nom}`;
const MIco = ({ I }) => <span className="ic teal" style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center" }}><I size={19} /></span>;

// ── Fiche d'un membre du personnel ──
function PersonnelForm({ p, onClose, serviceDefaut }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const [v, setV] = useState({ nom: "", prenom: "", sexe: "", service: serviceDefaut || "enseignant", poste: "", contrat: "", telephone: "", email: "", adresse: "", specialite: "", diplome: "", salaire: null, statut: "actif", horaires: "", contact_urgence: "", observations: "", ...(p || {}), date_embauche: p?.date_embauche?.slice(0, 10) || "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const ens = v.service === "enseignant";
  const save = async () => {
    setError(null);
    try {
      const d = { nom: v.nom, prenom: v.prenom, sexe: v.sexe || null, service: v.service, poste: v.poste, contrat: v.contrat || null, telephone: v.telephone, email: v.email, adresse: v.adresse,
        specialite: v.specialite, diplome: v.diplome, date_embauche: v.date_embauche || null, statut: v.statut, horaires: v.horaires, contact_urgence: v.contact_urgence, observations: v.observations };
      if (s.peut("finances.lire")) d.salaire = v.salaire || null;
      if (ens) d.classe_id = v.classe_id ? Number(v.classe_id) : null;
      if (p) await api.put(`/enseignants/${p.id}`, d); else await api.post("/enseignants", d);
      toast(p ? "Fiche mise à jour" : `${v.prenom} ${v.nom.toUpperCase()} ajouté(e)`);
      ["personnel", "enseignants", "classes", "salaires"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal wide icon={<MIco I={Users} />} title={p ? nomP(p) : "Nouveau membre du personnel"} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.nom || !v.prenom}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 16 }}>
        <ErrorBox error={error} />
        <Field label="Service">
          <div className="perso-services">{Object.entries(SERVICES).map(([k, x]) => (
            <button key={k} type="button" className={v.service === k ? "on" : ""} onClick={() => setV({ ...v, service: k })}><span>{x.ic}</span>{x.nom}</button>
          ))}</div>
        </Field>
        <div className="grid g3">
          <Field label="Prénom" required><Input value={v.prenom} onChange={set("prenom")} autoFocus /></Field>
          <Field label="Nom" required><Input value={v.nom} onChange={set("nom")} style={{ textTransform: "uppercase" }} /></Field>
          <Field label="Sexe"><div className="seg full">
            <button type="button" className={v.sexe === "F" ? "on F" : ""} onClick={() => setV({ ...v, sexe: "F" })}>Femme</button>
            <button type="button" className={v.sexe === "M" ? "on M" : ""} onClick={() => setV({ ...v, sexe: "M" })}>Homme</button>
          </div></Field>
          <Field label="Poste / fonction"><Input value={v.poste || ""} onChange={set("poste")} placeholder={service(v).poste} /></Field>
          <Field label="Contrat"><Select value={v.contrat || ""} onChange={set("contrat")}><option value="">—</option>{Object.entries(CONTRATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Date d'embauche"><Input type="date" value={v.date_embauche} onChange={set("date_embauche")} /></Field>
          <Field label="Téléphone"><Input type="tel" value={v.telephone || ""} onChange={set("telephone")} /></Field>
          <Field label="Email"><Input type="email" value={v.email || ""} onChange={set("email")} /></Field>
          <Field label="Adresse"><Input value={v.adresse || ""} onChange={set("adresse")} /></Field>
          <Field label="Horaires / jours de travail"><Input value={v.horaires || ""} onChange={set("horaires")} placeholder="Lun–ven 7h30–17h" /></Field>
          <Field label="Personne à prévenir"><Input value={v.contact_urgence || ""} onChange={set("contact_urgence")} placeholder="Nom et téléphone" /></Field>
          <Field label="Diplôme / formation"><Input value={v.diplome || ""} onChange={set("diplome")} placeholder={ens ? "CAP, CEAP, licence…" : ""} /></Field>
          {s.peut("finances.lire") && <Field label="Salaire mensuel"><Money value={v.salaire} onChange={(x) => setV({ ...v, salaire: x })} /></Field>}
          {ens && <Field label="Spécialité"><Input value={v.specialite || ""} onChange={set("specialite")} placeholder="Instituteur, anglais…" /></Field>}
          {ens && <Field label="Classe (titulaire)">
            <Select value={v.classe_id || ""} onChange={(e) => setV({ ...v, classe_id: e.target.value })}>
              <option value="">Aucune classe</option>
              {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.titulaire && c.id !== Number(v.classe_id) ? ` (actuellement : ${c.titulaire})` : ""}</option>)}
            </Select>
          </Field>}
          <Field label="Statut"><Select value={v.statut} onChange={set("statut")}><option value="actif">En poste</option><option value="inactif">Parti / inactif</option></Select></Field>
        </div>
        <Field label="Observations"><Textarea value={v.observations || ""} onChange={set("observations")} /></Field>
      </div>
    </Modal>
  );
}

function AbsenceForm({ a, personnel, personneId, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState(a ? { ...a, date_debut: a.date_debut?.slice(0, 10), date_fin: a.date_fin?.slice(0, 10) || "" } : { personnel_id: personneId || "", type: "absence", date_debut: today(), date_fin: "", justifiee: false, motif: "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setError(null);
    try {
      const d = { personnel_id: Number(v.personnel_id), type: v.type, date_debut: v.date_debut, date_fin: v.type === "retard" ? null : v.date_fin || null, justifiee: !!v.justifiee, motif: v.motif };
      if (a) await api.put(`/personnel/absences/${a.id}`, d); else await api.post("/personnel/absences", d);
      toast("Enregistré"); ["personnel-absences", "personnel", "salaires"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal icon={<MIco I={CalendarX2} />} title={a ? "Modifier" : "Absence, retard ou congé"} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={save} disabled={!v.personnel_id || !v.date_debut}>Enregistrer</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <Field label="Membre du personnel" required>
          <Select value={v.personnel_id} onChange={set("personnel_id")}><option value="">Choisir…</option>
            {Object.entries(SERVICES).map(([k, x]) => { const l = personnel.filter((p) => (p.service || "autre") === k && p.statut === "actif"); return l.length ? <optgroup key={k} label={x.nom}>{l.map((p) => <option key={p.id} value={p.id}>{nomP(p)}{p.poste ? ` — ${p.poste}` : ""}</option>)}</optgroup> : null; })}
          </Select>
        </Field>
        <div className="seg full wrap" role="radiogroup">{Object.entries(TYPES_ABS).map(([k, l]) => <button key={k} type="button" className={v.type === k ? "on" : ""} onClick={() => setV({ ...v, type: k })}>{l}</button>)}</div>
        <div className="grid g2">
          <Field label={v.type === "retard" ? "Date" : "Du"}><Input type="date" value={v.date_debut} onChange={set("date_debut")} /></Field>
          {v.type !== "retard" && <Field label="Au (si plusieurs jours)"><Input type="date" value={v.date_fin} min={v.date_debut} onChange={set("date_fin")} /></Field>}
        </div>
        <Field label="Motif"><Input value={v.motif || ""} onChange={set("motif")} /></Field>
        <label className="check"><input type="checkbox" checked={!!v.justifiee} onChange={(e) => setV({ ...v, justifiee: e.target.checked })} />Justifiée / autorisée</label>
      </div>
    </Modal>
  );
}

// ── Page Personnel ──
export default function Personnel() {
  const s = useSession();
  const [p, setP] = useSearchParams();
  const onglet = p.get("vue") || "equipe";
  const { data, isLoading, error } = useQuery({ queryKey: ["personnel", s.annee?.id], queryFn: () => api.get("/personnel", { annee_id: s.annee?.id }) });
  const actifs = data?.filter((x) => x.statut === "actif") || [];
  const absents = actifs.filter((x) => x.absent_aujourdhui).length;
  const tabs = [["equipe", "L'équipe", Users], ["absences", "Absences et congés", CalendarX2], ...(s.peut("finances.lire") ? [["salaires", "Salaires", Wallet]] : [])];
  return (
    <>
      <PageHead title="Personnel" sub={data ? `${actifs.length} personne${actifs.length > 1 ? "s" : ""} en poste${absents ? ` · ${absents} absente${absents > 1 ? "s" : ""} aujourd'hui` : ""}` : ""} />
      <div className="tabs" role="tablist" style={{ marginBottom: 18 }}>
        {tabs.map(([k, l, I]) => <button key={k} role="tab" className={onglet === k ? "on" : ""} onClick={() => setP(k === "equipe" ? {} : { vue: k }, { replace: true })}><I size={16} />{l}</button>)}
      </div>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : (
        onglet === "absences" ? <Absences personnel={data} /> : onglet === "salaires" && s.peut("finances.lire") ? <Salaires /> : <Equipe personnel={data} />
      )}
    </>
  );
}

function Equipe({ personnel }) {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ q: "", service: sp.get("service") || "", tous: false });
  const [edit, setEdit] = useState(null);
  const [abs, setAbs] = useState(null);
  const [del, setDel] = useState(null);
  const peut = s.peut("enseignants.ecrire");
  const q = f.q.trim().toLowerCase();
  const rows = personnel.filter((x) => (f.tous || x.statut === "actif") && (!f.service || (x.service || "autre") === f.service)
    && (!q || `${x.prenom} ${x.nom} ${x.poste || ""} ${x.telephone || ""}`.toLowerCase().includes(q)));
  const compte = useMemo(() => Object.fromEntries(Object.keys(SERVICES).map((k) => [k, personnel.filter((x) => x.statut === "actif" && (x.service || "autre") === k).length])), [personnel]);
  const supprimer = async () => {
    try { await api.del(`/enseignants/${del.id}`); toast("Fiche supprimée"); ["personnel", "enseignants"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); } catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  return (
    <>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="toolbar">
          <div className="with-icon" style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} /><Input value={f.q} onChange={(x) => setF({ ...f, q: x.target.value })} placeholder="Nom, poste, téléphone" style={{ paddingLeft: 36 }} /></div>
          <label className="check small"><input type="checkbox" checked={f.tous} onChange={(x) => setF({ ...f, tous: x.target.checked })} />Afficher aussi les anciens</label>
          <span className="spacer" />
          <button className="btn" onClick={() => nav(`/personnel/imprimer?doc=liste${f.service ? `&service=${f.service}` : ""}`)}><Printer size={16} />Liste du personnel</button>
          {peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Ajouter</button>}
        </div>
        <div className="perso-filtres">
          <button className={!f.service ? "on" : ""} onClick={() => setF({ ...f, service: "" })}>Tous <b>{personnel.filter((x) => x.statut === "actif").length}</b></button>
          {Object.entries(SERVICES).filter(([k]) => compte[k] || f.service === k).map(([k, x]) => <button key={k} className={f.service === k ? "on" : ""} onClick={() => setF({ ...f, service: k })}>{x.ic} {x.nom} <b>{compte[k]}</b></button>)}
        </div>
      </div>
      {!personnel.length ? (
        <div className="card"><Empty icon={Users} title="Aucun membre du personnel" action={peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Ajouter le premier</button>}>
          Enregistrez toute l'équipe : direction, secrétariat, enseignants, infirmière, cantine, nounous, entretien, gardien, chauffeur…
        </Empty></div>
      ) : Object.entries(SERVICES).map(([k, x]) => {
        const l = rows.filter((r) => (r.service || "autre") === k);
        if (!l.length) return null;
        return (
          <section key={k} className="perso-groupe">
            <h2><span>{x.ic}</span>{x.nom}<small>{l.length}</small>{peut && <button className="btn sm ghost" onClick={() => setEdit({ nouveau: k })}><Plus size={14} />Ajouter</button>}</h2>
            <div className="class-grid">{l.map((e) => (
              <div key={e.id} className="card class-card perso-carte" style={e.statut !== "actif" ? { opacity: 0.6 } : undefined}>
                {peut && <div className="tools">
                  <button className="btn sm ghost icon" onClick={() => setAbs({ personneId: e.id })} aria-label="Noter une absence" title="Noter une absence"><UserX size={15} /></button>
                  <button className="btn sm ghost icon" onClick={() => setEdit(e)} aria-label="Modifier"><Pencil size={15} /></button>
                  <button className="btn sm ghost icon" onClick={() => setDel(e)} aria-label="Supprimer"><Trash2 size={15} /></button>
                </div>}
                <div className="head">
                  <span className={`avatar ${e.sexe || ""}`} style={{ width: 52, height: 52, borderRadius: 16, fontSize: 17 }}>{initiales(e.prenom, e.nom)}</span>
                  <div className="t"><strong>{e.prenom} {e.nom}</strong><span>{e.poste || (k === "enseignant" ? e.specialite || "Enseignant" : x.poste.split(",")[0])}{e.statut !== "actif" ? " · parti" : ""}</span></div>
                </div>
                <div className="perso-badges">
                  {e.absent_aujourdhui && <span className="badge coral">Absent(e) aujourd'hui</span>}
                  {e.contrat && <span className="badge">{CONTRATS[e.contrat] || e.contrat}</span>}
                  {Number(e.absences_mois) > 0 && <span className="badge gold">{e.absences_mois} absence{e.absences_mois > 1 ? "s" : ""} ce mois</span>}
                  {Number(e.retards_mois) > 0 && <span className="badge gold">{e.retards_mois} retard{e.retards_mois > 1 ? "s" : ""}</span>}
                  {e.compte && <span className="badge teal">Accès au logiciel</span>}
                </div>
                {(e.classes_titulaire || e.matieres) && <div className="stack" style={{ gap: 6, fontSize: 13 }}>
                  {e.classes_titulaire && <span className="row" style={{ gap: 8 }}><School size={15} className="muted" />Titulaire : <strong>{e.classes_titulaire}</strong></span>}
                  {e.matieres && <span className="row" style={{ gap: 8, alignItems: "flex-start" }}><BookOpen size={15} className="muted" style={{ marginTop: 2 }} /><span>{e.matieres}</span></span>}
                </div>}
                <dl className="tarifs">
                  {e.telephone && <><dt>Téléphone</dt><dd><a href={`tel:${e.telephone.replace(/\s/g, "")}`}><Phone size={12} /> {e.telephone}</a></dd></>}
                  {e.horaires && <><dt>Horaires</dt><dd>{e.horaires}</dd></>}
                  {e.date_embauche && <><dt>Depuis</dt><dd>{date(e.date_embauche)}</dd></>}
                  {e.contact_urgence && <><dt>À prévenir</dt><dd>{e.contact_urgence}</dd></>}
                  {s.peut("finances.lire") && e.salaire ? <><dt>Salaire</dt><dd>{fcfa(e.salaire)}</dd></> : null}
                </dl>
              </div>
            ))}</div>
          </section>
        );
      })}
      {rows.length === 0 && personnel.length > 0 && <p className="muted">Personne ne correspond à la recherche.</p>}
      {edit && <PersonnelForm p={edit === "new" || edit.nouveau ? null : edit} serviceDefaut={edit.nouveau || f.service || undefined} onClose={() => setEdit(null)} />}
      {abs && <AbsenceForm personnel={personnel} personneId={abs.personneId} onClose={() => setAbs(null)} />}
      {del && <Confirm danger title={`Supprimer ${del.prenom} ${del.nom} ?`} confirmLabel="Supprimer" message="Sa fiche, ses absences et ses salaires seront effacés, et un enseignant sera retiré de ses classes, matières et créneaux. Pour garder l'historique, passez-le plutôt en « Parti / inactif »." onConfirm={supprimer} onClose={() => setDel(null)} />}
    </>
  );
}

function Absences({ personnel }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [mois, setMois] = useState(moisCourant());
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const du = `${mois}-01`, fin = new Date(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0), au = `${mois}-${String(fin.getDate()).padStart(2, "0")}`;
  const { data, isLoading, error } = useQuery({ queryKey: ["personnel-absences", mois], queryFn: () => api.get("/personnel/absences", { du, au }) });
  const peut = s.peut("enseignants.ecrire");
  const supprimer = async () => { try { await api.del(`/personnel/absences/${del.id}`); toast("Supprimé"); ["personnel-absences", "personnel", "salaires"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); } catch (e) { toast(e.message, "error"); } setDel(null); };
  const parPersonne = useMemo(() => {
    const m = {};
    (data || []).forEach((a) => { const k = a.personnel_id; (m[k] ||= { nom: `${a.prenom} ${a.nom}`, service: a.service, jours: 0, retards: 0, nj: 0 }); if (a.type === "retard") m[k].retards++; else { m[k].jours += Number(a.jours); if (!a.justifiee) m[k].nj += Number(a.jours); } });
    return Object.values(m).sort((a, b) => b.jours - a.jours);
  }, [data]);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        <Input type="month" value={mois} onChange={(e) => e.target.value && setMois(e.target.value)} style={{ width: 180 }} />
        <span style={{ flex: 1 }} />
        {peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Noter une absence / un congé</button>}
      </div>
      {parPersonne.length > 0 && <div className="perso-resume">{parPersonne.map((x) => (
        <div key={x.nom} className="card"><strong>{x.nom}</strong><span className="xs muted">{SERVICES[x.service]?.nom}</span>
          <div className="small">{x.jours} jour{x.jours > 1 ? "s" : ""} d'absence{x.nj ? <> · <b style={{ color: "var(--coral)" }}>{x.nj} non justifié{x.nj > 1 ? "s" : ""}</b></> : ""}{x.retards ? ` · ${x.retards} retard${x.retards > 1 ? "s" : ""}` : ""}</div></div>
      ))}</div>}
      <div className="card">
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.length ? (
          <Empty icon={CalendarX2} title={`Rien en ${moisLib(mois)}`}>Aucune absence, aucun retard ni congé noté pour ce mois.</Empty>
        ) : <div className="table-wrap"><table className="table">
          <thead><tr><th>Date</th><th>Personne</th><th>Type</th><th className="r">Jours</th><th className="hide-m">Motif</th><th>Justifiée</th>{peut && <th />}</tr></thead>
          <tbody>{data.map((a) => (
            <tr key={a.id}>
              <td className="num">{date(a.date_debut)}{a.date_fin && a.date_fin.slice(0, 10) !== a.date_debut.slice(0, 10) ? ` → ${date(a.date_fin)}` : ""}</td>
              <td><strong>{a.prenom} {a.nom}</strong><div className="xs muted">{a.poste || SERVICES[a.service]?.nom}</div></td>
              <td><span className={`badge ${COULEUR_ABS[a.type]}`}>{TYPES_ABS[a.type]}</span></td>
              <td className="r">{a.type === "retard" ? "—" : a.jours}</td>
              <td className="hide-m">{a.motif || "—"}</td>
              <td>{a.justifiee ? <span className="badge green">Oui</span> : <span className="badge">Non</span>}</td>
              {peut && <td className="r" style={{ whiteSpace: "nowrap" }}><button className="btn sm ghost icon" onClick={() => setEdit(a)} aria-label="Modifier"><Pencil size={15} /></button><button className="btn sm ghost icon" onClick={() => setDel(a)} aria-label="Supprimer"><Trash2 size={15} /></button></td>}
            </tr>
          ))}</tbody>
        </table></div>}
      </div>
      {edit && <AbsenceForm a={edit === "new" ? null : edit} personnel={personnel} onClose={() => setEdit(null)} />}
      {del && <Confirm danger title="Supprimer ?" confirmLabel="Supprimer" message={`${TYPES_ABS[del.type]} de ${del.prenom} ${del.nom} du ${date(del.date_debut)}`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </div>
  );
}

function Salaires() {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [mois, setMois] = useState(moisCourant());
  const [edit, setEdit] = useState(null);
  const [payer, setPayer] = useState(null);
  const [annuler, setAnnuler] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["salaires", mois], queryFn: () => api.get("/salaires", { mois }) });
  const peut = s.peut("depenses.ecrire");
  const maj = () => ["salaires", "depenses", "caisse", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const preparer = async () => { try { const r = await api.post("/salaires/preparer", { mois }); toast(Number(r.n) ? `${r.n} salaire${r.n > 1 ? "s" : ""} préparé${r.n > 1 ? "s" : ""}` : "Tout est déjà préparé (ajoutez les salaires mensuels sur les fiches manquantes)"); maj(); } catch (e) { toast(e.message, "error"); } };
  const prets = (data || []).filter((r) => r.id);
  const tot = prets.reduce((t, r) => ({ net: t.net + Number(r.net), paye: t.paye + (r.paye_le ? Number(r.net) : 0) }), { net: 0, paye: 0 });
  const manquants = (data || []).filter((r) => !r.id && r.statut === "actif");
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        <Input type="month" value={mois} onChange={(e) => e.target.value && setMois(e.target.value)} style={{ width: 180 }} />
        <span style={{ flex: 1 }} />
        {peut && <button className="btn" onClick={preparer}><Plus size={16} />Préparer les salaires de {moisLib(mois)}</button>}
        <button className="btn" onClick={() => nav(`/personnel/imprimer?doc=salaires&mois=${mois}`)}><Printer size={16} />État des salaires</button>
        {prets.length > 0 && <button className="btn" onClick={() => nav(`/personnel/imprimer?doc=bulletins&mois=${mois}`)}><FileText size={16} />Bulletins de paie</button>}
      </div>
      <div className="dash">
        <div className="card kpi c4"><div className="top"><span className="label">Masse salariale du mois</span><span className="ic teal"><Wallet size={20} /></span></div><div className="value" style={{ fontSize: 26 }}>{fcfa(tot.net)}</div><div className="sub">{prets.length} salaire{prets.length > 1 ? "s" : ""} préparé{prets.length > 1 ? "s" : ""}</div></div>
        <div className="card kpi c4"><div className="top"><span className="label">Déjà payé</span><span className="ic green"><CheckCircle2 size={20} /></span></div><div className="value" style={{ fontSize: 26, color: "var(--green)" }}>{fcfa(tot.paye)}</div><div className="sub">Enregistré dans les Dépenses (Salaires)</div></div>
        <div className="card kpi c4"><div className="top"><span className="label">Reste à payer</span><span className="ic coral"><Clock size={20} /></span></div><div className="value" style={{ fontSize: 26, color: "var(--coral)" }}>{fcfa(tot.net - tot.paye)}</div><div className="sub">{prets.filter((r) => !r.paye_le).length} personne{prets.filter((r) => !r.paye_le).length > 1 ? "s" : ""}</div></div>
      </div>
      <div className="card">
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.length ? <Empty icon={Wallet} title="Aucun personnel en poste" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Personne</th><th className="r">Salaire</th><th className="r hide-m">Primes</th><th className="r hide-m">Retenues</th><th className="r">Net</th><th className="hide-m">Absences</th><th>Paiement</th><th /></tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r.personnel_id}>
                <td><strong>{r.prenom} {r.nom}</strong><div className="xs muted">{r.poste || SERVICES[r.service]?.nom}</div></td>
                {r.id ? <>
                  <td className="r nw">{fcfa(r.montant)}</td>
                  <td className="r hide-m">{r.primes ? fcfa(r.primes) : "—"}</td>
                  <td className="r hide-m">{r.retenues ? fcfa(r.retenues) : "—"}</td>
                  <td className="r amount nw">{fcfa(r.net)}</td>
                  <td className="hide-m small">{Number(r.absences) ? `${r.absences} abs.` : ""}{Number(r.retards) ? ` ${r.retards} ret.` : ""}{!Number(r.absences) && !Number(r.retards) ? <span className="muted">—</span> : ""}</td>
                  <td>{r.paye_le ? <span className="badge green">Payé le {date(r.paye_le)}</span> : <span className="badge gold">À payer</span>}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    {peut && !r.paye_le && <button className="btn sm primary" onClick={() => setPayer(r)}><CheckCircle2 size={14} />Payer</button>}
                    {peut && !r.paye_le && <button className="btn sm ghost icon" onClick={() => setEdit(r)} aria-label="Modifier"><Pencil size={15} /></button>}
                    {peut && r.paye_le && <button className="btn sm ghost icon" onClick={() => setAnnuler(r)} aria-label="Annuler le paiement" title="Annuler le paiement"><Undo2 size={15} /></button>}
                    <button className="btn sm ghost icon" onClick={() => nav(`/personnel/imprimer?doc=bulletins&mois=${mois}&id=${r.personnel_id}`)} aria-label="Bulletin de paie"><FileText size={15} /></button>
                  </td>
                </> : <>
                  <td className="r muted nw">{r.salaire_base ? fcfa(r.salaire_base) : "—"}</td><td className="hide-m" /><td className="hide-m" /><td /><td className="hide-m" />
                  <td><span className="xs muted">Pas préparé</span></td>
                  <td className="r">{peut && <button className="btn sm" onClick={() => setEdit({ ...r, nouveau: true, montant: r.salaire_base || null, primes: 0, retenues: 0 })}><Plus size={14} />Ajouter</button>}</td>
                </>}
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {manquants.length > 0 && <p className="xs muted">Astuce : indiquez le salaire mensuel sur la fiche de chacun (onglet L'équipe) ; « Préparer les salaires » crée ensuite toutes les lignes du mois en un clic.</p>}
      {edit && <SalaireModal r={edit} mois={mois} onClose={() => setEdit(null)} onDone={maj} />}
      {payer && <PayerModal r={payer} mois={mois} onClose={() => setPayer(null)} onDone={maj} />}
      {annuler && <Confirm danger title={`Annuler le paiement de ${annuler.prenom} ${annuler.nom} ?`} confirmLabel="Annuler le paiement" message={`La dépense de ${fcfa(annuler.net)} sera retirée et le salaire repassera « À payer ». La Direction en sera prévenue.`} onConfirm={async () => { try { await api.post(`/salaires/${annuler.id}/annuler`, {}); toast("Paiement annulé"); maj(); } catch (e) { toast(e.message, "error"); } setAnnuler(null); }} onClose={() => setAnnuler(null)} />}
    </div>
  );
}

function SalaireModal({ r, mois, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ montant: r.montant, primes: r.primes || 0, retenues: r.retenues || 0, note: r.note || "" });
  const [error, setError] = useState(null);
  const net = (Number(v.montant) || 0) + (Number(v.primes) || 0) - (Number(v.retenues) || 0);
  const save = async () => {
    setError(null);
    try {
      if (r.nouveau) await api.post("/salaires", { personnel_id: r.personnel_id, mois, ...v }); else await api.put(`/salaires/${r.id}`, v);
      toast("Salaire enregistré"); onDone(); onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal icon={<MIco I={Wallet} />} title={`${r.prenom} ${r.nom} — ${moisLib(mois)}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={save} disabled={!v.montant}>Enregistrer</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <div className="grid g3">
          <Field label="Salaire"><Money value={v.montant} onChange={(x) => setV({ ...v, montant: x })} /></Field>
          <Field label="Primes" hint="Heures en plus, encouragement…"><Money value={v.primes} onChange={(x) => setV({ ...v, primes: x })} /></Field>
          <Field label="Retenues" hint="Avances, absences…"><Money value={v.retenues} onChange={(x) => setV({ ...v, retenues: x })} /></Field>
        </div>
        <Field label="Remarque"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Ex. avance de 10 000 F le 12" /></Field>
        <p className="small">Net à payer : <strong style={{ fontSize: 18 }}>{fcfa(net)}</strong></p>
      </div>
    </Modal>
  );
}

function PayerModal({ r, mois, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ date: today(), mode: "especes" });
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await api.post(`/salaires/${r.id}/payer`, v); toast(`Salaire de ${r.prenom} payé — ${fcfa(r.net)} ajoutés aux dépenses`); onDone(); onClose(); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal icon={<MIco I={CheckCircle2} />} title={`Payer ${r.prenom} ${r.nom}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={go} disabled={busy}>Confirmer le paiement</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <p>Salaire de <strong>{moisLib(mois)}</strong> : <strong style={{ fontSize: 20 }}>{fcfa(r.net)}</strong></p>
        <div className="grid g2">
          <Field label="Date du paiement"><Input type="date" value={v.date} max={today()} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          <Field label="Mode"><Select value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value })}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        </div>
        <p className="xs muted">Le paiement est enregistré automatiquement dans les Dépenses, catégorie « Salaires ».</p>
      </div>
    </Modal>
  );
}

// ── Impressions : liste du personnel, état des salaires, bulletins de paie ──
export function PersonnelImpression() {
  const s = useSession();
  const nav = useNavigate();
  const [p] = useSearchParams();
  const doc = p.get("doc") || "liste", mois = p.get("mois") || moisCourant(), seul = Number(p.get("id")) || null, serv = p.get("service") || "";
  const etab = s.etablissement || {};
  const pers = useQuery({ queryKey: ["personnel", s.annee?.id], queryFn: () => api.get("/personnel", { annee_id: s.annee?.id }), enabled: doc === "liste" });
  const sal = useQuery({ queryKey: ["salaires", mois], queryFn: () => api.get("/salaires", { mois }), enabled: doc !== "liste" });
  const q = doc === "liste" ? pers : sal;
  if (q.isLoading) return <Spinner />;
  if (q.error) return <div style={{ padding: 32 }}><ErrorBox error={q.error} /></div>;
  let contenu, titre, format = "A4";
  if (doc === "liste") {
    titre = "Liste du personnel";
    const l = q.data.filter((x) => x.statut === "actif" && (!serv || (x.service || "autre") === serv));
    contenu = (
      <article className="doc a4 etat">
        <EnTete etab={etab} />
        <h1 className="d-title">Liste du personnel</h1>
        <p className="d-num">Année scolaire {s.annee?.libelle} · {l.length} personnes · édité le {date(today())}</p>
        {Object.entries(SERVICES).map(([k, x]) => { const g = l.filter((r) => (r.service || "autre") === k); return g.length ? (
          <div key={k} className="etat-classe"><h3>{x.nom}<span>{g.length}</span></h3>
            <table className="b-table d-list"><thead><tr><th>N°</th><th>Prénom et nom</th><th>Poste</th><th>Téléphone</th><th>Contrat</th><th>Depuis</th></tr></thead>
              <tbody>{g.map((r, i) => <tr key={r.id}><td>{i + 1}</td><td><strong>{r.prenom} {r.nom}</strong></td><td>{r.poste || r.classes_titulaire || ""}</td><td className="nw">{r.telephone || ""}</td><td className="nw">{CONTRATS[r.contrat] || ""}</td><td className="nw">{r.date_embauche ? date(r.date_embauche) : ""}</td></tr>)}</tbody></table>
          </div>) : null; })}
        <div className="d-sign"><p>Fait à {etab.ville || "Malika"}, le {date(today())}</p><p className="d-sign-t">La Direction</p></div>
      </article>
    );
  } else if (doc === "salaires") {
    titre = `État des salaires — ${moisLib(mois)}`;
    const l = q.data.filter((r) => r.id);
    const t = l.reduce((a, r) => ({ m: a.m + r.montant, p: a.p + r.primes, r: a.r + r.retenues, n: a.n + Number(r.net) }), { m: 0, p: 0, r: 0, n: 0 });
    contenu = (
      <article className="doc a4 etat">
        <EnTete etab={etab} />
        <h1 className="d-title">État des salaires</h1>
        <p className="d-num">Mois de {moisLib(mois)} · {l.length} salariés</p>
        <table className="b-table d-list">
          <thead><tr><th>N°</th><th>Prénom et nom</th><th>Poste</th><th>Salaire</th><th>Primes</th><th>Retenues</th><th>Net</th><th>Payé le</th><th style={{ width: "16%" }}>Émargement</th></tr></thead>
          <tbody>{l.map((r, i) => <tr key={r.id}><td>{i + 1}</td><td><strong>{r.prenom} {r.nom}</strong></td><td>{r.poste || SERVICES[r.service]?.nom}</td><td className="nw">{fcfa(r.montant)}</td><td className="nw">{r.primes ? fcfa(r.primes) : ""}</td><td className="nw">{r.retenues ? fcfa(r.retenues) : ""}</td><td className="nw"><strong>{fcfa(r.net)}</strong></td><td className="nw">{r.paye_le ? date(r.paye_le) : ""}</td><td /></tr>)}</tbody>
          <tfoot><tr><td colSpan={3}><strong>Total</strong></td><td className="nw"><strong>{fcfa(t.m)}</strong></td><td className="nw">{fcfa(t.p)}</td><td className="nw">{fcfa(t.r)}</td><td className="nw"><strong>{fcfa(t.n)}</strong></td><td colSpan={2} /></tr></tfoot>
        </table>
        <div className="ev-signes"><div>Le comptable</div><div>La Direction</div></div>
      </article>
    );
  } else {
    titre = `Bulletins de paie — ${moisLib(mois)}`; format = "A5";
    const l = q.data.filter((r) => r.id && (!seul || r.personnel_id === seul));
    contenu = l.map((r) => (
      <article key={r.id} className="ticket bulletin-paie">
        <header className="t-head"><img src="/logo.png" alt="" /><div className="t-school"><strong>{etab.nom}</strong><span>{etab.adresse}</span><span>Tél. {etab.telephones}</span></div></header>
        <div className="t-title"><div><h1>Bulletin de paie</h1><span className="t-copy">Mois de {moisLib(mois)}</span></div></div>
        <dl className="t-info"><div><dt>Nom</dt><dd>{r.prenom} {r.nom}</dd></div><div><dt>Poste</dt><dd>{r.poste || SERVICES[r.service]?.nom}</dd></div>{r.contrat && <div><dt>Contrat</dt><dd>{CONTRATS[r.contrat]}</dd></div>}{r.telephone && <div><dt>Téléphone</dt><dd>{r.telephone}</dd></div>}</dl>
        <table className="t-lines">
          <thead><tr><th>Désignation</th><th>Montant</th></tr></thead>
          <tbody>
            <tr><td>Salaire de base</td><td>{fcfa(r.montant)}</td></tr>
            {r.primes > 0 && <tr><td>Primes</td><td>+ {fcfa(r.primes)}</td></tr>}
            {r.retenues > 0 && <tr><td>Retenues{r.note ? ` (${r.note})` : ""}</td><td>− {fcfa(r.retenues)}</td></tr>}
          </tbody>
          <tfoot><tr><td>Net à payer</td><td>{fcfa(r.net)}</td></tr></tfoot>
        </table>
        <p className="bp-meta">{r.paye_le ? <>Payé le <strong>{date(r.paye_le)}</strong>{r.mode ? ` · ${MODES[r.mode]}` : ""}</> : "Non encore payé"}{Number(r.absences) || Number(r.retards) ? ` · Ce mois : ${r.absences} absence(s), ${r.retards} retard(s)` : ""}</p>
        <div className="t-foot"><div className="t-sign"><span>Signature du salarié</span></div><div className="t-sign"><span>La Direction</span></div></div>
      </article>
    ));
  }
  return (
    <div className="print-page">
      <style>{`@page { size: ${format} portrait; margin: 0; }`}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(-1)}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{titre}</strong></span>
        <Partager format={format} nom={titre} message={titre} />
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      <div className="tickets">{contenu}</div>
    </div>
  );
}
