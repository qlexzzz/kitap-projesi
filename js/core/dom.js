/* Ekranlar arası geçiş ve ortak arayüz yardımcıları. */

import { $$, $ } from './utils.js';

/* Kitap detayı / okuma / test ekranları da "Kitaplık" sekmesinin altındadır. */
const NAV_SECTION = {
    'book-detail-module': 'library-module',
    'reading-module':     'library-module',
    'quiz-module':        'library-module',
    'result-module':      'library-module',
};

/** Ekran değiştirir ve ilgili çizim fonksiyonunu çağırır. */
export function showModule(name, renderers = {}) {
    $$('.module').forEach(m => m.classList.toggle('hidden', m.dataset.module !== name));

    const section = NAV_SECTION[name] || name;
    $$('#topbar-nav .nav-btn[data-nav]').forEach(b =>
        b.classList.toggle('is-active', b.dataset.nav === section));

    // Okuma ekranında yan panel gizlenir; açık kitap genişlik ister.
    document.body.classList.toggle('is-reading', name === 'reading-module');

    // Odak modu okuma ekranına ait. Buradan çıkınca kendiliğinden kapanır,
    // yoksa test/profil ekranı çıkışsız kalıyordu.
    if (name !== 'reading-module' && document.body.classList.contains('is-focus')) {
        setFocus(false);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    safeRender(renderers[name]);
}

/** Modül çizimi sırasında oluşabilecek hataların UI'yi düşürmesini engeller. */
export function safeRender(fn) {
    if (typeof fn !== 'function') return;
    try {
        const out = fn();
        if (out && typeof out.catch === 'function') out.catch(err => console.error(err));
    } catch (err) {
        console.error(err);
    }
}

/** Odak modu: okuma sırasında arayüzü sadeleştirir. */
export function setFocus(on) {
    document.body.classList.toggle('is-focus', on);
    ['#focus-button', '#focus-button-2'].forEach(sel => {
        const btn = $(sel);
        if (!btn) return;
        btn.setAttribute('aria-pressed', String(on));
        btn.textContent = on ? 'Odaktan çık' : 'Odak modu';
    });

    // Odak modunda üst çubuk ve alt satır gizlendiği için tek çıkış yolu
    // sabit duran bu düğme. Bağlama burada yapılır ki her çağrıda tazelensin.
    const exit = $('#focus-exit');
    if (exit) exit.onclick = () => setFocus(false);
}
