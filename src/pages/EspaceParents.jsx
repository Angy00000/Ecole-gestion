import { useEffect, useState } from "react";
import { Wallet, BookOpen, CalendarCheck, CalendarClock, Info, LogOut, Plus, Phone, MessageCircle, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { fcfa, date, moisLong, libelleLigne, MODES } from "../lib/format";
import { TableEdt } from "./Emploi";

// Espace parents : accès avec le matricule de l'élève et le code parent remis par l'école.
// Indépendant des comptes du personnel : jeton à part, gardé sur le téléphone du parent.
const BASE = /^https?:$/.test(location.protocol) ? "/api/v2" : "https://ecole-gestion-eta.vercel.app/api/v2";
const CLE = "eg2_parents";
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || "[]"); } catch { return []; } };
const ecrire = (l) => { try { localStorage.setItem(CLE, JSON.stringify(l)); } catch { /* */ } };
async function appel(method, path, body, token) {
  let res;
  try {
    res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw Object.assign(new Error("Pas de connexion internet."), { status: 0 }); }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(d.error || `Erreur ${res.status}`), { status: res.status });
  return d;
}
const TEINTES = ["#1f7a8c", "#d9a21f", "#e0673f", "#3b82c4", "#d9577f", "#22976b", "#8b6fd6", "#5a8f9c"];

function Connexion({ onOk, onAnnuler }) {
  const [m, setM] = useState(""), [c, setC] = useState(""), [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await appel("POST", "/parents/connexion", { matricule: m, code: c }); onOk(r); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form className="par-login card" onSubmit={go}>
      <img src="/logo.png" alt="" />
      <h1>Espace parents</h1>
      <p className="muted small">École Saint Jean Baptiste de Malika — suivez la scolarité de votre enfant : paiements, notes, absences, emploi du temps.</p>
      <label className="field"><span>Matricule de l'élève</span><input className="input" value={m} onChange={(e) => setM(e.target.value)} placeholder="ex. 2026-045" autoComplete="username" required /></label>
      <label className="field"><span>Code parent</span><input className="input" value={c} onChange={(e) => setC(e.target.value.toUpperCase())} placeholder="6 lettres et chiffres" autoComplete="current-password" required style={{ letterSpacing: ".2em", fontWeight: 800 }} /></label>
      {err && <p className="par-err">{err}</p>}
      <button className="btn primary" disabled={busy}><Lock size={16} />{busy ? "Connexion…" : "Voir mon enfant"}</button>
      <p className="xs muted">Le matricule et le code sont sur la <strong>carte d'accès parent</strong> remise par l'école. Vous ne l'avez pas ? Demandez-la au secrétariat.</p>
      {onAnnuler && <button type="button" className="btn ghost" onClick={onAnnuler}>Annuler</button>}
    </form>
  );
}

function Paiements({ d }) {
  const s = d.situation, [voirRecus, setVoir] = useState(false);
  const lignes = (s?.lignes || []).filter((l) => l.du > 0 || l.paye > 0);
  const frais = lignes.filter((l) => l.groupe === "frais"), mois = lignes.filter((l) => l.groupe === "mois");
  const ceMois = new Date().toISOString().slice(0, 7);
  const etat = (l) => l.paye >= l.du ? ["Payé", "green"] : l.paye > 0 ? ["Partiel", "gold"] : (l.mois || "") <= ceMois ? ["À payer", "coral"] : ["À venir", ""];
  return (
    <>
      <div className="par-kpis">
        <div className="card"><span>Déjà payé</span><strong className="green">{fcfa(s?.total_paye)}</strong></div>
        <div className="card"><span>En retard aujourd'hui</span><strong className={s?.reste_echu ? "coral" : "green"}>{fcfa(s?.reste_echu)}</strong></div>
        <div className="card"><span>Reste sur l'année</span><strong>{fcfa(s?.reste_annee)}</strong></div>
      </div>
      {frais.length > 0 && <div className="card par-bloc"><h3>Frais</h3>{frais.map((l, i) => { const [t, c] = etat(l); return (
        <div key={i} className="par-ligne"><span className="grow">{libelleLigne(l)}<small>{fcfa(l.paye)} payé sur {fcfa(l.du)}</small></span><span className={`badge ${c}`}>{t}</span></div>); })}</div>}
      <div className="card par-bloc"><h3>Mensualités</h3>
        <div className="par-mois">{mois.map((l) => { const [t, c] = etat(l); return (
          <div key={l.mois} className={`par-m ${c}`}><strong>{moisLong(l.mois)}</strong><span>{fcfa(l.du)}</span><em className={`badge ${c}`}>{t}</em>{l.paye > 0 && l.paye < l.du && <small>reste {fcfa(l.du - l.paye)}</small>}</div>); })}</div>
      </div>
      <div className="card par-bloc">
        <button className="par-toggle" onClick={() => setVoir(!voirRecus)}><h3>Reçus ({d.recus.length})</h3>{voirRecus ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
        {voirRecus && d.recus.map((r) => (
          <div key={r.id} className="par-ligne"><span className="grow"><strong>N° {r.numero}</strong> · {date(r.date_paiement)} · {MODES[r.mode] || r.mode}
            <small>{(r.lignes || []).map((l) => libelleLigne(l)).join(", ")}</small></span><strong>{fcfa(r.montant)}</strong></div>
        ))}
      </div>
    </>
  );
}

function Notes({ d }) {
  const [tri, setTri] = useState(d.bulletins.length ? d.bulletins[d.bulletins.length - 1].trimestre : 1);
  const b = d.bulletins.find((x) => x.trimestre === tri);
  const notes = d.notes.filter((n) => n.trimestre === tri && (n.note != null || n.absent));
  return (
    <>
      <div className="seg" style={{ marginBottom: 12 }}>{[1, 2, 3].map((t) => <button key={t} className={tri === t ? "on" : ""} onClick={() => setTri(t)}>{t === 1 ? "1er" : `${t}e`} trimestre</button>)}</div>
      {b ? (
        <div className="card par-bloc">
          <div className="par-moy"><div><span>Moyenne</span><strong>{b.moyenne != null ? b.moyenne.toFixed(2) : "—"}<small> / {b.bareme}</small></strong></div>
            <div><span>Rang</span><strong>{b.rang || "—"}<small> / {b.effectif}</small></strong></div>
            <div><span>Moyenne de la classe</span><strong>{b.moyenne_classe != null ? b.moyenne_classe.toFixed(2) : "—"}</strong></div></div>
          {b.mention && <p className="par-mention">{b.mention}</p>}
          <table className="table par-table"><thead><tr><th>Matière</th><th className="r">Moyenne</th></tr></thead>
            <tbody>{b.lignes.filter((l) => l.moyenne != null).map((l) => <tr key={l.matiere_id}><td>{l.matiere}</td><td className="r num">{l.moyenne.toFixed(2)} / {l.bareme}</td></tr>)}</tbody></table>
          {b.observation && <p className="par-obs"><strong>Appréciation du maître :</strong> {b.observation}</p>}
        </div>
      ) : <p className="muted small" style={{ margin: "8px 0 14px" }}>Pas encore de moyenne pour ce trimestre.</p>}
      <div className="card par-bloc"><h3>Notes des devoirs et compositions</h3>
        {!notes.length ? <p className="muted small">Aucune note pour le moment.</p> : notes.map((n) => (
          <div key={n.id} className="par-ligne"><span className="grow">{n.matiere}<small>{n.libelle || (n.type === "composition" ? "Composition" : "Devoir")}{n.date ? ` · ${date(n.date)}` : ""}</small></span>
            <strong>{n.absent ? <span className="badge coral">Absent</span> : `${Number(n.note)} / ${n.bareme}`}</strong></div>
        ))}
      </div>
    </>
  );
}

function Absences({ d }) {
  const abs = d.absences.filter((a) => a.type === "absence"), ret = d.absences.filter((a) => a.type === "retard");
  return (
    <>
      <div className="par-kpis">
        <div className="card"><span>Absences</span><strong className={abs.length ? "coral" : "green"}>{abs.length}</strong></div>
        <div className="card"><span>dont justifiées</span><strong>{abs.filter((a) => a.justifiee).length}</strong></div>
        <div className="card"><span>Retards</span><strong className={ret.length ? "gold" : "green"}>{ret.length}</strong></div>
      </div>
      <div className="card par-bloc">{!d.absences.length ? <p className="muted small">Aucune absence ni retard. Bravo !</p> : d.absences.map((a, i) => (
        <div key={i} className="par-ligne"><span className="grow">{date(a.date)} — {a.type === "retard" ? "Retard" : "Absence"}{a.moment ? ` (${a.moment})` : ""}<small>{a.motif || ""}</small></span>
          <span className={`badge ${a.justifiee ? "green" : "coral"}`}>{a.justifiee ? "Justifiée" : "Non justifiée"}</span></div>
      ))}</div>
    </>
  );
}

function Emploi({ d }) {
  const coul = {}; d.emploi.forEach((x) => { const k = x.matiere || x.libelle; if (!(k in coul)) coul[k] = TEINTES[Object.keys(coul).length % TEINTES.length]; });
  return d.emploi.length ? <div className="card edt-card par-edt"><TableEdt data={d.emploi.map((x, i) => ({ ...x, id: i }))} couleurs={coul} peut={false} onEdit={() => {}} /></div>
    : <p className="muted small">L'emploi du temps n'est pas encore disponible.</p>;
}

function Infos({ d }) {
  const tel = (d.etablissement?.telephones || "").split("/")[0].trim();
  const wa = tel.replace(/\D/g, "");
  return (
    <>
      <div className="card par-bloc"><h3>Contacter l'école</h3>
        <p className="small">{d.etablissement?.nom}<br />{d.etablissement?.adresse}</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {tel && <a className="btn" href={`tel:${tel.replace(/\s/g, "")}`}><Phone size={16} />Appeler</a>}
          {wa && <a className="btn wa" href={`https://wa.me/${wa.length === 9 ? "221" + wa : wa}`} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a>}
        </div>
      </div>
      {d.fournitures?.length > 0 && <div className="card par-bloc"><h3>Fournitures de la classe ({d.inscription.classe})</h3>
        {d.fournitures.map((f, i) => <div key={i} className="par-ligne"><span className="grow">{f.libelle}{f.remarque && <small>{f.remarque}</small>}</span><strong>× {f.quantite}</strong></div>)}
        <p className="xs muted" style={{ marginTop: 8 }}>Toutes les fournitures sont disponibles à l'école.</p>
      </div>}
    </>
  );
}

const ONGLETS = [["paiements", "Paiements", Wallet, Paiements], ["notes", "Notes", BookOpen, Notes], ["absences", "Absences", CalendarCheck, Absences], ["emploi", "Emploi du temps", CalendarClock, Emploi], ["infos", "Infos", Info, Infos]];

export default function EspaceParents() {
  const [comptes, setComptes] = useState(lire);
  const [actif, setActif] = useState(0);
  const [ajout, setAjout] = useState(false);
  const [onglet, setOnglet] = useState("paiements");
  const [d, setD] = useState(null), [err, setErr] = useState(null);
  const c = comptes[actif];
  useEffect(() => { document.title = "Espace parents — ESJBM"; }, []);
  useEffect(() => {
    if (!c) return;
    let vivant = true; setD(null); setErr(null);
    const cache = (() => { try { return JSON.parse(localStorage.getItem(`${CLE}_${c.eleve.id}`)); } catch { return null; } })();
    if (cache) setD(cache);
    appel("GET", "/parents/enfant", null, c.token).then((r) => { if (!vivant) return; setD(r); try { localStorage.setItem(`${CLE}_${c.eleve.id}`, JSON.stringify(r)); } catch { /* */ } })
      .catch((e) => { if (!vivant) return; if (e.status === 401) { const l = comptes.filter((_, i) => i !== actif); ecrire(l); setComptes(l); setActif(0); } else if (!cache) setErr(e.message); });
    return () => { vivant = false; };
  }, [c?.token]); // eslint-disable-line
  const ajouter = (r) => {
    const l = [...comptes.filter((x) => x.eleve.id !== r.eleve.id), { token: r.token, eleve: r.eleve }];
    ecrire(l); setComptes(l); setActif(l.length - 1); setAjout(false);
  };
  const sortir = () => {
    if (!window.confirm(`Retirer ${c.eleve.prenom} de cet appareil ?`)) return;
    try { localStorage.removeItem(`${CLE}_${c.eleve.id}`); } catch { /* */ }
    const l = comptes.filter((_, i) => i !== actif); ecrire(l); setComptes(l); setActif(0);
  };
  if (!comptes.length || ajout) return <div className="par-page"><Connexion onOk={ajouter} onAnnuler={comptes.length ? () => setAjout(false) : null} /></div>;
  const Vue = ONGLETS.find((x) => x[0] === onglet)[3];
  return (
    <div className="par-page">
      <header className="par-head">
        <img src="/logo.png" alt="" /><div className="grow"><strong>Espace parents</strong><span>École Saint Jean Baptiste de Malika</span></div>
        <button className="icon-btn" onClick={sortir} title="Retirer cet enfant de l'appareil" aria-label="Se déconnecter"><LogOut size={18} /></button>
      </header>
      <div className="par-enfants">
        {comptes.map((x, i) => <button key={x.eleve.id} className={`class-tab ${i === actif ? "on" : ""}`} onClick={() => setActif(i)}>{x.eleve.prenom}</button>)}
        <button className="class-tab" onClick={() => setAjout(true)}><Plus size={15} />Autre enfant</button>
      </div>
      {err ? <p className="par-err">{err}</p> : !d ? <p className="muted" style={{ padding: 20 }}>Chargement…</p> : !d.inscription ? (
        <div className="card par-bloc"><p>{d.eleve.prenom} {d.eleve.nom} n'est pas inscrit(e) pour l'année en cours. Contactez l'école.</p></div>
      ) : (
        <>
          <section className="card par-enfant">
            <span className={`avatar ${d.eleve.sexe || ""}`}>{d.eleve.prenom[0]}{d.eleve.nom[0]}</span>
            <div><h2>{d.eleve.prenom} {d.eleve.nom}</h2><span>{d.inscription.classe}{d.inscription.titulaire ? ` · Maître(sse) : ${d.inscription.titulaire}` : ""} · {d.inscription.annee}</span><small>Matricule {d.eleve.matricule}</small></div>
          </section>
          <nav className="par-onglets">{ONGLETS.map(([k, l, I]) => <button key={k} className={onglet === k ? "on" : ""} onClick={() => setOnglet(k)}><I size={18} /><span>{l}</span></button>)}</nav>
          <Vue d={d} />
        </>
      )}
    </div>
  );
}
