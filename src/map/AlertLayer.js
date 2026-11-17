// ═══════════════════════════════════════════════════
// SAIFEN — AlertLayer — alertas de ocorrência
//
// Faz surgir no mapa um marcador de alerta a cada 5s, num ponto
// aleatório dos arredores da área visível, com um triângulo de
// exclamação e a legenda embaixo. Mesmo tamanho dos contatos.
//
// IMPORTANTE: os eventos são SIMULADOS. A base de calor do mapa vem de
// boletins reais da SSP-SP, e misturar eventos fictícios com dado real
// seria enganoso. Por isso todo marcador e todo popup carregam a marca
// "SIMULADO" de forma visível, e o rótulo diz "alerta simulado".
// Para ligar em feed real, troque `_spawn` por uma chamada de API e
// mantenha o rótulo — que é o que separa dado real de demonstração.
// ═══════════════════════════════════════════════════

const SPAWN_INTERVAL = 5000;   // a cada 5s, como pedido
const ALERT_TTL = 22000;       // some sozinho para o mapa não acumular
const FADE_OUT = 1400;         // duração do fade antes de remover

// Raio de "arredores": fração do espaço visível usada como área de sorteio.
const SPREAD_X = 0.62;
const SPREAD_Y = 0.58;

export class AlertLayer {
    constructor(map) {
        this.map = map;
        this._group = L.layerGroup();
        this._live = [];
        this._timer = null;
        this._seq = 0;
        this._styleInjected = false;
        this._running = false;
    }

    init() {
        this._injectStyles();
        this.start();
    }

    start() {
        if (this._running) return;
        this._running = true;
        // Primeiro alerta já no start, senão a tela fica 5s vazia.
        this._spawn();
        this._timer = setInterval(() => this._spawn(), SPAWN_INTERVAL);
    }

    stop() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
        this._running = false;
    }

    _injectStyles() {
        if (this._styleInjected) return;
        const style = document.createElement('style');
        style.textContent = `
            .marker-alert {
                background: none !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                overflow: visible;
            }

            .alert-wrap {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                cursor: pointer;
                animation: alert-in 420ms cubic-bezier(.2,.9,.3,1.4) both;
            }

            /* anel que se expande uma vez ao surgir */
            .alert-ring {
                position: absolute;
                top: 1px;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                border: 1px solid rgba(255, 122, 26, 0.85);
                animation: alert-ring 1.5s ease-out 1 both;
                pointer-events: none;
            }

            .alert-tri {
                position: relative;
                width: 28px;
                height: 24px;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 5px;
                clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
                background: linear-gradient(180deg, #ffd633 0%, #ff7a1a 78%, #ff5500 100%);
                filter: drop-shadow(0 0 6px rgba(255, 122, 26, 0.75))
                        drop-shadow(0 1px 2px rgba(0,0,0,0.6));
                animation: alert-pulse 2.2s ease-in-out infinite;
            }

            .alert-bang {
                font-size: 12px;
                font-weight: 900;
                line-height: 1;
                color: #0a0800;
                letter-spacing: 0;
            }

            .alert-label {
                margin-top: 1px;
                padding: 1px 4px;
                font-family: 'Share Tech Mono', 'JetBrains Mono', monospace;
                font-size: 8px;
                font-weight: bold;
                color: #ffc23d;
                text-transform: uppercase;
                letter-spacing: 0.07em;
                white-space: nowrap;
                background: rgba(10, 8, 0, 0.78);
                border: 1px solid rgba(255, 122, 26, 0.35);
                border-radius: 2px;
                text-shadow: 0 0 5px rgba(255, 122, 26, 0.5);
                pointer-events: none;
            }

            .alert-label .sim {
                color: #ff7a1a;
                opacity: 0.75;
                font-weight: normal;
            }

            .marker-alert.is-fading .alert-wrap {
                animation: alert-out ${FADE_OUT}ms ease-in both;
            }

            .marker-alert:hover .alert-tri {
                filter: drop-shadow(0 0 10px rgba(255, 214, 51, 1))
                        drop-shadow(0 1px 2px rgba(0,0,0,0.6));
            }

            @keyframes alert-in {
                0%   { opacity: 0; transform: translateY(-8px) scale(0.6); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
            }

            @keyframes alert-out {
                0%   { opacity: 1; }
                100% { opacity: 0; transform: translateY(6px) scale(0.85); }
            }

            @keyframes alert-pulse {
                0%, 100% { transform: translateY(0) scale(1); }
                50%      { transform: translateY(-2px) scale(1.06); }
            }

            @keyframes alert-ring {
                0%   { opacity: 0.9; transform: scale(0.5); }
                100% { opacity: 0;   transform: scale(3.1); }
            }

            @media (prefers-reduced-motion: reduce) {
                .alert-wrap, .alert-tri, .alert-ring, .marker-alert.is-fading .alert-wrap {
                    animation: none !important;
                }
            }
        `;
        document.head.appendChild(style);
        this._styleInjected = true;
    }

    /**
     * Sorteia um ponto aleatório dentro da área visível, evitando as
     * bordas. Usa coordenadas de container para garantir que cai na tela
     * em vez de num lugar fora do que o usuário está vendo.
     */
    _randomNearbyLatLng() {
        const size = this.map.getSize();
        const w = size.x * SPREAD_X;
        const h = size.y * SPREAD_Y;
        const x = (size.x - w) / 2 + Math.random() * w;
        const y = (size.y - h) / 2 + Math.random() * h;
        return this.map.containerPointToLatLng([x, y]);
    }

    _spawn() {
        const id = ++this._seq;
        const latlng = this._randomNearbyLatLng();
        const now = new Date();
        const hhmm = now.toTimeString().slice(0, 5);

        const marker = L.marker(latlng, {
            icon: this._createIcon(hhmm),
            zIndexOffset: 900, // acima do heatmap, abaixo dos contatos
            interactive: true,
            keyboard: false,
            riseOnHover: true,
        }).bindPopup(this._createPopup(hhmm), { maxWidth: 240, minWidth: 200 });

        this._group.addLayer(marker);
        if (!this._group._map) this._group.addTo(this.map);

        const life = { id, marker, timer: null, fadeTimer: null };
        this._live.push(life);

        // Some sozinho: sem TTL os marcadores se acumulariam a 12 por minuto.
        life.timer = setTimeout(() => this._retire(life), ALERT_TTL);
    }

    _retire(life) {
        if (life.fadeTimer) return;
        const el = life.marker.getElement();
        if (el) el.classList.add('is-fading');
        life.fadeTimer = setTimeout(() => {
            this._group.removeLayer(life.marker);
            this._live = this._live.filter((l) => l !== life);
        }, FADE_OUT + 60);
    }

    _createIcon(hhmm) {
        return L.divIcon({
            className: 'custom-marker marker-alert',
            html: `
                <div class="alert-wrap">
                    <span class="alert-ring"></span>
                    <div class="alert-tri"><span class="alert-bang">!</span></div>
                    <span class="alert-label">ROUBO · ${hhmm} <span class="sim">· simulado</span></span>
                </div>
            `,
            // Mesmo envelope dos contatos de família (marker-contact).
            iconSize: [50, 52],
            iconAnchor: [25, 52],
            popupAnchor: [0, -54],
        });
    }

    _createPopup(hhmm) {
        return `<div class="popup-inner" style="font-family:'Share Tech Mono','JetBrains Mono',monospace;">
            <div class="popup-type" style="color:#ff7a1a;font-size:0.6rem;letter-spacing:0.1em;margin-bottom:4px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff7a1a;margin-right:6px;box-shadow:0 0 4px #ff7a1a80;"></span>ALERTA DE OCORRÊNCIA
            </div>
            <div style="font-size:0.85rem;font-weight:bold;color:#ffc23d;margin-bottom:2px;">
                ⚠ Roubo registrado
            </div>
            <div style="text-transform:uppercase;letter-spacing:.06em;font-size:0.6rem;color:rgba(255,194,61,0.55);margin-bottom:8px;">
                ${hhmm} · zona monitorada
            </div>
            <div style="padding-top:6px;border-top:1px solid rgba(255,122,26,0.14);font-size:0.6rem;color:#8a6d00;line-height:1.5;">
                Evento <strong style="color:#ff7a1a;">simulado</strong> para demonstração de interface.
                Não corresponde a um boletim de ocorrência real.
            </div>
        </div>`;
    }

    /** Quantos alertas estão visíveis agora — útil para depurar. */
    activeCount() {
        return this._live.length;
    }

    destroy() {
        this.stop();
        this._live.forEach((l) => {
            if (l.timer) clearTimeout(l.timer);
            if (l.fadeTimer) clearTimeout(l.fadeTimer);
        });
        this._live = [];
        if (this._group._map) this.map.removeLayer(this._group);
    }
}
