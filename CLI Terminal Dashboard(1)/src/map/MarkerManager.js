import { safePoints, publicTransport } from '../data/MockData.js';

export class MarkerManager {
    constructor(map) {
        this.map = map;
        this._safePointGroup = L.layerGroup();
        this._transportGroup = L.layerGroup();
        this._dangerGroup = L.layerGroup();
        this._allGroups = [this._safePointGroup, this._transportGroup, this._dangerGroup];
    }

    // ── Icon helpers ──

    _icon(symbol, size, cssClass) {
        return L.divIcon({
            className: `custom-marker ${cssClass}`,
            html: `<span style="font-size:${size * 0.55}px;line-height:${size}px;font-family:'Share Tech Mono',monospace">${symbol}</span>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -(size / 2) - 4],
        });
    }

    _safePointSymbol(type) {
        switch (type) {
            case 'farmacia':   return { symbol: '✚', cssClass: 'marker-safe-point' };
            case 'delegacia':  return { symbol: '◈', cssClass: 'marker-safe-point' };
            case 'hospital':   return { symbol: '⊕', cssClass: 'marker-safe-point' };
            case 'mercado':    return { symbol: '▣', cssClass: 'marker-safe-point' };
            default:           return { symbol: '◉', cssClass: 'marker-safe-point' };
        }
    }

    _safePointTypeLabel(type) {
        switch (type) {
            case 'farmacia':  return 'FARMÁCIA 24H';
            case 'delegacia': return 'DELEGACIA / BASE POLICIAL';
            case 'hospital':  return 'HOSPITAL / UPA';
            case 'mercado':   return 'MERCADO / CONVENIÊNCIA';
            default:          return 'PONTO SEGURO';
        }
    }

    _transportSymbol(type) {
        return type === 'metro'
            ? { symbol: 'M', cssClass: 'marker-transport-metro', size: 22 }
            : { symbol: '⊡', cssClass: 'marker-transport-bus', size: 18 };
    }

    _riskClass(risk) {
        switch (risk) {
            case 'critical': return 'marker-critical';
            case 'high':     return 'marker-high';
            case 'medium':   return 'marker-medium';
            default:         return 'marker-safe-point';
        }
    }

    _riskLabel(risk) {
        switch (risk) {
            case 'critical': return 'CRÍTICO';
            case 'high':     return 'ALTO';
            case 'medium':   return 'MÉDIO';
            case 'low':      return 'BAIXO';
            default:         return risk.toUpperCase();
        }
    }

    _riskDot(risk) {
        if (risk === 'critical' || risk === 'high') return 'danger';
        if (risk === 'medium') return 'warning';
        return 'safe';
    }

    _riskPercent(risk) {
        return { critical: 95, high: 75, medium: 45, low: 15 }[risk] ?? 50;
    }

    _riskBarClass(risk) {
        if (risk === 'critical' || risk === 'high') return 'danger';
        if (risk === 'medium') return 'warning';
        return 'safe';
    }

    // ── Popup builders ──

    _safePointPopup(sp) {
        const { symbol } = this._safePointSymbol(sp.type);
        const typeLabel = this._safePointTypeLabel(sp.type);
        const statusTag = sp.open24h
            ? `<span style="color:var(--crt-green);font-size:0.62rem;">● ABERTO 24H</span>`
            : `<span style="color:var(--text-dim);font-size:0.62rem;">○ Horário limitado</span>`;

        return `<div class="popup-inner">
            <div class="popup-type">
                <span class="dot safe"></span>${typeLabel}
            </div>
            <div class="popup-title">${symbol} ${sp.name}</div>
            <div class="popup-meta">
                ${statusTag}
                <span>Safe Point</span>
            </div>
        </div>`;
    }

    _transportPopup(poi) {
        const typeLabel = poi.type === 'metro' ? 'ESTAÇÃO DE METRÔ' : 'PONTO DE ÔNIBUS';
        const freqRows = Object.entries(poi.frequency || {}).map(
            ([slot, freq]) => `<div style="font-size:0.62rem;color:var(--text-dim);margin:1px 0">
                <span style="color:var(--crt-green-dim);text-transform:uppercase;letter-spacing:.08em">${slot}:</span> ${freq}
            </div>`
        ).join('');

        let alertsHTML = '';
        if (poi.alerts && poi.alerts.length > 0) {
            alertsHTML = `<div class="popup-alerts">${poi.alerts.map(a =>
                `<div class="alert-line">▲ ${a}</div>`).join('')}</div>`;
        }

        return `<div class="popup-inner">
            <div class="popup-type">
                <span class="dot ${this._riskDot(poi.risk)}"></span>${typeLabel}
            </div>
            <div class="popup-title">${poi.name}</div>
            <div class="popup-desc">${poi.desc}</div>
            <div class="popup-risk-bar">
                <div class="fill ${this._riskBarClass(poi.risk)}" style="width:${this._riskPercent(poi.risk)}%"></div>
            </div>
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(0,255,159,0.06)">
                ${freqRows}
                ${poi.lastService ? `<div style="font-size:0.6rem;color:var(--text-dim);margin-top:3px">Último serviço: ${poi.lastService}</div>` : ''}
            </div>
            ${alertsHTML}
            <div class="popup-meta">
                <span>Risco: ${this._riskLabel(poi.risk)}</span>
            </div>
        </div>`;
    }

    // ── Add markers ──

    addAllMarkers() {
        this._addSafePoints();
        this._addTransport();
        this._addDangerZones();

        // Default visibility
        this._safePointGroup.addTo(this.map);
        this._transportGroup.addTo(this.map);
        this._dangerGroup.addTo(this.map);
    }

    _safePointSvg(type) {
        const svgStart = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
        const svgEnd = '</svg>';
        switch (type) {
            case 'delegacia':
                return {
                    svg: `${svgStart}<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>${svgEnd}`,
                    color: '#00ff41' // G.bright
                };
            case 'hospital':
                return {
                    svg: `${svgStart}<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/>${svgEnd}`,
                    color: '#0099ff' // G.blue
                };
            case 'farmacia':
                return {
                    svg: `${svgStart}<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>${svgEnd}`,
                    color: '#00cc33' // G.mid
                };
            case 'mercado':
                return {
                    svg: `${svgStart}<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>${svgEnd}`,
                    color: '#ffaa00' // G.warn
                };
            default:
                return {
                    svg: `${svgStart}<circle cx="12" cy="12" r="10"/>${svgEnd}`,
                    color: '#00cc33'
                };
        }
    }

    _safePointIcon(sp) {
        const { svg, color } = this._safePointSvg(sp.type);
        const size = 28;
        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="display:flex;align-items:center;gap:6px;">
                     <div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border:1px solid ${color}40;background:${color}0c;color:${color};border-radius:2px;box-shadow:0 0 8px ${color}40;">
                       ${svg}
                     </div>
                     <span style="color:${color};font-family:'Share Tech Mono', monospace, 'JetBrains Mono';font-size:9px;font-weight:bold;letter-spacing:0.05em;text-shadow:0 0 4px ${color}80;white-space:nowrap;">
                       ${sp.name}
                     </span>
                   </div>`,
            iconSize: [200, size], // enough width for text
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -(size / 2) - 4],
        });
    }

    _addSafePoints() {
        this.updateCustomSafePoints(new Set(), []);
    }

    updateCustomSafePoints(blockedSafePoints = new Set(), customSafePoints = []) {
        this._safePointGroup.clearLayers();
        
        // Add original safe points, filtering out blocked ones
        safePoints.forEach(sp => {
            if (blockedSafePoints.has(sp.name)) return;
            const icon = this._safePointIcon(sp);
            const marker = L.marker([sp.lat, sp.lng], { icon })
                .bindPopup(this._safePointPopup(sp), { maxWidth: 280, minWidth: 200 });
            marker.on('mouseover', function() { this.openPopup(); });
            this._safePointGroup.addLayer(marker);
        });

        // Add custom safe points
        customSafePoints.forEach(sp => {
            if (blockedSafePoints.has(sp.name)) return;
            const icon = this._safePointIcon(sp);
            const marker = L.marker([sp.lat, sp.lng], { icon })
                .bindPopup(this._safePointPopup(sp), { maxWidth: 280, minWidth: 200 });
            marker.on('mouseover', function() { this.openPopup(); });
            this._safePointGroup.addLayer(marker);
        });
    }

    _addTransport() {
        publicTransport.forEach(poi => {
            const { symbol, cssClass, size } = this._transportSymbol(poi.type);
            const icon = this._icon(symbol, size || 20, this._riskClass(poi.risk));
            const marker = L.marker([poi.lat, poi.lng], { icon })
                .bindPopup(this._transportPopup(poi), { maxWidth: 300, minWidth: 220 });
            marker.on('mouseover', function() { this.openPopup(); });
            this._transportGroup.addLayer(marker);
        });
    }

    _addDangerZones() {
        const dangerZones = [
            {
                lat: -23.5340, lng: -46.6373,
                name: 'ZONA CRÍTICA — Cracolândia',
                desc: 'Alta concentração de dependentes químicos e atividade criminal. Evite completamente. Roubos e agressões frequentes.',
                alerts: ['Evitar a qualquer horário', 'Sem rota segura de saída', 'Becos sem iluminação'],
                risk: 'critical',
            },
            {
                lat: -23.5350, lng: -46.6390,
                name: 'Rua Mauá — Risco Elevado',
                desc: 'Via com baixa iluminação e ausência de pontos de fuga em vários trechos. Ocorrências registradas em todos os horários.',
                alerts: ['Iluminação deficiente', 'Sem saídas alternativas próximas'],
                risk: 'critical',
            },
            {
                lat: -23.5438, lng: -46.6468,
                name: 'Praça Roosevelt — Atenção Noturna',
                desc: 'Frequentada durante o dia, risco aumenta após meia-noite. Registros de furtos em horários tardios.',
                alerts: ['Seguro até às 00h', 'Atenção após meia-noite'],
                risk: 'medium',
            },
            {
                lat: -23.5440, lng: -46.6445,
                name: 'Cruzamento Ipiranga/São João',
                desc: 'Semáforo com histórico de assaltos a pedestres e motoristas. Veículos parados são alvo recorrente.',
                alerts: ['Histórico de assaltos em semáforos', 'Horário crítico: 19h–23h'],
                risk: 'high',
            },
            {
                lat: -23.5475, lng: -46.6385,
                name: 'Vale do Anhangabaú — Noturno',
                desc: 'Área abaixo do viaduto apresenta risco elevado à noite. Evite descer para o vale após as 20h.',
                alerts: ['Risco elevado após 20h', 'Câmeras no viaduto, não no vale'],
                risk: 'high',
            },
        ];

        dangerZones.forEach(dz => {
            const size = dz.risk === 'critical' ? 26 : 22;
            const symbol = dz.risk === 'critical' ? '△' : '▲';
            const icon = this._icon(symbol, size, this._riskClass(dz.risk));

            let alertsHTML = '';
            if (dz.alerts && dz.alerts.length > 0) {
                alertsHTML = `<div class="popup-alerts">${dz.alerts.map(a =>
                    `<div class="alert-line">▲ ${a}</div>`).join('')}</div>`;
            }

            const popup = `<div class="popup-inner">
                <div class="popup-type"><span class="dot danger"></span>ÁREA DE RISCO</div>
                <div class="popup-title">${symbol} ${dz.name}</div>
                <div class="popup-desc">${dz.desc}</div>
                <div class="popup-risk-bar">
                    <div class="fill ${this._riskBarClass(dz.risk)}" style="width:${this._riskPercent(dz.risk)}%"></div>
                </div>
                ${alertsHTML}
                <div class="popup-meta"><span>Risco: ${this._riskLabel(dz.risk)}</span></div>
            </div>`;

            const marker = L.marker([dz.lat, dz.lng], { icon })
                .bindPopup(popup, { maxWidth: 300, minWidth: 220 });
            marker.on('mouseover', function() { this.openPopup(); });
            this._dangerGroup.addLayer(marker);
        });
    }

    // ── Layer visibility ──

    showSafePoints(visible) {
        if (visible) {
            this._safePointGroup.addTo(this.map);
        } else {
            this.map.removeLayer(this._safePointGroup);
        }
    }

    showTransport(visible) {
        if (visible) {
            this._transportGroup.addTo(this.map);
        } else {
            this.map.removeLayer(this._transportGroup);
        }
    }

    applyFilters(filters) {
        // Future: filter markers by type/period if needed
        // Current implementation shows all markers regardless of crime filter
    }
}
