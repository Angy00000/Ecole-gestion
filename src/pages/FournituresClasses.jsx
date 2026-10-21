import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Printer, Copy, ArrowLeft, ClipboardList, ShoppingBasket } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date } from "../lib/format";
import { Select, Spinner, ErrorBox, Empty, useToast } from "../components/ui";
import Partager from "../components/Partager";
import { EnTete } from "./Documents";

/** Onglet « Listes par classe » : ce que chaque classe doit avoir, et ce qu'il faut acheter. */
export function ListesParClasse() {
  const s = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const peut = s.peut("classes.ecrire");
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const fc = useQuery({ queryKey: ["fournitures-classes", s.annee?.id], queryFn: () => api.get("/fournitures-classes", { annee_id: s.annee?.id }) });
  const arts = useQuery({ queryKey: ["articles"], queryFn: () => api.get("/articles"), enabled: s.peut("finances.lire") });
  const [classeId, setClasseId] = useState(null);
  const [items, setItems] = useState([]);
  const [modif, setModif] = useState(false);
  const [vue, setVue] = useState("liste");
  const classe = classes.data?.find((c) => c.id === classeId) || classes.data?.[0];
  useEffect(() => {
    if (!classe || !fc.data) return;
    setItems(fc.data.filter((f) => f.classe_id === classe.id).map(({ article_id, libelle, quantite, remarque }) => ({ article_id, libelle, quantite, remarque })));
    setModif(false);
  }, [classe?.id, fc.data]);
  if (classes.isLoading || fc.isLoading) return <Spinner />;
  if (fc.error) return <ErrorBox error={fc.error} />;
  const maj = (i, p) => { setItems(items.map((x, j) => (j === i ? { ...x, ...p } : x))); setModif(true); };
  const enregistrer = async () => {
    try { const r = await api.put(`/classes/${classe.id}/fournitures`, { items }); toast(`Liste du ${classe.nom} enregistrée (${r.nombre} fournitures)`); qc.invalidateQueries({ queryKey: ["fournitures-classes"] }); setModif(false); }
    catch (e) { toast(e.message, "error"); }
  };
  const copier = (id) => {
    const src = fc.data.filter((f) => f.classe_id === Number(id)).map(({ article_id, libelle, quantite, remarque }) => ({ article_id, libelle, quantite, remarque }));
    if (!src.length) return toast("Cette classe n'a pas encore de liste.", "error");
    setItems(src); setModif(true); toast("Liste copiée : vérifiez-la puis enregistrez.");
  };
  // Besoins : quantité demandée × effectif de la classe, regroupés par article du stock
  const besoins = {};
  (fc.data || []).forEach((f) => {
    const k = f.article_id ? `a${f.article_id}` : `l${f.libelle.toLowerCase()}`;
    const b = (besoins[k] ||= { nom: f.article || f.libelle, unite: f.unite, stock: f.article_id ? f.stock : null, prix: f.prix_vente, total: 0, detail: [] });
    b.total += f.quantite * f.effectif; b.detail.push(`${f.classe} : ${f.quantite} × ${f.effectif}`);
  });

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="seg">
          <button className={vue === "liste" ? "on" : ""} onClick={() => setVue("liste")}><ClipboardList size={15} /> Liste par classe</button>
          <button className={vue === "besoins" ? "on" : ""} onClick={() => setVue("besoins")}><ShoppingBasket size={15} /> Besoins de l'école</button>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={() => nav("/fournitures/liste")}><Printer size={16} />Imprimer toutes les listes</button>
      </div>
      {vue === "besoins" ? (
        <div className="card">
          <div className="card-head"><h3>Ce qu'il faut pour toutes les classes</h3></div>
          <p className="small muted" style={{ padding: "0 20px 10px" }}>Quantité demandée par élève × effectif de chaque classe, comparée au stock (articles liés au stock).</p>
          {!Object.keys(besoins).length ? <Empty icon={ShoppingBasket} title="Aucune liste de classe">Remplissez d'abord les listes des classes.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Fourniture</th><th className="hide-m">Détail par classe</th><th className="r">Total nécessaire</th><th className="r">En stock</th><th className="r">À acheter</th></tr></thead>
              <tbody>{Object.values(besoins).sort((a, b) => a.nom.localeCompare(b.nom)).map((b) => {
                const manque = b.stock == null ? null : Math.max(b.total - b.stock, 0);
                return <tr key={b.nom}><td><strong>{b.nom}</strong></td><td className="hide-m small muted">{b.detail.join(" · ")}</td><td className="r num"><strong>{b.total}</strong></td>
                  <td className="r num">{b.stock == null ? <span className="muted small">non suivi</span> : b.stock}</td>
                  <td className="r">{manque == null ? "—" : manque ? <span className="badge coral">{manque}</span> : <span className="badge green">OK</span>}</td></tr>;
              })}</tbody>
            </table></div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="class-tabs" style={{ padding: "14px 16px 0" }}>{classes.data?.map((c) => {
            const n = fc.data.filter((f) => f.classe_id === c.id).length;
            return <button key={c.id} className={`class-tab ${c.id === classe?.id ? "on" : ""}`} onClick={() => { if (modif && !window.confirm("Modifications non enregistrées. Changer de classe quand même ?")) return; setClasseId(c.id); }}>{c.nom} <span className="n">{n}</span></button>;
          })}</div>
          {classe && <div className="card-body">
            <div className="between" style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Fournitures du {classe.nom} <span className="muted small">· {classe.effectif} élèves</span></h3>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {peut && <div style={{ width: 260 }}><Select value="" onChange={(e) => e.target.value && copier(e.target.value)} aria-label="Copier"><option value="">Copier la liste d'une autre classe…</option>{classes.data.filter((c) => c.id !== classe.id).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select></div>}
                <button className="btn" onClick={() => nav(`/fournitures/liste?classe=${classe.id}`)} disabled={modif || !items.length}><Printer size={16} />Imprimer pour les parents</button>
                {peut && <button className="btn primary" onClick={enregistrer} disabled={!modif}><Save size={16} />Enregistrer</button>}
              </div>
            </div>
            {!items.length && !peut ? <Empty icon={ClipboardList} title="Pas encore de liste">La direction n'a pas encore fixé la liste de cette classe.</Empty> : (
              <table className="table fc-table">
                <thead><tr><th style={{ width: 40 }}>N°</th><th>Fourniture</th><th style={{ width: 110 }} className="r">Quantité</th><th>Remarque</th>{arts.data && <th className="hide-m">Article du stock</th>}{peut && <th />}</tr></thead>
                <tbody>
                  {items.map((x, i) => (
                    <tr key={i}>
                      <td className="num muted">{i + 1}</td>
                      <td>{peut ? <input className="input" value={x.libelle} onChange={(e) => maj(i, { libelle: e.target.value })} placeholder="Cahier 100 pages, ardoise…" /> : x.libelle}</td>
                      <td className="r">{peut ? <input className="input num" inputMode="numeric" value={x.quantite} onChange={(e) => maj(i, { quantite: e.target.value.replace(/\D/g, "") })} /> : x.quantite}</td>
                      <td>{peut ? <input className="input" value={x.remarque || ""} onChange={(e) => maj(i, { remarque: e.target.value })} placeholder="Couleur, format, marque…" /> : x.remarque}</td>
                      {arts.data && <td className="hide-m">{peut ? <Select value={x.article_id || ""} onChange={(e) => { const a = arts.data.find((y) => y.id === Number(e.target.value)); maj(i, { article_id: a?.id || null, libelle: x.libelle || a?.nom || "" }); }}><option value="">— non suivi —</option>{arts.data.filter((a) => a.actif).map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</Select> : (arts.data.find((a) => a.id === x.article_id)?.nom || "—")}</td>}
                      {peut && <td className="r"><button className="btn sm ghost icon" onClick={() => { setItems(items.filter((_, j) => j !== i)); setModif(true); }} aria-label="Retirer"><Trash2 size={15} /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {peut && <button className="btn" style={{ marginTop: 10 }} onClick={() => { setItems([...items, { libelle: "", quantite: 1, remarque: "", article_id: null }]); setModif(true); }}><Plus size={16} />Ajouter une fourniture</button>}
            {modif && <p className="xs" style={{ color: "var(--coral)", marginTop: 8 }}>Modifications non enregistrées.</p>}
          </div>}
        </div>
      )}
    </>
  );
}

/** Impression : liste des fournitures d'une classe (ou de toutes) pour les parents. */
export function ListeFournituresImpression() {
  const s = useSession();
  const nav = useNavigate();
  const [p] = useSearchParams();
  const classeId = Number(p.get("classe")) || null;
  const fc = useQuery({ queryKey: ["fournitures-classes", s.annee?.id], queryFn: () => api.get("/fournitures-classes", { annee_id: s.annee?.id }) });
  if (fc.isLoading) return <Spinner />;
  if (fc.error) return <div style={{ padding: 32 }}><ErrorBox error={fc.error} /></div>;
  const groupes = [];
  fc.data.filter((f) => !classeId || f.classe_id === classeId).forEach((f) => {
    let g = groupes.find((x) => x.id === f.classe_id); if (!g) groupes.push((g = { id: f.classe_id, nom: f.classe, rows: [] })); g.rows.push(f);
  });
  const etab = s.etablissement;
  const titre = classeId && groupes[0] ? `Liste des fournitures — ${groupes[0].nom}` : "Listes des fournitures";
  return (
    <div className="print-page">
      <style>{"@page { size: A4 portrait; margin: 0; }"}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav("/fournitures?tab=classes")}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{titre}</strong></span>
        <Partager format="A4" nom={titre} message={`${titre} — ${etab.nom}`} />
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      <div className="tickets">
        {!groupes.length ? <p className="muted" style={{ padding: 40 }}>Aucune liste enregistrée.</p> : groupes.map((g) => (
          <article key={g.id} className="doc a4">
            <EnTete etab={etab} />
            <h1 className="d-title" style={{ marginTop: 18 }}>Liste des fournitures — {g.nom}</h1>
            <p className="d-num">Année scolaire {s.annee?.libelle}</p>
            <p style={{ marginBottom: 8 }}>Élève : ……………………………………………………………</p>
            <table className="b-table d-list fc-print">
              <thead><tr><th>N°</th><th>Fourniture</th><th>Quantité</th><th>Remarque</th><th>Reçu ✓</th></tr></thead>
              <tbody>{g.rows.map((f, i) => <tr key={f.id}><td>{i + 1}</td><td><strong>{f.libelle}</strong></td><td style={{ textAlign: "center" }}>{f.quantite}</td><td>{f.remarque || ""}</td><td /></tr>)}</tbody>
            </table>
            <p className="xs" style={{ marginTop: 12 }}>Les fournitures doivent être marquées au nom de l'enfant et apportées dès la rentrée. Merci de votre collaboration.</p>
            <div className="d-sign" style={{ marginTop: "auto" }}><p>Fait à {etab.ville || "Malika"}, le {date(new Date().toISOString())}</p><p className="d-sign-t">La Direction</p></div>
          </article>
        ))}
      </div>
    </div>
  );
}
