import { alertMessages, contextMessages } from '../data/MockData.js';

export class AlertSystem {
    constructor() {
        this.alertCycleIndex = 5;
        this.contextIndex = 0;
    }

    init() {
        this.populateAlerts();
        this.updateContext();
        this.startAlertCycle();
    }

    populateAlerts() {
        const initial = alertMessages.slice(0, 5);
        initial.forEach((a, i) => {
            setTimeout(() => this.addAlertToFeed(a.type, a.msg), i * 300);
        });
    }

    addAlertToFeed(type, msg) {
        const feed = document.getElementById('alerts-feed');
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const item = document.createElement('div');
        item.className = `alert-item ${type}-alert`;
        item.innerHTML = `
            <span class="alert-time">${time}</span>
            <span class="alert-msg">${msg}</span>
        `;

        feed.prepend(item);

        while (feed.children.length > 15) {
            feed.removeChild(feed.lastChild);
        }
    }

    startAlertCycle() {
        setInterval(() => {
            const alert = alertMessages[this.alertCycleIndex % alertMessages.length];
            this.addAlertToFeed(alert.type, alert.msg);
            this.alertCycleIndex++;
        }, 12000);
    }

    updateContext() {
        const el = document.getElementById('context-text');
        el.classList.remove('typing');

        const msg = contextMessages[this.contextIndex % contextMessages.length];
        el.textContent = '';
        el.classList.add('typing');

        let charIdx = 0;
        const typeChar = () => {
            if (charIdx < msg.length) {
                el.textContent += msg[charIdx];
                charIdx++;
                setTimeout(typeChar, 15 + Math.random() * 20);
            } else {
                el.classList.remove('typing');
            }
        };
        typeChar();

        this.contextIndex++;
        setTimeout(() => this.updateContext(), 20000);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}-toast`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
}
