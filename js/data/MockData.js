export const SP_CENTER = [-23.5505, -46.6333];
export const DEFAULT_ZOOM = 14;

function generateScatterPoints(centerLat, centerLng, radius, count, minIntensity, maxIntensity) {
    const pts = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const lat = centerLat + r * Math.cos(angle);
        const lng = centerLng + r * Math.sin(angle);
        const intensity = minIntensity + Math.random() * (maxIntensity - minIntensity);
        pts.push([lat, lng, parseFloat(intensity.toFixed(2))]);
    }
    return pts;
}

export const crimeHeatData = [
    [-23.5335, -46.6368, 1.0], [-23.5342, -46.6355, 0.95], [-23.5350, -46.6380, 0.9],
    [-23.5338, -46.6392, 0.88], [-23.5345, -46.6340, 0.92], [-23.5330, -46.6375, 0.85],
    [-23.5360, -46.6370, 0.82], [-23.5328, -46.6350, 0.87], [-23.5355, -46.6395, 0.80],
    [-23.5365, -46.6360, 0.78], [-23.5320, -46.6365, 0.75], [-23.5348, -46.6410, 0.7],
    [-23.5372, -46.6385, 0.73], [-23.5318, -46.6345, 0.76], [-23.5340, -46.6420, 0.68],
    [-23.5390, -46.6380, 0.85], [-23.5395, -46.6365, 0.82], [-23.5385, -46.6395, 0.8],
    [-23.5398, -46.6350, 0.78], [-23.5402, -46.6375, 0.75], [-23.5388, -46.6340, 0.72],
    [-23.5503, -46.6340, 0.75], [-23.5510, -46.6330, 0.72], [-23.5495, -46.6350, 0.7],
    [-23.5515, -46.6345, 0.68], [-23.5500, -46.6320, 0.65], [-23.5508, -46.6360, 0.63],
    [-23.5520, -46.6335, 0.6], [-23.5490, -46.6325, 0.62], [-23.5498, -46.6370, 0.58],
    [-23.5432, -46.6425, 0.72], [-23.5440, -46.6435, 0.68], [-23.5425, -46.6415, 0.65],
    [-23.5438, -46.6445, 0.62], [-23.5445, -46.6420, 0.6], [-23.5420, -46.6440, 0.58],
    [-23.5433, -46.6157, 0.78], [-23.5440, -46.6170, 0.72], [-23.5425, -46.6140, 0.7],
    [-23.5448, -46.6155, 0.68], [-23.5430, -46.6180, 0.65], [-23.5455, -46.6165, 0.62],
    [-23.5420, -46.6130, 0.6], [-23.5460, -46.6150, 0.58],
    [-23.5598, -46.6459, 0.55], [-23.5605, -46.6470, 0.5], [-23.5590, -46.6445, 0.48],
    [-23.5612, -46.6465, 0.45], [-23.5585, -46.6480, 0.42],
    [-23.5576, -46.6348, 0.5], [-23.5580, -46.6360, 0.48], [-23.5570, -46.6335, 0.45],
    [-23.5590, -46.6355, 0.42], [-23.5565, -46.6345, 0.4],
    [-23.5516, -46.6596, 0.4], [-23.5525, -46.6590, 0.38], [-23.5510, -46.6605, 0.35],
    [-23.5614, -46.6558, 0.2], [-23.5610, -46.6540, 0.18], [-23.5618, -46.6575, 0.22],
    [-23.5606, -46.6520, 0.15], [-23.5622, -46.6590, 0.2],
    [-23.5667, -46.6919, 0.2], [-23.5670, -46.6930, 0.18], [-23.5660, -46.6910, 0.15],
    [-23.5532, -46.6911, 0.25], [-23.5540, -46.6920, 0.22], [-23.5525, -46.6900, 0.2],
    [-23.5567, -46.6019, 0.52], [-23.5575, -46.6030, 0.48], [-23.5560, -46.6010, 0.45],
    [-23.5580, -46.6045, 0.42],
    ...generateScatterPoints(-23.545, -46.650, 0.008, 20, 0.3, 0.6),
    ...generateScatterPoints(-23.535, -46.625, 0.006, 15, 0.4, 0.7),
    ...generateScatterPoints(-23.555, -46.640, 0.010, 18, 0.2, 0.5),
    ...generateScatterPoints(-23.548, -46.615, 0.008, 12, 0.35, 0.55),
];

export const pointsOfInterest = [
    {
        id: 'metro-se', lat: -23.5503, lng: -46.6340, type: 'metro', risk: 'high',
        name: 'Estação Sé', icon: '🚇',
        desc: 'Estação movimentada e monitorada por câmeras. Cuidado nos acessos laterais, especialmente após 22h. Furtos frequentes nos horários de pico.',
        alerts: ['Ponto cego na saída norte', 'Fluxo intenso 17h-19h'],
    },
    {
        id: 'metro-luz', lat: -23.5355, lng: -46.6345, type: 'metro', risk: 'critical',
        name: 'Estação da Luz', icon: '🚇',
        desc: 'Região de alta periculosidade. Evite caminhar sozinho(a) nas imediações, especialmente Rua Mauá e Alameda Cleveland. Presença de dependentes químicos.',
        alerts: ['Zona de risco extremo ao redor', 'Câmeras ativas mas área vasta'],
    },
    {
        id: 'metro-paulista', lat: -23.5568, lng: -46.6622, type: 'metro', risk: 'low',
        name: 'Estação Consolação/Paulista', icon: '🚇',
        desc: 'Região bem policiada e iluminada. Acesso direto à Av. Paulista. Segurança reforçada. Risco baixo.',
        alerts: ['Via segura ao longo da Paulista'],
    },
    {
        id: 'metro-republica', lat: -23.5432, lng: -46.6425, type: 'metro', risk: 'high',
        name: 'Estação República', icon: '🚇',
        desc: 'Área movimentada mas com alta incidência de furtos. Praça da República concentra atividade suspeita à noite. Evite celular na mão.',
        alerts: ['Furtos frequentes na praça', 'Saída para Rua Barão de Itapetininga: segura'],
    },
    {
        id: 'metro-liberdade', lat: -23.5576, lng: -46.6348, type: 'metro', risk: 'medium',
        name: 'Estação Liberdade', icon: '🚇',
        desc: 'Região com fluxo turístico moderado. Rua Galvão Bueno é bem iluminada. Cuidado em ruas paralelas à noite.',
        alerts: ['Ponto turístico — segurança média', 'Câmeras na entrada principal'],
    },
    {
        id: 'metro-anhangabau', lat: -23.5460, lng: -46.6385, type: 'metro', risk: 'medium',
        name: 'Estação Anhangabaú', icon: '🚇',
        desc: 'Viaduto do Chá e Vale do Anhangabaú podem ser perigosos à noite. Prefira horários comerciais.',
        alerts: ['Vale do Anhangabaú: evitar após 20h'],
    },
    {
        id: 'bus-paulista1', lat: -23.5620, lng: -46.6555, type: 'bus', risk: 'low',
        name: 'Ponto de Ônibus — Av. Paulista / MASP', icon: '🚌',
        desc: 'Parada movimentada, bem iluminada e com presença policial frequente. Via segura.',
        alerts: [],
    },
    {
        id: 'bus-se1', lat: -23.5510, lng: -46.6355, type: 'bus', risk: 'high',
        name: 'Ponto de Ônibus — Praça da Sé / Catedral', icon: '🚌',
        desc: 'Parada com alto fluxo mas zona de furtos. Mantenha mochilas na frente e evite usar celular.',
        alerts: ['Assaltos a pedestres registrados', 'Sem escape fácil à noite'],
    },
    {
        id: 'bus-republica1', lat: -23.5428, lng: -46.6440, type: 'bus', risk: 'high',
        name: 'Ponto de Ônibus — Av. Ipiranga / República', icon: '🚌',
        desc: 'Via movimentada mas perigosa à noite. Semáforo com histórico de assaltos a motoristas e pedestres.',
        alerts: ['Semáforo com histórico de assaltos', 'Iluminação deficiente à noite'],
    },
    {
        id: 'bus-liberdade1', lat: -23.5585, lng: -46.6355, type: 'bus', risk: 'medium',
        name: 'Ponto de Ônibus — Rua da Glória / Liberdade', icon: '🚌',
        desc: 'Área comercial durante o dia, risco moderado à noite. Câmeras próximas.',
        alerts: ['Comércio aberto até 20h oferece segurança'],
    },
    {
        id: 'bus-luz1', lat: -23.5362, lng: -46.6330, type: 'bus', risk: 'critical',
        name: 'Ponto de Ônibus — Av. Tiradentes / Luz', icon: '🚌',
        desc: 'ZONA CRÍTICA. Extrema cautela. Roubos frequentes dia e noite. Evite espera prolongada.',
        alerts: ['Rua com baixa iluminação', 'Ponto cego sem escape fácil'],
    },
    {
        id: 'police-se', lat: -23.5490, lng: -46.6320, type: 'police', risk: 'low',
        name: 'Base Comunitária da PM — Sé', icon: '🛡️',
        desc: 'Posto da Polícia Militar com atendimento 24h. Ponto de referência seguro para emergências.',
        alerts: [],
    },
    {
        id: 'police-paulista', lat: -23.5630, lng: -46.6545, type: 'police', risk: 'low',
        name: 'Delegacia — Av. Paulista', icon: '🛡️',
        desc: 'Delegacia de Polícia Civil. Atendimento 24h. Região muito segura ao redor.',
        alerts: [],
    },
    {
        id: 'police-republica', lat: -23.5445, lng: -46.6410, type: 'police', risk: 'low',
        name: 'GCM — República', icon: '🛡️',
        desc: 'Guarda Civil Metropolitana com ronda frequente na Praça da República.',
        alerts: [],
    },
    {
        id: 'police-luz', lat: -23.5340, lng: -46.6325, type: 'police', risk: 'low',
        name: 'Base PM — Luz', icon: '🛡️',
        desc: 'Base da PM próxima à Estação da Luz. Atendimento intensificado na região. Ponto aliado.',
        alerts: [],
    },
    {
        id: 'cam-paulista1', lat: -23.5608, lng: -46.6565, type: 'camera', risk: 'low',
        name: 'Câmera — Av. Paulista / Haddock Lobo', icon: '📹',
        desc: 'Câmera do CET com monitoramento 24h. Transmissão em tempo real para Central de Segurança.',
        alerts: [],
    },
    {
        id: 'cam-se1', lat: -23.5500, lng: -46.6345, type: 'camera', risk: 'medium',
        name: 'Câmera — Praça da Sé', icon: '📹',
        desc: 'Câmera ativa mas ângulo limitado. Pontos cegos no lado oeste da praça.',
        alerts: ['Ângulo limitado — lado oeste descoberto'],
    },
    {
        id: 'cam-republica1', lat: -23.5435, lng: -46.6430, type: 'camera', risk: 'medium',
        name: 'Câmera — Praça da República', icon: '📹',
        desc: 'Sistema de câmeras cobrindo acessos principais. Interior da praça com cobertura parcial.',
        alerts: [],
    },
    {
        id: 'cam-luz1', lat: -23.5350, lng: -46.6350, type: 'camera', risk: 'high',
        name: 'Câmera — Estação da Luz', icon: '📹',
        desc: 'Câmera ativa mas região de alta incidência. Monitoramento não impede crimes na área.',
        alerts: ['Área muito ampla para cobertura eficaz'],
    },
    {
        id: 'shop-paulista1', lat: -23.5612, lng: -46.6580, type: 'commerce24h', risk: 'low',
        name: 'Farmácia 24h — Av. Paulista', icon: '🏪',
        desc: 'Farmácia com funcionamento ininterrupto. Ponto seguro para abrigo em emergências. Segurança privada.',
        alerts: [],
    },
    {
        id: 'shop-consolacao1', lat: -23.5530, lng: -46.6610, type: 'commerce24h', risk: 'low',
        name: 'Posto de Gasolina 24h — Consolação', icon: '⛽',
        desc: 'Posto com loja de conveniência aberta 24h. Câmeras e iluminação forte. Ponto de escape confiável.',
        alerts: [],
    },
    {
        id: 'shop-se1', lat: -23.5515, lng: -46.6315, type: 'commerce24h', risk: 'medium',
        name: 'Padaria 24h — Sé', icon: '🏪',
        desc: 'Comércio 24h com fluxo constante. Pode servir como ponto de abrigo temporário. Rua bem movimentada.',
        alerts: [],
    },
    {
        id: 'shop-pinheiros1', lat: -23.5665, lng: -46.6925, type: 'commerce24h', risk: 'low',
        name: 'Mercado 24h — Pinheiros', icon: '🏪',
        desc: 'Supermercado com segurança e estacionamento. Área segura e bem iluminada.',
        alerts: [],
    },
    {
        id: 'danger-cracolandia', lat: -23.5340, lng: -46.6373, type: 'danger_zone', risk: 'critical',
        name: '⚠️ ZONA CRÍTICA — Cracolândia', icon: '☠️',
        desc: 'Região com altíssima concentração de dependentes químicos e atividade criminal. EVITE COMPLETAMENTE. Roubos, agressões e tráfico constantes.',
        alerts: ['EVITAR A TODO CUSTO', 'Nenhuma rota segura', 'Sem iluminação em becos'],
    },
    {
        id: 'danger-maua', lat: -23.5350, lng: -46.6390, type: 'danger_zone', risk: 'critical',
        name: '⚠️ Rua Mauá — Perigo Extremo', icon: '⚠️',
        desc: 'Rua com baixa iluminação e sem escape fácil em vários trechos. Assaltos frequentes mesmo durante o dia.',
        alerts: ['Rua com baixa iluminação', 'Ponto cego sem escape fácil'],
    },
    {
        id: 'danger-roosevelt', lat: -23.5438, lng: -46.6468, type: 'danger_zone', risk: 'medium',
        name: 'Praça Roosevelt — Atenção', icon: '⚠️',
        desc: 'Via movimentada mas perigosa à noite. Praça frequentada por skatistas e artistas, mas com ocorrências de furtos em horários tardios.',
        alerts: ['Seguro durante o dia', 'Cuidado após meia-noite'],
    },
    {
        id: 'alert-ipiranga', lat: -23.5440, lng: -46.6445, type: 'alert_point', risk: 'high',
        name: 'Cruzamento Ipiranga/São João', icon: '⚡',
        desc: 'Semáforo com histórico de assaltos a pedestres e motoristas. Veículos parados são alvo frequente. Não abra janela.',
        alerts: ['Semáforo com histórico de assaltos', 'Via movimentada mas perigosa à noite'],
    },
    {
        id: 'alert-viaduto', lat: -23.5475, lng: -46.6385, type: 'alert_point', risk: 'high',
        name: 'Viaduto do Chá — Cautela', icon: '⚡',
        desc: 'Viaduto com boa visibilidade mas ruas abaixo são perigosas. Evite descer para o Vale do Anhangabaú à noite.',
        alerts: ['Vale abaixo é zona de risco', 'Câmeras no viaduto mas não no vale'],
    },
];

export const safeRoutes = [
    {
        name: 'Rota Segura — Av. Paulista (Leste-Oeste)',
        color: '#00ffaa',
        coords: [
            [-23.5636, -46.6523], [-23.5630, -46.6540], [-23.5622, -46.6558],
            [-23.5614, -46.6575], [-23.5607, -46.6592], [-23.5600, -46.6610],
            [-23.5593, -46.6628], [-23.5586, -46.6645],
        ],
        desc: 'Av. Paulista é a via mais segura do centro. Bem iluminada, policiada 24h, com câmeras em toda extensão.',
    },
    {
        name: 'Rota Segura — Rua Augusta (Paulista → Consolação)',
        color: '#00ddff',
        coords: [
            [-23.5568, -46.6622], [-23.5555, -46.6615], [-23.5545, -46.6610],
            [-23.5535, -46.6605], [-23.5525, -46.6600],
        ],
        desc: 'Trecho seguro da Rua Augusta entre Paulista e Consolação. Comércios e bares abertos até tarde.',
    },
    {
        name: 'Rota Alternativa — Consolação → Pinheiros',
        color: '#88ff00',
        coords: [
            [-23.5525, -46.6600], [-23.5535, -46.6640], [-23.5545, -46.6680],
            [-23.5555, -46.6720], [-23.5565, -46.6760], [-23.5575, -46.6800],
            [-23.5590, -46.6840], [-23.5610, -46.6880], [-23.5640, -46.6900],
            [-23.5660, -46.6915],
        ],
        desc: 'Rota alternativa por vias bem iluminadas. Evita áreas de risco médio. Tempo estimado: 25 min a pé.',
    },
];

export const alertMessages = [
    { type: 'danger', msg: 'Alerta de furto registrado na região da Sé há 12 min.' },
    { type: 'warning', msg: 'Iluminação pública reduzida na R. Aurora — manutenção.' },
    { type: 'info', msg: 'Ronda da PM ativa na Av. Paulista até 06:00.' },
    { type: 'danger', msg: 'Relato de assalto na R. Mauá / Luz às 21:45.' },
    { type: 'safe', msg: 'Rota segura via Av. Paulista verificada — status: CLEAR.' },
    { type: 'warning', msg: 'Movimento suspeito detectado na Praça da República.' },
    { type: 'info', msg: 'Câmeras do CET operando normalmente — 94% online.' },
    { type: 'danger', msg: 'Zona crítica: Cracolândia — desvio recomendado.' },
    { type: 'warning', msg: 'Semáforo desativado no cruzamento Ipiranga/São João.' },
    { type: 'safe', msg: 'Região de Pinheiros com patrulha ativa — seguro.' },
    { type: 'info', msg: 'Atualização de mapa concluída — 142 pontos analisados.' },
    { type: 'warning', msg: 'Chuva prevista em 40 min — visibilidade reduzida.' },
];

export const contextMessages = [
    'Você está em uma via movimentada com boa iluminação. Cuidado com motos à direita. Mantenha objetos de valor guardados.',
    'Região central de São Paulo. Nível de ameaça médio. Recomenda-se atenção redobrada com pertences pessoais.',
    'Área com presença de câmeras de monitoramento. Segurança relativa durante o dia. À noite, prefira vias principais.',
    'Proximidade de estação de metrô monitorada. Utilize acessos principais. Evite saídas laterais após 22h.',
    'Setor com policiamento ativo. Fluxo de pedestres moderado. Via segura para deslocamento a pé.',
    'Área comercial com boa iluminação. Lojas funcionando até 20h oferecem pontos de abrigo. Após isso, aumente a vigilância.',
];
