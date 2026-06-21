// ═══════════════════════════════════════════════════
// SAIFEN — Mock Data — Centro de São Paulo
// ═══════════════════════════════════════════════════

export const SP_CENTER = [-23.5505, -46.6333];
export const DEFAULT_ZOOM = 14;

// ── Constantes de domínio ──
export const crimeTypes = [
    { id: 'furto',    label: 'Furto' },
    { id: 'roubo',    label: 'Roubo' },
    { id: 'assalto',  label: 'Assalto a Pedestre' },
    { id: 'agressao', label: 'Agressão' },
    { id: 'trafico',  label: 'Tráfico' },
];

export const timeSlots = [
    { id: 'manha',    label: 'Manhã (06h–12h)' },
    { id: 'tarde',    label: 'Tarde (12h–18h)' },
    { id: 'noite',    label: 'Noite (18h–00h)' },
    { id: 'madrugada',label: 'Madrugada (00h–06h)' },
];

// ── Funções auxiliares ──
function scatter(centerLat, centerLng, radius, count, minI, maxI) {
    const pts = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const lat = centerLat + r * Math.cos(angle);
        const lng = centerLng + r * Math.sin(angle);
        const intensity = minI + Math.random() * (maxI - minI);
        pts.push([lat, lng, parseFloat(intensity.toFixed(2))]);
    }
    return pts;
}

function crime(lat, lng, type, time, intensity) {
    return { lat, lng, type, time, intensity };
}

// ════════════════════════════════════════════════════
// crimeHeatData — heatmap base (compatibilidade)
// ════════════════════════════════════════════════════
export const crimeHeatData = [
    // Cracolândia / Luz — zona crítica
    [-23.5335, -46.6368, 1.0], [-23.5342, -46.6355, 0.95], [-23.5350, -46.6380, 0.9],
    [-23.5338, -46.6392, 0.88], [-23.5345, -46.6340, 0.92], [-23.5330, -46.6375, 0.85],
    [-23.5360, -46.6370, 0.82], [-23.5328, -46.6350, 0.87], [-23.5355, -46.6395, 0.80],
    [-23.5365, -46.6360, 0.78], [-23.5320, -46.6365, 0.75], [-23.5348, -46.6410, 0.70],
    [-23.5372, -46.6385, 0.73], [-23.5318, -46.6345, 0.76], [-23.5340, -46.6420, 0.68],
    // Santa Ifigênia / Arouche — alta incidência
    [-23.5390, -46.6380, 0.85], [-23.5395, -46.6365, 0.82], [-23.5385, -46.6395, 0.80],
    [-23.5398, -46.6350, 0.78], [-23.5402, -46.6375, 0.75], [-23.5388, -46.6340, 0.72],
    // Praça da Sé — incidência média-alta
    [-23.5503, -46.6340, 0.75], [-23.5510, -46.6330, 0.72], [-23.5495, -46.6350, 0.70],
    [-23.5515, -46.6345, 0.68], [-23.5500, -46.6320, 0.65], [-23.5508, -46.6360, 0.63],
    [-23.5520, -46.6335, 0.60], [-23.5490, -46.6325, 0.62], [-23.5498, -46.6370, 0.58],
    // República — incidência média
    [-23.5432, -46.6425, 0.72], [-23.5440, -46.6435, 0.68], [-23.5425, -46.6415, 0.65],
    [-23.5438, -46.6445, 0.62], [-23.5445, -46.6420, 0.60], [-23.5420, -46.6440, 0.58],
    // Brás — incidência média
    [-23.5433, -46.6157, 0.78], [-23.5440, -46.6170, 0.72], [-23.5425, -46.6140, 0.70],
    [-23.5448, -46.6155, 0.68], [-23.5430, -46.6180, 0.65], [-23.5455, -46.6165, 0.62],
    [-23.5420, -46.6130, 0.60], [-23.5460, -46.6150, 0.58],
    // Pinheiros — baixa incidência
    [-23.5598, -46.6459, 0.55], [-23.5605, -46.6470, 0.50], [-23.5590, -46.6445, 0.48],
    [-23.5612, -46.6465, 0.45], [-23.5585, -46.6480, 0.42],
    // Liberdade — média
    [-23.5576, -46.6348, 0.50], [-23.5580, -46.6360, 0.48], [-23.5570, -46.6335, 0.45],
    [-23.5590, -46.6355, 0.42], [-23.5565, -46.6345, 0.40],
    // Av. Paulista — baixa
    [-23.5616, -46.6558, 0.20], [-23.5610, -46.6540, 0.18], [-23.5618, -46.6575, 0.22],
    [-23.5606, -46.6520, 0.15], [-23.5622, -46.6590, 0.20],
    // Dispersão
    ...scatter(-23.545, -46.650, 0.008, 18, 0.3, 0.6),
    ...scatter(-23.535, -46.625, 0.006, 14, 0.4, 0.7),
    ...scatter(-23.555, -46.640, 0.010, 16, 0.2, 0.5),
    ...scatter(-23.548, -46.615, 0.008, 10, 0.35, 0.55),
];

// ════════════════════════════════════════════════════
// crimesByType — crimes categorizados para filtros
// ════════════════════════════════════════════════════
export const crimesByType = [
    // ── FURTOS ──
    crime(-23.5503, -46.6340, 'furto', 'manha', 0.80),
    crime(-23.5510, -46.6330, 'furto', 'manha', 0.72),
    crime(-23.5432, -46.6425, 'furto', 'tarde', 0.68),
    crime(-23.5440, -46.6435, 'furto', 'tarde', 0.65),
    crime(-23.5616, -46.6558, 'furto', 'manha', 0.25),
    crime(-23.5568, -46.6622, 'furto', 'noite', 0.30),
    crime(-23.5498, -46.6370, 'furto', 'tarde', 0.58),
    crime(-23.5576, -46.6348, 'furto', 'noite', 0.48),
    crime(-23.5460, -46.6385, 'furto', 'tarde', 0.55),
    crime(-23.5433, -46.6157, 'furto', 'manha', 0.75),
    crime(-23.5440, -46.6170, 'furto', 'tarde', 0.70),
    crime(-23.5425, -46.6140, 'furto', 'manha', 0.68),
    crime(-23.5390, -46.6380, 'furto', 'noite', 0.60),
    crime(-23.5395, -46.6365, 'furto', 'noite', 0.58),
    crime(-23.5475, -46.6385, 'furto', 'tarde', 0.50),
    crime(-23.5520, -46.6335, 'furto', 'manha', 0.62),
    crime(-23.5445, -46.6420, 'furto', 'tarde', 0.55),
    crime(-23.5555, -46.6615, 'furto', 'noite', 0.35),
    crime(-23.5585, -46.6355, 'furto', 'tarde', 0.42),
    crime(-23.5598, -46.6459, 'furto', 'manha', 0.40),

    // ── ROUBOS ──
    crime(-23.5503, -46.6340, 'roubo', 'noite', 0.85),
    crime(-23.5335, -46.6368, 'roubo', 'madrugada', 0.95),
    crime(-23.5342, -46.6355, 'roubo', 'noite', 0.90),
    crime(-23.5340, -46.6420, 'roubo', 'madrugada', 0.82),
    crime(-23.5432, -46.6425, 'roubo', 'noite', 0.72),
    crime(-23.5440, -46.6445, 'roubo', 'noite', 0.68),
    crime(-23.5510, -46.6355, 'roubo', 'noite', 0.75),
    crime(-23.5362, -46.6330, 'roubo', 'madrugada', 0.88),
    crime(-23.5350, -46.6380, 'roubo', 'noite', 0.85),
    crime(-23.5338, -46.6392, 'roubo', 'madrugada', 0.78),
    crime(-23.5390, -46.6380, 'roubo', 'noite', 0.80),
    crime(-23.5398, -46.6350, 'roubo', 'madrugada', 0.75),
    crime(-23.5575, -46.6800, 'roubo', 'noite', 0.45),
    crime(-23.5460, -46.6150, 'roubo', 'tarde', 0.55),
    crime(-23.5448, -46.6155, 'roubo', 'noite', 0.62),

    // ── ASSALTOS ──
    crime(-23.5438, -46.6468, 'assalto', 'noite', 0.72),
    crime(-23.5440, -46.6445, 'assalto', 'noite', 0.68),
    crime(-23.5475, -46.6385, 'assalto', 'noite', 0.75),
    crime(-23.5335, -46.6368, 'assalto', 'madrugada', 0.95),
    crime(-23.5350, -46.6380, 'assalto', 'madrugada', 0.88),
    crime(-23.5433, -46.6157, 'assalto', 'tarde', 0.72),
    crime(-23.5490, -46.6320, 'assalto', 'noite', 0.65),
    crime(-23.5515, -46.6345, 'assalto', 'noite', 0.60),
    crime(-23.5402, -46.6375, 'assalto', 'noite', 0.70),
    crime(-23.5428, -46.6440, 'assalto', 'noite', 0.68),
    crime(-23.5365, -46.6360, 'assalto', 'madrugada', 0.78),
    crime(-23.5455, -46.6165, 'assalto', 'tarde', 0.58),

    // ── AGRESSÕES ──
    crime(-23.5335, -46.6368, 'agressao', 'madrugada', 0.85),
    crime(-23.5342, -46.6355, 'agressao', 'madrugada', 0.80),
    crime(-23.5438, -46.6468, 'agressao', 'noite', 0.60),
    crime(-23.5398, -46.6350, 'agressao', 'noite', 0.65),
    crime(-23.5348, -46.6410, 'agressao', 'madrugada', 0.70),
    crime(-23.5372, -46.6385, 'agressao', 'noite', 0.55),
    crime(-23.5480, -46.6330, 'agressao', 'madrugada', 0.60),
    crime(-23.5590, -46.6460, 'agressao', 'noite', 0.38),
    crime(-23.5385, -46.6395, 'agressao', 'noite', 0.68),

    // ── TRÁFICO ──
    crime(-23.5335, -46.6368, 'trafico', 'madrugada', 1.0),
    crime(-23.5342, -46.6355, 'trafico', 'madrugada', 0.95),
    crime(-23.5350, -46.6380, 'trafico', 'noite', 0.90),
    crime(-23.5330, -46.6375, 'trafico', 'madrugada', 0.88),
    crime(-23.5360, -46.6370, 'trafico', 'noite', 0.82),
    crime(-23.5388, -46.6340, 'trafico', 'madrugada', 0.75),
    crime(-23.5402, -46.6375, 'trafico', 'noite', 0.72),
    crime(-23.5320, -46.6365, 'trafico', 'madrugada', 0.70),
    crime(-23.5390, -46.6380, 'trafico', 'noite', 0.68),
    crime(-23.5510, -46.6330, 'trafico', 'madrugada', 0.45),
];

// ════════════════════════════════════════════════════
// safePoints — pontos seguros 24h (lugares reais)
// ════════════════════════════════════════════════════
export const safePoints = [
    // Farmácias
    { lat: -23.5612, lng: -46.6580, type: 'farmacia', name: 'Drogaria São Paulo — Av. Paulista/Paraíso', open24h: true },
    { lat: -23.5502, lng: -46.6338, type: 'farmacia', name: 'Drogasil — Praça da Sé', open24h: true },
    { lat: -23.5430, lng: -46.6428, type: 'farmacia', name: 'Drogaria Pacheco — República', open24h: true },
    { lat: -23.5578, lng: -46.6351, type: 'farmacia', name: 'Droga Raia — Liberdade', open24h: false },
    { lat: -23.5553, lng: -46.6608, type: 'farmacia', name: 'Drogaria São Paulo — Consolação', open24h: true },
    { lat: -23.5565, lng: -46.6513, type: 'farmacia', name: 'Droga Raia — Bela Vista/Paulista', open24h: true },
    { lat: -23.5458, lng: -46.6163, type: 'farmacia', name: 'Drogasil — Brás', open24h: false },
    { lat: -23.5667, lng: -46.6925, type: 'farmacia', name: 'Drogaria São Paulo — Pinheiros', open24h: true },

    // Delegacias / Bases Policiais
    { lat: -23.5490, lng: -46.6320, type: 'delegacia', name: 'Base PM — Praça da Sé', open24h: true },
    { lat: -23.5630, lng: -46.6545, type: 'delegacia', name: '78ª DP — Av. Paulista', open24h: true },
    { lat: -23.5445, lng: -46.6410, type: 'delegacia', name: 'GCM — Praça da República', open24h: true },
    { lat: -23.5340, lng: -46.6325, type: 'delegacia', name: 'Base PM — Estação da Luz', open24h: true },
    { lat: -23.5580, lng: -46.6620, type: 'delegacia', name: '4ª DP — Consolação', open24h: true },
    { lat: -23.5520, lng: -46.6318, type: 'delegacia', name: 'GCM — Centro Histórico', open24h: true },
    { lat: -23.5430, lng: -46.6160, type: 'delegacia', name: '2ª DP — Brás', open24h: true },

    // Hospitais / UPAs
    { lat: -23.5579, lng: -46.6550, type: 'hospital', name: 'Hospital Santa Casa de Misericórdia', open24h: true },
    { lat: -23.5588, lng: -46.6703, type: 'hospital', name: 'Hospital das Clínicas — HC', open24h: true },
    { lat: -23.5466, lng: -46.6365, type: 'hospital', name: 'Hospital Municipal Sorocabana', open24h: true },
    { lat: -23.5337, lng: -46.6393, type: 'hospital', name: 'UPA Santa Cecília — Luz', open24h: true },
    { lat: -23.5660, lng: -46.6878, type: 'hospital', name: 'Hospital das Clínicas — FMUSP Pinheiros', open24h: true },
    { lat: -23.5598, lng: -46.6502, type: 'hospital', name: 'Hospital São Paulo — Bela Vista', open24h: true },

    // Mercados / Supermercados 24h
    { lat: -23.5490, lng: -46.6435, type: 'mercado', name: 'Mercado Central — Praça Ramos', open24h: true },
    { lat: -23.5598, lng: -46.6455, type: 'mercado', name: 'Mercadão do Centro — Anhangabaú', open24h: false },
    { lat: -23.5610, lng: -46.6600, type: 'mercado', name: 'Pão de Açúcar 24h — Consolação', open24h: true },
    { lat: -23.5665, lng: -46.6910, type: 'mercado', name: 'Supermercado Dia — Pinheiros', open24h: true },
    { lat: -23.5530, lng: -46.6590, type: 'mercado', name: 'Posto 24h com conveniência — Augusta', open24h: true },
    { lat: -23.5350, lng: -46.6290, type: 'mercado', name: 'Supermercado Shibata — Brás/Pari', open24h: false },
    { lat: -23.5560, lng: -46.6640, type: 'mercado', name: 'Extra Hiper — Consolação', open24h: false },
];

// ════════════════════════════════════════════════════
// publicTransport — estações e linhas com frequência
// ════════════════════════════════════════════════════
export const publicTransport = [
    // Metrô
    {
        lat: -23.5503, lng: -46.6340, type: 'metro', name: 'Estação Sé (L1+L3)',
        risk: 'high',
        desc: 'Estação monitorada por câmeras. Atenção nos acessos laterais após 22h. Furtos frequentes nos horários de pico.',
        alerts: ['Saída norte com ponto cego', 'Fluxo intenso 17h–19h'],
        frequency: { manha: 'a cada 2min', tarde: 'a cada 2min', noite: 'a cada 4min', madrugada: 'sem serviço' },
        lastService: '00:00',
    },
    {
        lat: -23.5355, lng: -46.6345, type: 'metro', name: 'Estação Luz (L1+L4)',
        risk: 'critical',
        desc: 'Região de alta periculosidade. Evite as imediações da Rua Mauá e Alameda Cleveland após 20h.',
        alerts: ['Zona de risco elevado no entorno', 'Câmeras ativas mas área extensa'],
        frequency: { manha: 'a cada 2min', tarde: 'a cada 2min', noite: 'a cada 5min', madrugada: 'sem serviço' },
        lastService: '00:00',
    },
    {
        lat: -23.5568, lng: -46.6622, type: 'metro', name: 'Estação Consolação (L2)',
        risk: 'low',
        desc: 'Região bem policiada e iluminada. Acesso direto à Av. Paulista. Risco baixo.',
        alerts: [],
        frequency: { manha: 'a cada 3min', tarde: 'a cada 3min', noite: 'a cada 5min', madrugada: 'sem serviço' },
        lastService: '00:00',
    },
    {
        lat: -23.5432, lng: -46.6425, type: 'metro', name: 'Estação República (L3)',
        risk: 'high',
        desc: 'Alta incidência de furtos na Praça da República. Evite usar celular na mão.',
        alerts: ['Furtos frequentes na praça', 'Saída para R. Barão de Itapetininga: segura'],
        frequency: { manha: 'a cada 2min', tarde: 'a cada 2min', noite: 'a cada 4min', madrugada: 'sem serviço' },
        lastService: '00:00',
    },
    {
        lat: -23.5576, lng: -46.6348, type: 'metro', name: 'Estação Liberdade (L1)',
        risk: 'medium',
        desc: 'Fluxo turístico moderado. Rua Galvão Bueno bem iluminada. Cuidado em ruas paralelas à noite.',
        alerts: ['Câmeras na entrada principal'],
        frequency: { manha: 'a cada 2min', tarde: 'a cada 2min', noite: 'a cada 5min', madrugada: 'sem serviço' },
        lastService: '00:00',
    },
    {
        lat: -23.5460, lng: -46.6385, type: 'metro', name: 'Estação Anhangabaú (L3)',
        risk: 'medium',
        desc: 'Vale do Anhangabaú pode ser perigoso à noite. Prefira horários comerciais.',
        alerts: ['Vale do Anhangabaú: evitar após 20h'],
        frequency: { manha: 'a cada 2min', tarde: 'a cada 2min', noite: 'a cada 4min', madrugada: 'sem serviço' },
        lastService: '00:00',
    },
    // Paradas de ônibus
    {
        lat: -23.5620, lng: -46.6555, type: 'onibus', name: 'Ponto — Av. Paulista / MASP',
        risk: 'low',
        desc: 'Parada movimentada, bem iluminada e com policiamento frequente.',
        alerts: [],
        frequency: { manha: 'a cada 5min', tarde: 'a cada 5min', noite: 'a cada 15min', madrugada: 'a cada 30min' },
        lastService: '01:30',
    },
    {
        lat: -23.5510, lng: -46.6355, type: 'onibus', name: 'Ponto — Praça da Sé / Catedral',
        risk: 'high',
        desc: 'Alta incidência de furtos. Mantenha mochilas na frente e evite usar celular.',
        alerts: ['Assaltos a pedestres registrados'],
        frequency: { manha: 'a cada 5min', tarde: 'a cada 5min', noite: 'a cada 20min', madrugada: 'sem serviço' },
        lastService: '00:00',
    },
    {
        lat: -23.5428, lng: -46.6440, type: 'onibus', name: 'Ponto — Av. Ipiranga / República',
        risk: 'high',
        desc: 'Via perigosa à noite. Semáforo com histórico de assaltos.',
        alerts: ['Semáforo com histórico de assaltos', 'Iluminação deficiente à noite'],
        frequency: { manha: 'a cada 5min', tarde: 'a cada 5min', noite: 'a cada 20min', madrugada: 'sem serviço' },
        lastService: '23:30',
    },
    {
        lat: -23.5585, lng: -46.6355, type: 'onibus', name: 'Ponto — Rua da Glória / Liberdade',
        risk: 'medium',
        desc: 'Área comercial durante o dia, risco moderado à noite.',
        alerts: [],
        frequency: { manha: 'a cada 8min', tarde: 'a cada 8min', noite: 'a cada 25min', madrugada: 'sem serviço' },
        lastService: '23:00',
    },
    {
        lat: -23.5362, lng: -46.6330, type: 'onibus', name: 'Ponto — Av. Tiradentes / Luz',
        risk: 'critical',
        desc: 'ZONA CRÍTICA. Extrema cautela. Roubos frequentes. Evite espera prolongada.',
        alerts: ['Área com baixa iluminação', 'Sem ponto de fuga fácil'],
        frequency: { manha: 'a cada 8min', tarde: 'a cada 8min', noite: 'a cada 30min', madrugada: 'sem serviço' },
        lastService: '22:00',
    },
];

// ════════════════════════════════════════════════════
// peopleFlow — densidade de pedestres por horário
// ════════════════════════════════════════════════════
export const peopleFlow = [
    // Alta densidade — horário comercial (manhã/tarde)
    { lat: -23.5503, lng: -46.6340, density: 1.0, timeSlot: 'manha' },
    { lat: -23.5432, lng: -46.6425, density: 0.9, timeSlot: 'manha' },
    { lat: -23.5616, lng: -46.6558, density: 0.85, timeSlot: 'manha' },
    { lat: -23.5568, lng: -46.6622, density: 0.80, timeSlot: 'manha' },
    { lat: -23.5503, lng: -46.6340, density: 0.95, timeSlot: 'tarde' },
    { lat: -23.5432, lng: -46.6425, density: 0.85, timeSlot: 'tarde' },
    { lat: -23.5616, lng: -46.6558, density: 0.90, timeSlot: 'tarde' },
    { lat: -23.5460, lng: -46.6385, density: 0.75, timeSlot: 'tarde' },
    { lat: -23.5433, lng: -46.6157, density: 0.80, timeSlot: 'tarde' },
    { lat: -23.5576, lng: -46.6348, density: 0.70, timeSlot: 'tarde' },
    // Média densidade — noite
    { lat: -23.5503, lng: -46.6340, density: 0.55, timeSlot: 'noite' },
    { lat: -23.5432, lng: -46.6425, density: 0.45, timeSlot: 'noite' },
    { lat: -23.5616, lng: -46.6558, density: 0.70, timeSlot: 'noite' },
    { lat: -23.5568, lng: -46.6622, density: 0.65, timeSlot: 'noite' },
    { lat: -23.5553, lng: -46.6608, density: 0.60, timeSlot: 'noite' },
    { lat: -23.5665, lng: -46.6910, density: 0.55, timeSlot: 'noite' },
    { lat: -23.5576, lng: -46.6348, density: 0.35, timeSlot: 'noite' },
    { lat: -23.5460, lng: -46.6385, density: 0.30, timeSlot: 'noite' },
    // Baixa densidade — madrugada
    { lat: -23.5503, lng: -46.6340, density: 0.10, timeSlot: 'madrugada' },
    { lat: -23.5432, lng: -46.6425, density: 0.08, timeSlot: 'madrugada' },
    { lat: -23.5616, lng: -46.6558, density: 0.20, timeSlot: 'madrugada' },
    { lat: -23.5335, lng: -46.6368, density: 0.15, timeSlot: 'madrugada' },
    { lat: -23.5665, lng: -46.6910, density: 0.30, timeSlot: 'madrugada' },
    { lat: -23.5553, lng: -46.6608, density: 0.18, timeSlot: 'madrugada' },
    // Áreas de fluxo constante (serviços essenciais)
    { lat: -23.5579, lng: -46.6550, density: 0.40, timeSlot: 'madrugada' },
    { lat: -23.5588, lng: -46.6703, density: 0.35, timeSlot: 'madrugada' },
    { lat: -23.5490, lng: -46.6320, density: 0.30, timeSlot: 'madrugada' },
    ...scatter(-23.545, -46.650, 0.01, 12, 0.1, 0.4).map(p => ({
        lat: p[0], lng: p[1], density: p[2], timeSlot: 'noite'
    })),
    ...scatter(-23.555, -46.640, 0.008, 8, 0.05, 0.25).map(p => ({
        lat: p[0], lng: p[1], density: p[2], timeSlot: 'madrugada'
    })),
];

// ════════════════════════════════════════════════════
// nightLighting — nível de iluminação das áreas
// ════════════════════════════════════════════════════
export const nightLighting = [
    // Bem iluminadas
    { lat: -23.5616, lng: -46.6558, radius: 350, level: 'bem_iluminada', name: 'Av. Paulista' },
    { lat: -23.5568, lng: -46.6622, radius: 200, level: 'bem_iluminada', name: 'Consolação / Augusta' },
    { lat: -23.5503, lng: -46.6340, radius: 180, level: 'bem_iluminada', name: 'Praça da Sé' },
    { lat: -23.5432, lng: -46.6425, radius: 160, level: 'bem_iluminada', name: 'Praça da República' },
    { lat: -23.5665, lng: -46.6910, radius: 250, level: 'bem_iluminada', name: 'Pinheiros' },
    { lat: -23.5355, lng: -46.6345, radius: 150, level: 'bem_iluminada', name: 'Estação da Luz (entorno)' },
    { lat: -23.5460, lng: -46.6385, radius: 120, level: 'bem_iluminada', name: 'Viaduto do Chá' },
    { lat: -23.5579, lng: -46.6550, radius: 130, level: 'bem_iluminada', name: 'Santa Casa' },
    { lat: -23.5576, lng: -46.6348, radius: 140, level: 'bem_iluminada', name: 'Liberdade (eixo principal)' },

    // Iluminação parcial
    { lat: -23.5390, lng: -46.6380, radius: 200, level: 'parcial', name: 'Santa Ifigênia' },
    { lat: -23.5510, lng: -46.6355, radius: 150, level: 'parcial', name: 'Rua Boa Vista' },
    { lat: -23.5598, lng: -46.6459, radius: 180, level: 'parcial', name: 'Av. Brigadeiro Luís Antônio' },
    { lat: -23.5433, lng: -46.6157, radius: 220, level: 'parcial', name: 'Brás' },
    { lat: -23.5553, lng: -46.6608, radius: 160, level: 'parcial', name: 'Rua Augusta (trecho médio)' },
    { lat: -23.5475, lng: -46.6385, radius: 140, level: 'parcial', name: 'Vale do Anhangabaú (bordas)' },

    // Áreas escuras (risco elevado à noite)
    { lat: -23.5335, lng: -46.6368, radius: 280, level: 'escura', name: 'Cracolândia / Rua Helvetia' },
    { lat: -23.5350, lng: -46.6390, radius: 200, level: 'escura', name: 'Rua Mauá' },
    { lat: -23.5318, lng: -46.6345, radius: 160, level: 'escura', name: 'Alameda Cleveland (norte)' },
    { lat: -23.5480, lng: -46.6470, radius: 150, level: 'escura', name: 'Praça Roosevelt (becos)' },
    { lat: -23.5440, lng: -46.6170, radius: 180, level: 'escura', name: 'Brás (ruas internas)' },
    { lat: -23.5420, lng: -46.6440, radius: 140, level: 'escura', name: 'Av. Ipiranga (trecho noturno)' },
];

// ════════════════════════════════════════════════════
// riskByGroup — análise de risco por perfil demográfico
// ════════════════════════════════════════════════════
export const riskByGroup = [
    {
        region: 'luz',
        bounds: { minLat: -23.540, maxLat: -23.525, minLng: -46.645, maxLng: -46.625 },
        level: 'critical',
        groups: ['Mulheres', 'Idosos', 'Pessoas em situação de rua'],
        peakHours: '20h–06h',
        reasons: ['Alta concentração de dependentes químicos', 'Baixa iluminação em becos', 'Ausência de fluxo de pessoas na madrugada'],
        hotspots: ['Rua Mauá', 'Alameda Cleveland', 'Rua Helvetia'],
    },
    {
        region: 'se',
        bounds: { minLat: -23.555, maxLat: -23.545, minLng: -46.640, maxLng: -46.625 },
        level: 'high',
        groups: ['Turistas', 'Idosos', 'Pedestres com celular visível'],
        peakHours: '11h–14h e 17h–20h',
        reasons: ['Alto fluxo facilita ação de batedores de carteira', 'Múltiplas saídas de metrô com pontos cegos'],
        hotspots: ['Praça da Sé', 'Saída norte do metrô', 'Rua Boa Vista'],
    },
    {
        region: 'republica',
        bounds: { minLat: -23.550, maxLat: -23.538, minLng: -46.650, maxLng: -46.635 },
        level: 'high',
        groups: ['Pedestres', 'Ciclistas', 'Usuários de transporte público'],
        peakHours: '19h–23h',
        reasons: ['Praça frequentada à noite com iluminação parcial', 'Histórico de assaltos no cruzamento Ipiranga/São João'],
        hotspots: ['Praça da República', 'Cruzamento Ipiranga/São João', 'Praça Roosevelt'],
    },
    {
        region: 'paulista',
        bounds: { minLat: -23.570, maxLat: -23.555, minLng: -46.670, maxLng: -46.645 },
        level: 'low',
        groups: ['Ciclistas (faixas horárias)'],
        peakHours: '00h–05h',
        reasons: ['Boa iluminação e policiamento', 'Risco aumenta na madrugada após fechamento dos estabelecimentos'],
        hotspots: [],
    },
    {
        region: 'liberdade',
        bounds: { minLat: -23.570, maxLat: -23.553, minLng: -46.642, maxLng: -46.628 },
        level: 'medium',
        groups: ['Turistas', 'Mulheres'],
        peakHours: '22h–05h',
        reasons: ['Ruas transversais com baixo fluxo noturno', 'Iluminação parcial em ruas secundárias'],
        hotspots: ['Rua dos Estudantes', 'Rua Galvão Bueno (trecho sul)'],
    },
    {
        region: 'consolacao',
        bounds: { minLat: -23.560, maxLat: -23.548, minLng: -46.668, maxLng: -46.652 },
        level: 'low',
        groups: [],
        peakHours: '03h–06h',
        reasons: ['Alto fluxo de bares e restaurantes até tarde mantém presença de pessoas', 'Policiamento ativo na Av. Paulista'],
        hotspots: [],
    },
    {
        region: 'bras',
        bounds: { minLat: -23.552, maxLat: -23.538, minLng: -46.625, maxLng: -46.607 },
        level: 'high',
        groups: ['Ciclistas', 'Trabalhadores noturnos', 'Mulheres'],
        peakHours: '19h–06h',
        reasons: ['Área industrial com baixo fluxo noturno', 'Iluminação insuficiente em ruas internas'],
        hotspots: ['Rua dos Trilhos', 'Av. Rangel Pestana (trechos)'],
    },
];

// ════════════════════════════════════════════════════
// safeRoutes — rotas seguras (paleta verde CRT)
// ════════════════════════════════════════════════════
export const safeRoutes = [
    {
        name: 'Rota Segura — Av. Paulista (Leste–Oeste)',
        color: '#00FF9F',
        coords: [
            [-23.5636, -46.6523], [-23.5630, -46.6540], [-23.5622, -46.6558],
            [-23.5614, -46.6575], [-23.5607, -46.6592], [-23.5600, -46.6610],
            [-23.5593, -46.6628], [-23.5586, -46.6645],
        ],
        desc: 'Av. Paulista é a via mais segura do centro. Bem iluminada, policiada 24h, câmeras em toda extensão. Ciclovia disponível.',
    },
    {
        name: 'Rota Segura — Rua Augusta (Paulista → Consolação)',
        color: '#00cc7a',
        coords: [
            [-23.5568, -46.6622], [-23.5555, -46.6615], [-23.5545, -46.6610],
            [-23.5535, -46.6605], [-23.5525, -46.6600],
        ],
        desc: 'Trecho seguro da Rua Augusta entre Paulista e Consolação. Estabelecimentos abertos até tarde garantem fluxo constante.',
    },
    {
        name: 'Rota Alternativa — Consolação → Pinheiros',
        color: '#39FF14',
        coords: [
            [-23.5525, -46.6600], [-23.5535, -46.6640], [-23.5545, -46.6680],
            [-23.5555, -46.6720], [-23.5565, -46.6760], [-23.5575, -46.6800],
            [-23.5590, -46.6840], [-23.5610, -46.6880], [-23.5640, -46.6900],
            [-23.5660, -46.6915],
        ],
        desc: 'Rota alternativa por vias bem iluminadas. Evita áreas de risco médio. Tempo estimado a pé: 25 min.',
    },
];

// ════════════════════════════════════════════════════
// alertMessages — feed de alertas (tom neutro)
// ════════════════════════════════════════════════════
export const alertMessages = [
    { type: 'danger',  msg: 'Ocorrência de furto registrada na região da Sé — 12 min atrás.' },
    { type: 'warning', msg: 'Iluminação pública reduzida na R. Aurora — manutenção em andamento.' },
    { type: 'info',    msg: 'Patrulha da PM ativa na Av. Paulista até 06:00.' },
    { type: 'danger',  msg: 'Roubo registrado na R. Mauá / Luz às 21:45.' },
    { type: 'safe',    msg: 'Rota Av. Paulista verificada — status: LIVRE.' },
    { type: 'warning', msg: 'Movimentação suspeita detectada na Praça da República.' },
    { type: 'info',    msg: 'Câmeras do CET operando normalmente — 94% online.' },
    { type: 'danger',  msg: 'Área de risco elevado: Cracolândia — desvio recomendado.' },
    { type: 'warning', msg: 'Semáforo inoperante no cruzamento Ipiranga/São João.' },
    { type: 'safe',    msg: 'Região de Pinheiros com patrulha ativa — risco baixo.' },
    { type: 'info',    msg: 'Dados atualizados — 142 pontos analisados na região.' },
    { type: 'warning', msg: 'Visibilidade reduzida prevista nas próximas horas — chuva.' },
    { type: 'info',    msg: 'Serviço de metrô operando normalmente em todas as linhas.' },
    { type: 'danger',  msg: 'Ocorrência de agressão registrada na Praça Roosevelt — 22:10.' },
    { type: 'safe',    msg: 'Delegacia da Consolação com atendimento pleno — ONLINE.' },
];

// ════════════════════════════════════════════════════
// contextMessages — mensagens de contexto (tom técnico)
// ════════════════════════════════════════════════════
export const contextMessages = [
    'Via com fluxo moderado de pedestres e boa iluminação. Atenção a motos na faixa da direita. Mantenha pertences guardados.',
    'Região central de São Paulo. Nível de risco médio. Recomenda-se atenção com pertences pessoais em horários de pico.',
    'Área com cobertura de câmeras de monitoramento. Segurança relativa durante o dia. À noite, priorize vias principais.',
    'Proximidade de estação de metrô monitorada. Utilize as saídas principais. Evite acessos secundários após as 22h.',
    'Setor com policiamento ativo registrado. Fluxo de pedestres moderado. Via adequada para deslocamento a pé.',
    'Área comercial com iluminação adequada. Estabelecimentos em funcionamento oferecem referência segura. Após o fechamento, aumente a vigilância.',
    'Dados de criminalidade indicam incidência reduzida neste setor para o período atual.',
    'Região com boa cobertura de transporte público e fluxo contínuo de pessoas.',
];
