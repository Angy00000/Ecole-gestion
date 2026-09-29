import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, RefreshCcw, Trash2, Printer, Phone, Utensils, School, Cake, Wallet, CalendarCheck2, User, Users, Receipt } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, dateLongue, age, initiales } from "../lib/format";
import { Spinner, ErrorBox, Empty, Modal, Field, Select, Input, Confirm, useToast } from "../components/ui";
import EleveForm from "./EleveForm";

const TYPES = { inscription: "Inscription", uniforme: "Uniforme", mensualite: "Mensualité", cantine: "Cantine", fournitures: "Fournitures", cours_vacances: "Cours de vacances", autre: "Autre" };
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
    classe_id: inscription?.classe_id || "", cantine: inscription?.cantine || false,
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
      ["eleve", "eleves", "dashboard", "classes"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
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
        <label className="check"><input type="checkbox" checked={v.cantine} onChange={(e) => setV({ ...v, cantine: e.target.checked })} />Inscrit(e) à la cantine</label>
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
  const { data, isLoading, error } = useQuery({ queryKey: ["eleve", id], queryFn: () => api.get(`/eleves/${id}`) });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const { eleve: e, inscriptions, paiements } = data;
  const courante = inscriptions.find((i) => i.annee_id === s.annee?.id);
  const a = age(e.date_naissance);
  const totalPaye = paiements.filter((p) => !p.annule).reduce((t, p) => t + p.montant, 0);

  const supprimer = async () => {
    try {
      const r = await api.del(`/eleves/${e.id}`);
      toast(r.archive ? "Élève archivé (il a des paiements enregistrés)" : "Élève supprimé");
      ["eleves", "dashboard", "classes"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      nav("/eleves");
    } catch (err) { toast(err.message, "error"); setDel(false); }
  };

  const tabs = [["identite", "Identité et parents", null, User], ["scolarite", "Scolarité", inscriptions.length, School],
    ...(s.peut("finances.lire") ? [["paiements", "Paiements", paiements.length, Receipt]] : [])];

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
              {courante && courante.statut !== "active" && <span className="badge coral">{STATUTS[courante.statut]}</span>}
              {e.statut === "sorti" && <span className="badge coral">Sorti(e)</span>}
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => window.print()}><Printer size={17} /><span className="hide-m">Imprimer</span></button>
            {s.peut("eleves.ecrire") && !courante && <button className="btn primary" onClick={() => setInsc("new")}><RefreshCcw size={17} />Réinscrire</button>}
            {s.peut("eleves.ecrire") && <button className="btn" onClick={() => setEdit(true)}><Pencil size={17} />Modifier</button>}
            {s.peut("eleves.supprimer") && <button className="btn danger icon" onClick={() => setDel(true)} aria-label="Supprimer l'élève"><Trash2 size={17} /></button>}
          </div>
        </div>
        <div className="mini-stats">
          <div className="mini-stat"><span className="ic teal" style={{ display: "grid", placeItems: "center" }}><School size={18} /></span><div><div className="l">Classe</div><div className="v">{courante?.classe || "—"}</div></div></div>
          <div className="mini-stat"><span className={`ic ${e.sexe === "F" ? "rose" : "azure"}`} style={{ display: "grid", placeItems: "center" }}><Cake size={18} /></span><div><div className="l">Âge</div><div className="v">{a != null ? `${a} ans` : "—"}</div></div></div>
          <div className="mini-stat"><span className="ic gold" style={{ display: "grid", placeItems: "center" }}><CalendarCheck2 size={18} /></span><div><div className="l">Inscrit depuis</div><div className="v">{inscriptions.length ? inscriptions[inscriptions.length - 1].annee : "—"}</div></div></div>
          <div className="mini-stat"><span className="ic green" style={{ display: "grid", placeItems: "center" }}><Wallet size={18} /></span><div><div className="l">Total payé</div><div className="v">{s.peut("finances.lire") ? fcfa(totalPaye) : "—"}</div></div></div>
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
                    <td className="hide-m num r"><strong>{fcfa(i.mensualite_speciale ?? (i.cantine ? i.mensualite_cantine : i.mensualite))}</strong></td>
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
        <div className="card">
          {paiements.length ? (
            <div className="table-wrap">
              <table className="table" style={{ marginTop: -1 }}>
                <thead><tr><th>Reçu</th><th>Date</th><th>Motif</th><th className="hide-m">Mode</th><th className="hide-m">Encaissé par</th><th className="r">Montant</th></tr></thead>
                <tbody>
                  {paiements.map((p) => (
                    <tr key={p.id} style={p.annule ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                      <td><span className="badge teal">{p.numero}</span></td>
                      <td className="num">{date(p.date_paiement)}</td>
                      <td><strong>{TYPES[p.type]}</strong>{p.note ? <div className="xs muted">{p.note}</div> : ""}</td>
                      <td className="hide-m">{MODES[p.mode]}</td>
                      <td className="hide-m">{p.encaisse_par_nom || "—"}</td>
                      <td className="r amount">{fcfa(p.montant)}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={5} className="r" style={{ background: "var(--surface-2)" }}><strong>Total payé</strong></td><td className="r amount" style={{ background: "var(--surface-2)", color: "var(--green)" }}>{fcfa(totalPaye)}</td></tr>
                </tbody>
              </table>
            </div>
          ) : <Empty icon={Wallet} title="Aucun paiement enregistré">L'encaissement des paiements arrive avec le module Finances.</Empty>}
        </div>
      )}

      {edit && <EleveForm eleve={e} onClose={() => setEdit(false)} onSaved={() => setEdit(false)} />}
      {insc && <InscriptionModal eleve={e} inscription={insc === "new" ? null : insc} onClose={() => setInsc(null)} />}
      {del && <Confirm danger title="Supprimer cet élève ?" confirmLabel="Supprimer"
        message={paiements.length ? `${e.prenom} ${e.nom} a des paiements enregistrés : sa fiche sera archivée (marquée « sortie ») et non effacée.` : `La fiche de ${e.prenom} ${e.nom} et ses inscriptions seront définitivement supprimées.`}
        onConfirm={supprimer} onClose={() => setDel(false)} />}
    </div>
  );
}
