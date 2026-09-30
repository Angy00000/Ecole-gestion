import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Wallet, Check, Plus, X, Banknote, Smartphone, FileText, Landmark } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, initiales, moisAbr, moisLong, TYPES, MODES, today, libelleLigne } from "../lib/format";
import { Modal, Field, Input, Money, ErrorBox, Spinner, useToast } from "./ui";
const moisAnnee = (a) => { const out = []; if (!a) return out; const d = new Date(a.debut); d.setDate(1); const f = new Date(a.fin); while (d <= f) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() + 1); } return out; };

const MODE_IC = { especes: Banknote, wave: Smartphone, orange_money: Smartphone, cheque: FileText, virement: Landmark };
const EXTRAS = ["cours_soir", "cantine_jour", "fournitures", "cotisation", "cours_vacances", "transport", "autre"];

function ChoixEleve({ onPick }) {
  const s = useSession();
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(() => api.get("/eleves", { q, annee_id: s.annee?.id, limit: 8 }).then((r) => setRes(r.rows)).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="stack" style={{ gap: 12, padding: "22px 0" }}>
      <div className="with-icon"><Search size={18} /><input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, prénom ou matricule de l'élève…" /></div>
      <div className="pick-list">
        {q.trim().length < 2 ? <p className="muted small">Tapez au moins deux lettres pour trouver l'élève.</p>
          : !res.length ? <p className="muted small">Aucun élève inscrit ne correspond.</p>
          : res.map((r) => (
            <button key={r.id} className="pick" onClick={() => onPick(r)}>
              <span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span>
              <div className="grow"><strong>{r.nom} {r.prenom}</strong><span>{r.matricule}</span></div>
              <span className={`chip ${r.cycle || ""}`}>{r.classe}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

export default function Encaissement({ inscriptionId: initIns, eleve: initEleve, onClose, onSaved }) {
  const s = useSession();
  const toast = useToast();
  const tarif = { cours_soir: s.annee?.frais_cours_soir, cantine_jour: s.annee?.frais_cantine_jour, cotisation: s.annee?.frais_cotisation, fournitures: s.annee?.frais_fournitures, cours_vacances: s.annee?.frais_cours_vacances };
  const moisDispo = moisAnnee(s.annee);
  const moisCourant = new Date().toISOString().slice(0, 7);
  const ajouterExtra = (t) => setExtras((x) => [...x, { type: t, montant: tarif[t] || null, ...(t === "cours_soir" ? { mois: moisDispo.includes(moisCourant) ? moisCourant : moisDispo[0] } : {}), ...(t === "cantine_jour" ? { jours: 1 } : {}) }]);
  const majExtra = (k, patch) => setExtras((x) => x.map((e, i) => (`x:${i}` === k ? { ...e, ...patch } : e)));
  const qc = useQueryClient();
  const [eleve, setEleve] = useState(initEleve || null);
  const [insId, setInsId] = useState(initIns || null);
  const [sel, setSel] = useState({});          // clé -> montant
  const [extras, setExtras] = useState([]);    // {type, montant}
  const [mode, setMode] = useState("especes");
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const sit = useQuery({ queryKey: ["situation", insId], queryFn: () => api.get(`/inscriptions/${insId}/situation`), enabled: !!insId });
  const lignesDues = sit.data?.lignes.filter((l) => l.groupe !== "autre") || [];
  const frais = lignesDues.filter((l) => l.groupe === "frais");
  const mois = lignesDues.filter((l) => l.groupe === "mois" && l.du > 0);
  const key = (l) => (l.groupe === "mois" ? `m:${l.mois}` : `f:${l.type}`);

  // Pré-sélection intelligente : frais d'inscription restants + premier mois non soldé
  useEffect(() => {
    if (!sit.data) return;
    const s0 = {};
    frais.forEach((l) => { if (l.du > l.paye) s0[key(l)] = l.du - l.paye; });
    const m = mois.find((l) => l.du > l.paye);
    if (m && !Object.keys(s0).length) s0[key(m)] = m.du - m.paye;
    setSel(s0);
  }, [sit.data]);

  const toggle = (l) => setSel((x) => {
    const k = key(l), n = { ...x };
    if (k in n) delete n[k]; else n[k] = Math.max(l.du - l.paye, 0) || l.du;
    return n;
  });

  const lignes = useMemo(() => {
    const out = [];
    [...frais, ...mois].forEach((l) => { const k = key(l); if (k in sel) out.push({ type: l.type, mois: l.mois, montant: sel[k] || 0, k }); });
    extras.forEach((e, i) => out.push({ ...e, k: `x:${i}` }));
    return out;
  }, [sel, extras, sit.data]);
  const total = lignes.reduce((t, l) => t + (Number(l.montant) || 0), 0);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api.post("/recus", {
        inscription_id: insId, mode, date_paiement: date, reference,
        lignes: lignes.map(({ type, mois, montant, jours }) => ({ type, mois, montant })),
        note: [note, ...lignes.filter((l) => l.type === "cantine_jour").map((l) => `Cantine : ${l.jours} jour(s)`)].filter(Boolean).join(" · "),
      });
      toast(`Reçu ${r.numero} enregistré — ${fcfa(r.montant)}`);
      ["situation", "eleve", "dashboard", "recus", "impayes", "caisse"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onSaved?.(r);
    } catch (e) { setError(e); }
    setBusy(false);
  };

  const title = eleve ? `Encaisser — ${eleve.prenom} ${eleve.nom}` : "Nouvel encaissement";
  return (
    <Modal wide pad={false} title={title} onClose={onClose}
      icon={<span className="ic green" style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center" }}><Wallet size={19} /></span>}
      footer={insId && <>
        <span className="muted small" style={{ marginRight: "auto" }}>{lignes.length} ligne{lignes.length > 1 ? "s" : ""}</span>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" onClick={save} disabled={busy || total <= 0}><Check size={17} />{busy ? "Enregistrement…" : `Encaisser ${fcfa(total)}`}</button>
      </>}>
      {!insId ? <ChoixEleve onPick={(r) => { setEleve(r); setInsId(r.inscription_id); }} /> : sit.isLoading ? <Spinner /> : sit.error ? <ErrorBox error={sit.error} /> : (
        <div className="enc">
          <div className="enc-left">
            <ErrorBox error={error} />
            <div className="enc-summary">
              <div><span className="l">Total de l'année</span><strong>{fcfa(sit.data.total_du)}</strong></div>
              <div><span className="l">Déjà payé</span><strong style={{ color: "var(--green)" }}>{fcfa(sit.data.total_paye)}</strong></div>
              <div><span className="l">Reste à payer</span><strong style={{ color: sit.data.reste_annee ? "var(--coral)" : "var(--green)" }}>{fcfa(sit.data.reste_annee)}</strong></div>
            </div>

            {frais.length > 0 && <>
              <h4 className="enc-h">Frais d'inscription</h4>
              <div className="enc-frais">
                {frais.map((l) => {
                  const k = key(l), solde = l.paye >= l.du, on = k in sel;
                  return (
                    <label key={k} className={`frais-row ${on ? "on" : ""} ${solde ? "solde" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(l)} />
                      <div className="grow"><strong>{TYPES[l.type]}</strong><span>{solde ? "Réglé" : l.paye ? `${fcfa(l.paye)} déjà payé sur ${fcfa(l.du)}` : fcfa(l.du)}</span></div>
                      {solde && !on ? <span className="badge green"><Check size={12} />Payé</span> : <span className="amount">{fcfa(Math.max(l.du - l.paye, 0))}</span>}
                    </label>
                  );
                })}
              </div>
            </>}

            <h4 className="enc-h">Mensualités {sit.data.inscription.annee}</h4>
            <div className="months">
              {mois.map((l) => {
                const k = key(l), on = k in sel, solde = l.paye >= l.du, partiel = l.paye > 0 && !solde;
                return (
                  <button key={k} type="button" className={`month ${on ? "on" : ""} ${solde ? "paid" : partiel ? "partial" : ""}`} onClick={() => toggle(l)} title={moisLong(l.mois)}>
                    <span className="mn">{moisAbr(l.mois)}</span>
                    <span className="mv">{solde ? <Check size={16} /> : fcfa(l.du - l.paye).replace(" F", "")}</span>
                    <span className="ms">{solde ? "Payé" : partiel ? "Partiel" : on ? "Choisi" : "À payer"}</span>
                  </button>
                );
              })}
            </div>

            <h4 className="enc-h">Autres paiements</h4>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {EXTRAS.map((t) => <button key={t} type="button" className="btn sm" onClick={() => ajouterExtra(t)}><Plus size={14} />{TYPES[t]}</button>)}
            </div>
          </div>

          <div className="enc-right">
            <h4 className="enc-h" style={{ marginTop: 0 }}>Détail du reçu</h4>
            <div className="lines">
              {!lignes.length && <p className="muted small">Sélectionnez les frais ou les mois à encaisser.</p>}
              {lignes.map((l) => (
                <div key={l.k} className="line">
                  <span className="grow">{l.type === "cours_soir" ? <span className="line-opt">Cours du soir
                      <select className="select sm" value={l.mois} onChange={(e) => majExtra(l.k, { mois: e.target.value })} aria-label="Mois">{moisDispo.map((m) => <option key={m} value={m}>{moisLong(m)}</option>)}</select></span>
                    : l.type === "cantine_jour" ? <span className="line-opt">Cantine
                      <input className="input sm" type="number" min="1" value={l.jours} onChange={(e) => { const j = Math.max(1, Number(e.target.value) || 1); majExtra(l.k, { jours: j, montant: j * (tarif.cantine_jour || 0) }); }} aria-label="Nombre de jours" /> jour{l.jours > 1 ? "s" : ""}</span>
                    : libelleLigne(l)}</span>
                  <Money value={l.montant} onChange={(v) => l.k.startsWith("x:")
                    ? setExtras(extras.map((e, i) => (`x:${i}` === l.k ? { ...e, montant: v } : e)))
                    : setSel({ ...sel, [l.k]: v })} aria-label={`Montant ${libelleLigne(l)}`} />
                  <button className="btn ghost icon sm" onClick={() => l.k.startsWith("x:") ? setExtras(extras.filter((_, i) => `x:${i}` !== l.k)) : setSel(Object.fromEntries(Object.entries(sel).filter(([k]) => k !== l.k)))} aria-label="Retirer"><X size={15} /></button>
                </div>
              ))}
            </div>
            <div className="enc-total"><span>Total</span><strong>{fcfa(total)}</strong></div>

            <Field label="Mode de paiement">
              <div className="modes">
                {Object.entries(MODES).map(([k, l]) => { const I = MODE_IC[k]; return <button key={k} type="button" className={`mode ${mode === k ? "on" : ""} m-${k}`} onClick={() => setMode(k)}><I size={16} />{l}</button>; })}
              </div>
            </Field>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today()} /></Field>
              <Field label={mode === "cheque" ? "N° de chèque" : mode === "especes" ? "Référence" : "N° de transaction"}><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={mode === "especes" ? "Facultatif" : ""} /></Field>
            </div>
            <Field label="Remarque"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" /></Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
