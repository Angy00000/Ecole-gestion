import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Détecte une nouvelle version publiée (le fichier principal change de nom à chaque mise en ligne)
// et propose de recharger. Vérifie au retour sur la fenêtre et toutes les 5 minutes.
const actuel = () => [...document.querySelectorAll("script[type=module][src]")].map((s) => new URL(s.src, location.href).pathname).find((p) => p.includes("/assets/"));

export default function MiseAJour() {
  const [dispo, setDispo] = useState(false);
  useEffect(() => {
    const moi = actuel();
    if (!moi) return;
    const verifier = async () => {
      try {
        const html = await (await fetch("/?v=" + Date.now(), { cache: "no-store" })).text();
        const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
        if (m && m[1] !== moi) setDispo(true);
      } catch {}
    };
    const t = setInterval(verifier, 5 * 60e3);
    const f = () => document.visibilityState === "visible" && verifier();
    document.addEventListener("visibilitychange", f);
    verifier();
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", f); };
  }, []);
  if (!dispo) return null;
  const maj = async () => {
    try { const r = await navigator.serviceWorker?.getRegistrations?.(); await Promise.all((r || []).map((x) => x.update())); const k = await caches?.keys?.(); await Promise.all((k || []).map((c) => caches.delete(c))); } catch {}
    location.reload();
  };
  return (
    <div className="maj">
      <RefreshCw size={18} />
      <span><strong>Nouvelle version disponible.</strong> Enregistrez ce que vous faites, puis mettez à jour.</span>
      <button className="btn gold sm" onClick={maj}>Mettre à jour</button>
    </div>
  );
}
