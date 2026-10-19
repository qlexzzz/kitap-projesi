/* Kitap yorumları ve yıldız puanlama.
   Veri modeli:  bookReviews/{bookId}__{uid}
     { bookId, userId, userName, userGrade, rating, text, date }
   Tek kullanıcı tek kitap için yalnızca bir yorum yazabilir (belge id'si deterministik). */

import { $, escapeHtml, initials, relativeTime, renderStars, paintReadonlyStars, fmtNumber, toast } from '../core/utils.js';
import { db, serverTime } from '../core/firebase.js';

const COLLECTION = 'bookReviews';

let currentUid = null;
export function setCurrentUid(uid) { currentUid = uid; }

/* ─────────── veri ─────────── */

/** Kitabın tüm yorumlarını, ortalamasını ve dağılımını getirir. */
export async function loadBookReviews(bookId) {
    const snap = await db.collection(COLLECTION).where('bookId', '==', bookId).get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    list.forEach(r => {
        const rating = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)));
        dist[rating]++;
        sum += rating;
    });

    return {
        list,
        avg: list.length ? sum / list.length : 0,
        count: list.length,
        dist,
        mine: list.find(r => r.userId === currentUid) || null
    };
}

/** Kullanıcının yorumunu oluşturur veya günceller. */
export async function saveReview({ uid, profile, bookId, bookTitle, rating, text }) {
    if (!rating) throw new Error('Lütfen önce yıldız puanı seç.');

    const body = String(text || '').trim().slice(0, 500);

    await db.collection(COLLECTION).doc(`${bookId}__${uid}`).set({
        bookId,
        bookTitle: bookTitle || '',
        userId: uid,
        userName: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() || 'Okur',
        userGrade: profile?.grade || '',
        rating: Number(rating),
        text: body,
        date: serverTime(),
    }, { merge: true });
}

export async function deleteReview(reviewId) {
    await db.collection(COLLECTION).doc(reviewId).delete();
}

/** Kullanıcının tüm yorumları (profil ekranı). */
export async function loadMyReviews(uid) {
    const snap = await db.collection(COLLECTION).where('userId', '==', uid).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ─────────── arayüz ─────────── */

let ctx = null;
let draftRating = 0;
let editingId = null;
let current = { list: [], count: 0 };

export function mountReviewUI(context) {
    ctx = context;

    // yorum formu
    const form = $('#review-form');
    form.addEventListener('submit', onSubmit);
    form.addEventListener('reset', () => resetForm());

    $('#review-text').addEventListener('input', e => {
        $('#review-chars').textContent = e.target.value.length;
    });

    $('#review-cancel-btn').addEventListener('click', () => {
        resetForm();
        renderList();
    });

    $('#review-sort').addEventListener('change', renderList);

    // puanlayıcı
    renderStars($('#review-stars'), 0, { large: true, onPick: starPicker });
}

async function onSubmit(e) {
    e.preventDefault();
    if (!ctx) return;

    if (!draftRating) {
        toast('Önce yıldız puanı seçmelisin.', 'err');
        $('#review-stars').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const btn = $('#review-submit');
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor…';

    try {
        await saveReview({
            uid: ctx.getUid(),
            profile: ctx.getProfile(),
            bookId: ctx.getBookId(),
            bookTitle: ctx.getBook()?.title,
            rating: draftRating,
            text: $('#review-text').value
        });
        toast(editingId ? 'Yorumun güncellendi.' : 'Yorumun yayınlandı!', 'ok');
        resetForm();
        await ctx.refresh();
    } catch (err) {
        console.error(err);
        toast(err.message || 'Yorum kaydedilemedi.', 'err');
    } finally {
        // yenileme sırasında düzenleme moduna geçmiş olabiliriz
        btn.disabled = false;
        syncSubmitLabel();
    }
}

/** Buton metnini mevcut duruma göre ayarlar. */
function syncSubmitLabel() {
    $('#review-submit').textContent = editingId ? 'Yorumu Güncelle' : 'Yorumu Gönder';
}

function resetForm() {
    draftRating = 0;
    editingId = null;
    const form = $('#review-form');
    form.classList.remove('is-editing');
    $('#review-text').value = '';
    $('#review-chars').textContent = '0';
    syncSubmitLabel();
    $('#review-cancel-btn').classList.add('hidden');
    const hint = $('#review-rating-hint');
    hint.textContent = 'Puan seç';
    hint.classList.remove('set');
    renderStars($('#review-stars'), 0, { large: true, onPick: starPicker });
}

function starPicker(n) {
    draftRating = n;
    $('#review-stars').dataset.value = n;
    const hint = $('#review-rating-hint');
    hint.textContent = `${n} / 5 puan`;
    hint.classList.add('set');
}

/** Kitap detay ekranındaki tüm yorum arayüzünü günceller. */
export function renderReviews(data) {
    current = data;
    const uid = ctx?.getUid();

    // kitap başlığındaki ortalama
    paintReadonlyStars($('#detail-stars'), data.avg);
    $('#detail-rating-value').textContent = fmtNumber(data.avg);
    $('#detail-rating-count').textContent = data.count
        ? `${data.count} değerlendirme`
        : 'değerlendirme yok';

    // özet paneli
    paintReadonlyStars($('#summary-stars'), data.avg);
    $('#summary-avg').textContent = fmtNumber(data.avg);
    $('#summary-count').textContent = data.count
        ? `${data.count} değerlendirme`
        : 'Henüz değerlendirme yok';

    $('#summary-bars').innerHTML = [5, 4, 3, 2, 1].map(star => {
        const n = data.dist[star] || 0;
        const mine = data.mine && Number(data.mine.rating) === star;
        const pct = data.count ? (n / data.count) * 100 : 0;
        return `
            <div class="dist-row ${mine ? 'is-mine' : ''}">
                <span>${star} ★</span>
                <span class="dist-track"><span class="dist-fill" style="width:${pct}%"></span></span>
                <span>${n}</span>
            </div>`;
    }).join('');

    // form kimliği
    const profile = ctx?.getProfile();
    const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
    $('#review-avatar').textContent = initials(name || '?');
    $('#review-identity-name').textContent = name || 'Okur';
    $('#review-identity-meta').textContent = profile?.grade
        ? `${profile.grade}. sınıf · yorumun burada görünecek`
        : 'Yorumun burada görünecek';

    // kullanıcının kendi yorumu varsa doğrudan düzenleme modunda göster
    if (data.mine) {
        startEdit(data.mine.id, uid, { silent: true });
    } else if (editingId) {
        resetForm();
    }

    renderList(uid);
}

function renderList(uid = ctx?.getUid()) {
    const host = $('#review-list');
    if (!host) return;

    const sort = $('#review-sort')?.value || 'new';
    const sorted = [...current.list].sort((a, b) => {
        const da = a.date?.toMillis?.() ?? 0;
        const dbt = b.date?.toMillis?.() ?? 0;
        if (sort === 'high') return b.rating - a.rating || dbt - da;
        if (sort === 'low')  return a.rating - b.rating || dbt - da;
        return dbt - da;
    });

    if (!sorted.length) {
        host.innerHTML = '<p class="empty">Bu kitap için henüz yorum yok. İlk yorumu sen yaz.</p>';
        return;
    }

    host.innerHTML = sorted.map(r => reviewCard(r, uid)).join('');
    host.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => startEdit(btn.dataset.edit, ctx?.getUid()));
    });
    host.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => remove(btn.dataset.delete, btn));
    });
    host.querySelectorAll('[data-review-stars]').forEach(el => {
        paintReadonlyStars(el, Number(el.dataset.reviewStars) || 0);
    });
}

function reviewCard(r, uid) {
    const isMine = r.userId === uid;
    const stars = r.rating
        ? `<div class="stars review-stars" data-review-stars="${Number(r.rating)}"></div>`
        : '';

    return `
        <article class="review-item ${isMine ? 'is-self' : ''}" data-review-id="${escapeHtml(r.id)}">
            <div class="avatar">${escapeHtml(initials(r.userName))}</div>
            <div class="review-body">
                <div class="review-top">
                    <strong>${escapeHtml(r.userName || 'Okur')}</strong>
                    ${r.userGrade ? `<span class="tag tag-grade">${escapeHtml(r.userGrade)}. sınıf</span>` : ''}
                    ${isMine ? '<span class="tag tag-self">senin yorumun</span>' : ''}
                    <span class="review-date">${escapeHtml(relativeTime(r.date))}</span>
                </div>
                ${stars}
                ${r.text ? `<p class="review-text">${escapeHtml(r.text)}</p>` : ''}
                ${isMine ? `
                    <div class="review-actions">
                        <button class="btn btn-quiet btn-sm" data-edit="${escapeHtml(r.id)}">Düzenle</button>
                        <button class="btn btn-quiet btn-sm btn-danger" data-delete="${escapeHtml(r.id)}">Sil</button>
                    </div>` : ''}
            </div>
        </article>`;
}

function startEdit(reviewId, uid, { silent = false } = {}) {
    const r = current.list.find(x => x.id === reviewId);
    if (!r) return;
    editingId = reviewId;
    draftRating = r.rating;
    renderStars($('#review-stars'), r.rating, { large: true, onPick: starPicker });
    $('#review-stars').dataset.value = r.rating;
    $('#review-rating-hint').textContent = `${r.rating} / 5 puan`;
    $('#review-rating-hint').classList.add('set');
    $('#review-text').value = r.text || '';
    $('#review-chars').textContent = (r.text || '').length;
    syncSubmitLabel();
    $('#review-cancel-btn').classList.remove('hidden');
    $('#review-form').classList.add('is-editing');
    if (!silent) {
        $('#review-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('#review-text').focus();
    }
    renderList(uid);
}

async function remove(reviewId, btn) {
    if (!confirm('Bu yorumu silmek istediğine emin misin?')) return;
    btn.disabled = true;
    try {
        await deleteReview(reviewId);
        toast('Yorumun silindi.', 'ok');
        if (editingId === reviewId) resetForm();
        await ctx.refresh();
    } catch (err) {
        console.error(err);
        toast('Yorum silinemedi.', 'err');
        btn.disabled = false;
    }
}

/** "Yorumunu yaz" butonu → forma odaklan. */
export function focusReviewForm() {
    const form = $('#review-form');
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => $('#review-text')?.focus(), 350);
}
