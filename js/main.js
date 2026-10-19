/* Kitap Odası — giriş noktası.
   Modülleri bağlar ve uygulamayı başlatır. */

import { $, $$, toast } from './core/utils.js';
import { state } from './core/state.js';
import { userDoc } from './core/progress.js';
import { showModule, setFocus } from './core/dom.js';
import { bindPrefs } from './core/prefs.js';
import { auth } from './core/firebase.js';
import { loadAllTexts } from './core/texts.js';

import { handleAuth, toggleAuthMode, watchAuth, probeApiKey } from './app.js';
import { renderLibrary, renderBookDetail, setFilter, openBook, refreshRatings,
         refreshBookReviews, setResumeHandlers } from './features/library.js';
import { openReader, startSession, finishReading, turnPage, repaginate, setQuizStarter } from './features/reader.js';
import { startQuiz, submitQuiz, setQuizHooks } from './features/quiz.js';
import { applyProfile, renderProfile, renderLeaderboard } from './features/profile.js';
import { initDailyQuests, refreshQuests, refreshStats, renderQuestStrip } from './features/stats.js';
import { mountReviewUI, focusReviewForm, setCurrentUid } from './features/reviews.js';

/* Her ekranın çizim fonksiyonu — showModule bunları kullanır. */
const RENDERERS = {
    'library-module':     renderLibrary,
    'book-detail-module': renderBookDetail,
    'leaderboard-module': renderLeaderboard,
    'profile-module':     renderProfile,
    'reading-module':     renderQuestStrip,
};

/* ─────────── kitap metinleri ─────────── */

/* Metin yükleme core/texts.js içinde: okuyucu da aynı yolu kullanıyor. */

/* ─────────── modüller arası bağlantılar ─────────── */

function wireModules() {
    // kitaplık → okuma / test
    setResumeHandlers({
        onRead: book => openReader(book),
        onQuiz: book => startQuiz(book),
    });
    setQuizStarter(book => startQuiz(book));
    setQuizHooks({
        reviewWrite: bookId => {
            openBook(bookId);
            setTimeout(focusReviewForm, 420);
        },
        afterResult: async () => {
            await Promise.all([refreshQuests(), refreshStats(), renderLibrary()]);
        },
    });
}

/* ─────────── oturum sonrası ─────────── */

/** Kitaplığı yerel veriden anında çizer ve gösterir; ağ gerektirmez. */
function showLibraryNow() {
    renderLibrary();
    showModule('library-module', RENDERERS);
}

async function onSignedIn() {
    setCurrentUid(state.user.uid);
    applyProfile();
    initDailyQuests();

    // Profil geldi: favoriler ve ilerleme rozetleri tazelensin.
    renderLibrary();

    // Ağ verileri geldikçe kitaplığı yeniden çiz. Bu çağrıların hepsi kendi
    // hatasını yutar; biri düşse bile ekran boş kalmaz çünkü kitap listesi
    // zaten yerel `data/books.js` verisinden çizildi.
    await Promise.all([loadAllTexts(), refreshRatings()]);
    renderLibrary();
    await Promise.all([refreshQuests(), refreshStats()]);
}

/* ─────────── olay bağlama ─────────── */

function bindEvents() {
    // giriş
    $('#auth-form').addEventListener('submit', handleAuth);
    $('#toggle-auth-btn').addEventListener('click', toggleAuthMode);
    $('#sign-out-button').addEventListener('click', () => auth.signOut());

    // gezinme
    $$('#topbar-nav .nav-btn[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => showModule(btn.dataset.nav, RENDERERS));
    });
    $$('[data-back]').forEach(btn => {
        btn.addEventListener('click', () => showModule(btn.dataset.back, RENDERERS));
    });

    // okuma
    $('#start-button').addEventListener('click', startSession);
    $('#finish-early-button').addEventListener('click', finishReading);
    $('#page-prev').addEventListener('click', () => turnPage(-1));
    $('#page-next').addEventListener('click', () => turnPage(1));
    $('#focus-button').addEventListener('click', () => setFocus(true));
    $('#focus-button-2').addEventListener('click', () => setFocus(!document.body.classList.contains('is-focus')));

    $('#font-size-slider').addEventListener('input', e => {
        localStorage.setItem('kitap:fontSize', e.target.value);
        if (state.pages.length) repaginate();
    });

    // ok tuşları sayfa çevirir (okuma ekranındayken)
    document.addEventListener('keydown', e => {
        // Odaktan çıkış her zaman mümkün olsun.
        if (e.key === 'Escape' && document.body.classList.contains('is-focus')) {
            setFocus(false);
            e.preventDefault();
            return;
        }

        const reading = $('.module[data-module="reading-module"]');
        if (!reading || reading.classList.contains('hidden')) return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        // e.target her zaman Element değil (document olabilir)
        const t = e.target;
        if (t instanceof Element && t.matches('input, textarea, select, [contenteditable]')) return;
        if (e.key === 'ArrowLeft')  { turnPage(-1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { turnPage(1); e.preventDefault(); }
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (state.book && state.pages.length) repaginate();
        }, 250);
    });

    // test
    $('#submit-quiz').addEventListener('click', submitQuiz);

    // favori
    $('#detail-fav-btn').addEventListener('click', async () => {
        if (!state.user || !state.book) return;
        try {
            const on = await userDoc.toggleFavorite(state.user.uid, state.book.id);
            toast(on ? 'Favorilere eklendi.' : 'Favorilerden çıkarıldı.', 'ok');
            await renderBookDetail();
            renderLibrary();
        } catch (err) {
            console.error(err);
            toast('Favoriye eklenemedi.', 'err');
        }
    });

    // kitaplık filtreleri
    $$('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });

    // yorum arayüzü
    mountReviewUI({
        getUid: () => state.user?.uid,
        getProfile: () => state.profile,
        getBookId: () => state.book?.id,
        getBook: () => state.book,
        refresh: async () => {
            await refreshRatings();
            await refreshBookReviews();
            renderLibrary();
        },
    });
}

/* ─────────── başlat ─────────── */

document.addEventListener('DOMContentLoaded', () => {
    wireModules();
    bindEvents();
    bindPrefs();
    probeApiKey();

    const savedSize = localStorage.getItem('kitap:fontSize');
    if (savedSize) {
        $('#font-size-slider').value = savedSize;
        $('#book-content').style.fontSize = savedSize + 'px';
    }

    watchAuth(onSignedIn, showLibraryNow);

    // kitap metinleri girişten önce de hazır olsun
    loadAllTexts();
});
