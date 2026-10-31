// Mise à la page automatique des documents d'une seule feuille (reçus, factures,
// bulletins, certificats, imprimés vierges…). Quand le contenu dépasse la feuille
// (beaucoup de lignes sur un reçu, beaucoup de matières sur un bulletin, texte
// allongé d'un règlement), on réduit tout le document pour qu'il tienne sur sa
// feuille au lieu d'être coupé à l'impression.
// Un texte (règlement…) qui dépasse d'un peu est réduit ; les états et listes longues (.etat) continuent sur plusieurs pages ; les emplois
// du temps (.a4l) ont leur propre ajustement.
const SEL = ".print-page .ticket, .print-page .bulletin, .print-page .doc:not(.etat):not(.a4l), .print-page .doc.doc-texte, .print-page .evt.a5";
const MM = 96 / 25.4;
// En dessous de 90 %, le texte deviendrait trop petit : on préfère continuer sur une 2e page.
const MIN = 0.9;

const taille = (el) => (el.classList.contains("ticket") || el.classList.contains("a5") ? [148, 209] : [210, 297]);

const zoomer = (el, z) => {
  const [w, h] = taille(el);
  el.style.zoom = String(z);
  el.style.width = `${w / z}mm`;
  el.style.minHeight = `${h / z}mm`;
  el.style.height = `${h / z}mm`;
};
const sansZoomStyle = (el) => { el.style.zoom = ""; el.style.width = ""; el.style.minHeight = ""; el.style.height = ""; };

export function libererPage(el) {
  sansZoomStyle(el);
  el.classList.remove("serre", "suite");
  delete el.dataset.ajuste;
}

/** Retire le zoom le temps d'une capture (PDF) ; renvoie la fonction qui le remet. */
export function sansZoom(el) {
  if (!el.style.zoom) return () => {};
  const z = Number(el.style.zoom);
  sansZoomStyle(el);
  return () => zoomer(el, z);
}

export function ajusterPage(el) {
  const [, h] = taille(el);
  libererPage(el);
  const dispo = h * MM;
  if (el.scrollHeight <= dispo + 1) return;
  // Texte modifiable bien plus long qu'une page : il continue naturellement sur la page suivante.
  if (el.classList.contains("etat") && el.scrollHeight > dispo * 1.25) return;
  // 1. On resserre les espacements (marges, hauteur des lignes) sans toucher à la taille du texte.
  el.classList.add("serre");
  const besoin = el.scrollHeight;
  if (besoin <= dispo + 1) { el.dataset.ajuste = "serre"; return; }
  // 2. Léger rétrécissement si ça suffit…
  const z = Math.floor((dispo / besoin) * 1000) / 1000;
  if (z >= MIN) { zoomer(el, z); el.dataset.ajuste = Math.round(z * 100); return; }
  // 3. … sinon le document continue sur une deuxième feuille, en gardant un texte lisible.
  el.classList.add("suite");
  el.dataset.ajuste = "suite";
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
