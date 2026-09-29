import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { initiales } from "../lib/format";

// Recherche globale d'élèves (Ctrl+K), depuis n'importe quelle page.
export default function SearchPalette({ onClose }) {
  const s = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [i, setI] = useState(0);
  const ref = useRef();

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(() => api.get("/eleves", { q, annee_id: s.annee?.id, inscrits: "tous", statut: "tous", limit: 8 })
      .then((r) => { setRes(r.rows); setI(0); }).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (r) => { nav(`/eleves/${r.id}`); onClose(); };
  const key = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, res.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    if (e.key === "Enter" && res[i]) go(res[i]);
  };

  return (
    <div className="overlay palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Rechercher un élève">
        <div className="palette-input">
          <Search size={20} className="muted" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="Rechercher un élève par nom, matricule ou téléphone…" />
          <span className="kbd">Échap</span>
        </div>
        <div className="palette-list">
          {q.trim().length < 2 ? <p className="muted small" style={{ padding: 14 }}>Tapez au moins deux lettres.</p>
            : !res.length ? <p className="muted small" style={{ padding: 14 }}>Aucun élève trouvé pour « {q} ».</p>
            : res.map((r, k) => (
              <div key={r.id} className={`palette-item ${k === i ? "on" : ""}`} onMouseEnter={() => setI(k)} onClick={() => go(r)}>
                <span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span>
                <div className="grow"><strong>{r.nom} {r.prenom}</strong><span>{r.matricule}{r.telephone ? ` · ${r.telephone}` : ""}</span></div>
                {r.classe ? <span className={`chip ${r.cycle || ""}`}>{r.classe}</span> : <span className="badge gold">Non inscrit</span>}
              </div>
            ))}
        </div>
        <div className="palette-foot"><span>↑ ↓ pour naviguer</span><span className="row" style={{ gap: 4 }}><CornerDownLeft size={12} /> pour ouvrir</span></div>
      </div>
    </div>
  );
}
