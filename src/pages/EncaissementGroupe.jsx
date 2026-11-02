import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Check, Users, Printer, Banknote, Smartphone, FileText, Landmark, AlertCircle, RotateCcw, ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, initiales, moisLong, moisAbr, TYPES, MODES, today } from "../lib/format";
import { Field, Input, Money, Select, Spinner, ErrorBox, Empty, PageHead, Confirm, useToast } from "../components/ui";

const MODE_IC = { especes: Banknote, wave: Smartphone, orange_money: Smartphone, cheque: FileText, virement: Landmark };
// Ce qu'on peut encaisser en groupe (un reçu par élève).
const QUOI = ["mensualite", "inscription", "uniforme", "tenue_sport", "cantine", "cotisation", "cours_soir", "cantine_jour", "fournitures", "transport", "cours_vacances", "autre"];
const SUIVIS = ["mensualite", "inscription", "uniforme", "tenue_sport", "cantine", "cotisation", "cours_soir"];
const moisAnnee = (a) => { const out = []; if (!a) return out; const d = new Date(a.debut); d.setDate(1); const f = new Date(a.fin); while (d <= f) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() + 1); } return out; };

export default function EncaissementGroupe() {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const moisDispo = moisAnnee(s.annee);
  const mc = new Date().toISOString().slice(0, 7);
  const tarif = { cours_soir: s.annee?.frais_cours_soir, cantine_jour: s.annee?.frais_cantine_jour, fournitures: s.annee?.frais_fournitures, cours_vacances: s.annee?.frais_cours_vacances };
  const [classe, setClasse] = useState("");
  const [type, setType] = useState("mensualite");
  const [moisSel, setMoisSel] = useState([moisDispo.includes(mc) ? mc : moisDispo[0] || mc]);
  const mois = moisSel.join(",");
  const basculerMois = (m) => setMoisSel((x) => x.includes(m) ? (x.length > 1 ? x.filter((y) => y !== m) : x) : [...x, m].sort());
  const [libelle, setLibelle] = useState("");
  const [montantCommun, setMontantCommun] = useState(null);
  const [q, setQ] = useState("");
  const [dus, setDus] = useState(true);
  const [sel, setSel] = useState({});        // inscription_id -> montant
  const [mode, setMode] = useState("especes");
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [resultat, setResultat] = useState(null);

  const avecMois = type === "mensualite" || type === "cours_soir";
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const liste = useQuery({
    queryKey: ["enc-groupe", s.annee?.id, classe, type, avecMois ? mois : ""],
    queryFn: () => api.get("/encaissement-groupe", { annee_id: s.annee?.id, classe_id: classe || undefined, type, mois: avecMois ? mois : undefined }),
  });
  // Plusieurs mois : on additionne le dû et le déjà payé de chaque mois choisi.
  // (un mois payé en trop ne doit pas réduire ce qui reste sur les autres mois)
  const donnees = useMemo(() => (liste.data || []).map((r) => {
    if (!r.detail) return r;
    if (r.detail.some((d) => d.du == null)) return { ...r, du: null, paye: null };
    const du = r.detail.reduce((t, d) => t + d.du, 0), reste = r.detail.reduce((t, d) => t + Math.max(d.du - d.paye, 0), 0);
    return { ...r, du, paye: du - reste };
  }), [liste.data]);
  // Suivi du reste dû seulement si l'école a un prix pour ce frais (sinon montant libre).
  const suivi = SUIVIS.includes(type) && !donnees.some((r) => r.du == null);
  useEffect(() => { setSel({}); setMontantCommun(tarif[type] ? tarif[type] * (avecMois ? moisSel.length : 1) : null); }, [classe, type, mois]);

  const reste = (r) => (r.du == null ? null : Math.max(r.du - r.paye, 0));
  const parDefaut = (r) => (suivi ? reste(r) : montantCommun || null);
  const rech = q.trim().toLowerCase();
  const rows = donnees.filter((r) => (!suivi || !dus || reste(r) > 0 || r.inscription_id in sel)
    && (!rech || `${r.nom} ${r.prenom} ${r.prenom} ${r.matricule}`.toLowerCase().includes(rech)));
  const choisis = donnees.filter((r) => r.inscription_id in sel);
  const total = choisis.reduce((t, r) => t + (Number(sel[r.inscription_id]) || 0), 0);
  const trop = choisis.filter((r) => suivi && (Number(sel[r.inscription_id]) || 0) > reste(r));
  const vides = choisis.filter((r) => !(Number(sel[r.inscription_id]) > 0));
  const tousCoches = rows.length > 0 && rows.every((r) => r.inscription_id in sel || (suivi && reste(r) === 0));
  const cocher = (r) => setSel((x) => { const n = { ...x }; if (r.inscription_id in n) delete n[r.inscription_id]; else n[r.inscription_id] = parDefaut(r); return n; });
  const toutCocher = () => setSel((x) => {
    const n = { ...x };
    if (tousCoches) rows.forEach((r) => delete n[r.inscription_id]);
    else rows.forEach((r) => { if (!(r.inscription_id in n) && (!suivi || reste(r) > 0)) n[r.inscription_id] = parDefaut(r); });
    return n;
  });
  const appliquerCommun = (v) => { setMontantCommun(v); setSel((x) => Object.fromEntries(Object.keys(x).map((k) => [k, v]))); };
  const nomLigne = type === "autre" ? libelle.trim() || "Autre" : avecMois ? (moisSel.length === 1 ? `${TYPES[type]} ${moisLong(moisSel[0])}` : `${TYPES[type]} : ${moisSel.map(moisAbr).join(", ")} (${moisSel.length} mois)`) : TYPES[type];
  // Répartit le montant versé sur les mois choisis, du plus ancien au plus récent.
  const lignesDe = (e) => {
    const v = Number(sel[e.inscription_id]) || 0;
    if (!avecMois) return [{ type, montant: v, libelle: type === "autre" ? libelle.trim() : undefined }];
    const det = e.detail || moisSel.map((m) => ({ mois: m, du: null, paye: 0 }));
    if (!suivi) { const n = det.length, part = Math.floor(v / n); return det.map((d, i) => ({ type, mois: d.mois, montant: i === n - 1 ? v - part * (n - 1) : part })).filter((l) => l.montant > 0); }
    let reste = v; const out = [];
    for (const d of det) { const m = Math.min(Math.max(d.du - d.paye, 0), reste); if (m > 0) { out.push({ type, mois: d.mois, montant: m }); reste -= m; } }
    return out;
  };
  const blocage = !choisis.length ? "Cochez les élèves qui ont payé." : vides.length ? `${vides.length} élève(s) sans montant.` : trop.length ? `${trop.length} montant(s) dépassent ce qui reste à payer.` : type === "autre" && !libelle.trim() ? "Précisez le motif du paiement." : "";

  const encaisser = async () => {
    setConfirmer(false); setBusy(true);
    try {
      const r = await api.post("/recus/lot", {
        mode, date_paiement: date, reference, note, cle_lot: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        items: choisis.map((e) => ({ inscription_id: e.inscription_id, lignes: lignesDe(e) })),
      });
      const noms = Object.fromEntries(donnees.map((e) => [e.inscription_id, e]));
      setResultat({ ...r, noms });
      setSel({});
      ["situation", "eleve", "dashboard", "recus", "impayes", "caisse", "service", "factures", "enc-groupe"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast(`${r.recus.length} reçu${r.recus.length > 1 ? "s" : ""} enregistré${r.recus.length > 1 ? "s" : ""} — ${fcfa(r.total)}`);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  if (resultat) {
    const ids = resultat.recus.map((r) => r.id).join(",");
    return (
      <>
        <PageHead title="Encaissement groupé" sub={`${nomLigne} · ${MODES[mode]} · ${fcfa(resultat.total)}`} back={<button className="btn ghost sm" onClick={() => nav("/paiements")} style={{ marginBottom: 6 }}><ArrowLeft size={16} />Encaissements</button>} />
        <div className="card" style={{ padding: 22, marginBottom: 18 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <span className="ic green" style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center" }}><Check size={24} /></span>
            <div className="grow"><h3 style={{ margin: 0 }}>{resultat.recus.length} reçu{resultat.recus.length > 1 ? "s" : ""} enregistré{resultat.recus.length > 1 ? "s" : ""}</h3><span className="muted small">Total encaissé : <strong>{fcfa(resultat.total)}</strong></span></div>
            {resultat.recus.length > 0 && <button className="btn primary" onClick={() => nav(`/recus/lot?ids=${ids}`)}><Printer size={17} />Imprimer tous les reçus</button>}
            <button className="btn" onClick={() => setResultat(null)}><RotateCcw size={16} />Nouvel encaissement groupé</button>
          </div>
        </div>
        {resultat.erreurs.length > 0 && <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-head" style={{ paddingBottom: 10 }}><AlertCircle size={18} color="var(--coral)" /><h3>Non encaissés ({resultat.erreurs.length})</h3></div>
          <ul className="feed">{resultat.erreurs.map((x) => { const e = resultat.noms[x.inscription_id] || {}; return <li key={x.inscription_id} style={{ cursor: "default" }}><div className="grow"><strong>{e.prenom} {e.nom}</strong><span>{x.erreur}</span></div></li>; })}</ul>
        </div>}
        <div className="card"><div className="table-wrap"><table className="table">
          <thead><tr><th>Reçu</th><th>Élève</th><th className="hide-m">Classe</th><th className="r">Montant</th><th /></tr></thead>
          <tbody>{resultat.recus.map((r) => { const e = resultat.noms[r.inscription_id] || {}; return (
            <tr key={r.id} className="clickable" onClick={() => nav(`/recus/${r.id}`)}><td className="num"><strong>{r.numero}</strong></td><td>{e.prenom} {e.nom}</td><td className="hide-m">{e.classe}</td><td className="r amount">{fcfa(r.montant)}</td><td className="r"><FileText size={15} className="muted" /></td></tr>); })}</tbody>
        </table></div></div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Encaissement groupé" sub="Cochez les élèves qui ont payé : un reçu est créé pour chacun." back={<button className="btn ghost sm" onClick={() => nav("/paiements")} style={{ marginBottom: 6 }}><ArrowLeft size={16} />Encaissements</button>} />
      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="grid g4 eg-choix">
          <Field label="Ce qui est payé">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {QUOI.map((t) => <option key={t} value={t}>{t === "cantine" ? "Inscription cantine" : TYPES[t]}</option>)}            </Select>
          </Field>
          {type === "autre" && <Field label="Motif"><Input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. sortie au zoo" list="eg-perso" />
            <datalist id="eg-perso">{s.typesPaiement?.map((tp) => <option key={tp.id} value={tp.libelle} />)}</datalist></Field>}
          <Field label="Classe">
            <Select value={classe} onChange={(e) => setClasse(e.target.value)}><option value="">Toutes les classes</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select>
          </Field>
          {!suivi && <Field label={avecMois && moisSel.length > 1 ? `Montant par élève (${moisSel.length} mois)` : "Montant par élève"} hint="Modifiable ligne par ligne"><Money value={montantCommun} onChange={appliquerCommun} /></Field>}
        </div>
        {avecMois && <div className="eg-mois">
          <span className="eg-mois-l">Mois payés <small>(cochez-en plusieurs si les parents paient plusieurs mois)</small></span>
          <div className="eg-mois-liste">{moisDispo.map((m) => <button key={m} type="button" className={moisSel.includes(m) ? "on" : ""} onClick={() => basculerMois(m)}>{moisSel.includes(m) && <Check size={13} />}{moisAbr(m)} {m.slice(2, 4)}</button>)}</div>
        </div>}
      </div>

      <div className="card eg-liste">
        <div className="toolbar">
          <div className="with-icon" style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un élève" style={{ paddingLeft: 36 }} /></div>
          {suivi && <label className="check small"><input type="checkbox" checked={dus} onChange={(e) => setDus(e.target.checked)} />Seulement ceux qui doivent encore</label>}
          <span className="spacer" />
          <span className="small muted">{rows.length} élève{rows.length > 1 ? "s" : ""}</span>
        </div>
        {liste.isLoading ? <Spinner /> : liste.error ? <div style={{ padding: 18 }}><ErrorBox error={liste.error} /></div> : !rows.length ? (
          <Empty icon={Users} title={suivi && dus ? "Tout le monde a déjà payé" : "Aucun élève"}>{suivi && dus ? `Personne ne doit encore « ${nomLigne} »${classe ? " dans cette classe" : ""}.` : "Aucun élève inscrit ne correspond."}</Empty>
        ) : (
          <div className="table-wrap"><table className="table eg-table">
            <thead><tr>
              <th style={{ width: 44 }}><input type="checkbox" checked={tousCoches} onChange={toutCocher} aria-label="Tout cocher" /></th>
              <th>Élève</th>{!classe && <th className="hide-m">Classe</th>}
              {suivi && <th className="r hide-m">Reste à payer</th>}
              <th className="r" style={{ width: 170 }}>Montant payé</th>
            </tr></thead>
            <tbody>{rows.map((r) => {
              const on = r.inscription_id in sel, rs = reste(r), solde = suivi && rs === 0, v = Number(sel[r.inscription_id]) || 0;
              return (
                <tr key={r.inscription_id} className={on ? "eg-on" : solde ? "eg-solde" : ""} onClick={(e) => { if (!solde && !e.target.closest("input")) cocher(r); }}>
                  <td><input type="checkbox" checked={on} disabled={solde && !on} onChange={() => cocher(r)} aria-label={`${r.prenom} ${r.nom}`} /></td>
                  <td><div className="row" style={{ gap: 10 }}><span className={`avatar sm ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span><div><strong>{r.nom} {r.prenom}</strong><div className="xs muted">{r.matricule}</div></div></div></td>
                  {!classe && <td className="hide-m"><span className={`chip ${r.cycle || ""}`}>{r.classe}</span></td>}
                  {suivi && <td className="r hide-m nw">{solde ? <span className="badge green"><Check size={12} />Payé</span> : <>{fcfa(rs)}{r.paye > 0 && <div className="xs muted">déjà {fcfa(r.paye)}</div>}</>}</td>}
                  <td className="r" onClick={(e) => e.stopPropagation()}>
                    {on ? <div className="eg-montant"><Money value={sel[r.inscription_id]} onChange={(x) => setSel({ ...sel, [r.inscription_id]: x })} aria-label={`Montant ${r.prenom}`} />
                      {suivi && v > 0 && v < rs && <span className="xs" style={{ color: "var(--gold-ink, #8a6d00)" }}>partiel, reste {fcfa(rs - v)}</span>}
                      {avecMois && moisSel.length > 1 && v > 0 && <span className="xs muted">{lignesDe(r).map((l) => `${moisAbr(l.mois)} ${fcfa(l.montant)}`).join(" · ")}</span>}
                      {suivi && v > rs && <span className="xs" style={{ color: "var(--coral)" }}>dépasse le reste</span>}</div>
                      : <span className="muted small">—</span>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>

      <div className="eg-barre card">
        <div className="eg-barre-l">
          <div className="modes">{Object.entries(MODES).map(([k, l]) => { const I = MODE_IC[k]; return <button key={k} type="button" className={`mode ${mode === k ? "on" : ""} m-${k}`} onClick={() => setMode(k)}><I size={16} />{l}</button>; })}</div>
          <div className="row eg-champs">
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={mode === "especes" ? "Référence (facultatif)" : "N° de transaction"} aria-label="Référence" />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Remarque (facultatif)" aria-label="Remarque" />
          </div>
        </div>
        <div className="eg-barre-r">
          <span className="small" style={{ color: blocage && choisis.length ? "var(--coral)" : "var(--muted)", fontWeight: 700 }}>{blocage || `${choisis.length} élève${choisis.length > 1 ? "s" : ""} · ${nomLigne}`}</span>
          <button className="btn primary lg" disabled={!!blocage || busy} onClick={() => setConfirmer(true)}><Check size={18} />{busy ? "Enregistrement…" : `Encaisser ${fcfa(total)}`}</button>
        </div>
      </div>

      {confirmer && <Confirm title={`Encaisser ${fcfa(total)} ?`} confirmLabel={`Créer ${choisis.length} reçu${choisis.length > 1 ? "s" : ""}`}
        message={`${choisis.length} élève${choisis.length > 1 ? "s" : ""} · ${nomLigne} · ${MODES[mode]} · le ${date.split("-").reverse().join("/")}. Un reçu sera créé pour chaque élève.`}
        onConfirm={encaisser} onClose={() => setConfirmer(false)} />}
    </>
  );
}
