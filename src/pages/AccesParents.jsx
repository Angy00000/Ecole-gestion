import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, KeyRound, RefreshCw, MessageCircle, Copy } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { telWa } from "../lib/format";
import { Spinner, ErrorBox, Modal, Select, useToast } from "../components/ui";
import Partager from "../components/Partager";

export const LIEN_PARENTS = "https://ecole-gestion-eta.vercel.app/parents";
export const messageAcces = (e, etab) =>
  `Bonjour, voici l'accès à l'Espace parents de ${etab?.nom || "l'école"} pour suivre ${e.prenom} ${e.nom} (paiements, notes, absences, emploi du temps).\n\n🔗 ${LIEN_PARENTS}\n👤 Matricule : ${e.matricule}\n🔑 Code parent : ${e.code_parent}\n\nGardez ce code pour vous. Merci.`;

function Carte({ e, etab, annee }) {
  return (
    <div className="carte-acces">
      <div className="ca-top"><img src="/logo.png" alt="" /><div><strong>Espace parents</strong><span>{etab.nom} · {annee}</span></div></div>
      <div className="ca-nom">{e.prenom} {e.nom} <span style={{ fontWeight: 400, color: "#4a6168" }}>· {e.classe}</span></div>
      <div className="ca-codes"><div><span>Matricule</span><b>{e.matricule}</b></div><div><span>Code parent</span><b>{e.code_parent}</b></div></div>
      <div className="ca-lien">Connectez-vous sur <b>{LIEN_PARENTS.replace("https://", "")}</b> pour voir les paiements, notes, absences et l'emploi du temps. Code personnel : ne le partagez pas.</div>
    </div>
  );
}

/** Impression des cartes d'accès parents (10 par page A4), pour une classe, un élève ou toute l'école. */
export function CartesAccesImpression() {
  const s = useSession();
  const nav = useNavigate();
  const [p, setP] = useSearchParams();
  const classe = p.get("classe") || "", eleve = Number(p.get("eleve")) || null;
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const { data, isLoading, error } = useQuery({ queryKey: ["codes-parents", classe, s.annee?.id], queryFn: () => api.get("/parents/codes", { classe_id: classe, annee_id: s.annee?.id }) });
  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 32 }}><ErrorBox error={error} /></div>;
  const rows = data.filter((e) => !eleve || e.id === eleve);
  const pages = []; for (let i = 0; i < rows.length; i += 10) pages.push(rows.slice(i, i + 10));
  return (
    <div className="print-page">
      <style>{"@page { size: A4 portrait; margin: 0; }"}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(-1)}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>Cartes d'accès parents</strong> — {rows.length} élève{rows.length > 1 ? "s" : ""}</span>
        {!eleve && <div style={{ width: 200 }}><Select value={classe} onChange={(e) => setP(e.target.value ? { classe: e.target.value } : {})}><option value="">Toutes les classes</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select></div>}
        <Partager format="A4" nom="Cartes-acces-parents" message="Cartes d'accès à l'Espace parents" />
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      <div className="tickets">{pages.map((pg, i) => (
        <article key={i} className="doc a4 cartes cartes-acces">{pg.map((e) => <Carte key={e.id} e={e} etab={s.etablissement} annee={s.annee?.libelle} />)}</article>
      ))}</div>
    </div>
  );
}

/** Fenêtre « Accès parent » sur la fiche d'un élève. */
export function AccesParentModal({ eleve, classe, telephone, onClose }) {
  const s = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [code, setCode] = useState(eleve.code_parent);
  const e = { ...eleve, code_parent: code, classe };
  const nouveau = async () => {
    if (!window.confirm("Créer un nouveau code ? L'ancien ne marchera plus (les parents déjà connectés devront se reconnecter).")) return;
    try { const r = await api.post(`/eleves/${eleve.id}/code-parent`, {}); setCode(r.code_parent); qc.invalidateQueries({ queryKey: ["eleve", String(eleve.id)] }); toast("Nouveau code créé"); } catch (x) { toast(x.message, "error"); }
  };
  const msg = messageAcces(e, s.etablissement);
  return (
    <Modal title="Accès parent" onClose={onClose} footer={<button className="btn" onClick={onClose}>Fermer</button>}>
      <p className="small muted">Les parents se connectent sur <strong>{LIEN_PARENTS.replace("https://", "")}</strong> avec ces deux informations.</p>
      <div className="ca-codes-ecran">
        <div><span>Matricule</span><b>{eleve.matricule}</b></div>
        <div><span>Code parent</span><b>{code || "—"}</b></div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {telephone && <a className="btn wa" href={`https://wa.me/${telWa(telephone)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} />Envoyer par WhatsApp</a>}
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(msg); toast("Message copié"); }}><Copy size={16} />Copier le message</button>
        <button className="btn" onClick={() => nav(`/acces-parents/imprimer?eleve=${eleve.id}`)}><Printer size={16} />Imprimer la carte</button>
        <button className="btn ghost" onClick={nouveau}><RefreshCw size={16} />Nouveau code</button>
      </div>
      {!telephone && <p className="xs muted" style={{ marginTop: 8 }}>Pas de numéro de parent enregistré : imprimez la carte et remettez-la à l'élève.</p>}
    </Modal>
  );
}
export const IconeAcces = KeyRound;
