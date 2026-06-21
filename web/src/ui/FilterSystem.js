export class FilterSystem {
    constructor() {
        this._filters = {
            types: ['furto', 'roubo', 'assalto', 'agressao', 'trafico'],
            period: 'all',
            region: 'all',
        };
        this._callbacks = [];
    }

    init() {
        this._bindTypeCheckboxes();
        this._bindPeriodSelect();
        this._bindRegionSelect();
    }

    _bindTypeCheckboxes() {
        const checkboxes = document.querySelectorAll('[data-filter="type"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const checked = [...document.querySelectorAll('[data-filter="type"]:checked')]
                    .map(el => el.value);
                this._filters.types = checked;
                this._emit();
            });
        });
    }

    _bindPeriodSelect() {
        const sel = document.getElementById('filter-period');
        if (!sel) return;
        sel.addEventListener('change', () => {
            this._filters.period = sel.value;
            this._emit();
        });
    }

    _bindRegionSelect() {
        const sel = document.getElementById('filter-region');
        if (!sel) return;
        sel.addEventListener('change', () => {
            this._filters.region = sel.value;
            this._emit();
        });
    }

    _emit() {
        document.dispatchEvent(new CustomEvent('filters:changed', { detail: { ...this._filters } }));
        this._callbacks.forEach(cb => cb({ ...this._filters }));
    }

    getActiveFilters() { return { ...this._filters }; }

    setFilter(key, value) {
        this._filters[key] = value;
        this._emit();
    }

    onChange(callback) {
        this._callbacks.push(callback);
    }
}
