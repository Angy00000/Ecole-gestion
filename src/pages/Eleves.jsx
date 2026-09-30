import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, UserPlus, Download, Users, ChevronLeft, ChevronRight, Utensils, ArrowDownAZ, Printer, IdCard } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { initiales, age, nombre, fcfa } from "../lib/format";
import { Select, Spinner, ErrorBox, Empty, PageHead } from "../components/ui";
import EleveForm from "./EleveForm";
import { BadgeFormule, formule, FORMULES } from "../components/TarifScolarite";

function useDebounce(v, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export default function Eleves() {
  const s = useSession();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const classe = params.get("classe") || "";
  const setClasse = (c) => { const p = Object.fromEntries(params); delete p.nouveau; if (c) p.classe = c; else delete p.classe; setParams(p, { replace: true }); };
  const [sexe, setSexe] = useState("");
  const [inscrits, setInscrits] = useState("oui");
  const [sort, setSort] = useState("nom");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(params.get("nouveau") === "1");
  const dq = useDebounce(q);
  const limit = 50;

  useEffect(() => setPage(1), [dq, classe, sexe, inscrits, sort, s.annee?.id]);
  useEffect(() => { if (params.get("nouveau") === "1") setForm(true); }, [params]);

  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const filtres = { annee_id: s.annee?.id, q: dq, classe_id: classe, sexe, inscrits, sort, page, limit };
  const list = useQuery({ queryKey: ["eleves", filtres], queryFn: () => api.get("/eleves", filtres), placeholderData: keepPreviousData });

  const exporter = async () => {
    const all = await api.get("/eleves", { ...filtres, page: 1, limit: 500 });
    const rows = [["Matricule", "Nom", "Prénom", "Sexe", "Date de naissance", "Classe", "Cantine", "Tarif", "Téléphone parent", "Frais d'inscription restants"],
      ...all.rows.map((r) => [r.matricule, r.nom, r.prenom, r.sexe, r.date_naissance || "", r.classe || "", r.cantine ? "Oui" : "Non", FORMULES[formule(r)] + (r.mensualite_speciale && !r.gratuit ? ` ${r.mensualite_speciale}` : ""), r.telephone || "", r.frais_reste ?? ""])];
    const csv = "\ufeff" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `eleves-${s.annee?.libelle}${classe ? "-" + classes.data?.find((c) => c.id == classe)?.nom : ""}.csv`;
    a.click();
  };

  const d = list.data;
  const total = classes.data?.reduce((t, c) => t + c.effectif, 0) || 0;
  const pages = d ? Math.max(1, Math.ceil(d.total / limit)) : 1;
  const Th = ({ k, children, className = "" }) => <th className={`sortable ${sort === k ? "sorted" : ""} ${className}`} onClick={() => setSort(k)}>{children}{sort === k && <ArrowDownAZ size={13} style={{ marginLeft: 4, verticalAlign: -2 }} />}</th>;

  return (
    <>
      <PageHead title="Élèves" sub={`${nombre(total)} élèves inscrits en ${s.annee?.libelle}`}>
        {classe && inscrits === "oui" && <>
          <button className="btn" onClick={() => nav(`/documents?type=liste&classe=${classe}`)}><Printer size={17} /><span className="hide-m">Liste de classe</span></button>
          <button className="btn" onClick={() => nav(`/documents?type=carte&classe=${classe}`)}><IdCard size={17} /><span className="hide-m">Cartes scolaires</span></button>
        </>}
        <button className="btn" onClick={exporter}><Download size={17} /><span className="hide-m">Exporter en Excel</span></button>
        {s.peut("eleves.ecrire") && <button className="btn primary" onClick={() => setForm(true)}><UserPlus size={17} />Inscrire un élève</button>}
      </PageHead>

      {inscrits === "oui" && (
        <div className="class-tabs" role="tablist" aria-label="Filtrer par classe">
          <button className={`class-tab ${!classe ? "on" : ""}`} onClick={() => setClasse("")}>Toutes <span className="n">{total}</span></button>
          {classes.data?.map((c) => (
            <button key={c.id} className={`class-tab ${classe == c.id ? "on" : ""}`} onClick={() => setClasse(String(c.id))}>{c.nom} <span className="n">{c.effectif}</span></button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="with-icon">
            <Search size={18} />
            <input className="input" placeholder="Nom, matricule ou téléphone d'un parent…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
          </div>
          <Select value={sexe} onChange={(e) => setSexe(e.target.value)} aria-label="Sexe">
            <option value="">Filles et garçons</option><option value="F">Filles</option><option value="M">Garçons</option>
          </Select>
          <span className="spacer" />
          <div className="seg">
            <button className={inscrits === "oui" ? "on" : ""} onClick={() => setInscrits("oui")}>Inscrits</button>
            <button className={inscrits === "non" ? "on" : ""} onClick={() => { setInscrits("non"); setClasse(""); }}>À réinscrire</button>
          </div>
        </div>

        {list.isLoading ? <Spinner /> : list.error ? <div style={{ padding: 18 }}><ErrorBox error={list.error} /></div> : !d.rows.length ? (
          <Empty icon={Users} title={dq || classe || sexe ? "Aucun élève ne correspond" : inscrits === "non" ? "Tous les élèves sont réinscrits" : "Aucun élève inscrit"}
            action={!dq && !classe && inscrits === "oui" && s.peut("eleves.ecrire") ? <button className="btn primary" onClick={() => setForm(true)}><UserPlus size={16} />Inscrire le premier élève</button> : null}>
            {dq || classe || sexe ? "Essayez une autre recherche ou retirez un filtre." : inscrits === "non" ? "Ici apparaissent les élèves des années passées qui ne sont pas encore réinscrits." : ""}
          </Empty>
        ) : (
          <div className="table-wrap" style={{ opacity: list.isFetching ? 0.65 : 1, transition: "opacity .15s" }}>
            <table className="table">
              <thead><tr>
                <Th k="nom">Élève</Th><Th k="matricule">Matricule</Th><Th k="classe">Classe</Th>
                <th className="hide-m">Âge</th><th className="hide-m">Téléphone parent</th><th className="hide-m">Cantine</th>{s.peut("finances.lire") && <th className="hide-m">Inscription</th>}<th />
              </tr></thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => nav(`/eleves/${r.id}`)}>
                    <td><div className="person">
                      <span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span>
                      <div><strong>{r.nom} {r.prenom}<BadgeFormule v={r} style={{ marginLeft: 6, height: 20 }} /></strong><span>{r.sexe === "F" ? "Fille" : r.sexe === "M" ? "Garçon" : ""}{r.type_inscription === "reinscription" ? " · réinscrit(e)" : r.type_inscription === "nouvelle" ? " · nouveau" : ""}</span></div>
                    </div></td>
                    <td className="num muted">{r.matricule}</td>
                    <td>{r.classe ? <span className={`chip ${r.cycle || ""}`}>{r.classe}</span> : <span className="muted">—</span>}</td>
                    <td className="hide-m num">{age(r.date_naissance) != null ? `${age(r.date_naissance)} ans` : <span className="muted">—</span>}</td>
                    <td className="hide-m num">{r.telephone || <span className="muted">—</span>}</td>
                    <td className="hide-m">{r.cantine ? <span className="badge coral"><Utensils size={12} />Cantine</span> : <span className="muted small">—</span>}</td>
                    {s.peut("finances.lire") && <td className="hide-m">{r.frais_reste == null ? "—" : r.frais_reste <= 0 ? <span className="badge green">Réglée</span> : <span className="badge gold">Reste {fcfa(r.frais_reste)}</span>}</td>}
                    <td className="r"><ChevronRight size={18} className="go" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {d && d.total > limit && (
          <div className="pager">
            <span>{(page - 1) * limit + 1}–{Math.min(page * limit, d.total)} sur {d.total} élèves</span>
            <span className="spacer" />
            <button className="btn sm icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Page précédente"><ChevronLeft size={16} /></button>
            <span>Page {page} / {pages}</span>
            <button className="btn sm icon" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Page suivante"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {form && <EleveForm onClose={() => { setForm(false); const p = Object.fromEntries(params); delete p.nouveau; setParams(p); }} onSaved={(id) => { setForm(false); nav(`/eleves/${id}`); }} />}
    </>
  );
}
