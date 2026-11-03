import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Archive, FileText, Upload, Camera, Download, ExternalLink, Eye, Search, Pencil, Trash2, Plus, Paperclip, AlertTriangle, CalendarClock, X, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { date, today } from "../lib/format";
import { Modal, Field, Input, Select, Textarea, Spinner, ErrorBox, Empty, Confirm, PageHead, useToast } from "../components/ui";

// Types de documents officiels (mêmes codes que le serveur).
export const TYPES_ARCHIVE = {
  ninea: "NINEA",
  autorisation: "Autorisation d'ouverture / d'exercer",
  rccm: "RCCM (registre du commerce)",
  statuts: "Statuts et récépissé",
  foncier: "Titre foncier / bail",
  fiscal: "Attestations fiscales (impôts)",
  social: "IPRES / Caisse de sécurité sociale",
  assurance: "Assurances",
  contrat: "Contrats et conventions",
  diplome: "Diplômes et agréments du personnel",
  autre: "Autres documents",
};
const TITRES_PAR_DEFAUT = {
  ninea: "NINEA de l'école", autorisation: "Autorisation d'ouverture", rccm: "Registre du commerce (RCCM)", statuts: "Statuts de l'école",
  foncier: "Contrat de bail", fiscal: "Attestation de régularité fiscale", social: "Attestation IPRES / CSS", assurance: "Police d'assurance",
  contrat: "", diplome: "", autre: "",
};
const ESSENTIELS = ["ninea", "autorisation", "rccm", "statuts"];

const MAX_OCTETS = 2_500_000;
const taille = (n) => (n == null ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`);
const jours = (d) => (d ? Math.round((new Date(String(d).slice(0, 10) + "T00:00:00") - new Date(today() + "T00:00:00")) / 864e5) : null);

function Echeance({ d }) {
  const j = jours(d);
  if (j == null) return <span className="muted">—</span>;
  if (j < 0) return <span className="badge coral"><AlertTriangle size={13} />Expiré le {date(d)}</span>;
  if (j <= 60) return <span className="badge gold"><CalendarClock size={13} />Expire dans {j} j</span>;
  return <span className="badge green">Valide jusqu'au {date(d)}</span>;
}

// Lit un fichier ; les photos sont réduites (2000 px, JPEG) pour rester légères.
const lireDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("Lecture du fichier impossible.")); r.readAsDataURL(blob); });
async function preparer(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_OCTETS) throw new Error(`Ce PDF fait ${taille(file.size)} : 2,5 Mo au maximum. Scannez-le en qualité plus basse (150 ppp) ou en plusieurs parties.`);
    return { fichier: await lireDataUrl(file), fichier_nom: file.name, fichier_taille: file.size, fichier_type: file.type };
  }
  if (!/^image\//.test(file.type)) throw new Error("Seuls les PDF et les photos sont acceptés.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Cette image ne peut pas être lue. Essayez une photo JPEG ou PNG.")); i.src = url; });
    let max = 2000, q = 0.82, out;
    for (let essai = 0; essai < 6; essai++) {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL("image/jpeg", q);
      if (out.length * 0.75 <= MAX_OCTETS) break;
      max = Math.round(max * 0.8); q = Math.max(0.6, q - 0.07);
    }
    const nom = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { fichier: out, fichier_nom: nom, fichier_taille: Math.round(out.length * 0.75), fichier_type: "image/jpeg" };
  } finally { URL.revokeObjectURL(url); }
}
const versBlob = (dataUrl) => {
  const [tete, b64] = dataUrl.split(","); const type = tete.slice(5).split(";")[0];
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
};

const MAX_FICHIERS = 20;

function ArchiveForm({ doc, typeInitial, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const t0 = doc?.type || typeInitial || "ninea";
  const [v, setV] = useState(doc ? { ...doc, date_delivrance: doc.date_delivrance?.slice(0, 10) || "", date_expiration: doc.date_expiration?.slice(0, 10) || "" }
    : { type: t0, titre: TITRES_PAR_DEFAUT[t0] || "", reference: "", organisme: "", date_delivrance: "", date_expiration: "", note: "" });
  // Fichiers déjà enregistrés (on peut en retirer) et nouveaux fichiers à envoyer (pages, recto, verso…).
  const [gardes, setGardes] = useState(doc?.fichiers || []);
  const [nouveaux, setNouveaux] = useState([]);
  const [docId, setDocId] = useState(doc?.id || null);
  const [lecture, setLecture] = useState(false);
  const [envoi, setEnvoi] = useState(null);
  const [error, setError] = useState(null);
  const fichierRef = useRef(); const photoRef = useRef();
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const total = gardes.length + nouveaux.length;
  const changerType = (e) => {
    const t = e.target.value;
    setV({ ...v, type: t, titre: !v.titre || v.titre === TITRES_PAR_DEFAUT[v.type] ? TITRES_PAR_DEFAUT[t] || "" : v.titre });
  };
  const choisir = async (e) => {
    const liste = [...(e.target.files || [])]; e.target.value = "";
    if (!liste.length) return;
    setError(null); setLecture(true);
    const prets = [];
    try {
      if (total + liste.length > MAX_FICHIERS) throw new Error(`${MAX_FICHIERS} fichiers au maximum par document.`);
      for (const f of liste) prets.push({ cle: Math.random(), ...(await preparer(f)) });
    } catch (x) { setError(x); }
    setNouveaux((n) => [...n, ...prets]);
    setLecture(false);
  };
  const save = async () => {
    setError(null);
    try {
      const d = { type: v.type, titre: v.titre, reference: v.reference, organisme: v.organisme, date_delivrance: v.date_delivrance, date_expiration: v.date_expiration, note: v.note };
      setEnvoi("Enregistrement…");
      let id = docId;
      if (id) await api.put(`/archives/${id}`, d); else { id = (await api.post("/archives", d)).id; setDocId(id); }
      // Fichiers retirés
      for (const f of doc?.fichiers || []) if (!gardes.some((g) => g.id === f.id)) await api.del(`/archives/${id}/fichiers/${f.id}`).catch((x) => { if (!/introuvable/i.test(x.message)) throw x; });
      // Nouveaux fichiers, un par un (chacun peut faire jusqu'à 2,5 Mo)
      const reste = [...nouveaux];
      for (let i = 0; i < reste.length; i++) {
        setEnvoi(`Envoi du fichier ${i + 1} sur ${reste.length}…`);
        const r = await api.post(`/archives/${id}/fichiers`, { fichier: reste[i].fichier, fichier_nom: reste[i].fichier_nom });
        setGardes((g) => [...g, { id: r.id, nom: r.nom, type: r.type, taille: r.taille }]);
        setNouveaux((n) => n.filter((x) => x.cle !== reste[i].cle));
      }
      toast(doc ? "Document modifié" : "Document ajouté aux archives");
      qc.invalidateQueries({ queryKey: ["archives"] });
      onClose();
    } catch (e) { setError(e); setEnvoi(null); qc.invalidateQueries({ queryKey: ["archives"] }); }
  };
  const busy = !!envoi;
  const ligne = (nom, tailleF, nouveau, retirer, i) => (
    <div key={i} className="row" style={{ padding: "8px 10px", border: "1px solid var(--line-2)", borderRadius: 10 }}>
      <span className="badge" style={{ flex: "none" }}>{i + 1}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{nom}</strong>
        <span className="xs muted">{taille(tailleF)}{nouveau ? " · à envoyer" : ""}</span>
      </div>
      <button className="btn sm ghost icon" onClick={retirer} disabled={busy} aria-label={`Retirer ${nom}`}><X size={16} /></button>
    </div>
  );
  return (
    <Modal title={doc ? "Modifier le document" : "Ajouter un document officiel"} icon={<span className="ic teal" style={{ width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center" }}><Archive size={18} /></span>} onClose={busy ? () => {} : onClose} footer={<>
      <button className="btn" onClick={onClose} disabled={busy}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={!v.titre?.trim() || busy || lecture}>{envoi || "Enregistrer"}</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <div className="grid g2">
          <Field label="Type de document"><Select value={v.type} onChange={changerType}>{Object.entries(TYPES_ARCHIVE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Titre" required><Input value={v.titre} onChange={set("titre")} placeholder="Ex. NINEA de l'école" /></Field>
          <Field label="Numéro / référence" hint="C'est ce numéro qu'on vous demandera le plus souvent."><Input value={v.reference || ""} onChange={set("reference")} placeholder={v.type === "ninea" ? "Ex. 0071234567 2V2" : ""} /></Field>
          <Field label="Délivré par"><Input value={v.organisme || ""} onChange={set("organisme")} placeholder="Ex. ANSD, Ministère de l'Éducation, IEF…" /></Field>
          <Field label="Date de délivrance"><Input type="date" value={v.date_delivrance} onChange={set("date_delivrance")} max={today()} /></Field>
          <Field label="Date d'expiration" hint="Laissez vide si le document n'expire pas."><Input type="date" value={v.date_expiration} onChange={set("date_expiration")} /></Field>
        </div>
        <Field label="Remarques"><Textarea value={v.note || ""} onChange={set("note")} placeholder="Où se trouve l'original, à renouveler auprès de…" /></Field>
        <Field label={`Scans du document${total ? ` (${total})` : ""}`} hint={`Recto, verso, plusieurs pages : jusqu'à ${MAX_FICHIERS} fichiers, PDF ou photos de 2,5 Mo chacun. Les photos sont allégées automatiquement.`}>
          {total > 0 && (
            <div className="stack" style={{ gap: 6, marginBottom: 8 }}>
              {gardes.map((f, i) => ligne(f.nom, f.taille, false, () => setGardes(gardes.filter((g) => g.id !== f.id)), i))}
              {nouveaux.map((f, i) => ligne(f.fichier_nom, f.fichier_taille, true, () => setNouveaux(nouveaux.filter((n) => n.cle !== f.cle)), gardes.length + i))}
            </div>
          )}
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn" onClick={() => fichierRef.current.click()} disabled={lecture || busy || total >= MAX_FICHIERS}><Upload size={17} />{lecture ? "Préparation…" : total ? "Ajouter des fichiers" : "Choisir des fichiers"}</button>
            <button className="btn" onClick={() => photoRef.current.click()} disabled={lecture || busy || total >= MAX_FICHIERS}><Camera size={17} />{total ? "Ajouter une photo" : "Prendre une photo"}</button>
          </div>
          <input ref={fichierRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={choisir} />
          <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={choisir} />
        </Field>
      </div>
    </Modal>
  );
}

function Visionneuse({ doc, onClose }) {
  const fichiers = doc.fichiers || [];
  const [i, setI] = useState(0);
  const courant = fichiers[i];
  const { data, isLoading, error } = useQuery({ queryKey: ["archive-fichier", doc.id, courant?.id], queryFn: () => api.get(`/archives/${doc.id}/fichiers/${courant.id}`), staleTime: 10 * 60e3, enabled: !!courant });
  const url = useMemo(() => (data?.fichier ? URL.createObjectURL(versBlob(data.fichier)) : null), [data]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    const k = (e) => { if (e.key === "ArrowRight") setI((x) => Math.min(fichiers.length - 1, x + 1)); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [fichiers.length]);
  const pdf = data?.fichier_type === "application/pdf";
  return (
    <Modal wide title={doc.titre} onClose={onClose} footer={url && <>
      <a className="btn" href={url} target="_blank" rel="noreferrer"><ExternalLink size={16} />Ouvrir en grand</a>
      <a className="btn primary" href={url} download={data.fichier_nom || "document"}><Download size={16} />Télécharger{fichiers.length > 1 ? " ce fichier" : ""}</a>
    </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="badge teal">{TYPES_ARCHIVE[doc.type]}</span>
          {doc.reference && <span className="badge">N° {doc.reference}</span>}
          <Echeance d={doc.date_expiration} />
        </div>
        {fichiers.length > 1 && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm icon" onClick={() => setI(i - 1)} disabled={i === 0} aria-label="Fichier précédent"><ChevronLeft size={18} /></button>
            <div className="seg" style={{ flex: 1, overflowX: "auto" }}>
              {fichiers.map((f, k) => <button key={f.id} type="button" className={k === i ? "on" : ""} onClick={() => setI(k)} title={f.nom}>{k + 1}</button>)}
            </div>
            <button className="btn sm icon" onClick={() => setI(i + 1)} disabled={i === fichiers.length - 1} aria-label="Fichier suivant"><ChevronRight size={18} /></button>
          </div>
        )}
        {courant && <p className="xs muted" style={{ margin: 0 }}>{fichiers.length > 1 ? `Fichier ${i + 1} sur ${fichiers.length} · ` : ""}{courant.nom} · {taille(courant.taille)}</p>}
        {!courant ? <Empty icon={Paperclip} title="Aucun scan">Ajoutez-en avec le bouton Modifier.</Empty>
          : isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : pdf
          ? <iframe key={courant.id} title={courant.nom} src={url} style={{ width: "100%", height: "62vh", border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }} />
          : <img src={url} alt={courant.nom} style={{ width: "100%", maxHeight: "64vh", objectFit: "contain", borderRadius: 12, border: "1px solid var(--line)", background: "#fff" }} />}
        {pdf && <p className="xs muted">Si le PDF ne s'affiche pas sur ce téléphone, utilisez « Ouvrir en grand » ou « Télécharger ».</p>}
      </div>
    </Modal>
  );
}

export default function Archives() {
  const toast = useToast();
  const qc = useQueryClient();
  const [recherche, setRecherche] = useState("");
  const [cherche, setCherche] = useState("");
  const [type, setType] = useState("");
  const [edit, setEdit] = useState(null);
  const [voir, setVoir] = useState(null);
  const [del, setDel] = useState(null);
  useEffect(() => { const t = setTimeout(() => setCherche(recherche.trim()), 300); return () => clearTimeout(t); }, [recherche]);
  const f = { recherche: cherche, type };
  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["archives", f], queryFn: () => api.get("/archives", f), placeholderData: keepPreviousData });
  const tous = useQuery({ queryKey: ["archives", {}], queryFn: () => api.get("/archives"), enabled: !!(cherche || type) });
  const complet = cherche || type ? tous.data : data;
  const manquants = complet ? ESSENTIELS.filter((t) => !complet.rows.some((r) => r.type === t)) : [];
  const groupes = useMemo(() => {
    const g = {};
    for (const r of data?.rows || []) (g[r.type] ||= []).push(r);
    return Object.keys(TYPES_ARCHIVE).filter((t) => g[t]).map((t) => [t, g[t]]);
  }, [data]);

  const supprimer = async () => {
    try { await api.del(`/archives/${del.id}`); toast("Document supprimé des archives"); qc.invalidateQueries({ queryKey: ["archives"] }); }
    catch (e) { toast(e.message, "error"); }
    setDel(null);
  };

  return (
    <>
      <PageHead title="Archives officielles" sub="Les documents essentiels de l'école, toujours sous la main : NINEA, autorisation, RCCM, statuts…">
        <button className="btn primary" onClick={() => setEdit({})}><Plus size={17} />Ajouter un document</button>
      </PageHead>

      {complet && (
        <div className="dash" style={{ marginBottom: 22 }}>
          <div className="card kpi c3"><div className="top"><span className="label">Documents</span><span className="ic teal"><Archive size={20} /></span></div><div className="value">{complet.total}</div><div className="sub">{complet.total - complet.sans_scan} avec leur scan</div></div>
          <div className="card kpi c3"><div className="top"><span className="label">Sans scan</span><span className="ic azure"><Paperclip size={20} /></span></div><div className="value">{complet.sans_scan}</div><div className="sub">à scanner et joindre</div></div>
          <div className="card kpi c3"><div className="top"><span className="label">Expirent bientôt</span><span className="ic gold"><CalendarClock size={20} /></span></div><div className="value" style={{ color: complet.bientot ? "var(--gold-600)" : undefined }}>{complet.bientot}</div><div className="sub">dans les 60 jours</div></div>
          <div className="card kpi c3"><div className="top"><span className="label">Expirés</span><span className="ic coral"><AlertTriangle size={20} /></span></div><div className="value" style={{ color: complet.expires ? "var(--coral)" : undefined }}>{complet.expires}</div><div className="sub">à renouveler</div></div>
        </div>
      )}

      {manquants.length > 0 && (
        <div className="alert info" style={{ margin: "0 0 18px", alignItems: "center", flexWrap: "wrap" }}>
          <AlertTriangle size={18} />
          <span style={{ flex: 1, minWidth: 200 }}>Documents essentiels pas encore archivés :</span>
          {manquants.map((t) => <button key={t} className="btn sm" onClick={() => setEdit({ type: t })}><Plus size={14} />{TYPES_ARCHIVE[t]}</button>)}
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="with-icon"><Search size={17} /><Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher : NINEA, numéro, organisme, remarque…" aria-label="Rechercher un document" /></div>
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type de document"><option value="">Tous les types</option>{Object.entries(TYPES_ARCHIVE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </div>
        {isLoading ? <Spinner /> : error ? <div style={{ padding: 18 }}><ErrorBox error={error} /></div> : !data.rows.length ? (
          cherche || type
            ? <Empty icon={Search} title="Aucun document trouvé">Essayez un autre mot ou un autre type.</Empty>
            : <Empty icon={Archive} title="Aucun document archivé" action={<button className="btn primary" onClick={() => setEdit({ type: "ninea" })}><Plus size={16} />Archiver le NINEA</button>}>Commencez par le NINEA et l'autorisation d'ouverture : scannez-les ou prenez-les en photo.</Empty>
        ) : (
          <div className="table-wrap" style={{ opacity: isFetching ? 0.65 : 1 }}>
            <table className="table">
              <thead><tr><th>Document</th><th>Numéro</th><th className="hide-m">Délivré</th><th>Validité</th><th className="r">Scan</th><th /></tr></thead>
              <tbody>{groupes.map(([t, rows]) => [
                <tr key={`g-${t}`} className="mois-row"><td colSpan={6}>{TYPES_ARCHIVE[t]} <span className="xs muted">· {rows.length}</span></td></tr>,
                ...rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.titre}</strong>
                      {d.organisme && <div className="xs muted">{d.organisme}</div>}
                      {d.note && <div className="xs muted" style={{ maxWidth: 360, whiteSpace: "pre-line" }}>{d.note}</div>}
                    </td>
                    <td className="num"><strong>{d.reference || "—"}</strong></td>
                    <td className="hide-m num">{d.date_delivrance ? date(d.date_delivrance) : "—"}</td>
                    <td><Echeance d={d.date_expiration} /></td>
                    <td className="r">{d.fichiers?.length
                      ? <button className="btn sm" onClick={() => setVoir(d)} title={d.fichiers.map((f) => f.nom).join(", ")}><Eye size={15} />Voir{d.fichiers.length > 1 ? ` (${d.fichiers.length})` : ""}</button>
                      : <button className="btn sm ghost" onClick={() => setEdit(d)} style={{ color: "var(--muted)" }}><Upload size={15} />Joindre</button>}</td>
                    <td className="r" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn sm ghost icon" onClick={() => setEdit(d)} aria-label="Modifier"><Pencil size={15} /></button>
                      <button className="btn sm ghost icon" onClick={() => setDel(d)} aria-label="Supprimer"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                )),
              ])}</tbody>
            </table>
          </div>
        )}
      </div>
      <p className="xs muted" style={{ marginTop: 12, display: "flex", gap: 6, alignItems: "center" }}><FileText size={14} />Un document peut avoir plusieurs fichiers (recto, verso, pages). Chaque consultation est notée dans le journal. Seules la direction et l'administration ont accès à cette page.</p>

      {edit && <ArchiveForm doc={edit.id ? edit : null} typeInitial={edit.type} onClose={() => setEdit(null)} />}
      {voir && <Visionneuse doc={voir} onClose={() => setVoir(null)} />}
      {del && <Confirm danger title="Supprimer ce document ?" confirmLabel="Supprimer" message={`${del.titre}${del.reference ? ` (n° ${del.reference})` : ""} et tous ses fichiers seront définitivement supprimés.`} onConfirm={supprimer} onClose={() => setDel(null)} />}
    </>
  );
}
