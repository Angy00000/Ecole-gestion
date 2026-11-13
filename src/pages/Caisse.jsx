import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Landmark, ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Scale } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { fcfa, date, MODES, MODE_COULEUR } from "../lib/format";
import { Spinner, ErrorBox, PageHead, Periode, periodes } from "../components/ui";

// Même réglage « discret » que le tableau de bord
const CLE_DISCRET = "eg2_discret";
const lireDiscret = () => { try { return localStorage.getItem(CLE_DISCRET) === "1"; } catch { return false; } };
const MASQUE = "• • • • •";

export default function Caisse() {
  const s = useSession();
  const [discret, setDiscretState] = useState(lireDiscret);
  const setDiscret = (v) => { setDiscretState(v); try { localStorage.setItem(CLE_DISCRET, v ? "1" : "0"); } catch { /* rien */ } };
  const [du, setDu] = useState(() => periodes(s.annee).mois.du);
  const [au, setAu] = useState(() => periodes(s.annee).mois.au);
  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["caisse", "solde", du, au], queryFn: () => api.get("/caisse/solde", { du, au }), placeholderData: keepPreviousData });
  const F = (n) => (discret ? MASQUE : fcfa(n));
  const signe = (n) => ({ color: n < 0 ? "var(--coral)" : undefined });

  return (
    <>
      <PageHead title="Caisse" sub="Ce qu'il y a en caisse : entrées moins sorties">
        <button className="btn" onClick={() => setDiscret(!discret)} aria-pressed={discret}>{discret ? <Eye size={17} /> : <EyeOff size={17} />}{discret ? "Afficher les chiffres" : "Masquer les chiffres"}</button>
      </PageHead>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : (() => {
        const t = data.total, p = data.periode;
        const modesUtiles = t.par_mode.filter((m) => m.entrees || m.sorties);
        return (
          <div className="stack" style={{ gap: 22 }}>
            <div className="card hero-solde" style={{ padding: "26px 28px", background: "var(--teal-900, #0c3139)", color: "#fff", border: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.85 }}><Landmark size={20} /><span style={{ fontWeight: 700 }}>En caisse aujourd'hui</span></div>
              <div style={{ fontSize: "clamp(34px, 6vw, 52px)", fontWeight: 800, margin: "8px 0 4px", letterSpacing: "-0.02em", color: t.solde < 0 ? "#ffb4a2" : "#fff" }}>{F(t.solde)}</div>
              <div style={{ opacity: 0.8, fontSize: 14 }}>
                {discret ? "Montants masqués" : <>Entrées {fcfa(t.entrees)} − sorties {fcfa(t.sorties)}</>}{data.depuis ? ` · depuis le ${date(data.depuis)}` : ""}
              </div>
            </div>

            <div className="dash">
              {(modesUtiles.length ? modesUtiles : t.par_mode.slice(0, 3)).map((m) => (
                <div key={m.mode} className="card kpi c3">
                  <div className="top"><span className="label">{MODES[m.mode]}</span><span className="dot" style={{ width: 12, height: 12, borderRadius: 99, background: MODE_COULEUR[m.mode] }} /></div>
                  <div className="value" style={{ fontSize: 26, ...signe(m.solde) }}>{F(m.solde)}</div>
                  <div className="sub">{discret ? "—" : <>+{fcfa(m.entrees)} · −{fcfa(m.sorties)}</>}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Sur une période</h3>
                <Periode annee={s.annee} du={du} au={au} onChange={(d, f) => { setDu(d); setAu(f); }} />
              </div>
              <div className="card-body" style={{ opacity: isFetching ? 0.65 : 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
                  <div className="card" style={{ padding: 16, background: "var(--surface-2)" }}>
                    <div className="small muted"><ArrowDownLeft size={15} style={{ verticalAlign: "-3px" }} /> Entrées</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--green)" }}>{F(p.entrees)}</div>
                    {!discret && <div className="xs muted">Scolarité {fcfa(p.encaissements)} · recettes diverses {fcfa(p.recettes)}</div>}
                  </div>
                  <div className="card" style={{ padding: 16, background: "var(--surface-2)" }}>
                    <div className="small muted"><ArrowUpRight size={15} style={{ verticalAlign: "-3px" }} /> Sorties (dépenses)</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--coral)" }}>{F(p.sorties)}</div>
                  </div>
                  <div className="card" style={{ padding: 16, background: "var(--surface-2)" }}>
                    <div className="small muted"><Scale size={15} style={{ verticalAlign: "-3px" }} /> Différence</div>
                    <div style={{ fontSize: 24, fontWeight: 800, ...signe(p.solde) }}>{discret ? MASQUE : `${p.solde > 0 ? "+" : ""}${fcfa(p.solde)}`}</div>
                  </div>
                </div>
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Mode</th><th className="r">Entrées</th><th className="r">Sorties</th><th className="r">Différence</th></tr></thead>
                  <tbody>{p.par_mode.map((m) => (
                    <tr key={m.mode}><td><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: MODE_COULEUR[m.mode], marginRight: 8 }} />{MODES[m.mode]}</td>
                      <td className="r amount">{F(m.entrees)}</td><td className="r amount">{F(m.sorties)}</td><td className="r amount" style={signe(m.solde)}><strong>{F(m.solde)}</strong></td></tr>
                  ))}</tbody>
                  <tfoot><tr><th>Total</th><th className="r amount">{F(p.entrees)}</th><th className="r amount">{F(p.sorties)}</th><th className="r amount" style={signe(p.solde)}>{F(p.solde)}</th></tr></tfoot>
                </table></div>
                <p className="xs muted" style={{ marginTop: 12 }}>
                  Entrées = reçus de paiement (sauf annulés) + <Link to="/recettes">recettes diverses</Link>. Sorties = <Link to="/depenses">dépenses</Link>. Le détail d'une journée est dans <Link to="/paiements?vue=caisse">Encaissements → Journal de caisse</Link>.
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
