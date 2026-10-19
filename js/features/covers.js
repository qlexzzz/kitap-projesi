/* Kitap kapağı üretimi.
   Öncelik sırası:
     1) book.coverUrl varsa gerçek görsel (hata olursa otomatik yazıya düşer)
     2) yoksa kitaba özel tasarlanmış tipografik kapak (her zaman çalışır) */

import { escapeHtml, normalizeTitle } from '../core/utils.js';

/** Kapak işaretini (kitabın karakterini) üretir. */
function mark(theme) {
    const s = 'rgba(255,255,255,.38)';
    let art;
    if (theme === 'cover-rose') {
        // baklava / elmas deseni
        art = `<path d="M20 4 L36 20 L20 36 L4 20 Z" fill="none" stroke="${s}" stroke-width="1.3"/>
               <path d="M20 11 L29 20 L20 29 L11 20 Z" fill="none" stroke="${s}" stroke-width="1.3"/>`;
    } else if (theme === 'cover-dune') {
        // yatay kesik çizgiler + halka
        art = `<path d="M6 13 H34 M6 20 H34 M6 27 H34" stroke="${s}" stroke-width="1.3"/>
               <circle cx="20" cy="20" r="8" fill="none" stroke="${s}" stroke-width="1.3"/>`;
    } else {
        // dalga
        art = `<path d="M5 15 Q12.5 6 20 15 T35 15" fill="none" stroke="${s}" stroke-width="1.3"/>
               <path d="M5 25 Q12.5 16 20 25 T35 25" fill="none" stroke="${s}" stroke-width="1.3"/>`;
    }
    return `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">${art}</svg>`;
}

/**
 * @param {object} book
 * @param {object} opts
 * @param {string} opts.size  'sm' (kart) | 'lg' (detay)
 */
export function coverMarkup(book, { size = 'sm' } = {}) {
    const fallback = `
        <span class="cover-art" aria-hidden="true">${mark(book.theme)}</span>
        <span class="cover-title">${escapeHtml(book.title)}</span>
        <span class="cover-author">${escapeHtml(book.author)}</span>`;

    const img = book.coverUrl
        ? `<img class="cover-img" src="${escapeHtml(book.coverUrl)}" alt=""
              loading="lazy" decoding="async"
              onerror="this.parentElement.classList.remove('has-img')">
           <span class="cover-fallback" hidden>${fallback}</span>`
        : fallback;

    return `<span class="book-cover ${book.theme} cover-${size}">${img}</span>`;
}

/**
 * Open Library'da kapak arar.
 *
 * Dikkat: arama sonuçları çoğu zaman başka yazarın aynı adlı eseri olabilir
 * ("Karanfilsiz" → başka bir yazar). Bu yüzden hem başlık hem yazar eşleşmesi
 * aranır; tutmuyorsa null döner ve tasarlanmış kapak kalır. Yanlış kitap
 * kapağı göstermektense göstermemek yeğdir.
 *
 * @returns {Promise<string|null>}
 */
export async function findCoverUrl(title, author) {
    const url = 'https://openlibrary.org/search.json'
        + `?title=${encodeURIComponent(title)}&limit=10`
        + '&fields=title,author_name,cover_i';

    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return null;

        const docs = (await res.json())?.docs;
        if (!docs?.length) return null;

        const wantTitle = normalizeTitle(title);
        const wantAuthor = normalizeTitle(author.split(' ')[0]);

        const hasAuthor = (d) =>
            (d.author_name || []).some(a => normalizeTitle(a).includes(wantAuthor));

        // Yalnızca tam başlık + yazar eşleşmesi. Yazar tek başına yeterli
        // değil: "Falaka"yı yazan başka yazarlar da var, yanlış kapak
        // göstermektense göstermemek yeğdir.
        const hit = docs.find(d => normalizeTitle(d.title) === wantTitle && hasAuthor(d));

        const id = hit?.cover_i;
        return id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : null;
    } catch {
        return null;   // çevrimdışı veya yavaş: sessizce tasarlanmış kapağa düş
    }
}
