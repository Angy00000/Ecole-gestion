import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  Shield, Clock, Gavel, DoorOpen, UserCheck, CalendarCheck, Printer, MessageCircle, Plus, Pencil, Trash2, Check, X, AlertTriangle,
  Users, CalendarDays, ArrowLeft, Undo2, UserX,
} from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, dateLongue, today, initiales, telWa } from "../lib/format";
import { Modal, Field, Input, Select, Textarea, Spinner, ErrorBox, Empty, Confirm, PageHead, useToast, Periode, periodes } from "../components/ui";
import { ChoixEleve } from "./Infirmerie";
import Partager from "../components/Partager";

const heure = () => new Date().toTimeString().slice(0, 5);
const INV = ["vie-jour", "discipline", "sorties", "pointage", "absences", "appel", "eleve"];
export const TYPES_DISC = {
  observation: { l: "Observation", b: "teal" }, avertissement: { l: "Avertissement", b: "gold" }, blame: { l: "Blâme", b: "coral" },
  retenue: { l: "Retenue / travail", b: "gold" }, exclusion_temporaire: { l: "Exclusion temporaire", b: "coral" },
  exclusion_definitive: { l: "Exclusion définitive", b: "coral" }, felicitation: { l: "Félicitations / encouragement", b: "green" },
};
const MOTIFS_DISC = ["Bavardage / perturbation", "Retards répétés", "Absence non justifiée", "Insolence", "Bagarre / violence", "Tricherie", "Dégradation de matériel",
  "Tenue non conforme", "Téléphone en classe", "Travail non fait", "Bon comportement"];
const MOTIFS_SORTIE = ["Rendez-vous médical", "Malade", "Raison familiale", "Décès / cérémonie", "Convocation administrative", "Autre"];
const DiscBadge = ({ type }) => <span className={`badge ${TYPES_DISC[type]?.b || ""}`}>{TYPES_DISC[type]?.l || type}</span>;
const wa = (tel, msg) => `https://wa.me/${telWa(tel)}?text=${encodeURIComponent(msg)}`;
const EleveCell = ({ r }) => (
  <><Link to={`/eleves/${r.eleve_id}`}><strong>{r.nom} {r.prenom}</strong></Link><div className="xs muted">{r.classe || r.matricule}</div></>
);
function EleveChoisi({ eleve, onChange }) {
  return (
    <div className="pick" style={{ cursor: "default" }}>
      <span className={`avatar ${eleve.sexe || ""}`}>{initiales(eleve.prenom, eleve.nom)}</span>
      <div className="grow"><strong>{eleve.nom} {eleve.prenom}</strong><span>{eleve.classe || eleve.matricule}</span></div>
      {onChange && <button className="btn sm ghost" onClick={onChange}>Changer</button>}
    </div>
  );
}

// ── Retard au portail ──
export function RetardForm({ eleve: eleveInit, onClose }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [eleve, setEleve] = useState(eleveInit || null);
  const [v, setV] = useState({ heure: heure(), motif: "", justifiee: false });
  const [fait, setFait] = useState(null);
  const [error, setError] = useState(null);
  const save = async () => {
    setError(null);
    try {
      const r = await api.post("/vie-scolaire/retards", { eleve_id: eleve.id, ...v });
      setFait(r); toast(`Retard de ${eleve.prenom} enregistré`);
      INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) { setError(e); }
  };
  if (fait) {
    const msg = `Bonjour, ${s.etablissement?.nom} vous informe que ${fait.prenom} ${fait.nom} (${fait.classe}) est arrivé(e) en retard aujourd'hui à ${fait.heure.replace(":", "h")}.${fait.retards_annee > 1 ? ` C'est son ${fait.retards_annee}e retard cette année.` : ""} Merci de veiller à la ponctualité.`;
    return (
      <Modal title="Retard enregistré" icon={<Clock size={20} />} onClose={onClose} footer={<>
        <button className="btn" onClick={onClose}>Fermer</button>
        {fait.telephone && <a className="btn wa" href={wa(fait.telephone, msg)} target="_blank" rel="noreferrer"><MessageCircle size={16} />Prévenir les parents</a>}
        <button className="btn primary" onClick={() => nav(`/vie-scolaire/imprimer?doc=billet&id=${fait.id}`)}><Printer size={16} />Billet d'entrée</button>
      </>}>
        <EleveChoisi eleve={fait} />
        <p className="small" style={{ marginTop: 14 }}>Arrivé(e) à <strong>{fait.heure.replace(":", "h")}</strong>. {fait.retards_annee > 1 ? <span style={{ color: fait.retards_annee >= 3 ? "var(--coral)" : undefined }}><strong>{fait.retards_annee}e retard</strong> de l'année.</span> : "Premier retard de l'année."}</p>
      </Modal>
    );
  }
  return (
    <Modal title="Retard au portail" icon={<Clock size={20} />} onClose={onClose} footer={eleve && <>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save}>Enregistrer</button>
    </>}>
      {!eleve ? <ChoixEleve onPick={setEleve} /> : (
        <div className="stack" style={{ gap: 14 }}>
          <ErrorBox error={error} />
          <EleveChoisi eleve={eleve} onChange={eleveInit ? null : () => setEleve(null)} />
          <div className="grid g2">
            <Field label="Heure d'arrivée"><Input type="time" value={v.heure} onChange={(e) => setV({ ...v, heure: e.target.value })} /></Field>
            <Field label="Justifié ?"><Select value={v.justifiee ? "1" : ""} onChange={(e) => setV({ ...v, justifiee: !!e.target.value })}><option value="">Non</option><option value="1">Oui</option></Select></Field>
          </div>
          <Field label="Raison donnée"><Input value={v.motif} onChange={(e) => setV({ ...v, motif: e.target.value })} placeholder="Embouteillage, réveil tardif…" autoFocus /></Field>
          <p className="xs muted">Le retard apparaît dans l'appel de la classe et sur la fiche de l'élève.</p>
        </div>
      )}
    </Modal>
  );
}

// ── Discipline ──
export function DisciplineForm({ fiche, eleve: eleveInit, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [eleve, setEleve] = useState(fiche ? { id: fiche.eleve_id, nom: fiche.nom, prenom: fiche.prenom, classe: fiche.classe } : eleveInit || null);
  const [v, setV] = useState(() => fiche
    ? { ...fiche, date_fait: fiche.date_fait?.slice(0, 10), date_debut: fiche.date_debut?.slice(0, 10) || "", date_fin: fiche.date_fin?.slice(0, 10) || "", convocation_date: fiche.convocation_date?.slice(0, 10) || "" }
    : { date_fait: today(), heure: heure(), categorie: "", type: "observation", description: "", sanction: "", date_debut: "", date_fin: "", signale_par: "", convocation: false, convocation_date: "", convocation_heure: "", convocation_statut: "prevue", parents_prevenus: false });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setError(null);
    try {
      const d = { date_fait: v.date_fait, heure: v.heure, categorie: v.categorie, type: v.type, description: v.description, sanction: v.sanction,
        date_debut: v.type === "exclusion_temporaire" ? v.date_debut || null : null, date_fin: v.type === "exclusion_temporaire" ? v.date_fin || null : null,
        signale_par: v.signale_par, convocation: !!v.convocation, convocation_date: v.convocation ? v.convocation_date || null : null,
        convocation_heure: v.convocation ? v.convocation_heure || null : null, convocation_statut: v.convocation ? v.convocation_statut || "prevue" : null, parents_prevenus: !!v.parents_prevenus };
      if (fiche) await api.put(`/discipline/${fiche.id}`, d); else await api.post("/discipline", { ...d, eleve_id: eleve.id });
      toast(fiche ? "Fiche modifiée" : "Fiche de discipline enregistrée");
      INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal title={fiche ? "Modifier la fiche" : "Discipline"} icon={<Gavel size={20} />} onClose={onClose} footer={eleve && <>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.categorie?.trim()}>Enregistrer</button>
    </>}>
      {!eleve ? <ChoixEleve onPick={setEleve} /> : (
        <div className="stack" style={{ gap: 14 }}>
          <ErrorBox error={error} />
          <EleveChoisi eleve={eleve} onChange={fiche || eleveInit ? null : () => setEleve(null)} />
          <div className="grid g2">
            <Field label="Date"><Input type="date" value={v.date_fait} max={today()} onChange={set("date_fait")} /></Field>
            <Field label="Mesure"><Select value={v.type} onChange={set("type")}>{Object.entries(TYPES_DISC).map(([k, t]) => <option key={k} value={k}>{t.l}</option>)}</Select></Field>
          </div>
          <Field label="Motif" required>
            <Input value={v.categorie} onChange={set("categorie")} list="motifs-disc" placeholder="Bavardage, bagarre, retards répétés…" autoFocus />
            <datalist id="motifs-disc">{MOTIFS_DISC.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label="Ce qui s'est passé"><Textarea rows={2} value={v.description || ""} onChange={set("description")} /></Field>
          <div className="grid g2">
            <Field label="Signalé par"><Input value={v.signale_par || ""} onChange={set("signale_par")} placeholder="Enseignant, surveillant…" /></Field>
            <Field label="Sanction / suite"><Input value={v.sanction || ""} onChange={set("sanction")} placeholder="Copie à faire, travail d'intérêt…" /></Field>
          </div>
          {v.type === "exclusion_temporaire" && <div className="grid g2">
            <Field label="Exclu(e) du" required><Input type="date" value={v.date_debut} onChange={set("date_debut")} /></Field>
            <Field label="Au"><Input type="date" value={v.date_fin} min={v.date_debut} onChange={set("date_fin")} /></Field>
          </div>}
          <label className="switch-card"><input type="checkbox" checked={!!v.convocation} onChange={(e) => setV({ ...v, convocation: e.target.checked })} /><strong>Convoquer les parents</strong></label>
          {v.convocation && <div className="grid g2">
            <Field label="Le"><Input type="date" value={v.convocation_date} onChange={set("convocation_date")} /></Field>
            <Field label="À"><Input type="time" value={v.convocation_heure || ""} onChange={set("convocation_heure")} /></Field>
            {fiche && <Field label="Les parents sont-ils venus ?"><Select value={v.convocation_statut || "prevue"} onChange={set("convocation_statut")}><option value="prevue">Pas encore</option><option value="venue">Oui, venus</option><option value="absente">Non, absents</option></Select></Field>}
          </div>}
          <label className="check small"><input type="checkbox" checked={!!v.parents_prevenus} onChange={(e) => setV({ ...v, parents_prevenus: e.target.checked })} />Parents prévenus</label>
        </div>
      )}
    </Modal>
  );
}
const messageDiscipline = (etab, d) => d.convocation
  ? `Bonjour, ${etab?.nom} vous convoque${d.convocation_date ? ` le ${dateLongue(d.convocation_date)}${d.convocation_heure ? ` à ${d.convocation_heure.replace(":", "h")}` : ""}` : ""} au sujet de ${d.prenom} ${d.nom} (${d.classe}) : ${d.categorie}. Merci de vous présenter au bureau du surveillant général.`
  : `Bonjour, ${etab?.nom} vous informe que ${d.prenom} ${d.nom} (${d.classe}) a reçu ${TYPES_DISC[d.type]?.l.toLowerCase()} le ${date(d.date_fait)} : ${d.categorie}.${d.sanction ? ` Suite : ${d.sanction}.` : ""}`;

function Discipline() {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const peut = s.peut("surveillance.ecrire");
  const [du, setDu] = useState(() => periodes(s.annee).annee.du);
  const [au, setAu] = useState(() => periodes(s.annee).annee.au);
  const [type, setType] = useState("");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const f = { du, au, type };
  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["discipline", f], queryFn: () => api.get("/discipline", f), placeholderData: keepPreviousData });
  const supprimer = async () => {
    try { await api.del(`/discipline/${del.id}`); toast("Fiche supprimée"); INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); } catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  return (
    <div className="stack" style={{ gap: 18 }}>
      {data?.par_eleve?.length > 0 && (
        <div className="card"><div className="card-head"><h3>Élèves à suivre</h3><span className="badge coral">2 fiches ou plus</span></div>
          <div className="card-body" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {data.par_eleve.map((e) => <Link key={e.eleve_id} to={`/eleves/${e.eleve_id}`} className="badge" style={{ padding: "6px 10px" }}>{e.nom} {e.prenom} · {e.classe} · <strong style={{ marginLeft: 4 }}>{e.n}</strong>{e.graves ? <span style={{ color: "var(--coral)", marginLeft: 4 }}>({e.graves} grave{e.graves > 1 ? "s" : ""})</span> : null}</Link>)}
          </div></div>
      )}
      <div className="card">
        <div className="toolbar">
          <Periode annee={s.annee} du={du} au={au} onChange={(d, x) => { setDu(d); setAu(x); }} />
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Mesure"><option value="">Toutes les mesures</option>{Object.entries(TYPES_DISC).map(([k, t]) => <option key={k} value={k}>{t.l}</option>)}</Select>
          {peut && <button className="btn primary" style={{ marginLeft: "auto" }} onClick={() => setEdit("new")}><Plus size={17} />Nouvelle fiche</button>}
        </div>
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.rows.length ? (
          <Empty icon={Gavel} title="Aucune fiche de discipline">Rien d'enregistré sur cette période.</Empty>
        ) : (
          <div className="table-wrap" style={{ opacity: isFetching ? 0.65 : 1 }}><table className="table">
            <thead><tr><th>Date</th><th>Élève</th><th>Motif</th><th>Mesure</th><th className="hide-m">Parents</th><th /></tr></thead>
            <tbody>{data.rows.map((d) => (
              <tr key={d.id}>
                <td className="num">{date(d.date_fait)}</td>
                <td><EleveCell r={d} /></td>
                <td><strong>{d.categorie}</strong>{d.description && <div className="xs muted">{d.description}</div>}{d.sanction && <div className="xs muted">Suite : {d.sanction}</div>}</td>
                <td><DiscBadge type={d.type} />{d.type === "exclusion_temporaire" && d.date_debut && <div className="xs muted">du {date(d.date_debut)}{d.date_fin ? ` au ${date(d.date_fin)}` : ""}</div>}</td>
                <td className="hide-m">{d.convocation ? <><span className={`badge ${d.convocation_statut === "venue" ? "green" : d.convocation_statut === "absente" ? "coral" : "gold"}`}>{d.convocation_statut === "venue" ? "Venus" : d.convocation_statut === "absente" ? "Absents" : "Convoqués"}</span>{d.convocation_date && <div className="xs muted">{date(d.convocation_date)}{d.convocation_heure ? ` · ${d.convocation_heure}` : ""}</div>}</> : d.parents_prevenus ? <span className="badge green">Prévenus</span> : <span className="muted">—</span>}</td>
                <td className="r" style={{ whiteSpace: "nowrap" }}>
                  {d.telephone && <a className="btn sm wa" href={wa(d.telephone, messageDiscipline(s.etablissement, d))} target="_blank" rel="noreferrer"><MessageCircle size={15} /><span className="hide-m">Parents</span></a>}
                  {d.convocation && <button className="btn sm ghost icon" title="Lettre de convocation" aria-label="Lettre de convocation" onClick={() => nav(`/vie-scolaire/imprimer?doc=convocation&id=${d.id}`)}><Printer size={15} /></button>}
                  {peut && <button className="btn sm ghost icon" onClick={() => setEdit(d)} aria-label="Modifier"><Pencil size={15} /></button>}
                  {peut && <button className="btn sm ghost icon" onClick={() => setDel(d)} aria-label="Supprimer"><Trash2 size={15} /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {edit && <DisciplineForm fiche={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {del && <Confirm danger title="Supprimer cette fiche ?" confirmLabel="Supprimer" message={`${del.prenom} ${del.nom} — ${del.categorie} (${date(del.date_fait)})`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </div>
  );
}

// ── Sorties ──
export function SortieForm({ sortie, eleve: eleveInit, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [eleve, setEleve] = useState(sortie ? { id: sortie.eleve_id, nom: sortie.nom, prenom: sortie.prenom, classe: sortie.classe } : eleveInit || null);
  const [v, setV] = useState(() => sortie ? { ...sortie, date_sortie: sortie.date_sortie?.slice(0, 10) } : { date_sortie: today(), heure_sortie: heure(), motif: "", accompagnant: "", lien: "", piece: "", autorise_par: "", note: "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setError(null);
    try {
      const d = { date_sortie: v.date_sortie, heure_sortie: v.heure_sortie, motif: v.motif, accompagnant: v.accompagnant, lien: v.lien, piece: v.piece, autorise_par: v.autorise_par, note: v.note };
      const r = sortie ? await api.put(`/sorties/${sortie.id}`, d) : await api.post("/sorties", { ...d, eleve_id: eleve.id });
      toast(sortie ? "Sortie modifiée" : `Sortie de ${eleve.prenom} enregistrée`);
      INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (!sortie) nav(`/vie-scolaire/imprimer?doc=sortie&id=${r.id}`); else onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal title={sortie ? "Modifier la sortie" : "Autorisation de sortie"} icon={<DoorOpen size={20} />} onClose={onClose} footer={eleve && <>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.motif?.trim()}>{sortie ? "Enregistrer" : <><Printer size={16} />Enregistrer et imprimer le bon</>}</button>
    </>}>
      {!eleve ? <ChoixEleve onPick={setEleve} /> : (
        <div className="stack" style={{ gap: 14 }}>
          <ErrorBox error={error} />
          <EleveChoisi eleve={eleve} onChange={sortie || eleveInit ? null : () => setEleve(null)} />
          <div className="grid g2">
            <Field label="Date"><Input type="date" value={v.date_sortie} onChange={set("date_sortie")} /></Field>
            <Field label="Heure de sortie"><Input type="time" value={v.heure_sortie || ""} onChange={set("heure_sortie")} /></Field>
          </div>
          <Field label="Motif" required>
            <Input value={v.motif} onChange={set("motif")} list="motifs-sortie" autoFocus />
            <datalist id="motifs-sortie">{MOTIFS_SORTIE.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <div className="grid g2">
            <Field label="Personne qui vient le/la chercher"><Input value={v.accompagnant || ""} onChange={set("accompagnant")} /></Field>
            <Field label="Lien avec l'élève"><Input value={v.lien || ""} onChange={set("lien")} placeholder="Mère, oncle, chauffeur…" /></Field>
            <Field label="Pièce d'identité vue"><Input value={v.piece || ""} onChange={set("piece")} placeholder="CNI n°…" /></Field>
            <Field label="Autorisé par"><Input value={v.autorise_par || ""} onChange={set("autorise_par")} placeholder="Surveillant général, directeur…" /></Field>
          </div>
          <Field label="Remarque"><Input value={v.note || ""} onChange={set("note")} /></Field>
        </div>
      )}
    </Modal>
  );
}

function Sorties() {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const peut = s.peut("surveillance.ecrire");
  const [du, setDu] = useState(() => periodes(s.annee).mois?.du || today());
  const [au, setAu] = useState(() => periodes(s.annee).mois?.au || today());
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["sorties", du, au], queryFn: () => api.get("/sorties", { du, au }), placeholderData: keepPreviousData });
  const retour = async (x) => {
    try { await api.put(`/sorties/${x.id}`, { retour: true, heure_retour: heure() }); toast(`${x.prenom} est revenu(e)`); INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); } catch (e) { toast(e.message, "error"); }
  };
  const supprimer = async () => {
    try { await api.del(`/sorties/${del.id}`); toast("Sortie supprimée"); INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); } catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  return (
    <div className="card">
      <div className="toolbar">
        <Periode annee={s.annee} du={du} au={au} onChange={(d, x) => { setDu(d); setAu(x); }} />
        {peut && <button className="btn primary" style={{ marginLeft: "auto" }} onClick={() => setEdit("new")}><Plus size={17} />Nouvelle sortie</button>}
      </div>
      {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.length ? (
        <Empty icon={DoorOpen} title="Aucune sortie">Aucune autorisation de sortie sur cette période.</Empty>
      ) : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Date</th><th>Élève</th><th>Motif</th><th className="hide-m">Récupéré par</th><th>Retour</th><th /></tr></thead>
          <tbody>{data.map((x) => (
            <tr key={x.id}>
              <td className="num">{date(x.date_sortie)}{x.heure_sortie && <div className="xs muted">{x.heure_sortie}</div>}</td>
              <td><EleveCell r={x} /></td>
              <td><strong>{x.motif}</strong>{x.autorise_par && <div className="xs muted">Autorisé par {x.autorise_par}</div>}</td>
              <td className="hide-m">{x.accompagnant ? <>{x.accompagnant}{x.lien && <span className="muted"> ({x.lien})</span>}</> : <span className="muted">—</span>}</td>
              <td>{x.retour ? <span className="badge green">Revenu{x.heure_retour ? ` à ${x.heure_retour}` : ""}</span> : peut ? <button className="btn sm" onClick={() => retour(x)}><Undo2 size={14} />Revenu</button> : <span className="muted">—</span>}</td>
              <td className="r" style={{ whiteSpace: "nowrap" }}>
                <button className="btn sm ghost icon" title="Bon de sortie" aria-label="Bon de sortie" onClick={() => nav(`/vie-scolaire/imprimer?doc=sortie&id=${x.id}`)}><Printer size={15} /></button>
                {peut && <button className="btn sm ghost icon" onClick={() => setEdit(x)} aria-label="Modifier"><Pencil size={15} /></button>}
                {peut && <button className="btn sm ghost icon" onClick={() => setDel(x)} aria-label="Supprimer"><Trash2 size={15} /></button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {edit && <SortieForm sortie={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {del && <Confirm danger title="Supprimer cette sortie ?" confirmLabel="Supprimer" message={`${del.prenom} ${del.nom} — ${del.motif} (${date(del.date_sortie)})`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </div>
  );
}

// ── Présence du personnel ──
const STATUTS = { present: ["Présent", "green"], retard: ["Retard", "gold"], absent: ["Absent", "coral"] };
function Presence() {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const peut = s.peut("surveillance.ecrire") || s.peut("enseignants.ecrire");
  const [jour, setJour] = useState(today());
  const [vue, setVue] = useState("jour");
  const [mois, setMois] = useState(today().slice(0, 7));
  const [tous, setTous] = useState(false);
  const [items, setItems] = useState({});
  const [busy, setBusy] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["pointage", jour], queryFn: () => api.get("/pointage", { date: jour }) });
  const bilan = useQuery({ queryKey: ["pointage", "bilan", mois], queryFn: () => api.get("/pointage/bilan", { mois }), enabled: vue === "mois" });
  useEffect(() => {
    if (!data) return;
    setItems(Object.fromEntries(data.rows.map((r) => [r.id, { statut: r.statut || (r.absence_prevue ? "absent" : ""), heure_arrivee: r.heure_arrivee || "", remplacant_id: r.remplacant_id || "", note: r.note || (r.absence_prevue ? `En ${r.absence_prevue}` : "") }])));
  }, [data]);
  const maj = (id, patch) => setItems((x) => ({ ...x, [id]: { ...x[id], ...patch } }));
  const rows = (data?.rows || []).filter((r) => tous || r.service === "enseignant" || !r.service);
  const enseignants = (data?.rows || []).filter((r) => r.service === "enseignant");
  const save = async () => {
    setBusy(true);
    try {
      const list = rows.filter((r) => items[r.id]?.statut).map((r) => ({ personnel_id: r.id, ...items[r.id], remplacant_id: Number(items[r.id].remplacant_id) || null }));
      await api.put("/pointage", { date: jour, items: list });
      toast(`Présences du ${date(jour)} enregistrées`);
      INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      qc.invalidateQueries({ queryKey: ["personnel"] });
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const nb = (st) => rows.filter((r) => items[r.id]?.statut === st).length;
  return (
    <div className="card">
      <div className="toolbar">
        <div className="seg"><button className={vue === "jour" ? "on" : ""} onClick={() => setVue("jour")}>Jour</button><button className={vue === "mois" ? "on" : ""} onClick={() => setVue("mois")}>Bilan du mois</button></div>
        {vue === "jour" ? <>
          <Input type="date" value={jour} max={today()} onChange={(e) => setJour(e.target.value)} style={{ width: 170 }} />
          <label className="check small"><input type="checkbox" checked={tous} onChange={(e) => setTous(e.target.checked)} />Tout le personnel</label>
          {peut && <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => rows.forEach((r) => !items[r.id]?.statut && maj(r.id, { statut: "present" }))}><UserCheck size={16} />Les autres présents</button>
            <button className="btn primary" onClick={save} disabled={busy}><Check size={16} />Enregistrer</button>
          </div>}
        </> : <Input type="month" value={mois} onChange={(e) => setMois(e.target.value)} style={{ width: 170 }} />}
      </div>
      {vue === "mois" ? (bilan.isLoading ? <Spinner /> : bilan.error ? <ErrorBox error={bilan.error} /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Personne</th><th className="r">Présent</th><th className="r">Retards</th><th className="r">Absences</th><th className="r hide-m">Jours notés</th></tr></thead>
          <tbody>{bilan.data.map((r) => <tr key={r.id}><td><strong>{r.nom} {r.prenom}</strong></td><td className="r num">{r.presents}</td>
            <td className="r num" style={{ color: r.retards ? "var(--gold-600)" : undefined, fontWeight: r.retards ? 700 : 400 }}>{r.retards}</td>
            <td className="r num" style={{ color: r.absents ? "var(--coral)" : undefined, fontWeight: r.absents ? 700 : 400 }}>{r.absents}</td><td className="r num hide-m">{r.jours_pointes}</td></tr>)}</tbody>
        </table></div>
      )) : isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : <>
        <div className="legend" style={{ padding: "0 18px 12px" }}>{Object.entries(STATUTS).map(([k, [l, c]]) => <span key={k} className={`badge ${c}`}>{l} : {nb(k)}</span>)}<span className="badge">Non noté : {rows.length - nb("present") - nb("retard") - nb("absent")}</span></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Personne</th><th>Présence</th><th>Arrivée</th><th className="hide-m">Remplacé(e) par</th><th className="hide-m">Remarque</th></tr></thead>
          <tbody>{rows.map((r) => {
            const it = items[r.id] || {};
            return (
              <tr key={r.id}>
                <td><strong>{r.nom} {r.prenom}</strong><div className="xs muted">{r.classes ? `Classe : ${r.classes}` : r.poste || ""}{r.absence_prevue ? <span style={{ color: "var(--coral)" }}> · {r.absence_prevue} prévu(e)</span> : ""}</div></td>
                <td style={{ whiteSpace: "nowrap" }}>{Object.entries(STATUTS).map(([k, [l, c]]) => (
                  <button key={k} disabled={!peut} className={`btn sm ${it.statut === k ? "" : "ghost"}`} style={it.statut === k ? { background: `var(--${c === "gold" ? "gold" : c})`, color: "#fff", borderColor: "transparent" } : undefined}
                    onClick={() => maj(r.id, { statut: k, ...(k === "retard" && !it.heure_arrivee ? { heure_arrivee: heure() } : {}) })}>{l}</button>
                ))}</td>
                <td>{it.statut === "retard" ? <Input type="time" value={it.heure_arrivee} onChange={(e) => maj(r.id, { heure_arrivee: e.target.value })} style={{ width: 120 }} disabled={!peut} /> : <span className="muted">—</span>}</td>
                <td className="hide-m">{it.statut === "absent" && r.service === "enseignant" ? (
                  <Select value={it.remplacant_id} onChange={(e) => maj(r.id, { remplacant_id: e.target.value })} disabled={!peut}><option value="">Personne</option>{enseignants.filter((x) => x.id !== r.id).map((x) => <option key={x.id} value={x.id}>{x.prenom} {x.nom}</option>)}</Select>
                ) : <span className="muted">—</span>}</td>
                <td className="hide-m"><Input value={it.note || ""} onChange={(e) => maj(r.id, { note: e.target.value })} placeholder="Malade, formation…" disabled={!peut} /></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </>}
    </div>
  );
}

// ── Aujourd'hui ──
function Jour({ ouvrir }) {
  const s = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [jour, setJour] = useState(today());
  const { data, isLoading, error } = useQuery({ queryKey: ["vie-jour", jour], queryFn: () => api.get("/vie-scolaire/jour", { date: jour }) });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const absents = data.absences.filter((a) => a.type === "absence"), retards = data.absences.filter((a) => a.type === "retard");
  const sansAppel = data.classes.filter((c) => !c.appel_fait && c.effectif > 0);
  const dehors = data.sorties.filter((x) => !x.retour);
  const p = data.personnel;
  const statutConvoc = async (d, st) => { try { await api.put(`/discipline/${d.id}`, { convocation: true, convocation_statut: st }); qc.invalidateQueries({ queryKey: ["vie-jour"] }); toast("Convocation mise à jour"); } catch (e) { toast(e.message, "error"); } };
  const Liste = ({ titre, icon: I, rows, vide, rendu, action }) => (
    <div className="card c6">
      <div className="card-head"><h3><I size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />{titre}</h3><span className="badge">{rows.length}</span>{action}</div>
      {rows.length ? <ul className="feed" style={{ maxHeight: 300, overflowY: "auto" }}>{rows.map(rendu)}</ul> : <div className="card-body"><p className="muted small">{vide}</p></div>}
    </div>
  );
  return (
    <div className="dash">
      <div className="c12" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <CalendarDays size={18} className="muted" /><strong>{dateLongue(jour)}</strong>
        <Input type="date" value={jour} max={today()} onChange={(e) => setJour(e.target.value)} style={{ width: 170 }} />
      </div>
      {[["Absents", absents.length, UserX, "coral"], ["Retards", retards.length, Clock, "gold"], ["Sortis (pas revenus)", dehors.length, DoorOpen, "azure"],
        ["Personnel noté", `${p.total - p.non_pointes}/${p.total}`, Users, "teal"]].map(([l, n, I, c]) => (
        <div key={l} className="card kpi c3"><div className="top"><span className="label">{l}</span><span className={`ic ${c}`}><I size={20} /></span></div><div className="value">{n}</div>
          {l === "Personnel noté" && <div className="sub">{p.retards} retard(s) · {p.absents} absent(s)</div>}</div>
      ))}
      <div className="card c12">
        <div className="card-head"><h3>Appel des classes</h3>{sansAppel.length ? <span className="badge coral">{sansAppel.length} appel{sansAppel.length > 1 ? "s" : ""} non fait{sansAppel.length > 1 ? "s" : ""}</span> : <span className="badge green">Tous les appels sont faits</span>}</div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {data.classes.map((c) => (
            <button key={c.id} className="card" style={{ padding: 12, textAlign: "left", cursor: "pointer", border: `1px solid ${c.appel_fait ? "var(--green)" : "var(--line)"}` }} onClick={() => nav(`/absences?classe=${c.id}`)}>
              <div className="between"><strong>{c.nom}</strong>{c.appel_fait ? <Check size={16} color="var(--green)" /> : <span className="xs" style={{ color: "var(--coral)", fontWeight: 700 }}>À faire</span>}</div>
              <div className="xs muted" style={{ marginTop: 4 }}>{c.effectif} élèves{c.absents ? ` · ${c.absents} abs.` : ""}{c.retards ? ` · ${c.retards} ret.` : ""}</div>
            </button>
          ))}
        </div>
      </div>
      <Liste titre="Retards du jour" icon={Clock} rows={retards} vide="Aucun retard." action={s.peut("surveillance.ecrire") && <button className="btn sm" onClick={() => ouvrir("retard")}><Plus size={14} />Retard</button>}
        rendu={(a) => <li key={a.id} onClick={() => nav(`/vie-scolaire/imprimer?doc=billet&id=${a.id}`)}><div className="grow"><strong>{a.nom} {a.prenom}</strong><span>{a.classe} · {a.motif || "Retard"}</span></div><Printer size={15} className="muted" /></li>} />
      <Liste titre="Absents" icon={UserX} rows={absents} vide="Aucun absent noté (vérifiez que les appels sont faits)."
        rendu={(a) => <li key={a.id} onClick={() => nav(`/eleves/${a.eleve_id}`)}><div className="grow"><strong>{a.nom} {a.prenom}</strong><span>{a.classe} · {a.justifiee ? "Justifiée" : "Non justifiée"}{a.motif ? ` · ${a.motif}` : ""}</span></div>
          {a.telephone && <a className="btn sm wa" onClick={(e) => e.stopPropagation()} href={wa(a.telephone, `Bonjour, ${s.etablissement?.nom} vous informe que ${a.prenom} ${a.nom} (${a.classe}) est absent(e) aujourd'hui ${dateLongue(jour)}. Merci de nous en indiquer la raison.`)} target="_blank" rel="noreferrer"><MessageCircle size={14} /></a>}</li>} />
      <Liste titre="Sorties du jour" icon={DoorOpen} rows={data.sorties} vide="Aucune sortie." action={s.peut("surveillance.ecrire") && <button className="btn sm" onClick={() => ouvrir("sortie")}><Plus size={14} />Sortie</button>}
        rendu={(x) => <li key={x.id} onClick={() => nav(`/vie-scolaire/imprimer?doc=sortie&id=${x.id}`)}><div className="grow"><strong>{x.nom} {x.prenom}</strong><span>{x.classe} · {x.heure_sortie || ""} · {x.motif}</span></div>{x.retour ? <span className="badge green">Revenu</span> : <span className="badge gold">Dehors</span>}</li>} />
      <Liste titre="Convocations de parents" icon={Gavel} rows={data.convocations} vide="Aucune convocation prévue."
        rendu={(d) => <li key={d.id}><div className="grow"><strong>{d.nom} {d.prenom}</strong><span>{d.classe} · {d.convocation_date ? date(d.convocation_date) : "date à fixer"}{d.convocation_heure ? ` à ${d.convocation_heure}` : ""} · {d.categorie}</span></div>
          {s.peut("surveillance.ecrire") && <><button className="btn sm" onClick={() => statutConvoc(d, "venue")} title="Parents venus"><Check size={14} /></button><button className="btn sm ghost" onClick={() => statutConvoc(d, "absente")} title="Parents absents"><X size={14} /></button></>}</li>} />
      {(data.exclusions.length > 0 || data.incidents.length > 0) && (
        <div className="card c12">
          <div className="card-head"><h3><AlertTriangle size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Discipline</h3></div>
          <div className="card-body stack" style={{ gap: 6 }}>
            {data.exclusions.map((d) => <div key={`x${d.id}`} className="small"><span className="badge coral">Exclu(e)</span> <strong>{d.nom} {d.prenom}</strong> ({d.classe}) jusqu'au {date(d.date_fin || d.date_debut)} · {d.categorie}</div>)}
            {data.incidents.map((d) => <div key={d.id} className="small"><DiscBadge type={d.type} /> <strong>{d.nom} {d.prenom}</strong> ({d.classe}) · {d.categorie}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VieScolaire() {
  const s = useSession();
  const [p, setP] = useSearchParams();
  const tab = p.get("vue") || "jour";
  const [modal, setModal] = useState(null);
  const peut = s.peut("surveillance.ecrire");
  const tabs = [["jour", "Aujourd'hui", CalendarCheck], ["discipline", "Discipline", Gavel], ["sorties", "Sorties", DoorOpen], ["presence", "Présence du personnel", UserCheck]];
  return (
    <>
      <PageHead title="Vie scolaire" sub="Surveillance générale : assiduité, discipline, sorties et présence du personnel">
        {peut && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setModal("retard")}><Clock size={17} />Retard</button>
          <button className="btn" onClick={() => setModal("sortie")}><DoorOpen size={17} />Sortie</button>
          <button className="btn primary" onClick={() => setModal("discipline")}><Gavel size={17} />Discipline</button>
        </div>}
      </PageHead>
      <div className="tabs" role="tablist" style={{ marginBottom: 18 }}>
        {tabs.map(([k, l, I]) => <button key={k} role="tab" className={tab === k ? "on" : ""} onClick={() => setP(k === "jour" ? {} : { vue: k })}><I size={16} />{l}</button>)}
      </div>
      {tab === "discipline" ? <Discipline /> : tab === "sorties" ? <Sorties /> : tab === "presence" ? <Presence /> : <Jour ouvrir={setModal} />}
      {modal === "retard" && <RetardForm onClose={() => setModal(null)} />}
      {modal === "sortie" && <SortieForm onClose={() => setModal(null)} />}
      {modal === "discipline" && <DisciplineForm onClose={() => setModal(null)} />}
    </>
  );
}

// ── Documents imprimables (A5) ──
export function VieScolaireImpression() {
  const s = useSession();
  const nav = useNavigate();
  const [p] = useSearchParams();
  const doc = p.get("doc"), id = p.get("id");
  const { data: d, isLoading, error } = useQuery({ queryKey: ["vie-doc", doc, id], queryFn: () => api.get(`/vie-scolaire/document/${doc}/${id}`) });
  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 32 }}><ErrorBox error={error} /></div>;
  const etab = s.etablissement;
  const titre = { billet: "Billet d'entrée", sortie: "Bon de sortie", convocation: "Convocation des parents" }[doc];
  const L = ({ l, v }) => <div style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px dashed #d6e2e5" }}><span style={{ width: 150, color: "#4a6168" }}>{l}</span><strong style={{ flex: 1 }}>{v || "—"}</strong></div>;
  let corps, msg;
  if (doc === "billet") {
    corps = <>
      <L l="Élève" v={`${d.prenom} ${d.nom}`} /><L l="Classe" v={d.classe} /><L l="Date" v={dateLongue(d.date_absence)} /><L l="Heure d'arrivée" v={(d.motif || "").replace(/^Arrivé\(e\) à /, "").split(" · ")[0]} />
      <L l="Raison" v={(d.motif || "").split(" · ")[1]} /><L l="Justifié" v={d.justifiee ? "Oui" : "Non"} /><L l="Retards cette année" v={d.retards_annee} />
      <p style={{ marginTop: 18 }}>L'élève est autorisé(e) à entrer en classe.</p>
    </>;
    msg = `Bonjour, ${etab.nom} vous informe que ${d.prenom} ${d.nom} (${d.classe}) est arrivé(e) en retard le ${date(d.date_absence)}.`;
  } else if (doc === "sortie") {
    corps = <>
      <L l="Élève" v={`${d.prenom} ${d.nom}`} /><L l="Classe" v={d.classe} /><L l="Date" v={dateLongue(d.date_sortie)} /><L l="Heure de sortie" v={d.heure_sortie} />
      <L l="Motif" v={d.motif} /><L l="Récupéré(e) par" v={d.accompagnant ? `${d.accompagnant}${d.lien ? ` (${d.lien})` : ""}` : null} /><L l="Pièce d'identité" v={d.piece} /><L l="Autorisé par" v={d.autorise_par} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 30 }}><div>Signature de la personne<br />qui récupère l'élève</div><div style={{ textAlign: "right" }}>Le surveillant général</div></div>
    </>;
    msg = `Bonjour, ${etab.nom} vous informe que ${d.prenom} ${d.nom} (${d.classe}) est sorti(e) de l'école le ${date(d.date_sortie)}${d.heure_sortie ? ` à ${d.heure_sortie}` : ""} (${d.motif})${d.accompagnant ? `, accompagné(e) de ${d.accompagnant}` : ""}.`;
  } else {
    const parent = d.pere || d.mere || d.tuteur_nom;
    corps = <>
      <p>À l'attention de {parent ? <strong>{parent}</strong> : "Madame, Monsieur"}, parent de l'élève <strong>{d.prenom} {d.nom}</strong> ({d.classe}),</p>
      <p style={{ marginTop: 12 }}>Vous êtes prié(e) de vous présenter au bureau du surveillant général {d.convocation_date ? <>le <strong>{dateLongue(d.convocation_date)}</strong></> : "dans les meilleurs délais"}{d.convocation_heure ? <> à <strong>{d.convocation_heure.replace(":", "h")}</strong></> : ""}, au sujet de :</p>
      <div style={{ margin: "12px 0", padding: 12, background: "#f3f8f9", borderRadius: 6 }}><strong>{d.categorie}</strong>{d.description ? <div style={{ marginTop: 4 }}>{d.description}</div> : null}<div style={{ marginTop: 4 }}>Mesure : {TYPES_DISC[d.type]?.l}{d.sanction ? ` · ${d.sanction}` : ""}</div></div>
      <p>Votre présence est indispensable. Merci de votre compréhension.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 30 }}><div>Signature du parent</div><div style={{ textAlign: "right" }}>Le surveillant général</div></div>
    </>;
    msg = messageDiscipline(etab, d);
  }
  return (
    <div className="print-page">
      <style>{"@page { size: A5 portrait; margin: 0; }"}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(-1)}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{titre}</strong> — {d.prenom} {d.nom}</span>
        <Partager format="A5" nom={`${titre}-${d.nom}-${d.prenom}`} telephone={d.telephone} eleveId={d.eleve_id} message={msg} />
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      <div className="tickets">
        <article className="ticket" style={{ minHeight: "auto" }}>
          <header className="t-head"><img src="/logo.png" alt="" /><div className="t-school"><strong>{etab.nom}</strong><span>{etab.adresse}</span><span>Tél. {etab.telephones}</span></div></header>
          <h2 style={{ textAlign: "center", fontSize: 20, margin: "16px 0 4px", color: "#123f4a" }}><Shield size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />{titre}</h2>
          <p style={{ textAlign: "center", fontSize: 11, color: "#4a6168", marginBottom: 14 }}>Vie scolaire · Année {s.annee?.libelle}</p>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{corps}</div>
          <p style={{ marginTop: "auto", paddingTop: 20, fontSize: 11, color: "#4a6168" }}>Fait le {dateLongue(today())}</p>
        </article>
      </div>
    </div>
  );
}

// Onglet « Vie scolaire » de la fiche élève
export function VieEleve({ eleve }) {
  const s = useSession();
  const nav = useNavigate();
  const [modal, setModal] = useState(null);
  const peut = s.peut("surveillance.ecrire");
  const disc = useQuery({ queryKey: ["discipline", { eleve_id: eleve.id }], queryFn: () => api.get("/discipline", { eleve_id: eleve.id }) });
  const sorties = useQuery({ queryKey: ["sorties", "eleve", eleve.id], queryFn: () => api.get("/sorties", { eleve_id: eleve.id }) });
  return (
    <div className="info-grid">
      <div className="card">
        <div className="card-head" style={{ paddingBottom: 14 }}><h3>Discipline</h3>{peut && <button className="btn sm primary" onClick={() => setModal({ t: "disc" })}><Plus size={14} />Nouvelle fiche</button>}</div>
        {disc.isLoading ? <Spinner /> : !disc.data?.rows.length ? <Empty icon={Gavel} title="Rien à signaler">Aucune fiche de discipline.</Empty> : (
          <div className="table-wrap"><table className="table"><tbody>{disc.data.rows.map((d) => (
            <tr key={d.id}><td className="num">{date(d.date_fait)}</td><td><strong>{d.categorie}</strong>{d.sanction && <div className="xs muted">{d.sanction}</div>}</td><td><DiscBadge type={d.type} /></td>
              <td className="r" style={{ whiteSpace: "nowrap" }}>{d.convocation && <button className="btn sm ghost icon" onClick={() => nav(`/vie-scolaire/imprimer?doc=convocation&id=${d.id}`)} aria-label="Convocation"><Printer size={15} /></button>}
                {peut && <button className="btn sm ghost icon" onClick={() => setModal({ t: "disc", x: d })} aria-label="Modifier"><Pencil size={15} /></button>}</td></tr>
          ))}</tbody></table></div>
        )}
      </div>
      <div className="card">
        <div className="card-head" style={{ paddingBottom: 14 }}><h3>Sorties et retards</h3>{peut && <><button className="btn sm" onClick={() => setModal({ t: "retard" })}><Clock size={14} />Retard</button><button className="btn sm" onClick={() => setModal({ t: "sortie" })}><DoorOpen size={14} />Sortie</button></>}</div>
        {sorties.isLoading ? <Spinner /> : !sorties.data?.length ? <Empty icon={DoorOpen} title="Aucune sortie">Les retards apparaissent dans l'onglet « Absences ».</Empty> : (
          <div className="table-wrap"><table className="table"><tbody>{sorties.data.map((x) => (
            <tr key={x.id} className="click" onClick={() => nav(`/vie-scolaire/imprimer?doc=sortie&id=${x.id}`)}><td className="num">{date(x.date_sortie)}{x.heure_sortie && <div className="xs muted">{x.heure_sortie}</div>}</td>
              <td><strong>{x.motif}</strong>{x.accompagnant && <div className="xs muted">avec {x.accompagnant}</div>}</td><td>{x.retour ? <span className="badge green">Revenu</span> : <span className="badge">Sorti</span>}</td></tr>
          ))}</tbody></table></div>
        )}
      </div>
      {modal?.t === "disc" && <DisciplineForm fiche={modal.x} eleve={eleve} onClose={() => setModal(null)} />}
      {modal?.t === "retard" && <RetardForm eleve={eleve} onClose={() => setModal(null)} />}
      {modal?.t === "sortie" && <SortieForm eleve={eleve} onClose={() => setModal(null)} />}
    </div>
  );
}
