/* Ortak yardımcılar: güvenli metin, tarih, bildirim, yıldız bileşeni */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Kullanıcı içeriğini innerHTML'e basmadan önce kaçış uygular. */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

/** "Ali Yılmaz" → "AY" */
export function initials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toLocaleUpperCase('tr-TR');
}

export function formatDate(date) {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function relativeTime(date) {
    if (!date) return '';
    const then = (date.toDate ? date.toDate() : new Date(date)).getTime();
    const diffMin = Math.floor((Date.now() - then) / 60000);
    if (diffMin < 1) return 'az önce';
    if (diffMin < 60) return `${diffMin} dk önce`;
    const hours = Math.floor(diffMin / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'dün';
    if (days < 30) return `${days} gün önce`;
    return formatDate(date);
}

/** 3.7 → "3,7" */
export function fmtNumber(n, digits = 1) {
    return Number(n || 0).toLocaleString('tr-TR', {
        minimumFractionDigits: digits, maximumFractionDigits: digits
    });
}

/** Başlığı biçimlendirir: "1950-1970" → "1950–1970" */
export function yearRange(era) {
    return String(era || '').replace('-', '–');
}

/** Karşılaştırma için başlık/yazar normalizasyonu: küçük harf, aksan ve noktalama yok. */
export function normalizeTitle(value) {
    const map = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'ğ': 'g', 'ç': 'c', 'ö': 'o', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
    return String(value || '')
        .toLowerCase()
        .replace(/[ıİşğçöüâîû]/g, ch => map[ch] ?? ch)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/* ─────────── bildirimler ─────────── */

export function toast(message, type = '') {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const mark = { ok: '✓', err: '!', '': '' }[type] ?? '';
    const el = document.createElement('div');
    el.className = `toast ${type}`.trim();
    el.innerHTML = (mark ? `<b>${mark}</b>` : '') + `<span>${escapeHtml(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
        el.classList.add('is-out');
        setTimeout(() => el.remove(), 200);
    }, 3200);
}

/* ─────────── yıldız bileşeni ─────────── */

/**
 * Bir kapsayıcıyı yıldız bileşenine dönüştürür.
 * @param {HTMLElement} host
 * @param {number} value        1-5 arası (ondalık olabilir, salt okunur görünümde yarım yıldız)
 * @param {object} opts
 * @param {boolean} opts.readonly
 * @param {boolean} opts.large
 * @param {Function} opts.onPick  Tıklanınca çağrılır (readonly değilse)
 */
export function renderStars(host, value = 0, { readonly = false, large = false, onPick } = {}) {
    if (!host) return;
    host.innerHTML = '';
    host.dataset.readonly = String(readonly);
    host.classList.toggle('stars-lg', large);
    host.setAttribute('role', readonly ? 'img' : 'radiogroup');
    if (readonly) host.setAttribute('aria-label', `${value} / 5 yıldız`);

    const stars = [];
    for (let i = 1; i <= 5; i++) {
        const el = document.createElement(readonly ? 'span' : 'button');
        el.className = 'star';
        el.textContent = '★';
        if (readonly) el.setAttribute('aria-hidden', 'true');
        else el.type = 'button';
        stars.push(el);
        host.appendChild(el);
    }

    const paint = (val) => stars.forEach((el, idx) => {
        el.classList.toggle('on', val >= idx + 1);
    });
    paint(value);

    if (readonly || !onPick) return;

    stars.forEach((el, idx) => {
        el.addEventListener('mouseenter', () => {
            stars.forEach((s, i) => s.classList.toggle('on', i <= idx));
        });
        el.addEventListener('click', () => onPick(idx + 1));
    });

    host.addEventListener('mouseleave', () => paint(Number(host.dataset.value) || 0));
}

/** Salt okunur yıldızları "4.3" gibi bir değere göre boyar. */
export function paintReadonlyStars(host, value) {
    if (!host) return;
    host.dataset.value = value;
    renderStars(host, value, { readonly: true, large: host.classList.contains('stars-lg') });
}
