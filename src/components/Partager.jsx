import { useState } from "react";
import { MessageCircle, FileDown, Share2 } from "lucide-react";
import { telWa } from "../lib/format";
import { useToast } from "./ui";

const TAILLES = { A4: [210, 297], A5: [148, 210], A4L: [297, 210] };

// Transforme les documents affichés (.tickets > article) en un PDF, une page par document.
async function fabriquerPdf(format, nom) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const pages = [...document.querySelectorAll(".print-page .tickets > *")].filter((el) => el.offsetHeight > 0);
  if (!pages.length) throw new Error("Aucun document à exporter.");
  const [w, h] = TAILLES[format] || TAILLES.A4;
  const ori = w > h ? "landscape" : "portrait";
  const pdf = new jsPDF({ unit: "mm", format: [w, h], orientation: ori, compress: true });
  document.body.classList.add("export-pdf");
  try {
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const ratio = canvas.width / canvas.height;
      let iw = w, ih = w / ratio;
      if (ih > h) { ih = h; iw = h * ratio; }
      if (i > 0) pdf.addPage([w, h], ori);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (w - iw) / 2, 0, iw, ih);
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
    } catch (e) { onglet?.close(); toast(e.message || "Export impossible", "error"); }
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
