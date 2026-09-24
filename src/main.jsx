import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { SessionProvider } from "./lib/session";
import { ToastProvider } from "./components/ui";
import "./styles.css";

document.documentElement.dataset.theme = localStorage.getItem("eg2_theme") || "light";

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30e3, retry: (n, e) => e?.status !== 401 && e?.status !== 403 && n < 2, refetchOnWindowFocus: true },
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
