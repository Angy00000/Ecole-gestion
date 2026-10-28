// Mise à la page automatique des documents d'une seule feuille (reçus, factures,
// bulletins, certificats, imprimés vierges…). Quand le contenu dépasse la feuille
// (beaucoup de lignes sur un reçu, beaucoup de matières sur un bulletin, texte
// allongé d'un règlement), on réduit tout le document pour qu'il tienne sur sa
// feuille au lieu d'être coupé à l'impression.
// Un texte (règlement…) qui dépasse d'un peu est réduit ; les états et listes longues (.etat) continuent sur plusieurs pages ; les emplois
// du temps (.a4l) ont leur propre ajustement.
const SEL = ".print-page .ticket, .print-page .bulletin, .print-page .doc:not(.etat):not(.a4l), .print-page .doc.doc-texte";
const MM = 96 / 25.4;
const MIN = 0.55;

const taille = (el) => (el.classList.contains("ticket") ? [148, 209] : [210, 297]);

export function libererPage(el) {
  el.style.zoom = ""; el.style.width = ""; el.style.minHeight = ""; el.style.height = "";
  delete el.dataset.ajuste;
}

export function ajusterPage(el) {
  const [w, h] = taille(el);
  libererPage(el);
  const besoin = el.scrollHeight;
  const dispo = h * MM;
  if (besoin <= dispo + 1) return;
  // Texte modifiable bien plus long qu'une page : on le laisse continuer sur la page suivante.
  if (el.classList.contains("etat") && besoin > dispo * 1.25) return;
  const z = Math.max(MIN, Math.floor((dispo / besoin) * 1000) / 1000);
  el.style.zoom = String(z);
  el.style.width = `${w / z}mm`;
  el.style.minHeight = `${h / z}mm`;
  el.style.height = `${h / z}mm`;
  el.dataset.ajuste = Math.round(z * 100);
}

export function ajusterPages() {
  document.querySelectorAll(SEL).forEach(ajusterPage);
}

let t = null;
const plusTard = () => { clearTimeout(t); t = setTimeout(ajusterPages, 120); };

export function demarrerAjustement() {
  if (typeof window === "undefined" || !window.MutationObserver) return;
  new MutationObserver((muts) => {
    if (!document.querySelector(".print-page")) return;
    if (muts.some((m) => m.type === "characterData" || m.addedNodes.length || m.removedNodes.length)) plusTard();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("beforeprint", ajusterPages);
  window.addEventListener("resize", plusTard);
  document.fonts?.ready.then(plusTard);
  document.addEventListener("load", (e) => { if (e.target?.tagName === "IMG") plusTard(); }, true);
}
