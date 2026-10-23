// Accès à l'API v2 : jeton, erreurs lisibles, déconnexion automatique si la session expire.
const BASE = /^https?:$/.test(location.protocol) ? "/api/v2" : "https://ecole-gestion-eta.vercel.app/api/v2";
const TOKEN = "eg2_token";

export const getToken = () => localStorage.getItem(TOKEN);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN));

let onExpire = () => {};
export const setOnExpire = (fn) => { onExpire = fn; };

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

import { garder, relire, ACCEPTE, mettreEnAttente, marquerHorsLigne, brancher } from "./horsLigne";

const HORS_LIGNE = "Pas de connexion internet. Vérifiez le réseau puis réessayez.";
// Requête directe au serveur (utilisée aussi pour envoyer les saisies faites hors ligne).
async function direct(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(HORS_LIGNE, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/auth/login") { setToken(null); onExpire(); }
  if (!res.ok) throw new ApiError(data.error || `Erreur ${res.status}`, res.status);
  return data;
}
brancher(direct);

// Avec repli hors ligne : lectures servies depuis la copie de l'appareil, saisies autorisées mises en attente.
async function request(method, path, body, apercu) {
  const coupe = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!coupe) {
    try {
      const data = await direct(method, path, body);
      marquerHorsLigne(false);
      if (method === "GET" && getToken()) garder(path, data);
      return data;
    } catch (e) {
      if (e.status !== 0) throw e;
    }
  }
  if (path === "/auth/login") throw new ApiError(HORS_LIGNE, 0);
  marquerHorsLigne(true);
  if (method === "GET") {
    const c = await relire(path);
    if (c !== undefined) return c;
    throw new ApiError("Hors ligne : ces informations n'ont pas encore été ouvertes sur cet appareil. Elles seront disponibles au retour d'internet.", 0);
  }
  if (ACCEPTE(method, path)) return mettreEnAttente(method, path, body, apercu);
  throw new ApiError("Hors ligne : cette action a besoin d'internet. Sans connexion, on peut encaisser, faire l'appel, saisir des notes et enregistrer des dépenses ou recettes ; le reste attend le retour d'internet.", 0);
}

const qs = (params) => {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return p.length ? "?" + new URLSearchParams(p).toString() : "";
};

export const api = {
  get: (path, params) => request("GET", path + qs(params)),
  post: (path, body, apercu) => request("POST", path, body || {}, apercu),
  put: (path, body, apercu) => request("PUT", path, body || {}, apercu),
  del: (path) => request("DELETE", path),
};
