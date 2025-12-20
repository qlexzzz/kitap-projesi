import { BOOKS_DATA } from './books.js'; 

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
const auth = firebase.auth();
const db = firebase.firestore();

let authMode = 'login';
let timerInterval = null;
let currentUser = null; 
const FIXED_READING_TIME_MINUTES = 5; 
let currentQuizData = []; 
let currentBookId = null; 
let currentSessionStartTime;
let timeSpentMinutes = 1; 
let loadedBookTexts = {};

const QUEST_POOL = [
    { id: 'read_1', text: 'Günü Başlat (1 Test)', check: (res) => res.length >= 1 },
    { id: 'read_3', text: 'Kitap Kurdu (3 Test)', check: (res) => res.length >= 3 },
    { id: 'read_5', text: 'Okuma Maratonu (5 Test)', check: (res) => res.length >= 5 },
    { id: 'perfect', text: 'Hatayı Sıfırla (Tam Puan)', check: (res) => res.some(r => r.score === r.total) },
    { id: 'fast', text: 'Hızlı Okur (250+ WPM)', check: (res) => res.some(r => r.wpm >= 250) },
    { id: 'sonic', text: 'Ses Hızı (400+ WPM)', check: (res) => res.some(r => r.wpm >= 400) },
    { id: 'morning', text: 'Erken Kalkan (06-10 Arası)', check: (res) => res.some(r => {
        const h = r.date.toDate().getHours();
        return h >= 6 && h < 10;
    })},
    { id: 'night', text: 'Gece Kuşu (23-03 Arası)', check: (res) => res.some(r => {
        const h = r.date.toDate().getHours();
        return h >= 23 || h < 3;
    })},
    { id: 'streak', text: 'Çifte Şans (2 Tam Puan)', check: (res) => res.filter(r => r.score === r.total).length >= 2 },
    { id: 'focus', text: 'Tam Odak (5 Dakika Oku)', check: (res) => res.some(r => r.timeSpent >= 5) },
    { id: 'variety', text: '2 Farklı Kitap Çöz', check: (res) => {
        const titles = new Set(res.map(r => r.bookTitle));
        return titles.size >= 2;
    }},
    { id: 'total_score', text: 'Toplam 10 Doğru Yap', check: (res) => {
        let total = 0;
        res.forEach(r => total += r.score);
        return total >= 10;
    }}
];

let todaysQuests = [];

const bookContent = document.getElementById('book-content');
const timerDisplay = document.getElementById('timer');
const startButton = document.getElementById('start-button');
const readingBookTitle = document.getElementById('reading-book-title');
const finishEarlyButton = document.getElementById('finish-early-button');

function showModule(id) {
    document.querySelectorAll('.content-module').forEach(m => {
        m.classList.add('hidden');
        m.style.display = 'none';
    });

    const target = document.getElementById(id);
    if(target) {
        target.classList.remove('hidden');
        target.style.display = 'block';
        console.log("Modül açıldı: " + id);
    }

    const startBtn = document.getElementById('start-button');
    if (startBtn) {
        if (id === 'reading-module') {
            startBtn.disabled = false;
            startBtn.style.opacity = "1";
            startBtn.style.cursor = "pointer";
        } else {
            startBtn.disabled = true;
            startBtn.style.opacity = "0.5";
            startBtn.style.cursor = "not-allowed";
        }
    }
}

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('login-screen').classList.add('hidden');
        initDailyQuests(); 
        loadAllData();
        checkQuests();
        loadHistoryToSidebar();
        showModule('library-module');
    } else {
        currentUser = null;
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    }
});

function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if (authMode === 'login') {
        auth.signInWithEmailAndPassword(email, password).catch(err => alert("Hata: " + err.message));
    } else {
        const name = document.getElementById('user-name').value;
        const surname = document.getElementById('user-surname').value;
        const grade = document.getElementById('user-grade').value;
        auth.createUserWithEmailAndPassword(email, password).then(cred => {
            return db.collection("users").doc(cred.user.uid).set({ firstName: name, lastName: surname, grade: grade });
        }).catch(err => alert(err.message));
    }
}

function initDailyQuests() {
    const todayStr = new Date().toDateString();
    let seed = 0;
    for (let i = 0; i < todayStr.length; i++) seed += todayStr.charCodeAt(i);
    let tempPool = [...QUEST_POOL];
    todaysQuests = [];
    for (let i = 0; i < 3; i++) {
        const index = (seed + i) % tempPool.length;
        todaysQuests.push(tempPool.splice(index, 1)[0]);
    }
    todaysQuests.forEach((q, i) => {
        const el = document.getElementById(`q-daily-${i+1}`);
        if(el) {
            el.classList.remove('completed');
            el.querySelector('.quest-status').textContent = "❌";
            el.querySelector('.quest-text').textContent = q.text;
        }
    });
}

async function checkQuests() {
    if (!currentUser) return;
    markQuestDone('q-login');
    try {
        const snap = await db.collection("readingResults").where("userId", "==", currentUser.uid).get();
        const results = snap.docs.map(d => d.data());
        const startOfToday = new Date().setHours(0, 0, 0, 0);
        const todayResults = results.filter(r => r.date && r.date.toDate().getTime() >= startOfToday);
        todaysQuests.forEach((q, i) => {
            if (q.check(todayResults)) markQuestDone(`q-daily-${i+1}`);
        });
    } catch (e) { console.log("Görev hatası:", e); }
}

function markQuestDone(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('completed');
        const status = el.querySelector('.quest-status');
        if (status) status.textContent = "🌟";
    }
}

async function loadAllData() {
    console.log("Kitap verileri hazırlanıyor...");
    for (const book of BOOKS_DATA) {
        try {
            if (!loadedBookTexts[book.textSource]) {
                const res = await fetch(book.textSource);
                if (res.ok) {
                    loadedBookTexts[book.textSource] = await res.text();
                }
            }
        } catch (e) { 
            console.error(book.title + " metni yüklenemedi:", e); 
        }
    }
    renderLibrary();
}

function renderLibrary() {
    const list = document.getElementById('book-list');
    if(!list) return;
    
    list.innerHTML = ''; 
    
    BOOKS_DATA.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <h3>${book.title}</h3>
            <p>${book.author}</p>
        `;
        
        card.onclick = () => {
            console.log(book.title + " seçildi.");
            resetSystem();
            
            currentBookId = book.id;
            currentQuizData = book.quiz;
            
            document.getElementById('reading-book-title').textContent = book.title;
            const content = loadedBookTexts[book.textSource] || "Metin yüklenirken bir hata oluştu veya henüz hazır değil.";
            document.getElementById('book-content').textContent = content;
            
            showModule('reading-module');
        };
        
        list.appendChild(card);
    });
    console.log("Kitaplık başarıyla oluşturuldu.");
}



function endReading(done) {
    clearInterval(timerInterval);
    const diff = Date.now() - currentSessionStartTime;
    timeSpentMinutes = done ? FIXED_READING_TIME_MINUTES : (diff/60000);
    showModule('quiz-module');
    renderQuiz();
}

function renderQuiz() {
    const area = document.getElementById('quiz-area');
    if(!area) return;
    area.innerHTML = currentQuizData.map((q, i) => `
        <div class="quiz-question">
            <p>${i+1}. ${q.question}</p>
            ${q.options.map(o => `<label><input type="radio" name="q${i}" value="${o}"> <span>${o}</span></label>`).join('')}
        </div>
    `).join('');
    area.onchange = () => {
        const checked = document.querySelectorAll('#quiz-area input[type="radio"]:checked').length;
        document.getElementById('submit-quiz').disabled = (checked !== currentQuizData.length);
    };
}

function resetSystem() {
    console.log("Sistem sıfırlanıyor...");
    if(timerInterval) clearInterval(timerInterval);
    
    const timerDisp = document.getElementById('timer');
    if(timerDisp) timerDisp.textContent = "05:00";
    
    const content = document.getElementById('book-content');
    if(content) {
        content.classList.remove('show-content');
        content.innerHTML = `
            <div class="reading-prep-info" style="padding: 40px 20px; text-align: center; background: rgba(255, 255, 255, 0.02); border-radius: 15px; border: 1px dashed rgba(255, 255, 255, 0.1); margin-top: 20px;">
                <div style="font-size: 50px; margin-bottom: 15px;">📖</div>
                <h3 style="color: #f39c12; margin-bottom: 10px;">Okumaya Hazır mısın?</h3>
                <p style="color: #ccc; font-size: 14px; line-height: 1.6;">Metin şu an gizli. Yukarıdaki <b>"Okumayı Başlat"</b> butonuna bastığında süren başlayacak ve metin görünecektir.</p>
                <div style="margin-top: 15px; font-size: 13px; color: #aaa;">
                    ⏱️ 5 dakikan var | 🚀 Hazır olduğunda başla!
                </div>
            </div>
        `;
    }
    
    const startBtn = document.getElementById('start-button');
    if(startBtn) {
        startBtn.style.display = "block";
        startBtn.style.margin = "20px auto";
    }

    const timerNote = document.getElementById('timer-note');
    if(timerNote) {
        timerNote.classList.remove('invisible');
        timerNote.style.display = "block";
    }

    const finishBtn = document.getElementById('finish-early-button');
    if(finishBtn) finishBtn.classList.add('hidden');

    const sliderContainer = document.getElementById('font-size-container');
    if (sliderContainer) sliderContainer.classList.add('hidden');
}


function startSession() {
    console.log("Okuma başladı...");
    const content = document.getElementById('book-content');
    const timerNote = document.getElementById('timer-note');
    const startBtn = document.getElementById('start-button');
    if(startBtn) {
        startBtn.style.display = "none";
    }
    const finishBtn = document.getElementById('finish-early-button');
    const sliderContainer = document.getElementById('font-size-container');
    if (sliderContainer) sliderContainer.classList.remove('hidden');
    

    if(content) {
        content.classList.add('show-content');
        const book = BOOKS_DATA.find(b => b.id === currentBookId);
        content.textContent = loadedBookTexts[book.textSource] || "Metin yükleniyor...";
    }
    
    if(timerNote) {
        timerNote.classList.add('invisible');
        timerNote.style.display = "none";
    }

    if(startBtn) startBtn.disabled = true;
    if(finishBtn) finishBtn.classList.remove('hidden');

    currentSessionStartTime = Date.now();
    let timeLeft = FIXED_READING_TIME_MINUTES * 60;
    

    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        let min = Math.floor(timeLeft / 60);
        let sec = timeLeft % 60;
        const timerDisp = document.getElementById('timer');
        if(timerDisp) timerDisp.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
        if (timeLeft <= 0) endReading(true);
    }, 1000);
}

function submitQuiz() {
    let score = 0;
    currentQuizData.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q${i}"]:checked`);
        if(sel && sel.value === q.answer) score++;
    });
    
    const words = document.getElementById('book-content').textContent.trim().split(/\s+/).length;
    const wpm = Math.round(words / timeSpentMinutes);
    const scorePercentage = (score / currentQuizData.length) * 100;

    db.collection("readingResults").add({
        userId: currentUser.uid,
        bookTitle: document.getElementById('reading-book-title').textContent,
        score: score,
        total: currentQuizData.length,
        wpm: wpm,
        timeSpent: Number(timeSpentMinutes.toFixed(2)),
        date: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        const resultModule = document.getElementById('result-module');
        resultModule.innerHTML = `
            <div class="result-card">
                <div class="result-icon">${scorePercentage >= 70 ? '🎉' : '📚'}</div>
                <h2 style="margin-bottom:20px;">Okuma Tamamlandı!</h2>
                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-label">Doğru Sayısı</span>
                        <span class="stat-value">${score} / ${currentQuizData.length}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Okuma Hızı</span>
                        <span class="stat-value">${wpm} <small>WPM</small></span>
                    </div>
                </div>
                <div class="progress-container" style="margin-bottom:30px;">
                    <div class="progress-text" style="color:#aaa; font-size:13px; text-align:left; margin-bottom:5px;">Başarı Oranı: %${Math.round(scorePercentage)}</div>
                    <div class="score-bar" style="width:100%; height:12px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden;">
                        <div class="score-fill" id="final-score-fill" style="width: 0%; height:100%; background:linear-gradient(90deg, #f39c12, #ffcc00); transition: width 1.5s ease;"></div>
                    </div>
                </div>
                <button id="back-to-library-btn" class="primary-button" style="width:100%;">Yeni Kitaba Geç</button>
            </div>
        `;

        const backBtn = document.getElementById('back-to-library-btn');
        if(backBtn) backBtn.onclick = () => showModule('library-module');

        showModule('result-module');
        
        setTimeout(() => {
            const fill = document.getElementById('final-score-fill');
            if(fill) fill.style.width = scorePercentage + "%";
        }, 150);

        checkQuests();
        loadHistoryToSidebar();
    });
}
async function updateProfileStatsAndBadges() {
    if (!currentUser) return;
    try {
        const snap = await db.collection("readingResults").where("userId", "==", currentUser.uid).get();
        const results = snap.docs.map(d => d.data());
        
        const totalTests = results.length;
        document.getElementById('profile-total-tests').textContent = totalTests;

        let avgScore = 0;
        if (totalTests > 0) {
            const sumPercentages = results.reduce((acc, r) => acc + (r.score / r.total), 0);
            avgScore = Math.round((sumPercentages / totalTests) * 100);
        }
        document.getElementById('profile-avg-score').textContent = `%${avgScore}`;

        const badgeList = [
            { n: "Çaylak", i: "🌱", r: 1, desc: "1 Test Çöz" },
            { n: "Okur", i: "📖", r: 5, desc: "5 Test Çöz" },
            { n: "Kitap Kurdu", i: "📚", r: 10, desc: "10 Test Çöz" },
            { n: "Bilge", i: "🧙‍♂️", r: 20, desc: "20 Test Çöz" },
            { n: "Efsane", i: "🏆", r: 50, desc: "50 Test Çöz" }
        ];

        const html = badgeList.map(b => `
            <div class="badge-item ${totalTests >= b.r ? 'earned' : ''}">
                <span class="badge-icon">${b.i}</span>
                <span class="badge-name">${b.n}</span>
                <span class="badge-condition" style="display:block; font-size:10px; color:#aaa; margin-top:5px;">${b.desc}</span>
            </div>
        `).join('');
        
        const container = document.getElementById('badges-container');
        if (container) container.innerHTML = html;

    } catch (e) { console.error("Profil yüklenirken hata:", e); }
}

async function loadUserProfile() {
    if (!currentUser) return;
    const userDoc = await db.collection("users").doc(currentUser.uid).get();
    const userData = userDoc.data();
    if(userData) {
        document.getElementById('profile-full-name').textContent = `${userData.firstName} ${userData.lastName}`;
        document.getElementById('profile-grade-display').textContent = `${userData.grade}. Sınıf`;
        updateProfileStatsAndBadges();
    }
}
async function loadHistoryToSidebar() {
    console.log("Tüm istatistik alanları (Sidebar + Profil) güncelleniyor...");
    
    const streakElements = document.querySelectorAll('#streak-info');
    const statsElements = document.querySelectorAll('#stats-area');
    
    if (!firebase.auth().currentUser) return;
    const uid = firebase.auth().currentUser.uid;

    try {
        const snap = await db.collection("readingResults")
            .where("userId", "==", uid)
            .get();

        const results = snap.docs.map(d => d.data());

        const uniqueDays = new Set(results.map(r => r.date?.toDate().toDateString()).filter(d => d));
        const streakText = `${uniqueDays.size} Gün 🔥`;

        streakElements.forEach(el => {
            el.textContent = streakText;
        });

        if (results.length === 0) {
            statsElements.forEach(el => {
                el.innerHTML = '<p style="text-align:center; color:#666; font-size:12px;">Henüz kayıt yok.</p>';
            });
            return;
        }

        const sorted = results.sort((a,b) => (b.date?.toDate() || 0) - (a.date?.toDate() || 0)).slice(0, 5);

        const historyHTML = sorted.map(d => {
            const dDate = d.date ? d.date.toDate() : new Date();
            const success = (d.score / d.total) * 100;
            let borderCol = success >= 80 ? '#2ecc71' : (success >= 50 ? '#f1c40f' : '#e74c3c');
            const timeStr = d.timeSpent < 1 ? `${Math.round(d.timeSpent * 60)}sn` : `${Math.floor(d.timeSpent)}dk`;

            return `
                <div class="history-card" style="border-left: 4px solid ${borderCol}; background: rgba(255,255,255,0.03); margin-bottom: 10px; padding: 12px; border-radius: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <strong style="color:#fff; font-size:13px;">${d.bookTitle}</strong>
                        <span style="color:#666; font-size:10px;">${dDate.toLocaleDateString('tr-TR')}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#aaa;">
                        <span>🎯 ${d.score}/${d.total}</span>
                        <span>⚡ ${d.wpm} WPM</span>
                        <span>⏱️ ${timeStr}</span>
                    </div>
                </div>
            `;
        }).join('');

        statsElements.forEach(el => {
            el.innerHTML = historyHTML;
        });

    } catch (e) {
        console.error("Güncelleme sırasında hata:", e);
    }
}

async function loadLeaderboard() {
    showModule('leaderboard-module');
    const listDiv = document.getElementById('leaderboard-list');
    if(!listDiv) {
        console.error("HATA: 'leaderboard-list' ID'li div bulunamadı!");
        return;
    }
    
    listDiv.innerHTML = "<p style='padding:20px; color:#aaa;'>Veriler analiz ediliyor...</p>";

    try {
        console.log("Firebase'den veriler çekiliyor...");
        const resultsSnap = await db.collection("readingResults").get();
        const usersSnap = await db.collection("users").get();
        
        console.log("Sonuç sayısı:", resultsSnap.size);
        console.log("Kullanıcı sayısı:", usersSnap.size);

        if(resultsSnap.empty) {
            listDiv.innerHTML = "<p style='padding:20px;'>Henüz kayıtlı test sonucu yok.</p>";
            return;
        }

        const userNames = {};
        usersSnap.forEach(doc => {
            const data = doc.data();
            userNames[doc.id] = `${data.firstName || 'Bilinmeyen'} ${(data.lastName ? data.lastName[0] : '')}.`;
        });

        const counts = {};
        resultsSnap.forEach(doc => {
            const data = doc.data();
            const uid = data.userId;
            if(uid) {
                counts[uid] = (counts[uid] || 0) + 1;
            }
        });

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        listDiv.innerHTML = sorted.map((item, index) => {
            const name = userNames[item[0]] || "Gizli Okur";
            const score = item[1];
            const medals = ["🥇", "🥈", "🥉"];
            const rank = index < 3 ? medals[index] : `#${index + 1}`;
            
            return `
                <div class="leaderboard-item" style="display:flex; justify-content:space-between; padding:12px; margin-bottom:8px; background:rgba(255,255,255,0.05); border-radius:8px;">
                    <span><b style="color:var(--primary-color); margin-right:10px;">${rank}</b> ${name}</span>
                    <span><b>${score}</b> Kitap</span>
                </div>
            `;
        }).join('');

    } catch (e) { 
        console.error("DETAYLI HATA:", e);
        listDiv.innerHTML = `<p style="color:red; padding:20px;">Hata oluştu: ${e.message}</p>`; 
    }
}

document.getElementById('main-auth-button').onclick = handleAuth;
document.getElementById('toggle-auth-btn').onclick = () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('register-fields').classList.toggle('hidden');
    document.getElementById('auth-title').textContent = authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
};
document.getElementById('sign-out-button').onclick = () => auth.signOut();
document.getElementById('profile-nav-btn').onclick = () => { loadUserProfile(); showModule('profile-module'); };
document.getElementById('library-button').onclick = () => { showModule('library-module'); };
document.getElementById('start-button').onclick = startSession;
document.getElementById('finish-early-button').onclick = () => endReading(false);
document.getElementById('submit-quiz').onclick = submitQuiz;
document.getElementById('new-book-button').onclick = () => showModule('library-module');
document.getElementById('font-size-slider').oninput = (e) => { bookContent.style.fontSize = e.target.value + "px"; };
document.getElementById('leaderboard-btn').onclick = loadLeaderboard;
const profileBtn = document.getElementById('profile-nav-btn');

if (profileBtn) {
    profileBtn.addEventListener('click', () => {
        console.log("Profil butonuna basıldı, veriler güncelleniyor...");
        
        if (typeof showModule === "function") {
            showModule('profile-module');
        } else {
            document.querySelectorAll('.content-module').forEach(m => m.classList.add('hidden'));
            document.getElementById('profile-module').classList.remove('hidden');
        }

        loadHistoryToSidebar(); 
    });
}