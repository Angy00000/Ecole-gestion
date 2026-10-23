import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ShieldCheck, ShieldAlert, Info, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";

export const NIVEAUX = {
  grave: { l: "Grave", c: "coral", I: ShieldAlert },
  attention: { l: "Attention", c: "gold", I: AlertTriangle },
  info: { l: "Info", c: "teal", I: Info },
};
export const quand = (t) => {
  const d = new Date(t), s = (Date.now() - d) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400 && d.getDate() === new Date().getDate()) return `aujourd'hui à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** La cloche du Gardien (en haut de l'écran) : pastille des alertes non lues + notification sur l'appareil. */
export default function Cloche() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["alertes"], queryFn: () => api.get("/alertes", { limit: 15 }), refetchInterval: 60e3, refetchIntervalInBackground: true });
  const vues = useRef(null);
  // Notification système (téléphone / ordinateur) pour chaque nouvelle alerte des autres utilisateurs
  useEffect(() => {
    if (!data) return;
    const ids = data.rows.map((a) => a.id);
    if (vues.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
      data.rows.filter((a) => !vues.current.has(a.id) && !a.moi).slice(0, 3).forEach((a) => {
        try { const n = new Notification(`Gardien — ${a.titre}`, { body: a.message, icon: "/logo.png", tag: `alerte-${a.id}` }); n.onclick = () => { window.focus(); nav("/gardien"); }; } catch { /* */ }
      });
    }
    vues.current = new Set(ids);
  }, [data, nav]);
  const ouvrir = async () => {
    setOpen(!open);
    if (!open && data?.non_lues) { await api.post("/alertes/vues", {}).catch(() => {}); qc.invalidateQueries({ queryKey: ["alertes"] }); }
  };
  const n = data?.non_lues || 0;
  return (
    <div className={`cloche ${open ? "open" : ""}`}>
      <button className="icon-btn" onClick={ouvrir} aria-label={`Le Gardien : ${n} alerte(s) non lue(s)`} title="Le Gardien">
        <Bell size={19} />{n > 0 && <span className="cloche-n">{n > 99 ? "99+" : n}</span>}
      </button>
      {open && <>
        <div className="doc-menu-close" onClick={() => setOpen(false)} />
        <div className="cloche-panel">
          <div className="cloche-head"><ShieldCheck size={18} /><strong>Le Gardien</strong><span className="grow" /><Link to="/gardien" onClick={() => setOpen(false)} className="small">Tout voir →</Link></div>
          {!data?.rows.length ? <p className="muted small" style={{ padding: 16 }}>Rien à signaler. Le Gardien vous préviendra des annulations, modifications de reçus, suppressions, réductions accordées…</p> : (
            <ul>{data.rows.map((a) => { const N = NIVEAUX[a.niveau] || NIVEAUX.info; return (
              <li key={a.id} className={a.lien ? "lien" : ""} onClick={() => { if (a.lien) { setOpen(false); nav(a.lien); } }}>
                <span className={`ic ${N.c}`}><N.I size={16} /></span>
                <div><strong>{a.titre}</strong><p>{a.message}</p><span className="xs muted">{quand(a.created_at)}</span></div>
              </li>
            ); })}</ul>
          )}
        </div>
      </>}
    </div>
  );
}
