import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Place le titre de la page dans la barre du haut.
export default function PageTitle({ title, subtitle }) {
  const [el, setEl] = useState(null);
  useEffect(() => { setEl(document.getElementById("page-title")); document.title = `${title} — ESJBM`; }, [title]);
  return el ? createPortal(<><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</>, el) : null;
}
