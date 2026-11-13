import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Search, Download, MessageCircle, Wallet, PartyPopper, Phone, Printer, Send, Check } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, initiales, moisLong, moisAbr, nombre, telWa } from "../lib/format";
import { Select, Spinner, ErrorBox, Empty, PageHead, Modal, Textarea } from "../components/ui";
import Encaissement from "../components/Encaissement";

const moisDe = (annee) => {
  if (!annee) return [];
  const out = []; const d = new Date(annee.debut); d.setDate(1); const f = new Date(annee.fin);
  while (d <= f) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() + 1); }
  return out;
};

const ilYa = (d) => {
  if (!d) return null;
  const j = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return j <= 0 ? "aujourd'hui" : j === 1 ? "hier" : `il y a ${j} jours`;
};
const MODELE = "Bonjour {parent}, {ecole} vous informe que la scolarité de {eleve} ({classe}) présente un reste à payer de {montant} ({detail}). Merci de passer régulariser au secrétariat ou par Wave / Orange Money. Cordialement, la Direction.";
const detailMois = (r) => [r.frais > r.frais_payes ? "frais d'inscription" : null, ...(r.liste_mois || "").split(",").filter(Boolean).map((m) => moisLong(m))].filter(Boolean).join(", ");
const remplir = (modele, r, etab) => modele.replace(/\{parent\}/g, r.parent || "").replace(/\{ecole\}/g, etab?.nom || "l'école")
  .replace(/\{eleve\}/g, `${r.prenom} ${r.nom}`).replace(/\{classe\}/g, r.classe || "").replace(/\{montant\}/g, fcfa(r.reste)).replace(/\{detail\}/g, detailMois(r) || "mois échus")
  .replace(/\s+,/g, ",").replace(/Bonjour ,/, "Bonjour,");

// Relancer tous les parents en retard, un par un, sans rien oublier
function RelancesSerie({ rows, jusqua, onRelance, onClose }) {
  const s = useSession();
  const [modele, setModele] = useState(MODELE);
  const [filtre, setFiltre] = useState("7");
  const [faits, setFaits] = useState({});
  const liste = rows.filter((r) => r.telephone && (filtre === "tous" || !r.derniere_relance || Date.now() - new Date(r.derniere_relance).getTime() > Number(filtre) * 864e5));
  const sansTel = rows.filter((r) => !r.telephone).length;
  const total = liste.reduce((t, r) => t + r.reste, 0);
  return (
    <Modal title="Relancer les parents" icon={<Send size={20} />} wide onClose={onClose} footer={<button className="btn" onClick={onClose}>Fermer</button>}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="between" style={{ gap: 12, flexWrap: "wrap" }}>
          <span className="small"><strong>{liste.length}</strong> parent{liste.length > 1 ? "s" : ""} à relancer · {fcfa(total)}{sansTel ? <span className="muted"> · {sansTel} sans numéro</span> : ""}</span>
          <Select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Déjà relancés" style={{ maxWidth: 300 }}>
            <option value="7">Pas relancés depuis 7 jours</option><option value="3">Pas relancés depuis 3 jours</option><option value="14">Pas relancés depuis 14 jours</option><option value="tous">Tous, même relancés récemment</option>
          </Select>
        </div>
        <details>
          <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>Modifier le message</summary>
          <Textarea rows={4} value={modele} onChange={(e) => setModele(e.target.value)} style={{ marginTop: 8 }} />
          <p className="xs muted">Mots remplacés automatiquement : {"{parent} {eleve} {classe} {montant} {detail} {ecole}"}. <button className="btn sm ghost" onClick={() => setModele(MODELE)}>Message d'origine</button></p>
        </details>
        <p className="xs muted" style={{ margin: 0 }}>Cliquez sur « Envoyer » : WhatsApp s'ouvre avec le message prêt pour ce parent. Revenez ici et passez au suivant. Chaque relance est notée.</p>
        {!liste.length ? <p className="muted small">Tous les parents ont déjà été relancés récemment.</p> : (
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}><table className="table">
            <tbody>{liste.map((r) => {
              const fait = faits[r.inscription_id];
              return (
                <tr key={r.inscription_id} style={fait ? { opacity: 0.55 } : undefined}>
                  <td><strong>{r.nom} {r.prenom}</strong><div className="xs muted">{r.classe} · {r.parent || "Parent"} · {r.telephone}</div>
                    <div className="xs muted">{detailMois(r)}{r.derniere_relance ? ` · relancé ${ilYa(r.derniere_relance)}` : ""}</div></td>
                  <td className="r amount" style={{ color: "var(--coral)" }}>{fcfa(r.reste)}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    <a className={`btn sm ${fait ? "" : "wa"}`} href={`https://wa.me/${telWa(r.telephone)}?text=${encodeURIComponent(remplir(modele, r, s.etablissement))}`} target="_blank" rel="noreferrer"
                      onClick={() => { setFaits((x) => ({ ...x, [r.inscription_id]: true })); onRelance(r, jusqua); }}>
                      {fait ? <><Check size={15} />Envoyé</> : <><MessageCircle size={15} />Envoyer</>}
                    </a>
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
    </Modal>
  );
}

export default function Impayes() {
  const s = useSession();
  const nav = useNavigate();
  const mois = moisDe(s.annee);
  const courant = new Date().toISOString().slice(0, 7);
  // Par défaut : jusqu'au mois précédent (le mois en cours n'est pas encore en retard).
  const precedent = (() => { const [y, m] = courant.split("-").map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const [jusqua, setJusqua] = useState(mois.includes(precedent) ? precedent : mois[0] || courant);
  const [classe, setClasse] = useState("");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [enc, setEnc] = useState(null);
  const [serie, setSerie] = useState(false);
  const qc = useQueryClient();
  // Garde la trace de la relance (sans bloquer l'ouverture de WhatsApp)
  const noterRelance = (r, mois) => api.post("/relances", { inscription_id: r.inscription_id, montant: r.reste, jusqua: mois, telephone: r.telephone })
    .then(() => qc.invalidateQueries({ queryKey: ["impayes"] })).catch(() => {});
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const f = { annee_id: s.annee?.id, mois: jusqua, classe_id: classe, q: dq };
  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["impayes", f], queryFn: () => api.get("/impayes", f), placeholderData: keepPreviousData });

  const relance = (r) => remplir(MODELE, r, s.etablissement);
  const exporter = () => {
    const rows = [["Matricule", "Nom", "Prénom", "Classe", "Parent", "Téléphone", "Mois impayés", "Reste à payer"], ...data.rows.map((r) => [r.matricule, r.nom, r.prenom, r.classe, r.parent || "", r.telephone || "", r.mois_impayes, r.reste])];
    const csv = "\ufeff" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `impayes-${jusqua}.csv`; a.click();
  };

  return (
    <>
      <PageHead title="Impayés" sub={`Mensualités et frais échus jusqu'à ${moisLong(jusqua)} inclus`}>
        {data?.rows.length > 0 && <button className="btn wa" onClick={() => setSerie(true)}><Send size={17} />Relancer en série</button>}
        {data?.rows.length > 0 && <button className="btn" onClick={exporter}><Download size={17} /><span className="hide-m">Exporter</span></button>}
        {data?.rows.length > 0 && <button className="btn primary" onClick={() => nav(`/documents?type=impayes&mois=${jusqua}${classe ? `&classe=${classe}` : ""}`)}><Printer size={17} />Imprimer par classe</button>}
      </PageHead>

      {data && (
        <div className="dash" style={{ marginBottom: 22 }}>
          <div className="card kpi c4" style={{ background: "linear-gradient(160deg, var(--teal-800), var(--teal-900))", color: "#fff", border: 0 }}>
            <div className="top"><span className="label" style={{ color: "#a9d0d8" }}>Reste à recouvrer</span><span className="ic gold"><Wallet size={20} /></span></div>
            <div className="value" style={{ color: "var(--gold)" }}>{nombre(data.total)}<small style={{ color: "#a9d0d8" }}>F</small></div>
            <div className="sub" style={{ color: "#a9d0d8" }}>{data.rows.length} élève{data.rows.length > 1 ? "s" : ""} concerné{data.rows.length > 1 ? "s" : ""}</div>
          </div>
          <div className="card c8">
            <div className="card-head"><h3>Par classe</h3></div>
            <div className="card-body row" style={{ flexWrap: "wrap", gap: 8 }}>
              {Object.entries(data.par_classe).length ? Object.entries(data.par_classe).map(([c, v]) => <span key={c} className="badge coral" style={{ height: 32, padding: "0 12px" }}>{c} · {fcfa(v)}</span>) : <span className="muted">Aucun impayé.</span>}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="with-icon"><Search size={18} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un élève…" /></div>
          <Select value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe"><option value="">Toutes les classes</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select>
          <Select value={jusqua} onChange={(e) => setJusqua(e.target.value)} aria-label="Jusqu'au mois">{mois.filter((m) => m <= courant).map((m) => <option key={m} value={m}>Jusqu'à {moisLong(m)}{m === courant ? " (mois en cours, pas encore en retard)" : ""}</option>)}</Select>
        </div>
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.rows.length ? (
          <Empty icon={PartyPopper} title="Aucun impayé">Tous les élèves sont à jour à cette date.</Empty>
        ) : (
          <div className="table-wrap" style={{ opacity: isFetching ? 0.65 : 1 }}>
            <table className="table">
              <thead><tr><th>Élève</th><th>Classe</th><th className="hide-m">Mois en retard</th><th className="hide-m">Parent</th><th className="r">Reste à payer</th><th /></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.inscription_id}>
                    <td className="click" style={{ cursor: "pointer" }} onClick={() => nav(`/eleves/${r.eleve_id}`)}><div className="person"><span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span><div><strong>{r.nom} {r.prenom}</strong><span>{r.matricule}</span></div></div></td>
                    <td><span className={`chip ${r.cycle}`}>{r.classe}</span></td>
                    <td className="hide-m"><div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
                      {r.frais > r.frais_payes && <span className="badge gold">Frais d'inscription</span>}
                      {(r.liste_mois || "").split(",").filter(Boolean).map((m) => <span key={m} className="badge coral">{moisAbr(m)}</span>)}
                    </div></td>
                    <td className="hide-m small">{r.parent || "—"}{r.telephone && <div><a className="muted" href={`tel:${r.telephone.replace(/\s/g, "")}`}><Phone size={11} /> {r.telephone}</a></div>}</td>
                    <td className="r amount" style={{ color: "var(--coral)" }}>{fcfa(r.reste)}{r.derniere_relance && <div className="xs muted" style={{ fontWeight: 400 }}>Relancé {ilYa(r.derniere_relance)}{r.nb_relances > 1 ? ` (${r.nb_relances} fois)` : ""}</div>}</td>
                    <td className="r" style={{ whiteSpace: "nowrap" }}>
                      {r.telephone && <a className="btn sm wa" href={`https://wa.me/${telWa(r.telephone)}?text=${encodeURIComponent(relance(r))}`} target="_blank" rel="noreferrer" title="Relancer par WhatsApp" onClick={() => noterRelance(r, jusqua)}><MessageCircle size={15} /><span className="hide-m">Relancer</span></a>}
                      {s.peut("finances.encaisser") && <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => setEnc(r)}><Wallet size={15} /><span className="hide-m">Encaisser</span></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {serie && data && <RelancesSerie rows={data.rows} jusqua={jusqua} onRelance={noterRelance} onClose={() => setSerie(false)} />}
      {enc && <Encaissement inscriptionId={enc.inscription_id} eleve={enc} onClose={() => setEnc(null)} onSaved={(r) => { setEnc(null); nav(`/recus/${r.id}`); }} />}
    </>
  );
}
