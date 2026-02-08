export function weightedRandom(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

export function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

export function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min, max) {
    return Math.random() * (max - min) + min;
}

export function gaussRandom(mean = 0, stdev = 1) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + stdev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export function formatCurrency(amount) {
    if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return '$' + (amount / 1000).toFixed(0) + 'K';
    return '$' + amount.toLocaleString();
}

export function formatSalary(amount) {
    return '$' + (amount / 1000000).toFixed(2) + 'M';
}

export function formatPct(val) {
    return (val * 100).toFixed(1) + '%';
}

export function formatStat(val, decimals = 1) {
    return typeof val === 'number' ? val.toFixed(decimals) : '0.0';
}

export function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function generateId(prefix = '') {
    return prefix + Math.random().toString(36).substr(2, 9);
}

export function ratingClass(ovr) {
    if (ovr >= 90) return 'rating-elite';
    if (ovr >= 80) return 'rating-great';
    if (ovr >= 70) return 'rating-good';
    if (ovr >= 60) return 'rating-avg';
    if (ovr >= 50) return 'rating-below';
    return 'rating-poor';
}

export function heightToString(inches) {
    return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export function sortBy(arr, key, desc = false) {
    return [...arr].sort((a, b) => {
        const va = typeof key === 'function' ? key(a) : a[key];
        const vb = typeof key === 'function' ? key(b) : b[key];
        return desc ? (vb - va) : (va - vb);
    });
}

export function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
        const k = typeof key === 'function' ? key(item) : item[key];
        (acc[k] = acc[k] || []).push(item);
        return acc;
    }, {});
}

export function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
