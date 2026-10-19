/* Sayfa sayfa okuma.
   Metin, görünür alana sığan sayfalara bölünür. Bölme, gizli bir ölçüm
   kutusunda ikili arama yapılarak yapılır: her sayfa için en uzun sığan
   karakter aralığı bulunur, sonra kelime sınırına geri çekilir. */

const WORD_SAFE = 8;   // tek kelime sayfaya sığmazsa en az bu kadar ilerle

/**
 * Metni sayfalara böler.
 *
 * Ölçüm, verilen sayfa elemanının kendisi üzerinde yapılır: metin yazılır,
 * scrollHeight okunur. Ayrı bir ölçüm kutusu kullanmak padding, kenar boşluğu
 * ve yazı tipi farkları nedeniyle tutarsız sonuç veriyordu.
 *
 * @param {string} text
 * @param {HTMLElement} page   Ölçülecek sayfa elemanı (görünür olmalı)
 * @param {object} opts
 * @param {number} opts.capacity  Sayfaya sığan yükseklik (clientHeight)
 * @param {number} opts.maxPages
 * @returns {string[]} Her sayfanın metni
 */
export function paginate(text, page, { capacity, maxPages = 200 } = {}) {
    // \r\n ölçümü bozduğu için baştan tek satır sonuna indirgenir
    const clean = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!clean) return [];

    const pages = [];
    let cursor = 0;
    let guard = 0;

    while (cursor < clean.length && pages.length < maxPages && guard++ < maxPages * 3) {
        // Her sayfa için en uzun sığan aralığı bul.
        let end = binaryFit(clean, cursor, clean.length, page, capacity);

        // Sığan bir şey yoksa (çok uzun kelime) sabit adım at.
        if (end <= cursor) end = Math.min(clean.length, cursor + WORD_SAFE);

        end = rewindToWord(clean, cursor, end);
        if (end <= cursor) end = Math.min(clean.length, cursor + WORD_SAFE);

        pages.push(clean.slice(cursor, end).trim());
        cursor = end;
    }

    return pages.filter(p => p.length > 0);
}

/** Metin sayfaya sığıyor mu? */
function fits(page, text, capacity) {
    page.textContent = text;
    return page.scrollHeight <= capacity;
}

/** [from, to] aralığında sığan en uzun son karakteri bulur. */
function binaryFit(text, from, to, page, capacity) {
    let lo = 0, hi = to - from, best = 0;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (fits(page, text.slice(from, from + mid), capacity)) {
            best = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return from + best;
}

/** Bölme noktasını kelime sonuna çeker, böylece kelime ortasından bölünmez. */
function rewindToWord(text, from, end) {
    if (end >= text.length) return end;
    let i = end;
    while (i > from && !/\s/.test(text[i])) i--;
    return i > from ? i : end;
}
