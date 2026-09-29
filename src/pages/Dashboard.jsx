import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Users, Wallet, CalendarDays, ArrowUpRight, TrendingUp, Utensils, Sparkles, School, ChevronRight, Search } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, initiales, nombre, CYCLES } from "../lib/format";
import { Spinner, ErrorBox, Empty } from "../components/ui";
import { Ring, Donut, ClassBars, AreaChart } from "../components/charts";

const TYPES = { inscription: "Inscription", uniforme: "Uniforme", mensualite: "Mensualité", cantine: "Cantine", fournitures: "Fournitures", cours_vacances: "Cours de vacances", autre: "Autre" };
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function progression(annee) {
  if (!annee) return { pct: 0, label: "" };
  const now = new Date(), d = new Date(annee.debut), f = new Date(annee.fin);
  if (now < d) { const j = Math.ceil((d - now) / 864e5); return { pct: 0, big: `J-${j}`, label: "avant la rentrée" }; }
  if (now > f) return { pct: 1, big: "100 %", label: "année terminée" };
  const p = (now - d) / (f - d);
  return { pct: p, big: `${Math.round(p * 100)} %`, label: "de l'année écoulée" };
}

function Kpi({ icon: Icon, tone, label, value, unit, sub }) {
  return (
    <div className="card kpi c3">
      <div className="top"><span className="label">{label}</span><span className={`ic ${tone}`}><Icon size={21} /></span></div>
      <div className="value">{value}{unit && <small>{unit}</small>}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

export default function Dashboard() {
  const s = useSession();
  const nav = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", s.annee?.id],
    queryFn: () => api.get("/dashboard", { annee_id: s.annee?.id }),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const e = data.effectif, f = data.finances;
  const now = new Date();
  const salut = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";
  const prog = progression(s.annee);
  const capa = data.classes.reduce((t, c) => t + (c.capacite || 0), 0);

  return (
    <div className="dash" style={{ marginTop: 14 }}>
      <section className="hero lattice c12">
        <div className="grow">
          <span className="date"><CalendarDays size={15} />{JOURS[now.getDay()]} {now.getDate()} {MOIS[now.getMonth()]} {now.getFullYear()}</span>
          <h2>{salut} {s.user.prenom}</h2>
          <p>Année scolaire {s.annee?.libelle} · {nombre(e.total)} élève{e.total > 1 ? "s" : ""} inscrit{e.total > 1 ? "s" : ""} dans {data.classes.length} classes{capa ? ` pour ${capa} places` : ""}.</p>
          <div className="actions">
            {s.peut("eleves.ecrire") && <Link className="btn gold" to="/eleves?nouveau=1"><UserPlus size={18} />Inscrire un élève</Link>}
            <Link className="btn glass" to="/eleves"><Users size={18} />Voir les élèves</Link>
            <Link className="btn glass" to="/classes"><School size={18} />Classes et tarifs</Link>
          </div>
        </div>
        <div className="hero-ring">
          <Ring value={prog.pct} />
          <div className="in"><strong>{prog.big}</strong><span>{prog.label}</span></div>
        </div>
      </section>

      <Kpi icon={Users} tone="teal" label="Élèves inscrits" value={nombre(e.total)} sub={<><Sparkles size={14} />{e.nouveaux} nouveaux · {e.reinscrits} réinscrits</>} />
      <Kpi icon={Utensils} tone="coral" label="Demi-pensionnaires" value={nombre(e.cantine)} sub={`${e.total ? Math.round((e.cantine / e.total) * 100) : 0} % des élèves mangent à la cantine`} />
      {f ? <>
        <Kpi icon={Wallet} tone="green" label="Encaissé aujourd'hui" value={nombre(f.jour)} unit="F" sub={`${f.nb_jour} paiement${f.nb_jour > 1 ? "s" : ""} enregistré${f.nb_jour > 1 ? "s" : ""}`} />
        <Kpi icon={TrendingUp} tone="gold" label="Encaissé ce mois" value={nombre(f.mois)} unit="F" sub={`${fcfa(f.annee)} depuis le début de l'année`} />
      </> : <>
        <Kpi icon={School} tone="gold" label="Classes ouvertes" value={data.classes.length} sub="pour l'année en cours" />
        <Kpi icon={Users} tone="rose" label="Filles" value={e.filles} sub={`et ${e.garcons} garçons`} />
      </>}

      <div className="card c8">
        <div className="card-head"><h3>Effectifs par classe</h3>
          <div className="legend">{Object.entries(CYCLES).map(([k, l]) => <span key={k}><i className="dot" style={{ background: `var(--${k === "garderie" ? "gold" : k === "prescolaire" ? "coral" : "teal"})` }} />{l}</span>)}</div>
        </div>
        <div className="card-body"><ClassBars data={data.classes} /></div>
      </div>

      <div className="card c4">
        <div className="card-head"><h3>Répartition</h3></div>
        <div className="card-body donut-wrap" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <Donut parts={[{ label: "Filles", value: e.filles, color: "var(--rose)" }, { label: "Garçons", value: e.garcons, color: "var(--azure)" }]}
            center={<div className="donut-center"><strong style={{ fontSize: 30, display: "block", lineHeight: 1 }}>{e.total}</strong><span className="xs muted">élèves</span></div>} />
          <div className="stat-rows" style={{ marginTop: 18 }}>
            <div className="stat-row"><i className="dot" style={{ background: "var(--rose)" }} /><span className="l">Filles</span><span className="v">{e.filles}</span><span className="p">{e.total ? Math.round((e.filles / e.total) * 100) : 0} %</span></div>
            <div className="stat-row"><i className="dot" style={{ background: "var(--azure)" }} /><span className="l">Garçons</span><span className="v">{e.garcons}</span><span className="p">{e.total ? Math.round((e.garcons / e.total) * 100) : 0} %</span></div>
          </div>
        </div>
      </div>

      {f && (
        <div className="card c7">
          <div className="card-head"><h3>Encaissements</h3><span className="badge teal">6 derniers mois</span></div>
          <div className="card-body"><AreaChart data={f.evolution} /></div>
        </div>
      )}

      {f && (
        <div className="card c5">
          <div className="card-head"><h3>Derniers paiements</h3></div>
          {f.paiements.length ? (
            <ul className="feed">
              {f.paiements.map((p) => (
                <li key={p.id} onClick={() => nav(`/eleves/${p.eleve_id}`)}>
                  <span className="ic green" style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center" }}><ArrowUpRight size={18} /></span>
                  <div className="grow"><strong>{p.prenom} {p.nom}</strong><span>{TYPES[p.type]} · {date(p.date_paiement)}</span></div>
                  <span className="amount plus">+{fcfa(p.montant)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty icon={Wallet} title="Aucun paiement">Les encaissements s'afficheront ici.</Empty>}
        </div>
      )}

      <div className="card c12">
        <div className="card-head"><h3>Dernières inscriptions</h3><Link className="link" to="/eleves">Tous les élèves <ChevronRight size={15} /></Link></div>
        {data.recentes.length ? (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table">
              <thead><tr><th>Élève</th><th>Matricule</th><th>Classe</th><th className="hide-m">Type</th><th className="hide-m">Date</th><th /></tr></thead>
              <tbody>
                {data.recentes.map((r) => (
                  <tr key={r.id} className="click" onClick={() => nav(`/eleves/${r.id}`)}>
                    <td><div className="person"><span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span><div><strong>{r.nom} {r.prenom}</strong><span>{r.sexe === "F" ? "Fille" : "Garçon"}</span></div></div></td>
                    <td className="num">{r.matricule}</td>
                    <td><span className={`chip ${r.cycle || ""}`}>{r.classe}</span></td>
                    <td className="hide-m">{r.type === "nouvelle" ? <span className="badge gold">Nouvelle</span> : <span className="badge teal">Réinscription</span>}</td>
                    <td className="hide-m num">{date(r.date_inscription)}</td>
                    <td className="r"><ChevronRight size={18} className="go" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Users} title="Aucune inscription pour l'instant" action={s.peut("eleves.ecrire") && <Link className="btn primary" to="/eleves?nouveau=1"><UserPlus size={16} />Inscrire le premier élève</Link>}>
            Les inscriptions de l'année {s.annee?.libelle} apparaîtront ici.
          </Empty>
        )}
      </div>
    </div>
  );
}
