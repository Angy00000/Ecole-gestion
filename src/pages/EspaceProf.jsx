import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, PenLine, CalendarCheck, CalendarClock, FileText, CalendarDays, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { initiales } from "../lib/format";
import { Spinner, ErrorBox, Empty } from "../components/ui";

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Accueil de l'espace enseignant : sa classe, ses élèves, et les raccourcis notes / appel / emploi du temps. */
export default function EspaceProf() {
  const s = useSession();
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const classe = classes.data?.[0];
  const eleves = useQuery({ queryKey: ["eleves", "prof", classe?.id, s.annee?.id], queryFn: () => api.get("/eleves", { classe_id: classe.id, annee_id: s.annee?.id, limit: 200 }), enabled: !!classe });
  const edt = useQuery({ queryKey: ["emploi", classe?.id], queryFn: () => api.get("/emploi", { classe_id: classe.id }), enabled: !!classe });
  if (classes.isLoading) return <Spinner />;
  if (classes.error) return <ErrorBox error={classes.error} />;
  const now = new Date();
  const salut = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";
  if (!classe) return (
    <div style={{ marginTop: 14 }}>
      <h2>{salut} {s.user.prenom}</h2>
      <Empty icon={Users} title="Aucune classe ne vous est encore attribuée">Demandez à la direction de vous attribuer votre classe dans Paramètres → Utilisateurs.</Empty>
    </div>
  );
  const rows = eleves.data?.rows || [];
  const aujourdhui = (edt.data || []).filter((c) => c.jour === now.getDay());
  const TUILES = [
    { to: "/eleves", icon: Users, l: "Mes élèves", d: `${rows.length || classe.effectif || 0} élèves`, t: "teal" },
    { to: "/notes", icon: PenLine, l: "Saisir les notes", d: "Devoirs et compositions", t: "gold" },
    { to: "/absences", icon: CalendarCheck, l: "Faire l'appel", d: "Absences et retards", t: "coral" },
    { to: "/emploi", icon: CalendarClock, l: "Emploi du temps", d: "Voir et imprimer", t: "azure" },
    { to: "/notes?vue=bulletins", icon: FileText, l: "Bulletins", d: "Moyennes et appréciations", t: "green" },
  ];
  return (
    <div className="prof-space" style={{ marginTop: 14 }}>
      <section className="hero lattice">
        <div className="grow">
          <span className="date"><CalendarDays size={15} />{JOURS[now.getDay()]} {now.getDate()} {MOIS[now.getMonth()]} {now.getFullYear()}</span>
          <h2>{salut} {s.user.prenom}</h2>
          <p>Espace enseignant · classe de <strong>{classe.nom}</strong> · {rows.length || classe.effectif || 0} élèves · année {s.annee?.libelle}</p>
        </div>
      </section>
      <div className="prof-tuiles">
        {TUILES.map((x) => <Link key={x.to} to={x.to} className="card prof-tuile"><span className={`ic ${x.t}`}><x.icon size={22} /></span><div><strong>{x.l}</strong><span>{x.d}</span></div><ChevronRight size={18} className="muted" /></Link>)}
      </div>
      <div className="prof-cols">
        <div className="card">
          <div className="card-head"><h3>Aujourd'hui</h3><Link className="small" to="/emploi">Toute la semaine →</Link></div>
          <div className="card-body">
            {edt.isLoading ? <Spinner /> : !aujourdhui.length ? <p className="muted small">Pas de cours aujourd'hui.</p> : (
              <ul className="prof-jour">{aujourdhui.map((c) => <li key={c.id}><span className="h">{c.heure_debut.slice(0, 5)} – {c.heure_fin.slice(0, 5)}</span><span>{c.libelle || c.matiere}</span></li>)}</ul>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Mes élèves — {classe.nom}</h3><Link className="small" to="/eleves">Tout voir →</Link></div>
          <div className="card-body">
            {eleves.isLoading ? <Spinner /> : !rows.length ? <p className="muted small">Aucun élève inscrit.</p> : (
              <ul className="prof-eleves">{rows.map((e) => <li key={e.id}><Link to={`/eleves/${e.id}`}><span className={`avatar ${e.sexe || ""}`}>{initiales(e.prenom, e.nom)}</span><span>{e.prenom} <strong>{e.nom}</strong></span></Link></li>)}</ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
