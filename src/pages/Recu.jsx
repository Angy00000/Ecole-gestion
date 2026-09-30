import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Ban, MessageCircle } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, dateHeure, enLettres, libelleLigne, MODES, telWa } from "../lib/format";
import { Spinner, ErrorBox, Modal, Field, Input, useToast } from "../components/ui";

function Ticket({ r, etab, reste, copie }) {
  return (
    <article className={`ticket ${r.annule ? "void" : ""}`}>
      {r.annule && <div className="void-stamp">ANNULÉ</div>}
      <header className="t-head">
        <img src="/logo.png" alt="" />
        <div className="t-school">
          <strong>{etab.nom}</strong>
          <span>{etab.adresse}</span>
          <span>Tél. {etab.telephones}</span>
          <span>{etab.autorisation && `Autorisation ${etab.autorisation}`}{etab.ninea && ` · NINEA ${etab.ninea}`}{etab.bp && ` · BP ${etab.bp}`}</span>
        </div>
      </header>
      <div className="t-title">
        <div><h1>Reçu de paiement</h1><span className="t-copy">{copie}</span></div>
        <div className="t-num"><span>N°</span><strong>{r.numero}</strong></div>
      </div>
      <dl className="t-info">
        <div><dt>Élève</dt><dd>{r.prenom} {r.nom}</dd></div>
        <div><dt>Matricule</dt><dd>{r.matricule}</dd></div>
        <div><dt>Classe</dt><dd>{r.classe} — {r.annee}</dd></div>
        <div><dt>Date</dt><dd>{date(r.date_paiement)}</dd></div>
      </dl>
      <table className="t-lines">
        <thead><tr><th>Désignation</th><th>Montant</th></tr></thead>
        <tbody>{r.lignes.map((l, i) => <tr key={i}><td>{libelleLigne(l)}</td><td>{fcfa(l.montant)}</td></tr>)}</tbody>
        <tfoot><tr><td>Total payé</td><td>{fcfa(r.montant)}</td></tr></tfoot>
      </table>
      <p className="t-words">Arrêté le présent reçu à la somme de <strong>{enLettres(r.montant)} francs CFA</strong>.</p>
      <div className="t-meta">
        <span>Mode : <strong>{MODES[r.mode]}</strong>{r.reference ? ` (réf. ${r.reference})` : ""}</span>
        {reste != null && <span>Reste à payer sur l'année : <strong>{fcfa(reste)}</strong></span>}
      </div>
      {r.note && <p className="t-note">{r.note}</p>}
      <footer className="t-foot">
        <div><span>Encaissé par</span><strong>{r.encaisse_par_nom || "—"}</strong></div>
        <div className="t-sign"><span>Signature et cachet</span></div>
      </footer>
      <p className="t-motto">{etab.slogan}</p>
    </article>
  );
}

export default function Recu() {
  const { id } = useParams();
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [annul, setAnnul] = useState(false);
  const [motif, setMotif] = useState("");
  const [deux, setDeux] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["recu", id], queryFn: () => api.get(`/recus/${id}`) });

  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 32 }}><ErrorBox error={error} /></div>;
  const r = data.recu, etab = s.etablissement;
  const reste = data.situation.reste_annee;

  const annuler = async () => {
    try { await api.post(`/recus/${id}/annuler`, { motif }); toast(`Reçu ${r.numero} annulé`); ["recu", "recus", "situation", "eleve", "dashboard", "impayes", "caisse"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); setAnnul(false); }
    catch (e) { toast(e.message, "error"); }
  };
  const msg = `Bonjour, l'${etab.nom} confirme la réception de ${fcfa(r.montant)} pour ${r.prenom} ${r.nom} (${r.classe}), reçu n° ${r.numero} du ${date(r.date_paiement)}. Reste à payer sur l'année : ${fcfa(reste)}. Merci.`;

  return (
    <div className="print-page">
      <style>{"@page { size: A5 portrait; margin: 0; }"}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(-1)}><ArrowLeft size={17} />Retour</button>
        <span className="grow" />
        <label className="check small"><input type="checkbox" checked={deux} onChange={(e) => setDeux(e.target.checked)} />Imprimer aussi la souche</label>
        {r.telephone && !r.annule && <a className="btn wa" href={`https://wa.me/${telWa(r.telephone)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={17} />Envoyer au parent</a>}
        {s.peut("finances.annuler") && !r.annule && <button className="btn danger" onClick={() => setAnnul(true)}><Ban size={17} />Annuler</button>}
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      {r.annule && <div className="alert" style={{ maxWidth: 640, margin: "0 auto 16px" }}>Reçu annulé le {dateHeure(r.annule_le)} par {r.annule_par_nom} — motif : {r.annule_motif}</div>}
      <div className="tickets">
        <Ticket r={r} etab={etab} reste={reste} copie="Exemplaire parent" />
        {deux && <Ticket r={r} etab={etab} reste={reste} copie="Souche — école" />}
      </div>
      {annul && (
        <Modal title={`Annuler le reçu ${r.numero}`} onClose={() => setAnnul(false)} footer={<>
          <button className="btn" onClick={() => setAnnul(false)}>Garder le reçu</button>
          <button className="btn danger" onClick={annuler} disabled={!motif.trim()}>Annuler le reçu</button>
        </>}>
          <div className="stack" style={{ gap: 14 }}>
            <p>Le reçu restera visible, barré, et son montant sera retiré des totaux. Cette action est enregistrée dans le journal.</p>
            <Field label="Motif" required><Input value={motif} onChange={(e) => setMotif(e.target.value)} autoFocus placeholder="Erreur de montant, doublon…" /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
