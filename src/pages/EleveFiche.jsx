import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, RefreshCcw, Trash2, Printer, Phone, Utensils } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, dateLongue, age, initiales } from "../lib/format";
import { Spinner, ErrorBox, Empty, Modal, Field, Select, Input, Confirm, useToast } from "../components/ui";
import PageTitle from "../components/PageTitle";
import EleveForm from "./EleveForm";

const TYPES = { inscription: "Inscription", uniforme: "Uniforme", mensualite: "Mensualité", cantine: "Cantine", fournitures: "Fournitures", cours_vacances: "Cours de vacances", autre: "Autre" };
const MODES = { especes: "Espèces", wave: "Wave", orange_money: "Orange Money", cheque: "Chèque", virement: "Virement" };
const STATUTS = { active: "Inscrit", abandon: "Abandon", transfert: "Transféré" };

const Info = ({ label, children }) => <><dt>{label}</dt><dd>{children || <span className="muted">—</span>}</dd></>;
const Tel = ({ n }) => n ? <a href={`tel:${n.replace(/\s/g, "")}`} className="row" style={{ display: "inline-flex", gap: 6 }}><Phone size={14} />{n}</a> : null;

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

  return (
    <div className="stack">
      <PageTitle title={`${e.prenom} ${e.nom}`} subtitle={`Matricule ${e.matricule}`} />
      <div><Link to="/eleves" className="row small" style={{ display: "inline-flex" }}><ArrowLeft size={16} />Retour à la liste</Link></div>

      <div className="panel">
        <div className="profile-head">
          <span className={`avatar lg ${e.sexe || ""}`}>{initiales(e.prenom, e.nom)}</span>
          <div className="id">
            <h2>{e.prenom} {e.nom}</h2>
            <div className="meta">
              <span className="num">{e.matricule}</span>
              {courante ? <span className="classe-tag">{courante.classe}</span> : <span className="badge gold">Non inscrit(e) en {s.annee?.libelle}</span>}
              {courante?.cantine && <span className="badge teal"><Utensils size={12} />Cantine</span>}
              {courante && courante.statut !== "active" && <span className="badge danger">{STATUTS[courante.statut]}</span>}
              {e.statut === "sorti" && <span className="badge danger">Sorti(e)</span>}
              <span>{e.sexe === "F" ? "Fille" : "Garçon"}{a != null ? `, ${a} ans` : ""}</span>
            </div>
          </div>
          <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => window.print()}><Printer size={16} /><span className="hide-m">Imprimer</span></button>
            {s.peut("eleves.ecrire") && !courante && <button className="btn primary" onClick={() => setInsc("new")}><RefreshCcw size={16} />Réinscrire</button>}
            {s.peut("eleves.ecrire") && <button className="btn" onClick={() => setEdit(true)}><Pencil size={16} />Modifier</button>}
            {s.peut("eleves.supprimer") && <button className="btn danger icon" onClick={() => setDel(true)} aria-label="Supprimer"><Trash2 size={16} /></button>}
          </div>
        </div>
        <div className="tabs" role="tablist">
          {[["identite", "Identité et parents"], ["scolarite", `Scolarité (${inscriptions.length})`], ...(s.peut("finances.lire") ? [["paiements", `Paiements (${paiements.length})`]] : [])].map(([k, l]) =>
            <button key={k} role="tab" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>

        {tab === "identite" && (
          <div className="panel-body stack">
            <dl className="dl">
              <Info label="Date de naissance">{e.date_naissance && `${dateLongue(e.date_naissance)}${a != null ? ` (${a} ans)` : ""}`}</Info>
              <Info label="Lieu de naissance">{e.lieu_naissance}</Info>
              <Info label="Adresse">{e.adresse}</Info>
              <Info label="Observations">{e.observations}</Info>
            </dl>
            <div className="cards-2">
              <div className="box"><h4>Père</h4><dl className="dl" style={{ gridTemplateColumns: "110px 1fr" }}>
                <Info label="Nom">{[e.pere_prenom, e.pere_nom].filter(Boolean).join(" ")}</Info>
                <Info label="Profession">{e.pere_profession}</Info>
                <Info label="Téléphone"><Tel n={e.pere_telephone} /></Info>
              </dl></div>
              <div className="box"><h4>Mère</h4><dl className="dl" style={{ gridTemplateColumns: "110px 1fr" }}>
                <Info label="Nom">{[e.mere_prenom, e.mere_nom].filter(Boolean).join(" ")}</Info>
                <Info label="Profession">{e.mere_profession}</Info>
                <Info label="Téléphone"><Tel n={e.mere_telephone} /></Info>
              </dl></div>
              {(e.tuteur_nom || e.tuteur_telephone) && <div className="box"><h4>Tuteur</h4><dl className="dl" style={{ gridTemplateColumns: "110px 1fr" }}>
                <Info label="Nom">{e.tuteur_nom}</Info><Info label="Téléphone"><Tel n={e.tuteur_telephone} /></Info>
              </dl></div>}
            </div>
          </div>
        )}

        {tab === "scolarite" && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Année</th><th>Classe</th><th>Type</th><th>Date</th><th>Cantine</th><th className="hide-m">Mensualité</th><th>Situation</th><th /></tr></thead>
              <tbody>
                {inscriptions.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.annee}</strong>{i.annee_active && <span className="badge gold" style={{ marginLeft: 8 }}>En cours</span>}</td>
                    <td><span className="classe-tag">{i.classe}</span></td>
                    <td>{i.type === "nouvelle" ? "Nouvelle" : "Réinscription"}</td>
                    <td className="num">{date(i.date_inscription)}</td>
                    <td>{i.cantine ? "Oui" : "Non"}</td>
                    <td className="hide-m num">{fcfa(i.mensualite_speciale ?? (i.cantine ? i.mensualite_cantine : i.mensualite))}</td>
                    <td><span className={`badge ${i.statut === "active" ? "ok" : "danger"}`}>{STATUTS[i.statut]}</span></td>
                    <td className="r">{s.peut("eleves.ecrire") && <button className="btn sm ghost" onClick={() => setInsc(i)}><Pencil size={14} />Modifier</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "paiements" && (paiements.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Reçu</th><th>Date</th><th>Motif</th><th className="hide-m">Mode</th><th className="hide-m">Encaissé par</th><th className="r">Montant</th></tr></thead>
              <tbody>
                {paiements.map((p) => (
                  <tr key={p.id} style={p.annule ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                    <td className="num"><strong>{p.numero}</strong></td>
                    <td className="num">{date(p.date_paiement)}</td>
                    <td>{TYPES[p.type]}{p.note ? <span className="muted small"> — {p.note}</span> : ""}</td>
                    <td className="hide-m">{MODES[p.mode]}</td>
                    <td className="hide-m">{p.encaisse_par_nom || "—"}</td>
                    <td className="r amount">{fcfa(p.montant)}</td>
                  </tr>
                ))}
                <tr><td colSpan={5} className="r"><strong>Total payé</strong></td><td className="r amount">{fcfa(totalPaye)}</td></tr>
              </tbody>
            </table>
          </div>
        ) : <Empty title="Aucun paiement">L'encaissement des paiements arrive dans la prochaine étape.</Empty>)}
      </div>

      {edit && <EleveForm eleve={e} onClose={() => setEdit(false)} onSaved={() => setEdit(false)} />}
      {insc && <InscriptionModal eleve={e} inscription={insc === "new" ? null : insc} onClose={() => setInsc(null)} />}
      {del && <Confirm danger title="Supprimer cet élève ?" confirmLabel="Supprimer"
        message={paiements.length ? `${e.prenom} ${e.nom} a des paiements enregistrés : sa fiche sera archivée (marquée « sortie ») et non effacée.` : `La fiche de ${e.prenom} ${e.nom} et ses inscriptions seront définitivement supprimées.`}
        onConfirm={supprimer} onClose={() => setDel(false)} />}
    </div>
  );
}
