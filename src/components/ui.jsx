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
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon sm" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
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
      <Icon size={40} strokeWidth={1.5} />
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
