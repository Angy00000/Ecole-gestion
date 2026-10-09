import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, Inbox } from "lucide-react";

// ── Messages éphémères ──
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = "ok") => {
    const id = Math.random();
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), type === "error" ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ── Modale ──
export function Modal({ title, onClose, children, footer, wide, pad = true, icon }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          {icon}
          <h2>{title}</h2>
          <button className="btn ghost icon sm" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className={`modal-body ${pad ? "pad" : ""}`}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = "Confirmer", danger, onConfirm, onClose, busy }) {
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className={`btn ${danger ? "danger" : "primary"}`} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
    </>}>
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}

// ── Champs ──
export function Field({ label, required, hint, children, className = "" }) {
  return (
    <div className={`field ${className}`}>
      {label && <label>{label}{required && <span className="req">*</span>}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export const Input = (p) => <input className={`input ${p.className || ""}`} {...p} />;
export const Select = ({ children, className = "", ...p }) => <select className={`select ${className}`} {...p}>{children}</select>;
export const Textarea = (p) => <textarea className="textarea" {...p} />;

export function Money({ value, onChange, ...p }) {
  return (
    <input className="input num" inputMode="numeric" value={value ?? ""}
      onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); onChange(v === "" ? null : Number(v)); }} {...p} />
  );
}

// ── États ──
export const Spinner = () => <div className="loading"><div className="spinner" /></div>;
export function Empty({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="empty">
      <div className="em-ic"><Icon size={32} strokeWidth={1.6} /></div>
      {title && <h3>{title}</h3>}
      {children && <div>{children}</div>}
      {action}
    </div>
  );
}
export const ErrorBox = ({ error }) => error ? <div className="alert"><AlertCircle size={18} />{error.message || String(error)}</div> : null;

// ── Petit utilitaire de formulaire ──
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => {
    const v = e && e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setValues((s) => ({ ...s, [k]: v }));
  };
  return [values, set, setValues];
}

export function PageHead({ title, sub, children, back }) {
  useEffect(() => { document.title = `${title} — ESJBM`; }, [title]);
  return (
    <div className="page-head">
      <div className="t">
        {back}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

// Choix de période lisible : raccourcis + dates libres + phrase « Affichage du … au … ».
const iso = (d) => d.toISOString().slice(0, 10);
export function periodes(annee) {
  const t = new Date(); const y = t.getUTCFullYear(), m = t.getUTCMonth();
  const ay = Number(String(annee?.debut || iso(t)).slice(0, 4));
  return {
    mois: { label: "Ce mois-ci", du: iso(new Date(Date.UTC(y, m, 1))), au: iso(new Date(Date.UTC(y, m + 1, 0))) },
    precedent: { label: "Mois dernier", du: iso(new Date(Date.UTC(y, m - 1, 1))), au: iso(new Date(Date.UTC(y, m, 0))) },
    annee: { label: `Année ${annee?.libelle || "scolaire"}`, du: `${ay}-07-01`, au: `${ay + 1}-06-30` },
  };
}
export function Periode({ annee, du, au, onChange }) {
  const P = periodes(annee);
  const [libre, setLibre] = useState(false);
  const trouve = Object.keys(P).find((k) => P[k].du === du && P[k].au === au);
  const actif = libre ? null : trouve;
  const fmt = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="periode">
      <div className="seg">
        {Object.entries(P).map(([k, p]) => <button key={k} type="button" className={actif === k ? "on" : ""} onClick={() => { setLibre(false); onChange(p.du, p.au); }}>{p.label}</button>)}
        <button type="button" className={!actif ? "on" : ""} onClick={() => setLibre(true)}>Autres dates</button>
      </div>
      {!actif && (
        <div className="date-range">
          <span className="muted">Du</span><input className="input" type="date" value={du} onChange={(e) => onChange(e.target.value, au)} aria-label="Du" />
          <span className="muted">au</span><input className="input" type="date" value={au} onChange={(e) => onChange(du, e.target.value)} aria-label="Au" />
        </div>
      )}
      <span className="periode-txt">Affichage du <strong>{fmt(du)}</strong> au <strong>{fmt(au)}</strong></span>
    </div>
  );
}
