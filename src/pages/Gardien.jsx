import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, BellRing } from "lucide-react";
import { api } from "../lib/api";
import { Spinner, ErrorBox, Empty, PageHead, useToast } from "../components/ui";
import { NIVEAUX, quand } from "../components/Cloche";

/** Le Gardien : toutes les alertes, avec filtre par gravité et activation des notifications sur l'appareil. */
export default function Gardien() {
  const nav = useNavigate();
  const toast = useToast();
  const [niveau, setNiveau] = useState("");
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const { data, isLoading, error } = useQuery({ queryKey: ["alertes", "tout"], queryFn: () => api.get("/alertes", { limit: 200 }), refetchInterval: 60e3 });
  const activer = async () => {
    if (typeof Notification === "undefined") return toast("Cet appareil ne gère pas les notifications. Sur iPhone : ajoutez d'abord le logiciel à l'écran d'accueil.", "error");
    const p = await Notification.requestPermission(); setPerm(p);
    toast(p === "granted" ? "Notifications activées sur cet appareil" : "Notifications refusées", p === "granted" ? undefined : "error");
  };
  const rows = (data?.rows || []).filter((a) => !niveau || a.niveau === niveau);
  return (
    <>
      <PageHead title="Le Gardien" sub="Il vous prévient des opérations sensibles : reçus annulés, modifiés ou supprimés, doublons, paiements antidatés, réductions accordées, mois retirés, dépenses supprimées, stock retiré, accès modifiés — et chaque matin, le bilan de la veille.">
        {perm !== "granted" && <button className="btn primary" onClick={activer}><BellRing size={17} />Recevoir les notifications</button>}
      </PageHead>
      <div className="seg" style={{ marginBottom: 14 }}>
        {[["", "Tout"], ["grave", "Grave"], ["attention", "Attention"], ["info", "Info"]].map(([k, l]) => <button key={k} className={niveau === k ? "on" : ""} onClick={() => setNiveau(k)}>{l}</button>)}
      </div>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : !rows.length ? <Empty icon={ShieldCheck} title="Rien à signaler">Le Gardien veille. Les alertes apparaîtront ici.</Empty> : (
        <div className="card gardien-liste">{rows.map((a) => { const N = NIVEAUX[a.niveau] || NIVEAUX.info; return (
          <div key={a.id} className={`g-item ${a.lien ? "lien" : ""}`} onClick={() => a.lien && nav(a.lien)}>
            <span className={`ic ${N.c}`}><N.I size={18} /></span>
            <div className="grow"><div className="between"><strong>{a.titre}</strong><span className={`badge ${N.c}`}>{N.l}</span></div><p>{a.message}</p>
              <span className="xs muted">{quand(a.created_at)}{a.auteur ? ` · par ${a.auteur}` : ""}</span></div>
          </div>
        ); })}</div>
      )}
    </>
  );
}
