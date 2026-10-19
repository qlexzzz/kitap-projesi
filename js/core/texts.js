/* Kitap metinleri. Her metin bir kez indirilir ve bellekte tutulur;
   hem açılışta önceden yüklenir hem de okuyucu açılırken istenirse getirilir.
   Böylece metin gelmeden okuyucu açılırsa "metin yüklenemedi" görünmez. */

import { BOOKS_DATA, state } from './state.js';
import { normalizeTitle } from './utils.js';

const pending = new Map();   // bookId → devam eden indirme

/**
 * Metnin başındaki "Başlık - Yazar" satırını atar: başlık zaten okuma
 * ekranının üst şeridinde duruyor.
 */
function stripHeading(raw, book) {
    const lines = raw.replace(/\r\n?/g, '\n').split('\n');
    const first = normalizeTitle(lines[0]);
    const title = normalizeTitle(book.title);
    if (!first || !title) return raw;
    if (!first.startsWith(title)) return raw;

    lines.shift();
    while (lines.length && !lines[0].trim()) lines.shift();
    return lines.join('\n');
}

async function fetchText(book) {
    try {
        const res = await fetch(book.textSource);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = stripHeading(await res.text(), book);
        state.text[book.id] = raw;
        state.words[book.id] = raw.trim().split(/\s+/).filter(Boolean).length;
    } catch (err) {
        console.error(book.title, err);
        state.text[book.id] = '';
        state.words[book.id] = 0;
    }
    return state.text[book.id];
}

/** Kitabın metnini getirir. Zaten yüklüyse ağa çıkmaz. */
export function loadText(book) {
    if (state.text[book.id] !== undefined) return Promise.resolve(state.text[book.id]);
    if (pending.has(book.id)) return pending.get(book.id);

    const job = fetchText(book).finally(() => pending.delete(book.id));
    pending.set(book.id, job);
    return job;
}

/** Tüm kitapları önceden yükler. */
export async function loadAllTexts() {
    await Promise.all(BOOKS_DATA.map(loadText));
}
