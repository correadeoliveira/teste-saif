// ═══════════════════════════════════════════════════
// SAIFEN — ContactsLayer — Contatos de Segurança
// Exibe localizações em tempo real de contatos de
// confiança, sempre visíveis no mapa.
// ═══════════════════════════════════════════════════

export class ContactsLayer {
    constructor(map) {
        this.map = map;
        this._group = L.layerGroup();
        this._markers = {};
        this._contacts = [
            {
                id: 'mae',
                name: 'Mãe',
                fullName: 'Maria C.',
                avatar: '👩',
                lat: -23.5580,
                lng: -46.6620,
                status: 'online',
                lastSeen: 'Agora',
                battery: 82,
            },
            {
                id: 'pai',
                name: 'Pai',
                fullName: 'Carlos C.',
                avatar: '👨',
                lat: -23.5420,
                lng: -46.6290,
                status: 'online',
                lastSeen: 'Agora',
                battery: 45,
            },
            {
                id: 'namorada',
                name: 'Namorada',
                fullName: 'Ana L.',
                avatar: '👧',
                lat: -23.5510,
                lng: -46.6480,
                status: 'online',
                lastSeen: 'Agora',
                battery: 67,
            },
        ];

        this._driftIntervals = [];
        this._styleInjected = false;
    }

    init() {
        this._injectStyles();

        this._contacts.forEach(contact => {
            const marker = this._createMarker(contact);
            this._markers[contact.id] = { marker, data: { ...contact } };
            this._group.addLayer(marker);
        });

        // Sempre visível — sem toggle
        this._group.addTo(this.map);

        // Simula movimento em tempo real
        this._startRealtimeSimulation();
    }

    _injectStyles() {
        if (this._styleInjected) return;
        const style = document.createElement('style');
        style.textContent = `
            .marker-contact {
                background: none !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                overflow: visible;
            }

            .contact-marker-inner {
                position: relative;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(0, 180, 255, 0.85), rgba(0, 120, 200, 0.35));
                box-shadow: 0 0 10px rgba(0, 180, 255, 0.45), 0 0 22px rgba(0, 140, 220, 0.15);
                border: 2px solid rgba(0, 200, 255, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                animation: contact-pulse 3s ease-in-out infinite;
                cursor: pointer;
                transition: transform 0.2s ease;
            }

            .marker-contact:hover .contact-marker-inner {
                transform: scale(1.2);
            }

            .contact-avatar {
                font-size: 16px;
                line-height: 1;
                filter: drop-shadow(0 0 2px rgba(0,0,0,0.4));
            }

            .contact-status-dot {
                position: absolute;
                bottom: -1px;
                right: -1px;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                border: 2px solid rgba(0, 0, 0, 0.7);
            }

            .contact-status-dot.online {
                background: #00ff9f;
                box-shadow: 0 0 6px rgba(0, 255, 159, 0.6);
                animation: contact-status-blink 2.5s ease-in-out infinite;
            }

            .contact-status-dot.offline {
                background: #555;
            }

            .contact-label {
                margin-top: 2px;
                font-family: 'Share Tech Mono', 'JetBrains Mono', monospace;
                font-size: 9px;
                font-weight: bold;
                color: rgba(0, 200, 255, 0.9);
                text-transform: uppercase;
                letter-spacing: 0.08em;
                text-shadow: 0 0 6px rgba(0, 180, 255, 0.4);
                white-space: nowrap;
                text-align: center;
                pointer-events: none;
            }

            @keyframes contact-pulse {
                0%, 100% {
                    box-shadow: 0 0 10px rgba(0, 180, 255, 0.45), 0 0 22px rgba(0, 140, 220, 0.15);
                }
                50% {
                    box-shadow: 0 0 16px rgba(0, 180, 255, 0.65), 0 0 34px rgba(0, 140, 220, 0.25);
                }
            }

            @keyframes contact-status-blink {
                0%, 100% { opacity: 1; }
                50%      { opacity: 0.4; }
            }
        `;
        document.head.appendChild(style);
        this._styleInjected = true;
    }

    _createIcon(contact) {
        return L.divIcon({
            className: 'custom-marker marker-contact',
            html: `
                <div style="display:flex;flex-direction:column;align-items:center;">
                    <div class="contact-marker-inner">
                        <span class="contact-avatar">${contact.avatar}</span>
                        <span class="contact-status-dot ${contact.status}"></span>
                    </div>
                    <span class="contact-label">${contact.name}</span>
                </div>
            `,
            iconSize: [50, 52],
            iconAnchor: [25, 52],
            popupAnchor: [0, -54],
        });
    }

    _createPopup(contact) {
        const batteryColor = contact.battery > 60
            ? '#00ff9f'
            : contact.battery > 25
                ? '#ffaa00'
                : '#cc2244';

        const batteryIcon = contact.battery > 25 ? '🔋' : '🪫';

        return `<div class="popup-inner" style="font-family:'Share Tech Mono','JetBrains Mono',monospace;">
            <div class="popup-type" style="color:rgba(0,200,255,0.85);font-size:0.6rem;letter-spacing:0.1em;margin-bottom:4px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#00ff9f;margin-right:6px;box-shadow:0 0 4px #00ff9f80;"></span>CONTATO DE SEGURANÇA
            </div>
            <div style="font-size:0.85rem;font-weight:bold;color:#00b4ff;margin-bottom:2px;">
                ${contact.avatar} ${contact.fullName}
            </div>
            <div style="text-transform:uppercase;letter-spacing:.06em;font-size:0.6rem;color:rgba(0,200,255,0.5);margin-bottom:8px;">
                ${contact.name}
            </div>
            <div style="padding-top:6px;border-top:1px solid rgba(0,180,255,0.12);">
                <div style="font-size:0.6rem;color:#888;margin:3px 0;">
                    <span style="color:rgba(0,200,255,0.5);letter-spacing:.08em;">STATUS:</span>
                    <span style="color:#00ff9f;">● ONLINE</span>
                </div>
                <div style="font-size:0.6rem;color:#888;margin:3px 0;">
                    <span style="color:rgba(0,200,255,0.5);letter-spacing:.08em;">VISTO:</span>
                    ${contact.lastSeen}
                </div>
                <div style="font-size:0.6rem;color:#888;margin:3px 0;">
                    <span style="color:rgba(0,200,255,0.5);letter-spacing:.08em;">BATERIA:</span>
                    <span style="color:${batteryColor};">${batteryIcon} ${contact.battery}%</span>
                </div>
            </div>
            <div style="margin-top:6px;padding-top:4px;border-top:1px solid rgba(0,180,255,0.06);font-size:0.55rem;color:rgba(0,200,255,0.4);letter-spacing:0.06em;">
                Localização em tempo real
            </div>
        </div>`;
    }

    _createMarker(contact) {
        const icon = this._createIcon(contact);
        const marker = L.marker([contact.lat, contact.lng], {
            icon,
            zIndexOffset: 1000,
        }).bindPopup(this._createPopup(contact), { maxWidth: 260, minWidth: 180 });

        marker.on('mouseover', function () { this.openPopup(); });

        return marker;
    }

    /**
     * Simula o movimento suave dos contatos no mapa,
     * como se estivessem se movendo em tempo real.
     */
    _startRealtimeSimulation() {
        const DRIFT = 0.00015; // ~15m de variação
        const INTERVAL = 3000; // a cada 3s

        Object.values(this._markers).forEach(({ marker, data }) => {
            const iv = setInterval(() => {
                const cur = marker.getLatLng();
                const newLat = cur.lat + (Math.random() - 0.5) * DRIFT;
                const newLng = cur.lng + (Math.random() - 0.5) * DRIFT;
                marker.setLatLng([newLat, newLng]);

                data.lat = newLat;
                data.lng = newLng;
            }, INTERVAL);

            this._driftIntervals.push(iv);
        });
    }

    destroy() {
        this._driftIntervals.forEach(iv => clearInterval(iv));
        this._driftIntervals = [];
        this.map.removeLayer(this._group);
    }
}