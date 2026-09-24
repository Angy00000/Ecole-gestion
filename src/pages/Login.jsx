import { useState } from "react";
import { LogIn } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { Field, Input, ErrorBox } from "../components/ui";

export default function Login() {
  const s = useSession();
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api.post("/auth/login", { email, mot_de_passe: mdp });
      s.login(r.token);
    } catch (err) { setError(err); }
    setBusy(false);
  };

  return (
    <div className="login">
      <section className="login-side">
        <div className="ring" /><div className="ring b" />
        <div>
          <img src="/logo.png" alt="Logo ESJBM" />
          <h1>École Saint Jean Baptiste de Malika</h1>
          <p>Éduquer c'est rendre libre !</p>
        </div>
        <p className="small">Logiciel de gestion scolaire · Malika Cité Sonatel</p>
      </section>
      <section className="login-main">
        <div className="login-card">
          <h2>Connexion</h2>
          <p className="muted">Entrez vos identifiants pour accéder au logiciel.</p>
          <form onSubmit={submit}>
            <ErrorBox error={error} />
            <Field label="Adresse email">
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>
            <Field label="Mot de passe">
              <Input type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} required />
            </Field>
            <button className="btn primary" style={{ height: 44 }} disabled={busy}>
              <LogIn size={18} />{busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
