import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, School, Wallet, Receipt, AlertTriangle, BookOpen, CalendarCheck,
  GraduationCap, Settings, Menu, LogOut, KeyRound, Moon, Sun, ChevronDown,
} from "lucide-react";
import { useSession } from "../lib/session";
import { ROLES, initiales } from "../lib/format";
import MotDePasse from "../pages/MotDePasse";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { group: "Scolarité" },
  { to: "/eleves", label: "Élèves", icon: Users },
  { to: "/classes", label: "Classes et tarifs", icon: School },
  { group: "Finances" },
  { to: "/paiements", label: "Encaissements", icon: Wallet, soon: true },
  { to: "/impayes", label: "Impayés", icon: AlertTriangle, soon: true },
  { to: "/depenses", label: "Dépenses", icon: Receipt, soon: true },
  { group: "Pédagogie" },
  { to: "/notes", label: "Notes et bulletins", icon: BookOpen, soon: true },
  { to: "/absences", label: "Absences", icon: CalendarCheck, soon: true },
  { to: "/enseignants", label: "Enseignants", icon: GraduationCap, soon: true },
  { group: "Administration" },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

export default function Layout() {
  const s = useSession();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mdp, setMdp] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("eg2_theme") || "light");
  const menuRef = useRef();

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("eg2_theme", theme); }, [theme]);
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const h = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const u = s.user;
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div><strong>ESJBM</strong><span>Saint Jean Baptiste<br />de Malika</span></div>
        </div>
        <nav className="nav" aria-label="Navigation principale">
          {NAV.map((n, i) => n.group
            ? <div key={i} className="nav-group">{n.group}</div>
            : <NavLink key={n.to} to={n.to} end={n.end} className={n.soon ? "soon" : undefined}><n.icon size={18} />{n.label}</NavLink>)}
        </nav>
        <div className="sidebar-foot">Version 2.0</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={20} /></button>
          <div className="title" id="page-title" />
          <label className="annee-pill" title="Année scolaire affichée">
            <span>Année</span>
            <select value={s.annee?.id || ""} onChange={(e) => s.setAnnee(e.target.value)}>
              {s.annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.active ? "" : " (archive)"}</option>)}
            </select>
          </label>
          <div className="user-chip" ref={menuRef}>
            <button onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
              <span className="avatar">{initiales(u?.prenom, u?.nom)}</span>
              <span className="who"><strong>{u?.prenom} {u?.nom}</strong><span>{ROLES[u?.role]}</span></span>
              <ChevronDown size={16} className="muted" />
            </button>
            {menu && (
              <div className="dropdown">
                <button onClick={() => { setMdp(true); setMenu(false); }}><KeyRound size={16} />Changer mon mot de passe</button>
                <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}{theme === "dark" ? "Mode clair" : "Mode sombre"}
                </button>
                <button onClick={s.logout}><LogOut size={16} />Se déconnecter</button>
              </div>
            )}
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
      {open && <div className="overlay" style={{ zIndex: 80, background: "rgba(10,30,36,.35)" }} onClick={() => setOpen(false)} />}
      {mdp && <MotDePasse onClose={() => setMdp(false)} />}
    </div>
  );
}
