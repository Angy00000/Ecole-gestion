import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, UserPlus, Download, Users, ChevronLeft, ChevronRight, Utensils } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { initiales, age, nombre } from "../lib/format";
import { Select, Spinner, ErrorBox, Empty } from "../components/ui";
import PageTitle from "../components/PageTitle";
import EleveForm from "./EleveForm";

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
  const [classe, setClasse] = useState("");
  const [sexe, setSexe] = useState("");
  const [inscrits, setInscrits] = useState("oui");
  const [sort, setSort] = useState("nom");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(params.get("nouveau") === "1");
  const dq = useDebounce(q);
  const limit = 50;

  useEffect(() => setPage(1), [dq, classe, sexe, inscrits, sort, s.annee?.id]);

  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const filtres = { annee_id: s.annee?.id, q: dq, classe_id: classe, sexe, inscrits, sort, page, limit };
  const list = useQuery({ queryKey: ["eleves", filtres], queryFn: () => api.get("/eleves", filtres), placeholderData: keepPreviousData });

  const exporter = async () => {
    const all = await api.get("/eleves", { ...filtres, page: 1, limit: 500 });
    const rows = [["Matricule", "Nom", "Prénom", "Sexe", "Date de naissance", "Classe", "Cantine", "Téléphone parent"],
      ...all.rows.map((r) => [r.matricule, r.nom, r.prenom, r.sexe, r.date_naissance || "", r.classe || "", r.cantine ? "Oui" : "Non", r.telephone || ""])];
    const csv = "\ufeff" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `eleves-${s.annee?.libelle}${classe ? "-" + classes.data?.find((c) => c.id == classe)?.nom : ""}.csv`;
    a.click();
  };

  const d = list.data;
  const pages = d ? Math.max(1, Math.ceil(d.total / limit)) : 1;
  const trier = (k) => setSort(k);

  return (
    <>
      <PageTitle title="Élèves" subtitle={d ? `${nombre(d.total)} élève${d.total > 1 ? "s" : ""} ${inscrits === "non" ? "non réinscrits" : "inscrits"} en ${s.annee?.libelle}` : ""} />
      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Nom, matricule ou téléphone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un élève" />
          </div>
          <Select value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe">
            <option value="">Toutes les classes</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Select>
          <Select value={sexe} onChange={(e) => setSexe(e.target.value)} aria-label="Sexe">
            <option value="">Filles et garçons</option><option value="F">Filles</option><option value="M">Garçons</option>
          </Select>
          <div className="seg">
            <button className={inscrits === "oui" ? "on" : ""} onClick={() => setInscrits("oui")}>Inscrits</button>
            <button className={inscrits === "non" ? "on" : ""} onClick={() => setInscrits("non")} title="Élèves des années précédentes pas encore réinscrits">À réinscrire</button>
          </div>
          <span className="spacer" />
          <button className="btn" onClick={exporter} title="Exporter la liste (Excel)"><Download size={16} /><span className="hide-m">Exporter</span></button>
          {s.peut("eleves.ecrire") && <button className="btn primary" onClick={() => setForm(true)}><UserPlus size={16} />Inscrire un élève</button>}
        </div>

        {list.isLoading ? <Spinner /> : list.error ? <div className="panel-body"><ErrorBox error={list.error} /></div> : !d.rows.length ? (
          <Empty icon={Users} title={dq || classe || sexe ? "Aucun élève ne correspond" : inscrits === "non" ? "Tout le monde est réinscrit" : "Aucun élève inscrit"}
            action={!dq && inscrits === "oui" && s.peut("eleves.ecrire") ? <button className="btn primary" onClick={() => setForm(true)}><UserPlus size={16} />Inscrire le premier élève</button> : null}>
            {dq || classe || sexe ? "Modifiez la recherche ou les filtres." : ""}
          </Empty>
        ) : (
          <div className="table-wrap" style={{ opacity: list.isFetching ? 0.6 : 1 }}>
            <table className="table">
              <thead><tr>
                <th className="sortable" onClick={() => trier("nom")}>Élève {sort === "nom" && "↓"}</th>
                <th className="sortable" onClick={() => trier("matricule")}>Matricule {sort === "matricule" && "↓"}</th>
                <th className="sortable" onClick={() => trier("classe")}>Classe {sort === "classe" && "↓"}</th>
                <th className="hide-m">Âge</th>
                <th className="hide-m">Téléphone parent</th>
                <th className="hide-m">Cantine</th>
              </tr></thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => nav(`/eleves/${r.id}`)}>
                    <td><div className="cell-person">
                      <span className={`avatar ${r.sexe || ""}`}>{initiales(r.prenom, r.nom)}</span>
                      <div><strong>{r.nom} {r.prenom}</strong><span>{r.sexe === "F" ? "Fille" : r.sexe === "M" ? "Garçon" : ""}{r.type_inscription === "reinscription" ? " · réinscrit(e)" : ""}</span></div>
                    </div></td>
                    <td className="num">{r.matricule}</td>
                    <td>{r.classe ? <span className="classe-tag">{r.classe}</span> : <span className="muted">—</span>}</td>
                    <td className="hide-m num">{age(r.date_naissance) != null ? `${age(r.date_naissance)} ans` : "—"}</td>
                    <td className="hide-m num">{r.telephone || <span className="muted">—</span>}</td>
                    <td className="hide-m">{r.cantine ? <span className="badge teal"><Utensils size={12} />Oui</span> : <span className="muted small">Non</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {d && d.total > limit && (
          <div className="pager">
            <span>{(page - 1) * limit + 1}–{Math.min(page * limit, d.total)} sur {d.total}</span>
            <span className="spacer" />
            <button className="btn sm icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Page précédente"><ChevronLeft size={16} /></button>
            <span>Page {page} / {pages}</span>
            <button className="btn sm icon" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Page suivante"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {form && <EleveForm onClose={() => { setForm(false); setParams({}); }} onSaved={(id) => { setForm(false); nav(`/eleves/${id}`); }} />}
    </>
  );
}
