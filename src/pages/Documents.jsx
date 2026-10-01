import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { date, dateLongue, initiales, fcfa, moisLong, moisAbr } from "../lib/format";
import { Spinner, ErrorBox } from "../components/ui";

const TITRES = { certificat: "Certificat de scolarité", fiche: "Fiche d'inscription", carte: "Cartes scolaires", liste: "Liste de classe", listes: "Listes de toutes les classes", impayes: "État des impayés par classe", service: "État par classe" };
const SERVICES = { cantine: "Cantine", uniforme: "Uniformes et tenues de sport", fournitures: "Fournitures", cours_soir: "Cours du soir", cotisation: "Cotisation des fêtes" };
const parClasse = (rows, classes) => {
  const ordre = Object.fromEntries((classes || []).map((c) => [c.nom, c.ordre]));
  const g = {};
  rows.forEach((r) => { (g[r.classe] ||= []).push(r); });
  return Object.entries(g).sort((a, b) => (ordre[a[0]] ?? 99) - (ordre[b[0]] ?? 99));
};

function EtatImpayes({ data, classes, etab, annee, mois }) {
  const groupes = parClasse(data.rows, classes);
  return (
    <article className="doc a4 etat">
      <EnTete etab={etab} />
      <h1 className="d-title" style={{ marginTop: 18 }}>État des impayés</h1>
      <p className="d-num" style={{ marginBottom: 14 }}>Mensualités et frais échus jusqu'à {moisLong(mois)} inclus · Année {annee} · {data.rows.length} élèves · Total {fcfa(data.total)}</p>
      {groupes.map(([cl, rows]) => (
        <section key={cl} className="etat-classe">
          <h3>{cl} <span>{rows.length} élève{rows.length > 1 ? "s" : ""} · {fcfa(rows.reduce((t, r) => t + r.reste, 0))}</span></h3>
          <table className="b-table d-list">
            <thead><tr><th>N°</th><th>Matricule</th><th>Nom et prénom</th><th>Parent</th><th>Téléphone</th><th>Retards</th><th>Reste</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.inscription_id}><td>{i + 1}</td><td>{r.matricule}</td><td><strong>{r.nom}</strong> {r.prenom}</td><td>{r.parent || ""}</td><td>{r.telephone || ""}</td>
                <td>{[r.frais > r.frais_payes ? "Inscr." : null, ...(r.liste_mois || "").split(",").filter(Boolean).map(moisAbr)].filter(Boolean).join(", ")}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{fcfa(r.reste)}</td></tr>))}</tbody>
          </table>
        </section>
      ))}
      <div className="etat-total"><span>Total général des impayés</span><strong>{fcfa(data.total)}</strong></div>
      <div className="d-sign" style={{ marginTop: 24 }}><p>Fait à {etab.ville || "Malika"}, le {aujourdhui()}</p><p className="d-sign-t">La Direction</p></div>
    </article>
  );
}

function EtatService({ data, classes, etab, annee, svc, filtre }) {
  const statut = (r) => r.du == null ? (r.paye > 0 ? "Payé" : "—") : r.du === 0 ? (r.paye > 0 ? "Payé" : "—") : r.paye >= r.du ? "Payé" : r.paye > 0 ? "Partiel" : "Non payé";
  let rows = data.rows;
  if (filtre === "non_payes") rows = rows.filter((r) => ["Non payé", "Partiel"].includes(statut(r)));
  if (filtre === "payes") rows = rows.filter((r) => statut(r) === "Payé");
  if (filtre === "payeurs") rows = rows.filter((r) => r.paye > 0);
  if (filtre === "cantine") rows = rows.filter((r) => r.cantine || r.paye > 0);
  const groupes = parClasse(rows, classes);
  const reste = (r) => (r.du ? Math.max(r.du - r.paye, 0) : 0);
  return (
    <article className="doc a4 etat">
      <EnTete etab={etab} />
      <h1 className="d-title" style={{ marginTop: 18 }}>{SERVICES[svc]}</h1>
      <p className="d-num" style={{ marginBottom: 14 }}>{filtre === "non_payes" ? "Élèves qui n'ont pas payé" : filtre === "payes" ? "Élèves qui ont payé" : "Tous les élèves"} · Année {annee} · {rows.length} élèves</p>
      {groupes.map(([cl, rs]) => (
        <section key={cl} className="etat-classe">
          <h3>{cl} <span>{rs.length} élève{rs.length > 1 ? "s" : ""}{rs.some((r) => r.du) ? ` · reste ${fcfa(rs.reduce((t, r) => t + reste(r), 0))}` : ""}</span></h3>
          <table className="b-table d-list">
            <thead><tr><th>N°</th><th>Matricule</th><th>Nom et prénom</th><th>Téléphone</th><th>Attendu</th><th>Payé</th><th>Reste</th><th>État</th></tr></thead>
            <tbody>{rs.map((r, i) => (
              <tr key={r.inscription_id}><td>{i + 1}</td><td>{r.matricule}</td><td><strong>{r.nom}</strong> {r.prenom}</td><td>{r.telephone || ""}</td>
                <td>{r.du ? fcfa(r.du) : "—"}</td><td>{fcfa(r.paye)}</td><td style={{ fontWeight: 700 }}>{r.du ? fcfa(reste(r)) : "—"}</td><td>{statut(r)}</td></tr>))}</tbody>
          </table>
        </section>
      ))}
      <div className="etat-total"><span>Total encaissé{rows.some((r) => r.du) ? " / reste à encaisser" : ""}</span><strong>{fcfa(rows.reduce((t, r) => t + r.paye, 0))}{rows.some((r) => r.du) ? ` / ${fcfa(rows.reduce((t, r) => t + reste(r), 0))}` : ""}</strong></div>
      <div className="d-sign" style={{ marginTop: 24 }}><p>Fait à {etab.ville || "Malika"}, le {aujourdhui()}</p><p className="d-sign-t">La Direction</p></div>
    </article>
  );
}
const ne = (e) => (e.sexe === "F" ? "née" : "né");
const aujourdhui = () => dateLongue(new Date().toISOString().slice(0, 10));

function EnTete({ etab }) {
  return (
    <header className="d-head">
      <div className="b-rep"><strong>République du Sénégal</strong><span>Un Peuple – Un But – Une Foi</span><span>Ministère de l'Éducation nationale</span></div>
      <div className="b-school"><img src="/logo.png" alt="" /><div><strong>{etab.nom}</strong><span>{etab.adresse} · Tél. {etab.telephones}</span><span>Autorisation {etab.autorisation}{etab.ninea ? ` · NINEA ${etab.ninea}` : ""}</span></div></div>
    </header>
  );
}

function Certificat({ e, ins, etab }) {
  return (
    <article className="doc a4">
      <EnTete etab={etab} />
      <h1 className="d-title">Certificat de scolarité</h1>
      <p className="d-num">N° {e.matricule}/{ins.annee}</p>
      <div className="d-text">
        <p>Je soussigné{etab.directeur ? `(e) ${etab.directeur},` : "(e),"} Directeur/Directrice de l'<strong>{etab.nom}</strong>, certifie que :</p>
        <div className="d-box">
          <p>L'élève <strong>{e.prenom} {e.nom}</strong></p>
          <p>{ne(e) === "née" ? "Née" : "Né"} le <strong>{e.date_naissance ? dateLongue(e.date_naissance) : "……………………"}</strong> à <strong>{e.lieu_naissance || "……………………"}</strong></p>
          <p>Matricule <strong>{e.matricule}</strong></p>
        </div>
        <p>est régulièrement inscrit{e.sexe === "F" ? "e" : ""} dans notre établissement en classe de <strong>{ins.classe}</strong> pour l'année scolaire <strong>{ins.annee}</strong>.</p>
        <p>En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.</p>
      </div>
      <div className="d-sign"><p>Fait à {etab.ville || "Malika"}, le {aujourdhui()}</p><p className="d-sign-t">Le Directeur / La Directrice</p><div className="d-sign-box">{etab.directeur}</div></div>
      <p className="b-motto">{etab.slogan}</p>
    </article>
  );
}

function Fiche({ e, ins, etab }) {
  const L = ({ l, v }) => <div className="d-row"><span>{l}</span><strong>{v || "—"}</strong></div>;
  const tarif = ins ? (ins.gratuit ? "Mensualités offertes" : fcfa(ins.mensualite_speciale ?? (ins.cantine ? ins.mensualite_cantine : ins.mensualite)) + " par mois") : "—";
  return (
    <article className="doc a4">
      <EnTete etab={etab} />
      <h1 className="d-title">Fiche d'inscription</h1>
      <p className="d-num">Année scolaire {ins?.annee} · Matricule {e.matricule}</p>
      <div className="d-photo-row">
        <div className="d-sec"><h3>Élève</h3>
          <L l="Nom" v={e.nom} /><L l="Prénom(s)" v={e.prenom} /><L l="Sexe" v={e.sexe === "F" ? "Féminin" : "Masculin"} />
          <L l="Date et lieu de naissance" v={`${e.date_naissance ? date(e.date_naissance) : "—"}${e.lieu_naissance ? ` à ${e.lieu_naissance}` : ""}`} /><L l="Adresse" v={e.adresse} />
        </div>
        <div className="d-photo">Photo</div>
      </div>
      <div className="d-sec"><h3>Scolarité</h3>
        <L l="Classe" v={ins?.classe} /><L l="Type" v={ins?.type === "reinscription" ? "Réinscription" : "Nouvelle inscription"} /><L l="Date d'inscription" v={ins && date(ins.date_inscription)} />
        <L l="Cantine" v={ins?.cantine ? "Oui" : "Non"} /><L l="Mensualité" v={tarif} />
      </div>
      <div className="d-grid2">
        <div className="d-sec"><h3>Père</h3><L l="Nom" v={[e.pere_prenom, e.pere_nom].filter(Boolean).join(" ")} /><L l="Profession" v={e.pere_profession} /><L l="Téléphone" v={e.pere_telephone} /></div>
        <div className="d-sec"><h3>Mère</h3><L l="Nom" v={[e.mere_prenom, e.mere_nom].filter(Boolean).join(" ")} /><L l="Profession" v={e.mere_profession} /><L l="Téléphone" v={e.mere_telephone} /></div>
      </div>
      {(e.tuteur_nom || e.tuteur_telephone) && <div className="d-sec"><h3>Tuteur</h3><L l="Nom" v={e.tuteur_nom} /><L l="Téléphone" v={e.tuteur_telephone} /></div>}
      <div className="d-sec"><h3>Observations</h3><p style={{ minHeight: 40 }}>{e.observations}</p></div>
      <p className="xs" style={{ marginTop: 8 }}>Le parent qui inscrit son enfant s'engage à payer la scolarité annuelle. Quelle que soit la date d'inscription, tous les mois de l'année scolaire sont à payer.</p>
      <div className="b-sigs" style={{ marginTop: "auto" }}><div className="b-box"><span>Signature du parent</span></div><div className="b-box"><span>Le secrétariat</span></div><div className="b-box"><span>La Direction</span></div></div>
    </article>
  );
}

function Carte({ e, classe, annee, etab }) {
  return (
    <div className="carte">
      <div className="c-top"><img src="/logo.png" alt="" /><div><strong>{etab.nom}</strong><span>Carte scolaire {annee}</span></div></div>
      <div className="c-body">
        <div className={`c-photo ${e.sexe || ""}`}>{initiales(e.prenom, e.nom)}</div>
        <div className="c-info">
          <strong>{e.prenom} {e.nom}</strong>
          <span>Classe : <b>{classe}</b></span>
          <span>Matricule : <b>{e.matricule}</b></span>
          {e.date_naissance && <span>{ne(e) === "née" ? "Née" : "Né"} le {date(e.date_naissance)}</span>}
          {e.telephone && <span>Tél. parent : {e.telephone}</span>}
        </div>
      </div>
      <div className="c-foot"><span>{etab.telephones?.split("/")[0]}</span><span>La Direction</span></div>
    </div>
  );
}

function Liste({ rows, classe, annee, etab }) {
  const f = rows.filter((r) => r.sexe === "F").length;
  return (
    <article className="doc a4">
      <EnTete etab={etab} />
      <h1 className="d-title">Liste de la classe de {classe?.nom}</h1>
      <p className="d-num">Année scolaire {annee} · {rows.length} élèves ({f} filles, {rows.length - f} garçons){classe?.titulaire ? ` · Titulaire : ${classe.titulaire}` : ""}</p>
      <table className="b-table d-list">
        <thead><tr><th>N°</th><th>Matricule</th><th>Nom</th><th>Prénom(s)</th><th>Sexe</th><th>Né(e) le</th><th>Téléphone parent</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id}><td>{i + 1}</td><td>{r.matricule}</td><td>{r.nom}</td><td>{r.prenom}</td><td>{r.sexe}</td><td>{r.date_naissance ? date(r.date_naissance) : ""}</td><td>{r.telephone || ""}</td></tr>)}</tbody>
      </table>
      <div className="d-sign"><p>Fait à {etab.ville || "Malika"}, le {aujourdhui()}</p><p className="d-sign-t">La Direction</p></div>
    </article>
  );
}

export default function Documents() {
  const s = useSession();
  const nav = useNavigate();
  const [p] = useSearchParams();
  const type = p.get("type"), eleveId = p.get("eleve"), classeId = p.get("classe");
  const el = useQuery({ queryKey: ["eleve", eleveId], queryFn: () => api.get(`/eleves/${eleveId}`), enabled: !!eleveId });
  const groupe = ["listes", "impayes", "service"].includes(type);
  const cl = useQuery({ queryKey: ["eleves", "doc", classeId, s.annee?.id, type], queryFn: () => api.get("/eleves", { classe_id: classeId, annee_id: s.annee?.id, limit: 500, sort: "classe" }), enabled: !eleveId && (type === "listes" || (!!classeId && !groupe)) });
  const imp = useQuery({ queryKey: ["impayes", "doc", p.get("mois"), classeId, s.annee?.id], queryFn: () => api.get("/impayes", { mois: p.get("mois"), classe_id: classeId, annee_id: s.annee?.id }), enabled: type === "impayes" });
  const svc = useQuery({ queryKey: ["service", "doc", p.get("svc"), classeId, s.annee?.id], queryFn: () => api.get(`/services/${p.get("svc")}`, { classe_id: classeId, annee_id: s.annee?.id }), enabled: type === "service" });
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }) });
  const data = eleveId ? el : type === "impayes" ? imp : type === "service" ? svc : cl;
  if (data.isLoading) return <Spinner />;
  if (data.error) return <div style={{ padding: 32 }}><ErrorBox error={data.error} /></div>;
  const etab = s.etablissement;
  let contenu, format = "A4";
  if (eleveId) {
    const e = data.data.eleve;
    const ins = data.data.inscriptions.find((i) => i.annee_id === s.annee?.id) || data.data.inscriptions[0];
    if (!ins && type !== "fiche") return <div style={{ padding: 32 }}><ErrorBox error={new Error("Cet élève n'a aucune inscription.")} /></div>;
    const tel = e.mere_telephone || e.pere_telephone || e.tuteur_telephone;
    if (type === "certificat") contenu = <Certificat e={e} ins={ins} etab={etab} />;
    else if (type === "fiche") contenu = <Fiche e={e} ins={ins} etab={etab} />;
    else contenu = <article className="doc a4 cartes"><Carte e={{ ...e, telephone: tel }} classe={ins.classe} annee={ins.annee} etab={etab} /></article>;
  } else if (type === "impayes") {
    contenu = <EtatImpayes data={data.data} classes={classes.data} etab={etab} annee={s.annee?.libelle} mois={p.get("mois")} />;
  } else if (type === "service") {
    contenu = <EtatService data={data.data} classes={classes.data} etab={etab} annee={s.annee?.libelle} svc={p.get("svc")} filtre={p.get("filtre")} />;
  } else if (type === "listes") {
    contenu = parClasse(data.data.rows.filter((r) => r.classe), classes.data).map(([nom, rows]) => <Liste key={nom} rows={rows} classe={classes.data?.find((c) => c.nom === nom) || { nom }} annee={s.annee?.libelle} etab={etab} />);
  } else {
    const rows = data.data.rows;
    const classe = classes.data?.find((c) => String(c.id) === classeId);
    if (type === "liste") contenu = <Liste rows={rows} classe={classe} annee={s.annee?.libelle} etab={etab} />;
    else {
      const pages = []; for (let i = 0; i < rows.length; i += 8) pages.push(rows.slice(i, i + 8));
      contenu = pages.map((pg, k) => <article key={k} className="doc a4 cartes">{pg.map((r) => <Carte key={r.id} e={r} classe={r.classe} annee={s.annee?.libelle} etab={etab} />)}</article>);
    }
  }
  return (
    <div className="print-page">
      <style>{`@page { size: ${format} portrait; margin: 0; }`}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav(-1)}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{type === "service" ? `${SERVICES[p.get("svc")]} — état par classe` : TITRES[type]}</strong></span>
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      <div className="tickets">{contenu}</div>
    </div>
  );
}
