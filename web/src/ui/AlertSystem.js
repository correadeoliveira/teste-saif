import { alertMessages, contextMessages } from '../data/MockData.js';

export class AlertSystem {
    constructor() {
        this._alertCycleIndex = 5;
        this._contextIndex = 0;
    }

    init() {
        this._populateAlerts();
        this._updateContext();
        this._startAlertCycle();
    }

    _populateAlerts() {
        const initial = alertMessages.slice(0, 5);
        initial.forEach((a, idx) => {
            setTimeout(() => this._addToFeed(a.type, a.msg), idx * 280);
        });
    }

    _addToFeed(type, msg) {
        const feed = document.getElementById('alerts-feed');
        if (!feed) return;
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const item = document.createElement('div');
        item.className = `alert-item ${type}-alert`;
        item.innerHTML = `<span class="alert-time">${time}</span><span class="alert-msg">${msg}</span>`;
        feed.prepend(item);

        while (feed.children.length > 14) {
            feed.removeChild(feed.lastChild);
        }
    }

    // Alias público para uso externo
    addAlertToFeed(type, msg) { this._addToFeed(type, msg); }

    _startAlertCycle() {
        setInterval(() => {
            const alert = alertMessages[this._alertCycleIndex % alertMessages.length];
            this._addToFeed(alert.type, alert.msg);
            this._alertCycleIndex++;
        }, 14000);
    }

    _updateContext() {
        const el = document.getElementById('context-text');
        if (!el) return;
        el.classList.remove('typing');

        const msg = contextMessages[this._contextIndex % contextMessages.length];
        el.textContent = msg;
        this._contextIndex++;
        setTimeout(() => this._updateContext(), 22000);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}-toast`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 280);
        }, 3500);
    }
}
