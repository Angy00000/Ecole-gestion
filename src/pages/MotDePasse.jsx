import { useState } from "react";
import { api } from "../lib/api";
import { Modal, Field, Input, ErrorBox, useToast } from "../components/ui";

export default function MotDePasse({ onClose }) {
  const toast = useToast();
  const [v, setV] = useState({ ancien: "", nouveau: "", confirm: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const save = async () => {
    if (v.nouveau !== v.confirm) return setError(new Error("Les deux nouveaux mots de passe ne correspondent pas."));
    setBusy(true); setError(null);
    try { await api.post("/auth/password", { ancien: v.ancien, nouveau: v.nouveau }); toast("Mot de passe modifié"); onClose(); }
    catch (e) { setError(e); }
    setBusy(false);
  };

  return (
    <Modal title="Changer mon mot de passe" onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={save} disabled={busy || !v.ancien || !v.nouveau}>Enregistrer</button>
    </>}>
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        <Field label="Mot de passe actuel"><Input type="password" value={v.ancien} onChange={set("ancien")} autoFocus /></Field>
        <Field label="Nouveau mot de passe" hint="8 caractères minimum"><Input type="password" value={v.nouveau} onChange={set("nouveau")} /></Field>
        <Field label="Confirmer le nouveau mot de passe"><Input type="password" value={v.confirm} onChange={set("confirm")} /></Field>
      </div>
    </Modal>
  );
}
