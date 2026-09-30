import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getToken, setToken, setOnExpire } from "./api";

const Ctx = createContext(null);
const ANNEE = "eg2_annee";

export function SessionProvider({ children }) {
  const qc = useQueryClient();
  const [token, setTok] = useState(getToken());
  const [anneeId, setAnneeIdState] = useState(() => Number(localStorage.getItem(ANNEE)) || null);

  useEffect(() => { setOnExpire(() => { setTok(null); qc.clear(); }); }, [qc]);

  const boot = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => api.get("/bootstrap"),
    enabled: !!token,
    staleTime: 5 * 60e3,
  });

  const annees = boot.data?.annees || [];
  const active = annees.find((a) => a.active) || annees[0];
  const annee = annees.find((a) => a.id === anneeId) || active;

  const value = useMemo(() => ({
    token,
    user: boot.data?.user,
    etablissement: boot.data?.etablissement,
    annees,
    annee,
    anneeActive: active,
    ready: !token || boot.isSuccess,
    bootError: boot.error,
    peut: (droit) => (boot.data?.droits || []).some((d) => d === "*" || d === droit),
    login: (t) => { setToken(t); setTok(t); },
    logout: () => { setToken(null); setTok(null); qc.clear(); },
    setAnnee: (id) => { localStorage.setItem(ANNEE, id); setAnneeIdState(Number(id)); },
    refresh: () => qc.invalidateQueries({ queryKey: ["bootstrap"] }),
  }), [token, boot.data, boot.isSuccess, boot.error, anneeId, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
