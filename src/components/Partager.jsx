import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, FileDown, Share2, Link2, Users, Check, Copy, FileText } from "lucide-react";
import { telWa } from "../lib/format";
import { api } from "../lib/api";
import { useToast, Modal, Select, Spinner } from "./ui";
import { useSession } from "../lib/session";
import { sansZoom } from "../lib/ajuster";

const TAILLES = { A4: [210, 297], A5: [148, 210], A4L: [297, 210] };

// Transforme les documents affichés (.tickets > article) en un PDF, une page par document.
// cible : clé d'un seul document de la page (attribut data-dest), pour l'envoyer à un seul parent.
export async function fabriquerPdf(format, nom, cible) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const sel = cible != null ? `.print-page .tickets [data-dest="${cible}"]` : ".print-page .tickets > *";
  const pages = [...document.querySelectorAll(sel)].filter((el) => el.offsetHeight > 0);
  if (!pages.length) throw new Error("Aucun document à exporter.");
  if (format === "auto") { // d'après la taille de la feuille affichée
    const p0 = pages[0];
    const mm = p0.offsetWidth * 25.4 / 96;
    format = p0.classList.contains("ticket") || p0.classList.contains("a5") ? "A5" : p0.classList.contains("a4l") ? "A4L"
      : p0.offsetWidth > p0.offsetHeight * 1.1 ? "A4L" : mm < 170 && !p0.style.zoom ? "A5" : "A4";
  }
  const [w, h] = TAILLES[format] || TAILLES.A4;
  const ori = w > h ? "landscape" : "portrait";
  const pdf = new jsPDF({ unit: "mm", format: [w, h], orientation: ori, compress: true });
  document.body.classList.add("export-pdf");
  let premiere = true;
  const ajouter = (src, iw, ih) => {
    if (!premiere) pdf.addPage([w, h], ori);
    premiere = false;
    pdf.addImage(src, "JPEG", (w - iw) / 2, 0, iw, ih);
  };
  try {
    for (const el of pages) {
      // La réduction automatique (zoom) n'est pas comprise par html2canvas : on capture le document à sa taille réelle.
      const zoom = !!el.style.zoom;
      const remettre = sansZoom(el);
      try {
        const pageH = el.offsetWidth * h / w; // hauteur d'une feuille, en pixels écran
        const long = ((el.classList.contains("etat") || el.classList.contains("suite")) && !zoom && el.offsetHeight > pageH + 2) || el.offsetHeight > pageH * 1.35;
        const scale = Math.min(2, 30000 / Math.max(el.offsetHeight, 1));
        const canvas = await html2canvas(el, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });
        if (!long) {
          const ratio = canvas.width / canvas.height;
          let iw = w, ih = w / ratio;
          if (ih > h) { ih = h; iw = h * ratio; }
          ajouter(canvas.toDataURL("image/jpeg", 0.92), iw, ih);
          continue;
        }
        // État ou liste longue : plusieurs feuilles, coupées entre deux lignes du tableau.
        const top = el.getBoundingClientRect().top;
        const coupes = [...el.querySelectorAll("tr, h3, .etat-total, .d-sign, .d-head")].map((x) => x.getBoundingClientRect().bottom - top).sort((a, b) => a - b);
        const total = el.offsetHeight;
        const k = canvas.width / el.offsetWidth;
        for (let debut = 0; debut < total - 2;) {
          let fin = Math.min(total, debut + pageH);
          if (fin < total) {
            const c = coupes.filter((y) => y > debut + pageH * 0.5 && y <= fin).pop();
            if (c) fin = c;
          }
          const part = document.createElement("canvas");
          part.width = canvas.width; part.height = Math.round((fin - debut) * k);
          const ctx = part.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, part.width, part.height);
          ctx.drawImage(canvas, 0, Math.round(debut * k), canvas.width, part.height, 0, 0, canvas.width, part.height);
          ajouter(part.toDataURL("image/jpeg", 0.92), w, (fin - debut) * w / el.offsetWidth);
          debut = fin;
        }
      } finally {
        remettre();
      }
    }
  } finally { document.body.classList.remove("export-pdf"); }
  const blob = pdf.output("blob");
  return new File([blob], `${nom.replace(/[^\w\-]+/g, "_")}.pdf`, { type: "application/pdf" });
}

const telecharger = (file) => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
const lireDataUrl = (file) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(new Error("Lecture du fichier impossible.")); r.readAsDataURL(file); });
// Adresse publique des liens : celle du site (ou du site en ligne depuis l'application Windows).
const ORIGINE = typeof location !== "undefined" && /^https?:$/.test(location.protocol) ? location.origin : "https://ecole-gestion-eta.vercel.app";
export const TYPES_FICHIERS = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.pptx";

/** Enregistre le fichier sur le serveur et renvoie le lien à envoyer au parent. */
export async function deposerFichier(file, { eleveId, telephone } = {}) {
  if (file.size > 3 * 1024 * 1024) throw new Error("Fichier trop lourd : 3 Mo au maximum.");
  const fichier = await lireDataUrl(file);
  const r = await api.post("/partages", { fichier, nom: file.name, eleve_id: eleveId || null, telephone: telephone || null });
  return `${ORIGINE}/d/${r.jeton}`;
}
export const messageAvecLien = (message, nom, url) => `${message ? `${message}\n\n` : ""}📄 ${nom.replace(/_/g, " ")} : ${url}`;
export const lienWa = (telephone, texte) => `https://wa.me/${telephone ? telWa(telephone) : ""}?text=${encodeURIComponent(texte)}`;

// Le navigateur sait-il donner un fichier à WhatsApp (feuille de partage du téléphone, de l'iPad ou de Windows) ?
export const partageFichiers = () => {
  try { return !!navigator.canShare?.({ files: [new File(["x"], "test.pdf", { type: "application/pdf" })] }); } catch { return false; }
};

// Mode d'envoi choisi : le document PDF lui-même (par défaut) ou un lien. Retenu sur l'appareil.
const CLE_MODE = "eg2_envoi_mode";
const lireMode = () => { try { return localStorage.getItem(CLE_MODE) === "lien" ? "lien" : "document"; } catch { return "document"; } };
export function ChoixMode({ mode, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Forme de l'envoi" style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--surface-2)" }}>
      {[["document", "Document PDF", FileText], ["lien", "Lien", Link2]].map(([k, l, I]) => (
        <button key={k} type="button" role="radio" aria-checked={mode === k} className={`btn sm ${mode === k ? "primary" : "ghost"}`} onClick={() => onChange(k)}><I size={14} />{l}</button>
      ))}
    </div>
  );
}

// Fenêtres de secours : le navigateur a bloqué WhatsApp, ou le partage demande un nouveau clic.
function Pret({ pret, onClose }) {
  const toast = useToast();
  if (pret.type === "lien") return (
    <Modal title="Lien prêt" onClose={onClose} footer={<>
      <button className="btn" onClick={() => { navigator.clipboard?.writeText(pret.texte); toast("Message copié"); }}><Copy size={16} />Copier le message</button>
      <a className="btn wa" href={pret.wa} target="_blank" rel="noreferrer" onClick={onClose}><MessageCircle size={16} />Ouvrir WhatsApp</a>
    </>}>
      <p className="small">Le document est en ligne. Cliquez sur « Ouvrir WhatsApp » pour l'envoyer au parent.</p>
      <p className="xs muted" style={{ wordBreak: "break-all" }}>{pret.url}</p>
    </Modal>
  );
  const partager = async () => {
    try { await navigator.share({ files: [pret.file], text: pret.message }); onClose(); }
    catch (e) { if (e.name !== "AbortError") { telecharger(pret.file); window.open(lienWa(pret.telephone, pret.message), "_blank"); onClose(); } }
  };
  return (
    <Modal title="Document prêt" icon={<FileText size={20} />} onClose={onClose} footer={<>
      <button className="btn" onClick={() => { telecharger(pret.file); toast("PDF téléchargé"); }}><FileDown size={16} />Télécharger</button>
      <button className="btn wa" onClick={partager}><MessageCircle size={16} />Envoyer sur WhatsApp</button>
    </>}>
      <p className="small"><strong>{pret.file.name}</strong> est prêt. Cliquez sur « Envoyer sur WhatsApp », choisissez WhatsApp puis {pret.nom ? <strong>{pret.nom}</strong> : "le parent"}{pret.telephone ? ` (${pret.telephone})` : ""}.</p>
    </Modal>
  );
}

/** Envoi d'un document à un parent par WhatsApp.
 *  - « document » : le PDF lui-même. Téléphone, iPad et Windows : la feuille de partage s'ouvre, on choisit WhatsApp puis le parent.
 *    Sinon : le PDF est téléchargé et la discussion du parent s'ouvre ; on le joint avec le trombone.
 *  - « lien » : le parent reçoit un message avec un lien vers le document (discussion du parent ouverte directement). */
export function useEnvoi() {
  const toast = useToast();
  const [pret, setPret] = useState(null);
  const [mode, setModeState] = useState(lireMode);
  const setMode = (m) => { setModeState(m); try { localStorage.setItem(CLE_MODE, m); } catch { /* rien */ } };
  const envoyer = async (fabriquer, { telephone, message, eleveId, nom, force } = {}) => {
    const m = force || mode;
    const partage = m === "document" && partageFichiers();
    // Onglet ouvert tout de suite, sinon le navigateur le bloque après la préparation du document.
    const onglet = partage ? null : window.open("about:blank", "_blank");
    try {
      const file = await fabriquer();
      if (m === "lien") {
        const url = await deposerFichier(file, { eleveId, telephone });
        const texte = messageAvecLien(message, file.name.replace(/\.\w+$/, ""), url);
        const wa = lienWa(telephone, texte);
        if (onglet && !onglet.closed) onglet.location.href = wa; else setPret({ type: "lien", url, wa, texte });
        return true;
      }
      if (partage) {
        try { await navigator.share({ files: [file], text: message }); return true; }
        catch (e) {
          if (e.name === "AbortError") return false;
          setPret({ type: "document", file, message, telephone, nom }); // il faut un nouveau clic pour partager
          return true;
        }
      }
      telecharger(file);
      const wa = lienWa(telephone, message);
      if (onglet && !onglet.closed) onglet.location.href = wa; else window.open(wa, "_blank");
      toast("PDF téléchargé : dans WhatsApp, cliquez sur le trombone 📎 puis choisissez le fichier dans « Téléchargements ».");
      return true;
    } catch (e) {
      onglet?.close();
      const maj = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(e?.message || "");
      toast(maj ? (navigator.onLine ? "Le logiciel vient d'être mis à jour : la page se recharge, puis recommencez." : "Le PDF a besoin d'internet la première fois sur cet appareil.") : e.message || "Envoi impossible", "error");
      if (maj && navigator.onLine) setTimeout(() => window.location.reload(), 1500);
      return false;
    }
  };
  return { envoyer, mode, setMode, fenetre: pret && <Pret pret={pret} onClose={() => setPret(null)} /> };
}
export const useEnvoiLien = useEnvoi;

/** Un document de la page par parent : bulletins de la classe, factures du mois, reçus d'un encaissement groupé. */
function EnvoiParParent({ format, destinataires, onClose }) {
  const { envoyer, mode, setMode, fenetre } = useEnvoi();
  const [fait, setFait] = useState({});
  const [encours, setEncours] = useState(null);
  const avecTel = destinataires.filter((d) => d.telephone).length;
  const go = async (d) => {
    setEncours(d.cle);
    const ok = await envoyer(() => fabriquerPdf(format, d.fichier, d.cle), { telephone: d.telephone, message: d.message, eleveId: d.eleve_id, nom: d.nom });
    if (ok) setFait((x) => ({ ...x, [d.cle]: true }));
    setEncours(null);
  };
  return (
    <Modal title="Envoyer à chaque parent" icon={<Users size={20} />} wide onClose={onClose} footer={<button className="btn" onClick={onClose}>Fermer</button>}>
      <div className="between" style={{ gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <p className="small muted" style={{ margin: 0, flex: "1 1 260px" }}>
          {mode === "document" ? "Chaque parent reçoit le PDF de son enfant. Après « Envoyer », choisissez WhatsApp puis le parent indiqué." : "Chaque parent reçoit un message avec le lien vers le document de son enfant."}
          {avecTel < destinataires.length && ` ${destinataires.length - avecTel} élève(s) sans numéro.`}
        </p>
        <ChoixMode mode={mode} onChange={setMode} />
      </div>
      <div className="table-wrap"><table className="table">
        <tbody>{destinataires.map((d) => (
          <tr key={d.cle}>
            <td><strong>{d.nom}</strong><div className="xs muted">{d.telephone || "Aucun numéro"}</div></td>
            <td className="r" style={{ whiteSpace: "nowrap" }}>
              {fait[d.cle] && <span className="badge green" style={{ marginRight: 8 }}><Check size={13} />Envoyé</span>}
              <button className={`btn sm ${fait[d.cle] ? "" : "wa"}`} disabled={(mode === "lien" && !d.telephone) || !!encours} onClick={() => go(d)}>
                <MessageCircle size={15} />{encours === d.cle ? "Préparation…" : fait[d.cle] ? "Renvoyer" : "Envoyer"}
              </button>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      {fenetre}
    </Modal>
  );
}

/** Le même document (imprimé vierge, fournitures, emploi du temps…) aux parents d'une classe, un par un. */
function EnvoiAuxParents({ format, nom, message, classeId, onClose }) {
  const s = useSession();
  const { envoyer, mode, setMode, fenetre } = useEnvoi();
  const [classe, setClasse] = useState(classeId ? String(classeId) : "");
  const [fait, setFait] = useState({});
  const [encours, setEncours] = useState(null);
  const cache = useRef(null); // le PDF n'est fabriqué qu'une fois
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const eleves = useQuery({ queryKey: ["eleves", "parents", classe, s.annee?.id], queryFn: () => api.get("/eleves", { classe_id: classe, annee_id: s.annee?.id, limit: 500 }), enabled: !!classe });
  const rows = eleves.data?.rows || [];
  const go = async (e) => {
    setEncours(e.id);
    const ok = await envoyer(async () => (cache.current ||= await fabriquerPdf(format, nom)),
      { telephone: e.telephone, message, eleveId: e.id, nom: `${e.nom} ${e.prenom}` });
    if (ok) setFait((x) => ({ ...x, [e.id]: true }));
    setEncours(null);
  };
  return (
    <Modal title="Envoyer aux parents" icon={<Users size={20} />} wide onClose={onClose} footer={<button className="btn" onClick={onClose}>Fermer</button>}>
      <div className="between" style={{ gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: "1 1 220px", maxWidth: 280 }}>
          <Select value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe">
            <option value="">Choisir la classe…</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Select>
        </div>
        <ChoixMode mode={mode} onChange={setMode} />
      </div>
      <p className="small muted" style={{ marginBottom: 12 }}>
        {mode === "document" ? "Chaque parent reçoit le document PDF. Après « Envoyer », choisissez WhatsApp puis le parent indiqué." : "Chaque parent reçoit un message avec le lien vers le document."}
        {rows.length > 0 && ` ${Object.keys(fait).length}/${rows.length} envoyé(s).`}
      </p>
      {!classe ? <p className="muted small">Choisissez une classe pour voir ses parents.</p> : eleves.isLoading ? <Spinner /> : !rows.length ? <p className="muted small">Aucun élève dans cette classe.</p> : (
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}><table className="table">
          <tbody>{rows.map((e) => (
            <tr key={e.id}>
              <td><strong>{e.nom} {e.prenom}</strong><div className="xs muted">{e.telephone || "Aucun numéro"}</div></td>
              <td className="r" style={{ whiteSpace: "nowrap" }}>
                {fait[e.id] && <span className="badge green" style={{ marginRight: 8 }}><Check size={13} />Envoyé</span>}
                <button className={`btn sm ${fait[e.id] ? "" : "wa"}`} disabled={(mode === "lien" && !e.telephone) || !!encours} onClick={() => go(e)}>
                  <MessageCircle size={15} />{encours === e.id ? "Préparation…" : fait[e.id] ? "Renvoyer" : "Envoyer"}
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {fenetre}
    </Modal>
  );
}

/** Boutons d'envoi pour la barre d'impression.
 *  - « WhatsApp » : le document PDF lui-même.
 *  - « Lien » : le parent reçoit un lien vers le PDF dans sa discussion.
 *  - destinataires : [{ cle, nom, telephone, eleve_id, message, fichier }] pour envoyer à chaque parent son document.
 *  - parents : { classeId } pour envoyer le même document aux parents d'une classe. */
export default function Partager({ format = "A4", nom, telephone, message = "", eleveId, destinataires, parents }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [parParent, setParParent] = useState(false);
  const [auxParents, setAuxParents] = useState(false);
  const { envoyer, fenetre } = useEnvoi();
  const lancer = async (action) => {
    setBusy(action);
    try {
      if (action === "document" || action === "lien") { await envoyer(() => fabriquerPdf(format, nom), { telephone, message, eleveId, force: action }); return; }
      const file = await fabriquerPdf(format, nom);
      if (action === "pdf") { telecharger(file); toast(`${file.name} téléchargé`); return; }
      if (action === "partager" && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: nom, text: message }); } catch { /* annulé */ }
      }
    } catch (e) { toast(e.message || "Export impossible", "error"); }
    finally { setBusy(null); }
  };
  const peutPartager = typeof navigator !== "undefined" && !!navigator.share;
  const plusieurs = destinataires && destinataires.length > 1;
  return (
    <>
      {plusieurs && <button className="btn wa" onClick={() => setParParent(true)} title="Envoyer à chaque parent le document de son enfant"><Users size={17} />Envoyer à chaque parent</button>}
      {!plusieurs && parents && <button className="btn wa" onClick={() => setAuxParents(true)} title="Envoyer ce document aux parents d'une classe"><Users size={17} />Envoyer aux parents</button>}
      <button className={`btn ${plusieurs || parents ? "" : "wa"}`} onClick={() => lancer("document")} disabled={!!busy} title="Envoyer le document PDF par WhatsApp">
        <MessageCircle size={17} />{busy === "document" ? "Préparation…" : "WhatsApp"}
      </button>
      {!plusieurs && <button className="btn" onClick={() => lancer("lien")} disabled={!!busy} title="Envoyer un lien vers le document dans la discussion du parent">
        <Link2 size={17} /><span className="hide-m">{busy === "lien" ? "Préparation…" : "Lien"}</span>
      </button>}
      {peutPartager && <button className="btn" onClick={() => lancer("partager")} disabled={!!busy} title="E-mail, Messages, Telegram…"><Share2 size={17} /><span className="hide-m">{busy === "partager" ? "Préparation…" : "Partager"}</span></button>}
      <button className="btn" onClick={() => lancer("pdf")} disabled={!!busy} title="Télécharger le PDF"><FileDown size={17} /><span className="hide-m">{busy === "pdf" ? "Préparation…" : "PDF"}</span></button>
      {auxParents && <EnvoiAuxParents format={format} nom={nom} message={message} classeId={parents?.classeId} onClose={() => setAuxParents(false)} />}
      {parParent && <EnvoiParParent format={format} destinataires={destinataires} onClose={() => setParParent(false)} />}
      {fenetre}
    </>
  );
}
