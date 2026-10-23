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
