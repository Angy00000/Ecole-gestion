import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Upload, FileText, Trash2, Copy, Eye, EyeOff, Paperclip, Receipt, Check } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, fcfa } from "../lib/format";
import { Modal, Field, Select, Textarea, ErrorBox, Confirm, useToast } from "./ui";
import { useEnvoiLien, TYPES_FICHIERS, fabriquerPdf } from "./Partager";
import { Ticket } from "../pages/Recu";

const taille = (o) => (o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
const ORIGINE = /^https?:$/.test(location.protocol) ? location.origin : "https://ecole-gestion-eta.vercel.app";

// Numéros des parents de l'élève, pour choisir le destinataire
export const numerosParents = (e) => [
  e.mere_telephone && { tel: e.mere_telephone, label: `Mère${e.mere_prenom ? ` (${e.mere_prenom})` : ""}` },
  e.pere_telephone && { tel: e.pere_telephone, label: `Père${e.pere_prenom ? ` (${e.pere_prenom})` : ""}` },
  e.tuteur_telephone && { tel: e.tuteur_telephone, label: `Tuteur${e.tuteur_nom ? ` (${e.tuteur_nom})` : ""}` },
].filter(Boolean);

/** Fiche élève → « Envoyer aux parents » : n'importe quel fichier, ou un document de l'école, par WhatsApp. */
export default function EnvoiDocument({ eleve, inscrit, recus = [], onClose }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const input = useRef(null);
  const numeros = numerosParents(eleve);
  const [tel, setTel] = useState(numeros[0]?.tel || "");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState(`Bonjour, ${s.etablissement?.nom || "l'école"} vous envoie un document concernant ${eleve.prenom} ${eleve.nom}.`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [del, setDel] = useState(null);
  const { envoyer, fenetre } = useEnvoiLien();
  // Reçu dessiné hors de l'écran, le temps d'en faire le PDF
  const [apercu, setApercu] = useState(null);
  const [recuEnCours, setRecuEnCours] = useState(null);
  const [recusFaits, setRecusFaits] = useState({});
  const pretRef = useRef(null);
  useEffect(() => {
    if (!apercu || !pretRef.current) return;
    const fin = pretRef.current; pretRef.current = null;
    const img = document.querySelector(".envoi-hors-ecran img");
    const attendre = img && !img.complete ? new Promise((ok) => { img.onload = img.onerror = ok; }) : Promise.resolve();
    attendre.then(() => requestAnimationFrame(() => setTimeout(fin, 150)));
  }, [apercu]);
  const envoyerRecu = async (r) => {
    setRecuEnCours(r.id);
    const ok = await envoyer(async () => {
      const d = await api.get(`/recus/${r.id}`);
      await new Promise((ok) => { pretRef.current = ok; setApercu(d); });
      try { return await fabriquerPdf("A5", `Recu-${d.recu.numero}-${eleve.nom}-${eleve.prenom}`, d.recu.id); }
      finally { setApercu(null); }
    }, { telephone: tel, message: `Bonjour, ${s.etablissement?.nom || "l'école"} vous envoie le reçu n° ${r.numero} de ${fcfa(r.montant)} du ${date(r.date_paiement)} pour ${eleve.prenom} ${eleve.nom}. Merci.`, eleveId: eleve.id });
    setRecuEnCours(null);
    if (ok) { setRecusFaits((x) => ({ ...x, [r.id]: true })); qc.invalidateQueries({ queryKey: ["partages", eleve.id] }); }
  };
  const recusValides = recus.filter((r) => !r.annule);
  const hist = useQuery({ queryKey: ["partages", eleve.id], queryFn: () => api.get(`/eleves/${eleve.id}/partages`) });

  const choisir = (f) => {
    setError(null);
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { setError(new Error("Fichier trop lourd : 3 Mo au maximum. Pour une photo, réduisez sa taille ; pour un PDF, scannez en qualité plus basse.")); return; }
    setFile(f);
  };
  const go = async () => {
    setBusy(true);
    const ok = await envoyer(async () => file, { telephone: tel, message, eleveId: eleve.id });
    setBusy(false);
    if (ok) { toast("Lien prêt : envoyez le message dans WhatsApp"); setFile(null); qc.invalidateQueries({ queryKey: ["partages", eleve.id] }); }
  };
  const supprimer = async () => {
    try { await api.del(`/partages/${del.id}`); toast("Lien supprimé : le parent ne peut plus ouvrir ce document"); qc.invalidateQueries({ queryKey: ["partages", eleve.id] }); }
    catch (e) { toast(e.message, "error"); }
    setDel(null);
  };
  const ecole = [
    inscrit && ["certificat", "Certificat de scolarité"],
    inscrit && ["carte", "Carte scolaire"],
    ["fiche", "Fiche d'inscription"],
  ].filter(Boolean);

  return (
    <Modal title={`Envoyer aux parents de ${eleve.prenom}`} icon={<MessageCircle size={20} />} wide onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Fermer</button>
      <button className="btn wa" onClick={go} disabled={!file || busy}><MessageCircle size={16} />{busy ? "Envoi…" : "Envoyer par WhatsApp"}</button>
    </>}>
      <div className="stack" style={{ gap: 16 }}>
        <ErrorBox error={error} />
        {numeros.length ? (
          <Field label="Destinataire">
            <Select value={tel} onChange={(e) => setTel(e.target.value)}>{numeros.map((n) => <option key={n.tel} value={n.tel}>{n.label} — {n.tel}</option>)}</Select>
          </Field>
        ) : <div className="alert info" style={{ margin: 0 }}>Aucun numéro de parent n'est enregistré : WhatsApp s'ouvrira et vous choisirez le contact vous-même.</div>}

        <Field label="Document" hint="PDF, photo, Word, Excel ou PowerPoint — 3 Mo au maximum. Le parent reçoit un lien pour l'ouvrir.">
          <input ref={input} type="file" accept={TYPES_FICHIERS} hidden onChange={(e) => { choisir(e.target.files?.[0]); e.target.value = ""; }} />
          {file ? (
            <div className="pick" style={{ cursor: "default" }}>
              <span className="avatar"><FileText size={18} /></span>
              <div className="grow"><strong style={{ wordBreak: "break-all" }}>{file.name}</strong><span>{taille(file.size)}</span></div>
              <button className="btn sm ghost" onClick={() => input.current?.click()}>Changer</button>
            </div>
          ) : <button className="btn" style={{ justifyContent: "center", height: 64, borderStyle: "dashed" }} onClick={() => input.current?.click()}><Upload size={18} />Choisir un fichier</button>}
        </Field>
        <Field label="Message"><Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>

        {recusValides.length > 0 && (
          <div>
            <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Reçus de paiement</div>
            <div className="table-wrap" style={{ maxHeight: 230, overflowY: "auto" }}><table className="table">
              <tbody>{recusValides.map((r) => (
                <tr key={r.id}>
                  <td><Receipt size={15} style={{ verticalAlign: "-3px", marginRight: 8, color: "var(--muted)" }} /><strong>N° {r.numero}</strong><div className="xs muted">{date(r.date_paiement)}{r.annee ? ` · ${r.annee}` : ""}</div></td>
                  <td className="r amount">{fcfa(r.montant)}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    {recusFaits[r.id] && <span className="badge green" style={{ marginRight: 8 }}><Check size={13} />Envoyé</span>}
                    <button className={`btn sm ${recusFaits[r.id] ? "" : "wa"}`} disabled={!!recuEnCours} onClick={() => envoyerRecu(r)}>
                      <MessageCircle size={15} />{recuEnCours === r.id ? "Préparation…" : recusFaits[r.id] ? "Renvoyer" : "Envoyer"}
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        )}

        <div>
          <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Ou un document de l'école</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ecole.map(([t, l]) => <button key={t} className="btn sm" onClick={() => nav(`/documents?type=${t}&eleve=${eleve.id}`)}><Paperclip size={14} />{l}</button>)}
          </div>
          <p className="xs muted" style={{ marginTop: 6 }}>Le document s'ouvre : cliquez ensuite sur « Lien WhatsApp ». Pour les reçus, factures et bulletins, utilisez le même bouton sur chaque document.</p>
        </div>

        <div>
          <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Documents déjà envoyés</div>
          {hist.isLoading ? <p className="small muted">Chargement…</p> : !hist.data?.length ? <p className="small muted">Aucun document envoyé pour cet élève.</p> : (
            <div className="table-wrap"><table className="table">
              <tbody>{hist.data.map((d) => (
                <tr key={d.id}>
                  <td><strong style={{ wordBreak: "break-all" }}>{d.nom}</strong><div className="xs muted">{date(d.created_at)}{d.envoye_par_nom ? ` · ${d.envoye_par_nom}` : ""}{d.telephone ? ` · ${d.telephone}` : ""}</div></td>
                  <td className="hide-m">{d.vues ? <span className="badge green"><Eye size={12} />Ouvert {d.vues > 1 ? `${d.vues} fois` : ""}</span> : <span className="badge"><EyeOff size={12} />Pas encore ouvert</span>}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn sm ghost icon" title="Copier le lien" aria-label="Copier le lien" onClick={() => { navigator.clipboard?.writeText(`${ORIGINE}/d/${d.jeton}`); toast("Lien copié"); }}><Copy size={15} /></button>
                    {s.peut("eleves.ecrire") && <button className="btn sm ghost icon" title="Supprimer le lien" aria-label="Supprimer le lien" onClick={() => setDel(d)}><Trash2 size={15} /></button>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <p className="xs muted" style={{ marginTop: 6 }}>Les liens restent valables 6 mois.</p>
        </div>
      </div>
      {fenetre}
      {apercu && createPortal(
        <div className="print-page envoi-hors-ecran" aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, width: 900, minHeight: 0, padding: 0, background: "#fff" }}>
          <div className="tickets"><Ticket r={apercu.recu} etab={s.etablissement} sit={apercu.situation} copie="Exemplaire parent" /></div>
        </div>, document.body)}
      {del && <Confirm danger title="Supprimer ce lien ?" confirmLabel="Supprimer" message={`${del.nom} : le parent ne pourra plus l'ouvrir.`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </Modal>
  );
}
