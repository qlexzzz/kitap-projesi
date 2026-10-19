/* Okuma serisi, günlük görevler ve rozetler. */

import { $, $$, escapeHtml } from '../core/utils.js';
import { state } from '../core/state.js';
import { userDoc } from '../core/progress.js';
import { db } from '../core/firebase.js';

const QUEST_POOL = [
    { id: 'read_1',  text: 'Günü Başlat (1 test)',      check: r => r.length >= 1 },
    { id: 'read_3',  text: 'Kitap Kurdu (3 test)',       check: r => r.length >= 3 },
    { id: 'read_5',  text: 'Okuma Maratonu (5 test)',    check: r => r.length >= 5 },
    { id: 'perfect', text: 'Hatayı Sıfırla (tam puan)',  check: r => r.some(x => x.score === x.total) },
    { id: 'fast',    text: 'Hızlı Okur (250+ WPM)',      check: r => r.some(x => x.wpm >= 250) },
    { id: 'night',   text: 'Gece Kuşu (23-03 arası)',    check: r => r.some(x => { const h = x.date.toDate().getHours(); return h >= 23 || h < 3; }) },
    { id: 'morning', text: 'Erken Kalkan (06-10 arası)', check: r => r.some(x => { const h = x.date.toDate().getHours(); return h >= 6 && h < 10; }) },
    { id: 'streak',  text: 'Çifte Şans (2 tam puan)',    check: r => r.filter(x => x.score === x.total).length >= 2 },
    { id: 'variety', text: '2 farklı kitap çöz',         check: r => new Set(r.map(x => x.bookTitle)).size >= 2 },
    { id: 'fastest', text: 'Tur Okur (350+ WPM)',        check: r => r.some(x => x.wpm >= 350) },
];

let todaysQuests = [];

export async function fetchResults() {
    const snap = await db.collection('readingResults')
        .where('userId', '==', state.user.uid).get();
    return snap.docs.map(d => d.data());
}

export function distinctDays(results) {
    return new Set(results.map(r => r.date?.toDate().toDateString()).filter(Boolean));
}

/* ─────────── seri ─────────── */

export async function refreshStats() {
    if (!state.user) return;
    try {
        const results = await fetchResults();
        const set = distinctDays(results);
        $('#sidebar-streak').textContent = set.size;
        renderWeeklyDots(set);
        $('#streak-note').textContent = set.size
            ? `${set.size} farklı gün okudun. Seriyi bozma!`
            : 'İlk kitabını oku ve serini başlat.';
    } catch (err) {
        console.error('Seri güncellenemedi:', err);
        renderWeeklyDots(new Set());
    }
}

function renderWeeklyDots(set) {
    const host = $('#weekly-dots');
    host.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dot = document.createElement('span');
        dot.className = 'day-dot';
        dot.title = `${d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}${set.has(d.toDateString()) ? ' — okundu' : ''}`;
        if (set.has(d.toDateString())) dot.classList.add('active');
        if (i === 0) dot.classList.add('today');
        host.appendChild(dot);
    }
}

/* ─────────── günlük görevler ─────────── */

/** Tarihe göre sabitlenmiş 3 görev seçer. */
export function initDailyQuests() {
    const seed = [...new Date().toDateString()].reduce((a, c) => a + c.charCodeAt(0), 0);
    const pool = [...QUEST_POOL];
    todaysQuests = [];
    for (let i = 0; i < 3; i++) todaysQuests.push(pool.splice((seed + i) % pool.length, 1)[0]);

    todaysQuests.forEach((q, i) => setQuest(`#q-daily-${i + 1}`, q.text, false));
}

function setQuest(selector, text, done) {
    const li = $(selector);
    if (!li) return;
    li.querySelector('.quest-text').textContent = text;
    li.classList.toggle('is-done', done);
    li.querySelector('.quest-mark').textContent = done ? '✓' : '·';
}

export async function refreshQuests() {
    if (!state.user) return;
    setQuest('#q-login', 'Giriş yap', true);

    try {
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        const results = (await fetchResults())
            .filter(r => r.date && r.date.toDate().getTime() >= startOfDay);
        todaysQuests.forEach((q, i) => setQuest(`#q-daily-${i + 1}`, q.text, q.check(results)));
    } catch (err) {
        console.error(err);
    }
}

/** Yan panel gizliyken görevleri okuma ekranında da gösterir. */
export function renderQuestStrip() {
    const host = $('#quest-strip');
    if (!host) return;
    host.innerHTML = $$('.quest-item').map(li => {
        const done = li.classList.contains('is-done');
        const label = li.querySelector('.quest-text')?.textContent || '';
        return `<span class="quest-chip ${done ? 'is-done' : ''}">${done ? '✓' : '·'} ${escapeHtml(label)}</span>`;
    }).join('');
}

/* ─────────── rozetler ─────────── */

const BADGES = [
    { n: 'Çaylak', r: 1 },
    { n: 'Okur',   r: 5 },
    { n: 'Kurdu',  r: 10 },
    { n: 'Bilge',  r: 20 },
    { n: 'Efsane', r: 50 },
];

export function renderBadges() {
    const total = userDoc.data.totalTests || 0;
    $('#badges-container').innerHTML = BADGES.map(b => `
        <li class="badge-item ${total >= b.r ? 'is-earned' : ''}">
            <span>${b.n}</span><small>${b.r} test</small>
        </li>`).join('');
}
