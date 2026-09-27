// ═══════════════════════════════════════════════════
// SAIFEN — Escala de risco do heatmap
//
// O heatmap do pipeline (KDE) emite pesos já normalizados em [0,1], mas a
// distribuição é fortemente assimétrica à direita: numa amostra real de
// 2026, p50 = 0.147, p70 = 0.369, p90 = 0.843, e 60% dos pontos ficam
// abaixo de 0.2.
//
// Mapear 0→1 linearmente desperdiça quase toda a paleta na cauda baixa,
// que some de vez. Por isso as faixas de risco são cortadas nos QUANTIS
// da distribuição de cada fatia, e não em valores fixos: cada faixa passa
// a representar uma fatia constante dos pontos, e os cortes adapts a cada
// combinação tipo × período.
// ═══════════════════════════════════════════════════

// Fatias da distribuição que viram faixas nomeadas.
const BANDS = [
  { id: "baixo",   label: "BAIXO",   from: 0.00, to: 0.70, color: [255, 203, 0] },
  { id: "medio",   label: "MÉDIO",   from: 0.70, to: 0.90, color: [255, 176, 0] },
  { id: "alto",    label: "ALTO",    from: 0.90, to: 0.97, color: [255, 122, 26] },
  { id: "critico", label: "CRÍTICO", from: 0.97, to: 1.00, color: [255, 60, 0] },
];

// O leaflet.heat COMPOSTA a opacidade de cada ponto: várias manchas de alpha
// baixo somam e fazem uma zona de baixo risco parecer alta. Por isso a curva
// é íngreme de propósito — o grosseiro fica praticamente invisível e só as
// faixas de cima ganham corpo, que é o que separa "perigoso" de "não tanto".
const alphaFor = (t) => {
  if (t <= 0) return 0;
  const s = t * t * t;              // curva cúbica
  return Math.min(0.86, 0.90 * s);  // teto abaixo de 1 para não estourar
};

/** Quantil por interpolação linear sobre um array já ordenado. */
function quantile(sorted, f) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * f;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Calcula cortes e paleta a partir dos pontos de uma fatia.
 *
 * @param {Array<[number,number,number]>} points  [lat, lng, weight]
 * @param {number} intensityMax  teto de intensidade do leaflet.heat. Como o
 *   plugin compara a SOMA dos pesos de um bucket contra `max` (e os pesos se
 *   sobrepõem), o teto não é 1.0: 1.0 satura quase tudo em vermelho. Os stops
 *   do gradiente são multiplicados por ele para continuarem alinhados aos
 *   quantis da distribuição.
 * @returns {{cuts:object, gradient:object, bands:Array, stats:object}|null}
 */
export function computeRiskScale(points, intensityMax = 1) {
  if (!Array.isArray(points) || points.length === 0) return null;

  const weights = [];
  for (const p of points) {
    const w = p[2];
    if (typeof w === "number" && Number.isFinite(w)) weights.push(w);
  }
  if (weights.length === 0) return null;

  weights.sort((a, b) => a - b);
  const n = weights.length;

  const cuts = {
    p50: quantile(weights, 0.50),
    p70: quantile(weights, 0.70),
    p80: quantile(weights, 0.80),
    p90: quantile(weights, 0.90),
    p95: quantile(weights, 0.95),
    p97: quantile(weights, 0.97),
    p99: quantile(weights, 0.99),
    min: weights[0],
    max: weights[n - 1],
  };

  // Gradiente do leaflet.heat. As chaves são posições 0..1 e, como os pesos
  // já vêm normalizados e `max` é 1, a posição equivale ao próprio peso. Os
  // stops são colocados nos CORTES, então a cor muda de faixa na proporção
  // certa em vez de no meio da cauda vazia.
  const gradient = {};
  const put = (pos, band, t) => {
    const [r, g, b] = band.color;
    const key = Math.max(0, Math.min(1, pos * intensityMax)).toFixed(4);
    gradient[key] = `rgba(${r}, ${g}, ${b}, ${alphaFor(t).toFixed(3)})`;
  };

  put(0, BANDS[0], 0);
  put(cuts.p70, BANDS[0], 0.05);
  put(cuts.p80, BANDS[1], 0.22);
  put(cuts.p90, BANDS[2], 0.50);
  put(cuts.p95, BANDS[2], 0.66);
  put(cuts.p97, BANDS[3], 0.80);
  put(Math.max(cuts.p99, cuts.p97), BANDS[3], 0.90);
  put(1, BANDS[3], 1);

  const bands = BANDS.map((b, i) => {
    const lo = i === 0 ? cuts.min : [cuts.p70, cuts.p90, cuts.p97][i - 1];
    const hi = [cuts.p70, cuts.p90, cuts.p97, 1][i];
    const [r, g, bl] = b.color;
    return {
      id: b.id,
      label: b.label,
      from: lo,
      to: hi,
      color: `rgb(${r}, ${g}, ${bl})`,
      share: b.to - b.from,
    };
  });

  return {
    cuts,
    gradient,
    bands,
    stats: {
      count: n,
      min: cuts.min,
      max: cuts.max,
      p50: cuts.p50,
      p90: cuts.p90,
    },
  };
}

/** Escala neutra, usada antes do primeiro carregamento terminar. */
export function fallbackScale() {
  const gradient = {};
  const put = (pos, band, t) => {
    const [r, g, b] = band.color;
    gradient[pos.toFixed(4)] = `rgba(${r}, ${g}, ${b}, ${alphaFor(t).toFixed(3)})`;
  };
  put(0, BANDS[0], 0);
  put(0.7, BANDS[1], 0.3);
  put(0.9, BANDS[2], 0.58);
  put(1, BANDS[3], 0.94);
  return {
    cuts: { p70: 0.7, p90: 0.9, p97: 0.97, p50: 0.5, min: 0, max: 1 },
    gradient,
    bands: BANDS.map((b, i) => {
      const lo = i === 0 ? 0 : [0.7, 0.9, 0.97][i - 1];
      const hi = [0.7, 0.9, 0.97, 1][i];
      const [r, g, bl] = b.color;
      return { id: b.id, label: b.label, from: lo, to: hi, color: `rgb(${r}, ${g}, ${bl})`, share: b.to - b.from };
    }),
    stats: { count: 0, min: 0, max: 1, p50: 0.5, p90: 0.9 },
  };
}
