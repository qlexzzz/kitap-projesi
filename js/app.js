/* Kimlik doğrulama ekranı. */

import { $, escapeHtml, toast } from './core/utils.js';
import { state } from './core/state.js';
import { auth, db, serverTime } from './core/firebase.js';
import { userDoc } from './core/progress.js';

function setMessage(text, ok = false) {
    const el = $('#auth-message');
    el.textContent = text;
    el.classList.toggle('ok', ok);
}

function setBusy(busy) {
    const btn = $('#main-auth-button');
    btn.disabled = busy;
    btn.textContent = busy ? 'Bekle…' : (state.authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol');
}

export async function handleAuth(event) {
    event?.preventDefault();
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;

    if (!email || password.length < 6) {
        setMessage('E-posta ve en az 6 karakterli şifre gerekli.');
        return;
    }

    setBusy(true);
    setMessage('');

    try {
        if (state.authMode === 'login') {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            const firstName = $('#user-name').value.trim();
            const lastName = $('#user-surname').value.trim();
            const grade = $('#user-grade').value;
            if (!firstName || !lastName || !grade) {
                setMessage('Ad, soyad ve sınıf alanlarını doldur.');
                setBusy(false);
                return;
            }
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection('users').doc(cred.user.uid).set({
                firstName, lastName, grade,
                totalTests: 0,
                totalCorrect: 0,
                books: {},
                favorites: {},
                createdAt: serverTime(),
            });
            setMessage('Aramıza hoş geldin!', true);
        }
    } catch (err) {
        console.error(err);
        setMessage(friendlyAuthError(err));
    } finally {
        setBusy(false);
    }
}

function friendlyAuthError(err) {
    const code = err?.code || '';
    // Google, API anahtarı engelini 403/internal-error olarak döner.
    if (isApiKeyBlocked(err) || code === 'auth/internal-error') {
        showApiKeyDiagnostic();
        return 'Giriş engellendi: Firebase API anahtarın bu adresi kabul etmiyor.';
    }
    return ({
        'auth/invalid-credential':      'E-posta veya şifre hatalı.',
        'auth/invalid-email':          'Geçerli bir e-posta adresi gir.',
        'auth/email-already-in-use':   'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.',
        'auth/weak-password':          'Şifre en az 6 karakter olmalı.',
        'auth/too-many-requests':      'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
        'auth/network-request-failed': 'Bağlantı hatası. İnternetini kontrol et.',
    })[code] || 'Bir şeyler ters gitti. Tekrar dener misin?';
}

function isApiKeyBlocked(err) {
    return /API_KEY_HTTP_REFERRER_BLOCKED|are blocked/i.test(err?.message || '');
}

/** Kullanıcıyı konsol ayarlarına yönlendiren açık uyarı. */
function showApiKeyDiagnostic() {
    const box = $('#diagnostic');
    if (!box || !box.classList.contains('hidden')) return;
    box.innerHTML = `
        <h2>Firebase erişimi engelli</h2>
        <ol>
            <li>Google Cloud Console → <b>API'ler ve Hizmetler → Kimlik Bilgileri</b></li>
            <li><b>Tarayıcı anahtarları</b> → <code>Browser key (auto created by Firebase)</code></li>
            <li><b>Web sitesi kısıtlamaları</b> bölümünü aç</li>
            <li>Bu adresi ekle: <code>${escapeHtml(location.origin)}/*</code></li>
            <li>Kaydet. Kimlik doğrulama otomatik çalışır.</li>
        </ol>`;
    box.classList.remove('hidden');
}

/**
 * Yazma yolları sessizce başarısız olmasın diye, açılışta API anahtarının
 * geçerli olup olmadığını yan etkisiz bir çağrıyla yoklar.
 */
export async function probeApiKey() {
    try {
        await auth.fetchSignInMethodsForEmail('probe@kitap-odasi.invalid');
    } catch (err) {
        if (isApiKeyBlocked(err)) showApiKeyDiagnostic();
    }
}

export function toggleAuthMode() {
    state.authMode = state.authMode === 'login' ? 'register' : 'login';
    const register = state.authMode === 'register';
    $('#register-fields').classList.toggle('hidden', !register);
    $('#main-auth-button').textContent = register ? 'Kayıt Ol' : 'Giriş Yap';
    $('#toggle-auth-btn').textContent = register ? 'Giriş Yap' : 'Kayıt Ol';
    $('#toggle-auth-text').textContent = register ? 'Zaten hesabın var mı?' : 'Hesabın yok mu?';
    setMessage('');
}

/**
 * Oturum durumu değişince çağrılır.
 *
 * `onReady` ağ beklemeden, ekran açılır açılmaz çalışır (kitaplık yerel kitap
 * verisinden çizilir). `onSignedIn` ise profil yüklendikten sonra ağ işlerini
 * yapar. İkisi ayrıldı çünkü Firestore yavaş olduğunda ya da kullanıcı
 * dokümanı okunamadığında ekran boş kalıyordu.
 */
export function watchAuth(onSignedIn, onReady) {
    auth.onAuthStateChanged(async user => {
        const previousUid = state.user?.uid || null;
        state.user = user;

        if (!user) {
            $('#app-screen').classList.add('hidden');
            $('#auth-screen').classList.remove('hidden');
            return;
        }

        $('#auth-screen').classList.add('hidden');
        $('#app-screen').classList.remove('hidden');

        // Aynı kullanıcının jeton yenilemesinde tekrar çalıştırma; yoksa
        // okuma/test ekranındayken kullanıcıyı kitaplığa geri atardı.
        if (previousUid !== user.uid) onReady?.();

        try {
            state.profile = await userDoc.load(user.uid);
            await onSignedIn();
        } catch (err) {
            console.error(err);
            toast('Veriler yüklenemedi. Bağlantını kontrol et.', 'err');
        }
    });
}
