import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, School, Wallet, Receipt, AlertTriangle, BookOpen, CalendarCheck,
  GraduationCap, CalendarClock, HandCoins, FileBarChart, Utensils, Shirt, PencilRuler, MoonStar, PartyPopper, FileText, Settings, Menu, LogOut, KeyRound, Moon, Sun, Search, CalendarRange,
} from "lucide-react";
import { useSession } from "../lib/session";
import { ROLES, initiales } from "../lib/format";
import MotDePasse from "../pages/MotDePasse";
import SearchPalette from "./SearchPalette";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { group: "Scolarité" },
  { to: "/eleves", label: "Élèves", icon: Users },
  { to: "/classes", label: "Classes et tarifs", icon: School },
  { group: "Finances" },
  { to: "/paiements", label: "Encaissements", icon: Wallet, droit: "finances.lire" },
  { to: "/factures", label: "Factures mensuelles", icon: FileText, droit: "finances.lire" },
  { to: "/impayes", label: "Impayés", icon: AlertTriangle, droit: "finances.lire" },
  { to: "/recettes", label: "Recettes diverses", icon: HandCoins, droit: "depenses.lire" },
  { to: "/depenses", label: "Dépenses", icon: Receipt, droit: "depenses.lire" },
  { to: "/rapports", label: "Rapports", icon: FileBarChart, droit: "finances.lire" },
  { group: "Services" },
  { to: "/services/cantine", label: "Cantine", icon: Utensils, droit: "finances.lire" },
  { to: "/services/uniforme", label: "Uniformes et tenues", icon: Shirt, droit: "finances.lire" },
  { to: "/services/fournitures", label: "Fournitures", icon: PencilRuler, droit: "finances.lire" },
  { to: "/services/cours_soir", label: "Cours du soir", icon: MoonStar, droit: "finances.lire" },
  { to: "/services/cotisation", label: "Cotisation des fêtes", icon: PartyPopper, droit: "finances.lire" },
  { group: "Pédagogie" },
  { to: "/notes", label: "Notes et bulletins", icon: BookOpen, droit: "pedagogie.lire" },
  { to: "/absences", label: "Absences", icon: CalendarCheck, droit: "pedagogie.lire" },
  { to: "/emploi", label: "Emploi du temps", icon: CalendarClock, droit: "pedagogie.lire" },
  { to: "/enseignants", label: "Enseignants", icon: GraduationCap, droit: "pedagogie.lire" },
  { group: "Administration" },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

export default function Layout() {
  const s = useSession();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [mdp, setMdp] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("eg2_theme") || "light");

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("eg2_theme", theme); }, [theme]);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const k = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } };
    const sc = () => setScrolled(window.scrollY > 4);
    window.addEventListener("keydown", k); window.addEventListener("scroll", sc);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("scroll", sc); };
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
          {NAV.filter((n) => !n.droit || s.peut(n.droit)).filter((n, i, arr) => !n.group || (arr[i + 1] && !arr[i + 1].group)).map((n, i) => n.group
            ? <div key={i} className="nav-group">{n.group}</div>
            : <NavLink key={n.to} to={n.to} end={n.end} className={n.soon ? "soon" : undefined}><n.icon size={19} />{n.label}</NavLink>)}
        </nav>
        <div className="side-user">
          <span className="avatar round gold">{initiales(u?.prenom, u?.nom)}</span>
          <div className="who"><strong>{u?.prenom} {u?.nom}</strong><span>{ROLES[u?.role]}</span></div>
          <button onClick={() => setMdp(true)} title="Changer mon mot de passe" aria-label="Changer mon mot de passe"><KeyRound size={17} /></button>
          <button onClick={s.logout} title="Se déconnecter" aria-label="Se déconnecter"><LogOut size={17} /></button>
        </div>
      </aside>

      <div className="main">
        <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu size={20} /></button>
          <button className="gsearch" onClick={() => setSearch(true)} aria-label="Rechercher un élève">
            <Search size={18} /><span>Rechercher un élève…</span><span className="kbd">Ctrl K</span>
          </button>
          <span className="top-spacer" />
          <label className="annee-pill" title="Année scolaire affichée">
            <CalendarRange size={16} /><span>Année</span>
            <select value={s.annee?.id || ""} onChange={(e) => s.setAnnee(e.target.value)} aria-label="Année scolaire">
              {s.annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.active ? "" : " (archive)"}</option>)}
            </select>
          </label>
          <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}>
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </header>
        <main className="content"><Outlet /></main>
      </div>

      {open && <div className="overlay" style={{ zIndex: 90 }} onClick={() => setOpen(false)} />}
      {mdp && <MotDePasse onClose={() => setMdp(false)} />}
      {search && <SearchPalette onClose={() => setSearch(false)} />}
    </div>
  );
}
