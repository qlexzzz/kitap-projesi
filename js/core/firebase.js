/* Firebase kurulumu ve paylaşılan oturum durumu.
   Uygulamanın geri kalanı `auth` ve `db` yerine doğrudan bu modülü kullanır. */

const firebaseConfig = {
    apiKey: "AIzaSyCAi1tHAVuy2CsFL0RG0DKPKkITmgIsKiM",
    authDomain: "kitaptest-6bf57.firebaseapp.com",
    projectId: "kitaptest-6bf57",
    storageBucket: "kitaptest-6bf57.firebasestorage.app",
    messagingSenderId: "630636163898",
    appId: "1:630636163898:web:ac31edc3b0d5dfff339603",
    measurementId: "G-2CJVDP2D5C"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.firestore();

/** Sunucu zaman damgası üretir. */
export const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();

/** Koleksiyona yazarken artan sayı alanı için. */
export const increment = n => firebase.firestore.FieldValue.increment(n);
