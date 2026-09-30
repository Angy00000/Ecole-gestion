// Graphiques SVG légers, sans dépendance, adaptés aux couleurs de l'école.
import { moisCourt } from "../lib/format";

export function Ring({ value = 0, size = 150, stroke = 14, color = "var(--gold)", track = "rgba(255,255,255,.14)" }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray .8s ease" }} />
    </svg>
  );
}

export function Donut({ parts, size = 168, stroke = 22, center }) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none", margin: "0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke}
            strokeDasharray={`${Math.max(len - 3, 0)} ${c}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          off += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>{center}</div>
    </div>
  );
}

const CYCLE_COLOR = { garderie: "var(--gold)", prescolaire: "var(--coral)", elementaire: "var(--teal)" };

export function ClassBars({ data, height = 230 }) {
  const W = 640, H = height, pad = { t: 24, b: 30, l: 30, r: 8 };
  const max = Math.max(5, ...data.map((d) => d.effectif), ...data.map((d) => d.capacite || 0));
  const step = Math.ceil(max / 4 / 5) * 5 || 5;
  const top = step * 4;
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Effectifs par classe">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(i * step)} y2={y(i * step)} />
            <text x={pad.l - 8} y={y(i * step) + 4} textAnchor="end">{i * step}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.22, w = bw * 0.56;
          const h = Math.max(y(0) - y(d.effectif), d.effectif ? 3 : 0);
          return (
            <g key={d.id}>
              {d.capacite ? <rect x={x} y={y(d.capacite)} width={w} height={y(0) - y(d.capacite)} rx="7" fill="var(--surface-2)" stroke="var(--line)" /> : null}
              <rect x={x} y={y(0) - h} width={w} height={h} rx="7" fill={CYCLE_COLOR[d.cycle] || "var(--teal)"} />
              {d.effectif > 0 && <text x={x + w / 2} y={y(0) - h - 7} textAnchor="middle" style={{ fill: "var(--ink)", fontWeight: 700, fontSize: 12 }}>{d.effectif}</text>}
              <text x={x + w / 2} y={H - 10} textAnchor="middle" style={{ fontWeight: 700, fill: "var(--ink-2)" }}>{d.nom}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AreaChart({ data, height = 210 }) {
  const W = 640, H = height, pad = { t: 28, b: 30, l: 8, r: 8 };
  const max = Math.max(1, ...data.map((d) => d.montant)) * 1.15;
  const x = (i) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, data.length - 1);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const pts = data.map((d, i) => [x(i), y(d.montant)]);
  const line = pts.map((p, i) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const q = pts[i - 1], cx = (q[0] + p[0]) / 2;
    return `C${cx},${q[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }).join(" ");
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const k = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")} M` : v >= 1000 ? `${Math.round(v / 1000)} k` : v);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Encaissements par mois">
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--teal)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(max * f / 1.15)} y2={y(max * f / 1.15)} />)}
        <path d={area} fill="url(#ag)" />
        <path d={line} fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 6 : 4} fill={i === pts.length - 1 ? "var(--gold)" : "var(--surface)"} stroke={i === pts.length - 1 ? "var(--surface)" : "var(--teal)"} strokeWidth="2.5" />
            {data[i].montant > 0 && <text x={p[0]} y={p[1] - 12} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} style={{ fill: "var(--ink)", fontWeight: 700 }}>{k(data[i].montant)}</text>}
            <text x={p[0]} y={H - 8} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}>{moisCourt(data[i].mois)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
