import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, dateHeure, ROLES, initiales } from "../lib/format";
import { Modal, Field, Input, Select, Spinner, ErrorBox, useToast } from "../components/ui";
import PageTitle from "../components/PageTitle";

// ── Établissement ──
function Etablissement() {
  const s = useSession();
  const toast = useToast();
  const [v, setV] = useState({ ...s.etablissement });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const peut = s.peut("etablissement.ecrire");
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setBusy(true); setError(null);
    try { const { id, updated_at, ...d } = v; await api.put("/etablissement", d); toast("Informations de l'école enregistrées"); s.refresh(); }
    catch (e) { setError(e); }
    setBusy(false);
  };
  const F = ({ k, label, span }) => <Field label={label} className={span ? "span2" : ""}><Input value={v[k] || ""} onChange={set(k)} disabled={!peut} /></Field>;
  return (
    <div className="panel">
      <div className="section">
        <div className="section-title"><h3>Identité de l'école</h3><p>Ces informations apparaissent sur les reçus et documents imprimés.</p></div>
        <ErrorBox error={error} />
        <div className="grid g2" style={{ marginTop: error ? 14 : 0 }}>
          {F({ k: "nom", label: "Nom de l'établissement", span: true })}
          {F({ k: "slogan", label: "Devise" })}
          {F({ k: "adresse", label: "Adresse" })}
          {F({ k: "telephones", label: "Téléphones" })}
          {F({ k: "email", label: "Email" })}
          {F({ k: "site_web", label: "Site web" })}
          {F({ k: "autorisation", label: "Autorisation" })}
          {F({ k: "ninea", label: "NINEA" })}
          {F({ k: "bp", label: "Boîte postale" })}
        </div>
      </div>
      {peut && <div className="section" style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn primary" onClick={save} disabled={busy}>Enregistrer</button>
      </div>}
    </div>
  );
}

// ── Années scolaires ──
function Annees() {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["annees"], queryFn: () => api.get("/annees") });
  const peut = s.peut("annees.ecrire");

  const save = async () => {
    setError(null);
    try {
      if (form.id) await api.put(`/annees/${form.id}`, form);
      else await api.post("/annees", form);
      toast(form.id ? "Année modifiée" : `Année ${form.libelle} créée`);
      qc.invalidateQueries({ queryKey: ["annees"] }); s.refresh(); setForm(null);
    } catch (e) { setError(e); }
  };
  const activer = async (a) => {
    try { await api.post(`/annees/${a.id}/activer`); toast(`${a.libelle} est maintenant l'année en cours`); qc.invalidateQueries({ queryKey: ["annees"] }); s.refresh(); }
    catch (e) { toast(e.message, "error"); }
  };

  if (isLoading) return <Spinner />;
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Années scolaires</h3>
        {peut && <button className="btn primary" onClick={() => { setError(null); setForm({ libelle: "", debut: "", fin: "", copier_de: data.find((a) => a.active)?.id || "" }); }}><Plus size={16} />Préparer une nouvelle année</button>}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Année</th><th>Rentrée</th><th>Fin des cours</th><th>Élèves</th><th>État</th><th /></tr></thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.libelle}</strong></td>
                <td className="num">{date(a.debut)}</td>
                <td className="num">{date(a.fin)}</td>
                <td className="num">{a.effectif}</td>
                <td>{a.active ? <span className="badge gold">En cours</span> : <span className="badge">Archive</span>}</td>
                <td className="r" style={{ whiteSpace: "nowrap" }}>
                  {peut && !a.active && <button className="btn sm" onClick={() => activer(a)}><CheckCircle2 size={14} />Rendre active</button>}
                  {peut && <button className="btn sm ghost icon" onClick={() => { setError(null); setForm({ ...a, debut: a.debut.slice(0, 10), fin: a.fin.slice(0, 10) }); }} aria-label="Modifier"><Pencil size={15} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal title={form.id ? `Année ${form.libelle}` : "Nouvelle année scolaire"} onClose={() => setForm(null)} footer={<>
          <button className="btn" onClick={() => setForm(null)}>Annuler</button>
          <button className="btn primary" onClick={save}>Enregistrer</button>
        </>}>
          <div className="stack" style={{ gap: 14 }}>
            <ErrorBox error={error} />
            <Field label="Libellé" required><Input value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} placeholder="2027-2028" autoFocus /></Field>
            <div className="grid g2">
              <Field label="Rentrée des élèves" required><Input type="date" value={form.debut} onChange={(e) => setForm({ ...form, debut: e.target.value })} /></Field>
              <Field label="Fin des cours" required><Input type="date" value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} /></Field>
            </div>
            {!form.id && (
              <Field label="Reprendre les classes et tarifs de" hint="Vous pourrez ajuster les tarifs ensuite.">
                <Select value={form.copier_de} onChange={(e) => setForm({ ...form, copier_de: e.target.value })}>
                  <option value="">Ne rien reprendre</option>
                  {data.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
                </Select>
              </Field>
            )}
            {!form.id && <div className="alert info">La nouvelle année ne devient « en cours » que lorsque vous cliquez sur « Rendre active ».</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Utilisateurs ──
function Utilisateurs() {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const { data, isLoading, error: loadErr } = useQuery({ queryKey: ["utilisateurs"], queryFn: () => api.get("/utilisateurs") });

  const save = async () => {
    setError(null);
    try {
      const { id, dernier_login, created_at, ...d } = form;
      if (!d.mot_de_passe) delete d.mot_de_passe;
      if (id) await api.put(`/utilisateurs/${id}`, d); else await api.post("/utilisateurs", d);
      toast(id ? "Compte mis à jour" : `Compte créé pour ${d.prenom}`);
      qc.invalidateQueries({ queryKey: ["utilisateurs"] }); setForm(null);
    } catch (e) { setError(e); }
  };

  if (isLoading) return <Spinner />;
  if (loadErr) return <ErrorBox error={loadErr} />;
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Comptes utilisateurs</h3>
        <button className="btn primary" onClick={() => { setError(null); setForm({ nom: "", prenom: "", email: "", role: "secretaire", mot_de_passe: "", actif: true }); }}><Plus size={16} />Créer un compte</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Personne</th><th>Rôle</th><th className="hide-m">Dernière connexion</th><th>État</th><th /></tr></thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td><div className="cell-person"><span className="avatar">{initiales(u.prenom, u.nom)}</span><div><strong>{u.prenom} {u.nom}</strong><span>{u.email}</span></div></div></td>
                <td>{ROLES[u.role]}</td>
                <td className="hide-m">{u.dernier_login ? dateHeure(u.dernier_login) : <span className="muted">Jamais</span>}</td>
                <td>{u.actif ? <span className="badge ok">Actif</span> : <span className="badge danger">Désactivé</span>}</td>
                <td className="r"><button className="btn sm ghost" onClick={() => { setError(null); setForm({ ...u, mot_de_passe: "" }); }}><Pencil size={14} />Modifier</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section small muted">
        <strong style={{ color: "var(--ink)" }}>Ce que chaque rôle peut faire.</strong> Administrateur : tout. Direction : tout sauf gérer les comptes.
        Secrétariat : inscrire et modifier les élèves, consulter les paiements. Comptable : consulter élèves et finances. Enseignant : consulter les élèves.
      </div>
      {form && (
        <Modal title={form.id ? `${form.prenom} ${form.nom}` : "Nouveau compte"} onClose={() => setForm(null)} footer={<>
          <button className="btn" onClick={() => setForm(null)}>Annuler</button>
          <button className="btn primary" onClick={save}>Enregistrer</button>
        </>}>
          <div className="stack" style={{ gap: 14 }}>
            <ErrorBox error={error} />
            <div className="grid g2">
              <Field label="Prénom" required><Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} autoFocus /></Field>
              <Field label="Nom" required><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
            </div>
            <Field label="Email de connexion" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Rôle" required>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label={form.id ? "Nouveau mot de passe" : "Mot de passe"} required={!form.id} hint={form.id ? "Laisser vide pour ne pas le changer. 8 caractères minimum." : "8 caractères minimum. Communiquez-le à la personne."}>
              <Input type="text" value={form.mot_de_passe} onChange={(e) => setForm({ ...form, mot_de_passe: e.target.value })} autoComplete="new-password" />
            </Field>
            {form.id && <label className="check"><input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} />Compte actif</label>}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Journal ──
const ACTIONS = { connexion: "Connexion", inscription: "Inscription", reinscription: "Réinscription", modification: "Modification", creation: "Création", suppression: "Suppression", sortie: "Archivage", activation: "Activation", changement_mot_de_passe: "Mot de passe changé" };
const ENTITES = { eleve: "élève", classe: "classe", annee: "année", utilisateur: "compte", etablissement: "établissement", inscription: "inscription" };
function Journal() {
  const { data, isLoading, error } = useQuery({ queryKey: ["journal"], queryFn: () => api.get("/journal", { limit: 200 }) });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  return (
    <div className="panel">
      <div className="panel-head"><h3>Journal des actions</h3><span className="small muted">200 dernières actions</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th className="hide-m">Détail</th></tr></thead>
          <tbody>
            {data.map((j) => (
              <tr key={j.id}>
                <td className="num" style={{ whiteSpace: "nowrap" }}>{dateHeure(j.created_at)}</td>
                <td>{j.utilisateur || "—"}</td>
                <td>{ACTIONS[j.action] || j.action} {ENTITES[j.entite] && j.action !== "connexion" ? <span className="muted">· {ENTITES[j.entite]}</span> : ""}</td>
                <td className="hide-m small muted">{j.details ? Object.entries(j.details).filter(([, v]) => v != null && typeof v !== "object").map(([k, v]) => `${k} : ${v}`).join(", ") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Parametres() {
  const s = useSession();
  const tabs = [
    ["etablissement", "Établissement", true],
    ["annees", "Années scolaires", true],
    ["utilisateurs", "Utilisateurs", s.peut("utilisateurs")],
    ["journal", "Journal", s.peut("journal.lire")],
  ].filter((t) => t[2]);
  return (
    <div className="stack">
      <PageTitle title="Paramètres" subtitle="École, années scolaires, comptes et historique" />
      <div className="tabs" style={{ padding: 0 }}>
        {tabs.map(([k, l]) => <NavLink key={k} to={`/parametres/${k}`} className={({ isActive }) => isActive ? "on" : ""} style={{ padding: "12px 14px", fontWeight: 600, color: "inherit", textDecoration: "none" }}>{l}</NavLink>)}
      </div>
      <Routes>
        <Route index element={<Navigate to="etablissement" replace />} />
        <Route path="etablissement" element={<Etablissement />} />
        <Route path="annees" element={<Annees />} />
        {s.peut("utilisateurs") && <Route path="utilisateurs" element={<Utilisateurs />} />}
        {s.peut("journal.lire") && <Route path="journal" element={<Journal />} />}
      </Routes>
    </div>
  );
}
