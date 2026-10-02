import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, today, moisLong, MODES } from "../lib/format";
import { Modal, Field, Input, Select, Textarea, Money, ErrorBox, useToast } from "../components/ui";
import { User, Users, GraduationCap, NotebookPen, UserPlus, Pencil, Wallet } from "lucide-react";
import TarifScolarite, { ReductionInscription } from "../components/TarifScolarite";
const Sec = ({ icon: I, tone, title, sub, children }) => (
  <section className="form-section">
    <div className="head"><span className={`ic ${tone}`}><I size={18} /></span><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div></div>
    {children}
  </section>
);

const VIDE = {
  nom: "", prenom: "", sexe: "", date_naissance: "", lieu_naissance: "", adresse: "",
  pere_prenom: "", pere_nom: "", pere_profession: "", pere_telephone: "",
  mere_prenom: "", mere_nom: "", mere_profession: "", mere_telephone: "",
  tuteur_nom: "", tuteur_telephone: "", observations: "",
};

// Création (avec inscription) ou modification d'un élève.
export default function EleveForm({ eleve, onClose, onSaved }) {
  const s = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const edition = !!eleve;
  const [v, setV] = useState(() => ({ ...VIDE, ...(eleve || {}), date_naissance: eleve?.date_naissance?.slice(0, 10) || "" }));
  const [ins, setIns] = useState({ classe_id: "", cantine: false, date_inscription: today(), type: "nouvelle", gratuit: false, inscription_offerte: false, mensualite_speciale: null, uniforme: false, tenue_sport: false, cours_soir: true, reduction_inscription: 0 });
  const [error, setError] = useState(null);
  const [payer, setPayer] = useState(true);
  const [paye, setPaye] = useState({});
  const [modePay, setModePay] = useState("especes");
  const [refPay, setRefPay] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const classes = useQuery({ queryKey: ["classes", s.annee?.id], queryFn: () => api.get("/classes", { annee_id: s.annee?.id }), enabled: !edition });
  const mat = useQuery({ queryKey: ["matricule", s.annee?.id], queryFn: () => api.get("/eleves-matricule", { annee_id: s.annee?.id }), enabled: !edition });
  const classe = useMemo(() => classes.data?.find((c) => c.id === Number(ins.classe_id)), [classes.data, ins.classe_id]);

  useEffect(() => { if (mat.data && !v.matricule) setV((x) => ({ ...x, matricule: mat.data.matricule })); }, [mat.data]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (edition) {
        const { id, matricule, created_at, updated_at, statut, ...data } = v;
        await api.put(`/eleves/${eleve.id}`, data);
        toast("Fiche de l'élève mise à jour");
        onSaved?.(eleve.id);
      } else {
        const r = await api.post("/eleves", { eleve: v, inscription: { ...ins, annee_id: s.annee?.id } });
        let recuId = null;
        const lignesPay = articles.map((a) => ({ type: a.type, mois: a.mois, montant: montantPaye(a) })).filter((l) => l.montant > 0);
        if (peutEncaisser && payer && lignesPay.length) {
          try {
            const rc = await api.post("/recus", { inscription_id: r.inscription_id, mode: modePay, reference: refPay, lignes: lignesPay });
            recuId = rc.id;
            toast(`${r.prenom} ${r.nom} inscrit(e) — reçu ${rc.numero} de ${fcfa(rc.montant)}`);
            ["recus", "caisse", "rapport", "factures"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
          } catch (e2) { toast(`Élève inscrit(e), mais le paiement n'a pas été enregistré : ${e2.message}`, "error"); }
        } else toast(`${r.prenom} ${r.nom} inscrit(e) — matricule ${r.matricule}`);
        onSaved?.(r.id, recuId);
      }
      qc.invalidateQueries({ queryKey: ["eleves"] });
      qc.invalidateQueries({ queryKey: ["eleve"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["matricule"] });
      ["situation", "impayes", "service"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) { setError(e); document.querySelector(".modal-body")?.scrollTo({ top: 0, behavior: "smooth" }); }
    setBusy(false);
  };

  const droit = classe ? (ins.inscription_offerte ? 0 : Math.max(classe.frais_inscription - (ins.reduction_inscription || 0), 0)) : 0;
  const fraisInscription = classe ? droit + (ins.uniforme ? classe.uniforme : 0) + (ins.tenue_sport ? classe.tenue_sport : 0) + (ins.cantine ? classe.frais_cantine : 0) : 0;
  const sansCs = !ins.cours_soir && classe?.cours_soir > 0 ? classe.cours_soir : 0;
  const cs = 0;
  const mensuel = classe ? (ins.cantine ? classe.mensualite_cantine : classe.mensualite) - sansCs : 0;
  const mensuelReel = ins.gratuit ? 0 : ins.mensualite_speciale || mensuel;
  const peutEncaisser = s.peut("finances.encaisser");
  const premierMois = (s.annee?.debut || today()).slice(0, 7);
  const articles = !classe ? [] : [
    { type: "inscription", libelle: "Droit d'inscription", du: droit, defaut: droit },
    ins.uniforme && { type: "uniforme", libelle: "Uniforme", du: classe.uniforme, defaut: classe.uniforme },
    ins.tenue_sport && { type: "tenue_sport", libelle: "Tenue de sport", du: classe.tenue_sport, defaut: classe.tenue_sport },
    ins.cantine && { type: "cantine", libelle: "Inscription cantine", du: classe.frais_cantine, defaut: classe.frais_cantine },
    mensuelReel > 0 && { type: "mensualite", mois: premierMois, libelle: `Mensualité ${moisLong(premierMois)}${classe.cours_soir > 0 && ins.cours_soir ? " (cours du soir compris)" : ""}`, du: mensuelReel, defaut: 0 },
  ].filter((a) => a && a.du > 0);
  const montantPaye = (a) => Math.min(Number(paye[a.type] ?? a.defaut) || 0, a.du);
  const totalPaye = articles.reduce((t, a) => t + montantPaye(a), 0);
  const totalDu = articles.reduce((t, a) => t + a.du, 0);

  return (
    <Modal wide pad={false} icon={<span className="ic teal" style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center" }}>{edition ? <Pencil size={19} /> : <UserPlus size={19} />}</span>}
      title={edition ? `Modifier ${eleve.prenom} ${eleve.nom}` : "Inscrire un nouvel élève"} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Enregistrement…" : edition ? "Enregistrer les modifications" : peutEncaisser && payer && totalPaye > 0 ? `Inscrire et encaisser ${fcfa(totalPaye)}` : "Inscrire l'élève"}</button>
    </>}>
      <div>
        <ErrorBox error={error} />

        <Sec icon={User} tone="teal" title="Identité de l'élève">
          <div className="grid g3">
            <Field label="Prénom(s)" required><Input value={v.prenom} onChange={set("prenom")} autoFocus /></Field>
            <Field label="Nom" required><Input value={v.nom} onChange={set("nom")} style={{ textTransform: "uppercase" }} /></Field>
            <Field label="Sexe" required>
              <div className="seg full" role="radiogroup">
                <button type="button" className={v.sexe === "F" ? "on F" : ""} onClick={() => setV({ ...v, sexe: "F" })}>Fille</button>
                <button type="button" className={v.sexe === "M" ? "on M" : ""} onClick={() => setV({ ...v, sexe: "M" })}>Garçon</button>
              </div>
            </Field>
            <Field label="Date de naissance"><Input type="date" value={v.date_naissance} onChange={set("date_naissance")} /></Field>
            <Field label="Lieu de naissance"><Input value={v.lieu_naissance || ""} onChange={set("lieu_naissance")} /></Field>
            <Field label="Matricule" hint={edition ? "Non modifiable" : "Généré automatiquement, modifiable"}>
              <Input value={v.matricule || ""} onChange={set("matricule")} disabled={edition} />
            </Field>
            <Field label="Adresse" className="span2"><Input value={v.adresse || ""} onChange={set("adresse")} placeholder="Quartier, rue, villa…" /></Field>
          </div>
        </Sec>

        <Sec icon={Users} tone="rose" title="Parents et tuteur" sub="Au moins un numéro joignable est recommandé.">
          <div className="grid g4">
            <Field label="Prénom du père"><Input value={v.pere_prenom || ""} onChange={set("pere_prenom")} /></Field>
            <Field label="Nom du père"><Input value={v.pere_nom || ""} onChange={set("pere_nom")} /></Field>
            <Field label="Profession"><Input value={v.pere_profession || ""} onChange={set("pere_profession")} /></Field>
            <Field label="Téléphone du père"><Input type="tel" value={v.pere_telephone || ""} onChange={set("pere_telephone")} placeholder="77 000 00 00" /></Field>
            <Field label="Prénom de la mère"><Input value={v.mere_prenom || ""} onChange={set("mere_prenom")} /></Field>
            <Field label="Nom de la mère"><Input value={v.mere_nom || ""} onChange={set("mere_nom")} /></Field>
            <Field label="Profession"><Input value={v.mere_profession || ""} onChange={set("mere_profession")} /></Field>
            <Field label="Téléphone de la mère"><Input type="tel" value={v.mere_telephone || ""} onChange={set("mere_telephone")} placeholder="77 000 00 00" /></Field>
            <Field label="Tuteur (si différent)" className="span2"><Input value={v.tuteur_nom || ""} onChange={set("tuteur_nom")} /></Field>
            <Field label="Téléphone du tuteur" className="span2"><Input type="tel" value={v.tuteur_telephone || ""} onChange={set("tuteur_telephone")} /></Field>
          </div>
        </Sec>

        {!edition && (
          <Sec icon={GraduationCap} tone="gold" title={`Inscription ${s.annee?.libelle}`}>
            <div className="grid g2" style={{ alignItems: "start" }}>
              <div className="grid" style={{ gap: 14 }}>
                <Field label="Classe" required>
                  <Select value={ins.classe_id} onChange={(e) => setIns({ ...ins, classe_id: e.target.value })}>
                    <option value="">Choisir une classe…</option>
                    {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.nom} — {c.effectif} élève{c.effectif > 1 ? "s" : ""}{c.capacite ? ` / ${c.capacite}` : ""}</option>)}
                  </Select>
                </Field>
                <div className="grid g2">
                  <Field label="Type">
                    <Select value={ins.type} onChange={(e) => setIns({ ...ins, type: e.target.value })}>
                      <option value="nouvelle">Nouvelle inscription</option>
                      <option value="reinscription">Réinscription</option>
                    </Select>
                  </Field>
                  <Field label="Date d'inscription"><Input type="date" value={ins.date_inscription} onChange={(e) => setIns({ ...ins, date_inscription: e.target.value })} /></Field>
                </div>
                <TarifScolarite value={ins} normal={mensuel} onChange={(x) => setIns({ ...ins, ...x })} />
                <ReductionInscription value={ins} droit={classe?.frais_inscription} onChange={(x) => setIns({ ...ins, ...x })} />
                <div className="options-3">
                  <label className="switch-card"><input type="checkbox" checked={ins.uniforme} onChange={(e) => setIns({ ...ins, uniforme: e.target.checked })} /><div><strong>Uniforme</strong><div className="xs muted">{classe ? fcfa(classe.uniforme) : "—"}</div></div></label>
                  <label className="switch-card"><input type="checkbox" checked={ins.tenue_sport} onChange={(e) => setIns({ ...ins, tenue_sport: e.target.checked })} /><div><strong>Tenue de sport</strong><div className="xs muted">{classe ? fcfa(classe.tenue_sport) : "—"}</div></div></label>
                  {classe?.cours_soir > 0 && <label className="switch-card"><input type="checkbox" checked={ins.cours_soir} onChange={(e) => setIns({ ...ins, cours_soir: e.target.checked })} /><div><strong>Cours du soir</strong><div className="xs muted">{ins.cours_soir ? "Compris dans la mensualité" : `Mensualité − ${fcfa(classe.cours_soir)}`}</div></div></label>}
                  <label className="switch-card"><input type="checkbox" checked={ins.cantine} onChange={(e) => setIns({ ...ins, cantine: e.target.checked })} /><div><strong>Cantine</strong><div className="xs muted">{classe ? `${fcfa(classe.frais_cantine)} + mensualité` : "Déjeune à l'école"}</div></div></label>
                </div>
              </div>
              <div className="recap lattice">
                <h4>Frais à régler à l'inscription</h4>
                {classe ? <>
                  <div className="recap-row" style={{ marginTop: 10 }}><span>Droit d'inscription</span><span>{ins.inscription_offerte ? "Offert" : fcfa(classe.frais_inscription)}</span></div>
                  {!ins.inscription_offerte && ins.reduction_inscription > 0 && <div className="recap-row" style={{ color: "var(--gold)" }}><span>Réduction accordée</span><span>−{fcfa(Math.min(ins.reduction_inscription, classe.frais_inscription))}</span></div>}
                  {ins.uniforme && <div className="recap-row"><span>Uniforme</span><span>{fcfa(classe.uniforme)}</span></div>}
                  {ins.tenue_sport && <div className="recap-row"><span>Tenue de sport</span><span>{fcfa(classe.tenue_sport)}</span></div>}
                  {ins.cantine && <div className="recap-row"><span>Inscription cantine</span><span>{fcfa(classe.frais_cantine)}</span></div>}
                  <div className="recap-row total"><span>Total</span><span>{fcfa(fraisInscription)}</span></div>
                  <p className="note">{ins.gratuit ? "Aucune mensualité à payer." : ins.mensualite_speciale ? `Puis ${fcfa(mensuelReel + cs)} par mois (tarif personnalisé${cs ? ", cours du soir inclus" : ""}), ${fcfa(Math.round(mensuelReel * 1.5) + cs)} en janvier et février.` : `Puis ${fcfa(mensuel)} par mois${classe.cours_soir > 0 ? (ins.cours_soir ? " (cours du soir compris)" : " (sans cours du soir)") : ""}, ${fcfa((ins.cantine ? classe.mensualite_cantine_jan_fev : classe.mensualite_jan_fev) - sansCs)} en janvier et février.`}</p>
                </> : <p className="note">Choisissez une classe pour afficher les frais.</p>}
              </div>
            </div>
          </Sec>
        )}

        {!edition && classe && peutEncaisser && articles.length > 0 && (
          <Sec icon={Wallet} tone="green" title="Paiement à l'inscription" sub="Indiquez ce que le parent verse aujourd'hui. Si c'est incomplet, le reste sera dû et apparaîtra sur la facture.">
            <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" checked={payer} onChange={(e) => setPayer(e.target.checked)} />Encaisser un paiement maintenant</label>
            {payer && <>
              <div className="pay-table">
                <div className="pay-head"><span>Élément</span><span>Prix</span><span>Payé aujourd'hui</span><span>Reste</span></div>
                {articles.map((a) => {
                  const p = montantPaye(a), reste = a.du - p;
                  return (
                    <div key={a.type} className="pay-row">
                      <span><strong>{a.libelle}</strong></span>
                      <span className="num">{fcfa(a.du)}</span>
                      <Money value={paye[a.type] ?? a.defaut} onChange={(x) => setPaye({ ...paye, [a.type]: x ?? 0 })} aria-label={`Payé ${a.libelle}`} />
                      <span className={`num pay-reste ${reste > 0 ? "due" : ""}`}>{reste > 0 ? fcfa(reste) : "Complet"}</span>
                    </div>
                  );
                })}
                <div className="pay-row pay-total"><span>Total</span><span className="num">{fcfa(totalDu)}</span><span className="num">{fcfa(totalPaye)}</span><span className={`num pay-reste ${totalDu - totalPaye > 0 ? "due" : ""}`}>{totalDu - totalPaye > 0 ? fcfa(totalDu - totalPaye) : "Complet"}</span></div>
              </div>
              <div className="grid g2" style={{ marginTop: 14 }}>
                <Field label="Mode de paiement"><Select value={modePay} onChange={(e) => setModePay(e.target.value)}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
                <Field label="Référence / n° de transaction"><Input value={refPay} onChange={(e) => setRefPay(e.target.value)} placeholder="Facultatif" /></Field>
              </div>
            </>}
          </Sec>
        )}

        <Sec icon={NotebookPen} tone="azure" title="Observations">
          <Textarea value={v.observations || ""} onChange={set("observations")} placeholder="Santé, allergies, personne autorisée à récupérer l'enfant…" />
        </Sec>
      </div>
    </Modal>
  );
}
