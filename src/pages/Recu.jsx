import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Ban, MessageCircle, Pencil, History, Trash2 } from "lucide-react";
import Encaissement from "../components/Encaissement";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, dateHeure, enLettres, libelleLigne, moisAbr, MODES, telWa } from "../lib/format";
import { Spinner, ErrorBox, Modal, Field, Input, Confirm, useToast } from "../components/ui";

// Analyse de la situation pour le reçu : détail cumulé par ligne + tout ce qui reste à payer.
function analyse(sit) {
  const mois = new Date().toISOString().slice(0, 7);
  const lignes = (sit?.lignes || []).filter((l) => l.groupe !== "autre");
  const cle = (type, m) => `${type}|${m || ""}`;
  const parCle = Object.fromEntries(lignes.map((l) => [cle(l.type, l.mois), l]));
  const reste = (l) => Math.max(l.du - l.paye, 0);
  const frais = lignes.filter((l) => l.groupe === "frais" && reste(l) > 0);
  const retard = lignes.filter((l) => l.groupe === "mois" && l.mois <= mois && reste(l) > 0);
  const avenir = lignes.filter((l) => l.groupe === "mois" && l.mois > mois && reste(l) > 0);
  const somme = (a) => a.reduce((t, l) => t + reste(l), 0);
  return { parCle, cle, reste, frais, retard, avenir, tFrais: somme(frais), tRetard: somme(retard), tAvenir: somme(avenir) };
}

function Ticket({ r, etab, sit, copie, rectifie }) {
  const a = analyse(sit);
  const enRetard = a.tFrais + a.tRetard;
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
      <h2 className="t-h2">Détail du paiement</h2>
      <table className="t-lines t-detail">
        <thead><tr><th>Désignation</th><th>Payé ce jour</th><th>Montant dû</th><th>Réglé au total</th><th>Reste</th></tr></thead>
        <tbody>{r.lignes.map((l, i) => {
          const s = a.parCle[a.cle(l.type, l.mois)];
          const rs = s ? a.reste(s) : null;
          return (
            <tr key={i}>
              <td>{libelleLigne(l)}</td>
              <td><strong>{fcfa(l.montant)}</strong></td>
              <td>{s ? fcfa(s.du) : "—"}</td>
              <td>{s ? fcfa(Math.min(s.paye, s.du)) : "—"}</td>
              <td className={rs > 0 ? "t-due" : "t-ok"}>{s ? (rs > 0 ? fcfa(rs) : "Soldé") : "—"}</td>
            </tr>
          );
        })}</tbody>
        <tfoot><tr><td>Total payé ce jour</td><td colSpan={4}>{fcfa(r.montant)}</td></tr></tfoot>
      </table>
      <p className="t-words">Arrêté le présent reçu à la somme de <strong>{enLettres(r.montant)} francs CFA</strong>.</p>
      <div className="t-meta"><span>Mode : <strong>{MODES[r.mode]}</strong>{r.reference ? ` (réf. ${r.reference})` : ""}</span></div>

      {sit && (
        <section className="t-reste">
          <h2 className="t-h2">Reste à payer — situation au {date(new Date())}</h2>
          {a.frais.length + a.retard.length + a.avenir.length === 0 ? (
            <p className="t-solde">Tous les frais et mensualités de l'année sont soldés. Merci !</p>
          ) : (
            <>
              {a.frais.length > 0 && (
                <div className="t-grp">
                  <h3>Frais non soldés</h3>
                  {a.frais.map((l) => <div key={l.type} className="t-row"><span>{libelleLigne(l)} <em>(dû {fcfa(l.du)}, réglé {fcfa(l.paye)})</em></span><strong>{fcfa(a.reste(l))}</strong></div>)}
                </div>
              )}
              {a.retard.length > 0 && (
                <div className="t-grp">
                  <h3>Mensualités échues non réglées</h3>
                  {a.retard.length > 4 ? <div className="t-chips due">{a.retard.map((l) => <span key={l.mois}>{moisAbr(l.mois)} {l.mois.slice(2, 4)} : <b>{fcfa(a.reste(l))}</b>{l.paye > 0 ? ` (sur ${fcfa(l.du)})` : ""}</span>)}<span className="t-sum">Total retard : <b>{fcfa(a.tRetard)}</b></span></div> : a.retard.map((l) => <div key={l.mois} className="t-row"><span>{libelleLigne(l)} <em>{l.paye > 0 ? `(dû ${fcfa(l.du)}, réglé ${fcfa(l.paye)})` : "(non payé)"}</em></span><strong>{fcfa(a.reste(l))}</strong></div>)}
                </div>
              )}
              {a.avenir.length > 0 && (
                <div className="t-grp">
                  <h3>Mensualités à venir</h3>
                  <div className="t-chips">{a.avenir.map((l) => <span key={l.mois}>{moisAbr(l.mois)} {l.mois.slice(2, 4)} : <b>{fcfa(a.reste(l))}</b></span>)}</div>
                </div>
              )}
            </>
          )}
          <div className="t-totaux">
            <div><span>Total de l'année</span><strong>{fcfa(sit.total_du)}</strong></div>
            <div><span>Déjà réglé</span><strong>{fcfa(sit.total_paye)}</strong></div>
            <div className={enRetard > 0 ? "warn" : ""}><span>À régler dès maintenant</span><strong>{fcfa(enRetard)}</strong></div>
            <div className="main"><span>Reste sur l'année</span><strong>{fcfa(sit.reste_annee)}</strong></div>
          </div>
        </section>
      )}
      {r.note && <p className="t-note">{r.note}</p>}
      {rectifie && <p className="t-note">Reçu rectifié le {date(rectifie)}.</p>}
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
  const [edit, setEdit] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["recu", id], queryFn: () => api.get(`/recus/${id}`) });

  if (isLoading) return <Spinner />;
  if (error) return <div style={{ padding: 32 }}><ErrorBox error={error} /></div>;
  const r = data.recu, etab = s.etablissement;
  const sit = data.situation, reste = sit.reste_annee;
  const det = analyse(sit);

  const annuler = async () => {
    try { await api.post(`/recus/${id}/annuler`, { motif }); toast(`Reçu ${r.numero} annulé`); ["recu", "recus", "situation", "eleve", "dashboard", "impayes", "caisse"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); setAnnul(false); }
    catch (e) { toast(e.message, "error"); }
  };
  const msg = `Bonjour, l'${etab.nom} confirme la réception de ${fcfa(r.montant)} pour ${r.prenom} ${r.nom} (${r.classe}), reçu n° ${r.numero} du ${date(r.date_paiement)}. Détail : ${r.lignes.map((l) => `${libelleLigne(l)} ${fcfa(l.montant)}`).join(", ")}.${det.frais.length ? ` Frais restants : ${det.frais.map((l) => `${libelleLigne(l)} ${fcfa(det.reste(l))}`).join(", ")}.` : ""}${det.retard.length ? ` Mois en retard : ${det.retard.map((l) => `${libelleLigne(l).replace("Mensualité ", "")} ${fcfa(det.reste(l))}`).join(", ")}.` : ""} À régler maintenant : ${fcfa(det.tFrais + det.tRetard)}. Reste sur l'année : ${fcfa(reste)}. Merci.`;

  return (
    <div className="print-page">
      <style>{"@page { size: A5 portrait; margin: 0; }"}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(-1)}><ArrowLeft size={17} />Retour</button>
        <span className="grow" />
        <label className="check small"><input type="checkbox" checked={deux} onChange={(e) => setDeux(e.target.checked)} />Imprimer aussi la souche</label>
        {r.telephone && !r.annule && <a className="btn wa" href={`https://wa.me/${telWa(r.telephone)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={17} />Envoyer au parent</a>}
        {data.modifiable && <button className="btn" onClick={() => setEdit(true)}><Pencil size={17} />Modifier</button>}
        {data.supprimable && <button className="btn danger" onClick={() => setSuppr(true)}><Trash2 size={17} />Supprimer</button>}
        {s.peut("finances.annuler") && !r.annule && <button className="btn danger" onClick={() => setAnnul(true)}><Ban size={17} />Annuler</button>}
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      {r.annule && <div className="alert" style={{ maxWidth: 640, margin: "0 auto 16px" }}>Reçu annulé le {dateHeure(r.annule_le)} par {r.annule_par_nom} — motif : {r.annule_motif}</div>}
      <div className="tickets">
        <Ticket r={r} etab={etab} sit={sit} copie="Exemplaire parent" rectifie={data.historique?.[0]?.created_at} />
        {deux && <Ticket r={r} etab={etab} sit={sit} copie="Souche — école" rectifie={data.historique?.[0]?.created_at} />}
      </div>
      {data.historique?.length > 0 && (
        <div className="card historique">
          <div className="card-head" style={{ paddingBottom: 12 }}><History size={18} /><h3>Historique des corrections</h3></div>
          <ul className="feed">
            {data.historique.map((h) => (
              <li key={h.id} style={{ cursor: "default", alignItems: "flex-start" }}>
                <div className="grow">
                  <strong>{dateHeure(h.created_at)} — {h.par}</strong>
                  <span>Motif : {h.motif}</span>
                  <div className="small" style={{ marginTop: 6 }}>
                    <span className="muted">Avant : </span>{fcfa(h.avant.montant)} ({MODES[h.avant.mode]}) — {(h.avant.lignes || []).map(libelleLigne).join(", ")}<br />
                    <span className="muted">Après : </span>{fcfa(h.apres.montant)} ({MODES[h.apres.mode]}) — {(h.apres.lignes || []).map(libelleLigne).join(", ")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {suppr && <Confirm danger title={`Supprimer le reçu ${r.numero} ?`} confirmLabel="Supprimer définitivement"
        message={`Le reçu de ${fcfa(r.montant)} pour ${r.prenom} ${r.nom} sera effacé et les mois ou frais redeviendront « à payer ». Utilisez cette option uniquement pour une erreur faite aujourd'hui à l'encaissement. La suppression reste tracée dans le journal.`}
        onConfirm={async () => {
          try {
            const x = await api.del(`/recus/${id}`);
            toast(`Reçu ${r.numero} supprimé`);
            ["recus", "situation", "eleve", "dashboard", "impayes", "caisse", "service", "rapport", "factures"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
            nav(`/eleves/${x.eleve_id}`, { replace: true });
          } catch (e) { toast(e.message, "error"); setSuppr(false); }
        }} onClose={() => setSuppr(false)} />}
      {edit && <Encaissement recu={r} inscriptionId={r.inscription_id} eleve={r} onClose={() => setEdit(false)} onSaved={() => setEdit(false)} />}
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
