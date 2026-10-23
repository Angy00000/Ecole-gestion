import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, CloudUpload, AlertTriangle, RefreshCw, Trash2, Check } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { surEtat, synchroniser, retirer, reessayer, garder } from "../lib/horsLigne";
import { fcfa } from "../lib/format";
import { Modal, useToast } from "./ui";

// Prépare l'appareil pour travailler sans internet : élèves, fiches, situations de paiement, classes, emplois du temps, appel.
const DERNIERE = "eg2_prep_hors_ligne";
async function preparer(s) {
  try { if (Date.now() - Number(localStorage.getItem(DERNIERE) || 0) < 6 * 3600e3) return; } catch { /* */ }
  if (!navigator.onLine || !s.annee) return;
  const a = s.annee.id;
  const classes = await api.get("/classes", { annee_id: a });
  const tous = await api.get("/eleves", { annee_id: a, limit: 500, page: 1 });
  await garder("@eleves-tout", tous);
  const taches = [];
  classes.forEach((c) => {
    taches.push(() => api.get("/emploi", { classe_id: c.id }));
    if (s.peut("pedagogie.lire")) taches.push(() => api.get("/appel", { classe_id: c.id, date: new Date().toISOString().slice(0, 10) }));
  });
  tous.rows.forEach((e) => {
    taches.push(() => api.get(`/eleves/${e.id}`));
    if (s.peut("finances.lire") && e.inscription_id) taches.push(() => api.get(`/inscriptions/${e.inscription_id}/situation`));
  });
  // 3 à la fois, sans gêner le travail en cours
  let i = 0;
  const ouvrier = async () => { while (i < taches.length && navigator.onLine) { const t = taches[i++]; await t().catch(() => {}); } };
  await Promise.all([ouvrier(), ouvrier(), ouvrier()]);
  try { localStorage.setItem(DERNIERE, String(Date.now())); } catch { /* */ }
}

const libelle = (x) => x.path === "/recus" ? `Encaissement ${x.provisoire || ""} — ${x.apercu?.eleve || "élève"} — ${fcfa(x.body.lignes.reduce((t, l) => t + Number(l.montant || 0), 0))}`
  : x.path === "/appel" ? `Appel du ${x.body.date} — ${x.apercu?.classe || "classe"}` : `Notes — ${x.apercu?.evaluation || "évaluation"}`;

/** Bandeau en haut : hors ligne, saisies en attente, envois refusés. */
export default function BandeauHorsLigne() {
  const s = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [e, setE] = useState({ enLigne: true, attente: [] });
  const [voir, setVoir] = useState(false);
  useEffect(() => surEtat(setE), []);
  useEffect(() => { if (s.user && s.annee) { const t = setTimeout(() => preparer(s), 4000); return () => clearTimeout(t); } }, [s.user?.id, s.annee?.id]); // eslint-disable-line
  useEffect(() => {
    const f = (ev) => { toast(`${ev.detail} saisie${ev.detail > 1 ? "s" : ""} faite${ev.detail > 1 ? "s" : ""} hors ligne envoyée${ev.detail > 1 ? "s" : ""} ✔`); qc.invalidateQueries(); };
    window.addEventListener("hors-ligne-envoye", f); return () => window.removeEventListener("hors-ligne-envoye", f);
  }, [qc, toast]);
  const refus = e.attente.filter((x) => x.statut === "refuse");
  const att = e.attente.filter((x) => x.statut !== "refuse");
  if (e.enLigne && !e.attente.length) return null;
  const heure = e.copieDu ? new Date(e.copieDu).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <>
      <div className={`hl-bandeau ${refus.length ? "refus" : !e.enLigne ? "off" : "att"}`}>
        {!e.enLigne ? <WifiOff size={17} /> : refus.length ? <AlertTriangle size={17} /> : <CloudUpload size={17} />}
        <span className="grow">
          {!e.enLigne && <><strong>Hors ligne</strong> — vous voyez les données gardées sur cet appareil{heure ? ` (${heure})` : ""}. L'encaissement, l'appel et les notes restent possibles. </>}
          {att.length > 0 && <><strong>{att.length} saisie{att.length > 1 ? "s" : ""} en attente</strong>{e.enLigne ? (e.sync ? " — envoi en cours…" : "") : " — envoi automatique au retour d'internet."} </>}
          {refus.length > 0 && <><strong>{refus.length} saisie{refus.length > 1 ? "s" : ""} refusée{refus.length > 1 ? "s" : ""}</strong> par le serveur — à vérifier.</>}
        </span>
        {e.attente.length > 0 && <button className="btn sm" onClick={() => setVoir(true)}>Voir</button>}
        {e.enLigne && att.length > 0 && <button className="btn sm" onClick={() => synchroniser()} disabled={e.sync}><RefreshCw size={14} />Envoyer</button>}
      </div>
      {voir && (
        <Modal title="Saisies faites hors ligne" onClose={() => setVoir(false)} footer={<button className="btn" onClick={() => setVoir(false)}>Fermer</button>}>
          {!e.attente.length ? <p className="muted"><Check size={16} /> Tout a été envoyé.</p> : (
            <ul className="hl-liste">{e.attente.map((x) => (
              <li key={x.qid} className={x.statut}>
                <div className="grow"><strong>{libelle(x)}</strong>
                  <span className="xs muted">Saisi le {new Date(x.cree_le).toLocaleString("fr-FR")}</span>
                  {x.erreur && <span className="xs" style={{ color: "var(--coral)" }}>Refusé : {x.erreur}</span>}
                </div>
                {x.statut === "refuse" && <>
                  <button className="btn sm" onClick={() => reessayer(x.qid)}><RefreshCw size={14} />Réessayer</button>
                  <button className="btn sm ghost" onClick={() => window.confirm("Abandonner cette saisie ? Elle ne sera pas enregistrée.") && retirer(x.qid)}><Trash2 size={14} /></button>
                </>}
                {x.statut !== "refuse" && <span className="badge">En attente</span>}
              </li>
            ))}</ul>
          )}
          <p className="xs muted" style={{ marginTop: 10 }}>Une saisie est refusée quand le serveur la juge impossible (par exemple un mois déjà payé sur un autre appareil pendant la coupure). Vérifiez la fiche de l'élève, puis réessayez ou abandonnez-la.</p>
        </Modal>
      )}
    </>
  );
}
