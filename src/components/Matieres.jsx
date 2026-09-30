import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check } from "lucide-react";
import { api } from "../lib/api";
import { Modal, Input, Select, Spinner, ErrorBox, useToast } from "./ui";

// Matières d'une classe : coefficient, barème, enseignant. Édition en ligne.
export default function Matieres({ classe, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["matieres", classe.id], queryFn: () => api.get(`/classes/${classe.id}/matieres`) });
  const ens = useQuery({ queryKey: ["enseignants"], queryFn: () => api.get("/enseignants") });
  const [nouv, setNouv] = useState({ nom: "", coefficient: 1, bareme: classe.bareme || 10 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["matieres", classe.id] }); qc.invalidateQueries({ queryKey: ["classes"] }); };
  const maj = async (m, d) => { try { await api.put(`/matieres/${m.id}`, d); refresh(); } catch (e) { toast(e.message, "error"); } };
  const ajouter = async () => {
    try { await api.post("/matieres", { ...nouv, classe_id: classe.id, ordre: (data?.length || 0) + 1 }); setNouv({ nom: "", coefficient: 1, bareme: classe.bareme || 10 }); refresh(); toast("Matière ajoutée"); }
    catch (e) { toast(e.message, "error"); }
  };
  const suppr = async (m) => { try { await api.del(`/matieres/${m.id}`); refresh(); toast(`${m.nom} supprimée`); } catch (e) { toast(e.message, "error"); } };
  const total = data?.reduce((t, m) => t + Number(m.coefficient), 0) || 0;
  return (
    <Modal wide pad={false} title={`Matières — ${classe.nom}`} onClose={onClose} footer={<><span className="muted small" style={{ marginRight: "auto" }}>Total des coefficients : <strong>{total}</strong></span><button className="btn primary" onClick={onClose}><Check size={16} />Terminé</button></>}>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Matière</th><th style={{ width: 110 }}>Coefficient</th><th style={{ width: 110 }}>Noté sur</th><th>Enseignant</th><th /></tr></thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td><Input defaultValue={m.nom} onBlur={(e) => e.target.value !== m.nom && maj(m, { nom: e.target.value })} /></td>
                  <td><Input type="number" min="0.5" step="0.5" defaultValue={m.coefficient} onBlur={(e) => Number(e.target.value) !== Number(m.coefficient) && maj(m, { coefficient: e.target.value })} /></td>
                  <td><Select value={m.bareme} onChange={(e) => maj(m, { bareme: Number(e.target.value) })}><option value={10}>10</option><option value={20}>20</option></Select></td>
                  <td><Select value={m.enseignant_id || ""} onChange={(e) => maj(m, { enseignant_id: e.target.value || null })}>
                    <option value="">—</option>{ens.data?.filter((x) => x.statut === "actif").map((x) => <option key={x.id} value={x.id}>{x.prenom} {x.nom}</option>)}
                  </Select></td>
                  <td className="r"><button className="btn sm ghost icon" onClick={() => suppr(m)} aria-label={`Supprimer ${m.nom}`}><Trash2 size={15} /></button></td>
                </tr>
              ))}
              <tr style={{ background: "var(--surface-2)" }}>
                <td><Input value={nouv.nom} onChange={(e) => setNouv({ ...nouv, nom: e.target.value })} placeholder="Nouvelle matière…" onKeyDown={(e) => e.key === "Enter" && nouv.nom && ajouter()} /></td>
                <td><Input type="number" min="0.5" step="0.5" value={nouv.coefficient} onChange={(e) => setNouv({ ...nouv, coefficient: e.target.value })} /></td>
                <td><Select value={nouv.bareme} onChange={(e) => setNouv({ ...nouv, bareme: Number(e.target.value) })}><option value={10}>10</option><option value={20}>20</option></Select></td>
                <td colSpan={2}><button className="btn primary sm" onClick={ajouter} disabled={!nouv.nom}><Plus size={15} />Ajouter</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
