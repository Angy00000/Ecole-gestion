import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, CheckCircle2, Building2, CalendarRange, UsersRound, History, Tags, Trash2, DatabaseBackup, Download, FileJson } from "lucide-react";
import { TYPES } from "../lib/format";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, dateHeure, ROLES, initiales } from "../lib/format";
import { Modal, Field, Input, Select, Money, Spinner, ErrorBox, useToast, PageHead } from "../components/ui";

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
    <div className="card">
      <div className="card-body">
        <div style={{ marginBottom: 18 }}><h3>Identité de l'école</h3><p className="small muted" style={{ marginTop: 4 }}>Ces informations apparaissent sur les reçus et documents imprimés.</p></div>
        <ErrorBox error={error} />
        <div className="grid g2" style={{ marginTop: error ? 14 : 0 }}>
          {F({ k: "nom", label: "Nom de l'établissement", span: true })}
          {F({ k: "directeur", label: "Nom du directeur / de la directrice" })}
          {F({ k: "ville", label: "Ville (pour « Fait à … »)" })}
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
      {peut && <div className="modal-foot" style={{ borderRadius: "0 0 18px 18px" }}>
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
      if (form.id) { const { id, active, created_at, effectif, ...d } = form; await api.put(`/annees/${form.id}`, d); }
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
    <div className="card">
      <div className="card-head" style={{ paddingBottom: 16 }}>
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
            {form.id && <>
              <h4 style={{ fontSize: 14, marginTop: 6 }}>Autres tarifs de l'année</h4>
              <div className="grid g2">
                <Field label="Cours du soir (par mois)"><Money value={form.frais_cours_soir} onChange={(x) => setForm({ ...form, frais_cours_soir: x ?? 0 })} /></Field>
                <Field label="Cantine (par jour)"><Money value={form.frais_cantine_jour} onChange={(x) => setForm({ ...form, frais_cantine_jour: x ?? 0 })} /></Field>
                <Field label="Cours de vacances"><Money value={form.frais_cours_vacances} onChange={(x) => setForm({ ...form, frais_cours_vacances: x ?? 0 })} /></Field>
                <Field label="Cotisation des fêtes"><Money value={form.frais_cotisation} onChange={(x) => setForm({ ...form, frais_cotisation: x ?? 0 })} /></Field>
                <Field label="Fournitures (kit)"><Money value={form.frais_fournitures} onChange={(x) => setForm({ ...form, frais_fournitures: x ?? 0 })} /></Field>
              </div>
              <p className="xs muted">Ces montants se remplissent automatiquement lors d'un encaissement et restent modifiables.</p>
            </>}
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
    <div className="card">
      <div className="card-head" style={{ paddingBottom: 16 }}>
        <h3>Comptes utilisateurs</h3>
        <button className="btn primary" onClick={() => { setError(null); setForm({ nom: "", prenom: "", email: "", role: "secretaire", mot_de_passe: "", actif: true }); }}><Plus size={16} />Créer un compte</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Personne</th><th>Rôle</th><th className="hide-m">Dernière connexion</th><th>État</th><th /></tr></thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td><div className="person"><span className="avatar round">{initiales(u.prenom, u.nom)}</span><div><strong>{u.prenom} {u.nom}</strong><span>{u.email}</span></div></div></td>
                <td>{ROLES[u.role]}</td>
                <td className="hide-m">{u.dernier_login ? dateHeure(u.dernier_login) : <span className="muted">Jamais</span>}</td>
                <td>{u.actif ? <span className="badge green">Actif</span> : <span className="badge coral">Désactivé</span>}</td>
                <td className="r"><button className="btn sm ghost" onClick={() => { setError(null); setForm({ ...u, mot_de_passe: "" }); }}><Pencil size={14} />Modifier</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-body small muted" style={{ borderTop: "1px solid var(--line)" }}>
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
const ACTIONS = { sauvegarde: "Sauvegarde", encaissement: "Encaissement", annulation: "Annulation", appel: "Appel", saisie_notes: "Saisie de notes", connexion: "Connexion", inscription: "Inscription", reinscription: "Réinscription", modification: "Modification", creation: "Création", suppression: "Suppression", sortie: "Archivage", activation: "Activation", changement_mot_de_passe: "Mot de passe changé" };
const ENTITES = { eleve: "élève", classe: "classe", annee: "année", utilisateur: "compte", etablissement: "établissement", inscription: "inscription" };
function Journal() {
  const { data, isLoading, error } = useQuery({ queryKey: ["journal"], queryFn: () => api.get("/journal", { limit: 200 }) });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  return (
    <div className="card">
      <div className="card-head" style={{ paddingBottom: 16 }}><h3>Journal des actions</h3><span className="small muted">200 dernières actions</span></div>
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


// ── Types de paiement ──
function TypesPaiement() {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["types-paiement"], queryFn: () => api.get("/types-paiement") });
  const [n, setN] = useState({ libelle: "", montant: null });
  const peut = s.peut("etablissement.ecrire");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["types-paiement"] }); s.refresh(); };
  const ajouter = async () => { try { await api.post("/types-paiement", n); setN({ libelle: "", montant: null }); toast("Type de paiement ajouté"); refresh(); } catch (e) { toast(e.message, "error"); } };
  const maj = async (t, d) => { try { await api.put(`/types-paiement/${t.id}`, d); refresh(); } catch (e) { toast(e.message, "error"); } };
  const suppr = async (t) => { try { await api.del(`/types-paiement/${t.id}`); toast(`${t.libelle} supprimé`); refresh(); } catch (e) { toast(e.message, "error"); } };
  if (isLoading) return <Spinner />;
  return (
    <div className="stack">
      <div className="card">
        <div className="card-head" style={{ paddingBottom: 16 }}><h3>Types de paiement ajoutés par l'école</h3></div>
        <p className="small muted" style={{ padding: "0 22px 14px" }}>Ils apparaissent comme boutons dans la fenêtre d'encaissement, avec leur montant par défaut (modifiable à chaque fois). Exemples : tenue de fête, photo de classe, sortie pédagogique.</p>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Nom</th><th style={{ width: 170 }}>Montant par défaut</th><th style={{ width: 110 }}>Actif</th><th /></tr></thead>
          <tbody>
            {data.map((t) => (
              <tr key={t.id}>
                <td><Input defaultValue={t.libelle} disabled={!peut} onBlur={(e) => e.target.value !== t.libelle && maj(t, { libelle: e.target.value })} /></td>
                <td><Money value={t.montant} disabled={!peut} onChange={(x) => maj(t, { montant: x ?? 0 })} /></td>
                <td><label className="check small"><input type="checkbox" checked={t.actif} disabled={!peut} onChange={(e) => maj(t, { actif: e.target.checked })} />Oui</label></td>
                <td className="r">{peut && <button className="btn sm ghost icon" onClick={() => suppr(t)} aria-label={`Supprimer ${t.libelle}`}><Trash2 size={15} /></button>}</td>
              </tr>
            ))}
            {peut && <tr style={{ background: "var(--surface-2)" }}>
              <td><Input value={n.libelle} onChange={(e) => setN({ ...n, libelle: e.target.value })} placeholder="Nouveau type de paiement…" onKeyDown={(e) => e.key === "Enter" && n.libelle && ajouter()} /></td>
              <td><Money value={n.montant} onChange={(x) => setN({ ...n, montant: x })} placeholder="0" /></td>
              <td colSpan={2}><button className="btn primary sm" onClick={ajouter} disabled={!n.libelle}><Plus size={15} />Ajouter</button></td>
            </tr>}
            {!data.length && !peut && <tr><td colSpan={4} className="muted">Aucun type ajouté.</td></tr>}
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="card-head" style={{ paddingBottom: 14 }}><h3>Types intégrés au logiciel</h3></div>
        <div className="card-body row" style={{ flexWrap: "wrap", gap: 8, paddingTop: 0 }}>{Object.values(TYPES).map((t) => <span key={t} className="badge teal" style={{ height: 30, padding: "0 12px" }}>{t}</span>)}</div>
      </div>
    </div>
  );
}


// ── Sauvegarde ──
const FEUILLES = { eleves: "Élèves", inscriptions: "Inscriptions", recus: "Reçus", paiements: "Détail paiements", depenses: "Dépenses", recettes: "Recettes diverses",
  classes: "Classes et tarifs", matieres: "Matières", enseignants: "Enseignants", evaluations: "Évaluations", notes: "Notes", appreciations: "Appréciations",
  absences: "Absences", emploi_temps: "Emploi du temps", annees: "Années scolaires", etablissement: "Établissement", utilisateurs: "Utilisateurs", types_paiement: "Types de paiement" };
function Sauvegarde() {
  const s = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const derniere = s.etablissement?.derniere_sauvegarde;
  const jours = derniere ? Math.floor((Date.now() - new Date(derniere)) / 864e5) : null;
  const telecharger = async (format) => {
    setBusy(format);
    try {
      const d = await api.get("/sauvegarde");
      const jour = d.date.slice(0, 10);
      let blob, nom;
      if (format === "json") { blob = new Blob([JSON.stringify(d, null, 1)], { type: "application/json" }); nom = `sauvegarde-esjbm-${jour}.json`; }
      else {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();
        Object.entries(d.tables).forEach(([k, rows]) => {
          const ws = XLSX.utils.json_to_sheet(rows.map((r) => Object.fromEntries(Object.entries(r).map(([c, v]) => [c, v !== null && typeof v === "object" ? JSON.stringify(v) : v]))));
          XLSX.utils.book_append_sheet(wb, ws, (FEUILLES[k] || k).slice(0, 31));
        });
        blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        nom = `sauvegarde-esjbm-${jour}.xlsx`;
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nom; a.click();
      toast("Sauvegarde téléchargée : " + nom); s.refresh();
    } catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  return (
    <div className="card">
      <div className="card-body stack">
        <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
          <span className="ic teal" style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", flex: "none" }}><DatabaseBackup size={24} /></span>
          <div>
            <h3>Sauvegarde de toutes les données</h3>
            <p className="small muted" style={{ marginTop: 4 }}>Télécharge l'intégralité des données de l'école : élèves, inscriptions, reçus, dépenses, notes, absences, enseignants… Conservez ce fichier sur une clé USB ou dans Google Drive. À faire <strong>au moins une fois par semaine</strong>.</p>
          </div>
        </div>
        <div className={`alert ${jours != null && jours < 7 ? "info" : ""}`} style={{ margin: 0 }}>
          {derniere ? `Dernière sauvegarde : ${dateHeure(derniere)}${jours >= 7 ? ` — il y a ${jours} jours, pensez à en refaire une.` : "."}` : "Aucune sauvegarde n'a encore été faite."}
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => telecharger("xlsx")} disabled={!!busy}><Download size={17} />{busy === "xlsx" ? "Préparation…" : "Télécharger en Excel"}</button>
          <button className="btn" onClick={() => telecharger("json")} disabled={!!busy}><FileJson size={17} />{busy === "json" ? "Préparation…" : "Format technique (JSON)"}</button>
        </div>
        <p className="xs muted">Le fichier Excel contient une feuille par type de données. Le format technique permet une restauration complète en cas de problème.</p>
      </div>
    </div>
  );
}

export default function Parametres() {
  const s = useSession();
  const tabs = [
    ["etablissement", "Établissement", true, Building2],
    ["annees", "Années scolaires", true, CalendarRange],
    ["types-paiement", "Types de paiement", true, Tags],
    ["utilisateurs", "Utilisateurs", s.peut("utilisateurs"), UsersRound],
    ["sauvegarde", "Sauvegarde", s.peut("etablissement.ecrire"), DatabaseBackup],
    ["journal", "Journal des actions", s.peut("journal.lire"), History],
  ].filter((t) => t[2]);
  return (
    <>
      <PageHead title="Paramètres" sub="L'école, les années scolaires, les comptes et l'historique." />
      <div className="settings">
        <nav className="card settings-nav">
          {tabs.map(([k, l, , I]) => <NavLink key={k} to={`/parametres/${k}`}><I size={18} />{l}</NavLink>)}
        </nav>
        <div>
          <Routes>
            <Route index element={<Navigate to="etablissement" replace />} />
            <Route path="etablissement" element={<Etablissement />} />
            <Route path="annees" element={<Annees />} />
            <Route path="types-paiement" element={<TypesPaiement />} />
            {s.peut("utilisateurs") && <Route path="utilisateurs" element={<Utilisateurs />} />}
            {s.peut("journal.lire") && <Route path="journal" element={<Journal />} />}
            {s.peut("etablissement.ecrire") && <Route path="sauvegarde" element={<Sauvegarde />} />}
          </Routes>
        </div>
      </div>
    </>
  );
}
