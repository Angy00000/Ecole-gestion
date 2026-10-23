import { useEffect, useRef } from "react";
import { Heading, List, Pilcrow } from "lucide-react";

// Éditeur « comme dans Word » : on écrit directement, des boutons mettent la ligne en Titre, Puce ou Texte normal.
// Le texte est enregistré dans le format simple du logiciel (## titre, - puce, paragraphe).
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const versHtml = (texte) => (texte || "").split("\n").map((l) => l.trim()).filter(Boolean).map((t) =>
  t.startsWith("## ") ? `<h4>${esc(t.slice(3))}</h4>` : t.startsWith("- ") ? `<p class="ed-li">${esc(t.slice(2))}</p>` : `<p>${esc(t)}</p>`
).join("") || "<p><br></p>";

const versTexte = (root) => {
  const out = [];
  root.childNodes.forEach((n) => {
    const txt = (n.nodeType === 3 ? n.textContent : n.innerText || "").replace(/ /g, " ");
    const type = n.nodeName === "H4" ? "## " : n.classList?.contains("ed-li") || n.nodeName === "LI" || n.nodeName === "UL" ? "- " : "";
    txt.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => out.push(type + l.replace(/^(##\s|-\s)/, "")));
  });
  return out.join("\n");
};

export default function EditeurTexte({ value, onChange }) {
  const ref = useRef(null);
  const init = useRef(value);
  useEffect(() => { ref.current.innerHTML = versHtml(init.current); try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* */ } }, []);
  // Si on remet le texte par défaut depuis l'extérieur
  useEffect(() => { if (ref.current && value !== versTexte(ref.current)) ref.current.innerHTML = versHtml(value); }, [value]);
  const maj = () => onChange(versTexte(ref.current));
  const bloc = () => {
    const sel = window.getSelection(); if (!sel.rangeCount) return null;
    let n = sel.anchorNode; while (n && n.parentNode !== ref.current) n = n.parentNode;
    return n && n.nodeType === 1 ? n : null;
  };
  const mettre = (type) => {
    ref.current.focus();
    if (type === "titre") document.execCommand("formatBlock", false, "h4");
    else {
      document.execCommand("formatBlock", false, "p");
      const b = bloc(); if (b) b.classList.toggle("ed-li", type === "puce");
    }
    maj();
  };
  const coller = (e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); };
  const B = ({ t, I, l }) => <button type="button" className="btn sm" onMouseDown={(e) => e.preventDefault()} onClick={() => mettre(t)}><I size={15} />{l}</button>;
  return (
    <div className="editeur">
      <div className="editeur-barre">
        <span className="small muted">Cliquez sur une ligne puis choisissez :</span>
        <B t="titre" I={Heading} l="Titre" /><B t="puce" I={List} l="Puce" /><B t="normal" I={Pilcrow} l="Texte normal" />
      </div>
      <div ref={ref} className="editeur-zone" contentEditable suppressContentEditableWarning onInput={maj} onBlur={maj} onPaste={coller} spellCheck />
    </div>
  );
}
