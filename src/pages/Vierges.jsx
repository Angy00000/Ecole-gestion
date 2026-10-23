import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, FileText, ClipboardList, Award, ShieldCheck, IdCard, ListOrdered, Receipt, BadgeDollarSign, Pencil, Scale, BookOpenCheck, Handshake, Mail, TriangleAlert, FileCheck2, DoorOpen } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa } from "../lib/format";
import { Spinner, ErrorBox, PageHead, Modal, useToast } from "../components/ui";
import Partager from "../components/Partager";
import { EnTete } from "./Documents";
import { TEXTES } from "../lib/textesEcole";
import EditeurTexte from "../components/EditeurTexte";

// Champ à remplir à la main
const C = ({ l, w }) => <div className="v-f" style={w ? { flex: w } : undefined}><span>{l}</span><i /></div>;
const Row = ({ children }) => <div className="v-row">{children}</div>;
const Case = ({ l }) => <span className="v-case"><b />{l}</span>;
const Signatures = ({ items }) => <div className="b-sigs" style={{ marginTop: "auto", gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>{items.map((x) => <div key={x} className="b-box"><span>{x}</span></div>)}</div>;
const Fait = ({ etab }) => <p className="v-fait">Fait à {etab.ville || "Malika"}, le ……………………………………</p>;

const Lignes = ({ n = 2 }) => <>{Array.from({ length: n }, (_, i) => <Row key={i}><C l="" /></Row>)}</>;
const OuiNon = ({ l, detail }) => <Row><span className="v-q">{l}</span><Case l="Oui" /><Case l="Non" />{detail && <C l={detail} />}</Row>;

function FicheInscription({ etab, annee }) {
  return (
    <>
      <article className="doc a4 vierge">
        <EnTete etab={etab} />
        <h1 className="d-title">Fiche d'inscription</h1>
        <p className="d-num">Année scolaire {annee} · <Case l="Nouvelle inscription" /> <Case l="Réinscription" /> · Page 1/2</p>
        <div className="d-photo-row">
          <div className="d-sec"><h3>1. L'élève</h3>
            <Row><C l="Nom" /><C l="Prénom(s)" w={1.6} /></Row>
            <Row><span className="v-lab">Sexe</span><Case l="F" /><Case l="M" /><C l="Né(e) le" /><C l="à" w={1.2} /></Row>
            <Row><C l="Nationalité" /><C l="N° extrait de naissance" w={1.3} /></Row>
            <Row><C l="Adresse complète (quartier, repère)" /></Row>
            <Row><C l="Langue(s) parlée(s) à la maison" /><C l="Religion (facultatif)" w={0.8} /></Row>
          </div>
          <div className="d-photo">Photo</div>
        </div>
        <div className="d-sec"><h3>2. Scolarité</h3>
          <Row><C l="Classe demandée" /><C l="Classe de l'an passé" /><C l="Redoublant" w={0.6} /></Row>
          <Row><C l="École d'origine" w={1.6} /><C l="Ville" /></Row>
          <Row><span className="v-lab">Options</span><Case l="Cantine" /><Case l="Uniforme" /><Case l="Tenue de sport" /><Case l="Cours du soir" /><Case l="Cours de vacances" /></Row>
          <Row><span className="v-lab">Venue à l'école</span><Case l="À pied" /><Case l="Véhicule des parents" /><Case l="Transport scolaire" /><Case l="Autre" /></Row>
          <Row><C l="Frères et sœurs dans l'école (nom, classe)" /></Row>
        </div>
        <div className="d-grid2">
          <div className="d-sec"><h3>3. Père</h3><Row><C l="Prénom et nom" /></Row><Row><C l="Profession" /></Row><Row><C l="Employeur / lieu de travail" /></Row><Row><C l="Téléphone" /></Row><Row><C l="WhatsApp" /></Row><Row><C l="E-mail" /></Row><Row><span className="v-lab">En vie</span><Case l="Oui" /><Case l="Non" /></Row></div>
          <div className="d-sec"><h3>4. Mère</h3><Row><C l="Prénom et nom" /></Row><Row><C l="Profession" /></Row><Row><C l="Employeur / lieu de travail" /></Row><Row><C l="Téléphone" /></Row><Row><C l="WhatsApp" /></Row><Row><C l="E-mail" /></Row><Row><span className="v-lab">En vie</span><Case l="Oui" /><Case l="Non" /></Row></div>
        </div>
        <div className="d-sec"><h3>5. Situation familiale</h3>
          <Row><span className="v-lab">Parents</span><Case l="Mariés" /><Case l="Séparés / divorcés" /><Case l="Veuf / veuve" /><Case l="Célibataire" /></Row>
          <Row><span className="v-lab">L'enfant vit avec</span><Case l="Ses deux parents" /><Case l="Son père" /><Case l="Sa mère" /><Case l="Un tuteur" /></Row>
          <Row><C l="Tuteur : prénom et nom" w={1.5} /><C l="Lien de parenté" /><C l="Téléphone" /></Row>
          <Row><C l="Personne responsable des paiements" w={1.5} /><C l="Téléphone" /></Row>
        </div>
        <div className="d-sec"><h3>6. Personnes à prévenir en cas d'urgence (autres que les parents)</h3>
          <Row><C l="1. Prénom et nom" w={1.5} /><C l="Lien" /><C l="Téléphone" /></Row>
          <Row><C l="2. Prénom et nom" w={1.5} /><C l="Lien" /><C l="Téléphone" /></Row>
        </div>
        <div className="d-sec"><h3>7. Personnes autorisées à récupérer l'enfant</h3>
          <Row><C l="1. Prénom et nom" w={1.5} /><C l="Lien" /><C l="Téléphone" /></Row>
          <Row><C l="2. Prénom et nom" w={1.5} /><C l="Lien" /><C l="Téléphone" /></Row>
        </div>
        <p className="v-suite">Suite au verso : fiche médicale, autorisations et engagement →</p>
      </article>

      <article className="doc a4 vierge dense">
        <div className="v-head2"><strong>{etab.nom}</strong><span>Fiche d'inscription {annee} · Page 2/2 · Élève : ………………………………………… Classe : …………</span></div>
        <h1 className="d-title v-t2">Fiche médicale <small>— informations confidentielles, utilisées uniquement pour la santé et la sécurité de l'enfant</small></h1>
        <div className="d-sec"><h3>8. Santé générale</h3>
          <Row><span className="v-lab">Groupe sanguin</span>{["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Inconnu"].map((g) => <Case key={g} l={g} />)}</Row>
          <Row><C l="Poids" w={0.6} /><C l="Taille" w={0.6} /><C l="Médecin traitant" w={1.4} /><C l="Téléphone" /></Row>
          <Row><C l="Hôpital ou centre de santé préféré" w={1.6} /><C l="Assurance / IPM / mutuelle" /></Row>
        </div>
        <div className="d-sec"><h3>9. Vaccinations (joindre une copie du carnet)</h3>
          <div className="v-vacc">{["BCG", "Polio", "Pentavalent (DTC…)", "Rougeole / rubéole", "Fièvre jaune", "Méningite", "Pneumocoque", "Hépatite B", "Covid-19", "Autre : …………"].map((v) => <span key={v}><Case l={v} /><i>date : ……………</i></span>)}</div>
        </div>
        <div className="d-sec"><h3>10. Maladies et problèmes de santé</h3>
          <div className="v-mal">{["Asthme", "Drépanocytose", "Épilepsie / convulsions", "Diabète", "Maladie cardiaque", "Hypertension", "Anémie", "Paludisme fréquent", "Problème de vue (lunettes)", "Problème d'audition", "Problème de langage", "Énurésie (pipi au lit)", "Saignements de nez", "Maux de tête fréquents", "Eczéma / problème de peau", "Autre"].map((m) => <Case key={m} l={m} />)}</div>
          <Row><C l="Précisions (traitement, conduite à tenir en cas de crise)" /></Row>
        </div>
        <div className="d-sec"><h3>11. Allergies</h3>
          <OuiNon l="Allergie alimentaire" detail="Laquelle" />
          <OuiNon l="Allergie à un médicament" detail="Lequel" />
          <OuiNon l="Autre allergie (piqûre, poussière…)" detail="Laquelle" />
          <Row><C l="Réaction et conduite à tenir" /></Row>
        </div>
        <div className="d-sec"><h3>12. Traitements, handicap, besoins particuliers</h3>
          <OuiNon l="Traitement médical en cours" detail="Nom, dose, horaires" />
          <OuiNon l="Médicament à prendre à l'école" detail="Lequel (ordonnance obligatoire)" />
          <OuiNon l="Handicap ou besoin particulier" detail="Précisez" />
          <OuiNon l="Opération ou hospitalisation récente" detail="Laquelle, quand" />
          <Row><span className="v-q">Régime alimentaire</span><Case l="Normal" /><Case l="Sans porc" /><Case l="Végétarien" /><Case l="Sans sel/sucre" /><Case l="Autre" /></Row>
        </div>
        <div className="d-sec"><h3>13. Autorisations</h3>
          <Case l="J'autorise l'école à faire soigner mon enfant et, en cas d'urgence, à le faire transporter au centre de santé le plus proche, après avoir essayé de me joindre." />
          <Case l="J'autorise mon enfant à participer aux sorties et activités organisées par l'école." />
          <Case l="J'autorise l'école à utiliser des photos de mon enfant prises lors des activités (affichage, site, réseaux de l'école)." />
          <Case l="J'autorise mon enfant à rentrer seul après les cours." />
        </div>
        <div className="d-sec v-pieces"><h3>14. Pièces à fournir</h3>
          <Case l="2 extraits de naissance" /><Case l="Cette fiche remplie et signée" /><Case l="2 photos d'identité" /><Case l="Copie du carnet de vaccination" /><Case l="Certificat de scolarité et bulletin de l'école d'origine (nouveaux)" /><Case l="Certificat médical (si maladie signalée)" />
        </div>
        <p className="xs" style={{ margin: "2px 0 8px" }}>Je certifie l'exactitude des renseignements ci-dessus et je m'engage à prévenir l'école de tout changement. Je m'engage à respecter le règlement intérieur et à payer la scolarité annuelle : quelle que soit la date d'inscription, tous les mois de l'année scolaire sont à payer. <strong>Fait à {etab.ville || "Malika"}, le ……………………………</strong></p>
        <Signatures items={["Signature du parent (« lu et approuvé »)", "Le secrétariat", "La Direction"]} />
      </article>
    </>
  );
}

export const INFOS_DEFAUT = `## Inscription & mensualité
- Quelle que soit la date d'inscription, tous les mois de l'année scolaire sont à payer.
- Le parent qui inscrit son enfant s'engage à payer la scolarité annuelle.
- Le mois de juin est payé en deux tranches (janvier et février).
- La scolarité s'arrête le 10 juin, correspondant au paiement de la mensualité de mai.
- Tous les élèves sont invités à intégrer la cantine pour une meilleure surveillance aux heures de pause.
- Anglais et informatique : gratuits et obligatoires pour tous les cycles (préscolaire, élémentaire).
- Les cours de renforcement sont obligatoires et inclus dans la mensualité.
## Sport & culture
- Tournoi de foot interclasses — 8e édition.
- Prestations prévues : majorettes, danses traditionnelles, danses classiques et théâtre.
## Pièces à fournir
Les inscriptions et réinscriptions débutent le mercredi 01 juillet 2026.
- 2 extraits de naissance
- 1 fiche de renseignement à remplir et retourner à l'école
- 1 certificat de scolarité de l'école d'origine et le bulletin de notes de fin d'année (pour les nouveaux)
Bureaux ouverts du mercredi 01 juillet au samedi 08 août. Retour de l'administration le lundi 31 août 2026.
## Uniforme, tenue de sport & cours de vacances
- Le port de l'uniforme et de la tenue de sport est obligatoire. Blousons : 15 000F.
- Cours de vacances du lundi 31 août au vendredi 25 septembre 2026, de 9h à 13h — 5 000F par élève, obligatoires pour les nouveaux et du CI au CM2.
## Rentrée scolaire
- Distribution des fournitures et tenues à partir du lundi 22 septembre 2026, pour les élèves inscrits ayant payé fournitures et tenue.
- Rentrée des enseignants : lundi 05 octobre 2026 · Rentrée des élèves : mercredi 07 octobre 2026.`;

// Petit format texte : « ## Titre », « - puce », autres lignes = paragraphe.
export function TexteInfos({ texte }) {
  const blocs = []; let cur = null;
  (texte || "").split("\n").forEach((l) => {
    const t = l.trim(); if (!t) return;
    if (t.startsWith("## ")) { cur = { titre: t.slice(3), lignes: [] }; blocs.push(cur); return; }
    if (!cur) { cur = { titre: "", lignes: [] }; blocs.push(cur); }
    cur.lignes.push(t);
  });
  return (
    <div className="fr-infos">
      {blocs.map((b, i) => (
        <section key={i} className="fr-bloc">
          {b.titre && <h4>{b.titre}</h4>}
          {b.lignes.map((l, j) => l.startsWith("- ") ? <p key={j} className="fr-li">{l.slice(2)}</p> : <p key={j} className="fr-p">{l}</p>)}
        </section>
      ))}
    </div>
  );
}

function Tarifs({ etab, annee, classes }) {
  const MOIS = ["OCT", "NOV", "DÉC", "JANV", "FÉV", "MARS", "AVR", "MAI", "JUIN"];
  const jf = (i) => i === 3 || i === 4;
  // On regroupe les classes qui ont exactement les mêmes tarifs (PS/MS/GS, CI/CP…)
  const groupes = [];
  classes.forEach((c) => {
    const cle = [c.frais_inscription, c.uniforme + c.tenue_sport, c.frais_cantine, c.mensualite, c.mensualite_jan_fev, c.mensualite_cantine, c.mensualite_cantine_jan_fev].join("|");
    const g = groupes.find((x) => x.cle === cle);
    if (g) g.noms.push(c.nom); else groupes.push({ cle, noms: [c.nom], c });
  });
  const lignes = groupes.map((g) => ({ ...g.c, nom: g.noms.join("/"), us: g.c.uniforme + g.c.tenue_sport }));
  const avecCantine = lignes.filter((c) => c.mensualite_cantine > 0);
  const mois = (c, cant) => MOIS.map((_, i) => (i === 8 ? 0 : cant ? (jf(i) ? c.mensualite_cantine_jan_fev : c.mensualite_cantine) : (jf(i) ? c.mensualite_jan_fev : c.mensualite)));
  const f = (x) => (x ? fcfa(x).replace(" F", "F") : "—");
  return (
    <article className="doc a4 vierge fr">
      <header className="fr-head">
        <img src="/logo.png" alt="" />
        <div className="fr-ecole"><strong>{etab.nom}</strong><span>« {etab.slogan || "Éduquer c'est rendre libre !"} » — {etab.adresse}</span><span>Tél : {etab.telephones}</span></div>
        <div className="fr-titre"><strong>Fiche de renseignement</strong><span className="fr-annee">Année scolaire {annee.replace("-", " / ")}</span>
          <span>{etab.autorisation && `Aut. ${/^n\s*°/i.test(etab.autorisation) ? etab.autorisation : `n° ${etab.autorisation}`}`}</span><span>{[etab.ninea && `NINEA : ${etab.ninea}`, etab.bp && `BP : ${etab.bp}`].filter(Boolean).join(" • ")}</span></div>
      </header>
      <h3 className="fr-bar">Frais d'inscription</h3>
      <div className="fr-2col">
        <div><h5>Sans cantine</h5>
          <table className="fr-tab"><thead><tr><th>Classe</th><th>Droit d'inscription</th><th>Uniforme & sport</th><th>Total</th></tr></thead>
            <tbody>{lignes.map((c) => <tr key={c.nom}><td>{c.nom}</td><td>{f(c.frais_inscription)}</td><td>{f(c.us)}</td><td className="fr-tot">{f(c.frais_inscription + c.us)}</td></tr>)}</tbody></table></div>
        <div><h5>Avec cantine</h5>
          <table className="fr-tab"><thead><tr><th>Classe</th><th>Droit</th><th>Unif. & sport</th><th>Cantine</th><th>Total</th></tr></thead>
            <tbody>{lignes.map((c) => <tr key={c.nom}><td>{c.nom}</td><td>{f(c.frais_inscription)}</td><td>{f(c.us)}</td><td>{f(c.mensualite_cantine > 0 ? c.frais_cantine : 0)}</td><td className="fr-tot">{c.mensualite_cantine > 0 ? f(c.frais_inscription + c.us + c.frais_cantine) : "—"}</td></tr>)}</tbody></table></div>
      </div>
      <h3 className="fr-bar">Mensualités {annee.replace("-", " / ")}</h3>
      <h5>Sans cantine</h5>
      <table className="fr-tab"><thead><tr><th>Classe / mois</th>{MOIS.map((m) => <th key={m}>{m}</th>)}</tr></thead>
        <tbody>{lignes.map((c) => <tr key={c.nom}><td>{c.nom}</td>{mois(c, false).map((x, i) => <td key={i} className={jf(i) ? "v-jf" : ""}>{fcfa(x).replace(" F", "F")}</td>)}</tr>)}</tbody></table>
      {avecCantine.length > 0 && <><h5>Avec cantine</h5>
        <table className="fr-tab"><thead><tr><th>Classe / mois</th>{MOIS.map((m) => <th key={m}>{m}</th>)}</tr></thead>
          <tbody>{avecCantine.map((c) => <tr key={c.nom}><td>{c.nom}</td>{mois(c, true).map((x, i) => <td key={i} className={jf(i) ? "v-jf" : ""}>{fcfa(x).replace(" F", "F")}</td>)}</tr>)}</tbody></table></>}
      <h3 className="fr-bar">Informations importantes</h3>
      <TexteInfos texte={etab.fiche_infos || INFOS_DEFAUT} />
      <footer className="fr-foot"><span>La Direction</span><span>{etab.site_web || ""}</span><span>★ ★ ★</span></footer>
    </article>
  );
}

function Certificat({ etab, annee }) {
  return (
    <article className="doc a4 vierge">
      <EnTete etab={etab} />
      <h1 className="d-title">Certificat de scolarité</h1>
      <p className="d-num">N° ……………… / {annee}</p>
      <div className="d-text">
        <p>Je soussigné(e) ……………………………………………………, Directeur/Directrice de l'<strong>{etab.nom}</strong>, certifie que :</p>
        <div className="d-box v-box">
          <Row><C l="L'élève" /></Row>
          <Row><C l="Né(e) le" /><C l="à" w={1.4} /></Row>
          <Row><C l="Matricule" /></Row>
        </div>
        <p>est régulièrement inscrit(e) dans notre établissement en classe de ……………………… pour l'année scolaire <strong>{annee}</strong>.</p>
        <p>En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.</p>
      </div>
      <div className="d-sign"><Fait etab={etab} /><p className="d-sign-t">Le Directeur / La Directrice</p><div className="d-sign-box" /></div>
      <p className="b-motto">{etab.slogan}</p>
    </article>
  );
}

function Autorisation({ etab, annee }) {
  return (
    <article className="doc a4 vierge">
      <EnTete etab={etab} />
      <h1 className="d-title">Autorisation parentale</h1>
      <p className="d-num">Année scolaire {annee}</p>
      <div className="d-text">
        <Row><C l="Je soussigné(e)" /></Row>
        <Row><span className="v-lab">agissant en qualité de</span><Case l="Père" /><Case l="Mère" /><Case l="Tuteur" /><C l="Téléphone" /></Row>
        <Row><C l="de l'élève" w={2} /><C l="Classe" /></Row>
      </div>
      <div className="d-sec"><h3>1. Personnes autorisées à récupérer l'enfant à la sortie</h3>
        {[1, 2, 3].map((i) => <Row key={i}><C l={`${i}. Prénom et nom`} w={1.6} /><C l="Lien" /><C l="Téléphone" /></Row>)}
        <p className="xs muted" style={{ marginTop: 6 }}>L'enfant ne sera remis qu'aux personnes inscrites ci-dessus, sur présentation d'une pièce d'identité si nécessaire.</p>
      </div>
      <div className="d-sec"><h3>2. Sortir seul(e) après les cours</h3><Case l="J'autorise mon enfant à rentrer seul(e)" /><Case l="Je n'autorise pas" /></div>
      <div className="d-sec"><h3>3. Sorties pédagogiques et activités</h3><Case l="J'autorise mon enfant à participer aux sorties et activités organisées par l'école" /><Case l="Je n'autorise pas" /></div>
      <div className="d-sec"><h3>4. Photos et vidéos</h3><Case l="J'autorise l'école à utiliser des photos de mon enfant prises lors des activités (affichage, site, réseaux de l'école)" /><Case l="Je n'autorise pas" /></div>
      <div className="d-sec"><h3>5. Urgence médicale</h3><Case l="J'autorise l'école à prendre les mesures nécessaires en cas d'urgence, après avoir tenté de me joindre" /></div>
      <Fait etab={etab} />
      <Signatures items={["Signature du parent (précédée de « lu et approuvé »)", "La Direction"]} />
    </article>
  );
}

function Cartes({ etab, annee }) {
  return (
    <article className="doc a4 cartes">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="carte">
          <div className="c-top"><img src="/logo.png" alt="" /><div><strong>{etab.nom}</strong><span>Carte scolaire {annee}</span></div></div>
          <div className="c-body">
            <div className="c-photo v-photo">Photo</div>
            <div className="c-info v-carte"><span>Nom : ………………………………</span><span>Prénom : ……………………………</span><span>Classe : ………… Mat. : …………</span><span>Né(e) le : ………………………</span><span>Tél. parent : ……………………</span></div>
          </div>
          <div className="c-foot"><span>{etab.telephones?.split("/")[0]}</span><span>La Direction</span></div>
        </div>
      ))}
    </article>
  );
}

function ListeVierge({ etab, annee }) {
  return (
    <article className="doc a4 vierge">
      <EnTete etab={etab} />
      <h1 className="d-title" style={{ marginBottom: 6 }}>Liste de classe</h1>
      <p className="d-num">Classe : ……………………… · Année scolaire {annee} · Enseignant(e) : ………………………………</p>
      <table className="b-table d-list v-liste">
        <thead><tr><th>N°</th><th>Nom</th><th>Prénom(s)</th><th>Sexe</th><th>Né(e) le</th><th>Téléphone parent</th><th>Observations</th></tr></thead>
        <tbody>{Array.from({ length: 32 }, (_, i) => <tr key={i}><td>{i + 1}</td><td /><td /><td /><td /><td /><td /></tr>)}</tbody>
      </table>
    </article>
  );
}

function RecuVierge({ etab }) {
  return (
    <article className="ticket vierge">
      <header className="t-head">
        <img src="/logo.png" alt="" />
        <div className="t-school"><strong>{etab.nom}</strong><span>{etab.adresse}</span><span>Tél. {etab.telephones}</span></div>
      </header>
      <div className="t-title"><div><h1>Reçu de paiement</h1></div><div className="t-num"><span>N°</span><strong>…………</strong></div></div>
      <div className="v-recu">
        <Row><C l="Date" /><C l="Classe" /></Row>
        <Row><C l="Reçu de M./Mme" /></Row>
        <Row><C l="Pour l'élève" /></Row>
      </div>
      <table className="t-lines v-tl">
        <thead><tr><th>Désignation</th><th>Montant</th></tr></thead>
        <tbody>{["Droit d'inscription", "Uniforme / tenue", "Mensualité de ……………", "Mensualité de ……………", "Cantine", "Autre : ……………………"].map((x) => <tr key={x}><td>{x}</td><td /></tr>)}</tbody>
        <tfoot><tr><td>Total</td><td /></tr></tfoot>
      </table>
      <div className="v-recu">
        <Row><C l="Somme en lettres" /></Row>
        <Row><C l="" /></Row>
        <Row><span className="v-lab">Mode</span><Case l="Espèces" /><Case l="Wave" /><Case l="Orange Money" /><Case l="Chèque" /></Row>
        <Row><C l="Reste à payer" /></Row>
      </div>
      <footer className="t-foot"><div><span>Encaissé par</span><strong>…………………………</strong></div><div className="t-sign"><span>Signature et cachet</span></div></footer>
      <p className="t-motto">{etab.slogan}</p>
    </article>
  );
}

function DocTexte({ etab, annee, cle }) {
  const t = TEXTES[cle];
  const texte = etab.textes?.[cle] || t.texte;
  return (
    <article className="doc a4 vierge doc-texte etat">
      <EnTete etab={etab} />
      <h1 className="d-title" style={{ marginTop: 14 }}>{t.titre}</h1>
      <p className="d-num">Année scolaire {annee}</p>
      <div className="dt-corps"><TexteInfos texte={texte} /></div>
      {t.coupon && <div className="dt-coupon"><p className="dt-cut">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - à découper et à remettre à l'école</p><p>{t.coupon}</p></div>}
      <p className="v-fait">Fait à {etab.ville || "Malika"}, le ……………………………</p>
      <Signatures items={t.signatures} />
    </article>
  );
}
const docTexte = (cle) => (p) => <DocTexte {...p} cle={cle} />;

const DOCS = {
  fiche: { titre: "Fiche d'inscription complète", sub: "2 pages : élève, parents, situation familiale, urgences, fiche médicale (vaccins, maladies, allergies), autorisations", icon: ClipboardList, format: "A4", C: FicheInscription },
  tarifs: { titre: "Fiche de renseignement", sub: "Tarifs d'inscription et mensualités (remplis automatiquement), informations importantes, pièces à fournir, rentrée", icon: BadgeDollarSign, format: "A4", C: Tarifs },
  autorisation: { titre: "Autorisation parentale", sub: "Personnes autorisées, sorties, photos, urgence médicale", icon: ShieldCheck, format: "A4", C: Autorisation },
  certificat: { titre: "Certificat de scolarité", sub: "Modèle vierge à remplir à la main", icon: Award, format: "A4", C: Certificat },
  cartes: { titre: "Cartes scolaires", sub: "8 cartes vierges par page", icon: IdCard, format: "A4", C: Cartes },
  liste: { titre: "Liste de classe", sub: "Tableau vierge de 32 lignes", icon: ListOrdered, format: "A4", C: ListeVierge },
  recu: { titre: "Reçu de paiement", sub: "Reçu manuel A5, en cas de coupure d'internet", icon: Receipt, format: "A5", C: RecuVierge },
  reglement_eleves: { titre: "Règlement intérieur des élèves", sub: "Horaires, absences, tenue, comportement, sanctions — avec coupon d'engagement", icon: Scale, format: "A4", C: docTexte("reglement_eleves") },
  reglement_personnel: { titre: "Règlement intérieur des enseignants", sub: "Présence, préparation, notes et appel, relations, sanctions — avec engagement", icon: BookOpenCheck, format: "A4", C: docTexte("reglement_personnel") },
  charte_parents: { titre: "Charte d'engagement des parents", sub: "Engagements des parents et de l'école", icon: Handshake, format: "A4", C: docTexte("charte_parents") },
  convocation: { titre: "Convocation des parents", sub: "Date, heure et motif de l'entretien", icon: Mail, format: "A4", C: docTexte("convocation") },
  avertissement: { titre: "Avertissement disciplinaire", sub: "À signer par les parents", icon: TriangleAlert, format: "A4", C: docTexte("avertissement") },
  justificatif: { titre: "Justificatif d'absence / retard", sub: "À remplir par les parents", icon: FileCheck2, format: "A4", C: docTexte("justificatif") },
  bon_sortie: { titre: "Bon de sortie exceptionnelle", sub: "Sortie d'un élève pendant les heures de cours", icon: DoorOpen, format: "A4", C: docTexte("bon_sortie") },
};

export default function Vierges() {
  const nav = useNavigate();
  const argent = useSession().peut("finances.lire");
  return (
    <>
      <PageHead title="Imprimés vierges" sub="Fiches à imprimer et à donner aux parents, ou à envoyer par WhatsApp" />
      <div className="v-grid">
        {Object.entries(DOCS).filter(([k]) => argent || !["tarifs", "recu"].includes(k)).map(([k, d]) => { const I = d.icon; return (
          <button key={k} className="card v-card" onClick={() => nav(`/imprimes/imprimer?doc=${k}`)}>
            <span className="ic teal"><I size={22} /></span>
            <div><strong>{d.titre}</strong><span>{d.sub}</span></div>
            <span className="badge">{d.format}</span>
          </button>
        ); })}
      </div>
    </>
  );
}

export function ViergesImpression() {
  const s = useSession();
  const nav = useNavigate();
  const [p, setP] = useSearchParams();
  const doc = p.get("doc");
  const nb = Math.min(Math.max(Number(p.get("n")) || 1, 1), 30);
  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }), enabled: doc === "tarifs" });
  const etab = s.etablissement, annee = s.annee?.libelle || "";
  const d = DOCS[doc];
  const [editInfos, setEditInfos] = useState(null);
  const toast = useToast();
  if (!d) return <div style={{ padding: 32 }}><ErrorBox error={new Error("Document inconnu.")} /></div>;
  if (doc === "tarifs" && classes.isLoading) return <Spinner />;
  if (doc === "tarifs" && classes.error) return <div style={{ padding: 32 }}><ErrorBox error={classes.error} /></div>;
  const Comp = d.C;
  const copies = doc === "tarifs" ? 1 : nb;
  return (
    <div className="print-page">
      <style>{`@page { size: ${d.format} portrait; margin: 0; }`}</style>
      <div className="print-bar">
        <button className="btn" onClick={() => nav("/imprimes")}><ArrowLeft size={17} />Retour</button>
        <span className="grow"><strong>{d.titre}</strong> (vierge)</span>
        {doc !== "tarifs" && <label className="small row" style={{ gap: 6, alignItems: "center" }}>Exemplaires
          <input className="input" type="number" min={1} max={30} value={nb} onChange={(e) => setP({ doc, n: e.target.value })} style={{ width: 70, height: 38 }} /></label>}
        {(doc === "tarifs" || TEXTES[doc]) && s.peut("etablissement.ecrire") && <button className="btn" onClick={() => setEditInfos(doc === "tarifs" ? etab.fiche_infos || INFOS_DEFAUT : etab.textes?.[doc] || TEXTES[doc].texte)}><Pencil size={17} />Modifier le texte</button>}
        <Partager format={d.format} nom={`${d.titre}-vierge`} message={`${d.titre} — ${etab.nom}`} />
        <button className="btn primary" onClick={() => window.print()}><Printer size={17} />Imprimer</button>
      </div>
      {editInfos != null && (
        <Modal wide title={`Texte — ${d.titre}`} onClose={() => setEditInfos(null)} footer={<>
          <button className="btn" onClick={() => setEditInfos(doc === "tarifs" ? INFOS_DEFAUT : TEXTES[doc].texte)}>Texte par défaut</button>
          <span className="grow" />
          <button className="btn" onClick={() => setEditInfos(null)}>Annuler</button>
          <button className="btn primary" onClick={async () => { try { await api.put("/etablissement", { nom: etab.nom, ...(doc === "tarifs" ? { fiche_infos: editInfos } : { textes: { ...(etab.textes || {}), [doc]: editInfos } }) }); toast("Texte enregistré"); s.refresh(); setEditInfos(null); } catch (e) { toast(e.message, "error"); } }}>Enregistrer</button>
        </>}>
          <p className="small muted" style={{ marginBottom: 8 }}>Modifiez le texte directement, comme dans Word. {doc === "tarifs" ? "Les tarifs, eux, viennent automatiquement de « Classes et tarifs »." : "Le texte sera gardé pour les prochaines impressions."}</p>
          <EditeurTexte value={editInfos} onChange={setEditInfos} />
        </Modal>
      )}
      <div className="tickets">{Array.from({ length: copies }, (_, i) => <Comp key={i} etab={etab} annee={annee} classes={classes.data || []} />)}</div>
    </div>
  );
}
