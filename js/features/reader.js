/* Okuma ekranı: 5 dakikalık oturum, sayfa sayfa metin ve ilerleme kaydı. */

import { $ } from '../core/utils.js';
import { state, READING_MINUTES, MIN_CREDITED_MINUTES } from '../core/state.js';
import { userDoc, PHASE } from '../core/progress.js';
import { showModule, setFocus } from '../core/dom.js';
import { loadText } from '../core/texts.js';
import { paginate } from './pagination.js';

export async function openReader(book) {
    state.book = book;
    state.answers = {};
    state.elapsedMinutes = 0;
    state.pages = [];
    state.pageIndex = 0;
    stopTimer();

    // Metin henüz inmemişse burada bekle: "metin yüklenemedi" ekranı çıkmasın.
    await loadText(book);

    const words = state.words[book.id] || 0;
    $('#reading-author').textContent = book.author;
    $('#reading-book-title').textContent = book.title;
    $('#reading-facts').innerHTML = `
        <span><b>${book.quiz.length}</b> soru</span>
        <span><b>${READING_MINUTES}</b> dakika</span>
        <span><b>${words.toLocaleString('tr-TR')}</b> kelime</span>`;

    $('#reading-prep').classList.remove('hidden');
    $('#book-content').classList.remove('is-open');
    $('#reading-page').textContent = '';
    $('#reading-page-right').textContent = '';
    $('#running-head-left').textContent = book.title;
    $('#running-head-right').textContent = book.author;
    $('#folio-left').textContent = '';
    $('#folio-right').textContent = '';
    $('#finish-early-button').classList.add('hidden');
    $('#timer').textContent = '05:00';
    $('#timer').classList.remove('is-low');
    $('#timer-bar-fill').style.width = '100%';

    showModule('reading-module');
    buildPages();
}

/* ─────────── sayfalama ─────────── */

/* Açık kitap için gereken en az genişlik. Altında tek yaprak gösterilir:
   dar bir yaprakta satır 40 karaktere düşüp okumayı zorlaştırıyor. */
const SPREAD_MIN_WIDTH = 1100;

/* Aynı anda birden çok bölme başlarsa yalnızca sonuncusu yazsın. */
let buildToken = 0;

function isSpread() {
    return window.innerWidth >= SPREAD_MIN_WIDTH;
}

/** Bir sayfa çevirmede kaç sayfa ilerlenir (açık kitapta iki yaprak). */
function pageStep() {
    return isSpread() ? 2 : 1;
}

/**
 * Okuma yazı tipini ölçümden önce yükler. `document.fonts.ready` tek başına
 * yetmiyor: font henüz hiçbir metinde kullanılmadıysa tarayıcı "hazır" diyor,
 * ölçüm yedek fontla yapılıyor ve gerçek font gelince sayfalar taşıyor.
 */
async function loadReadingFont(host) {
    if (!document.fonts?.load) return;
    try {
        const cs = getComputedStyle(host);
        await document.fonts.load(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`);
        await document.fonts.ready;
    } catch {
        /* yedek fontla devam */
    }
}

/** Metni görünür alana göre sayfalara böler. */
async function buildPages() {
    const token = ++buildToken;
    const book = state.book;
    const host = $('#book-content');
    const page = $('#reading-page');
    if (!book || !host || !page) return;

    const text = await loadText(book);
    if (token !== buildToken) return;   // metin inerken yeni bir bölme başladı
    host.style.fontSize = $('#font-size-slider').value + 'px';

    // Yaprak düzeni ölçümden önce kurulmalı: iki yaprağa geçince sütun
    // genişliği yarıya iner, dolayısıyla sayfa kapasitesi de değişir.
    host.dataset.spread = isSpread() ? 'wide' : 'single';

    // Sayfa ancak görünür düzendeyken ölçülebilir (display:none altında
    // clientHeight 0 döner).
    const wasOpen = host.classList.contains('is-open');
    if (!wasOpen) host.classList.add('is-open');

    // Yazı tipi henüz yüklenmediyse ölçüm yedek fontla yapılır; gerçek font
    // devreye girince satırlar büyür ve sayfalar taşar. Ölçümden önce yükle.
    await loadReadingFont(host);
    if (token !== buildToken) return;   // daha yeni bir bölme başladı

    // Ölçüm gerçek sayfa elemanının kendisi üzerinde yapılır. Ayrı bir
    // ölçüm kutusu kullanmak padding ve kenar boşluğu farkları yüzünden
    // her sayfada taşmaya yol açıyordu.
    const original = page.textContent;
    const capacity = page.clientHeight;
    state.pages = paginate(text, page, { capacity });
    page.textContent = original;
    page.scrollTop = 0;

    if (!wasOpen) host.classList.remove('is-open');

    if (!state.pages.length) state.pages = ['Bu kitap için metin yüklenemedi.'];

    // kaldığın sayfaya dön
    state.pageIndex = Math.min(userDoc.pageOf(book.id), state.pages.length - 1);
    showPage(state.pageIndex, { silent: true });
}

/** Yazı boyutu veya ekran değişti: aynı yerde kalacak şekilde yeniden böl. */
async function repaginate() {
    const anchor = state.pages.length ? (state.pageIndex + 1) / state.pages.length : 0;
    const page = $('#reading-page');
    const maxScroll = Math.max(1, page.scrollHeight - page.clientHeight);
    const scrollRatio = page.scrollTop / maxScroll;

    await buildPages();
    if (!state.pages.length) return;

    const target = Math.min(state.pages.length - 1, Math.max(0, Math.round(anchor * state.pages.length) - 1));
    showPage(target, { silent: true });
    page.scrollTop = scrollRatio * (page.scrollHeight - page.clientHeight);
}

export function showPage(index, { silent = false } = {}) {
    const total = state.pages.length;
    if (!total) return;

    const spread = isSpread();

    // Açık kitapta sol yaprak her zaman çift indekste başlar; böylece
    // ilerleme kaydı hangi sayfadan gelirse gelsin yaylım bozulmaz.
    let left = Math.max(0, Math.min(index, total - 1));
    if (spread) left -= left % 2;
    state.pageIndex = left;

    const leftPage = $('#reading-page');
    const rightPage = $('#reading-page-right');
    const rightLeaf = rightPage?.closest('.book-leaf');

    leftPage.textContent = state.pages[left];
    leftPage.scrollTop = 0;

    const rightIndex = spread ? left + 1 : -1;
    const hasRight = rightIndex >= 0 && rightIndex < total;

    if (rightPage) {
        rightPage.textContent = hasRight ? state.pages[rightIndex] : '';
        rightPage.scrollTop = 0;
        rightLeaf?.classList.toggle('is-blank', !hasRight);
    }

    $('#running-head-left').textContent = state.book?.title || '';
    $('#running-head-right').textContent = state.book?.author || '';
    $('#folio-left').textContent = String(left + 1);
    $('#folio-right').textContent = hasRight ? String(rightIndex + 1) : '';

    const shown = spread ? Math.min(2, total - left) : 1;
    const last = left + shown;          // 1 tabanlı son görünen sayfa

    $('#page-prev').disabled = left === 0;
    $('#page-next').disabled = last >= total;
    $('#pager-label').textContent = shown > 1
        ? `Sayfa ${left + 1}–${last} / ${total}`
        : `Sayfa ${left + 1} / ${total}`;
    $('#pager-fill').style.width = `${(last / total) * 100}%`;

    if (!silent) {
        animateTurn(leftPage);
        if (hasRight) animateTurn(rightPage);
        savePage();
    }
    updateReadingHint(shown);
}

/** Sayfa çevrilirken kısa bir yer değiştirme hissi. */
function animateTurn(page) {
    if (!page) return;
    page.classList.remove('is-turn');
    void page.offsetWidth;   // sınıfı yeniden eklemek için düzen hesaplansın
    page.classList.add('is-turn');
}

/** Yön: -1 önceki, +1 sonraki yaylım. */
export function turnPage(direction) {
    showPage(state.pageIndex + direction * pageStep());
}

function updateReadingHint(shown = 1) {
    const remaining = state.pages.length - state.pageIndex - shown;
    $('#reading-hint').textContent = remaining
        ? `${remaining} sayfa kaldı. Okumayı bitirdiğinde test açılır.`
        : 'Son sayfa. Bitirdiğinde test açılır.';
}

async function savePage() {
    if (!state.user || !state.book) return;
    const bookId = state.book.id;
    try {
        await userDoc.save(state.user.uid, bookId, { page: state.pageIndex });
    } catch (err) {
        console.error(err);
    }
}

/* ─────────── oturum ─────────── */

export async function startSession() {
    const book = state.book;
    if (!book) return;

    $('#reading-prep').classList.add('hidden');
    $('#book-content').classList.add('is-open');
    $('#finish-early-button').classList.remove('hidden');

    if (!state.pages.length) await buildPages();
    showPage(state.pageIndex, { silent: true });

    state.sessionStart = Date.now();
    let left = READING_MINUTES * 60;

    stopTimer();
    state.timerId = setInterval(() => {
        left--;
        const min = String(Math.floor(left / 60)).padStart(2, '0');
        const sec = String(left % 60).padStart(2, '0');
        const timer = $('#timer');
        timer.textContent = `${min}:${sec}`;
        timer.classList.toggle('is-low', left <= 30);
        $('#timer-bar-fill').style.width = `${(left / (READING_MINUTES * 60)) * 100}%`;
        if (left <= 0) finishReading();
    }, 1000);

    if (state.user) {
        userDoc.save(state.user.uid, book.id, { phase: PHASE.READING }).catch(() => {});
    }
}

export function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
}

/** Okuma bitti: süreyi kaydeder ve teste geçer (onQuiz enjekte edilir). */
let onQuiz = null;
export function setQuizStarter(fn) { onQuiz = fn; }

export async function finishReading() {
    stopTimer();
    if (!state.book) return;

    // Gerçek geçen süre; "bitir" butonuyla saniyeler içinde çıkılmasın
    // diye taban değer uygulanır.
    const real = (Date.now() - state.sessionStart) / 60000;
    state.elapsedMinutes = Math.max(MIN_CREDITED_MINUTES, real);

    await userDoc.save(state.user.uid, state.book.id, {
        phase: PHASE.QUIZ,
        page: state.pageIndex,
        elapsed: Number(state.elapsedMinutes.toFixed(2)),
    });

    onQuiz?.(state.book);
}

export { repaginate, setFocus };
