import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { SessionProvider } from "./lib/session";
import { ToastProvider } from "./components/ui";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "./styles.css";

document.documentElement.dataset.theme = localStorage.getItem("eg2_theme") || "light";

// Après une mise à jour du logiciel, une page restée ouverte cherche d'anciens fichiers (PDF, Excel…) qui n'existent plus :
// on recharge la page une fois pour prendre la nouvelle version, puis l'action fonctionne.
window.addEventListener("vite:preloadError", (e) => {
  if (!navigator.onLine) return;
  const k = "eg2_rechargement_maj";
  const dernier = Number(sessionStorage.getItem(k) || 0);
  if (Date.now() - dernier < 30e3) return;
  e.preventDefault();
  sessionStorage.setItem(k, String(Date.now()));
  window.location.reload();
});

// Logiciel installé (fenêtre d'application) : la fenêtre d'impression de Windows n'a pas d'aperçu et peut bloquer.
// « Imprimer » fabrique alors un PDF et l'ouvre dans la visionneuse PDF, qui a son propre bouton d'impression avec aperçu.
const installe = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
if (installe) {
  const imprimerNatif = window.print.bind(window);
  window.print = async () => {
    if (!document.querySelector(".print-page .tickets > *")) return imprimerNatif();
    const w = window.open("", "_blank");
    try {
      const { fabriquerPdf } = await import("./components/Partager");
      const f = await fabriquerPdf("auto", document.title || "document");
      const url = URL.createObjectURL(f);
      if (w) w.location.href = url; else window.location.href = url;
    } catch { w?.close(); imprimerNatif(); }
  };
}

const qc = new QueryClient({
  defaultOptions: {
    // networkMode « always » : sans internet, les requêtes passent quand même par la copie gardée sur l'appareil.
    queries: { staleTime: 30e3, networkMode: "always", retry: (n, e) => e?.status !== 401 && e?.status !== 403 && e?.status !== 0 && n < 2, refetchOnWindowFocus: true },
    mutations: { networkMode: "always" },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ToastProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
