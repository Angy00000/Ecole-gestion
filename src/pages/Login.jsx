import { useState } from "react";
import { LogIn, Mail, Lock, ShieldCheck, Users, Wallet, BookOpen } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { Field, ErrorBox } from "../components/ui";

export default function Login() {
  const s = useSession();
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { const r = await api.post("/auth/login", { email, mot_de_passe: mdp }); s.login(r.token); }
    catch (err) { setError(err); setBusy(false); }
  };

  return (
    <div className="login">
      <section className="login-side lattice">
        <img className="logo" src="/logo.png" alt="Logo ESJBM" />
        <div className="mid">
          <h1>École Saint Jean Baptiste de Malika</h1>
          <p className="motto">Éduquer c'est rendre libre !</p>
          <div className="feats">
            <span className="feat"><Users size={16} />Élèves et inscriptions</span>
            <span className="feat"><Wallet size={16} />Paiements et reçus</span>
            <span className="feat"><BookOpen size={16} />Notes et bulletins</span>
          </div>
        </div>
        <p className="foot">Malika Cité Sonatel · Autorisation N° 00313/DU/08/01/2015</p>
      </section>
      <section className="login-main">
        <div className="login-card">
          <img className="logo-m" src="/logo.png" alt="" />
          <h2>Bienvenue</h2>
          <p>Connectez-vous pour accéder au logiciel de gestion de l'école.</p>
          <form onSubmit={submit}>
            {error && <ErrorBox error={error} />}
            <Field label="Adresse email">
              <div className="with-icon"><Mail size={18} /><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="nom@ecole.com" /></div>
            </Field>
            <Field label="Mot de passe">
              <div className="with-icon"><Lock size={18} /><input className="input" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} required placeholder="••••••••" /></div>
            </Field>
            <button className="btn primary" style={{ height: 50, fontSize: 15 }} disabled={busy}>
              <LogIn size={18} />{busy ? "Connexion…" : "Se connecter"}
            </button>
            <p className="xs muted row" style={{ justifyContent: "center", gap: 6 }}><ShieldCheck size={14} />Connexion sécurisée · session de 12 heures</p>
          </form>
        </div>
      </section>
    </div>
  );
}
