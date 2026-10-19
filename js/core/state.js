/* Uygulama genelinde paylaşılan durum ve okuma sabitleri.
   Modüller arası paylaşım tek noktadan yapılır; iki modül aynı nesneyi
   gösterdiği için birinde yapılan değişiklik diğerinde de görünür. */

import { BOOKS_DATA, findBook } from '../../data/books.js';

export const READING_MINUTES = 5;
export const AVERAGE_READ_WPM = 250;   // tahmini okuma süresi hesabı
export const MIN_CREDITED_MINUTES = 1; // saniyeler içinde çıkışı engeller

export const state = {
    user: null,          // firebase kullanıcısı
    profile: null,       // users/{uid} belgesi
    authMode: 'login',
    book: null,          // açık kitap
    quiz: [],
    answers: {},
    text: {},            // bookId → ham metin
    words: {},           // bookId → kelime sayısı
    ratings: {},         // bookId → { avg, count }
    pages: [],           // aktif kitabın sayfa metinleri
    pageIndex: 0,        // aktif sayfa (0 tabanlı)
    sessionStart: 0,
    elapsedMinutes: 0,
    timerId: null,
};

export { BOOKS_DATA, findBook };
