import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, CalendarDays, Clock, MapPin, Phone } from "lucide-react";
import QRCode from "qrcode";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/800.css";
import "@fontsource/great-vibes/400.css";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, telWa } from "../lib/format";
import { Spinner, ErrorBox, Select, Input } from "../components/ui";
import Partager from "../components/Partager";
import { TYPES_EVT, CATEGORIES_INVITE, STATUTS_INVITE, jourLong, nomInvite } from "../lib/evenements";

const num = (n) => String(n).padStart(4, "0");
const maj1 = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const DOCS = {
  affiche: ["Affiche A4", "A4"], flyer: ["Flyer A5", "A5"], invitations: ["Invitations", "A5"], cartes: ["Cartes de soutien", "A4"], programme: ["Programme", "A4"],
  badges: ["Badges", "A4"], emargement: ["Liste d'émargement", "A4"], suivi: ["Suivi des cartes par vendeur", "A4"], bilan: ["Bilan de l'événement", "A4"],
};

/** « 20 ans » → { grand: "20", petit: "ans" } pour mettre le nombre en valeur. */
const decouper = (acc) => { const m = String(acc || "").trim().match(/^(\d{1,3})\s*(.*)$/); return m ? { grand: m[1], petit: m[2] } : null; };

function useQr(texte) {
  const [src, setSrc] = useState(null);
  useEffect(() => { if (!texte) return; QRCode.toDataURL(texte, { margin: 0, width: 240, errorCorrectionLevel: "M" }).then(setSrc).catch(() => setSrc(null)); }, [texte]);
  return src;
}

const Ornement = () => <span className="ev-orn" aria-hidden="true"><i /><b>✦</b><i /></span>;

function Accroche({ e, taille = "xl" }) {
  const d = decouper(e.accroche);
  if (d) return <div className={`ev-acc ev-acc-${taille}`}><span className="ev-acc-num">{d.grand}</span>{d.petit && <span className="ev-acc-unit">{d.petit}</span>}</div>;
  return <div className={`ev-acc ev-acc-${taille} ev-acc-mot`}>{e.accroche || TYPES_EVT[e.type]}</div>;
}

function Infos({ e, compact }) {
  return (
    <div className={`ev-infos${compact ? " compact" : ""}`}>
      {e.date_evt && <div><CalendarDays size={compact ? 15 : 20} /><span>{maj1(jourLong(e.date_evt))}</span></div>}
      {e.heure && <div><Clock size={compact ? 15 : 20} /><span>{e.heure}</span></div>}
      {e.lieu && <div><MapPin size={compact ? 15 : 20} /><span>{e.lieu}</span></div>}
    </div>
  );
}

// ── Affiche (A4) et flyer (A5) ──
function Affiche({ e, etab, qr, a5 }) {
  const prog = (e.programme || []).slice(0, a5 ? 4 : 6);
  return (
    <article className={`${a5 ? "evt a5" : "doc a4 evt"} ev-affiche theme-${e.theme}`}>
      <div className="ev-fond" aria-hidden="true" />
      <div className="ev-cadre" aria-hidden="true" />
      <header className="ev-ecole">
        <span className="ev-logo"><img src="/logo.png" alt="" /></span>
        <div><strong>{etab.nom}</strong><span>{etab.adresse}</span></div>
      </header>
      <div className="ev-centre">
        <p className="ev-presente">{e.type === "anniversaire" ? "célèbre ses" : "vous invite"}</p>
        <Accroche e={e} taille={a5 ? "l" : "xl"} />
        {e.sous_titre && <p className="ev-sous"><Ornement />{e.sous_titre}<Ornement /></p>}
        <h1 className="ev-titre">{e.titre}</h1>
        {e.description && <p className="ev-desc">{e.description}</p>}
      </div>
      <Infos e={e} compact={a5} />
      {prog.length > 0 && (
        <div className="ev-prog-court">
          <h3>Au programme</h3>
          <ul>{prog.map((p, i) => <li key={i}>{p.heure && <b>{p.heure}</b>}<span>{p.titre}</span></li>)}</ul>
        </div>
      )}
      <footer className="ev-pied">
        <div>
          {e.slogan && <p className="ev-slogan">« {e.slogan} »</p>}
          {e.contact && <p className="ev-contact"><Phone size={a5 ? 13 : 16} /> Infos et cartes de soutien : <strong>{e.contact}</strong></p>}
        </div>
        {qr && <div className="ev-qr"><img src={qr} alt="" /><span>Scannez pour nous écrire</span></div>}
      </footer>
    </article>
  );
}

// ── Invitation (A5), nominative ou vierge ──
function Invitation({ e, etab, i }) {
  const d = decouper(e.accroche);
  return (
    <article className={`evt a5 ev-invit theme-${e.theme}`}>
      <div className="ev-invit-bord" aria-hidden="true"><i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" /></div>
      <header className="ev-invit-tete">
        <span className="ev-logo"><img src="/logo.png" alt="" /></span>
        <strong>{etab.nom}</strong>
      </header>
      <p className="ev-invit-intro">La Direction, le personnel et les élèves<br />ont l'honneur de vous inviter</p>
      <div className="ev-invit-nom">{i ? <>{nomInvite(i)}{i.qualite && <small>{i.qualite}{i.organisation ? ` — ${i.organisation}` : ""}</small>}</> : <span className="ev-ligne" />}</div>
      <p className="ev-invit-a">à la célébration de</p>
      <div className="ev-invit-evt">
        {d ? <div className="ev-invit-acc"><span>{d.grand}</span>{d.petit}</div> : <div className="ev-invit-acc mot">{e.accroche || TYPES_EVT[e.type]}</div>}
        <h1>{e.titre}</h1>
        {e.sous_titre && <p>{e.sous_titre}</p>}
      </div>
      <div className="ev-invit-quand">
        {e.date_evt && <p><strong>{maj1(jourLong(e.date_evt))}</strong>{e.heure ? ` à ${e.heure}` : ""}</p>}
        {e.lieu && <p>{e.lieu}</p>}
        {e.slogan && <p className="ev-invit-slogan">« {e.slogan} »</p>}
      </div>
      <footer className="ev-invit-pied">
        {e.contact && <p>Merci de confirmer votre présence au <strong>{e.contact}</strong></p>}
        <div className="ev-invit-ref">
          <span>Invitation n° {i ? String(i.id).padStart(3, "0") : "……"}</span>
          <span>{i ? `${i.places} personne${i.places > 1 ? "s" : ""}` : "…… personne(s)"}</span>
          {(i?.table_no || !i) && <span>Table {i?.table_no || "……"}</span>}
        </div>
      </footer>
    </article>
  );
}

// ── Cartes de soutien avec souche (4 par page A4) ──
function CarteSoutien({ c, e, etab }) {
  return (
    <div className={`ev-carte theme-${e.theme}`}>
      <div className="ev-souche">
        <div className="ev-souche-n">Souche<b>N° {num(c.numero)}</b></div>
        <p><span>Nom</span><em>{c.detenteur || ""}</em></p>
        <p><span>Tél.</span><em>{c.telephone || ""}</em></p>
        <p><span>Vendeur</span><em>{c.vendeur || ""}</em></p>
        <p><span>Date</span><em>{c.date_vente ? date(c.date_vente) : ""}</em></p>
        <div className="ev-souche-m">{fcfa(c.montant)}</div>
      </div>
      <div className="ev-carte-corps">
        <div className="ev-fond" aria-hidden="true" />
        <div className="ev-carte-g">
          <div className="ev-carte-tete"><span className="ev-logo sm"><img src="/logo.png" alt="" /></span><strong>{etab.nom}</strong></div>
          <div className="ev-carte-label">Carte de soutien{c.categorie && c.categorie !== "Soutien" ? ` · ${c.categorie}` : ""}</div>
          <div className="ev-carte-titre"><Accroche e={e} taille="s" /><span>{e.titre}</span></div>
          <div className="ev-carte-quand">{[e.date_evt && maj1(jourLong(e.date_evt)), e.heure, e.lieu].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="ev-carte-d">
          <div className="ev-carte-num">N° {num(c.numero)}</div>
          <div className="ev-carte-montant">{fcfa(c.montant)}</div>
          <div className="ev-carte-merci">Merci pour votre soutien !</div>
        </div>
      </div>
    </div>
  );
}

// ── Programme (A4) ──
function Programme({ e, etab }) {
  return (
    <article className={`doc a4 evt ev-programme theme-${e.theme}`}>
      <div className="ev-prog-bandeau">
        <div className="ev-fond" aria-hidden="true" />
        <header className="ev-ecole"><span className="ev-logo"><img src="/logo.png" alt="" /></span><div><strong>{etab.nom}</strong><span>{etab.adresse}</span></div></header>
        <Accroche e={e} taille="m" />
        <h1 className="ev-titre">{e.titre}</h1>
        <Infos e={e} compact />
      </div>
      <h2 className="ev-prog-h">Programme</h2>
      <ol className="ev-prog-liste">{(e.programme || []).map((p, i) => (
        <li key={i}><span className="ev-prog-heure">{p.heure || "—"}</span><div><strong>{p.titre}</strong>{p.detail && <p>{p.detail}</p>}</div></li>
      ))}</ol>
      {e.slogan && <p className="ev-prog-slogan">« {e.slogan} »</p>}
    </article>
  );
}

// ── Badges (8 par page) ──
function Badge({ e, etab, role, nom, sous }) {
  return (
    <div className={`ev-badge theme-${e.theme}`}>
      <div className="ev-badge-tete"><div className="ev-fond" aria-hidden="true" /><span className="ev-logo sm"><img src="/logo.png" alt="" /></span><div><strong>{e.accroche || TYPES_EVT[e.type]}</strong><span>{etab.nom}</span></div></div>
      <div className="ev-badge-role">{role}</div>
      <div className="ev-badge-nom">{nom || <span className="ev-ligne" />}</div>
      <div className="ev-badge-sous">{sous || " "}</div>
    </div>
  );
}

// ── Tableaux : émargement, suivi des vendeurs, bilan ──
function Entete({ e, etab, titre }) {
  return (
    <header className="ev-doc-tete">
      <span className="ev-logo sm"><img src="/logo.png" alt="" /></span>
      <div><strong>{etab.nom}</strong><span>{e.titre}{e.date_evt ? ` — ${jourLong(e.date_evt)}` : ""}</span></div>
      <h1>{titre}</h1>
    </header>
  );
}

function Emargement({ e, etab }) {
  const rows = [...e.invites].filter((i) => i.statut !== "excuse").sort((a, b) => (a.table_no || "zz").localeCompare(b.table_no || "zz", "fr", { numeric: true }) || a.nom.localeCompare(b.nom, "fr"));
  return (
    <article className="doc a4 etat evt-tab">
      <Entete e={e} etab={etab} titre="Liste d'émargement" />
      <table className="b-table d-list">
        <thead><tr><th>N°</th><th>Invité</th><th>Qualité</th><th>Places</th><th>Table</th><th style={{ width: "26%" }}>Arrivée / signature</th></tr></thead>
        <tbody>{rows.map((i) => <tr key={i.id}><td className="nw">{String(i.id).padStart(3, "0")}</td><td><strong>{nomInvite(i)}</strong></td><td>{[i.qualite, i.organisation].filter(Boolean).join(" — ")}</td><td>{i.places}</td><td className="nw">{i.table_no || ""}</td><td /></tr>)}
          {Array.from({ length: 8 }, (_, k) => <tr key={`v${k}`}><td>&nbsp;</td><td /><td /><td /><td /><td /></tr>)}</tbody>
      </table>
      <p className="ev-note">{rows.length} invités attendus · {rows.reduce((t, i) => t + i.places, 0)} places.</p>
    </article>
  );
}

const plages = (nums) => {
  const s = [...nums].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(i === j ? num(s[i]) : `${num(s[i])} à ${num(s[j])}`); i = j; }
  return out.join(", ");
};

function Suivi({ e, etab }) {
  const vendeurs = [...new Set(e.cartes.map((c) => c.vendeur || "— Non remises —"))].sort();
  let tv = 0, tp = 0;
  return (
    <article className="doc a4 etat evt-tab">
      <Entete e={e} etab={etab} titre="Suivi des cartes de soutien" />
      <table className="b-table d-list">
        <thead><tr><th>Vendeur</th><th>Numéros</th><th>Cartes</th><th>Vendues</th><th>Valeur vendue</th><th>Remis</th><th>Reste</th></tr></thead>
        <tbody>{vendeurs.map((v) => {
          const l = e.cartes.filter((c) => (c.vendeur || "— Non remises —") === v && c.statut !== "annulee");
          const vend = l.filter((c) => c.statut === "vendue"), val = vend.reduce((t, c) => t + c.montant, 0), paye = l.reduce((t, c) => t + c.paye, 0);
          tv += val; tp += paye;
          return <tr key={v}><td><strong>{v}</strong></td><td style={{ fontSize: 11 }}>{plages(l.map((c) => c.numero))}</td><td>{l.length}</td><td>{vend.length}</td><td className="nw">{fcfa(val)}</td><td className="nw">{fcfa(paye)}</td><td className="nw">{fcfa(Math.max(val - paye, 0))}</td></tr>;
        })}</tbody>
        <tfoot><tr><td colSpan={4}><strong>Total</strong></td><td className="nw"><strong>{fcfa(tv)}</strong></td><td className="nw"><strong>{fcfa(tp)}</strong></td><td className="nw"><strong>{fcfa(Math.max(tv - tp, 0))}</strong></td></tr></tfoot>
      </table>
      <div className="ev-signes"><div>Le trésorier</div><div>La Direction</div></div>
    </article>
  );
}

function Bilan({ e, etab }) {
  const cats = [...new Set(e.cartes.map((c) => c.categorie || "Cartes"))];
  const reel = e.budget.filter((b) => !b.prevu);
  const postes = (sens) => Object.entries(reel.filter((b) => b.sens === sens).reduce((m, b) => ({ ...m, [b.categorie || b.libelle]: (m[b.categorie || b.libelle] || 0) + b.montant }), {}));
  const recettes = Number(e.cartes_encaisse) + Number(e.recettes), depenses = Number(e.depenses);
  return (
    <article className="doc a4 etat evt-tab">
      <Entete e={e} etab={etab} titre="Bilan de l'événement" />
      <div className="ev-bilan-kpi">
        <div><span>Recettes</span><strong>{fcfa(recettes)}</strong></div>
        <div><span>Dépenses</span><strong>{fcfa(depenses)}</strong></div>
        <div className={recettes - depenses >= 0 ? "ok" : "ko"}><span>Solde</span><strong>{fcfa(recettes - depenses)}</strong></div>
        <div><span>Invités présents</span><strong>{e.invites.filter((i) => i.present).length} / {e.invites_total}</strong></div>
      </div>
      <h3 className="ev-h3">Cartes de soutien</h3>
      <table className="b-table d-list">
        <thead><tr><th>Catégorie</th><th>Prix</th><th>Imprimées</th><th>Vendues</th><th>Encaissé</th></tr></thead>
        <tbody>{cats.map((k) => { const l = e.cartes.filter((c) => (c.categorie || "Cartes") === k && c.statut !== "annulee"); return <tr key={k}><td><strong>{k}</strong></td><td className="nw">{fcfa(l[0]?.montant)}</td><td>{l.length}</td><td>{l.filter((c) => c.statut === "vendue").length}</td><td className="nw">{fcfa(l.reduce((t, c) => t + c.paye, 0))}</td></tr>; })}
          {!cats.length && <tr><td colSpan={5}>Aucune carte.</td></tr>}</tbody>
      </table>
      <div className="ev-bilan-2">
        <div><h3 className="ev-h3">Recettes</h3><table className="b-table d-list"><tbody>
          <tr><td>Cartes de soutien</td><td className="nw">{fcfa(e.cartes_encaisse)}</td></tr>
          {postes("recette").map(([k, v]) => <tr key={k}><td>{k}</td><td className="nw">{fcfa(v)}</td></tr>)}
          <tr><td><strong>Total</strong></td><td className="nw"><strong>{fcfa(recettes)}</strong></td></tr>
        </tbody></table></div>
        <div><h3 className="ev-h3">Dépenses</h3><table className="b-table d-list"><tbody>
          {postes("depense").map(([k, v]) => <tr key={k}><td>{k}</td><td className="nw">{fcfa(v)}</td></tr>)}
          {!postes("depense").length && <tr><td colSpan={2}>Aucune dépense.</td></tr>}
          <tr><td><strong>Total</strong></td><td className="nw"><strong>{fcfa(depenses)}</strong></td></tr>
        </tbody></table></div>
      </div>
      <p className="ev-note">Arrêté le {date(new Date().toISOString())}.</p>
      <div className="ev-signes"><div>Le trésorier</div><div>La Direction</div></div>
    </article>
  );
}

const ROLES_BADGE = ["Organisation", "Protocole", "Invité", "Presse", "Sécurité", "Bénévole"];

export default function EvenementSupports() {
  const { id } = useParams();
  const s = useSession();
  const nav = useNavigate();
  const [p, setP] = useSearchParams();
  const doc = DOCS[p.get("doc")] ? p.get("doc") : "affiche";
  const { data: e, isLoading, error } = useQuery({ queryKey: ["evenement", id], queryFn: () => api.get(`/evenements/${id}`) });
  const etab = s.etablissement || {};
  const tel = e?.contact || (etab.telephones || "").split("/")[0];
  const qr = useQr(e && (doc === "affiche" || doc === "flyer") && tel ? `https://wa.me/${telWa(tel)}?text=${encodeURIComponent(`Bonjour, je souhaite des informations sur « ${e.titre} ».`)}` : null);
  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 32 }}><ErrorBox error={error} /></div>;
  const [titre, format] = DOCS[doc];
  const maj = (k, v) => { const n = new URLSearchParams(p); if (v === "" || v == null) n.delete(k); else n.set(k, v); setP(n, { replace: true }); };
  let pages = null, options = null, nb = 1;

  if (doc === "affiche" || doc === "flyer") pages = <Affiche e={e} etab={etab} qr={qr} a5={doc === "flyer"} />;
  else if (doc === "programme") pages = <Programme e={e} etab={etab} />;
  else if (doc === "emargement") pages = <Emargement e={e} etab={etab} />;
  else if (doc === "suivi") pages = <Suivi e={e} etab={etab} />;
  else if (doc === "bilan") pages = <Bilan e={e} etab={etab} />;
  else if (doc === "invitations") {
    const vierge = Number(p.get("vierge")) || 0, seul = Number(p.get("invite")) || null, statut = p.get("statut") || "";
    const liste = vierge ? Array.from({ length: Math.min(vierge, 200) }, () => null) : e.invites.filter((i) => (!seul || i.id === seul) && (!statut || i.statut === statut) && i.statut !== "excuse");
    nb = liste.length;
    pages = liste.map((i, k) => <Invitation key={i?.id ?? `v${k}`} e={e} etab={etab} i={i} />);
    options = !seul && <>
      <Select value={vierge ? "vierge" : statut} onChange={(x) => { const v = x.target.value; const n = new URLSearchParams(p); n.delete("vierge"); n.delete("statut"); if (v === "vierge") n.set("vierge", "10"); else if (v) n.set("statut", v); setP(n, { replace: true }); }}>
        <option value="">Tous les invités</option>{Object.entries(STATUTS_INVITE).filter(([k]) => k !== "excuse").map(([k, l]) => <option key={k} value={k}>{l}</option>)}<option value="vierge">Invitations vierges</option>
      </Select>
      {vierge > 0 && <Input type="number" min={1} max={200} value={vierge} onChange={(x) => maj("vierge", x.target.value)} style={{ width: 80 }} aria-label="Nombre" />}
    </>;
  } else if (doc === "cartes") {
    const cat = p.get("categorie") || "", du = Number(p.get("du")) || 0, au = Number(p.get("au")) || 0, statut = p.get("statut") || "";
    const l = e.cartes.filter((c) => (!cat || c.categorie === cat) && (!du || c.numero >= du) && (!au || c.numero <= au) && (!statut || c.statut === statut) && c.statut !== "annulee");
    nb = l.length;
    const groupes = []; for (let k = 0; k < l.length; k += 4) groupes.push(l.slice(k, k + 4));
    pages = groupes.map((g, k) => <article key={k} className="doc a4 evt ev-cartes-page">{g.map((c) => <CarteSoutien key={c.id} c={c} e={e} etab={etab} />)}</article>);
    const cats = [...new Set(e.cartes.map((c) => c.categorie).filter(Boolean))];
    options = <>
      {cats.length > 1 && <Select value={cat} onChange={(x) => maj("categorie", x.target.value)}><option value="">Toutes les catégories</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>}
      <Input type="number" placeholder="Du n°" value={du || ""} onChange={(x) => maj("du", x.target.value)} style={{ width: 90 }} />
      <Input type="number" placeholder="Au n°" value={au || ""} onChange={(x) => maj("au", x.target.value)} style={{ width: 90 }} />
    </>;
  } else if (doc === "badges") {
    const mode = p.get("mode") || "", role = p.get("role") || "Organisation", n = Math.min(Number(p.get("n")) || 8, 200);
    const items = mode === "invites"
      ? e.invites.filter((i) => i.statut !== "excuse").map((i) => ({ k: i.id, role: CATEGORIES_INVITE[i.categorie] === "Personnel de l'école" ? "Personnel" : "Invité", nom: nomInvite(i), sous: i.qualite || i.organisation }))
      : Array.from({ length: n }, (_, k) => ({ k, role }));
    nb = items.length;
    const groupes = []; for (let k = 0; k < items.length; k += 8) groupes.push(items.slice(k, k + 8));
    pages = groupes.map((g, k) => <article key={k} className="doc a4 evt ev-badges-page"><div className="ev-badges-grille">{g.map((b) => <Badge key={b.k} e={e} etab={etab} role={b.role} nom={b.nom} sous={b.sous} />)}</div></article>);
    options = <>
      <Select value={mode} onChange={(x) => maj("mode", x.target.value)}><option value="">Badges vierges</option>{e.invites.length > 0 && <option value="invites">Au nom des invités</option>}</Select>
      {mode !== "invites" && <><Select value={role} onChange={(x) => maj("role", x.target.value)}>{ROLES_BADGE.map((r) => <option key={r}>{r}</option>)}</Select>
        <Input type="number" min={8} step={8} max={200} value={n} onChange={(x) => maj("n", x.target.value)} style={{ width: 80 }} aria-label="Nombre" /></>}
    </>;
  }

  return (
    <div className="print-page evt-print">
      <style>{`@page { size: ${format} portrait; margin: 0; }`}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(`/evenements/${id}`)}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{titre}</strong> — {e.titre}{["invitations", "cartes", "badges"].includes(doc) ? ` · ${nb}` : ""}</span>
        <Select value={doc} onChange={(x) => setP({ doc: x.target.value }, { replace: true })} aria-label="Support">{Object.entries(DOCS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select>
        {options}
        <Partager format={format} nom={`${titre}-${e.titre}`} message={`${titre} — ${e.titre}`} />
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      {doc === "cartes" && !nb ? <div className="alert" style={{ maxWidth: 900, margin: "0 auto" }}>Aucune carte : créez d'abord une série dans l'onglet « Cartes de soutien ».</div>
        : doc === "invitations" && !nb ? <div className="alert" style={{ maxWidth: 900, margin: "0 auto" }}>Aucun invité dans cette sélection. Choisissez « Invitations vierges » pour imprimer des invitations à remplir à la main.</div>
        : <div className="tickets">{pages}</div>}
    </div>
  );
}
