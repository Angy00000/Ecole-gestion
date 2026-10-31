import { useState } from "react";
import { MessageCircle, FileDown, Share2 } from "lucide-react";
import { telWa } from "../lib/format";
import { useToast } from "./ui";
import { sansZoom } from "../lib/ajuster";

const TAILLES = { A4: [210, 297], A5: [148, 210], A4L: [297, 210] };

// Transforme les documents affichés (.tickets > article) en un PDF, une page par document.
export async function fabriquerPdf(format, nom) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const pages = [...document.querySelectorAll(".print-page .tickets > *")].filter((el) => el.offsetHeight > 0);
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

/** Boutons « WhatsApp » et « PDF » pour la barre d'impression. */
export default function Partager({ format = "A4", nom, telephone, message = "" }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const mobile = typeof navigator !== "undefined" && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));
  const lancer = async (action) => {
    setBusy(action);
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
      const url = `https://wa.me/${telephone ? telWa(telephone) : ""}?text=${encodeURIComponent(message)}`;
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
  return (
    <>
      <button className="btn wa" onClick={() => lancer("wa")} disabled={!!busy} title="Envoyer le document en PDF par WhatsApp">
        <MessageCircle size={17} />{busy === "wa" ? "Préparation…" : "WhatsApp"}
      </button>
      {peutPartager && <button className="btn" onClick={() => lancer("partager")} disabled={!!busy} title="E-mail, Messages, Telegram…"><Share2 size={17} /><span className="hide-m">{busy === "partager" ? "Préparation…" : "Partager"}</span></button>}
      <button className="btn" onClick={() => lancer("pdf")} disabled={!!busy} title="Télécharger le PDF"><FileDown size={17} /><span className="hide-m">{busy === "pdf" ? "Préparation…" : "PDF"}</span></button>
    </>
  );
}
