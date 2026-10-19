/* Kaldığın yerden devam: kullanıcının kitap ilerlemesi users/{uid}.books altında tutulur.
   Ayrıca leaderboard'un ölçeklenebilir kalması için toplam sayaçlar da aynı dokümanda. */

import { db, serverTime, increment } from './firebase.js';

export const PHASE = { NEW: 'new', READING: 'reading', QUIZ: 'quiz', DONE: 'done' };

/** Kullanıcı dokümanını belleğe alır. */
export const userDoc = {
    data: { totalTests: 0, totalCorrect: 0, books: {}, favorites: {} },

    async load(uid) {
        const snap = await db().collection('users').doc(uid).get();
        this.data = snap.exists ? (snap.data() || {}) : {};
        if (!this.data.books) this.data.books = {};
        if (!this.data.favorites) this.data.favorites = {};
        if (typeof this.data.totalTests !== 'number') this.data.totalTests = 0;
        if (typeof this.data.totalCorrect !== 'number') this.data.totalCorrect = 0;
        return this.data;
    },

    /** İlerleme alanlarını nokta-notasyonu ile birleştirir (var olan alanları silmez). */
    async save(uid, bookId, patch) {
        const ref = db().collection('users').doc(uid);
        const payload = { [`books.${bookId}`]: { ...(this.data.books?.[bookId] || {}), ...patch } };
        if (bookId) {
            payload.lastBookId = bookId;
            payload.lastReadAt = serverTime();
        }
        await ref.set(payload, { merge: true });
        Object.assign(this.data.books, { [bookId]: { ...(this.data.books[bookId] || {}), ...patch } });
        this.data.lastBookId = bookId;
    },

    /** Test sonucu sayacını artırır (leaderboard bu değere göre sıralar). */
    async addResult(uid, correct, total) {
        await db().collection('users').doc(uid).set({
            totalTests: increment(1),
            totalCorrect: increment(correct),
            lastCorrect: correct,
            lastTotal: total,
        }, { merge: true });
        this.data.totalTests += 1;
        this.data.totalCorrect += correct;
    },

    /** 'new' | 'reading' | 'quiz' | 'done' */
    phaseOf(bookId) {
        return this.data.books?.[bookId]?.phase || PHASE.NEW;
    },

    /** Kaydedilen sayfa numarası (0 tabanlı). */
    pageOf(bookId) {
        const n = this.data.books?.[bookId]?.page;
        return typeof n === 'number' && n >= 0 ? n : 0;
    },

    /** Son açılan, bitmemiş kitap. */
    resumable() {
        const id = this.data.lastBookId;
        if (!id) return null;
        const phase = this.phaseOf(id);
        if (phase === PHASE.DONE) return null;
        return { bookId: id, phase, page: this.pageOf(id) };
    },

    isFavorite(bookId) {
        return !!this.data.favorites?.[bookId];
    },

    async toggleFavorite(uid, bookId) {
        const next = !this.isFavorite(bookId);
        await db().collection('users').doc(uid)
            .set({ [`favorites.${bookId}`]: next }, { merge: true });
        this.data.favorites ??= {};
        this.data.favorites[bookId] = next;
        return next;
    }
};
