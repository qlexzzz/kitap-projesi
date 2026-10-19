/* Profil ekranı ve sıralama. */

import { $, escapeHtml, initials, formatDate, relativeTime, fmtNumber } from '../core/utils.js';
import { state } from '../core/state.js';
import { db } from '../core/firebase.js';
import { loadMyReviews } from './reviews.js';
import { renderBadges, fetchResults, distinctDays } from './stats.js';

/* ─────────── profil ─────────── */

export function applyProfile() {
    const p = state.profile || {};
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();

    $('#brand-greeting').textContent = name ? `Merhaba, ${p.firstName || name}` : 'Oku · Anla · Paylaş';
    $('#profile-full-name').textContent = name || 'Okur';
    $('#profile-grade-display').textContent = p.grade ? `${p.grade}. sınıf` : 'Sınıf belirtilmemiş';
    $('#profile-avatar').textContent = initials(name || '?');
    $('#profile-total-tests').textContent = p.totalTests || 0;
    $('#profile-total-correct').textContent = p.totalCorrect || 0;

    const avg = p.totalTests ? Math.round((p.totalCorrect / p.totalTests) * 100) : 0;
    $('#profile-avg-score').textContent = `%${avg}`;

    renderBadges();
}

export async function renderProfile() {
    applyProfile();
    // bölümler bağımsız: biri hata verirse diğerleri yine çizilir
    await Promise.allSettled([renderActivity(), renderMyReviews(), renderHistory()]);
}

/** Okuma serisi + son 7 günün etkinlik grafiği. */
async function renderActivity() {
    const host = $('#activity-chart');
    if (!host) return;

    let results = [];
    try {
        results = await fetchResults();
    } catch (err) {
        console.error(err);
    }

    $('#profile-streak').textContent = distinctDays(results).size;

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const count = results.filter(r => {
            const t = r.date?.toDate?.();
            return t && t.setHours(0, 0, 0, 0) === d.getTime();
        }).length;
        days.push({ date: d, count });
    }

    const max = Math.max(1, ...days.map(d => d.count));
    const total = days.reduce((a, d) => a + d.count, 0);
    const activeDays = days.filter(d => d.count > 0).length;

    host.innerHTML = days.map(({ date, count }, i) => `
        <div class="chart-col ${count === 0 ? 'is-empty' : ''} ${i === 6 ? 'is-today' : ''}"
             title="${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}: ${count} test">
            <span class="chart-track"><span class="chart-bar" style="height:${Math.max(3, (count / max) * 100)}%"></span></span>
            <span class="chart-day">${date.toLocaleDateString('tr-TR', { weekday: 'narrow' })}</span>
        </div>`).join('');

    $('#chart-total').textContent = `${total} test · ${activeDays} gün`;
}

async function renderMyReviews() {
    const host = $('#my-reviews');
    try {
        const mine = await loadMyReviews(state.user.uid);
        mine.sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0));

        if (!mine.length) {
            host.innerHTML = '<p class="empty">Henüz yorum yazmadın.</p>';
            return;
        }
        host.innerHTML = mine.map(r => `
            <article class="review-item is-self">
                <div class="avatar">${escapeHtml(initials(r.userName))}</div>
                <div class="review-body">
                    <div class="review-top">
                        <strong>${escapeHtml(r.bookTitle || 'Kitap')}</strong>
                        <span class="tag tag-self">${r.rating} ★</span>
                        <span class="review-date">${escapeHtml(relativeTime(r.date))}</span>
                    </div>
                    ${r.text ? `<p class="review-text">${escapeHtml(r.text)}</p>` : '<p class="review-text muted">Yazı yazmamış.</p>'}
                </div>
            </article>`).join('');
    } catch (err) {
        console.error(err);
        host.innerHTML = '<p class="empty">Yorumların yüklenemedi.</p>';
    }
}

async function renderHistory() {
    const host = $('#profile-history');
    try {
        const snap = await db.collection('readingResults')
            .where('userId', '==', state.user.uid)
            .orderBy('date', 'desc')
            .limit(8)
            .get();

        if (snap.empty) {
            host.innerHTML = '<p class="empty">Henüz bir kitap okumadın.</p>';
            return;
        }
        host.innerHTML = snap.docs.map(d => {
            const r = d.data();
            const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
            const tone = pct >= 80 ? 'ok' : pct >= 50 ? 'mid' : 'low';
            const time = r.timeSpent < 1 ? `${Math.round(r.timeSpent * 60)} sn` : `${fmtNumber(r.timeSpent, 1)} dk`;
            return `
                <div class="history-row ${tone}">
                    <div class="history-main">
                        <strong>${escapeHtml(r.bookTitle)}</strong>
                        <small>${escapeHtml(formatDate(r.date))}</small>
                    </div>
                    <div class="history-nums">
                        <span><b>${r.score}/${r.total}</b> doğru</span>
                        <span>${r.wpm} WPM</span>
                        <span>${time}</span>
                    </div>
                </div>`;
        }).join('');
    } catch (err) {
        console.error(err);
        host.innerHTML = '<p class="empty">Geçmiş yüklenemedi.</p>';
    }
}

/* ─────────── sıralama ─────────── */

export async function renderLeaderboard() {
    const host = $('#leaderboard-list');
    host.innerHTML = '<li class="empty">Yükleniyor…</li>';
    try {
        // users.totalTests sayacı okunur; test geçmişleri indirilmez.
        const snap = await db.collection('users')
            .where('totalTests', '>', 0)
            .orderBy('totalTests', 'desc')
            .limit(10)
            .get();

        if (snap.empty) {
            host.innerHTML = '<li class="empty">Henüz sıralama oluşmadı. İlk testi sen çöz.</li>';
            return;
        }

        const me = state.user?.uid;
        host.innerHTML = snap.docs.map((doc, i) => {
            const u = doc.data();
            const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'Gizli okur';
            const acc = u.totalTests ? Math.round((u.totalCorrect / u.totalTests) * 100) : 0;
            return `
                <li class="rank-row ${i === 0 ? 'is-first' : ''} ${doc.id === me ? 'is-me' : ''}">
                    <span class="rank-no">${i + 1}</span>
                    <span class="avatar">${escapeHtml(initials(name))}</span>
                    <span class="rank-name">${escapeHtml(name)}<small>${u.grade ? u.grade + '. sınıf · ' : ''}%${acc} başarı</small></span>
                    <span class="rank-score">${u.totalTests}</span>
                </li>`;
        }).join('');
    } catch (err) {
        console.error(err);
        host.innerHTML = `<li class="empty">Sıralama alınamadı: ${escapeHtml(err.message)}</li>`;
    }
}
