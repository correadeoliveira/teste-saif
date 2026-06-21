import { crimesByType, riskByGroup, safePoints, publicTransport } from '../data/MockData.js';

export class RiskAnalyzer {
    constructor(crimeMap) {
        this.crimeMap = crimeMap;
        this._currentLevel = 'medium';
    }

    analyze(lat, lng, filters) {
        const radius = 0.012;
        const { types, period } = filters || { types: [], period: 'all' };
        const activeTypes = types && types.length > 0
            ? types
            : ['furto', 'roubo', 'assalto', 'agressao', 'trafico'];

        // ── 1. Calcular intensidade de crimes na área ──
        const nearbyCrimes = crimesByType.filter(c => {
            const dist = Math.sqrt(Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2));
            const typeOk = activeTypes.includes(c.type);
            const periodOk = (!period || period === 'all') ? true : c.time === period;
            return dist < radius && typeOk && periodOk;
        });

        const avgIntensity = nearbyCrimes.length > 0
            ? nearbyCrimes.reduce((sum, c) => sum + c.intensity, 0) / nearbyCrimes.length
            : 0;

        // ── 2. Determinar nível de risco ──
        let level;
        if (avgIntensity >= 0.75)     { level = 'critical'; }
        else if (avgIntensity >= 0.50) { level = 'high'; }
        else if (avgIntensity >= 0.25) { level = 'medium'; }
        else                           { level = 'low'; }

        this._currentLevel = level;

        // ── 3. Encontrar região mais próxima com análise demográfica ──
        let matchedRegion = null;
        let minDist = Infinity;
        riskByGroup.forEach(region => {
            const b = region.bounds;
            if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng) {
                const centerLat = (b.minLat + b.maxLat) / 2;
                const centerLng = (b.minLng + b.maxLng) / 2;
                const dist = Math.sqrt(Math.pow(centerLat - lat, 2) + Math.pow(centerLng - lng, 2));
                if (dist < minDist) {
                    minDist = dist;
                    matchedRegion = region;
                }
            }
        });

        // ── 4. Contar safe points próximos ──
        const nearSafe = safePoints.filter(sp => {
            const dist = Math.sqrt(Math.pow(sp.lat - lat, 2) + Math.pow(sp.lng - lng, 2));
            return dist < radius * 1.5;
        });

        const nearTransport = publicTransport.filter(pt => {
            const dist = Math.sqrt(Math.pow(pt.lat - lat, 2) + Math.pow(pt.lng - lng, 2));
            return dist < radius;
        });

        // ── 5. Renderizar ──
        this._render(level, matchedRegion, nearbyCrimes.length, nearSafe, nearTransport, period);
        this.crimeMap.updateThreatBadge(level);

        // ── 6. Atualizar info da região ──
        this._updateRegionInfo(nearSafe, nearTransport);

        return { level, matchedRegion, crimeCount: nearbyCrimes.length };
    }

    _render(level, region, crimeCount, nearSafe, nearTransport, period) {
        // Badge
        const badge = document.getElementById('risk-level-badge');
        if (badge) {
            badge.className = `risk-level-value ${level}`;
            const labels = { low: 'BAIXO', medium: 'MÉDIO', high: 'ALTO', critical: 'CRÍTICO' };
            badge.textContent = labels[level] || 'MÉDIO';
        }

        // Tags de grupos
        const tagContainer = document.getElementById('risk-group-tags');
        if (tagContainer) {
            if (region && region.groups && region.groups.length > 0) {
                tagContainer.innerHTML = region.groups
                    .map(g => `<span class="risk-tag">${g}</span>`)
                    .join('');
            } else if (level === 'low') {
                tagContainer.innerHTML = '<span class="risk-tag" style="color:var(--crt-green);border-color:rgba(0,255,159,0.2)">Nenhum grupo específico</span>';
            } else {
                tagContainer.innerHTML = '<span class="risk-tag">Pedestres</span><span class="risk-tag">Usuários de transporte</span>';
            }
        }

        // Narrativa
        const narrative = document.getElementById('risk-narrative');
        if (narrative) {
            const text = this._buildNarrative(level, region, crimeCount, period, nearSafe.length);
            narrative.textContent = '';
            narrative.classList.add('typing');
            let i = 0;
            const type = () => {
                if (i < text.length) {
                    narrative.textContent += text[i];
                    i++;
                    setTimeout(type, 12 + Math.random() * 14);
                } else {
                    narrative.classList.remove('typing');
                }
            };
            type();
        }
    }

    _buildNarrative(level, region, crimeCount, period, safePtsCount) {
        if (level === 'low') {
            return `Área com baixa incidência de crimes${period && period !== 'all' ? ` no período da ${period}` : ''}. ${safePtsCount > 0 ? `${safePtsCount} safe point(s) próximo(s) disponíveis.` : 'Policiamento adequado na região.'}`;
        }

        if (!region) {
            const levelDesc = { medium: 'moderada', high: 'elevada', critical: 'muito elevada' }[level] || 'moderada';
            const periodDesc = period && period !== 'all' ? ` no período da ${period}` : '';
            return `Incidência ${levelDesc} de crimes na região${periodDesc}. ${crimeCount} ocorrência(s) registrada(s). Mantenha atenção aos pertences.`;
        }

        const { groups, peakHours, reasons, hotspots } = region;
        let text = '';

        if (groups && groups.length > 0) {
            text += `Maior risco para: ${groups.join(', ')}`;
        }
        if (peakHours) {
            text += ` — principalmente entre ${peakHours}`;
        }
        if (reasons && reasons.length > 0) {
            text += `. Fatores: ${reasons.slice(0, 2).join('; ')}`;
        }
        if (hotspots && hotspots.length > 0) {
            text += `. Pontos críticos: ${hotspots.slice(0, 2).join(', ')}`;
        }
        text += '.';

        return text;
    }

    _updateRegionInfo(nearSafe, nearTransport) {
        const safeEl = document.getElementById('nearby-safepoints');
        if (safeEl) {
            if (nearSafe.length === 0) {
                safeEl.textContent = 'Nenhum próximo';
                safeEl.style.color = 'var(--text-dim)';
            } else {
                safeEl.textContent = `${nearSafe.length} disponível(is)`;
                safeEl.style.color = 'var(--crt-green)';
            }
        }

        const transportEl = document.getElementById('nearby-transport');
        if (transportEl) {
            if (nearTransport.length === 0) {
                transportEl.textContent = 'Nenhum próximo';
                transportEl.style.color = 'var(--text-dim)';
            } else {
                const metros = nearTransport.filter(t => t.type === 'metro').length;
                const onibus = nearTransport.filter(t => t.type === 'onibus').length;
                const parts = [];
                if (metros > 0) parts.push(`${metros} metrô`);
                if (onibus > 0) parts.push(`${onibus} ônibus`);
                transportEl.textContent = parts.join(', ');
                transportEl.style.color = 'var(--text-primary)';
            }
        }
    }

    getCurrentLevel() { return this._currentLevel; }
}
