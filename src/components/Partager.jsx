import { useState } from "react";
import { MessageCircle, FileDown, Share2, Link2, Users, Check, Copy } from "lucide-react";
import { telWa } from "../lib/format";
import { api } from "../lib/api";
import { useToast, Modal } from "./ui";
import { sansZoom } from "../lib/ajuster";

const TAILLES = { A4: [210, 297], A5: [148, 210], A4L: [297, 210] };

// Transforme les documents affichés (.tickets > article) en un PDF, une page par document.
// cible : clé d'un seul document de la page (attribut data-dest), pour l'envoyer à un seul parent.
export async function fabriquerPdf(format, nom, cible) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const sel = cible != null ? `.print-page .tickets > [data-dest="${cible}"]` : ".print-page .tickets > *";
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
const estMobile = () => typeof navigator !== "undefined" && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));
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

// Fenêtre de secours si le navigateur a bloqué l'ouverture de WhatsApp.
export function LienPret({ lien, onClose }) {
  const toast = useToast();
  return (
    <Modal title="Lien prêt" onClose={onClose} footer={<>
      <button className="btn" onClick={() => { navigator.clipboard?.writeText(lien.texte); toast("Message copié"); }}><Copy size={16} />Copier le message</button>
      <a className="btn wa" href={lien.wa} target="_blank" rel="noreferrer" onClick={onClose}><MessageCircle size={16} />Ouvrir WhatsApp</a>
    </>}>
      <p className="small">Le document est en ligne. Cliquez sur « Ouvrir WhatsApp » pour l'envoyer au parent.</p>
      <p className="xs muted" style={{ wordBreak: "break-all" }}>{lien.url}</p>
    </Modal>
  );
}

/** Ouvre WhatsApp vers le parent avec un lien vers le document (le parent n'a rien à télécharger d'avance). */
export function useEnvoiLien() {
  const toast = useToast();
  const [pret, setPret] = useState(null);
  const envoyer = async (fabriquer, { telephone, message, eleveId }) => {
    // Onglet ouvert tout de suite, sinon le navigateur le bloque après la préparation du document.
    const onglet = window.open("about:blank", "_blank");
    try {
      const file = await fabriquer();
      const url = await deposerFichier(file, { eleveId, telephone });
      const texte = messageAvecLien(message, file.name.replace(/\.\w+$/, ""), url);
      const wa = lienWa(telephone, texte);
      if (onglet && !onglet.closed) onglet.location.href = wa; else setPret({ url, wa, texte });
      return true;
    } catch (e) {
      onglet?.close();
      toast(e.message || "Envoi impossible", "error");
      return false;
    }
  };
  return { envoyer, fenetre: pret && <LienPret lien={pret} onClose={() => setPret(null)} /> };
}

/** Un document de la page par parent : bulletins de la classe, factures du mois, reçus d'un encaissement groupé. */
function EnvoiParParent({ format, destinataires, onClose }) {
  const { envoyer, fenetre } = useEnvoiLien();
  const [fait, setFait] = useState({});
  const [encours, setEncours] = useState(null);
  const avecTel = destinataires.filter((d) => d.telephone).length;
  const go = async (d) => {
    setEncours(d.cle);
    const ok = await envoyer(() => fabriquerPdf(format, d.fichier, d.cle), { telephone: d.telephone, message: d.message, eleveId: d.eleve_id });
    if (ok) setFait((x) => ({ ...x, [d.cle]: true }));
    setEncours(null);
  };
  return (
    <Modal title="Envoyer à chaque parent" icon={<Users size={20} />} wide onClose={onClose} footer={<button className="btn" onClick={onClose}>Fermer</button>}>
      <p className="small muted" style={{ marginBottom: 14 }}>Chaque parent reçoit sur WhatsApp un message avec le lien vers <strong>son</strong> document. {avecTel < destinataires.length && `${destinataires.length - avecTel} élève(s) sans numéro de téléphone.`}</p>
      <div className="table-wrap"><table className="table">
        <tbody>{destinataires.map((d) => (
          <tr key={d.cle}>
            <td><strong>{d.nom}</strong><div className="xs muted">{d.telephone || "Aucun numéro"}</div></td>
            <td className="r" style={{ whiteSpace: "nowrap" }}>
              {fait[d.cle] && <span className="badge green" style={{ marginRight: 8 }}><Check size={13} />Envoyé</span>}
              <button className={`btn sm ${fait[d.cle] ? "" : "wa"}`} disabled={!d.telephone || !!encours} onClick={() => go(d)}>
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

/** Boutons d'envoi pour la barre d'impression.
 *  - « Lien WhatsApp » : le parent reçoit un lien vers le PDF (rien à joindre à la main).
 *  - « PDF WhatsApp » : le fichier lui-même (partage du téléphone, ou téléchargement + WhatsApp sur ordinateur).
 *  - destinataires : [{ cle, nom, telephone, eleve_id, message, fichier }] pour envoyer à chaque parent son document. */
export default function Partager({ format = "A4", nom, telephone, message = "", eleveId, destinataires }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [parParent, setParParent] = useState(false);
  const { envoyer, fenetre } = useEnvoiLien();
  const mobile = estMobile();
  const lancer = async (action) => {
    setBusy(action);
    if (action === "lien") {
      await envoyer(() => fabriquerPdf(format, nom), { telephone, message, eleveId });
      setBusy(null);
      return;
    }
    // Sur ordinateur, on ouvre l'onglet WhatsApp tout de suite (sinon le navigateur le bloque après la création du PDF).
    const onglet = action === "wa" && !mobile ? window.open("about:blank", "_blank") : null;
    try {
      const file = await fabriquerPdf(format, nom);
      if (action === "pdf") { telecharger(file); toast(`${file.name} téléchargé`); return; }
      if ((action === "partager" || mobile) && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: nom, text: message }); return; }
        catch (e) { if (e.name === "AbortError") return; }
      }
      // Ordinateur : on télécharge le PDF et on ouvre la conversation WhatsApp du parent.
      telecharger(file);
      const url = lienWa(telephone, message);
      if (onglet) onglet.location.href = url; else window.open(url, "_blank");
      toast("PDF téléchargé : dans WhatsApp, cliquez sur le trombone 📎 puis choisissez le fichier dans « Téléchargements ».");
    } catch (e) {
      onglet?.close();
      const maj = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(e?.message || "");
      toast(maj ? (navigator.onLine ? "Le logiciel vient d'être mis à jour : la page se recharge, puis recommencez." : "Le PDF a besoin d'internet la première fois sur cet appareil.") : e.message || "Export impossible", "error");
      if (maj && navigator.onLine) setTimeout(() => window.location.reload(), 1500);
    }
    finally { setBusy(null); }
  };
  const peutPartager = typeof navigator !== "undefined" && !!navigator.share;
  const plusieurs = destinataires && destinataires.length > 1;
  return (
    <>
      {plusieurs && <button className="btn wa" onClick={() => setParParent(true)} title="Envoyer à chaque parent le document de son enfant"><Users size={17} />Envoyer à chaque parent</button>}
      {!plusieurs && <button className="btn wa" onClick={() => lancer("lien")} disabled={!!busy} title="Le parent reçoit un message WhatsApp avec le lien du document">
        <Link2 size={17} />{busy === "lien" ? "Préparation…" : "Lien WhatsApp"}
      </button>}
      <button className="btn" onClick={() => lancer("wa")} disabled={!!busy} title="Envoyer le fichier PDF lui-même par WhatsApp">
        <MessageCircle size={17} /><span className="hide-m">{busy === "wa" ? "Préparation…" : "PDF WhatsApp"}</span>
      </button>
      {peutPartager && <button className="btn" onClick={() => lancer("partager")} disabled={!!busy} title="E-mail, Messages, Telegram…"><Share2 size={17} /><span className="hide-m">{busy === "partager" ? "Préparation…" : "Partager"}</span></button>}
      <button className="btn" onClick={() => lancer("pdf")} disabled={!!busy} title="Télécharger le PDF"><FileDown size={17} /><span className="hide-m">{busy === "pdf" ? "Préparation…" : "PDF"}</span></button>
      {parParent && <EnvoiParParent format={format} destinataires={destinataires} onClose={() => setParParent(false)} />}
      {fenetre}
    </>
  );
}
