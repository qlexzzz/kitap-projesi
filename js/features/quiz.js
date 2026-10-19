/* Test ekranı, puanlama ve sonuç. */

import { $, escapeHtml, fmtNumber, toast } from '../core/utils.js';
import { state, READING_MINUTES } from '../core/state.js';
import { userDoc, PHASE } from '../core/progress.js';
import { db, serverTime } from '../core/firebase.js';
import { showModule } from '../core/dom.js';

let onReviewWrite = null;   // sonuç ekranından yorum formuna gitmek için
let onAfterResult = null;   // görev ve istatistikleri tazelemek için
export function setQuizHooks({ reviewWrite, afterResult } = {}) {
    onReviewWrite = reviewWrite;
    onAfterResult = afterResult;
}

/** Teste başlar. Teste sonradan dönülürse geçen süre kayıttan gelir. */
export function startQuiz(book) {
    state.book = book;
    state.quiz = book.quiz;

    const saved = userDoc.data.books?.[book.id]?.elapsed;
    state.elapsedMinutes = Number(saved) > 0 ? Number(saved) : READING_MINUTES;
    state.answers = {};

    renderQuiz();
    showModule('quiz-module');
}

export function renderQuiz() {
    const host = $('#quiz-area');
    if (!state.quiz.length) {
        host.innerHTML = '<p class="empty">Bu kitap için henüz soru hazırlanmamış.</p>';
        $('#submit-quiz').classList.add('hidden');
        return;
    }

    host.innerHTML = state.quiz.map((q, i) => `
        <fieldset class="quiz-question">
            <div class="quiz-q-head">
                <span class="quiz-num">${i + 1}</span>
                <p>${escapeHtml(q.question)}</p>
            </div>
            <div class="quiz-options">
                ${q.options.map((o, oi) => `
                    <label class="quiz-option">
                        <input type="radio" name="q${i}" value="${oi}">
                        <span>${escapeHtml(o)}</span>
                    </label>`).join('')}
            </div>
        </fieldset>`).join('');

    $('#submit-quiz').classList.remove('hidden');
    $('#submit-quiz').disabled = true;
    updateQuizProgress();

    // her çizimde yeniden atanır, dinleyici birikmez
    host.onchange = e => {
        if (!e.target.name?.startsWith('q')) return;
        state.answers[e.target.name] = Number(e.target.value);
        const answered = Object.keys(state.answers).length;
        $('#submit-quiz').disabled = answered !== state.quiz.length;
        updateQuizProgress(answered);
    };
}

function updateQuizProgress(answered = Object.keys(state.answers).length) {
    let bar = $('#quiz-progress-fill');
    if (!bar) {
        const wrap = document.createElement('div');
        wrap.className = 'quiz-progress';
        wrap.id = 'quiz-progress';
        wrap.innerHTML = `<span id="quiz-progress-text"></span><span class="quiz-progress-track"><span class="quiz-progress-fill" id="quiz-progress-fill"></span></span>`;
        $('.quiz-head')?.appendChild(wrap);
        bar = $('#quiz-progress-fill');
    }
    bar.style.width = (answered / state.quiz.length) * 100 + '%';
    $('#quiz-progress-text').textContent = `${answered} / ${state.quiz.length} soru`;
}

export async function submitQuiz() {
    const book = state.book;
    if (!book || !state.user) return;

    let score = 0;
    state.quiz.forEach((q, i) => {
        const picked = state.answers[`q${i}`];
        if (picked === undefined) return;
        if (q.options[picked] === q.answer) score++;

        // doğru/yanlış işaretle
        document.querySelectorAll(`input[name="q${i}"]`).forEach(input => {
            input.disabled = true;
            const row = input.closest('.quiz-option');
            if (q.options[Number(input.value)] === q.answer) row.classList.add('is-correct');
            else if (input.checked) row.classList.add('is-wrong');
        });
    });

    const wpm = Math.round((state.words[book.id] || 0) / state.elapsedMinutes);
    const btn = $('#submit-quiz');
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor…';

    try {
        await db.collection('readingResults').add({
            userId: state.user.uid,
            bookId: book.id,
            bookTitle: book.title,
            score,
            total: state.quiz.length,
            wpm,
            timeSpent: Number(state.elapsedMinutes.toFixed(2)),
            date: serverTime(),
        });
        await userDoc.addResult(state.user.uid, score, state.quiz.length);
        await userDoc.save(state.user.uid, book.id, { phase: PHASE.DONE });

        renderResult({ score, total: state.quiz.length, wpm, minutes: state.elapsedMinutes });
        showModule('result-module');
        await onAfterResult?.();
    } catch (err) {
        console.error(err);
        toast('Sonuç kaydedilemedi. Bağlantını kontrol et.', 'err');
        btn.disabled = false;
    } finally {
        btn.textContent = 'Sonucu Gönder';
    }
}

function renderResult({ score, total, wpm, minutes }) {
    const pct = Math.round((score / total) * 100);
    const verdict = pct === 100 ? 'Kusursuz okudun.'
                    : pct >= 67 ? 'Metni iyi kavramışsın.'
                    : pct >= 34 ? 'Biraz daha dikkatli okumak faydalı olur.'
                    : 'Metni bir kez daha gözden geçirmen iyi olur.';

    const doneCount = $$doneCount();

    $('#result-body').innerHTML = `
        <h2>Okuma tamamlandı</h2>
        <p class="result-verdict">${verdict}</p>

        <div class="result-stats">
            <div class="result-tile"><b>${score}/${total}</b><span>Doğru</span></div>
            <div class="result-tile"><b>${wpm}</b><span>WPM</span></div>
            <div class="result-tile"><b>${fmtNumber(minutes, 1)}</b><span>Dakika</span></div>
        </div>

        <div class="result-bar"><div id="result-fill"></div></div>

        <div class="result-actions">
            <button class="btn btn-primary" id="result-review-btn">Yorumunu yaz</button>
            <button class="btn btn-quiet" id="result-next-btn">Başka kitap seç</button>
        </div>

        ${doneCount ? `<p class="result-note">Bugünkü görevlerinden ${doneCount} tanesini tamamladın.</p>` : ''}
    `;

    requestAnimationFrame(() => {
        const fill = $('#result-fill');
        if (fill) fill.style.width = pct + '%';
    });

    $('#result-review-btn').onclick = () => onReviewWrite?.(state.book.id);
    $('#result-next-btn').onclick = () => showModule('library-module');
}

function $$doneCount() {
    return document.querySelectorAll('#q-daily-1.is-done, #q-daily-2.is-done').length;
}
