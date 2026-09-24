import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Users } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, moisCourt, initiales, nombre } from "../lib/format";
import { Spinner, ErrorBox, Empty } from "../components/ui";
import PageTitle from "../components/PageTitle";

const TYPES = { inscription: "Inscription", uniforme: "Uniforme", mensualite: "Mensualité", cantine: "Cantine", fournitures: "Fournitures", cours_vacances: "Cours de vacances", autre: "Autre" };

function Evolution({ data }) {
  const max = Math.max(1, ...data.map((d) => d.montant));
  const w = 100 / data.length;
  return (
    <svg className="chart" viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label="Encaissements des six derniers mois">
      {data.map((d, i) => {
        const h = (d.montant / max) * 130;
        const x = i * (600 / data.length) + 18;
        const bw = 600 / data.length - 36;
        const last = i === data.length - 1;
        return (
          <g key={d.mois}>
            <rect x={x} y={150 - h} width={bw} height={Math.max(h, 2)} rx="4" fill={last ? "var(--gold)" : "var(--teal)"} opacity={last ? 1 : 0.85} />
            <text x={x + bw / 2} y="170" textAnchor="middle">{moisCourt(d.mois)}</text>
            {d.montant > 0 && <text x={x + bw / 2} y={142 - h} textAnchor="middle" style={{ fill: "var(--ink-2)", fontWeight: 700 }}>{Math.round(d.montant / 1000)}k</text>}
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const s = useSession();
  const nav = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", s.annee?.id],
    queryFn: () => api.get("/dashboard", { annee_id: s.annee?.id }),
  });

  const hello = new Date().getHours() < 13 ? "Bonjour" : "Bon après-midi";
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const e = data.effectif;
  const f = data.finances;
  const pf = e.total ? (e.filles / e.total) * 100 : 50;

  return (
    <div className="stack">
      <PageTitle title="Tableau de bord" subtitle={`${hello} ${s.user.prenom} — année scolaire ${s.annee?.libelle}`} />

      <div className="figures">
        <div className="figure lead">
          <div className="label">Élèves inscrits</div>
          <div className="value">{nombre(e.total)}</div>
          <div className="sub">{e.filles} filles · {e.garcons} garçons · {e.cantine} à la cantine</div>
          <div className="split"><i style={{ width: `${pf}%`, background: "#f2a7c3" }} /><i style={{ width: `${100 - pf}%`, background: "#9cc4ec" }} /></div>
        </div>
        <div className="figure">
          <div className="label">Nouveaux / réinscrits</div>
          <div className="value">{e.nouveaux}<small>/ {e.reinscrits}</small></div>
          <div className="sub">sur l'année {s.annee?.libelle}</div>
        </div>
        {f ? <>
          <div className="figure">
            <div className="label">Encaissé aujourd'hui</div>
            <div className="value">{nombre(f.jour)}<small>F</small></div>
            <div className="sub">{f.nb_jour} paiement{f.nb_jour > 1 ? "s" : ""}</div>
          </div>
          <div className="figure">
            <div className="label">Encaissé ce mois</div>
            <div className="value">{nombre(f.mois)}<small>F</small></div>
            <div className="sub">Total année : {fcfa(f.annee)}</div>
          </div>
        </> : <div className="figure" style={{ gridColumn: "span 2" }}><div className="label">Classes ouvertes</div><div className="value">{data.classes.length}</div></div>}
      </div>

      <div className="cols">
        <div className="panel">
          <div className="panel-head"><h3>Effectifs par classe</h3><Link to="/classes" className="small">Gérer les classes</Link></div>
          <div className="panel-body">
            <div className="bars">
              {data.classes.map((c) => {
                const cap = c.capacite || Math.max(...data.classes.map((x) => x.effectif), 30);
                const pct = Math.min(100, (c.effectif / cap) * 100);
                return (
                  <div className="bar-row" key={c.id}>
                    <span className="name">{c.nom}</span>
                    <div className="bar-track"><div className={`bar-fill ${c.capacite && c.effectif >= c.capacite ? "full" : ""}`} style={{ width: `${pct}%` }} /></div>
                    <span className="count">{c.effectif}{c.capacite ? ` / ${c.capacite}` : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Dernières inscriptions</h3><Link to="/eleves" className="small">Tous les élèves</Link></div>
          {data.recentes.length ? (
            <ul className="list-plain">
              {data.recentes.map((r) => (
                <li key={r.id} className="click" style={{ cursor: "pointer" }} onClick={() => nav(`/eleves/${r.id}`)}>
                  <span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span>
                  <div className="grow"><strong>{r.prenom} {r.nom}</strong><span>{r.matricule} · {date(r.date_inscription)}</span></div>
                  <span className="classe-tag">{r.classe}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={Users} title="Aucune inscription" action={<Link className="btn primary" to="/eleves?nouveau=1"><UserPlus size={16} />Inscrire un élève</Link>}>
              Les inscriptions de l'année apparaîtront ici.
            </Empty>
          )}
        </div>
      </div>

      {f && (
        <div className="cols">
          <div className="panel">
            <div className="panel-head"><h3>Encaissements des six derniers mois</h3></div>
            <div className="panel-body"><Evolution data={f.evolution} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Derniers paiements</h3></div>
            {f.paiements.length ? (
              <ul className="list-plain">
                {f.paiements.map((p) => (
                  <li key={p.id}>
                    <div className="grow"><strong>{p.prenom} {p.nom}</strong><span>{TYPES[p.type]} · {p.numero} · {date(p.date_paiement)}</span></div>
                    <span className="amount">{fcfa(p.montant)}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty title="Aucun paiement">Les encaissements apparaîtront ici.</Empty>}
          </div>
        </div>
      )}
    </div>
  );
}
