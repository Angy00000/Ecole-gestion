import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, FileSpreadsheet, Users, Phone, Utensils, Shirt, MoonStar, Sparkles, Cake, BarChart3, BadgePercent, PackageCheck, Boxes, GraduationCap, CalendarX2, AlertTriangle, LogOut, ListOrdered, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, fcfa, nombre, moisLong } from "../lib/format";
import { Spinner, ErrorBox, PageHead, Select, useToast } from "../components/ui";
import Partager from "../components/Partager";
import { EnTete } from "./Documents";

const MOIS_N = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const age = (d) => { if (!d) return ""; const n = new Date(d), t = new Date(); let a = t.getFullYear() - n.getFullYear(); if (t < new Date(t.getFullYear(), n.getMonth(), n.getDate())) a--; return a; };
const sexe = (s) => (s === "F" ? "F" : s === "M" ? "G" : "");
const oui = (b) => (b ? "✓" : "");

// Chaque liste : ce qu'il faut charger, le droit nécessaire, et comment construire les tableaux.
const LISTES = {
  classes: { titre: "Listes de classe", sub: "Tous les élèves, classe par classe", icon: ListOrdered, src: ["eleves"],
    build: ({ eleves }) => parClasse(eleves, ["N°", "Matricule", "Nom", "Prénom(s)", "Sexe", "Né(e) le", "Âge", "Téléphone parent"],
      (r) => [r.matricule, r.nom, r.prenom, sexe(r.sexe), r.date_naissance ? date(r.date_naissance) : "", age(r.date_naissance), r.telephone || ""]) },
  annuaire: { titre: "Annuaire des parents", sub: "Père, mère, tuteur et téléphones de chaque élève", icon: Phone, src: ["eleves"],
    build: ({ eleves }) => parClasse(eleves, ["N°", "Élève", "Père", "Tél. père", "Mère", "Tél. mère", "Tuteur / tél."],
      (r) => [`${r.nom} ${r.prenom}`, r.pere || "", r.pere_telephone || "", r.mere || "", r.mere_telephone || "", [r.tuteur_nom, r.tuteur_telephone].filter(Boolean).join(" — ")]) },
  cantine: { titre: "Élèves à la cantine", sub: "Demi-pensionnaires, classe par classe", icon: Utensils, src: ["eleves"],
    build: ({ eleves }) => parClasse(eleves.filter((r) => r.cantine), ["N°", "Matricule", "Nom et prénom", "Sexe", "Téléphone parent"], (r) => [r.matricule, `${r.nom} ${r.prenom}`, sexe(r.sexe), r.telephone || ""]) },
  uniformes: { titre: "Uniformes et tenues de sport", sub: "Qui a commandé l'uniforme et/ou la tenue de sport", icon: Shirt, src: ["eleves"],
    build: ({ eleves }) => parClasse(eleves.filter((r) => r.a_uniforme || r.a_tenue), ["N°", "Nom et prénom", "Sexe", "Uniforme", "Tenue de sport", "Taille", "Remis le"],
      (r) => [`${r.nom} ${r.prenom}`, sexe(r.sexe), oui(r.a_uniforme), oui(r.a_tenue), "", ""],
      (rows) => `${rows.filter((r) => r.a_uniforme).length} uniformes · ${rows.filter((r) => r.a_tenue).length} tenues`) },
  cours_soir: { titre: "Cours du soir (renforcement)", sub: "Élèves inscrits aux cours du soir", icon: MoonStar, src: ["eleves"],
    build: ({ eleves }) => parClasse(eleves.filter((r) => r.cours_soir), ["N°", "Matricule", "Nom et prénom", "Sexe", "Téléphone parent"], (r) => [r.matricule, `${r.nom} ${r.prenom}`, sexe(r.sexe), r.telephone || ""]) },
  nouveaux: { titre: "Nouveaux élèves", sub: "Inscrits pour la première fois cette année", icon: Sparkles, src: ["eleves"],
    build: ({ eleves }) => parClasse(eleves.filter((r) => r.type_inscription === "nouvelle"), ["N°", "Matricule", "Nom et prénom", "Sexe", "Né(e) le", "Inscrit le", "Téléphone parent"],
      (r) => [r.matricule, `${r.nom} ${r.prenom}`, sexe(r.sexe), r.date_naissance ? date(r.date_naissance) : "", r.date_inscription ? date(r.date_inscription) : "", r.telephone || ""]) },
  anniversaires: { titre: "Anniversaires", sub: "Élèves nés pendant le mois choisi", icon: Cake, src: ["eleves"], mois: true,
    build: ({ eleves, mois }) => {
      const m = Number(mois || new Date().getMonth() + 1);
      const l = eleves.filter((r) => r.date_naissance && new Date(r.date_naissance).getUTCMonth() + 1 === m).sort((a, b) => new Date(a.date_naissance).getUTCDate() - new Date(b.date_naissance).getUTCDate());
      return { sousTitre: `Mois de ${MOIS_N[m - 1]}`, groupes: [{ nom: `${l.length} élève${l.length > 1 ? "s" : ""}`, cols: ["N°", "Jour", "Nom et prénom", "Classe", "Âge fêté", "Téléphone parent"],
        lignes: l.map((r, i) => [i + 1, new Date(r.date_naissance).getUTCDate(), `${r.nom} ${r.prenom}`, r.classe, age(r.date_naissance) + (new Date() < new Date(new Date().getFullYear(), m - 1, new Date(r.date_naissance).getUTCDate()) ? 1 : 0), r.telephone || ""]) }] };
    } },
  effectifs: { titre: "Effectifs par classe", sub: "Filles, garçons, cantine, nouveaux, cours du soir", icon: BarChart3, src: ["eleves", "classes"],
    build: ({ eleves, classes }) => {
      const lignes = classes.map((c) => { const r = eleves.filter((e) => e.classe_id === c.id); return [c.nom, r.length, r.filter((e) => e.sexe === "F").length, r.filter((e) => e.sexe === "M").length, r.filter((e) => e.cantine).length, r.filter((e) => e.type_inscription === "nouvelle").length, r.filter((e) => e.cours_soir).length, c.titulaire || ""]; });
      const tot = lignes.reduce((t, l) => t.map((x, i) => (i >= 1 && i <= 6 ? x + l[i] : x)), ["Total", 0, 0, 0, 0, 0, 0, ""]);
      return { groupes: [{ nom: "", cols: ["Classe", "Effectif", "Filles", "Garçons", "Cantine", "Nouveaux", "Cours du soir", "Enseignant(e)"], lignes: [...lignes, tot], total: true }] };
    } },
  formules: { titre: "Réductions et gratuités", sub: "Mensualités perso, mensualités offertes, réductions sur l'inscription", icon: BadgePercent, src: ["eleves"], droit: "finances.lire",
    build: ({ eleves }) => parClasse(eleves.filter((r) => r.gratuit || r.mensualite_speciale || r.inscription_offerte || r.reduction_inscription > 0), ["N°", "Nom et prénom", "Formule", "Mensualité perso", "Inscription"],
      (r) => [`${r.nom} ${r.prenom}`, r.gratuit && r.inscription_offerte ? "Gratuité totale" : r.gratuit ? "Mensualités offertes" : r.mensualite_speciale ? "Mensualité perso" : "Normale",
        r.mensualite_speciale ? fcfa(r.mensualite_speciale) : "", r.inscription_offerte ? "Offerte" : r.reduction_inscription > 0 ? `Réduction ${fcfa(r.reduction_inscription)}` : ""]) },
  kits: { titre: "Fournitures des élèves", sub: "Qui a payé les fournitures et qui a reçu son kit", icon: PackageCheck, src: ["kits"], droit: "finances.lire",
    build: ({ kits }) => parClasse(kits.rows.map((r) => ({ ...r, classe_id: r.classe })), ["N°", "Nom et prénom", "Payé", "Reste", "Kit remis le", "Signature"],
      (r) => [`${r.nom} ${r.prenom}`, fcfa(r.paye), r.du ? fcfa(Math.max(r.du - r.paye, 0)) : "", r.fournitures_remises ? date(r.fournitures_remises) : "", ""],
      (rows) => `${rows.filter((r) => r.paye > 0).length} ont payé · ${rows.filter((r) => r.fournitures_remises).length} kits remis`, "classe") },
  stock: { titre: "Inventaire des fournitures", sub: "Stock de chaque article, prix et valeur", icon: Boxes, src: ["articles"], droit: "finances.lire",
    build: ({ articles }) => {
      const l = articles.filter((a) => a.actif);
      return { groupes: [{ nom: `${l.length} articles`, cols: ["N°", "Article", "Catégorie", "En stock", "Prix d'achat", "Prix de vente", "Valeur du stock", "Compté (inventaire)"],
        lignes: [...l.map((a, i) => [i + 1, a.nom, a.categorie, `${a.stock} ${a.unite}`, a.prix_achat ? fcfa(a.prix_achat) : "", a.prix_vente ? fcfa(a.prix_vente) : "", fcfa(Math.max(a.stock, 0) * a.prix_achat), ""]),
          ["", "Total", "", "", "", "", fcfa(l.reduce((t, a) => t + Math.max(a.stock, 0) * a.prix_achat, 0)), ""]], total: true }] };
    } },
  enseignants: { titre: "Enseignants", sub: "Équipe pédagogique, classes et contacts", icon: GraduationCap, src: ["enseignants"], droit: "pedagogie.lire",
    build: ({ enseignants }) => ({ groupes: [{ nom: "", cols: ["N°", "Prénom et nom", "Classe", "Spécialité", "Téléphone", "Email", "Statut"],
      lignes: enseignants.map((e, i) => [i + 1, `${e.prenom} ${e.nom}`, e.classes_titulaire || "", e.specialite || "", e.telephone || "", e.email || "", e.statut === "actif" ? "En poste" : "Inactif"]) }] }) },
  absences: { titre: "Absences et retards", sub: "Récapitulatif par élève sur le mois choisi", icon: CalendarX2, src: ["absences"], droit: "pedagogie.lire", mois: true,
    build: ({ absences, mois }) => {
      const g = {};
      absences.rows.forEach((a) => { const k = a.eleve_id; (g[k] ||= { nom: `${a.nom} ${a.prenom}`, classe: a.classe, abs: 0, nj: 0, ret: 0 }); if (a.type === "retard") g[k].ret++; else { g[k].abs++; if (!a.justifiee) g[k].nj++; } });
      const l = Object.values(g).sort((a, b) => b.abs - a.abs);
      return { sousTitre: `Mois de ${MOIS_N[Number(mois || new Date().getMonth() + 1) - 1]}`, groupes: [{ nom: "", cols: ["N°", "Élève", "Classe", "Absences", "Non justifiées", "Retards"], lignes: l.map((x, i) => [i + 1, x.nom, x.classe, x.abs, x.nj, x.ret]) }] };
    } },
  sortis: { titre: "Élèves sortis", sub: "Élèves archivés (départ, abandon, transfert)", icon: LogOut, src: ["sortis"],
    build: ({ sortis }) => ({ groupes: [{ nom: "", cols: ["N°", "Matricule", "Nom et prénom", "Dernière classe", "Téléphone parent"], lignes: sortis.map((r, i) => [i + 1, r.matricule, `${r.nom} ${r.prenom}`, r.classe || "", r.telephone || ""]) }] }) },
  impayes: { titre: "Impayés par classe", sub: "Mensualités et frais en retard (état officiel)", icon: AlertTriangle, droit: "finances.lire", lien: "/documents?type=impayes" },
  services: { titre: "États de paiement", sub: "Cantine, uniformes, cotisation… payé / non payé", icon: Wallet, droit: "finances.lire", lien: "/services/cantine" },
};

function parClasse(rows, cols, ligne, resume, champ = "classe_id") {
  const g = new Map();
  rows.forEach((r) => { const k = r[champ] ?? r.classe; if (!g.has(k)) g.set(k, { nom: r.classe, ordre: r.ordre ?? 0, rows: [] }); g.get(k).rows.push(r); });
  return { groupes: [...g.values()].map((x) => ({ nom: x.nom, info: resume ? resume(x.rows) : `${x.rows.length} élève${x.rows.length > 1 ? "s" : ""} (${x.rows.filter((r) => r.sexe === "F").length} F, ${x.rows.filter((r) => r.sexe === "M").length} G)`,
    cols, lignes: x.rows.map((r, i) => [i + 1, ...ligne(r)]) })) };
}

export default function Listes() {
  const s = useSession();
  const nav = useNavigate();
  const [classe, setClasse] = useState("");
  const [mois, setMois] = useState(String(new Date().getMonth() + 1));
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const ouvrir = (k, l) => nav(l.lien || `/listes/imprimer?l=${k}${classe ? `&classe=${classe}` : ""}${l.mois ? `&mois=${mois}` : ""}`);
  return (
    <>
      <PageHead title="Listes et états" sub="Toutes les listes à imprimer, envoyer par WhatsApp ou exporter en Excel">
        <Select value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe"><option value="">Toutes les classes</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select>
        <Select value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois">{MOIS_N.map((m, i) => <option key={m} value={i + 1}>{m[0].toUpperCase() + m.slice(1)}</option>)}</Select>
      </PageHead>
      <div className="v-grid">
        {Object.entries(LISTES).filter(([, l]) => !l.droit || s.peut(l.droit)).map(([k, l]) => { const I = l.icon; return (
          <button key={k} className="card v-card" onClick={() => ouvrir(k, l)}>
            <span className="ic teal"><I size={22} /></span>
            <div><strong>{l.titre}</strong><span>{l.sub}{l.mois ? ` — ${MOIS_N[mois - 1]}` : ""}</span></div>
          </button>
        ); })}
      </div>
    </>
  );
}

export function ListeImpression() {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [p] = useSearchParams();
  const k = p.get("l"), classe = p.get("classe") || "", mois = p.get("mois") || String(new Date().getMonth() + 1);
  const L = LISTES[k];
  const src = L?.src || [];
  const annee = s.annee;
  const y = (() => { const deb = Number(String(annee?.debut || new Date().toISOString()).slice(0, 4)); return Number(mois) >= 8 ? deb : deb + 1; })();
  const mm = String(mois).padStart(2, "0");
  const fin = new Date(Date.UTC(y, Number(mois), 0)).toISOString().slice(0, 10);
  const q = {
    eleves: useQuery({ queryKey: ["liste-eleves", annee?.id, classe], queryFn: () => api.get("/eleves", { annee_id: annee?.id, classe_id: classe, limit: 500, sort: "classe" }), enabled: src.includes("eleves") }),
    sortis: useQuery({ queryKey: ["liste-sortis", annee?.id], queryFn: () => api.get("/eleves", { annee_id: annee?.id, statut: "sorti", inscrits: "tous", limit: 500, sort: "nom" }), enabled: src.includes("sortis") }),
    classes: useQuery({ queryKey: ["classes", annee?.id], queryFn: () => api.get("/classes", { annee_id: annee?.id }) }),
    kits: useQuery({ queryKey: ["liste-kits", annee?.id, classe], queryFn: () => api.get("/services/fournitures", { annee_id: annee?.id, classe_id: classe }), enabled: src.includes("kits") }),
    articles: useQuery({ queryKey: ["articles"], queryFn: () => api.get("/articles"), enabled: src.includes("articles") }),
    enseignants: useQuery({ queryKey: ["enseignants"], queryFn: () => api.get("/enseignants"), enabled: src.includes("enseignants") }),
    absences: useQuery({ queryKey: ["liste-abs", y, mm, classe], queryFn: () => api.get("/absences", { annee_id: annee?.id, du: `${y}-${mm}-01`, au: fin, classe_id: classe }), enabled: src.includes("absences") }),
  };
  if (!L || L.lien) return <div style={{ padding: 32 }}><ErrorBox error={new Error("Liste inconnue.")} /></div>;
  const actifs = src.filter((x) => x !== "classes").map((x) => q[x]).concat(q.classes);
  if (actifs.some((x) => x.isLoading)) return <Spinner />;
  const err = actifs.find((x) => x.error); if (err) return <div style={{ padding: 32 }}><ErrorBox error={err.error} /></div>;
  const ordre = Object.fromEntries((q.classes.data || []).map((c) => [c.id, c.ordre]));
  const eleves = (q.eleves.data?.rows || []).filter((r) => r.classe && r.statut_inscription !== "abandon").map((r) => ({ ...r, ordre: ordre[r.classe_id] }));
  const data = { eleves, classes: (q.classes.data || []).filter((c) => !classe || String(c.id) === classe), kits: q.kits.data, articles: q.articles.data, enseignants: q.enseignants.data,
    absences: q.absences.data, sortis: q.sortis.data?.rows || [], mois };
  const res = L.build(data);
  const nomClasse = classe ? q.classes.data?.find((c) => String(c.id) === classe)?.nom : null;
  const titre = `${L.titre}${nomClasse ? ` — ${nomClasse}` : ""}`;
  const etab = s.etablissement;
  const excel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      res.groupes.forEach((g, i) => {
        const ws = XLSX.utils.aoa_to_sheet([g.cols, ...g.lignes]);
        ws["!cols"] = g.cols.map((c, j) => ({ wch: Math.max(String(c).length, ...g.lignes.map((l) => String(l[j] ?? "").length)) + 2 }));
        XLSX.utils.book_append_sheet(wb, ws, (g.nom || L.titre).replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || `Feuille ${i + 1}`);
      });
      XLSX.writeFile(wb, `${titre.replace(/[^\w\- ]+/g, "")}.xlsx`);
    } catch (e) { toast(e.message, "error"); }
  };
  return (
    <div className="print-page">
      <style>{"@page { size: A4 portrait; margin: 0; }"}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav("/listes")}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{titre}</strong></span>
        <button className="btn" onClick={excel}><FileSpreadsheet size={17} /><span className="hide-m">Excel</span></button>
        <Partager format="A4" nom={titre} message={`${titre} — ${etab.nom}`} />
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      <div className="tickets">
        <article className="doc a4 etat">
          <EnTete etab={etab} />
          <h1 className="d-title" style={{ marginTop: 16 }}>{titre}</h1>
          <p className="d-num" style={{ marginBottom: 12 }}>Année scolaire {annee?.libelle}{res.sousTitre ? ` · ${res.sousTitre}` : ""} · édité le {date(new Date().toISOString())}</p>
          {res.groupes.length === 0 || res.groupes.every((g) => !g.lignes.length) ? <p className="muted" style={{ textAlign: "center", padding: 30 }}>Aucun élève dans cette liste.</p> : res.groupes.map((g, i) => (
            <section key={i} className="etat-classe">
              {(g.nom || g.info) && <h3>{g.nom} <span>{g.info}</span></h3>}
              <table className={`b-table d-list ${g.total ? "avec-total" : ""}`}>
                <thead><tr>{g.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{g.lignes.map((l, j) => <tr key={j}>{l.map((x, m) => <td key={m} className={String(x ?? "").length <= 16 ? "nw" : undefined}>{x}</td>)}</tr>)}</tbody>
              </table>
            </section>
          ))}
          <div className="d-sign" style={{ marginTop: 20 }}><p>Fait à {etab.ville || "Malika"}, le {date(new Date().toISOString())}</p><p className="d-sign-t">La Direction</p></div>
        </article>
      </div>
    </div>
  );
}
