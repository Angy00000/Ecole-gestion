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

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Pas de connexion internet. Vérifiez le réseau puis réessayez.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/auth/login") { setToken(null); onExpire(); }
  if (!res.ok) throw new ApiError(data.error || `Erreur ${res.status}`, res.status);
  return data;
}

const qs = (params) => {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return p.length ? "?" + new URLSearchParams(p).toString() : "";
};

export const api = {
  get: (path, params) => request("GET", path + qs(params)),
  post: (path, body) => request("POST", path, body || {}),
  put: (path, body) => request("PUT", path, body || {}),
  del: (path) => request("DELETE", path),
};
