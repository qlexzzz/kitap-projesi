/* Görünüm tercihleri: renk teması, koyu/açık mod ve okuma yazı tipi.
   Tercihler localStorage'da tutulur; index.html başındaki küçük blok
   ilk boyamadan önce uygular, böylece tema titremesi olmaz. */

import { $, $$ } from './utils.js';

const PREFS_KEY = 'kitap:prefs';

const PREFS = {
    accent:   'amber',
    mode:     'dark',
    readFont: 'serif',
};

const ACCENTS = [
    { id: 'amber',  name: 'Kehribar' },
    { id: 'rose',   name: 'Gül' },
    { id: 'teal',   name: 'Deniz' },
    { id: 'indigo', name: 'Çivit' },
    { id: 'sage',   name: 'Adaçayı' },
];

export function loadPrefs() {
    try {
        Object.assign(PREFS, JSON.parse(localStorage.getItem(PREFS_KEY)) || {});
    } catch { /* bozuk veri: varsayılanlarda kal */ }
    applyPrefs();
}

export function applyPrefs() {
    const root = document.documentElement;
    root.dataset.accent = PREFS.accent;
    root.dataset.mode = PREFS.mode;
    root.dataset.readfont = PREFS.readFont;

    $$('#accent-row [data-accent]').forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.accent === PREFS.accent)));
    $$('#mode-switch [data-mode]').forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.mode === PREFS.mode)));
    $$('#font-row [data-font]').forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.font === PREFS.readFont)));
}

function savePrefs() {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(PREFS));
    } catch { /* kota dolu veya özel mod */ }
}

/** Ayarlar arayüzünü kurar ve seçimleri bağlar. */
export function bindPrefs() {
    $('#accent-row').innerHTML = ACCENTS.map(a => `
        <button class="swatch" data-accent="${a.id}" title="${a.name}"
                aria-label="${a.name}" aria-pressed="false"></button>`).join('');

    $('#accent-row').addEventListener('click', e => {
        const btn = e.target.closest('[data-accent]');
        if (!btn) return;
        PREFS.accent = btn.dataset.accent;
        savePrefs(); applyPrefs();
    });

    $('#mode-switch').addEventListener('click', e => {
        const btn = e.target.closest('[data-mode]');
        if (!btn) return;
        PREFS.mode = btn.dataset.mode;
        savePrefs(); applyPrefs();
    });

    $('#font-row').addEventListener('click', e => {
        const btn = e.target.closest('[data-font]');
        if (!btn) return;
        PREFS.readFont = btn.dataset.font;
        savePrefs(); applyPrefs();
    });

    loadPrefs();
}
