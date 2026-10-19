/* Kitap listesi, filtreler, kapak görselleri ve kitap detay ekranı. */

import { $, $$, escapeHtml, fmtNumber, yearRange, toast } from '../core/utils.js';
import { BOOKS_DATA, findBook, state, AVERAGE_READ_WPM } from '../core/state.js';
import { userDoc, PHASE } from '../core/progress.js';
import { db } from '../core/firebase.js';
import { showModule } from '../core/dom.js';
import { coverMarkup, findCoverUrl } from './covers.js';
import { loadBookReviews, renderReviews, focusReviewForm } from './reviews.js';

let libraryFilter = 'all';

export function getFilter() { return libraryFilter; }
export function setFilter(value) {
    libraryFilter = value;
    renderLibrary();
}

/* ─────────── kapak görselleri ─────────── */

let coverLookupDone = false;

/**
 * Gerçek kapak görselini bir kez arar. books.js'te coverUrl yoksa Open
 * Library'a sorulur; sonuç localStorage'a yazılır, bulunamazsa tasarlanmış
 * kapak kalır ve bir daha sorulmaz.
 */
async function ensureCovers() {
    if (coverLookupDone) return;
    coverLookupDone = true;

    const cache = readCoverCache();
    const pending = BOOKS_DATA.filter(b => !b.coverUrl && !cache[b.id]);

    BOOKS_DATA.forEach(b => { if (cache[b.id]) applyCoverImage(b, cache[b.id]); });
    if (!pending.length) return;

    const found = {};
    await Promise.all(pending.map(async b => {
        const url = await findCoverUrl(b.title, b.author);
        if (url) { found[b.id] = url; applyCoverImage(b, url); }
    }));

    if (Object.keys(found).length) writeCoverCache({ ...cache, ...found });
}

function readCoverCache() {
    try { return JSON.parse(localStorage.getItem('kitap:covers')) || {}; } catch { return {}; }
}

function writeCoverCache(data) {
    try { localStorage.setItem('kitap:covers', JSON.stringify(data)); } catch { /* kota dolu */ }
}

/** Bulunan görseli kitap kartına, detay kapağına ve devam bandına yerleştirir. */
function applyCoverImage(book, url) {
    const mark = el => {
        if (!el) return;
        el.classList.add('has-img');
        let img = el.querySelector('.cover-img');
        if (!img) {
            img = document.createElement('img');
            img.className = 'cover-img';
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.addEventListener('error', () => el.classList.remove('has-img'));
            el.prepend(img);
        }
        img.src = url;
    };

    mark($(`#book-list [data-book="${book.id}"] .book-cover`));
    if (state.book?.id === book.id) mark($('#detail-cover .book-cover'));
    mark($('#resume-cover .book-cover'));
}

/* ─────────── kitaplık ─────────── */

export function renderLibrary() {
    renderResumeBanner();
    ensureCovers();

    const books = BOOKS_DATA.filter(b => {
        if (libraryFilter === 'fav') return userDoc.isFavorite(b.id);
        if (libraryFilter === 'todo') return userDoc.phaseOf(b.id) !== PHASE.DONE;
        return true;
    });

    const host = $('#book-list');
    if (!host) return;

    $$('[data-filter]').forEach(b => b.classList.toggle('is-active', b.dataset.filter === libraryFilter));

    if (!books.length) {
        host.innerHTML = `<p class="empty">${libraryFilter === 'fav' ? 'Henüz favori kitap yok.' : 'Bittiğin kitap yok.'}</p>`;
        return;
    }

    host.innerHTML = books.map(book => {
        const rating = state.ratings[book.id] || { avg: 0, count: 0 };
        const phase = userDoc.phaseOf(book.id);
        const words = state.words[book.id] || 0;
        const fav = userDoc.isFavorite(book.id);

        const status = phase === PHASE.DONE     ? '<span class="status status-done">Bitti</span>'
                     : phase === PHASE.QUIZ    ? '<span class="status status-active">Test bekliyor</span>'
                     : phase === PHASE.READING ? '<span class="status status-active">Devam et</span>'
                     : '<span class="status status-new">Yeni</span>';

        return `
            <button class="book-card" data-book="${book.id}">
                ${coverMarkup(book)}
                <span class="book-body">
                    <span class="book-title">${fav ? '<span class="fav-mark">★</span> ' : ''}${escapeHtml(book.title)}</span>
                    <span class="book-author">${escapeHtml(book.author)}</span>
                    <span class="book-meta">
                        ${status}
                        ${rating.count
                            ? `<span class="book-rating"><span class="star on">★</span><b>${fmtNumber(rating.avg)}</b><span class="rating-count">(${rating.count})</span></span>`
                            : '<span class="rating-count">Yorum yok</span>'}
                    </span>
                    <span class="book-stats">${words.toLocaleString('tr-TR')} kelime · ~${estimatedMinutes(book)} dk</span>
                </span>
            </button>`;
    }).join('');

    host.querySelectorAll('[data-book]').forEach(card => {
        card.addEventListener('click', () => openBook(card.dataset.book));
    });
}

function estimatedMinutes(book) {
    return Math.max(1, Math.round((state.words[book.id] || 0) / AVERAGE_READ_WPM));
}

function renderResumeBanner() {
    const banner = $('#resume-banner');
    const res = userDoc.resumable();
    if (!res) { banner.classList.add('hidden'); return; }

    const book = findBook(res.bookId);
    if (!book) { banner.classList.add('hidden'); return; }

    banner.classList.remove('hidden');
    $('#resume-cover').innerHTML = coverMarkup(book);

    const inQuiz = res.phase === PHASE.QUIZ;
    $('#resume-label').textContent = inQuiz ? 'Testi çözmek seni bekliyor' : 'Kaldığın yerden devam et';
    $('#resume-title').textContent = book.title;
    $('#resume-meta').textContent = inQuiz
        ? `${book.quiz.length} soru · ${book.author}`
        : `Sayfa ${res.page + 1} · ${book.author}`;
    $('#resume-btn').textContent = inQuiz ? 'Teste geç' : 'Devam et';
    $('#resume-btn').onclick = () => openResumable(res, book);
}

/**
 * Devam bandındaki düğme: teste mi okumaya mı döneceğine göre yönlendirir.
 * openReader / startQuiz buraya enjekte edilir (sirküler bağımlılık olmasın).
 */
let resumeHandlers = {};
export function setResumeHandlers(handlers) { resumeHandlers = handlers; }

function openResumable(res, book) {
    state.book = book;
    if (res.phase === PHASE.QUIZ) resumeHandlers.onQuiz?.(book);
    else openBook(res.bookId);
}

/* ─────────── kitap detay ─────────── */

export function openBook(bookId) {
    const book = findBook(bookId);
    if (!book) return;
    state.book = book;
    renderBookDetail();
    showModule('book-detail-module');
}

export async function renderBookDetail() {
    const book = state.book;
    if (!book) return showModule('library-module');

    $('#detail-cover').innerHTML = coverMarkup(book, { size: 'lg' });
    $('#detail-era').textContent = yearRange(book.era);
    $('#detail-title').textContent = book.title;
    $('#detail-author').textContent = book.author;
    $('#detail-summary').textContent = book.summary;
    $('#detail-tags').innerHTML = book.tags.map(t => `<li class="tag">${escapeHtml(t)}</li>`).join('');

    const phase = userDoc.phaseOf(book.id);
    $('#detail-start-btn').textContent =
        phase === PHASE.DONE      ? 'Yeniden oku' :
        phase === PHASE.QUIZ     ? 'Teste geç'    :
        phase === PHASE.READING  ? 'Okumaya devam et' : 'Okumayı başlat';

    const fav = userDoc.isFavorite(book.id);
    const favBtn = $('#detail-fav-btn');
    favBtn.setAttribute('aria-pressed', String(fav));
    favBtn.textContent = fav ? '★ Favoride' : '☆ Favoriye ekle';

    $('#detail-start-btn').onclick = () => {
        if (phase === PHASE.QUIZ) resumeHandlers.onQuiz?.(book);
        else resumeHandlers.onRead?.(book);
    };
    $('#detail-write-btn').onclick = focusReviewForm;

    await refreshBookReviews();
}

async function refreshBookReviews() {
    if (!state.book) return;
    try {
        renderReviews(await loadBookReviews(state.book.id));
    } catch (err) {
        console.error(err);
        toast('Yorumlar yüklenemedi.', 'err');
    }
}

/** Tüm kitapların ortalama puanını tek seferde çeker (kartlar için). */
export async function refreshRatings() {
    try {
        const snap = await db.collection('bookReviews').get();
        const acc = {};
        snap.forEach(d => {
            const r = d.data();
            if (!r?.bookId) return;
            acc[r.bookId] ??= { sum: 0, count: 0 };
            acc[r.bookId].sum += Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)));
            acc[r.bookId].count++;
        });
        state.ratings = {};
        Object.entries(acc).forEach(([id, v]) => {
            state.ratings[id] = { avg: v.sum / v.count, count: v.count };
        });
    } catch (err) {
        console.error(err);
    }
}

export { refreshBookReviews };
