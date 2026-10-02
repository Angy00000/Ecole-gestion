import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ArrowLeft, Pencil, RefreshCcw, Trash2, Printer, Phone, Utensils, School, Cake, Wallet, CalendarCheck2, User, Users, Receipt } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, dateLongue, age, initiales } from "../lib/format";
import { Spinner, ErrorBox, Empty, Modal, Field, Select, Input, Confirm, useToast } from "../components/ui";
import EleveForm from "./EleveForm";
import Encaissement from "../components/Encaissement";
import TarifScolarite, { BadgeFormule, ReductionInscription } from "../components/TarifScolarite";
import { moisNom, moisLong, libelleLigne, TYPES_COURTS } from "../lib/format";

function Situation({ inscription, peutEncaisser, onEncaisser }) {
  const { data, isLoading, error } = useQuery({ queryKey: ["situation", inscription.id], queryFn: () => api.get(`/inscriptions/${inscription.id}/situation`) });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const cur = new Date().toISOString().slice(0, 7);
  const pct = data.total_du ? Math.min(100, (data.total_paye / data.total_du) * 100) : 100;
  const frais = data.lignes.filter((l) => l.groupe === "frais");
  const mois = data.lignes.filter((l) => l.groupe === "mois");
  return (
    <div className="card">
      <div className="card-head">
        <h3>Situation financière {inscription.annee}</h3>
        {peutEncaisser && <button className="btn primary" onClick={onEncaisser}><Wallet size={17} />Encaisser un paiement</button>}
      </div>
      <div className="sit-head" style={{ marginTop: 16, borderTop: "1px solid var(--line)" }}>
        <div><div className="l">Total de l'année</div><div className="v">{fcfa(data.total_du)}</div></div>
        <div><div className="l">Payé</div><div className="v" style={{ color: "var(--green)" }}>{fcfa(data.total_paye)}</div></div>
        <div><div className="l">En retard aujourd'hui</div><div className="v" style={{ color: data.reste_echu ? "var(--coral)" : "var(--green)" }}>{fcfa(data.reste_echu)}</div></div>
        <div><div className="l">Reste sur l'année</div><div className="v">{fcfa(data.reste_annee)}</div></div>
      </div>
      <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="between small" style={{ marginBottom: 8 }}><strong>Progression des paiements</strong><span className="muted">{Math.round(pct)} %</span></div>
        <div className="progress"><i style={{ width: `${pct}%` }} /></div>

        {frais.length > 0 && <>
          <h4 className="enc-h">Frais d'inscription</h4>
          <div className="timeline">
            {frais.map((l) => { const st = l.paye >= l.du ? "paid" : l.paye ? "partial" : "late"; return (
              <div key={l.type} className={`tl ${st}`}><div className="mn">{TYPES_COURTS[l.type]}</div><div className="mv">{fcfa(l.du)}</div>
                <span className="ms">{st === "paid" ? <><Check size={12} />Payé</> : st === "partial" ? `Reste ${fcfa(l.du - l.paye)}` : "À payer"}</span></div>); })}
          </div>
        </>}

        <h4 className="enc-h">Mensualités</h4>
        {inscription.gratuit ? <p className="small muted">Mensualités offertes pour cette année : aucun suivi mensuel.</p> : <div className="timeline">
          {mois.map((l) => {
            const st = l.du === 0 ? "free" : l.paye >= l.du ? "paid" : l.paye ? "partial" : l.mois <= cur ? "late" : "upcoming";
            return (
              <div key={l.mois} className={`tl ${st}`} title={moisLong(l.mois)}>
                <div className="mn">{moisNom(l.mois)}</div>
                <div className="mv">{l.du ? fcfa(l.du) : "—"}</div>
                <span className="ms">{st === "paid" ? <><Check size={12} />Payé</> : st === "partial" ? `Reste ${fcfa(l.du - l.paye)}` : st === "late" ? "En retard" : st === "free" ? (inscription.gratuit ? "Offert" : "Réparti jan./fév.") : "À venir"}</span>
              </div>
            );
          })}
        </div>}
      </div>
    </div>
  );
}
const MODES = { especes: "Espèces", wave: "Wave", orange_money: "Orange Money", cheque: "Chèque", virement: "Virement" };
const STATUTS = { active: "Inscrit", abandon: "Abandon", transfert: "Transféré" };

const Info = ({ label, children }) => <><dt>{label}</dt><dd>{children || <span className="muted">—</span>}</dd></>;
const Tel = ({ n }) => n ? <a href={`tel:${n.replace(/\s/g, "")}`} className="tel"><Phone size={14} />{n}</a> : null;
function Parent({ rel, prenom, nom, profession, tel, tone }) {
  const name = [prenom, nom].filter(Boolean).join(" ");
  return (
    <div className="parent">
      <span className={`avatar ${tone}`}>{name ? initiales(prenom, nom) : "?"}</span>
      <div style={{ minWidth: 0 }}>
        <span className="rel">{rel}</span>
        <strong>{name || <span className="muted">Non renseigné</span>}</strong>
        {profession && <div className="small muted">{profession}</div>}
        <Tel n={tel} />
      </div>
    </div>
  );
}

function InscriptionModal({ eleve, inscription, onClose }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const edition = !!inscription;
  const [v, setV] = useState({
    classe_id: inscription?.classe_id || "", cantine: inscription?.cantine || false, uniforme: inscription?.uniforme ?? false, tenue_sport: inscription?.tenue_sport ?? false, cours_soir: inscription ? inscription.cours_soir : true, reduction_inscription: inscription?.reduction_inscription || 0,
    gratuit: inscription?.gratuit || false, inscription_offerte: inscription?.inscription_offerte || false, mensualite_speciale: inscription?.mensualite_speciale || null,
    statut: inscription?.statut || "active", date_inscription: inscription?.date_inscription?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState(null);
  const annee = edition ? inscription.annee_id : s.annee?.id;
  const classes = useQuery({ queryKey: ["classes", annee], queryFn: () => api.get("/classes", { annee_id: annee }) });

  const save = async () => {
    setError(null);
    try {
      if (edition) await api.put(`/inscriptions/${inscription.id}`, v);
      else await api.post(`/eleves/${eleve.id}/inscriptions`, { ...v, annee_id: annee, type: "reinscription" });
      toast(edition ? "Inscription mise à jour" : `${eleve.prenom} réinscrit(e) pour ${s.annee?.libelle}`);
      ["eleve", "eleves", "dashboard", "classes", "situation", "impayes", "service", "recus"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    } catch (e) { setError(e); }
  };

  return (
    <Modal title={edition ? `Inscription ${inscription.annee}` : `Réinscrire pour ${s.annee?.libelle}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.classe_id}>{edition ? "Enregistrer" : "Réinscrire"}</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <Field label="Classe" required>
          <Select value={v.classe_id} onChange={(e) => setV({ ...v, classe_id: Number(e.target.value) })}>
            <option value="">Choisir…</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={v.date_inscription} onChange={(e) => setV({ ...v, date_inscription: e.target.value })} /></Field>
        {edition && (
          <Field label="Situation">
            <Select value={v.statut} onChange={(e) => setV({ ...v, statut: e.target.value })}>
              {Object.entries(STATUTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
        )}
        <div className="options-3">
          <label className="switch-card"><input type="checkbox" checked={v.uniforme} onChange={(e) => setV({ ...v, uniforme: e.target.checked })} /><strong>Uniforme</strong></label>
          <label className="switch-card"><input type="checkbox" checked={v.tenue_sport} onChange={(e) => setV({ ...v, tenue_sport: e.target.checked })} /><strong>Tenue de sport</strong></label>
          <label className="switch-card"><input type="checkbox" checked={v.cantine} onChange={(e) => setV({ ...v, cantine: e.target.checked })} /><strong>Cantine</strong></label>
          {classes.data?.find((c) => c.id === Number(v.classe_id))?.cours_soir > 0 && <label className="switch-card"><input type="checkbox" checked={v.cours_soir} onChange={(e) => setV({ ...v, cours_soir: e.target.checked })} /><strong>Cours du soir</strong></label>}
        </div>
        <TarifScolarite value={v} normal={classes.data?.find((c) => c.id === Number(v.classe_id))?.[v.cantine ? "mensualite_cantine" : "mensualite"]} onChange={(x) => setV({ ...v, ...x })} />
        <ReductionInscription value={v} droit={classes.data?.find((c) => c.id === Number(v.classe_id))?.frais_inscription} onChange={(x) => setV({ ...v, ...x })} />
      </div>
    </Modal>
  );
}

export default function EleveFiche() {
  const { id } = useParams();
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("identite");
  const [edit, setEdit] = useState(false);
  const [insc, setInsc] = useState(null);
  const [del, setDel] = useState(false);
  const [enc, setEnc] = useState(false);
  const [docs, setDocs] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["eleve", id], queryFn: () => api.get(`/eleves/${id}`) });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const { eleve: e, inscriptions, paiements, absences = [] } = data;
  const courante = inscriptions.find((i) => i.annee_id === s.annee?.id);
  const a = age(e.date_naissance);
  const totalPaye = paiements.filter((p) => !p.annule && p.annee_id === s.annee?.id).reduce((t, p) => t + p.montant, 0);

  const supprimer = async () => {
    try {
      const r = await api.del(`/eleves/${e.id}`);
      toast(r.archive ? "Élève archivé (il a des paiements enregistrés)" : "Élève supprimé");
      ["eleves", "dashboard", "classes"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      nav("/eleves");
    } catch (err) { toast(err.message, "error"); setDel(false); }
  };

  const tabs = [["identite", "Identité et parents", null, User], ["scolarite", "Scolarité", inscriptions.length, School],
    ...(s.peut("finances.lire") ? [["paiements", "Paiements", paiements.length, Receipt]] : []),
    ...(s.peut("pedagogie.lire") ? [["absences", "Absences", absences.filter((a) => a.annee_id === s.annee?.id).length, CalendarCheck2]] : [])];

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <div><Link to="/eleves" className="crumb"><ArrowLeft size={16} />Retour aux élèves</Link></div>

      <div className="card profile">
        <div className={`cover lattice ${e.sexe || ""}`} />
        <div className="profile-main">
          <span className={`avatar lg ${e.sexe || ""}`}>{initiales(e.prenom, e.nom)}</span>
          <div className="id">
            <h2>{e.prenom} {e.nom}</h2>
            <div className="meta">
              <span className="badge">{e.matricule}</span>
              {courante ? <span className={`chip ${courante.cycle || ""}`}>{courante.classe}</span> : <span className="badge gold">Non inscrit(e) en {s.annee?.libelle}</span>}
              {courante?.cantine && <span className="badge coral"><Utensils size={12} />Cantine</span>}
              {courante?.uniforme && <span className="badge">Uniforme</span>}
              {courante?.tenue_sport && <span className="badge">Tenue de sport</span>}
              {courante && courante.prix_cours_soir > 0 && !courante.cours_soir && <span className="badge gold">Sans cours du soir</span>}
              {courante && <BadgeFormule v={courante} />}
              {courante && courante.statut !== "active" && <span className="badge coral">{STATUTS[courante.statut]}</span>}
              {e.statut === "sorti" && <span className="badge coral">Sorti(e)</span>}
            </div>
          </div>
          <div className="actions">
            <div className={`doc-menu ${docs ? "open" : ""}`}>
              <button className="btn" onClick={() => setDocs(!docs)} aria-expanded={docs}><Printer size={17} /><span className="hide-m">Documents</span></button>
              {docs && <div className="doc-menu-close" onClick={() => setDocs(false)} />}
              <div className="dropdown">
                {courante && <button onClick={() => nav(`/documents?type=certificat&eleve=${e.id}`)}>Certificat de scolarité</button>}
                <button onClick={() => nav(`/documents?type=fiche&eleve=${e.id}`)}>Fiche d'inscription</button>
                {courante && <button onClick={() => nav(`/documents?type=carte&eleve=${e.id}`)}>Carte scolaire</button>}
                {courante && s.peut("finances.lire") && <button onClick={() => nav(`/factures/imprimer?mois=${new Date().toISOString().slice(0, 7)}&eleve=${e.id}`)}>Facture du mois</button>}
                {courante && s.peut("pedagogie.lire") && <button onClick={() => nav(`/bulletins/imprimer?classe=${courante.classe_id}&trimestre=1&eleve=${e.id}`)}>Bulletin du 1er trimestre</button>}
              </div>
            </div>
            {s.peut("eleves.ecrire") && !courante && <button className="btn primary" onClick={() => setInsc("new")}><RefreshCcw size={17} />Réinscrire</button>}
            {s.peut("finances.encaisser") && courante && <button className="btn primary" onClick={() => setEnc(true)}><Wallet size={17} />Encaisser</button>}
            {s.peut("eleves.ecrire") && <button className="btn" onClick={() => setEdit(true)}><Pencil size={17} />Modifier</button>}
            {s.peut("eleves.supprimer") && <button className="btn danger icon" onClick={() => setDel(true)} aria-label="Supprimer l'élève"><Trash2 size={17} /></button>}
          </div>
        </div>
        <div className="mini-stats">
          <div className="mini-stat"><span className="ic teal" style={{ display: "grid", placeItems: "center" }}><School size={18} /></span><div><div className="l">Classe</div><div className="v">{courante?.classe || "—"}</div></div></div>
          <div className="mini-stat"><span className={`ic ${e.sexe === "F" ? "rose" : "azure"}`} style={{ display: "grid", placeItems: "center" }}><Cake size={18} /></span><div><div className="l">Âge</div><div className="v">{a != null ? `${a} ans` : "—"}</div></div></div>
          <div className="mini-stat"><span className="ic gold" style={{ display: "grid", placeItems: "center" }}><CalendarCheck2 size={18} /></span><div><div className="l">Inscrit depuis</div><div className="v">{inscriptions.length ? inscriptions[inscriptions.length - 1].annee : "—"}</div></div></div>
          <div className="mini-stat"><span className="ic green" style={{ display: "grid", placeItems: "center" }}><Wallet size={18} /></span><div><div className="l">Payé cette année</div><div className="v">{s.peut("finances.lire") ? fcfa(totalPaye) : "—"}</div></div></div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map(([k, l, n, I]) => <button key={k} role="tab" className={tab === k ? "on" : ""} onClick={() => setTab(k)}><I size={16} />{l}{n != null && <span className="count">{n}</span>}</button>)}
      </div>

      {tab === "identite" && (
        <div className="info-grid">
          <div className="card">
            <div className="card-head"><h3>Informations personnelles</h3></div>
            <div className="card-body">
              <dl className="kv">
                <Info label="Nom complet">{e.prenom} {e.nom}</Info>
                <Info label="Sexe">{e.sexe === "F" ? "Féminin" : e.sexe === "M" ? "Masculin" : null}</Info>
                <Info label="Date de naissance">{e.date_naissance && `${dateLongue(e.date_naissance)}${a != null ? ` (${a} ans)` : ""}`}</Info>
                <Info label="Lieu de naissance">{e.lieu_naissance}</Info>
                <Info label="Adresse">{e.adresse}</Info>
                <Info label="Observations">{e.observations}</Info>
              </dl>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Parents et tuteur</h3></div>
            <div className="card-body" style={{ display: "grid", gap: 12 }}>
              <Parent rel="Père" prenom={e.pere_prenom} nom={e.pere_nom} profession={e.pere_profession} tel={e.pere_telephone} tone="M" />
              <Parent rel="Mère" prenom={e.mere_prenom} nom={e.mere_nom} profession={e.mere_profession} tel={e.mere_telephone} tone="F" />
              {(e.tuteur_nom || e.tuteur_telephone) && <Parent rel="Tuteur" prenom={e.tuteur_nom} tel={e.tuteur_telephone} tone="" />}
            </div>
          </div>
        </div>
      )}

      {tab === "scolarite" && (
        <div className="card">
          <div className="table-wrap">
            <table className="table" style={{ marginTop: -1 }}>
              <thead><tr><th>Année</th><th>Classe</th><th>Type</th><th className="hide-m">Date</th><th>Cantine</th><th className="hide-m r">Mensualité</th><th>Situation</th><th /></tr></thead>
              <tbody>
                {inscriptions.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.annee}</strong>{i.annee_active && <span className="badge gold" style={{ marginLeft: 8 }}>En cours</span>}</td>
                    <td><span className={`chip ${i.cycle || ""}`}>{i.classe}</span></td>
                    <td>{i.type === "nouvelle" ? "Nouvelle" : "Réinscription"}</td>
                    <td className="hide-m num">{date(i.date_inscription)}</td>
                    <td>{i.cantine ? <span className="badge coral">Oui</span> : <span className="muted">Non</span>}</td>
                    <td className="hide-m num r"><strong>{i.gratuit ? "Offerte" : fcfa(i.mensualite_speciale ?? ((i.cantine ? i.mensualite_cantine : i.mensualite) - (!i.cours_soir && i.prix_cours_soir > 0 ? i.prix_cours_soir : 0)))}</strong>{!i.gratuit && i.prix_cours_soir > 0 ? <div className="xs muted">{i.cours_soir ? "cours du soir compris" : "sans cours du soir"}</div> : null}{i.mensualite_speciale && !i.gratuit ? <div className="xs muted">personnalisée</div> : null}{i.inscription_offerte ? <div className="xs muted">inscription offerte</div> : i.reduction_inscription > 0 ? <div className="xs muted">réduction inscription −{fcfa(i.reduction_inscription)}</div> : null}</td>
                    <td><span className={`badge ${i.statut === "active" ? "green" : "coral"}`}>{STATUTS[i.statut]}</span></td>
                    <td className="r">{s.peut("eleves.ecrire") && <button className="btn sm ghost" onClick={() => setInsc(i)}><Pencil size={14} />Modifier</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "paiements" && (
        <div className="stack">
          {courante ? <Situation inscription={courante} peutEncaisser={s.peut("finances.encaisser")} onEncaisser={() => setEnc(true)} />
            : <div className="card"><Empty icon={Wallet} title={`Pas d'inscription en ${s.annee?.libelle}`}>Réinscrivez l'élève pour suivre ses paiements de l'année.</Empty></div>}
          <div className="card">
            <div className="card-head" style={{ paddingBottom: 14 }}><h3>Reçus</h3><span className="badge teal">{paiements.length}</span></div>
            {paiements.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Reçu</th><th>Date</th><th>Détail</th><th className="hide-m">Mode</th><th className="hide-m">Encaissé par</th><th className="r">Montant</th></tr></thead>
                  <tbody>
                    {paiements.map((p) => (
                      <tr key={p.id} className="click" onClick={() => nav(`/recus/${p.id}`)} style={p.annule ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                        <td><span className="badge teal">{p.numero}</span></td>
                        <td className="num">{date(p.date_paiement)}</td>
                        <td className="small">{(p.lignes || []).map((l) => libelleLigne({ ...l, mois: l.mois?.slice(0, 7) })).join(", ")}</td>
                        <td className="hide-m">{MODES[p.mode]}</td>
                        <td className="hide-m">{p.encaisse_par_nom || "—"}</td>
                        <td className="r amount">{fcfa(p.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty icon={Wallet} title="Aucun reçu">Les paiements encaissés apparaîtront ici.</Empty>}
          </div>
        </div>
      )}

      {tab === "absences" && (
        <div className="card">
          <div className="card-head" style={{ paddingBottom: 14 }}>
            <h3>Absences et retards</h3>
            {courante && s.peut("pedagogie.lire") && <Link className="btn sm" to={`/bulletins/imprimer?classe=${courante.classe_id}&trimestre=1&eleve=${e.id}`}><Printer size={14} />Bulletin</Link>}
          </div>
          {absences.length ? (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Type</th><th>Moment</th><th>Justifiée</th><th className="hide-m">Motif</th></tr></thead>
              <tbody>{absences.map((a) => <tr key={a.id}>
                <td className="num">{dateLongue(a.date_absence)}</td>
                <td>{a.type === "retard" ? <span className="badge gold">Retard</span> : <span className="badge coral">Absence</span>}</td>
                <td>{{ journee: "Journée", matin: "Matin", apres_midi: "Après-midi" }[a.moment]}</td>
                <td>{a.justifiee ? <span className="badge green">Oui</span> : <span className="muted">Non</span>}</td>
                <td className="hide-m">{a.motif || "—"}</td>
              </tr>)}</tbody>
            </table></div>
          ) : <Empty icon={CalendarCheck2} title="Aucune absence">Élève assidu : aucune absence ni retard enregistré.</Empty>}
        </div>
      )}

      {enc && courante && <Encaissement inscriptionId={courante.id} eleve={e} onClose={() => setEnc(false)} onSaved={(r) => { setEnc(false); nav(`/recus/${r.id}`); }} />}
      {edit && <EleveForm eleve={e} onClose={() => setEdit(false)} onSaved={() => setEdit(false)} />}
      {insc && <InscriptionModal eleve={e} inscription={insc === "new" ? null : insc} onClose={() => setInsc(null)} />}
      {del && <Confirm danger title="Supprimer cet élève ?" confirmLabel="Supprimer"
        message={paiements.length ? `${e.prenom} ${e.nom} a des paiements enregistrés : sa fiche sera archivée (marquée « sortie ») et non effacée.` : `La fiche de ${e.prenom} ${e.nom} et ses inscriptions seront définitivement supprimées.`}
        onConfirm={supprimer} onClose={() => setDel(false)} />}
    </div>
  );
}
