import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Pill, PackagePlus, PackageMinus, ClipboardCheck, History, AlertTriangle, CalendarX } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, today, fcfa, MODES } from "../lib/format";
import { Modal, Field, Input, Select, Money, Textarea, Spinner, ErrorBox, Empty, Confirm, useToast } from "../components/ui";

export const FORMES = { comprime: "Comprimés", sirop: "Sirop", pommade: "Pommade / crème", gouttes: "Gouttes", injectable: "Injectable", pansement: "Pansements / compresses", materiel: "Matériel", autre: "Autre" };
const TYPES = {
  entree: { l: "Entrée (achat, don)", court: "Entrée", badge: "green", signe: "+" },
  sortie: { l: "Sortie (utilisé)", court: "Sortie", badge: "teal", signe: "−" },
  perime: { l: "Périmé / abîmé (retiré)", court: "Périmé", badge: "coral", signe: "−" },
  ajustement: { l: "Inventaire (correction)", court: "Inventaire", badge: "gold", signe: "±" },
};
const INV = ["infirmerie-produits", "infirmerie-mouvements", "infirmerie", "infirmerie-rapport", "depenses", "caisse", "dashboard"];
const bientot = (d) => d && d.slice(0, 10) <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

function ProduitForm({ produit, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState(produit ? { ...produit } : { nom: "", forme: "comprime", unite: "comprimés", seuil: 10, note: "", stock_initial: "", peremption: "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setError(null);
    try {
      const d = { nom: v.nom, forme: v.forme, unite: v.unite || "unités", seuil: Number(v.seuil) || 0, note: v.note };
      if (produit) await api.put(`/infirmerie/produits/${produit.id}`, d);
      else await api.post("/infirmerie/produits", { ...d, stock_initial: Number(v.stock_initial) || 0, peremption: v.peremption || null });
      toast(produit ? "Produit modifié" : `${v.nom} ajouté au stock`);
      INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal title={produit ? "Modifier le produit" : "Nouveau produit"} icon={<Pill size={20} />} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.nom?.trim()}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <Field label="Nom du produit" required><Input value={v.nom} onChange={set("nom")} autoFocus placeholder="Paracétamol 500 mg, compresses stériles…" /></Field>
        <div className="grid g2">
          <Field label="Forme"><Select value={v.forme || ""} onChange={set("forme")}>{Object.entries(FORMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Compté en"><Input value={v.unite} onChange={set("unite")} placeholder="comprimés, flacons, boîtes…" /></Field>
          <Field label="Alerte quand il reste" hint="Le produit passe en rouge à ce niveau."><Input type="number" min={0} value={v.seuil} onChange={set("seuil")} /></Field>
          {!produit && <Field label="Quantité en stock aujourd'hui"><Input type="number" min={0} value={v.stock_initial} onChange={set("stock_initial")} placeholder="0" /></Field>}
          {!produit && <Field label="Date de péremption"><Input type="date" value={v.peremption} onChange={set("peremption")} /></Field>}
        </div>
        <Field label="Remarque"><Input value={v.note || ""} onChange={set("note")} placeholder="Dose, rangement…" /></Field>
      </div>
    </Modal>
  );
}

function MouvementForm({ type: typeInit, produit, produits, onClose }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState({ type: typeInit || "entree", produit_id: produit ? String(produit.id) : "", quantite: "", stock_compte: "", date_mvt: today(), peremption: "", lot: "", fournisseur: "", prix_total: null, depense: true, mode: "especes", reference: "", note: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const pr = produits.find((x) => String(x.id) === String(v.produit_id));
  const save = async () => {
    setError(null); setBusy(true);
    try {
      await api.post("/infirmerie/mouvements", { ...v, produit_id: Number(v.produit_id), quantite: Number(v.quantite), stock_compte: v.stock_compte === "" ? null : Number(v.stock_compte), depense: v.depense && !!v.prix_total });
      toast(v.type === "entree" && v.prix_total && v.depense ? `Entrée enregistrée et ${fcfa(v.prix_total)} ajoutés aux dépenses` : "Mouvement enregistré");
      INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const ok = v.produit_id && (v.type === "ajustement" ? v.stock_compte !== "" : Number(v.quantite) > 0);
  return (
    <Modal title={TYPES[v.type].l} icon={v.type === "entree" ? <PackagePlus size={20} /> : <PackageMinus size={20} />} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!ok || busy}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <div className="grid g2">
          <Field label="Mouvement"><Select value={v.type} onChange={set("type")}>{Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.l}</option>)}</Select></Field>
          <Field label="Date"><Input type="date" value={v.date_mvt} max={today()} onChange={set("date_mvt")} /></Field>
        </div>
        <Field label="Produit" required>
          <Select value={v.produit_id} onChange={set("produit_id")}><option value="">Choisir…</option>{produits.map((x) => <option key={x.id} value={x.id}>{x.nom} — en stock : {x.stock} {x.unite}</option>)}</Select>
        </Field>
        {v.type === "ajustement" ? (
          <Field label={`Quantité comptée dans l'armoire${pr ? ` (${pr.unite})` : ""}`} hint={pr ? `Le logiciel indique ${pr.stock} ${pr.unite}. La différence sera corrigée.` : null}>
            <Input type="number" min={0} value={v.stock_compte} onChange={set("stock_compte")} autoFocus />
          </Field>
        ) : (
          <Field label={`Quantité${pr ? ` (${pr.unite})` : ""}`} required hint={v.type !== "entree" && pr ? `Il en reste ${pr.stock}.` : null}>
            <Input type="number" min={1} value={v.quantite} onChange={set("quantite")} autoFocus />
          </Field>
        )}
        {v.type === "entree" && <>
          <div className="grid g2">
            <Field label="Date de péremption"><Input type="date" value={v.peremption} onChange={set("peremption")} /></Field>
            <Field label="N° de lot"><Input value={v.lot} onChange={set("lot")} /></Field>
            <Field label="Pharmacie / fournisseur"><Input value={v.fournisseur} onChange={set("fournisseur")} placeholder="Ou « Don de… »" /></Field>
            <Field label="Prix total payé" hint="Laisser vide pour un don."><Money value={v.prix_total} onChange={(x) => setV({ ...v, prix_total: x })} /></Field>
          </div>
          {!!v.prix_total && <div className="card" style={{ padding: 14, display: "grid", gap: 12, background: "var(--surface-2)" }}>
            <label className="check"><input type="checkbox" checked={v.depense} onChange={(e) => setV({ ...v, depense: e.target.checked })} /><strong>Ajouter cet achat aux Dépenses de l'école</strong> <span className="small muted">(catégorie Infirmerie)</span></label>
            {v.depense && <div className="grid g2">
              <Field label="Payé par"><Select value={v.mode} onChange={set("mode")}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="N° de facture"><Input value={v.reference} onChange={set("reference")} /></Field>
            </div>}
          </div>}
        </>}
        <Field label="Remarque"><Textarea rows={2} value={v.note} onChange={set("note")} placeholder={v.type === "sortie" ? "Ex. : trousse de la sortie scolaire" : ""} /></Field>
      </div>
    </Modal>
  );
}

function Historique({ produit, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const s = useSession();
  const [del, setDel] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["infirmerie-mouvements", produit?.id || "tous"], queryFn: () => api.get("/infirmerie/mouvements", produit ? { produit_id: produit.id } : {}) });
  const supprimer = async () => {
    try { await api.del(`/infirmerie/mouvements/${del.id}`); toast(del.depense_id ? "Mouvement et dépense liée supprimés" : "Mouvement supprimé"); INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); }
    catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  return (
    <Modal title={produit ? `Historique — ${produit.nom}` : "Historique du stock"} icon={<History size={20} />} wide onClose={onClose} footer={<button className="btn" onClick={onClose}>Fermer</button>}>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : !data.length ? <p className="muted small">Aucun mouvement.</p> : (
        <div className="table-wrap" style={{ maxHeight: 460, overflowY: "auto" }}><table className="table">
          <thead><tr><th>Date</th>{!produit && <th>Produit</th>}<th>Mouvement</th><th className="r">Quantité</th><th className="hide-m">Détail</th><th /></tr></thead>
          <tbody>{data.map((m) => (
            <tr key={m.id}>
              <td className="num">{date(m.date_mvt)}</td>
              {!produit && <td><strong>{m.produit}</strong></td>}
              <td><span className={`badge ${TYPES[m.type].badge}`}>{TYPES[m.type].court}</span></td>
              <td className="r num"><strong>{m.type === "ajustement" ? (m.quantite > 0 ? "+" : "") : TYPES[m.type].signe}{m.quantite}</strong> <span className="xs muted">{m.unite}</span></td>
              <td className="hide-m small">
                {m.eleve && <div>Donné à {m.eleve}</div>}
                {m.fournisseur && <div>{m.fournisseur}</div>}
                {m.prix_total && <div>{fcfa(m.prix_total)}{m.depense_id ? " · dans les dépenses" : ""}</div>}
                {m.peremption && <div className="xs muted">Péremption {date(m.peremption)}{m.lot ? ` · lot ${m.lot}` : ""}</div>}
                {m.note && <div className="xs muted">{m.note}</div>}
                {m.saisi_par_nom && <div className="xs muted">par {m.saisi_par_nom}</div>}
              </td>
              <td className="r">{s.peut("infirmerie.ecrire") && !m.passage_id && <button className="btn sm ghost icon" onClick={() => setDel(m)} aria-label="Supprimer"><Trash2 size={15} /></button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {del && <Confirm danger title="Supprimer ce mouvement ?" confirmLabel="Supprimer" message={`${TYPES[del.type].court} de ${Math.abs(del.quantite)} ${del.unite} (${del.produit}).${del.depense_id ? " La dépense liée sera aussi supprimée." : ""}`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </Modal>
  );
}

export function Stock() {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const peut = s.peut("infirmerie.ecrire");
  const [form, setForm] = useState(null);
  const [mvt, setMvt] = useState(null);
  const [hist, setHist] = useState(null);
  const [del, setDel] = useState(null);
  const [filtre, setFiltre] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["infirmerie-produits"], queryFn: () => api.get("/infirmerie/produits") });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const bas = data.filter((p) => p.bas), perimes = data.filter((p) => p.perime_bientot);
  const rows = data.filter((p) => !filtre || (filtre === "bas" ? p.bas : p.perime_bientot));
  const supprimer = async () => {
    try { const r = await api.del(`/infirmerie/produits/${del.id}`); toast(r.archive ? "Produit retiré de la liste (son historique est gardé)" : "Produit supprimé"); INV.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); }
    catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  return (
    <div className="stack" style={{ gap: 18 }}>
      {(bas.length > 0 || perimes.length > 0) && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {bas.length > 0 && <button className={`alert ${filtre === "bas" ? "" : ""}`} style={{ margin: 0, cursor: "pointer", border: filtre === "bas" ? "2px solid var(--coral)" : undefined }} onClick={() => setFiltre(filtre === "bas" ? "" : "bas")}>
            <AlertTriangle size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} /><strong>{bas.length} produit{bas.length > 1 ? "s" : ""} à racheter</strong> : {bas.slice(0, 4).map((p) => p.nom).join(", ")}{bas.length > 4 ? "…" : ""}
          </button>}
          {perimes.length > 0 && <button className="alert info" style={{ margin: 0, cursor: "pointer", border: filtre === "perime" ? "2px solid var(--gold)" : undefined }} onClick={() => setFiltre(filtre === "perime" ? "" : "perime")}>
            <CalendarX size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} /><strong>{perimes.length} produit{perimes.length > 1 ? "s" : ""} bientôt périmé{perimes.length > 1 ? "s" : ""}</strong> (moins de 30 jours)
          </button>}
        </div>
      )}
      <div className="card">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {peut && <button className="btn primary" onClick={() => setMvt({ type: "entree" })} disabled={!data.length}><PackagePlus size={17} />Achat / entrée</button>}
            {peut && <button className="btn" onClick={() => setMvt({ type: "ajustement" })} disabled={!data.length}><ClipboardCheck size={17} />Inventaire</button>}
            <button className="btn" onClick={() => setHist("tous")} disabled={!data.length}><History size={17} /><span className="hide-m">Historique</span></button>
          </div>
          {peut && <button className="btn" onClick={() => setForm("new")}><Plus size={17} />Nouveau produit</button>}
        </div>
        {!data.length ? (
          <Empty icon={Pill} title="Aucun produit" action={peut && <button className="btn primary" onClick={() => setForm("new")}><Plus size={16} />Ajouter un produit</button>}>
            Ajoutez les médicaments et le matériel de l'infirmerie (paracétamol, compresses, désinfectant…) avec la quantité en stock.
          </Empty>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Produit</th><th className="r">En stock</th><th className="hide-m r">Alerte à</th><th className="hide-m">Péremption</th><th className="hide-m">Dernier achat</th><th /></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.nom}</strong><div className="xs muted">{FORMES[p.forme] || p.forme || ""}{p.note ? ` · ${p.note}` : ""}</div></td>
                <td className="r"><span className={`badge ${p.stock <= 0 ? "coral" : p.bas ? "gold" : "green"}`} style={{ fontSize: 13 }}>{p.stock} {p.unite}</span></td>
                <td className="hide-m r num muted">{p.seuil}</td>
                <td className="hide-m">{p.peremption ? <span style={{ color: bientot(p.peremption) ? "var(--coral)" : undefined, fontWeight: bientot(p.peremption) ? 700 : 400 }}>{date(p.peremption)}</span> : <span className="muted">—</span>}</td>
                <td className="hide-m">{p.dernier_achat ? date(p.dernier_achat) : <span className="muted">—</span>}</td>
                <td className="r" style={{ whiteSpace: "nowrap" }}>
                  {peut && <button className="btn sm" onClick={() => setMvt({ type: "entree", produit: p })} title="Achat / entrée"><PackagePlus size={15} /><span className="hide-m">Entrée</span></button>}
                  {peut && <button className="btn sm ghost icon" onClick={() => setMvt({ type: "sortie", produit: p })} title="Sortie" aria-label="Sortie"><PackageMinus size={15} /></button>}
                  {peut && p.perime_bientot && <button className="btn sm ghost icon" onClick={() => setMvt({ type: "perime", produit: p })} title="Retirer les périmés" aria-label="Retirer les périmés"><CalendarX size={15} /></button>}
                  <button className="btn sm ghost icon" onClick={() => setHist(p)} title="Historique" aria-label="Historique"><History size={15} /></button>
                  {peut && <button className="btn sm ghost icon" onClick={() => setForm(p)} title="Modifier" aria-label="Modifier"><Pencil size={15} /></button>}
                  {peut && <button className="btn sm ghost icon" onClick={() => setDel(p)} title="Supprimer" aria-label="Supprimer"><Trash2 size={15} /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {form && <ProduitForm produit={form === "new" ? null : form} onClose={() => setForm(null)} />}
      {mvt && <MouvementForm type={mvt.type} produit={mvt.produit} produits={data} onClose={() => setMvt(null)} />}
      {hist && <Historique produit={hist === "tous" ? null : hist} onClose={() => setHist(null)} />}
      {del && <Confirm danger title={`Supprimer ${del.nom} ?`} confirmLabel="Supprimer" message="S'il a déjà été utilisé, il est seulement retiré de la liste et son historique est gardé." onConfirm={supprimer} onClose={() => setDel(null)} />}
    </div>
  );
}
