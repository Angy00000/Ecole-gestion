import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, PartyPopper, CalendarDays, MapPin, Ticket, Users, Wallet, ListTodo, Printer, Pencil, Trash2, Save, ArrowUp, ArrowDown,
  MessageCircle, Check, Search, HandCoins, Upload, Image, FileText, BadgeCheck, ClipboardList, BarChart3, Mail, Layers,
} from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, today, telWa } from "../lib/format";
import { Modal, Field, Input, Select, Textarea, Money, Spinner, ErrorBox, Empty, Confirm, PageHead, useToast } from "../components/ui";
import {
  TYPES_EVT, ICONES_EVT, THEMES_EVT, STATUTS_EVT, STATUTS_CARTE, COULEUR_CARTE, STATUTS_INVITE, COULEUR_INVITE, CATEGORIES_INVITE, CIVILITES, POSTES_BUDGET,
  modeleEvt, quand, nomInvite, messageInvitation, messageCarte, COULEURS_PERSO, styleTheme,
} from "../lib/evenements";

const num = (n) => String(n).padStart(4, "0");
const MIco = ({ I }) => <span className="ic gold" style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center" }}><I size={19} /></span>;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ── Liste des événements ──────────────────────────────────────────────────
export default function Evenements() {
  const s = useSession();
  const nav = useNavigate();
  const [nouveau, setNouveau] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["evenements"], queryFn: () => api.get("/evenements") });
  const peut = s.peut("evenements.ecrire");
  return (
    <>
      <PageHead title="Événements" sub="Anniversaires, fêtes, kermesses… : cartes de soutien, invités, budget et supports au nom de l'école">
        {peut && <button className="btn primary" onClick={() => setNouveau(true)}><Plus size={17} />Nouvel événement</button>}
      </PageHead>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : !data.length ? (
        <div className="card"><Empty icon={PartyPopper} title="Aucun événement" action={peut && <button className="btn primary" onClick={() => setNouveau(true)}><Plus size={16} />Préparer un événement</button>}>
          Préparez les 20 ans de l'école, la fête de fin d'année, une kermesse… Le logiciel crée les cartes de soutien, les invitations, l'affiche et suit l'argent.
        </Empty></div>
      ) : (
        <div className="evt-liste">{data.map((e) => (
          <Link key={e.id} to={`/evenements/${e.id}`} className={`card evt-tuile theme-${e.theme}`}>
            <div className="evt-tuile-haut">
              <span className="evt-tuile-ico">{ICONES_EVT[e.type] || "📅"}</span>
              <div><div className="evt-tuile-acc">{e.accroche || TYPES_EVT[e.type]}</div><div className="evt-tuile-sous">{e.sous_titre}</div></div>
              <span className={`badge ${e.statut === "preparation" ? "gold" : e.statut === "termine" ? "green" : "coral"}`}>{STATUTS_EVT[e.statut]}</span>
            </div>
            <div className="evt-tuile-corps">
              <h3>{e.titre}</h3>
              <p className="small muted"><CalendarDays size={14} /> {e.date_evt ? quand(e) : "Date à fixer"}{e.lieu ? <> · <MapPin size={14} /> {e.lieu}</> : null}</p>
              <div className="evt-mini">
                <span><Ticket size={14} /> {e.cartes_vendues}/{e.cartes_total} cartes</span>
                <span><HandCoins size={14} /> {fcfa(Number(e.cartes_encaisse) + Number(e.recettes))}</span>
                <span><Users size={14} /> {e.invites_confirmes}/{e.invites_total} invités</span>
              </div>
            </div>
          </Link>
        ))}</div>
      )}
      {nouveau && <NouvelEvenement onClose={() => setNouveau(false)} onCree={(id) => nav(`/evenements/${id}`)} />}
    </>
  );
}

function NouvelEvenement({ onClose, onCree }) {
  const s = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState("anniversaire");
  const [v, setV] = useState({ date_evt: "", heure: "", lieu: "" });
  const [error, setError] = useState(null);
  const m = useMemo(() => modeleEvt(type, s.etablissement, v.date_evt), [type, v.date_evt, s.etablissement]);
  const [titre, setTitre] = useState(null);
  const creer = async () => {
    setError(null);
    try {
      const r = await api.post("/evenements", { ...m, titre: titre ?? m.titre, date_evt: v.date_evt || null, heure: v.heure || null, lieu: v.lieu || m.lieu });
      qc.invalidateQueries({ queryKey: ["evenements"] });
      toast("Événement créé");
      onCree(r.id);
    } catch (e) { setError(e); }
  };
  return (
    <Modal title="Nouvel événement" icon={<MIco I={PartyPopper} />} wide onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={creer} disabled={!(titre ?? m.titre)}>Créer l'événement</button>
    </>}>
      <div className="stack" style={{ gap: 16 }}>
        <ErrorBox error={error} />
        <Field label="Type d'événement">
          <div className="evt-types">{Object.entries(TYPES_EVT).map(([k, l]) => (
            <button key={k} type="button" className={type === k ? "on" : ""} onClick={() => { setType(k); setTitre(null); }}><span>{ICONES_EVT[k]}</span>{l}</button>
          ))}</div>
        </Field>
        <Field label="Titre" required hint="Proposé selon le type : modifiez-le librement. Tout le reste (accroche, programme, couleurs) se règle ensuite."><Input value={titre ?? m.titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Kermesse de l'école" /></Field>
        <div className="grid g3">
          <Field label="Date"><Input type="date" value={v.date_evt} onChange={(e) => setV({ ...v, date_evt: e.target.value })} /></Field>
          <Field label="Heure"><Input value={v.heure} onChange={(e) => setV({ ...v, heure: e.target.value })} placeholder="15h00" /></Field>
          <Field label="Lieu"><Input value={v.lieu} onChange={(e) => setV({ ...v, lieu: e.target.value })} placeholder={m.lieu} /></Field>
        </div>
      </div>
    </Modal>
  );
}

// ── Fiche d'un événement ──────────────────────────────────────────────────
const ONGLETS = [["infos", "Infos et programme", FileText], ["cartes", "Cartes de soutien", Ticket], ["invites", "Invités", Users], ["budget", "Budget", Wallet], ["taches", "Tâches", ListTodo], ["supports", "Supports à imprimer", Printer]];

export function EvenementFiche() {
  const { id } = useParams();
  const s = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState("infos");
  const [suppr, setSuppr] = useState(false);
  const { data: e, isLoading, error } = useQuery({ queryKey: ["evenement", id], queryFn: () => api.get(`/evenements/${id}`) });
  const peut = s.peut("evenements.ecrire");
  const rafraichir = () => { qc.invalidateQueries({ queryKey: ["evenement", id] }); qc.invalidateQueries({ queryKey: ["evenements"] }); };
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const encaisse = Number(e.cartes_encaisse) + Number(e.recettes);
  const supprimer = async () => {
    try { await api.del(`/evenements/${id}`); toast("Événement supprimé"); qc.invalidateQueries({ queryKey: ["evenements"] }); nav("/evenements"); }
    catch (x) { toast(x.message, "error"); }
  };
  const compte = { cartes: e.cartes.length, invites: e.invites.length, budget: e.budget.length, taches: e.taches.length };
  return (
    <>
      <PageHead title={e.titre} sub={[TYPES_EVT[e.type], e.date_evt ? quand(e) : "Date à fixer", e.lieu].filter(Boolean).join(" · ")}
        back={<button className="btn ghost icon" onClick={() => nav("/evenements")} aria-label="Retour"><ArrowLeft size={18} /></button>}>
        <button className="btn" onClick={() => setTab("supports")}><Printer size={16} />Supports</button>
        {peut && <button className="btn ghost icon" onClick={() => setSuppr(true)} aria-label="Supprimer l'événement"><Trash2 size={17} /></button>}
      </PageHead>
      <div className="dash" style={{ marginBottom: 18 }}>
        <Kpi c="c3" ic="gold" I={Ticket} label="Cartes de soutien" v={`${e.cartes_vendues}`} small={`/ ${e.cartes_total}`} sub={`${pct(e.cartes_vendues, e.cartes_total)} % vendues`} />
        <Kpi c="c3" ic="green" I={HandCoins} label="Argent collecté" v={fcfa(encaisse)} sub={`Cartes ${fcfa(e.cartes_encaisse)} · autres ${fcfa(e.recettes)}`} />
        <Kpi c="c3" ic="coral" I={Wallet} label="Solde (collecté − dépensé)" v={fcfa(encaisse - Number(e.depenses))} sub={`Dépenses ${fcfa(e.depenses)}${Number(e.depenses_prevues) ? ` · prévues ${fcfa(e.depenses_prevues)}` : ""}`} />
        <Kpi c="c3" ic="teal" I={Users} label="Invités" v={`${e.invites_confirmes}`} small={`/ ${e.invites_total}`} sub={`ont confirmé · ${e.places} place${e.places > 1 ? "s" : ""} prévue${e.places > 1 ? "s" : ""}`} />
      </div>
      <div className="tabs" role="tablist" style={{ marginBottom: 18 }}>
        {ONGLETS.map(([k, l, I]) => <button key={k} role="tab" className={tab === k ? "on" : ""} onClick={() => setTab(k)}><I size={16} />{l}{compte[k] != null && <span className="count">{compte[k]}</span>}</button>)}
      </div>
      {tab === "infos" && <OngletInfos e={e} peut={peut} onSaved={rafraichir} />}
      {tab === "cartes" && <OngletCartes e={e} peut={peut} onChange={rafraichir} />}
      {tab === "invites" && <OngletInvites e={e} peut={peut} onChange={rafraichir} />}
      {tab === "budget" && <OngletBudget e={e} peut={peut} onChange={rafraichir} />}
      {tab === "taches" && <OngletTaches e={e} peut={peut} onChange={rafraichir} />}
      {tab === "supports" && <OngletSupports e={e} />}
      {suppr && <Confirm danger title="Supprimer cet événement ?" confirmLabel="Supprimer définitivement" message={`« ${e.titre} » sera supprimé avec ses ${e.cartes.length} cartes de soutien, ${e.invites.length} invités, son budget et ses tâches. La Direction en sera prévenue.`} onConfirm={supprimer} onClose={() => setSuppr(false)} />}
    </>
  );
}

function Kpi({ c, ic, I, label, v, small, sub }) {
  return (
    <div className={`card kpi ${c}`}>
      <div className="top"><span className="label">{label}</span><span className={`ic ${ic}`}><I size={20} /></span></div>
      <div className="value" style={{ fontSize: 26 }}>{v}{small && <small>{small}</small>}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

// ── Infos et programme ──
function OngletInfos({ e, peut, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState(() => ({ ...e, date_evt: e.date_evt?.slice(0, 10) || "", programme: e.programme || [] }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (x) => setV({ ...v, [k]: x.target.value });
  const toast2 = useToast();
  const choisirPhoto = async (x) => {
    const f = x.target.files?.[0]; x.target.value = "";
    if (!f) return;
    try {
      const img = await new Promise((ok, ko) => { const i = new window.Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(f); });
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      let q = 0.82, url = c.toDataURL("image/jpeg", q);
      while (url.length > 1_300_000 && q > 0.4) { q -= 0.1; url = c.toDataURL("image/jpeg", q); }
      setV((o) => ({ ...o, image: url }));
    } catch { toast2("Cette image ne peut pas être lue.", "error"); }
  };
  const prog = (i, k, val) => setV({ ...v, programme: v.programme.map((p, j) => (j === i ? { ...p, [k]: val } : p)) });
  const bouger = (i, d) => { const p = [...v.programme]; const [x] = p.splice(i, 1); p.splice(i + d, 0, x); setV({ ...v, programme: p }); };
  const save = async () => {
    setError(null); setBusy(true);
    try {
      const { titre, type, accroche, sous_titre, slogan, date_evt, heure, lieu, description, programme, contact, theme, statut, couleurs, image } = v;
      await api.put(`/evenements/${e.id}`, { titre, type, accroche, sous_titre, slogan, date_evt: date_evt || null, heure, lieu, description, programme, contact, theme, statut, couleurs: couleurs || null, image: image || null });
      toast("Événement enregistré"); onSaved();
    } catch (x) { setError(x); } finally { setBusy(false); }
  };
  return (
    <div className="evt-infos">
      <div className="card">
        <div className="card-head"><h3>L'événement</h3></div>
        <div className="card-body stack" style={{ gap: 14 }}>
          <ErrorBox error={error} />
          <Field label="Titre" required><Input value={v.titre} onChange={set("titre")} disabled={!peut} /></Field>
          <div className="grid g2">
            <Field label="Accroche (grand texte des supports)" hint="Ex. « 20 ans », « Kermesse », « Joyeux Noël »"><Input value={v.accroche || ""} onChange={set("accroche")} disabled={!peut} /></Field>
            <Field label="Sous-titre" hint="Ex. « 2006 – 2026 »"><Input value={v.sous_titre || ""} onChange={set("sous_titre")} disabled={!peut} /></Field>
          </div>
          <Field label="Slogan / devise"><Input value={v.slogan || ""} onChange={set("slogan")} disabled={!peut} placeholder="Éduquer, c'est rendre libre" /></Field>
          <div className="grid g3">
            <Field label="Date"><Input type="date" value={v.date_evt} onChange={set("date_evt")} disabled={!peut} /></Field>
            <Field label="Heure"><Input value={v.heure || ""} onChange={set("heure")} disabled={!peut} placeholder="15h00" /></Field>
            <Field label="Statut"><Select value={v.statut} onChange={set("statut")} disabled={!peut}>{Object.entries(STATUTS_EVT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          </div>
          <div className="grid g2">
            <Field label="Lieu"><Input value={v.lieu || ""} onChange={set("lieu")} disabled={!peut} /></Field>
            <Field label="Contact (réservations, confirmations)"><Input value={v.contact || ""} onChange={set("contact")} disabled={!peut} placeholder="77 362 79 30" /></Field>
          </div>
          <Field label="Type"><Select value={v.type} onChange={set("type")} disabled={!peut}>{Object.entries(TYPES_EVT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Message / présentation" hint="Apparaît sur l'affiche et le flyer."><Textarea rows={3} value={v.description || ""} onChange={set("description")} disabled={!peut} placeholder="Venez célébrer avec nous 20 ans d'éducation et de réussite à Malika…" /></Field>
          <Field label="Couleurs des supports">
            <div className="evt-themes">{Object.entries(THEMES_EVT).map(([k, t]) => (
              <button key={k} type="button" disabled={!peut} className={v.theme === k ? "on" : ""} onClick={() => setV({ ...v, theme: k })}>
                <span className="evt-swatch">{t.couleurs.map((c) => <i key={c} style={{ background: c }} />)}</span><strong>{t.nom}</strong><small>{t.sub}</small>
              </button>
            ))}</div>
          </Field>
          {v.theme === "perso" && (
            <div className="evt-couleurs">{[["fond", "Fond"], ["fond2", "Fond (clair)"], ["accent", "Dorures / accent"], ["texte", "Texte"]].map(([k, l]) => (
              <label key={k}><input type="color" disabled={!peut} value={(v.couleurs || {})[k] || COULEURS_PERSO[k]} onChange={(x) => setV({ ...v, couleurs: { ...COULEURS_PERSO, ...(v.couleurs || {}), [k]: x.target.value } })} /><span>{l}</span></label>
            ))}<div className="evt-apercu-couleurs" style={styleTheme(v)}><b>{v.accroche || "Aperçu"}</b><span>{v.titre}</span></div></div>
          )}
          <Field label="Photo de fond (affiche, flyer, programme)" hint="Une photo de l'école, des élèves, d'une ancienne fête… Elle est assombrie aux couleurs choisies pour que le texte reste lisible.">
            <div className="evt-photo">
              {v.image ? <img src={v.image} alt="" /> : <span className="muted small">Aucune photo</span>}
              {peut && <label className="btn sm"><Upload size={15} />{v.image ? "Changer" : "Choisir une photo"}<input type="file" accept="image/*" hidden onChange={choisirPhoto} /></label>}
              {peut && v.image && <button type="button" className="btn sm ghost" onClick={() => setV({ ...v, image: null })}><Trash2 size={15} />Retirer</button>}
            </div>
          </Field>
          <p className="xs muted">Les textes des supports (« célèbre ses », « Merci pour votre soutien ! », mentions de l'invitation…) se changent directement sur chaque support : bouton « Modifier les textes ».</p>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3>Programme</h3>{peut && <button className="btn sm" onClick={() => setV({ ...v, programme: [...v.programme, { heure: "", titre: "" }] })}><Plus size={15} />Ajouter un moment</button>}</div>
        <div className="card-body">
          {!v.programme.length && <p className="muted small">Aucun moment pour l'instant.</p>}
          <div className="evt-prog-edit">{v.programme.map((p, i) => (
            <div key={i} className="evt-prog-ligne">
              <Input value={p.heure || ""} onChange={(x) => prog(i, "heure", x.target.value)} placeholder="16h00" disabled={!peut} style={{ width: 86 }} />
              <div style={{ flex: 1, display: "grid", gap: 6 }}>
                <Input value={p.titre || ""} onChange={(x) => prog(i, "titre", x.target.value)} placeholder="Discours officiels" disabled={!peut} />
                <Input value={p.detail || ""} onChange={(x) => prog(i, "detail", x.target.value)} placeholder="Détail (facultatif)" disabled={!peut} className="sm" style={{ width: "100%" }} />
              </div>
              {peut && <div className="evt-prog-act">
                <button className="btn sm ghost icon" disabled={i === 0} onClick={() => bouger(i, -1)} aria-label="Monter"><ArrowUp size={15} /></button>
                <button className="btn sm ghost icon" disabled={i === v.programme.length - 1} onClick={() => bouger(i, 1)} aria-label="Descendre"><ArrowDown size={15} /></button>
                <button className="btn sm ghost icon" onClick={() => setV({ ...v, programme: v.programme.filter((_, j) => j !== i) })} aria-label="Retirer"><Trash2 size={15} /></button>
              </div>}
            </div>
          ))}</div>
        </div>
      </div>
      {peut && <div className="evt-save"><button className="btn primary" onClick={save} disabled={busy || !v.titre}><Save size={16} />Enregistrer</button></div>}
    </div>
  );
}

// ── Cartes de soutien ──
function OngletCartes({ e, peut, onChange }) {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ statut: "", vendeur: "", categorie: "", q: "" });
  const [serie, setSerie] = useState(false);
  const [remise, setRemise] = useState(false);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const cats = [...new Set(e.cartes.map((c) => c.categorie).filter(Boolean))];
  const vendeurs = [...new Set(e.cartes.map((c) => c.vendeur).filter(Boolean))].sort();
  const q = f.q.trim().toLowerCase();
  const rows = e.cartes.filter((c) => (!f.statut || c.statut === f.statut) && (!f.vendeur || c.vendeur === f.vendeur) && (!f.categorie || c.categorie === f.categorie)
    && (!q || String(c.numero).includes(q) || (c.detenteur || "").toLowerCase().includes(q) || (c.telephone || "").includes(q)));
  const parVendeur = vendeurs.map((v) => {
    const l = e.cartes.filter((c) => c.vendeur === v && c.statut !== "annulee");
    return { v, n: l.length, vendues: l.filter((c) => c.statut === "vendue").length, paye: l.reduce((t, c) => t + c.paye, 0), valeur: l.filter((c) => c.statut === "vendue").reduce((t, c) => t + c.montant, 0) };
  });
  const parCat = cats.map((k) => { const l = e.cartes.filter((c) => c.categorie === k && c.statut !== "annulee"); return { k, n: l.length, montant: l[0]?.montant, vendues: l.filter((c) => c.statut === "vendue").length, paye: l.reduce((t, c) => t + c.paye, 0) }; });
  const supprimer = async () => {
    try { await api.del(`/evt/cartes/${del.id}`); toast("Carte supprimée"); onChange(); } catch (x) { toast(x.message, "error"); }
    setDel(null);
  };
  if (!e.cartes.length) return (
    <div className="card"><Empty icon={Ticket} title="Pas encore de cartes de soutien" action={peut && <button className="btn primary" onClick={() => setSerie(true)}><Plus size={16} />Créer une série de cartes</button>}>
      Créez par exemple 200 cartes à 5 000 F et 50 cartes « Parrain » à 25 000 F. Chaque carte est numérotée, avec une souche à garder, et le logiciel suit qui les vend et l'argent rentré.
    </Empty>{serie && <SerieModal e={e} onClose={() => setSerie(false)} onDone={onChange} />}</div>
  );
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="evt-resume">
        {parCat.map((c) => <div key={c.k} className="card evt-res"><strong>{c.k}</strong><span>{fcfa(c.montant)} la carte</span><b>{c.vendues} / {c.n} vendues</b><small>{fcfa(c.paye)} encaissés</small></div>)}
        {parCat.length === 0 && <div className="card evt-res"><strong>Cartes</strong><b>{e.cartes_vendues} / {e.cartes_total} vendues</b></div>}
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="with-icon" style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} /><Input value={f.q} onChange={(x) => setF({ ...f, q: x.target.value })} placeholder="N°, nom ou téléphone" style={{ paddingLeft: 36 }} /></div>
          <Select value={f.statut} onChange={(x) => setF({ ...f, statut: x.target.value })}><option value="">Tous les statuts</option>{Object.entries(STATUTS_CARTE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          {cats.length > 1 && <Select value={f.categorie} onChange={(x) => setF({ ...f, categorie: x.target.value })}><option value="">Toutes les catégories</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>}
          {vendeurs.length > 0 && <Select value={f.vendeur} onChange={(x) => setF({ ...f, vendeur: x.target.value })}><option value="">Tous les vendeurs</option>{vendeurs.map((v) => <option key={v}>{v}</option>)}</Select>}
          <span className="spacer" />
          {peut && <button className="btn" onClick={() => setRemise(true)}><Layers size={16} />Remettre à un vendeur</button>}
          {peut && <button className="btn primary" onClick={() => setSerie(true)}><Plus size={16} />Nouvelle série</button>}
          <button className="btn" onClick={() => nav(`/evenements/${e.id}/imprimer?doc=cartes${f.categorie ? `&categorie=${encodeURIComponent(f.categorie)}` : ""}`)}><Printer size={16} />Imprimer</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>N°</th><th className="hide-m">Catégorie</th><th className="r">Montant</th><th>Vendeur</th><th>Détenteur</th><th className="r">Payé</th><th>Statut</th><th /></tr></thead>
            <tbody>{rows.slice(0, 400).map((c) => (
              <tr key={c.id} className={peut ? "clickable" : ""} onClick={() => peut && setEdit(c)}>
                <td className="num"><strong>{num(c.numero)}</strong></td>
                <td className="hide-m">{c.categorie || "—"}</td>
                <td className="r">{fcfa(c.montant)}</td>
                <td>{c.vendeur || <span className="muted">—</span>}</td>
                <td>{c.detenteur || <span className="muted">—</span>}{c.telephone && <div className="xs muted">{c.telephone}</div>}</td>
                <td className="r amount" style={{ color: c.paye >= c.montant && c.paye ? "var(--green)" : c.paye ? "var(--gold-ink)" : undefined }}>{c.paye ? fcfa(c.paye) : "—"}</td>
                <td><span className={`badge ${COULEUR_CARTE[c.statut]}`}>{STATUTS_CARTE[c.statut]}</span></td>
                <td className="r" style={{ whiteSpace: "nowrap" }} onClick={(x) => x.stopPropagation()}>
                  {c.telephone && c.statut === "vendue" && <a className="btn sm ghost icon" href={`https://wa.me/${telWa(c.telephone)}?text=${encodeURIComponent(messageCarte(c, e, s.etablissement))}`} target="_blank" rel="noreferrer" aria-label="Remercier par WhatsApp"><MessageCircle size={15} /></a>}
                  {peut && <button className="btn sm ghost icon" onClick={() => setDel(c)} aria-label="Supprimer"><Trash2 size={15} /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {rows.length > 400 && <p className="xs muted" style={{ padding: "8px 18px" }}>400 premières cartes affichées sur {rows.length} : affinez la recherche.</p>}
          {!rows.length && <p className="muted small" style={{ padding: 18 }}>Aucune carte ne correspond.</p>}
        </div>
      </div>
      {parVendeur.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Suivi par vendeur</h3><button className="btn sm" onClick={() => nav(`/evenements/${e.id}/imprimer?doc=suivi`)}><Printer size={15} />Imprimer le suivi</button></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Vendeur</th><th className="r">Cartes reçues</th><th className="r">Vendues</th><th className="r">Valeur vendue</th><th className="r">Argent remis</th><th className="r">Reste à remettre</th></tr></thead>
            <tbody>{parVendeur.map((x) => <tr key={x.v}><td><strong>{x.v}</strong></td><td className="r">{x.n}</td><td className="r">{x.vendues}</td><td className="r">{fcfa(x.valeur)}</td><td className="r amount" style={{ color: "var(--green)" }}>{fcfa(x.paye)}</td><td className="r amount" style={{ color: x.valeur - x.paye > 0 ? "var(--coral)" : undefined }}>{fcfa(Math.max(x.valeur - x.paye, 0))}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
      {serie && <SerieModal e={e} onClose={() => setSerie(false)} onDone={onChange} />}
      {remise && <RemiseModal e={e} vendeurs={vendeurs} onClose={() => setRemise(false)} onDone={onChange} />}
      {edit && <CarteModal c={edit} vendeurs={vendeurs} onClose={() => setEdit(null)} onDone={onChange} />}
      {del && <Confirm danger title={`Supprimer la carte n° ${num(del.numero)} ?`} confirmLabel="Supprimer" message={del.paye ? `${fcfa(del.paye)} ont été encaissés sur cette carte : préférez « Annulée ». La Direction sera prévenue.` : "La carte sera retirée de la série."} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </div>
  );
}

function SerieModal({ e, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ categorie: e.cartes.length ? "" : "Soutien", montant: 5000, nombre: 100, vendeur: "" });
  const [error, setError] = useState(null);
  const dernier = e.cartes.reduce((m, c) => Math.max(m, c.numero), 0);
  const go = async () => {
    setError(null);
    try { const r = await api.post(`/evenements/${e.id}/cartes/serie`, v); toast(`${r.crees} cartes créées (n° ${num(r.du)} à ${num(r.au)})`); onDone(); onClose(); }
    catch (x) { setError(x); }
  };
  return (
    <Modal title="Nouvelle série de cartes de soutien" icon={<MIco I={Ticket} />} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={go} disabled={!v.montant || !v.nombre}>Créer les cartes</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <div className="grid g2">
          <Field label="Catégorie" hint="Ex. Soutien, Parrain, Or, VIP"><Input value={v.categorie} onChange={(x) => setV({ ...v, categorie: x.target.value })} /></Field>
          <Field label="Montant de la carte" required><Money value={v.montant} onChange={(x) => setV({ ...v, montant: x })} /></Field>
          <Field label="Nombre de cartes" required><Input type="number" min={1} max={2000} value={v.nombre} onChange={(x) => setV({ ...v, nombre: x.target.value })} /></Field>
          <Field label="Remises à (facultatif)" hint="Vendeur qui reçoit toute la série"><Input value={v.vendeur} onChange={(x) => setV({ ...v, vendeur: x.target.value })} /></Field>
        </div>
        <p className="small muted">Numérotation : n° {num(dernier + 1)} à {num(dernier + Number(v.nombre || 0))}. Valeur totale : <strong>{fcfa((Number(v.nombre) || 0) * (Number(v.montant) || 0))}</strong>.</p>
      </div>
    </Modal>
  );
}

function RemiseModal({ e, vendeurs, onClose, onDone }) {
  const toast = useToast();
  const libres = e.cartes.filter((c) => c.statut === "disponible").map((c) => c.numero);
  const [v, setV] = useState({ du: libres[0] || 1, au: Math.min((libres[0] || 1) + 19, libres[libres.length - 1] || 1), vendeur: "" });
  const [error, setError] = useState(null);
  const go = async () => {
    setError(null);
    try { const r = await api.post(`/evenements/${e.id}/cartes/remise`, v); toast(`${r.n} cartes remises à ${v.vendeur}`); onDone(); onClose(); }
    catch (x) { setError(x); }
  };
  return (
    <Modal title="Remettre des cartes à un vendeur" icon={<MIco I={Layers} />} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={go} disabled={!v.vendeur}>Remettre</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <Field label="Vendeur" required hint="Membre du comité, enseignant, parent relais…"><Input list="evt-vendeurs" value={v.vendeur} onChange={(x) => setV({ ...v, vendeur: x.target.value })} autoFocus /><datalist id="evt-vendeurs">{vendeurs.map((x) => <option key={x} value={x} />)}</datalist></Field>
        <div className="grid g2">
          <Field label="Du n°"><Input type="number" value={v.du} onChange={(x) => setV({ ...v, du: x.target.value })} /></Field>
          <Field label="Au n°"><Input type="number" value={v.au} onChange={(x) => setV({ ...v, au: x.target.value })} /></Field>
        </div>
        <p className="small muted">{libres.length} cartes encore disponibles. Les cartes déjà vendues ne changent pas.</p>
      </div>
    </Modal>
  );
}

function CarteModal({ c, vendeurs, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ ...c, date_vente: c.date_vente?.slice(0, 10) || "" });
  const [error, setError] = useState(null);
  const set = (k) => (x) => setV({ ...v, [k]: x.target.value });
  const save = async (extra = {}) => {
    setError(null);
    try {
      const d = { ...v, ...extra };
      await api.put(`/evt/cartes/${c.id}`, { categorie: d.categorie, montant: d.montant, vendeur: d.vendeur, detenteur: d.detenteur, telephone: d.telephone, statut: d.statut, paye: d.paye || 0, date_vente: d.date_vente || null, note: d.note });
      toast(`Carte n° ${num(c.numero)} enregistrée`); onDone(); onClose();
    } catch (x) { setError(x); }
  };
  return (
    <Modal title={`Carte de soutien n° ${num(c.numero)}`} icon={<MIco I={Ticket} />} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      {v.statut !== "vendue" && <button className="btn" onClick={() => save({ statut: "vendue", paye: v.montant, date_vente: v.date_vente || today() })} disabled={!v.detenteur}><Check size={16} />Vendue et payée</button>}
      <button className="btn primary" onClick={() => save()}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <div className="grid g2">
          <Field label="Acheteur / donateur"><Input value={v.detenteur || ""} onChange={set("detenteur")} autoFocus placeholder="Nom et prénom" /></Field>
          <Field label="Téléphone"><Input value={v.telephone || ""} onChange={set("telephone")} placeholder="77 000 00 00" /></Field>
          <Field label="Vendeur"><Input list="evt-vendeurs2" value={v.vendeur || ""} onChange={set("vendeur")} /><datalist id="evt-vendeurs2">{vendeurs.map((x) => <option key={x} value={x} />)}</datalist></Field>
          <Field label="Statut"><Select value={v.statut} onChange={set("statut")}>{Object.entries(STATUTS_CARTE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Montant de la carte"><Money value={v.montant} onChange={(x) => setV({ ...v, montant: x })} /></Field>
          <Field label="Argent reçu" hint="Peut dépasser le montant (don généreux)"><Money value={v.paye} onChange={(x) => setV({ ...v, paye: x })} /></Field>
          <Field label="Date de vente"><Input type="date" value={v.date_vente} onChange={set("date_vente")} max={today()} /></Field>
          <Field label="Catégorie"><Input value={v.categorie || ""} onChange={set("categorie")} /></Field>
        </div>
        <Field label="Remarque"><Input value={v.note || ""} onChange={set("note")} /></Field>
      </div>
    </Modal>
  );
}

// ── Invités ──
function OngletInvites({ e, peut, onChange }) {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [imp, setImp] = useState(false);
  const [del, setDel] = useState(null);
  const [f, setF] = useState({ q: "", statut: "", categorie: "" });
  const q = f.q.trim().toLowerCase();
  const rows = e.invites.filter((i) => (!f.statut || i.statut === f.statut) && (!f.categorie || i.categorie === f.categorie)
    && (!q || `${i.nom} ${i.qualite || ""} ${i.organisation || ""}`.toLowerCase().includes(q)));
  const maj = async (i, d) => { try { await api.put(`/evt/invites/${i.id}`, d); onChange(); } catch (x) { toast(x.message, "error"); } };
  const supprimer = async () => { try { await api.del(`/evt/invites/${del.id}`); toast("Invité retiré"); onChange(); } catch (x) { toast(x.message, "error"); } setDel(null); };
  return (
    <div className="card">
      <div className="toolbar">
        <div className="with-icon" style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} /><Input value={f.q} onChange={(x) => setF({ ...f, q: x.target.value })} placeholder="Rechercher un invité" style={{ paddingLeft: 36 }} /></div>
        <Select value={f.statut} onChange={(x) => setF({ ...f, statut: x.target.value })}><option value="">Tous</option>{Object.entries(STATUTS_INVITE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <Select value={f.categorie} onChange={(x) => setF({ ...f, categorie: x.target.value })}><option value="">Toutes catégories</option>{Object.entries(CATEGORIES_INVITE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <span className="spacer" />
        {peut && <button className="btn" onClick={() => setImp(true)}><Upload size={16} />Coller une liste</button>}
        {peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Ajouter un invité</button>}
        {e.invites.length > 0 && <button className="btn" onClick={() => nav(`/evenements/${e.id}/imprimer?doc=invitations`)}><Printer size={16} />Invitations</button>}
      </div>
      {!e.invites.length ? <Empty icon={Users} title="Aucun invité" action={peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Ajouter un invité</button>}>Ajoutez les autorités, partenaires, anciens élèves, parents… Chaque invité a son invitation nominative à imprimer ou à envoyer par WhatsApp.</Empty> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>N°</th><th>Invité</th><th className="hide-m">Catégorie</th><th className="r hide-m">Places</th><th className="hide-m">Table</th><th>Statut</th><th>Présent</th><th /></tr></thead>
          <tbody>{rows.map((i) => (
            <tr key={i.id}>
              <td className="num muted">{String(i.id).padStart(3, "0")}</td>
              <td><strong>{nomInvite(i)}</strong>{(i.qualite || i.organisation) && <div className="xs muted">{[i.qualite, i.organisation].filter(Boolean).join(" · ")}</div>}{i.telephone && <div className="xs muted">{i.telephone}</div>}</td>
              <td className="hide-m">{CATEGORIES_INVITE[i.categorie] || i.categorie}</td>
              <td className="r hide-m">{i.places}</td>
              <td className="hide-m">{i.table_no || "—"}</td>
              <td>{peut ? <Select className="sm" value={i.statut} onChange={(x) => maj(i, { statut: x.target.value })}>{Object.entries(STATUTS_INVITE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select> : <span className={`badge ${COULEUR_INVITE[i.statut]}`}>{STATUTS_INVITE[i.statut]}</span>}</td>
              <td><label className="check"><input type="checkbox" checked={i.present} disabled={!peut} onChange={(x) => maj(i, { present: x.target.checked })} /></label></td>
              <td className="r" style={{ whiteSpace: "nowrap" }}>
                {i.telephone && <a className="btn sm ghost icon" href={`https://wa.me/${telWa(i.telephone)}?text=${encodeURIComponent(messageInvitation(i, e, s.etablissement))}`} target="_blank" rel="noreferrer" aria-label="Inviter par WhatsApp" onClick={() => i.statut === "a_inviter" && peut && maj(i, { statut: "invite" })}><MessageCircle size={15} /></a>}
                <button className="btn sm ghost icon" onClick={() => nav(`/evenements/${e.id}/imprimer?doc=invitations&invite=${i.id}`)} aria-label="Imprimer l'invitation"><Mail size={15} /></button>
                {peut && <button className="btn sm ghost icon" onClick={() => setEdit(i)} aria-label="Modifier"><Pencil size={15} /></button>}
                {peut && <button className="btn sm ghost icon" onClick={() => setDel(i)} aria-label="Retirer"><Trash2 size={15} /></button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {edit && <InviteModal e={e} i={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDone={onChange} />}
      {imp && <ImportInvites e={e} onClose={() => setImp(false)} onDone={onChange} />}
      {del && <Confirm danger title="Retirer cet invité ?" confirmLabel="Retirer" message={nomInvite(del)} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </div>
  );
}

function InviteModal({ e, i, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState(i || { civilite: "M.", nom: "", qualite: "", organisation: "", telephone: "", categorie: "invite", places: 1, table_no: "", statut: "a_inviter", note: "" });
  const [error, setError] = useState(null);
  const set = (k) => (x) => setV({ ...v, [k]: x.target.value });
  const save = async () => {
    setError(null);
    try {
      const d = { civilite: v.civilite, nom: v.nom, qualite: v.qualite, organisation: v.organisation, telephone: v.telephone, categorie: v.categorie, places: Number(v.places) || 1, table_no: v.table_no, statut: v.statut, note: v.note };
      if (i) await api.put(`/evt/invites/${i.id}`, d); else await api.post(`/evenements/${e.id}/invites`, d);
      toast(i ? "Invité modifié" : `${v.nom} ajouté(e)`); onDone(); onClose();
    } catch (x) { setError(x); }
  };
  return (
    <Modal title={i ? "Modifier l'invité" : "Ajouter un invité"} icon={<MIco I={Users} />} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={save} disabled={!v.nom}>Enregistrer</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <div className="grid" style={{ gridTemplateColumns: "110px 1fr" }}>
          <Field label="Civilité"><Input list="evt-civ" value={v.civilite || ""} onChange={set("civilite")} /><datalist id="evt-civ">{CIVILITES.map((c) => <option key={c} value={c} />)}</datalist></Field>
          <Field label="Prénom et nom" required><Input value={v.nom} onChange={set("nom")} autoFocus /></Field>
        </div>
        <div className="grid g2">
          <Field label="Qualité / fonction"><Input value={v.qualite || ""} onChange={set("qualite")} placeholder="Maire de Malika" /></Field>
          <Field label="Structure"><Input value={v.organisation || ""} onChange={set("organisation")} placeholder="Mairie, IEF, entreprise…" /></Field>
          <Field label="Téléphone (WhatsApp)"><Input value={v.telephone || ""} onChange={set("telephone")} /></Field>
          <Field label="Catégorie"><Select value={v.categorie} onChange={set("categorie")}>{Object.entries(CATEGORIES_INVITE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Nombre de places"><Input type="number" min={1} max={20} value={v.places} onChange={set("places")} /></Field>
          <Field label="Table"><Input value={v.table_no || ""} onChange={set("table_no")} placeholder="Table d'honneur, 3…" /></Field>
          <Field label="Statut"><Select value={v.statut} onChange={set("statut")}>{Object.entries(STATUTS_INVITE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Remarque"><Input value={v.note || ""} onChange={set("note")} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function ImportInvites({ e, onClose, onDone }) {
  const toast = useToast();
  const [txt, setTxt] = useState("");
  const [cat, setCat] = useState("invite");
  const [busy, setBusy] = useState(false);
  const lignes = txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [a, qualite, telephone] = l.split(/[;\t]/).map((x) => x?.trim());
    const m = a.match(new RegExp(`^(${CIVILITES.map((c) => c.replace(".", "\\.")).join("|")})\\s+(.*)$`, "i"));
    return { civilite: m ? m[1] : "", nom: m ? m[2] : a, qualite: qualite || "", telephone: telephone || "", categorie: cat };
  }).filter((x) => x.nom);
  const go = async () => {
    setBusy(true);
    let n = 0;
    try { for (const l of lignes) { await api.post(`/evenements/${e.id}/invites`, l); n++; } toast(`${n} invités ajoutés`); onDone(); onClose(); }
    catch (x) { toast(`${n} ajoutés, puis : ${x.message}`, "error"); onDone(); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Coller une liste d'invités" icon={<MIco I={Upload} />} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={go} disabled={!lignes.length || busy}>Ajouter {lignes.length || ""} invité{lignes.length > 1 ? "s" : ""}</button></>}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="small muted">Une personne par ligne. Facultatif : qualité et téléphone séparés par « ; ». Exemple :<br /><code>M. Abdoulaye Diallo ; Maire de Malika ; 77 123 45 67</code></p>
        <Textarea rows={9} value={txt} onChange={(x) => setTxt(x.target.value)} placeholder={"Mme Fatou Sow ; Inspectrice de l'IEF\nM. Moussa Ndiaye ; Parent d'élève ; 78 000 00 00"} />
        <Field label="Catégorie pour toute la liste"><Select value={cat} onChange={(x) => setCat(x.target.value)}>{Object.entries(CATEGORIES_INVITE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}

// ── Budget ──
function OngletBudget({ e, peut, onChange }) {
  const nav = useNavigate();
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const reel = e.budget.filter((b) => !b.prevu), prevu = e.budget.filter((b) => b.prevu);
  const supprimer = async () => { try { await api.del(`/evt/budget/${del.id}`); toast("Ligne supprimée"); onChange(); } catch (x) { toast(x.message, "error"); } setDel(null); };
  const Table = ({ rows, titre, vide }) => (
    <div className="card">
      <div className="card-head"><h3>{titre}</h3></div>
      {!rows.length ? <p className="muted small" style={{ padding: "12px 22px 20px" }}>{vide}</p> : <div className="table-wrap"><table className="table">
        <thead><tr><th>Date</th><th>Libellé</th><th className="hide-m">Poste</th><th className="r">Recette</th><th className="r">Dépense</th>{peut && <th />}</tr></thead>
        <tbody>{rows.map((b) => (
          <tr key={b.id}>
            <td className="num">{b.date_op ? date(b.date_op) : "—"}</td>
            <td><strong>{b.libelle}</strong>{b.note && <div className="xs muted">{b.note}</div>}</td>
            <td className="hide-m">{b.categorie || "—"}</td>
            <td className="r amount" style={{ color: "var(--green)" }}>{b.sens === "recette" ? fcfa(b.montant) : ""}</td>
            <td className="r amount" style={{ color: "var(--coral)" }}>{b.sens === "depense" ? fcfa(b.montant) : ""}</td>
            {peut && <td className="r" style={{ whiteSpace: "nowrap" }}><button className="btn sm ghost icon" onClick={() => setEdit(b)} aria-label="Modifier"><Pencil size={15} /></button><button className="btn sm ghost icon" onClick={() => setDel(b)} aria-label="Supprimer"><Trash2 size={15} /></button></td>}
          </tr>
        ))}</tbody>
      </table></div>}
    </div>
  );
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {peut && <button className="btn primary" onClick={() => setEdit({ sens: "depense", prevu: false })}><Plus size={16} />Dépense</button>}
        {peut && <button className="btn" onClick={() => setEdit({ sens: "recette", prevu: false })}><Plus size={16} />Recette (don, sponsor…)</button>}
        {peut && <button className="btn" onClick={() => setEdit({ sens: "depense", prevu: true })}><Plus size={16} />Prévision</button>}
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => nav(`/evenements/${e.id}/imprimer?doc=bilan`)}><BarChart3 size={16} />Bilan à imprimer</button>
      </div>
      <p className="small muted">L'argent des cartes de soutien ({fcfa(e.cartes_encaisse)}) est compté automatiquement : inutile de le saisir ici.</p>
      <Table rows={reel} titre="Recettes et dépenses réelles" vide="Aucune opération pour l'instant." />
      <Table rows={prevu} titre="Budget prévisionnel" vide="Notez ici ce que vous prévoyez de dépenser (devis, estimations) pour préparer l'événement." />
      {edit && <BudgetModal e={e} b={edit} onClose={() => setEdit(null)} onDone={onChange} />}
      {del && <Confirm danger title="Supprimer cette ligne ?" confirmLabel="Supprimer" message={`${del.libelle} — ${fcfa(del.montant)}`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </div>
  );
}

function BudgetModal({ e, b, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ sens: "depense", prevu: false, categorie: "", libelle: "", montant: null, note: "", ...b, date_op: b.date_op?.slice(0, 10) || today() });
  const [error, setError] = useState(null);
  const set = (k) => (x) => setV({ ...v, [k]: x.target.value });
  const save = async () => {
    setError(null);
    try {
      const d = { sens: v.sens, prevu: !!v.prevu, categorie: v.categorie, libelle: v.libelle, montant: v.montant || 0, date_op: v.date_op || null, note: v.note };
      if (b.id) await api.put(`/evt/budget/${b.id}`, d); else await api.post(`/evenements/${e.id}/budget`, d);
      toast("Enregistré"); onDone(); onClose();
    } catch (x) { setError(x); }
  };
  return (
    <Modal title={b.id ? "Modifier" : v.prevu ? "Prévision de dépense" : v.sens === "recette" ? "Nouvelle recette" : "Nouvelle dépense"} icon={<MIco I={Wallet} />} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={save} disabled={!v.libelle || !v.montant}>Enregistrer</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <div className="seg full" role="radiogroup">
          <button type="button" className={v.sens === "depense" ? "on" : ""} onClick={() => setV({ ...v, sens: "depense" })}>Dépense</button>
          <button type="button" className={v.sens === "recette" ? "on" : ""} onClick={() => setV({ ...v, sens: "recette" })}>Recette</button>
        </div>
        <Field label="Libellé" required><Input value={v.libelle} onChange={set("libelle")} autoFocus placeholder={v.sens === "recette" ? "Don de l'entreprise X" : "Location de la sonorisation"} /></Field>
        <div className="grid g2">
          <Field label="Montant" required><Money value={v.montant} onChange={(x) => setV({ ...v, montant: x })} /></Field>
          <Field label="Date"><Input type="date" value={v.date_op} onChange={set("date_op")} /></Field>
          <Field label="Poste"><Input list="evt-postes" value={v.categorie || ""} onChange={set("categorie")} /><datalist id="evt-postes">{POSTES_BUDGET.map((p) => <option key={p} value={p} />)}</datalist></Field>
          <Field label="Type"><label className="check" style={{ height: 42 }}><input type="checkbox" checked={!!v.prevu} onChange={(x) => setV({ ...v, prevu: x.target.checked })} />Prévision (pas encore payé)</label></Field>
        </div>
        <Field label="Remarque"><Input value={v.note || ""} onChange={set("note")} /></Field>
      </div>
    </Modal>
  );
}

// ── Tâches du comité ──
function OngletTaches({ e, peut, onChange }) {
  const toast = useToast();
  const [v, setV] = useState({ libelle: "", responsable: "", echeance: "" });
  const ajouter = async () => {
    try { await api.post(`/evenements/${e.id}/taches`, { ...v, echeance: v.echeance || null }); setV({ libelle: "", responsable: v.responsable, echeance: "" }); onChange(); }
    catch (x) { toast(x.message, "error"); }
  };
  const maj = async (t, d) => { try { await api.put(`/evt/taches/${t.id}`, d); onChange(); } catch (x) { toast(x.message, "error"); } };
  const suppr = async (t) => { try { await api.del(`/evt/taches/${t.id}`); onChange(); } catch (x) { toast(x.message, "error"); } };
  const auj = today();
  return (
    <div className="card">
      <div className="card-head"><h3>Tâches du comité d'organisation</h3><span className="small muted">{e.taches_faites} / {e.taches_total} faites</span></div>
      <div className="card-body">
        {peut && <div className="evt-tache-ajout">
          <Input value={v.libelle} onChange={(x) => setV({ ...v, libelle: x.target.value })} placeholder="Ex. Réserver la sonorisation" onKeyDown={(x) => x.key === "Enter" && v.libelle && ajouter()} />
          <Input value={v.responsable} onChange={(x) => setV({ ...v, responsable: x.target.value })} placeholder="Responsable" />
          <Input type="date" value={v.echeance} onChange={(x) => setV({ ...v, echeance: x.target.value })} />
          <button className="btn primary" onClick={ajouter} disabled={!v.libelle}><Plus size={16} />Ajouter</button>
        </div>}
        {!e.taches.length ? <p className="muted small">Listez ce qu'il reste à faire : salle, sono, décoration, traiteur, invitations, répétitions… et qui s'en occupe.</p> : (
          <ul className="evt-taches">{e.taches.map((t) => (
            <li key={t.id} className={t.fait ? "fait" : ""}>
              <label className="check"><input type="checkbox" checked={t.fait} disabled={!peut} onChange={(x) => maj(t, { fait: x.target.checked })} /><span>{t.libelle}</span></label>
              <span className="xs muted">{t.responsable}</span>
              <span className={`xs ${!t.fait && t.echeance && t.echeance.slice(0, 10) < auj ? "en-retard" : "muted"}`}>{t.echeance ? date(t.echeance) : ""}</span>
              {peut && <button className="btn sm ghost icon" onClick={() => suppr(t)} aria-label="Supprimer"><Trash2 size={14} /></button>}
            </li>
          ))}</ul>
        )}
      </div>
    </div>
  );
}

// ── Supports à imprimer ──
function OngletSupports({ e }) {
  const nav = useNavigate();
  const go = (doc, extra = "") => nav(`/evenements/${e.id}/imprimer?doc=${doc}${extra}`);
  const T = ({ I, t, sub, onClick, children }) => (
    <div className="card evt-support">
      <button className="evt-support-main" onClick={onClick}><span className="ic"><I size={22} /></span><div><strong>{t}</strong><span>{sub}</span></div></button>
      {children && <div className="evt-support-opts">{children}</div>}
    </div>
  );
  return (
    <div className="evt-supports">
      <T I={Image} t="Affiche A4" sub="À coller à l'école, dans le quartier, à partager" onClick={() => go("affiche")} />
      <T I={Image} t="Flyer A5" sub="À distribuer aux parents et aux élèves" onClick={() => go("flyer")} />
      <T I={Mail} t="Invitations" sub={e.invites.length ? `${e.invites.length} invitations nominatives` : "Ajoutez des invités, ou imprimez des invitations vierges"} onClick={() => go("invitations")}>
        <button className="btn sm" onClick={() => go("invitations", "&vierge=10")}>10 invitations vierges</button>
      </T>
      <T I={Ticket} t="Cartes de soutien" sub={e.cartes.length ? `${e.cartes.length} cartes numérotées avec souche, 4 par page` : "Créez d'abord une série dans l'onglet Cartes"} onClick={() => go("cartes")} />
      <T I={ClipboardList} t="Programme" sub="Le déroulé de l'événement" onClick={() => go("programme")} />
      <T I={BadgeCheck} t="Badges" sub="Organisation, invités, presse : 8 par page" onClick={() => go("badges")}>
        {e.invites.length > 0 && <button className="btn sm" onClick={() => go("badges", "&mode=invites")}>Badges des invités</button>}
      </T>
      <T I={Users} t="Liste d'émargement" sub="Pour accueillir les invités le jour J" onClick={() => go("emargement")} />
      <T I={Layers} t="Suivi des cartes par vendeur" sub="Qui a reçu quels numéros, et l'argent remis" onClick={() => go("suivi")} />
      <T I={BarChart3} t="Bilan de l'événement" sub="Cartes, recettes, dépenses et solde" onClick={() => go("bilan")} />
    </div>
  );
}
