import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ListesParClasse } from "./FournituresClasses";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, ArrowDownToLine, ArrowUpFromLine, Pencil, ShoppingCart, AlertTriangle, Trash2, Search, History, Users, X, Boxes, ClipboardList } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, nombre, initiales, MODES, today } from "../lib/format";
import { Modal, Field, Input, Select, Money, Spinner, ErrorBox, Empty, Confirm, PageHead, useToast } from "../components/ui";
import Service from "./Service";

const CATS_ART = { fourniture: "Fourniture de classe", bureau: "Fourniture de bureau", livre: "Livre / manuel", cahier: "Cahier", entretien: "Produit d'entretien", autre: "Autre" };
const SENS = { entree: "Entrée", sortie: "Sortie", vente: "Vente", ajustement: "Ajustement" };
const invalider = (qc) => ["articles", "mouvements", "depenses", "caisse", "dashboard", "recus", "service"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

function ArticleForm({ article, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState(article || { nom: "", categorie: "fourniture", unite: "pièce", prix_achat: 0, prix_vente: 0, seuil: 0, actif: true, stock_initial: 0 });
  const [error, setError] = useState(null);
  const save = async () => {
    setError(null);
    try {
      const { id, stock, vendus, created_at, ...d } = v;
      if (article) await api.put(`/articles/${article.id}`, d); else await api.post("/articles", d);
      toast(article ? "Article modifié" : `Article « ${v.nom} » ajouté`); invalider(qc); onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal title={article ? `Modifier ${article.nom}` : "Nouvel article"} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.nom.trim()}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <Field label="Nom de l'article" required><Input value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} autoFocus placeholder="Cahier 100 pages, craie blanche, ancre…" /></Field>
        <div className="grid g2">
          <Field label="Catégorie"><Select value={v.categorie} onChange={(e) => setV({ ...v, categorie: e.target.value })}>{Object.entries(CATS_ART).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Unité" hint="pièce, boîte, paquet, rame…"><Input value={v.unite} onChange={(e) => setV({ ...v, unite: e.target.value })} /></Field>
          <Field label="Prix d'achat (par unité)"><Money value={v.prix_achat} onChange={(x) => setV({ ...v, prix_achat: x ?? 0 })} /></Field>
          <Field label="Prix de vente aux élèves" hint="0 si l'article n'est pas vendu"><Money value={v.prix_vente} onChange={(x) => setV({ ...v, prix_vente: x ?? 0 })} /></Field>
          <Field label="Alerte si le stock descend à" hint="Laisser 0 pour aucune alerte"><Money value={v.seuil} onChange={(x) => setV({ ...v, seuil: x ?? 0 })} /></Field>
          {!article && <Field label="Quantité déjà en stock"><Money value={v.stock_initial} onChange={(x) => setV({ ...v, stock_initial: x ?? 0 })} /></Field>}
        </div>
        {article && <label className="check"><input type="checkbox" checked={v.actif} onChange={(e) => setV({ ...v, actif: e.target.checked })} />Article utilisé (décocher pour le ranger)</label>}
      </div>
    </Modal>
  );
}

function MouvementForm({ article, sens, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const s = useSession();
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const [v, setV] = useState({ quantite: null, prix_unitaire: article.prix_achat || 0, date_mouvement: today(), destinataire: "", classe_id: "", note: "", creer_depense: true, mode: "especes", ajout: "plus" });
  const [error, setError] = useState(null);
  const titre = { entree: `Entrée en stock — ${article.nom}`, sortie: `Sortie du stock — ${article.nom}`, ajustement: `Corriger le stock — ${article.nom}` }[sens];
  const save = async () => {
    setError(null);
    try {
      const quantite = sens === "ajustement" && v.ajout === "moins" ? -v.quantite : v.quantite;
      await api.post("/mouvements", { ...v, quantite, article_id: article.id, sens, classe_id: v.classe_id || null });
      toast(sens === "entree" ? `${v.quantite} ${article.unite}(s) ajouté(s) au stock` : sens === "sortie" ? `${v.quantite} ${article.unite}(s) sorti(s) du stock` : "Stock corrigé");
      invalider(qc); onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal title={titre} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.quantite}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <p className="muted">Stock actuel : <strong style={{ color: "var(--ink)" }}>{nombre(article.stock)} {article.unite}(s)</strong></p>
        {sens === "ajustement" && (
          <div className="seg full">
            <button type="button" className={v.ajout === "plus" ? "on" : ""} onClick={() => setV({ ...v, ajout: "plus" })}>Ajouter (oubli, retour)</button>
            <button type="button" className={v.ajout === "moins" ? "on" : ""} onClick={() => setV({ ...v, ajout: "moins" })}>Retirer (perte, casse)</button>
          </div>
        )}
        <div className="grid g2">
          <Field label="Quantité" required><Money value={v.quantite} onChange={(x) => setV({ ...v, quantite: x })} autoFocus /></Field>
          <Field label="Date"><Input type="date" value={v.date_mouvement} onChange={(e) => setV({ ...v, date_mouvement: e.target.value })} /></Field>
          {sens === "entree" && <Field label="Prix d'achat par unité"><Money value={v.prix_unitaire} onChange={(x) => setV({ ...v, prix_unitaire: x ?? 0 })} /></Field>}
          {sens === "entree" && <Field label="Fournisseur"><Input value={v.destinataire} onChange={(e) => setV({ ...v, destinataire: e.target.value })} placeholder="Librairie…" /></Field>}
          {sens === "sortie" && <Field label="Pour la classe"><Select value={v.classe_id} onChange={(e) => setV({ ...v, classe_id: e.target.value })}><option value="">—</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select></Field>}
          {sens === "sortie" && <Field label="Remis à" hint="Enseignant, bureau, agent…"><Input value={v.destinataire} onChange={(e) => setV({ ...v, destinataire: e.target.value })} /></Field>}
        </div>
        {sens === "entree" && v.prix_unitaire > 0 && v.quantite > 0 && (
          <div className="alert info" style={{ display: "grid", gap: 8 }}>
            <label className="check"><input type="checkbox" checked={v.creer_depense} onChange={(e) => setV({ ...v, creer_depense: e.target.checked })} />Enregistrer aussi l'achat dans les dépenses : <strong>{fcfa(v.prix_unitaire * v.quantite)}</strong></label>
            {v.creer_depense && <Field label="Payé en"><Select value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value })}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>}
          </div>
        )}
        <Field label="Note"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function VenteModal({ eleve: eleveInit, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const s = useSession();
  const [eleve, setEleve] = useState(eleveInit || null);
  const [rq, setRq] = useState("");
  const [lignes, setLignes] = useState([]);
  const [mode, setMode] = useState("especes");
  const [reference, setReference] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const arts = useQuery({ queryKey: ["articles"], queryFn: () => api.get("/articles") });
  const res = useQuery({ queryKey: ["eleves", "vente", rq, s.annee?.id], queryFn: () => api.get("/eleves", { q: rq, limit: 8, annee_id: s.annee?.id }), enabled: !eleve && rq.trim().length > 1 });
  const vendables = (arts.data || []).filter((a) => a.actif && a.prix_vente > 0);
  const total = lignes.reduce((t, l) => t + (l.quantite || 0) * (l.prix || 0), 0);
  const ajouter = (id) => { const a = vendables.find((x) => x.id === Number(id)); if (a && !lignes.some((l) => l.article_id === a.id)) setLignes([...lignes, { article_id: a.id, nom: a.nom, stock: a.stock, unite: a.unite, quantite: 1, prix: a.prix_vente }]); };
  const maj = (i, k, x) => setLignes(lignes.map((l, j) => (j === i ? { ...l, [k]: x } : l)));
  const save = async () => {
    setError(null); setBusy(true);
    try {
      const r = await api.post("/ventes", { inscription_id: eleve.inscription_id, mode, reference, articles: lignes.map((l) => ({ article_id: l.article_id, quantite: l.quantite, prix: l.prix })) });
      toast(`Vente enregistrée — reçu ${r.numero}`); invalider(qc); onClose(); nav(`/recus/${r.id}`);
    } catch (e) { setError(e); setBusy(false); }
  };
  const trop = lignes.some((l) => l.quantite > l.stock);
  return (
    <Modal wide title="Vendre des fournitures" onClose={onClose} footer={<>
      <span className="grow" style={{ fontWeight: 800 }}>Total : {fcfa(total)}</span>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!eleve || !lignes.length || !total || trop || busy}><ShoppingCart size={16} />Encaisser et imprimer le reçu</button>
    </>}>
      <div className="stack" style={{ gap: 16 }}>
        <ErrorBox error={error} />
        <Field label="Élève" required>
          {eleve ? (
            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <div className="person"><span className={`avatar ${eleve.sexe || ""}`}>{initiales(eleve.prenom, eleve.nom)}</span><div><strong>{eleve.nom} {eleve.prenom}</strong><span>{eleve.classe} · {eleve.matricule}</span></div></div>
              {!eleveInit && <button className="btn sm ghost" onClick={() => setEleve(null)}><X size={14} />Changer</button>}
            </div>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              <div className="with-icon"><Search size={18} /><input className="input" value={rq} onChange={(e) => setRq(e.target.value)} placeholder="Nom, prénom ou matricule…" autoFocus /></div>
              {res.data?.rows?.filter((e) => e.inscription_id).map((e) => (
                <button key={e.id} type="button" className="pick-row" onClick={() => setEleve(e)}>
                  <span className={`avatar ${e.sexe || ""}`}>{initiales(e.prenom, e.nom)}</span><strong>{e.nom} {e.prenom}</strong><span className="muted">{e.classe} · {e.matricule}</span>
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Ajouter un article">
          <Select value="" onChange={(e) => ajouter(e.target.value)}>
            <option value="">{vendables.length ? "Choisir un article…" : "Aucun article à vendre : mettez un prix de vente dans l'onglet Stock"}</option>
            {vendables.map((a) => <option key={a.id} value={a.id} disabled={a.stock <= 0 || lignes.some((l) => l.article_id === a.id)}>{a.nom} — {fcfa(a.prix_vente)} ({a.stock > 0 ? `${a.stock} en stock` : "épuisé"})</option>)}
          </Select>
        </Field>
        {lignes.length > 0 && (
          <table className="table">
            <thead><tr><th>Article</th><th className="r">Quantité</th><th className="r">Prix unitaire</th><th className="r">Total</th><th /></tr></thead>
            <tbody>{lignes.map((l, i) => (
              <tr key={l.article_id}>
                <td><strong>{l.nom}</strong><div className={`xs ${l.quantite > l.stock ? "" : "muted"}`} style={l.quantite > l.stock ? { color: "var(--coral)" } : {}}>{l.stock} en stock</div></td>
                <td className="r" style={{ width: 110 }}><Money value={l.quantite} onChange={(x) => maj(i, "quantite", x)} /></td>
                <td className="r" style={{ width: 140 }}><Money value={l.prix} onChange={(x) => maj(i, "prix", x)} /></td>
                <td className="r amount">{fcfa((l.quantite || 0) * (l.prix || 0))}</td>
                <td className="r"><button className="btn sm ghost icon" onClick={() => setLignes(lignes.filter((_, j) => j !== i))} aria-label="Retirer"><Trash2 size={15} /></button></td>
              </tr>))}</tbody>
          </table>
        )}
        <div className="grid g2">
          <Field label="Mode de paiement"><Select value={mode} onChange={(e) => setMode(e.target.value)}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          {mode !== "especes" && <Field label="Référence"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>}
        </div>
      </div>
    </Modal>
  );
}

function Stock() {
  const s = useSession();
  const peut = s.peut("depenses.ecrire");
  const [edit, setEdit] = useState(null);
  const [mvt, setMvt] = useState(null);
  const [rq, setRq] = useState("");
  const [voirRanges, setVoirRanges] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["articles"], queryFn: () => api.get("/articles") });
  const rows = (data || []).filter((a) => (voirRanges || a.actif) && (!rq || a.nom.toLowerCase().includes(rq.toLowerCase())));
  const actifs = (data || []).filter((a) => a.actif);
  const alertes = actifs.filter((a) => a.stock <= a.seuil && (a.seuil > 0 || a.stock <= 0));
  const valeur = actifs.reduce((t, a) => t + Math.max(a.stock, 0) * a.prix_achat, 0);
  return (
    <>
      <div className="dash" style={{ marginBottom: 22 }}>
        <div className="card kpi c4"><div className="top"><span className="label">Articles suivis</span><span className="ic teal"><Boxes size={20} /></span></div><div className="value">{actifs.length}</div><div className="sub">{nombre(actifs.reduce((t, a) => t + Math.max(a.stock, 0), 0))} unités en stock</div></div>
        <div className="card kpi c4"><div className="top"><span className="label">Valeur du stock</span><span className="ic gold"><Package size={20} /></span></div><div className="value">{nombre(valeur)}<small>F</small></div><div className="sub">au prix d'achat</div></div>
        <div className="card kpi c4"><div className="top"><span className="label">À racheter</span><span className="ic coral"><AlertTriangle size={20} /></span></div><div className="value" style={{ color: alertes.length ? "var(--coral)" : "var(--green)" }}>{alertes.length}</div><div className="sub">{alertes.length ? alertes.slice(0, 3).map((a) => a.nom).join(", ") + (alertes.length > 3 ? "…" : "") : "Aucun article en rupture"}</div></div>
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="with-icon"><Search size={18} /><input className="input" value={rq} onChange={(e) => setRq(e.target.value)} placeholder="Rechercher un article…" /></div>
          <label className="check small"><input type="checkbox" checked={voirRanges} onChange={(e) => setVoirRanges(e.target.checked)} />Voir les articles rangés</label>
          <span className="spacer" />
          {peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={17} />Nouvel article</button>}
        </div>
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !rows.length ? (
          <Empty icon={Package} title="Aucun article" action={peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Ajouter un article</button>}>Ajoutez les fournitures que l'école achète, distribue ou vend (cahiers, craie, ancre, livres…).</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Article</th><th className="hide-m">Catégorie</th><th className="r">En stock</th><th className="r hide-m">Prix d'achat</th><th className="r hide-m">Prix de vente</th><th className="r hide-m">Vendus</th>{peut && <th />}</tr></thead>
              <tbody>{rows.map((a) => {
                const bas = a.stock <= a.seuil && (a.seuil > 0 || a.stock <= 0);
                return (
                  <tr key={a.id} style={a.actif ? {} : { opacity: 0.55 }}>
                    <td><strong>{a.nom}</strong>{!a.actif && <span className="badge" style={{ marginLeft: 8 }}>Rangé</span>}</td>
                    <td className="hide-m"><span className="badge">{CATS_ART[a.categorie] || a.categorie}</span></td>
                    <td className="r"><span className={`badge ${bas ? "coral" : "green"}`}>{nombre(a.stock)} {a.unite}{a.stock > 1 ? "s" : ""}</span>{bas && a.seuil > 0 && <div className="xs muted">alerte à {a.seuil}</div>}</td>
                    <td className="r num hide-m">{a.prix_achat ? fcfa(a.prix_achat) : "—"}</td>
                    <td className="r num hide-m">{a.prix_vente ? fcfa(a.prix_vente) : <span className="muted">Non vendu</span>}</td>
                    <td className="r num hide-m">{a.vendus || "—"}</td>
                    {peut && <td className="r" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn sm" onClick={() => setMvt({ a, sens: "entree" })} title="Achat, don, réception"><ArrowDownToLine size={15} /><span className="hide-m">Entrée</span></button>{" "}
                      <button className="btn sm" onClick={() => setMvt({ a, sens: "sortie" })} disabled={a.stock <= 0} title="Distribution à une classe ou au bureau"><ArrowUpFromLine size={15} /><span className="hide-m">Sortie</span></button>
                      <button className="btn sm ghost icon" onClick={() => setMvt({ a, sens: "ajustement" })} title="Corriger le stock (inventaire, perte)"><History size={15} /></button>
                      <button className="btn sm ghost icon" onClick={() => setEdit(a)} aria-label="Modifier"><Pencil size={15} /></button>
                    </td>}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <ArticleForm article={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {mvt && <MouvementForm article={mvt.a} sens={mvt.sens} onClose={() => setMvt(null)} />}
    </>
  );
}

function Mouvements({ sensFixe }) {
  const s = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [article, setArticle] = useState("");
  const [sens, setSens] = useState(sensFixe || "");
  const [del, setDel] = useState(null);
  const arts = useQuery({ queryKey: ["articles"], queryFn: () => api.get("/articles") });
  const f = { article_id: article, sens };
  const { data, isLoading, error } = useQuery({ queryKey: ["mouvements", f], queryFn: () => api.get("/mouvements", f) });
  const supprimer = async () => {
    try { const r = await api.del(`/mouvements/${del.id}`); toast(r.depense_id ? "Mouvement supprimé. La dépense liée reste dans Dépenses : supprimez-la si besoin." : "Mouvement supprimé"); invalider(qc); }
    catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  const ventes = sensFixe === "vente";
  const total = (data || []).filter((m) => m.sens === "vente" && !m.recu_annule).reduce((t, m) => t + m.quantite * m.prix_unitaire, 0);
  return (
    <div className="card">
      <div className="toolbar">
        <Select value={article} onChange={(e) => setArticle(e.target.value)} aria-label="Article"><option value="">Tous les articles</option>{arts.data?.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</Select>
        {!sensFixe && <Select value={sens} onChange={(e) => setSens(e.target.value)} aria-label="Type"><option value="">Entrées, sorties et ventes</option>{Object.entries(SENS).map(([k, l]) => <option key={k} value={k}>{l}s</option>)}</Select>}
        <span className="spacer" />
        {ventes && data && <span className="muted">Total des ventes : <strong style={{ color: "var(--green)" }}>{fcfa(total)}</strong></span>}
      </div>
      {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.length ? (
        <Empty icon={ventes ? ShoppingCart : History} title={ventes ? "Aucune vente" : "Aucun mouvement"}>{ventes ? "Les ventes faites aux élèves apparaîtront ici avec leur reçu." : "Les entrées, sorties et ventes apparaîtront ici."}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Article</th>{!ventes && <th>Type</th>}<th className="r">Quantité</th><th>{ventes ? "Élève" : "Détail"}</th><th className="r hide-m">Montant</th><th className="hide-m">Par</th><th /></tr></thead>
            <tbody>{data.map((m) => {
              const signe = m.sens === "entree" || (m.sens === "ajustement" && m.quantite > 0) ? "+" : "−";
              return (
                <tr key={m.id} style={m.recu_annule ? { opacity: 0.5, textDecoration: "line-through" } : {}}>
                  <td className="num">{date(m.date_mouvement)}</td>
                  <td><strong>{m.article}</strong></td>
                  {!ventes && <td><span className={`badge ${m.sens === "entree" ? "green" : m.sens === "vente" ? "teal" : m.sens === "sortie" ? "gold" : ""}`}>{SENS[m.sens]}</span></td>}
                  <td className="r num" style={{ color: signe === "+" ? "var(--green)" : "var(--coral)", fontWeight: 800 }}>{signe}{Math.abs(m.quantite)}</td>
                  <td className="small">
                    {m.sens === "vente" ? <a className="link" onClick={() => nav(`/recus/${m.recu_id}`)} style={{ cursor: "pointer" }}>{m.eleve_nom} {m.eleve_prenom} · reçu {m.recu_numero}{m.recu_annule ? " (annulé)" : ""}</a>
                      : [m.classe && `Classe ${m.classe}`, m.destinataire, m.note, m.depense_id && "dépense enregistrée"].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="r num hide-m">{m.prix_unitaire ? fcfa(Math.abs(m.quantite) * m.prix_unitaire) : "—"}</td>
                  <td className="hide-m small muted">{m.saisi_par_nom || "—"}</td>
                  <td className="r">{m.sens !== "vente" && s.peut("depenses.ecrire") && <button className="btn sm ghost icon" onClick={() => setDel(m)} aria-label="Supprimer"><Trash2 size={15} /></button>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {del && <Confirm danger title="Supprimer ce mouvement ?" confirmLabel="Supprimer" message={`${SENS[del.sens]} de ${Math.abs(del.quantite)} ${del.article} du ${date(del.date_mouvement)}. Le stock sera recalculé.`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </div>
  );
}

export default function Fournitures() {
  const s = useSession();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(sp.get("tab") || "stock");
  const [vente, setVente] = useState(false);
  const TABS = useMemo(() => [
    ["stock", "Stock", Package], ["classes", "Listes par classe", ClipboardList], ["eleves", "Fournitures des élèves", Users], ["ventes", "Ventes", ShoppingCart], ["mouvements", "Historique", History],
  ], []);
  return (
    <>
      <PageHead title="Fournitures" sub={`Stock de l'école, fournitures payées par les élèves et ventes — ${s.annee?.libelle || ""}`}>
        {s.peut("finances.encaisser") && <button className="btn primary" onClick={() => setVente(true)}><ShoppingCart size={17} />Vendre à un élève</button>}
      </PageHead>
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map(([k, l, I]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><I size={16} />{l}</button>)}
      </div>
      {tab === "stock" && <Stock />}
      {tab === "classes" && <ListesParClasse />}
      {tab === "eleves" && <Service typeFixe="fournitures" embedded onVendre={(r) => setVente({ ...r, classe: r.classe })} />}
      {tab === "ventes" && <Mouvements key="v" sensFixe="vente" />}
      {tab === "mouvements" && <Mouvements key="m" />}
      {vente && <VenteModal eleve={vente === true ? null : vente} onClose={() => setVente(false)} />}
    </>
  );
}
