import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, CATEGORIES, MODES, today } from "../lib/format";
import { Modal, Field, Input, Select, Money, Spinner, ErrorBox, Empty, Confirm, PageHead, useToast } from "../components/ui";

const TEINTES = ["var(--teal)", "var(--gold)", "var(--coral)", "var(--azure)", "var(--rose)", "var(--green)", "#8b6fd6", "#5a8f9c", "#c9a227", "#7c9197", "#b4412f"];

function DepenseForm({ dep, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState(dep || { date_depense: today(), categorie: "fournitures", libelle: "", montant: null, mode: "especes", beneficiaire: "", reference: "", note: "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setError(null);
    try {
      const { id, created_at, saisi_par, saisi_par_nom, annee_id, ...d } = v;
      if (dep) await api.put(`/depenses/${dep.id}`, { ...d, date_depense: d.date_depense.slice(0, 10) }); else await api.post("/depenses", d);
      toast(dep ? "Dépense modifiée" : `Dépense de ${fcfa(v.montant)} enregistrée`);
      ["depenses", "caisse", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onClose();
    } catch (e) { setError(e); }
  };
  return (
    <Modal title={dep ? "Modifier la dépense" : "Nouvelle dépense"} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.libelle || !v.montant}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <Field label="Libellé" required><Input value={v.libelle} onChange={set("libelle")} autoFocus placeholder="Achat de craies et cahiers" /></Field>
        <div className="grid g2">
          <Field label="Montant" required><Money value={v.montant} onChange={(x) => setV({ ...v, montant: x })} /></Field>
          <Field label="Date"><Input type="date" value={v.date_depense?.slice(0, 10)} onChange={set("date_depense")} max={today()} /></Field>
          <Field label="Catégorie"><Select value={v.categorie} onChange={set("categorie")}>{Object.entries(CATEGORIES).filter(([k]) => k !== "electricite_eau" || v.categorie === k).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Mode de paiement"><Select value={v.mode} onChange={set("mode")}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Bénéficiaire"><Input value={v.beneficiaire || ""} onChange={set("beneficiaire")} placeholder="Fournisseur, personne…" /></Field>
          <Field label="N° de facture / pièce"><Input value={v.reference || ""} onChange={set("reference")} /></Field>
        </div>
        <Field label="Remarque"><Input value={v.note || ""} onChange={set("note")} /></Field>
      </div>
    </Modal>
  );
}

export default function Depenses() {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [du, setDu] = useState(today().slice(0, 8) + "01");
  const [au, setAu] = useState(today());
  const [cat, setCat] = useState("");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const f = { du, au, categorie: cat };
  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["depenses", f], queryFn: () => api.get("/depenses", f), placeholderData: keepPreviousData });
  const peut = s.peut("depenses.ecrire");
  const supprimer = async () => {
    try { await api.del(`/depenses/${del.id}`); toast("Dépense supprimée"); ["depenses", "caisse", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); }
    catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  const total = data?.total || 0;

  return (
    <>
      <PageHead title="Dépenses" sub="Sorties d'argent de l'école">
        {peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={17} />Nouvelle dépense</button>}
      </PageHead>
      {data && (
        <div className="dash" style={{ marginBottom: 22 }}>
          <div className="card kpi c4">
            <div className="top"><span className="label">Total des dépenses</span><span className="ic coral"><Receipt size={20} /></span></div>
            <div className="value" style={{ color: "var(--coral)" }}>{fcfa(total)}</div>
            <div className="sub">{data.nombre} opération{data.nombre > 1 ? "s" : ""} du {date(du)} au {date(au)}</div>
          </div>
          <div className="card c8">
            <div className="card-head"><h3>Répartition par catégorie</h3></div>
            <div className="card-body">
              {data.categories.length ? <>
                <div className="fill" style={{ height: 14, borderRadius: 8 }}>{data.categories.map((c, i) => <i key={c.categorie} title={CATEGORIES[c.categorie]} style={{ width: `${(c.montant / total) * 100}%`, background: TEINTES[i % TEINTES.length] }} />)}</div>
                <div className="legend" style={{ marginTop: 14 }}>{data.categories.map((c, i) => <span key={c.categorie}><i className="dot" style={{ background: TEINTES[i % TEINTES.length] }} />{CATEGORIES[c.categorie]} <strong>{fcfa(c.montant)}</strong></span>)}</div>
              </> : <p className="muted">Aucune dépense sur la période.</p>}
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <div className="toolbar">
          <div className="date-range">
            <input className="input" type="date" value={du} onChange={(e) => setDu(e.target.value)} aria-label="Du" /><span className="muted">au</span>
            <input className="input" type="date" value={au} onChange={(e) => setAu(e.target.value)} aria-label="Au" />
          </div>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie"><option value="">Toutes les catégories</option>{Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </div>
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.rows.length ? (
          <Empty icon={Receipt} title="Aucune dépense" action={peut && <button className="btn primary" onClick={() => setEdit("new")}><Plus size={16} />Enregistrer une dépense</button>}>Aucune dépense sur cette période.</Empty>
        ) : (
          <div className="table-wrap" style={{ opacity: isFetching ? 0.65 : 1 }}>
            <table className="table">
              <thead><tr><th>Date</th><th>Libellé</th><th className="hide-m">Catégorie</th><th className="hide-m">Bénéficiaire</th><th className="hide-m">Mode</th><th className="r">Montant</th>{peut && <th />}</tr></thead>
              <tbody>{data.rows.map((d) => (
                <tr key={d.id}>
                  <td className="num">{date(d.date_depense)}</td>
                  <td><strong>{d.libelle}</strong>{d.reference && <div className="xs muted">Pièce {d.reference}</div>}</td>
                  <td className="hide-m"><span className="badge">{CATEGORIES[d.categorie]}</span></td>
                  <td className="hide-m">{d.beneficiaire || "—"}</td>
                  <td className="hide-m">{MODES[d.mode]}</td>
                  <td className="r amount" style={{ color: "var(--coral)" }}>{fcfa(d.montant)}</td>
                  {peut && <td className="r" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn sm ghost icon" onClick={() => setEdit(d)} aria-label="Modifier"><Pencil size={15} /></button>
                    <button className="btn sm ghost icon" onClick={() => setDel(d)} aria-label="Supprimer"><Trash2 size={15} /></button>
                  </td>}
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <DepenseForm dep={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {del && <Confirm danger title="Supprimer cette dépense ?" confirmLabel="Supprimer" message={`${del.libelle} — ${fcfa(del.montant)}`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </>
  );
}
