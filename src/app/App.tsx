import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, AlertTriangle, MapPin, Navigation, Filter,
  X, Bus, Activity, Clock, Users, BarChart3,
  Cross, Pill, ShoppingCart, Lightbulb, Layers,
  TrendingUp, Eye
} from "lucide-react";

// ── PHOSPHOR GREEN PALETTE ──────────────────────────────────────────────────
const G = {
  bright:  "#00ff41",
  mid:     "#00cc33",
  dim:     "#007a20",
  faint:   "#003310",
  bg:      "#000900",
  panel:   "#010d02",
  border:  "rgba(0,255,65,0.14)",
  glow:    "rgba(0,255,65,0.6)",
  danger:  "#ff2200",
  warn:    "#ffaa00",
  blue:    "#0099ff",
  scanline:"rgba(0,0,0,0.08)",
};

// ── MOCK DATA ───────────────────────────────────────────────────────────────

interface CrimePoint { x: number; y: number; type: string; intensity: number; }
interface SafePoint  { x: number; y: number; kind: "farm" | "del" | "hosp" | "merc"; label: string; }

const CRIME_POINTS: CrimePoint[] = [
  { x: 30,  y: 25,  type: "roubo",     intensity: 0.92 },
  { x: 55,  y: 18,  type: "furto",     intensity: 0.65 },
  { x: 70,  y: 35,  type: "assalto",   intensity: 0.88 },
  { x: 42,  y: 52,  type: "violência", intensity: 0.74 },
  { x: 20,  y: 60,  type: "furto",     intensity: 0.50 },
  { x: 80,  y: 55,  type: "tráfico",   intensity: 0.80 },
  { x: 60,  y: 70,  type: "roubo",     intensity: 0.60 },
  { x: 15,  y: 38,  type: "assalto",   intensity: 0.70 },
  { x: 88,  y: 25,  type: "violência", intensity: 0.55 },
  { x: 50,  y: 82,  type: "tráfico",   intensity: 0.68 },
  { x: 35,  y: 72,  type: "roubo",     intensity: 0.45 },
  { x: 75,  y: 80,  type: "furto",     intensity: 0.38 },
];

import { SP_CENTER, safePoints as realSafePoints } from '../data/MockData.js';

// Distance calculation
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const METRO_POINTS = [
  { x: 40, y: 30, label: "SÉ" },
  { x: 62, y: 45, label: "ANHANGABAÚ" },
  { x: 25, y: 50, label: "LIBERDADE" },
  { x: 72, y: 68, label: "CONSOLAÇÃO" },
];

const LIT_ZONES = [
  { cx: 40, cy: 30, r: 18, level: "alto"  },
  { cx: 70, cy: 20, r: 14, level: "alto"  },
  { cx: 20, cy: 60, r: 16, level: "baixo" },
  { cx: 80, cy: 75, r: 12, level: "médio" },
  { cx: 50, cy: 55, r: 20, level: "médio" },
];

const CRIME_TYPES = ["roubo", "furto", "assalto", "tráfico", "violência"];
const TIME_SLOTS  = ["manhã", "tarde", "noite", "madrugada"];
const GROUPS      = ["mulheres", "ciclistas", "idosos", "PCD", "turistas", "motoristas"];

// ── UTIL: CRT glow text shadow ──────────────────────────────────────────────
const crtGlow = (color = G.bright, strength = 8) =>
  `0 0 ${strength}px ${color}, 0 0 ${strength * 2}px ${color}40`;

// ── UTIL: live ticker ────────────────────────────────────────────────────────
function useTick(ms = 2200) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(n => n + 1), ms); return () => clearInterval(id); }, [ms]);
  return t;
}
function useTime() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}
function useLive(base: number, v: number) {
  const [val, setVal] = useState(base);
  useEffect(() => { const id = setInterval(() => setVal(+(base + (Math.random() - 0.5) * v * 2).toFixed(1)), 1900); return () => clearInterval(id); }, []);
  return val;
}

// ── COMPONENT: Scanline overlay ──────────────────────────────────────────────
function Scanlines({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: "repeating-linear-gradient(0deg,rgba(0,0,0,0.07) 0px,rgba(0,0,0,0.07) 1px,transparent 1px,transparent 3px)",
        zIndex: 50,
      }}
    />
  );
}

// ── COMPONENT: HUD corner brackets ──────────────────────────────────────────
function HudCorners({ color = G.bright, size = 14, thickness = 1.5 }: { color?: string; size?: number; thickness?: number }) {
  const s = `${size}px`;
  const corners = ["top-0 left-0","top-0 right-0","bottom-0 left-0","bottom-0 right-0"];
  return (
    <>
      {corners.map((pos, i) => (
        <div key={i} className={`absolute ${pos} pointer-events-none`} style={{ width: s, height: s, zIndex: 10 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
            <path
              d={
                i === 0 ? `M ${size} ${thickness/2} L ${thickness/2} ${thickness/2} L ${thickness/2} ${size}` :
                i === 1 ? `M 0 ${thickness/2} L ${size - thickness/2} ${thickness/2} L ${size - thickness/2} ${size}` :
                i === 2 ? `M ${size} ${size - thickness/2} L ${thickness/2} ${size - thickness/2} L ${thickness/2} 0` :
                          `M 0 ${size - thickness/2} L ${size - thickness/2} ${size - thickness/2} L ${size - thickness/2} 0`
              }
              stroke={color}
              strokeWidth={thickness}
              strokeOpacity={0.8}
            />
          </svg>
        </div>
      ))}
    </>
  );
}

// ── COMPONENT: Blinking cursor ───────────────────────────────────────────────
function Cursor({ color = G.bright }: { color?: string }) {
  return <span style={{ color, animation: "blink 1.1s step-end infinite" }}>█</span>;
}

// ── COMPONENT: Chip ──────────────────────────────────────────────────────────
function Chip({
  label, active, color = G.bright, onToggle,
}: { label: string; active: boolean; color?: string; onToggle: () => void; }) {
  return (
    <button
      onClick={onToggle}
      className="px-2 py-0.5 text-xs uppercase tracking-wider border transition-all duration-150"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background:   active ? `${color}18` : "transparent",
        borderColor:  active ? color         : G.faint,
        color:        active ? color         : G.dim,
        boxShadow:    active ? `0 0 6px ${color}40` : "none",
        letterSpacing: "0.1em",
      }}
    >
      {active ? "◆" : "◇"} {label}
    </button>
  );
}

// ── COMPONENT: Map SVG ──────────────────────────────────────────────────────
const VW = 400; const VH = 560;

function MapSVG({
  activeTypes, activeLayer, activeGroups,
}: {
  activeTypes: Set<string>;
  activeLayer: string;
  activeGroups: Set<string>;
}) {
  const tick = useTick(3000);

  // Grid lines
  const gridH = Array.from({ length: 14 }, (_, i) => (i + 1) * (VH / 15));
  const gridV = Array.from({ length: 10 }, (_, i) => (i + 1) * (VW / 11));

  // Visible crime points
  const visible = CRIME_POINTS.filter(p => activeTypes.has(p.type));

  const safeColor = (k: string) =>
    k === "del" ? G.bright : k === "hosp" ? "#0099ff" : k === "farm" ? G.mid : G.warn;

  const litColor = (l: string) =>
    l === "alto" ? "rgba(255,220,50,0.15)" : l === "médio" ? "rgba(255,180,0,0.08)" : "rgba(0,0,0,0.3)";

  const pct = (v: number, max: number) => (v / 100) * max;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
    >
      <defs>
        {/* base bg gradient */}
        <linearGradient id="mapbg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000c01" />
          <stop offset="100%" stopColor="#000700" />
        </linearGradient>

        {/* heatmap radial gradients per crime point */}
        {CRIME_POINTS.map((p, i) => (
          <radialGradient key={i} id={`cg${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={G.danger} stopOpacity={p.intensity * 0.7} />
            <stop offset="40%"  stopColor={G.danger} stopOpacity={p.intensity * 0.3} />
            <stop offset="80%"  stopColor="#ff6600"  stopOpacity={p.intensity * 0.08} />
            <stop offset="100%" stopColor={G.danger}  stopOpacity={0} />
          </radialGradient>
        ))}

        {/* scanline */}
        <pattern id="scan" x="0" y="0" width="1" height="3" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="1" height="1" fill="rgba(0,0,0,0.07)" />
        </pattern>

        {/* vignette */}
        <radialGradient id="vig" cx="50%" cy="50%" r="65%">
          <stop offset="55%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
        </radialGradient>

        {/* CRT glow filter */}
        <filter id="phosphor">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* base */}
      <rect width={VW} height={VH} fill="url(#mapbg)" />

      {/* ── ILLUMINATION LAYER ── */}
      {activeLayer === "luz" && LIT_ZONES.map((z, i) => (
        <circle
          key={i}
          cx={pct(z.cx, VW)} cy={pct(z.cy, VH)}
          r={pct(z.r, VW)}
          fill={litColor(z.level)}
        />
      ))}

      {/* street grid */}
      {gridH.map((y, i) => (
        <line key={`h${i}`} x1={0} y1={y} x2={VW} y2={y}
          stroke={G.faint} strokeWidth={i % 3 === 0 ? 0.8 : 0.4} strokeOpacity={0.7} />
      ))}
      {gridV.map((x, i) => (
        <line key={`v${i}`} x1={x} y1={0} x2={x} y2={VH}
          stroke={G.faint} strokeWidth={i % 2 === 0 ? 0.8 : 0.4} strokeOpacity={0.7} />
      ))}

      {/* city blocks */}
      {[
        [36, 0, 52, 34], [100, 0, 64, 34], [180, 0, 56, 34], [248, 0, 70, 34], [334, 0, 60, 34],
        [36, 50, 52, 52], [100, 50, 64, 52], [180, 50, 56, 52], [248, 50, 70, 52], [334, 50, 60, 52],
        [36, 120, 52, 48], [100, 120, 64, 48], [180, 120, 56, 48], [248, 120, 70, 48], [334, 120, 60, 48],
        [36, 185, 52, 60], [100, 185, 64, 60], [180, 185, 56, 60], [248, 185, 70, 60], [334, 185, 60, 60],
        [36, 265, 52, 48], [100, 265, 64, 48], [180, 265, 56, 48], [248, 265, 70, 48], [334, 265, 60, 48],
        [36, 332, 52, 52], [100, 332, 64, 52], [180, 332, 56, 52], [248, 332, 70, 52], [334, 332, 60, 52],
        [36, 402, 52, 46], [100, 402, 64, 46], [180, 402, 56, 46], [248, 402, 70, 46], [334, 402, 60, 46],
        [36, 460, 52, 50], [100, 460, 64, 50], [180, 460, 56, 50], [248, 460, 70, 50], [334, 460, 60, 50],
      ].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h}
          fill="#010e02" stroke={G.faint} strokeWidth={0.3} strokeOpacity={0.5} rx={1} />
      ))}

      {/* diagonal avenues */}
      <path d="M 0 120 L 400 80"  stroke={G.faint} strokeWidth={1.2} fill="none" strokeOpacity={0.4} />
      <path d="M 60 560 L 400 300" stroke={G.faint} strokeWidth={1}   fill="none" strokeOpacity={0.35} />
      <path d="M 0 280 L 320 560" stroke={G.faint} strokeWidth={0.8} fill="none" strokeOpacity={0.3} />

      {/* ── HEATMAP LAYER ── */}
      {activeLayer === "heat" && CRIME_POINTS.map((p, i) => (
        <ellipse
          key={i}
          cx={pct(p.x, VW)} cy={pct(p.y, VH)}
          rx={pct(12, VW) * p.intensity + 20} ry={pct(8, VH) * p.intensity + 14}
          fill={`url(#cg${i})`}
          style={{ opacity: activeTypes.has(p.type) ? 1 : 0, transition: "opacity 0.4s" }}
        />
      ))}

      {/* ── CRIME MARKERS (non-heat layers) ── */}
      {activeLayer !== "heat" && visible.map((p, i) => (
        <g key={i} filter="url(#phosphor)">
          <circle cx={pct(p.x, VW)} cy={pct(p.y, VH)} r={4}
            fill={G.danger} opacity={0.85} />
          <circle cx={pct(p.x, VW)} cy={pct(p.y, VH)} r={7}
            fill="none" stroke={G.danger} strokeWidth={0.8} opacity={0.4} />
          <circle cx={pct(p.x, VW)} cy={pct(p.y, VH)} r={10 + (tick % 3) * 2}
            fill="none" stroke={G.danger} strokeWidth={0.4}
            opacity={Math.max(0, 0.3 - (tick % 3) * 0.1)} />
        </g>
      ))}

      {/* ── SAFE POINTS LAYER ── */}
      {activeLayer === "safe" && SAFE_POINTS.map((sp, i) => {
        const cx = pct(sp.x, VW); const cy = pct(sp.y, VH);
        const c = safeColor(sp.kind);
        return (
          <g key={i} filter="url(#phosphor)">
            {/* crosshair */}
            <line x1={cx - 9} y1={cy} x2={cx + 9} y2={cy} stroke={c} strokeWidth={1} opacity={0.9} />
            <line x1={cx} y1={cy - 9} x2={cx} y2={cy + 9} stroke={c} strokeWidth={1} opacity={0.9} />
            <circle cx={cx} cy={cy} r={5} fill={`${c}22`} stroke={c} strokeWidth={1} />
            <circle cx={cx} cy={cy} r={12} fill="none" stroke={c} strokeWidth={0.5} opacity={0.4} />
            <text x={cx + 14} y={cy + 4} fill={c} fontSize={6}
              fontFamily="JetBrains Mono, monospace" opacity={0.8}>{sp.label}</text>
          </g>
        );
      })}

      {/* ── TRANSPORT LAYER ── */}
      {activeLayer === "bus" && METRO_POINTS.map((m, i) => {
        const cx = pct(m.x, VW); const cy = pct(m.y, VH);
        return (
          <g key={i} filter="url(#phosphor)">
            <circle cx={cx} cy={cy} r={8} fill={`${G.blue}22`} stroke={G.blue} strokeWidth={1.2} />
            <circle cx={cx} cy={cy} r={14} fill="none" stroke={G.blue} strokeWidth={0.5} opacity={0.4}
              strokeDasharray="3 2" />
            <text x={cx} y={cy + 3} fill={G.blue} fontSize={6}
              fontFamily="JetBrains Mono, monospace" textAnchor="middle">M</text>
            <text x={cx + 16} y={cy + 4} fill={G.blue} fontSize={6}
              fontFamily="JetBrains Mono, monospace">{m.label}</text>
          </g>
        );
      })}

      {/* ── RADAR RINGS (always visible) ── */}
      {[40, 80, 130].map((r, i) => (
        <circle key={i} cx={VW * 0.5} cy={VH * 0.42}
          r={r} fill="none" stroke={G.faint} strokeWidth={0.5}
          strokeDasharray="3 4" opacity={0.5} />
      ))}
      {/* crosshair center */}
      <line x1={VW * 0.5 - 16} y1={VH * 0.42} x2={VW * 0.5 + 16} y2={VH * 0.42}
        stroke={G.dim} strokeWidth={0.6} opacity={0.5} />
      <line x1={VW * 0.5} y1={VH * 0.42 - 16} x2={VW * 0.5} y2={VH * 0.42 + 16}
        stroke={G.dim} strokeWidth={0.6} opacity={0.5} />

      {/* current location pulse */}
      <g filter="url(#glow2)">
        <circle cx={VW * 0.5} cy={VH * 0.42} r={5} fill={G.bright} opacity={0.95} />
        <circle cx={VW * 0.5} cy={VH * 0.42} r={9 + (tick % 4) * 3}
          fill="none" stroke={G.bright} strokeWidth={0.8}
          opacity={Math.max(0, 0.5 - (tick % 4) * 0.12)} />
      </g>

      {/* coordinate readout */}
      <text x={6} y={VH - 6} fill={G.dim} fontSize={7}
        fontFamily="JetBrains Mono, monospace">
        {"-23.5505°S  -46.6333°W"}
      </text>
      <text x={VW - 6} y={VH - 6} fill={G.dim} fontSize={7}
        fontFamily="JetBrains Mono, monospace" textAnchor="end">
        {"ZONA: SÉ • NVL 4"}
      </text>

      {/* scanline overlay */}
      <rect width={VW} height={VH} fill="url(#scan)" />
      {/* vignette */}
      <rect width={VW} height={VH} fill="url(#vig)" />
    </svg>
  );
}

// ── COMPONENT: Risk bar ──────────────────────────────────────────────────────
function RiskBar({ label, pct: p, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs shrink-0" style={{ color: G.dim, fontFamily: "JetBrains Mono, monospace" }}>
        {label}
      </span>
      <div className="flex-1 h-1 rounded-none" style={{ background: G.faint }}>
        <div className="h-full transition-all duration-700" style={{ width: `${p}%`, background: color, boxShadow: `0 0 4px ${color}` }} />
      </div>
      <span className="text-xs w-8 text-right" style={{ color, fontFamily: "JetBrains Mono, monospace" }}>{p}%</span>
    </div>
  );
}

// ── COMPONENT: Top bar ──────────────────────────────────────────────────────
function TopBar({ onFilterOpen }: { onFilterOpen: () => void }) {
  const time = useTime();
  const fmt = (d: Date) => d.toTimeString().slice(0, 8);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 shrink-0 relative z-20 border-b"
      style={{
        background: `linear-gradient(90deg, ${G.bg} 0%, #011003 50%, ${G.bg} 100%)`,
        borderColor: G.border,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* app name */}
      <div className="flex items-center gap-1.5">
        <Eye size={11} style={{ color: G.bright }} />
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: G.bright, textShadow: crtGlow() }}>
          VIGIL
        </span>
        <span className="text-xs" style={{ color: G.dim }}>_OS</span>
      </div>

      {/* location */}
      <div
        className="flex-1 flex items-center gap-1.5 px-2 py-0.5 mx-1 border"
        style={{ borderColor: G.border, background: "rgba(0,255,65,0.04)" }}
      >
        <Navigation size={9} style={{ color: G.mid }} />
        <span className="text-xs truncate" style={{ color: G.mid }}>SÃO PAULO — CENTRO</span>
        <Cursor />
      </div>

      {/* time */}
      <span className="text-xs shrink-0" style={{ color: G.dim }}>{fmt(time)}</span>

      {/* filter */}
      <button
        onClick={onFilterOpen}
        className="flex items-center gap-1 px-2 py-1 border ml-1"
        style={{ borderColor: G.border, background: "rgba(0,255,65,0.06)", color: G.mid }}
      >
        <Filter size={10} />
        <span className="text-xs">FILTROS</span>
      </button>
    </div>
  );
}

// ── COMPONENT: Quick bar ─────────────────────────────────────────────────────
const QUICK = [
  { id: "heat", label: "HEAT",  Icon: Activity   },
  { id: "safe", label: "SAFE",  Icon: Shield     },
  { id: "luz",  label: "LUZ",   Icon: Lightbulb  },
  { id: "bus",  label: "BUS",   Icon: Bus        },
] as const;

function QuickBar({
  active, onChange,
}: { active: Set<string>; onChange: (v: string) => void; }) {
  return (
    <div
      className="absolute left-1/2 z-20 flex border"
      style={{
        bottom: "60px",
        transform: "translateX(-50%)",
        background: "rgba(0,9,0,0.92)",
        borderColor: G.border,
        backdropFilter: "blur(8px)",
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: `0 0 20px rgba(0,255,65,0.08)`,
      }}
    >
      {QUICK.map(q => {
        const on = active.has(q.id);
        return (
          <button
            key={q.id}
            onClick={() => onChange(q.id)}
            className="flex flex-col items-center gap-0.5 px-4 py-2 transition-all duration-150 border-r last:border-r-0"
            style={{
              borderColor: G.border,
              background:   on ? `${G.bright}14` : "transparent",
              color:        on ? G.bright         : G.dim,
              boxShadow:    on ? `inset 0 0 12px ${G.bright}10` : "none",
            }}
          >
            <q.Icon size={13} style={{ filter: on ? `drop-shadow(0 0 4px ${G.bright})` : "none" }} />
            <span className="text-xs" style={{ fontSize: 9, letterSpacing: "0.1em" }}>{q.label}</span>
            {on && <div className="w-full h-0.5" style={{ background: G.bright, boxShadow: crtGlow() }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── COMPONENT: Bottom nav ────────────────────────────────────────────────────
const TABS = [
  { id: "mapa",    label: "MAPA",    Icon: MapPin    },
  { id: "pontos",  label: "PONTOS",  Icon: Shield    },
  { id: "stats",   label: "STATS",   Icon: BarChart3 },
] as const;

function BottomNav({
  active, onChange,
}: { active: string; onChange: (v: string) => void; }) {
  return (
    <div
      className="flex border-t shrink-0"
      style={{
        borderColor: G.border,
        background: G.bg,
        fontFamily: "'JetBrains Mono', monospace",
        height: "52px",
      }}
    >
      {TABS.map(tab => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-150"
            style={{
              color:     on ? G.bright : G.dim,
              background: on ? `${G.bright}08` : "transparent",
              borderTop: on ? `1px solid ${G.bright}` : "1px solid transparent",
            }}
          >
            <tab.Icon size={14} style={{ filter: on ? `drop-shadow(0 0 4px ${G.bright})` : "none" }} />
            <span style={{ fontSize: 9, letterSpacing: "0.12em" }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── COMPONENT: Filter Sheet ──────────────────────────────────────────────────
function FilterSheet({
  open, onClose,
  activeTypes, setActiveTypes,
  activeTimes, setActiveTimes,
  activeGroups, setActiveGroups,
}: {
  open: boolean; onClose: () => void;
  activeTypes: Set<string>; setActiveTypes: (s: Set<string>) => void;
  activeTimes: Set<string>; setActiveTimes: (s: Set<string>) => void;
  activeGroups: Set<string>; setActiveGroups: (s: Set<string>) => void;
}) {
  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setter(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="absolute inset-0 z-30"
            style={{ background: "rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-40 border-t"
            style={{
              background: "#010e02",
              borderColor: G.border,
              fontFamily: "'JetBrains Mono', monospace",
              maxHeight: "75%",
              overflowY: "auto",
            }}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
          >
            {/* drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-0.5 rounded-full" style={{ background: G.dim }} />
            </div>

            <div className="flex items-center justify-between px-4 pb-3 border-b" style={{ borderColor: G.border }}>
              <div className="flex items-center gap-2">
                <Filter size={11} style={{ color: G.bright }} />
                <span className="text-xs tracking-widest" style={{ color: G.bright, textShadow: crtGlow() }}>
                  FILTROS DE CAMADA
                </span>
              </div>
              <button onClick={onClose} style={{ color: G.dim }}>
                <X size={14} />
              </button>
            </div>

            <div className="px-4 py-3 flex flex-col gap-4">
              {/* crime type */}
              <div>
                <div className="text-xs mb-2 flex items-center gap-1" style={{ color: G.dim }}>
                  <AlertTriangle size={9} /> TIPO DE CRIME
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CRIME_TYPES.map(t => (
                    <Chip key={t} label={t} color={G.danger}
                      active={activeTypes.has(t)}
                      onToggle={() => toggle(activeTypes, t, setActiveTypes)} />
                  ))}
                </div>
              </div>

              {/* time */}
              <div>
                <div className="text-xs mb-2 flex items-center gap-1" style={{ color: G.dim }}>
                  <Clock size={9} /> PERÍODO
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TIME_SLOTS.map(t => (
                    <Chip key={t} label={t} color={G.warn}
                      active={activeTimes.has(t)}
                      onToggle={() => toggle(activeTimes, t, setActiveTimes)} />
                  ))}
                </div>
              </div>

              {/* groups */}
              <div>
                <div className="text-xs mb-2 flex items-center gap-1" style={{ color: G.dim }}>
                  <Users size={9} /> GRUPO DE RISCO
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GROUPS.map(g => (
                    <Chip key={g} label={g} color={G.mid}
                      active={activeGroups.has(g)}
                      onToggle={() => toggle(activeGroups, g, setActiveGroups)} />
                  ))}
                </div>
              </div>

              {/* group risk bars */}
              {activeGroups.size > 0 && (
                <div className="border-t pt-3" style={{ borderColor: G.border }}>
                  <div className="text-xs mb-2" style={{ color: G.dim }}>ÍNDICE DE RISCO POR GRUPO</div>
                  <div className="flex flex-col gap-2">
                    {activeGroups.has("mulheres")  && <RiskBar label="MULHERES"  pct={78} color={G.danger} />}
                    {activeGroups.has("ciclistas") && <RiskBar label="CICLISTAS" pct={62} color={G.warn} />}
                    {activeGroups.has("idosos")    && <RiskBar label="IDOSOS"    pct={70} color={G.danger} />}
                    {activeGroups.has("PCD")       && <RiskBar label="PCD"       pct={55} color={G.warn} />}
                    {activeGroups.has("turistas")  && <RiskBar label="TURISTAS"  pct={82} color={G.danger} />}
                    {activeGroups.has("motoristas")&& <RiskBar label="MOTORIST." pct={40} color={G.mid} />}
                  </div>
                </div>
              )}

              {/* save and send button */}
              <div className="mt-2 pt-4 border-t flex justify-end" style={{ borderColor: G.border }}>
                <button
                  onClick={() => {
                    const payload = { types: Array.from(activeTypes), times: Array.from(activeTimes), groups: Array.from(activeGroups) };
                    // Dummy request simulating sending to python backend
                    fetch('/api/save-filters', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
                    onClose();
                  }}
                  className="px-4 py-2 text-xs flex items-center gap-2 transition-all duration-150 hover:opacity-80"
                  style={{
                    background: G.bright,
                    color: G.bg,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: "bold",
                    boxShadow: `0 0 10px ${G.bright}60`,
                  }}
                >
                  <AlertTriangle size={12} style={{ strokeWidth: 3 }} />
                  ENVIAR PARA O SISTEMA
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── COMPONENT: Safe Points view ─────────────────────────────────────────────
function SafePointsView({ 
  safePointsList, 
  blockedSafePoints, 
  toggleBlock,
  addCustomSafePoint,
  addCustomRiskArea
}: any) {
  const [newPointName, setNewPointName] = useState("");
  const [newPointType, setNewPointType] = useState("del");
  const [newPointLat, setNewPointLat] = useState(SP_CENTER[0].toString());
  const [newPointLng, setNewPointLng] = useState(SP_CENTER[1].toString());

  const [newRiskName, setNewRiskName] = useState("");
  const [newRiskLat, setNewRiskLat] = useState(SP_CENTER[0].toString());
  const [newRiskLng, setNewRiskLng] = useState(SP_CENTER[1].toString());

  const kindIcon = (k: string) => {
    if (k === "del" || k === "delegacia")  return <Shield size={13} style={{ color: G.bright }} />;
    if (k === "hosp" || k === "hospital") return <Cross size={13} style={{ color: G.blue }} />;
    if (k === "farm" || k === "farmacia") return <Pill size={13} style={{ color: G.mid }} />;
    return <ShoppingCart size={13} style={{ color: G.warn }} />;
  };
  const kindLabel = (k: string) => ({
    del: "DELEGACIA", delegacia: "DELEGACIA", 
    hosp: "HOSPITAL", hospital: "HOSPITAL", 
    farm: "FARMÁCIA", farmacia: "FARMÁCIA", 
    merc: "MERCADO", mercado: "MERCADO"
  }[k] ?? k);
  const kindColor = (k: string) => ({
    del: G.bright, delegacia: G.bright,
    hosp: G.blue, hospital: G.blue,
    farm: G.mid, farmacia: G.mid,
    merc: G.warn, mercado: G.warn
  }[k] ?? G.dim);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: G.bg }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: G.border }}>
        <div className="flex items-center gap-2">
          <Shield size={12} style={{ color: G.bright, filter: `drop-shadow(0 0 4px ${G.bright})` }} />
          <span className="text-xs tracking-widest" style={{ color: G.bright, fontFamily: "'JetBrains Mono',monospace", textShadow: "0 0 8px rgba(0,255,65,0.4)" }}>
            PONTOS SEGUROS 24H
          </span>
        </div>
        <div className="text-xs mt-1" style={{ color: G.dim, fontFamily: "'JetBrains Mono',monospace" }}>
          {safePointsList.length} LOCAIS ATIVOS
        </div>
      </div>

      <div className="flex flex-col divide-y" style={{ divideColor: G.border }}>
        {safePointsList.map((sp: any, i: number) => {
          const isBlocked = blockedSafePoints.has(sp.name);
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${isBlocked ? 'opacity-40' : ''}`}
              style={{ fontFamily: "'JetBrains Mono',monospace" }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center border shrink-0"
                style={{ borderColor: `${kindColor(sp.type)}40`, background: `${kindColor(sp.type)}0c` }}
              >
                {kindIcon(sp.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: isBlocked ? G.dim : kindColor(sp.type), textDecoration: isBlocked ? 'line-through' : 'none' }}>
                  {sp.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: G.dim }}>
                  {kindLabel(sp.type)} · {sp.distance.toFixed(2)}KM
                </div>
              </div>
              <button
                onClick={() => toggleBlock(sp.name)}
                className="text-xs px-2 py-1 border shrink-0 hover:bg-white/10 transition-colors"
                style={{ borderColor: isBlocked ? G.dim : G.warn, color: isBlocked ? G.dim : G.warn, fontSize: 9 }}
              >
                {isBlocked ? "DESBLOQUEAR" : "BLOQUEAR"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Forms */}
      <div className="p-4 border-t space-y-4" style={{ borderColor: G.border }}>
        <div>
          <div className="text-[10px] mb-2 font-bold" style={{ color: G.bright, fontFamily: "'JetBrains Mono',monospace" }}>+ ADICIONAR PONTO SEGURO</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="text" placeholder="Nome" value={newPointName} onChange={e => setNewPointName(e.target.value)} className="bg-black/50 border px-2 py-1 text-[10px] w-full outline-none" style={{ borderColor: G.border, color: G.bright }} />
            <select value={newPointType} onChange={e => setNewPointType(e.target.value)} className="bg-black/50 border px-2 py-1 text-[10px] w-full outline-none" style={{ borderColor: G.border, color: G.bright }}>
              <option value="del">Delegacia</option>
              <option value="hosp">Hospital</option>
              <option value="farm">Farmácia</option>
              <option value="merc">Mercado</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="text" placeholder="Lat" value={newPointLat} onChange={e => setNewPointLat(e.target.value)} className="bg-black/50 border px-2 py-1 text-[10px] w-full outline-none" style={{ borderColor: G.border, color: G.bright }} />
            <input type="text" placeholder="Lng" value={newPointLng} onChange={e => setNewPointLng(e.target.value)} className="bg-black/50 border px-2 py-1 text-[10px] w-full outline-none" style={{ borderColor: G.border, color: G.bright }} />
          </div>
          <button 
            onClick={() => {
              if (newPointName) addCustomSafePoint({ name: newPointName, type: newPointType, lat: parseFloat(newPointLat), lng: parseFloat(newPointLng), open24h: true });
            }}
            className="w-full border py-1 text-[10px] font-bold hover:bg-white/10 transition-colors" style={{ borderColor: G.bright, color: G.bright }}>
            CADASTRAR PONTO SEGURO
          </button>
        </div>
        
        <div className="pt-4 border-t" style={{ borderColor: G.border }}>
          <div className="text-[10px] mb-2 font-bold" style={{ color: G.warn, fontFamily: "'JetBrains Mono',monospace" }}>+ ADICIONAR ÁREA DE RISCO</div>
          <div className="mb-2">
            <input type="text" placeholder="Descrição (ex: Rua escura)" value={newRiskName} onChange={e => setNewRiskName(e.target.value)} className="bg-black/50 border px-2 py-1 text-[10px] w-full outline-none" style={{ borderColor: G.border, color: G.warn }} />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="text" placeholder="Lat" value={newRiskLat} onChange={e => setNewRiskLat(e.target.value)} className="bg-black/50 border px-2 py-1 text-[10px] w-full outline-none" style={{ borderColor: G.border, color: G.warn }} />
            <input type="text" placeholder="Lng" value={newRiskLng} onChange={e => setNewRiskLng(e.target.value)} className="bg-black/50 border px-2 py-1 text-[10px] w-full outline-none" style={{ borderColor: G.border, color: G.warn }} />
          </div>
          <button 
            onClick={() => {
              if (newRiskName) addCustomRiskArea({ name: newRiskName, lat: parseFloat(newRiskLat), lng: parseFloat(newRiskLng) });
            }}
            className="w-full border py-1 text-[10px] font-bold hover:bg-white/10 transition-colors" style={{ borderColor: G.warn, color: G.warn }}>
            CADASTRAR ÁREA DE RISCO
          </button>
        </div>
      </div>

      {/* legend */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2 border-t" style={{ borderColor: G.border }}>
        {[
          { color: G.bright, label: "DELEGACIA" },
          { color: G.blue,   label: "HOSPITAL" },
          { color: G.mid,    label: "FARMÁCIA" },
          { color: G.warn,   label: "MERCADO" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 4px ${l.color}` }} />
            <span style={{ color: G.dim, fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── COMPONENT: Stats view ────────────────────────────────────────────────────
function StatsView() {
  const tick = useTick(2500);
  const total = useLive(1247, 30);

  const crimeData = [
    { type: "ROUBO",     count: 482, pct: 82 },
    { type: "FURTO",     count: 341, pct: 58 },
    { type: "ASSALTO",   count: 218, pct: 37 },
    { type: "TRÁFICO",   count: 145, pct: 25 },
    { type: "VIOLÊNCIA", count: 61,  pct: 10 },
  ];

  const hourData = [
    2, 1, 1, 1, 2, 3, 4, 5, 7, 8, 7, 6,
    6, 7, 8, 9, 10, 12, 14, 13, 11, 8, 5, 3
  ];
  const maxH = Math.max(...hourData);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: G.bg }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: G.border, fontFamily: "'JetBrains Mono',monospace" }}>
        <div className="flex items-center gap-2">
          <BarChart3 size={12} style={{ color: G.bright }} />
          <span className="text-xs tracking-widest" style={{ color: G.bright, textShadow: crtGlow() }}>
            ESTATÍSTICAS — ZONA SÉ
          </span>
        </div>
        <div className="flex gap-4 mt-2">
          <div>
            <div className="text-xs" style={{ color: G.dim }}>OCORRÊNCIAS/MÊS</div>
            <div className="text-xl font-bold" style={{ color: G.bright, textShadow: crtGlow() }}>{Math.round(total)}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: G.dim }}>ÍNDICE RISCO</div>
            <div className="text-xl font-bold" style={{ color: G.danger }}>ALTO</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: G.dim }}>VARIAÇÃO</div>
            <div className="text-xl font-bold flex items-center" style={{ color: G.warn }}>
              <TrendingUp size={16} />+8%
            </div>
          </div>
        </div>
      </div>

      {/* crime breakdown */}
      <div className="px-4 py-3 border-b" style={{ borderColor: G.border }}>
        <div className="text-xs mb-3" style={{ color: G.dim, fontFamily: "'JetBrains Mono',monospace" }}>
          POR TIPO DE CRIME
        </div>
        <div className="flex flex-col gap-2.5">
          {crimeData.map(d => (
            <div key={d.type} className="flex items-center gap-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              <span className="text-xs w-20 shrink-0" style={{ color: G.dim }}>{d.type}</span>
              <div className="flex-1 h-1.5" style={{ background: G.faint }}>
                <div
                  className="h-full"
                  style={{ width: `${d.pct}%`, background: G.danger, boxShadow: `0 0 6px ${G.danger}60`, transition: "width 1s" }}
                />
              </div>
              <span className="text-xs w-8 text-right" style={{ color: G.danger }}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* hourly chart */}
      <div className="px-4 py-3 border-b" style={{ borderColor: G.border }}>
        <div className="text-xs mb-3" style={{ color: G.dim, fontFamily: "'JetBrains Mono',monospace" }}>
          INCIDÊNCIA POR HORA
        </div>
        <div className="flex items-end gap-0.5 h-16">
          {hourData.map((v, i) => {
            const h = (v / maxH) * 100;
            const isNight = i >= 20 || i < 6;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full transition-all duration-500"
                  style={{
                    height: `${h}%`,
                    background: isNight ? G.danger : v > 9 ? G.warn : G.dim,
                    boxShadow: isNight ? `0 0 3px ${G.danger}` : "none",
                    opacity: 0.85,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {["00","06","12","18","23"].map(h => (
            <span key={h} style={{ color: G.dim, fontFamily: "'JetBrains Mono',monospace", fontSize: 8 }}>{h}h</span>
          ))}
        </div>
      </div>

      {/* group risk matrix */}
      <div className="px-4 py-3">
        <div className="text-xs mb-3" style={{ color: G.dim, fontFamily: "'JetBrains Mono',monospace" }}>
          RISCO POR GRUPO — NOITE
        </div>
        <div className="flex flex-col gap-2">
          {[
            { g: "MULHERES",   r: 92, c: G.danger },
            { g: "TURISTAS",   r: 85, c: G.danger },
            { g: "IDOSOS",     r: 74, c: G.warn   },
            { g: "CICLISTAS",  r: 68, c: G.warn   },
            { g: "PCD",        r: 58, c: G.warn   },
            { g: "MOTORISTAS", r: 35, c: G.mid    },
          ].map(({ g, r, c }) => <RiskBar key={g} label={g} pct={r} color={c} />)}
        </div>
      </div>
    </div>
  );
}

// ── COMPONENT: Map view ──────────────────────────────────────────────────────
import { RealMap } from "./components/RealMap";

function MapView({
  activeTypes, activeLayers, setActiveLayers, activeGroups, activeTimes,
  blockedSafePoints, customSafePoints, customRiskAreas
}: {
  activeTypes: Set<string>; activeLayers: Set<string>;
  setActiveLayers: (v: Set<string>) => void; activeGroups: Set<string>;
  activeTimes: Set<string>;
  blockedSafePoints: Set<string>; customSafePoints: any[]; customRiskAreas: any[];
}) {
  const incidents = useLive(14, 4);

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* real map */}
      <RealMap 
        activeTypes={activeTypes} 
        activeLayers={activeLayers} 
        activeGroups={activeGroups} 
        activeTimes={activeTimes} 
        blockedSafePoints={blockedSafePoints}
        customSafePoints={customSafePoints}
        customRiskAreas={customRiskAreas}
      />
      <Scanlines />

      {/* HUD corners */}
      <HudCorners size={18} />

      {/* top-left HUD info */}
      <div
        className="absolute top-2 left-2 z-10 text-xs px-2 py-1 border"
        style={{
          background: "rgba(0,9,0,0.85)",
          borderColor: G.border,
          fontFamily: "'JetBrains Mono',monospace",
          backdropFilter: "blur(4px)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: G.danger, boxShadow: `0 0 4px ${G.danger}`, animation: "blink 1.4s ease infinite" }} />
          <span style={{ color: G.danger }}>{Math.round(incidents)} OCORR/H</span>
        </div>
        <div className="mt-0.5" style={{ color: G.dim }}>RISCO: ALTO</div>
      </div>

      {/* top-right active layer badge */}
      <div
        className="absolute top-2 right-2 z-10 text-xs px-2 py-1 border"
        style={{
          background: "rgba(0,9,0,0.85)",
          borderColor: G.border,
          fontFamily: "'JetBrains Mono',monospace",
          backdropFilter: "blur(4px)",
          color: G.mid,
        }}
      >
        <div className="flex items-center gap-1">
          <Layers size={9} style={{ color: G.mid }} />
          {Array.from(activeLayers).map(l => l.toUpperCase()).join(", ")}
        </div>
      </div>

      {/* quick toggles (bottom center) */}
      <QuickBar
        active={activeLayers}
        onChange={(id) => {
          const next = new Set(activeLayers);
          if (next.has(id)) next.delete(id); else next.add(id);
          setActiveLayers(next);
        }}
      />
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,          setTab]          = useState<"mapa" | "pontos" | "stats">("mapa");

  // User-managed state
  const [blockedSafePoints, setBlockedSafePoints] = useState<Set<string>>(new Set());
  const [customSafePoints, setCustomSafePoints] = useState<any[]>([]);
  const [customRiskAreas, setCustomRiskAreas] = useState<any[]>([]);

  const toggleBlock = (name: string) => {
    setBlockedSafePoints(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addCustomSafePoint = (sp: any) => setCustomSafePoints(p => [...p, sp]);
  const addCustomRiskArea = (ra: any) => setCustomRiskAreas(p => [...p, ra]);

  // Combined safe points
  const combinedSafePoints = useMemo(() => {
    const list = [...realSafePoints, ...customSafePoints];
    return list.map(sp => ({
      ...sp,
      distance: getDistance(SP_CENTER[0], SP_CENTER[1], sp.lat, sp.lng)
    })).sort((a, b) => a.distance - b.distance);
  }, [customSafePoints]);
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [activeTypes,  setActiveTypes]  = useState<Set<string>>(new Set(CRIME_TYPES));
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(["heat", "safe", "luz", "bus"]));
  const [activeTimes,  setActiveTimes]  = useState<Set<string>>(new Set(["noite", "madrugada"]));
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set());

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        * { box-sizing: border-box; }
        body { background: #000900; overflow: hidden; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${G.faint}; }
      `}</style>

      <div
        className="size-full flex flex-col overflow-hidden relative"
        style={{ background: G.bg, fontFamily: "'JetBrains Mono', monospace", maxWidth: "430px", margin: "0 auto" }}
      >
        <TopBar onFilterOpen={() => setFilterOpen(true)} />

        {/* main content */}
        {tab === "mapa" && (
          <MapView
            activeTypes={activeTypes}
            activeLayers={activeLayers}
            setActiveLayers={setActiveLayers}
            activeGroups={activeGroups}
            activeTimes={activeTimes}
            blockedSafePoints={blockedSafePoints}
            customSafePoints={customSafePoints}
            customRiskAreas={customRiskAreas}
          />
        )}
        {tab === "pontos" && <SafePointsView 
          safePointsList={combinedSafePoints} 
          blockedSafePoints={blockedSafePoints} 
          toggleBlock={toggleBlock}
          addCustomSafePoint={addCustomSafePoint}
          addCustomRiskArea={addCustomRiskArea}
        />}
        {tab === "stats"  && <StatsView />}

        <BottomNav active={tab} onChange={v => setTab(v as typeof tab)} />

        {/* filter bottom sheet */}
        <FilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          activeTypes={activeTypes} setActiveTypes={setActiveTypes}
          activeTimes={activeTimes} setActiveTimes={setActiveTimes}
          activeGroups={activeGroups} setActiveGroups={setActiveGroups}
        />
      </div>
    </>
  );
}
