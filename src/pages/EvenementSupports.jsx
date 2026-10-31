import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, CalendarDays, Clock, MapPin, Phone, PenLine, RotateCcw, Check } from "lucide-react";
import QRCode from "qrcode";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/800.css";
import "@fontsource/great-vibes/400.css";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, telWa } from "../lib/format";
import { Spinner, ErrorBox, Select, Input, useToast } from "../components/ui";
import Partager from "../components/Partager";
import { TYPES_EVT, CATEGORIES_INVITE, STATUTS_INVITE, jourLong, nomInvite, styleTheme } from "../lib/evenements";

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

// ── Textes modifiables directement sur les supports ──────────────────────
// Mode « Modifier les textes » : on clique sur un texte, on le change, il est enregistré en quittant la zone.
const Edit = createContext({ e: {}, edit: false, save: () => {} });

/**
 * Un texte de support. `champ` = champ de l'événement (titre, lieu…) ; sinon `k` = texte libre du support,
 * avec `def` comme texte d'origine. `onSave` pour un enregistrement particulier (ligne du programme).
 */
function T({ k, champ, def = "", as: Tag = "span", className = "", multi, onSave, ph, valeur }) {
  const { e, edit, save } = useContext(Edit);
  const val = valeur !== undefined ? valeur : champ ? (e[champ] ?? "") : (e.textes?.[k] ?? def);
  if (!edit) return val ? <Tag className={className}>{val}</Tag> : null;
  return (
    <Tag className={`${className} ev-editable`} contentEditable suppressContentEditableWarning spellCheck={false} data-ph={ph || def || "…"}
      onKeyDown={(x) => { if (x.key === "Enter" && !multi) { x.preventDefault(); x.currentTarget.blur(); } }}
      onBlur={(x) => {
        const v = x.currentTarget.innerText.replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
        if (v === String(val ?? "")) return;
        if (onSave) onSave(v);
        else if (champ) save({ [champ]: v || null });
        else save({ textes: { ...(e.textes || {}), [k]: v } });
      }}>{val}</Tag>
  );
}

const Ornement = () => <span className="ev-orn" aria-hidden="true"><i /><b>✦</b><i /></span>;

function Accroche({ e, taille = "xl" }) {
  const { edit } = useContext(Edit);
  if (edit) return <T champ="accroche" as="div" className={`ev-acc ev-acc-${taille} ev-acc-mot`} ph="Accroche (ex. 20 ans)" />;
  const d = decouper(e.accroche);
  if (d) return <div className={`ev-acc ev-acc-${taille}`}><span className="ev-acc-num">{d.grand}</span>{d.petit && <span className="ev-acc-unit">{d.petit}</span>}</div>;
  return <div className={`ev-acc ev-acc-${taille} ev-acc-mot`}>{e.accroche || TYPES_EVT[e.type]}</div>;
}

function Ecole({ etab }) {
  return (
    <header className="ev-ecole">
      <span className="ev-logo"><img src="/logo.png" alt="" /></span>
      <div><T k="ecole_nom" def={etab.nom} as="strong" /><T k="ecole_adresse" def={etab.adresse} /></div>
    </header>
  );
}

function Infos({ e, compact }) {
  const { edit } = useContext(Edit);
  return (
    <div className={`ev-infos${compact ? " compact" : ""}`}>
      {e.date_evt && <div><CalendarDays size={compact ? 15 : 20} /><T k="date_texte" def={maj1(jourLong(e.date_evt))} /></div>}
      {(e.heure || edit) && <div><Clock size={compact ? 15 : 20} /><T champ="heure" ph="Heure" /></div>}
      {(e.lieu || edit) && <div><MapPin size={compact ? 15 : 20} /><T champ="lieu" ph="Lieu" /></div>}
    </div>
  );
}

function Photo({ e }) {
  return e.image ? <><img className="ev-photo" src={e.image} alt="" /><div className="ev-photo-voile" aria-hidden="true" /></> : null;
}

/** Une ligne du programme, modifiable sur place. */
function LigneProg({ e, i, p, save, heureClass, titreAs = "span", titreClass }) {
  const maj = (f) => (v) => save({ programme: e.programme.map((x, j) => (j === i ? { ...x, [f]: v } : x)) });
  return <>
    <T valeur={p.heure || ""} as="b" className={heureClass} onSave={maj("heure")} ph="Heure" />
    <T valeur={p.titre || ""} as={titreAs} className={titreClass} onSave={maj("titre")} ph="Moment" />
  </>;
}

// ── Affiche (A4) et flyer (A5) ──
function Affiche({ e, etab, qr, a5 }) {
  const { edit, save } = useContext(Edit);
  const prog = (e.programme || []).slice(0, a5 ? 4 : 6);
  return (
    <article className={`${a5 ? "evt a5" : "doc a4 evt"} ev-affiche theme-${e.theme}`} style={styleTheme(e)}>
      <div className="ev-fond" aria-hidden="true" />
      <Photo e={e} />
      <div className="ev-cadre" aria-hidden="true" />
      <Ecole etab={etab} />
      <div className="ev-centre">
        <T k="presente" def={e.type === "anniversaire" ? "célèbre ses" : "vous invite"} as="p" className="ev-presente" />
        <Accroche e={e} taille={a5 ? "l" : "xl"} />
        {(e.sous_titre || edit) && <p className="ev-sous"><Ornement /><T champ="sous_titre" ph="Sous-titre" /><Ornement /></p>}
        <T champ="titre" as="h1" className="ev-titre" />
        <T champ="description" as="p" className="ev-desc" multi ph="Message ou présentation (facultatif)" />
      </div>
      <Infos e={e} compact={a5} />
      {prog.length > 0 && (
        <div className="ev-prog-court">
          <T k="prog_titre" def="Au programme" as="h3" />
          <ul>{prog.map((p, i) => <li key={i}><LigneProg e={e} i={i} p={p} save={save} /></li>)}</ul>
        </div>
      )}
      <footer className="ev-pied">
        <div>
          {(e.slogan || edit) && <p className="ev-slogan">« <T champ="slogan" ph="Slogan" /> »</p>}
          {(e.contact || edit) && <p className="ev-contact"><Phone size={a5 ? 13 : 16} /> <T k="contact_label" def="Infos et cartes de soutien :" /> <T champ="contact" as="strong" ph="Téléphone" /></p>}
        </div>
        {qr && <div className="ev-qr"><img src={qr} alt="" /><T k="qr_label" def="Scannez pour nous écrire" /></div>}
      </footer>
    </article>
  );
}

// ── Invitation (A5), nominative ou vierge ──
function Invitation({ e, etab, i }) {
  const { edit } = useContext(Edit);
  const d = decouper(e.accroche);
  return (
    <article className={`evt a5 ev-invit theme-${e.theme}`} style={styleTheme(e)}>
      <div className="ev-invit-bord" aria-hidden="true"><i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" /></div>
      <header className="ev-invit-tete">
        <span className="ev-logo"><img src="/logo.png" alt="" /></span>
        <T k="ecole_nom" def={etab.nom} as="strong" />
      </header>
      <T k="invit_intro" def={"La Direction, le personnel et les élèves\nont l'honneur de vous inviter"} as="p" className="ev-invit-intro" multi />
      <div className="ev-invit-nom">{i ? <>{nomInvite(i)}{i.qualite && <small>{i.qualite}{i.organisation ? ` — ${i.organisation}` : ""}</small>}</> : <span className="ev-ligne" />}</div>
      <T k="invit_a" def="à la célébration de" as="p" className="ev-invit-a" />
      <div className="ev-invit-evt">
        {edit ? <T champ="accroche" as="div" className="ev-invit-acc mot" ph="Accroche" />
          : d ? <div className="ev-invit-acc"><span>{d.grand}</span>{d.petit}</div> : <div className="ev-invit-acc mot">{e.accroche || TYPES_EVT[e.type]}</div>}
        <T champ="titre" as="h1" />
        <T champ="sous_titre" as="p" ph="Sous-titre" />
      </div>
      <div className="ev-invit-quand">
        {e.date_evt && <p><T k="date_texte" def={maj1(jourLong(e.date_evt))} as="strong" />{e.heure ? ` à ${e.heure}` : ""}</p>}
        <T champ="lieu" as="p" ph="Lieu" />
        {(e.slogan || edit) && <p className="ev-invit-slogan">« <T champ="slogan" ph="Slogan" /> »</p>}
      </div>
      <footer className="ev-invit-pied">
        {(e.contact || edit) && <p><T k="invit_confirmer" def="Merci de confirmer votre présence au" /> <T champ="contact" as="strong" ph="Téléphone" /></p>}
        <div className="ev-invit-ref">
          <span><T k="invit_numero" def="Invitation n°" /> {i ? String(i.id).padStart(3, "0") : "……"}</span>
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
    <div className={`ev-carte theme-${e.theme}`} style={styleTheme(e)}>
      <div className="ev-souche">
        <div className="ev-souche-n"><T k="souche" def="Souche" /><b>N° {num(c.numero)}</b></div>
        <p><span>Nom</span><em>{c.detenteur || ""}</em></p>
        <p><span>Tél.</span><em>{c.telephone || ""}</em></p>
        <p><span>Vendeur</span><em>{c.vendeur || ""}</em></p>
        <p><span>Date</span><em>{c.date_vente ? date(c.date_vente) : ""}</em></p>
        <div className="ev-souche-m">{fcfa(c.montant)}</div>
      </div>
      <div className="ev-carte-corps">
        <div className="ev-fond" aria-hidden="true" />
        <div className="ev-carte-g">
          <div className="ev-carte-tete"><span className="ev-logo sm"><img src="/logo.png" alt="" /></span><T k="ecole_nom" def={etab.nom} as="strong" /></div>
          <div className="ev-carte-label"><T k="carte_label" def="Carte de soutien" />{c.categorie && c.categorie !== "Soutien" ? ` · ${c.categorie}` : ""}</div>
          <div className="ev-carte-titre"><Accroche e={e} taille="s" /><T champ="titre" /></div>
          <div className="ev-carte-quand"><T k="carte_quand" def={[e.date_evt && maj1(jourLong(e.date_evt)), e.heure, e.lieu].filter(Boolean).join(" · ")} /></div>
        </div>
        <div className="ev-carte-d">
          <div className="ev-carte-num">N° {num(c.numero)}</div>
          <div className="ev-carte-montant">{fcfa(c.montant)}</div>
          <T k="carte_merci" def="Merci pour votre soutien !" className="ev-carte-merci" as="div" />
        </div>
      </div>
    </div>
  );
}

// ── Programme (A4) ──
function Programme({ e, etab }) {
  const { edit, save } = useContext(Edit);
  return (
    <article className={`doc a4 evt ev-programme theme-${e.theme}`} style={styleTheme(e)}>
      <div className="ev-prog-bandeau">
        <div className="ev-fond" aria-hidden="true" />
        <Photo e={e} />
        <Ecole etab={etab} />
        <Accroche e={e} taille="m" />
        <T champ="titre" as="h1" className="ev-titre" />
        <Infos e={e} compact />
      </div>
      <T k="prog_h" def="Programme" as="h2" className="ev-prog-h" />
      <ol className="ev-prog-liste">{(e.programme || []).map((p, i) => {
        const maj = (f) => (v) => save({ programme: e.programme.map((x, j) => (j === i ? { ...x, [f]: v } : x)) });
        return (
          <li key={i}><T valeur={p.heure || ""} className="ev-prog-heure" onSave={maj("heure")} ph="—" />
            <div><T valeur={p.titre || ""} as="strong" onSave={maj("titre")} ph="Moment" />{(p.detail || edit) && <T valeur={p.detail || ""} as="p" onSave={maj("detail")} ph="Détail (facultatif)" />}</div></li>
        );
      })}</ol>
      {(e.slogan || edit) && <p className="ev-prog-slogan">« <T champ="slogan" ph="Slogan" /> »</p>}
    </article>
  );
}

// ── Badges (8 par page) ──
function Badge({ e, etab, role, nom, sous }) {
  return (
    <div className={`ev-badge theme-${e.theme}`} style={styleTheme(e)}>
      <div className="ev-badge-tete"><div className="ev-fond" aria-hidden="true" /><span className="ev-logo sm"><img src="/logo.png" alt="" /></span><div><strong>{e.accroche || TYPES_EVT[e.type]}</strong><T k="ecole_nom" def={etab.nom} /></div></div>
      <div className="ev-badge-role">{role}</div>
      <div className="ev-badge-nom">{nom || <span className="ev-ligne" />}</div>
      <div className="ev-badge-sous">{sous || " "}</div>
    </div>
  );
}

// ── Tableaux : émargement, suivi des vendeurs, bilan ──
function Entete({ e, etab, k, titre }) {
  return (
    <header className="ev-doc-tete">
      <span className="ev-logo sm"><img src="/logo.png" alt="" /></span>
      <div><T k="ecole_nom" def={etab.nom} as="strong" /><span>{e.titre}{e.date_evt ? ` — ${jourLong(e.date_evt)}` : ""}</span></div>
      <T k={k} def={titre} as="h1" />
    </header>
  );
}

function Emargement({ e, etab }) {
  const rows = [...e.invites].filter((i) => i.statut !== "excuse").sort((a, b) => (a.table_no || "zz").localeCompare(b.table_no || "zz", "fr", { numeric: true }) || a.nom.localeCompare(b.nom, "fr"));
  return (
    <article className="doc a4 etat evt-tab">
      <Entete e={e} etab={etab} k="emargement_titre" titre="Liste d'émargement" />
      <table className="b-table d-list">
        <thead><tr><th>N°</th><th>Invité</th><th>Qualité</th><th>Places</th><th>Table</th><th style={{ width: "26%" }}><T k="emargement_col" def="Arrivée / signature" /></th></tr></thead>
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

function Signes() {
  return <div className="ev-signes"><T k="signe_1" def="Le trésorier" as="div" /><T k="signe_2" def="La Direction" as="div" /></div>;
}

function Suivi({ e, etab }) {
  const vendeurs = [...new Set(e.cartes.map((c) => c.vendeur || "— Non remises —"))].sort();
  let tv = 0, tp = 0;
  return (
    <article className="doc a4 etat evt-tab">
      <Entete e={e} etab={etab} k="suivi_titre" titre="Suivi des cartes de soutien" />
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
      <Signes />
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
      <Entete e={e} etab={etab} k="bilan_titre" titre="Bilan de l'événement" />
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
      <Signes />
    </article>
  );
}

const ROLES_BADGE = ["Organisation", "Protocole", "Invité", "Presse", "Sécurité", "Bénévole"];

export default function EvenementSupports() {
  const { id } = useParams();
  const s = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [p, setP] = useSearchParams();
  const [edit, setEdit] = useState(false);
  const doc = DOCS[p.get("doc")] ? p.get("doc") : "affiche";
  const { data: e, isLoading, error } = useQuery({ queryKey: ["evenement", id], queryFn: () => api.get(`/evenements/${id}`) });
  const etab = s.etablissement || {};
  const peut = s.peut("evenements.ecrire");
  const tel = e?.contact || (etab.telephones || "").split("/")[0];
  const qr = useQr(e && (doc === "affiche" || doc === "flyer") && tel ? `https://wa.me/${telWa(tel)}?text=${encodeURIComponent(`Bonjour, je souhaite des informations sur « ${e.titre} ».`)}` : null);
  const save = async (d) => {
    try {
      const r = await api.put(`/evenements/${id}`, d);
      qc.setQueryData(["evenement", id], (old) => ({ ...old, ...r }));
      qc.invalidateQueries({ queryKey: ["evenements"] });
      toast("Texte enregistré");
    } catch (x) { toast(x.message, "error"); }
  };
  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 32 }}><ErrorBox error={error} /></div>;
  const [titre, format] = DOCS[doc];
  const maj = (k, v) => { const n = new URLSearchParams(p); if (v === "" || v == null) n.delete(k); else n.set(k, v); setP(n, { replace: true }); };
  const retablir = () => { if (window.confirm("Remettre tous les textes d'origine des supports (accroches, titres de rubriques, mentions…) ? Les infos de l'événement (titre, date, lieu…) ne changent pas.")) save({ textes: {} }); };
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
    pages = (edit ? liste.slice(0, 1) : liste).map((i, k) => <Invitation key={i?.id ?? `v${k}`} e={e} etab={etab} i={i} />);
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
    pages = (edit ? groupes.slice(0, 1) : groupes).map((g, k) => <article key={k} className="doc a4 evt ev-cartes-page">{g.map((c) => <CarteSoutien key={c.id} c={c} e={e} etab={etab} />)}</article>);
    const cats = [...new Set(e.cartes.map((c) => c.categorie).filter(Boolean))];
    options = <>
      {cats.length > 1 && <Select value={cat} onChange={(x) => maj("categorie", x.target.value)}><option value="">Toutes les catégories</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>}
      <Input type="number" placeholder="Du n°" value={du || ""} onChange={(x) => maj("du", x.target.value)} style={{ width: 90 }} />
      <Input type="number" placeholder="Au n°" value={au || ""} onChange={(x) => maj("au", x.target.value)} style={{ width: 90 }} />
    </>;
  } else if (doc === "badges") {
    const mode = p.get("mode") || "", role = p.get("role") || "Organisation", n = Math.min(Number(p.get("n")) || 8, 200);
    const items = mode === "invites"
      ? e.invites.filter((i) => i.statut !== "excuse").map((i) => ({ k: i.id, role: i.categorie === "personnel" ? "Personnel" : "Invité", nom: nomInvite(i), sous: i.qualite || i.organisation }))
      : Array.from({ length: n }, (_, k) => ({ k, role }));
    nb = items.length;
    const groupes = []; for (let k = 0; k < items.length; k += 8) groupes.push(items.slice(k, k + 8));
    pages = (edit ? groupes.slice(0, 1) : groupes).map((g, k) => <article key={k} className="doc a4 evt ev-badges-page"><div className="ev-badges-grille">{g.map((b) => <Badge key={b.k} e={e} etab={etab} role={b.role} nom={b.nom} sous={b.sous} />)}</div></article>);
    options = <>
      <Select value={mode} onChange={(x) => maj("mode", x.target.value)}><option value="">Badges vierges</option>{e.invites.length > 0 && <option value="invites">Au nom des invités</option>}</Select>
      {mode !== "invites" && <><Input list="ev-roles" value={role} onChange={(x) => maj("role", x.target.value)} style={{ width: 150 }} aria-label="Rôle écrit sur le badge" /><datalist id="ev-roles">{ROLES_BADGE.map((r) => <option key={r} value={r} />)}</datalist>
        <Input type="number" min={8} step={8} max={200} value={n} onChange={(x) => maj("n", x.target.value)} style={{ width: 80 }} aria-label="Nombre" /></>}
    </>;
  }

  return (
    <div className={`print-page evt-print${edit ? " evt-edition" : ""}`}>
      <style>{`@page { size: ${format} portrait; margin: 0; }`}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(`/evenements/${id}`)}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{titre}</strong> — {e.titre}{["invitations", "cartes", "badges"].includes(doc) ? ` · ${nb}` : ""}</span>
        <Select value={doc} onChange={(x) => { setEdit(false); setP({ doc: x.target.value }, { replace: true }); }} aria-label="Support">{Object.entries(DOCS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select>
        {!edit && options}
        {peut && (edit
          ? <button className="btn primary" onClick={() => setEdit(false)}><Check size={17} />Terminé</button>
          : <button className="btn" onClick={() => setEdit(true)}><PenLine size={17} />Modifier les textes</button>)}
        {!edit && <Partager format={format} nom={`${titre}-${e.titre}`} message={`${titre} — ${e.titre}`} />}
        {!edit && <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>}
      </div>
      {edit && (
        <div className="alert evt-aide">
          <PenLine size={18} />
          <span style={{ flex: 1 }}>Cliquez sur n'importe quel texte encadré pour le changer : il est enregistré dès que vous cliquez ailleurs, et repris sur tous les supports de l'événement. Pour les couleurs et la photo : onglet « Infos et programme ».</span>
          <button className="btn sm" onClick={retablir}><RotateCcw size={15} />Textes d'origine</button>
        </div>
      )}
      {doc === "cartes" && !nb ? <div className="alert" style={{ maxWidth: 900, margin: "0 auto" }}>Aucune carte : créez d'abord une série dans l'onglet « Cartes de soutien ».</div>
        : doc === "invitations" && !nb ? <div className="alert" style={{ maxWidth: 900, margin: "0 auto" }}>Aucun invité dans cette sélection. Choisissez « Invitations vierges » pour imprimer des invitations à remplir à la main.</div>
        : <Edit.Provider value={{ e, edit, save }}><div className="tickets">{pages}</div></Edit.Provider>}
    </div>
  );
}
