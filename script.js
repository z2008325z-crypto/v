/* ============================================================
   وَرْد — منصة إسلامية شاملة
   كل المحتوى يُجلب من واجهات برمجية خارجية (لا يوجد محتوى مكتوب)
   ============================================================ */
'use strict';

/* ---------------- Firebase ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDTF63y8dhvmVBwId57Ojk0gFBnHpwrGK8",
  authDomain: "axel-16012.firebaseapp.com",
  databaseURL: "https://axel-16012-default-rtdb.firebaseio.com",
  projectId: "axel-16012",
  storageBucket: "axel-16012.firebasestorage.app",
  messagingSenderId: "643863426516",
  appId: "1:643863426516:android:4717bd833c24aab2b65241"
};
const GOOGLE_CLIENT_ID = "643863426516-9krqsf3917a381iq9iouufrv0ce35h9o.apps.googleusercontent.com";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

/* ---------------- API endpoints ---------------- */
const API = {
  surahList: 'https://api.alquran.cloud/v1/surah',
  surahText: n => `https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`,
  surahAudio: n => `https://api.alquran.cloud/v1/surah/${n}/ar.alafasy`,
  dailyAyah: 'https://api.alquran.cloud/v1/ayah/{n}/quran-uthmani',
  hadithBooks: 'https://api.hadith.gading.dev/books',
  hadithRange: (b, a, z) => `https://api.hadith.gading.dev/books/${b}?range=${a}-${z}`,
  azkarJson: 'https://raw.githubusercontent.com/osamayy/azkar-db/master/azkar.json',
  timings: (lat, lng, ts, method) =>
    `https://api.aladhan.com/v1/timings/${ts}?latitude=${lat}&longitude=${lng}&method=${method}`,
  timingsByCity: (city, method) =>
    `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=&method=${method}`
};

/* ---------------- Helpers ---------------- */
const $ = s => document.querySelector(s); const $$ = s => [...document.querySelectorAll(s)];

const svgPlay = '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>';
const svgPause = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>';
const svgBookmark = '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const svgBookmarkFill = '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" fill="currentColor"/></svg>';
const svgClose = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function toast(msg, ok = true) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', !ok);
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.hidden = true, 3200);
}

async function jget(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

const PRAYERS = [
  ['Fajr', 'الفجر'], ['Sunrise', 'الشروق'], ['Dhuhr', 'الظهر'],
  ['Asr', 'العصر'], ['Maghrib', 'المغرب'], ['Isha', 'العشاء']
];
const BOOK_NAME_AR = {
  'bukhari': 'صحيح البخاري', 'muslim': 'صحيح مسلم', 'abu-daud': 'سنن أبي داود',
  'ibnu-majah': 'سنن ابن ماجه', 'ahmad': 'مسند أحمد', 'an-nasai': 'سنن النسائي',
  'malik': 'موطأ مالك', 'musnad-ahmad': 'مسند أحمد', 'ad-darimi': 'سنن الدارمي',
  'al-hakim': 'مستدرك الحاكم', 'ath-thabrani': 'معاجم الطبراني', 'tirmidzi': 'سنن الترمذي',
  'ibn-hibban': 'صحيح ابن حبان', 'al-baihaqi': 'سنن البيهقي'
};

/* ---------------- Router ---------------- */
const routes = ['home','quran','hadith','azkar','prayer','tasbih','qibla','favorites'];
function route() {
  const h = (location.hash || '#home').slice(1).split('?')[0];
  const r = routes.includes(h) ? h : 'home';
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'sec-' + r));$$
('#mainNav a').forEach(a => a.classList.toggle('active', a.dataset.route === r));
  $('#mainNav').classList.remove('open');
  window.scrollTo({ top: 0 });
  if (r === 'favorites') renderFavorites();
}
window.addEventListener('hashchange', route);
$('#navToggle').addEventListener('click', () => $('#mainNav').classList.toggle('open'));

/* ============================================================
   HOME — daily ayah / hadith / hijri
   ============================================================ */
function ayahOfDay() {
  const day = Math.floor(Date.now() / 864e5);
  return (day * 2654435761) % 6236 + 1;
}

async function loadDailyAyah() {
  try {
    const d = await jget(API.dailyAyah.replace('{n}', ayahOfDay()));
    $('#dailyAyah').textContent = d.data.text;
    $('#dailyAyahRef').textContent = `سورة ${d.data.surah.name} — الآية ${d.data.numberInSurah}`;
  } catch {
    $('#dailyAyah').textContent = 'تعذّر الاتصال بخادم الآيات، حاول تحديث الصفحة.';
  }
}
async function loadRandomAyah() {
  try {
    const n = Math.floor(Math.random() * 6236) + 1;
    const d = await jget(API.dailyAyah.replace('{n}', n));
    $('#dailyAyah').textContent = d.data.text;
    $('#dailyAyahRef').textContent = `سورة ${d.data.surah.name} — الآية ${d.data.numberInSurah}`;
  } catch { toast('تعذر جلب الآية', false); }
}

let dailyHadith = null;
async function loadDailyHadith() {
  try {
    const books = ['muslim', 'bukhari', 'tirmidzi', 'ibnu-majah'];
    const b = books[Math.floor(Math.random() * books.length)];
    const d = await jget(API.hadithRange(b, 1, 50));
    const list = d.data.hadiths;
    const h = list[Math.floor(Math.random() * list.length)];
    dailyHadith = h;
    $('#dailyHadith').textContent = h.arab;
    $('#dailyHadithRef').textContent = `${BOOK_NAME_AR[b] || d.data.name} — حديث رقم ${h.number}`;
  } catch {
    $('#dailyHadith').textContent = 'تعذّر الاتصال بخادم الأحاديث، حاول تحديث الصفحة.';
  }
}

async function loadHijri() {
  try {
    const ts = Math.floor(Date.now() / 1000);
    const d = await jget(`https://api.aladhan.com/v1/gToH/${new Date().toISOString().slice(0,10)}?adjustment=0`);
    const h = d.data.hijri;
    $('#hijriDate').textContent = `${h.weekday.ar}، ${h.day} ${h.month.ar} ${h.year} هـ`;
  } catch { $('#hijriDate').textContent = ''; }
}
$('#newAyahBtn').addEventListener('click', loadRandomAyah);
$('#newHadithBtn').addEventListener('click', loadDailyHadith);

/* ============================================================
   QURAN
   ============================================================ */
let surahs = [];
async function loadSurahList() {
  try {
    const d = await jget(API.surahList);
    surahs = d.data;
    renderSurahList(surahs);
  } catch {
    $('#surahList').innerHTML = '<p class="error-msg">تعذر تحميل قائمة السور. تحقق من الاتصال بالإنترنت.</p>';
  }
}
function renderSurahList(list) {
  $('#surahList').innerHTML = list.map(s => `
    <button class="surah-item" data-n="${s.number}">
      <span class="surah-num">${s.number}</span>
      <span class="surah-name">${s.name}</span>
      <span class="surah-meta">${s.englishName} — ${s.numberOfAyahs} آية — ${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</span>
    </button>`).join('');
  $$('#surahList .surah-item').forEach(b =>
    b.addEventListener('click', () => openSurah(+b.dataset.n)));
}
$('#surahSearch').addEventListener('input', e => {
  const q = e.target.value.trim();
  if (!q) return renderSurahList(surahs);
  renderSurahList(surahs.filter(s =>
    s.name.includes(q) || s.englishName.toLowerCase().includes(q.toLowerCase()) || String(s.number) === q));
});

let currentSurah = null;
async function openSurah(n) {
  const reader = $('#reader');
  reader.innerHTML = '<div class="skeleton tall"></div>';
  try {
    const [t, a] = await Promise.all([jget(API.surahText(n)), jget(API.surahAudio(n))]);
    const texts = t.data.ayahs, audios = a.data.ayahs;
    currentSurah = {
      number: n,
      name: t.data.name,
      englishName: t.data.englishName,
      ayahs: texts.map((tx, i) => ({
        text: tx.text, num: tx.number, numInSurah: tx.numberInSurah,
        audio: audios[i] ? audios[i].audio : null
      }))
    };
    renderReader();
  } catch {
    reader.innerHTML = '<p class="error-msg">تعذر تحميل السورة، حاول مجدداً.</p>';
  }
}
function renderReader() {
  const s = currentSurah;
  const reader = $('#reader');
  reader.innerHTML = `
    <div class="reader-head">
      <div>
        <h3 class="reader-title">سورة ${s.name}</h3>
        <p class="reader-sub">${s.englishName} — ${s.ayahs.length} آية</p>
      </div>
      <button class="btn" id="playSurahBtn">${svgPlay}<span>استماع للسورة كاملة</span></button>
    </div>
    <div class="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
    <div class="ayahs">
      ${s.ayahs.map((a, i) => `
        <span class="ayah" data-i="${i}">${a.text}
          <span class="ayah-num">${a.numInSurah}</span>
          <button class="mini-btn ayah-play" data-i="${i}" title="استماع للآية">${svgPlay}</button>
          <button class="mini-btn ayah-fav" data-i="${i}" title="حفظ">${favIcon('ayah', a.num)}</button>
        </span>`).join('')}
    </div>`;
  $('#playSurahBtn').addEventListener('click', () => {
    if (player.queue.length && player.surah === s.number) togglePlay();
    else playSurah(s.number);
  });
  $$('.ayah-play').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); playSingle(+b.dataset.i); }));$$
('.ayah-fav').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); toggleFav('ayah', b.dataset.i);
  }));
  refreshFavIcons();
}

/* ---------------- Audio player ---------------- */
const player = { queue: [], i: 0, surah: null, playing: false, el: new Audio() };
player.el.addEventListener('ended', () => nextAyah());
player.el.addEventListener('error', () => { toast('تعذر تشغيل الصوت', false); player.playing = false; updatePlayerBar(); });

function playSurah(n) {
  if (!currentSurah || currentSurah.number !== n) return;
  player.queue = currentSurah.ayahs.map(a => a.audio).filter(Boolean);
  player.i = 0; player.surah = n;
  playCurrent();
}
function playSingle(i) {
  const a = currentSurah.ayahs[i];
  if (!a.audio) return toast('الصوت غير متوفر لهذه الآية', false);
  player.queue = [a.audio]; player.i = 0; player.surah = currentSurah.number;
  playCurrent();
}
function playCurrent() {
  player.el.src = player.queue[player.i];
  player.el.play().catch(() => toast('اضغط مجدداً للتشغيل', false));
  player.playing = true;
  updatePlayerBar();
  highlightAyah();
}
function togglePlay() {
  if (player.playing) { player.el.pause(); player.playing = false; }
  else { player.el.play().catch(()=>{}); player.playing = true; }
  updatePlayerBar();
}
function nextAyah() {
  if (player.i < player.queue.length - 1) { player.i++; playCurrent(); }
  else { stopPlayer(); toast('انتهت التلاوة'); }
}
function prevAyah() { if (player.i > 0) { player.i--; playCurrent(); } }
function stopPlayer() {
  player.el.pause(); player.playing = false; player.queue = [];
  updatePlayerBar(); highlightAyah();
}
function updatePlayerBar() {
  const bar = $('#playerBar');
  const on = player.queue.length > 0;
  bar.hidden = !on;
  $('#playerToggleIcon').innerHTML = player.playing
    ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/>'
    : '<path d="M7 4l13 8-13 8z" fill="currentColor"/>';
  if (on && currentSurah) {
    $('#playerTitle').textContent = `سورة ${currentSurah.name}`;
    $('#playerAyah').textContent = `الآية ${currentSurah.ayahs.filter(a=>a.audio)[player.i]?.numInSurah || player.i + 1}`;
  }
}
function highlightAyah() {
  $$('.ayah.playing').forEach(x => x.classList.remove('playing'));
  if (!player.queue.length || !currentSurah) return;
  const auds = currentSurah.ayahs.filter(a => a.audio);
  const idx = currentSurah.ayahs.indexOf(auds[player.i]);
  const el = document.querySelector(`.ayah[data-i="${idx}"]`);
  if (el) el.classList.add('playing');
}
$('#playerToggle').addEventListener('click', togglePlay);
$('#playerNext').addEventListener('click', nextAyah);
$('#playerPrev').addEventListener('click', prevAyah);
$('#playerClose').addEventListener('click', stopPlayer);

/* ============================================================
   HADITH
   ============================================================ */
let hadithState = { book: null, from: 1, size: 20, loading: false, name: '' };
async function loadBooks() {
  try {
    const d = await jget(API.hadithBooks);
    const books = d.data.books || [];
    $('#bookList').innerHTML = books.map(b => `
      <button class="book-item" data-b="${b.id}">
        <svg viewBox="0 0 24 24" class="ic"><path d="M12 5C9 3.5 5 3.5 3 4.5v14c2-1 6-1 9 .5 3-1.5 7-1.5 9-.5v-14c-2-1-6-1-9 .5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 5v14" stroke="currentColor" stroke-width="1.6"/></svg>
        <span>${BOOK_NAME_AR[b.id] || b.name}</span>
        <small>${b.available || ''} حديث</small>
      </button>`).join('');
    $$('#bookList .book-item').forEach(b =>
      b.addEventListener('click', () => openBook(b.dataset.b)));
  } catch {
    $('#bookList').innerHTML = '<p class="error-msg">تعذر تحميل الكتب.</p>';
  }
}
async function openBook(bookId) {
  hadithState = { book: bookId, from: 1, size: 20, loading: false, name: BOOK_NAME_AR[bookId] || bookId };
  await loadHadithChunk(true);
}
async function loadHadithChunk(reset) {
  if (hadithState.loading) return;
  hadithState.loading = true;
  const { book, from, size } = hadithState;
  try {
    const d = await jget(API.hadithRange(book, from, from + size - 1));
    const list = d.data.hadiths || [];
    const panel = $('#hadithPanel');
    if (reset) {
      panel.innerHTML = `
        <div class="hadith-head">
          <h3>${hadithState.name}</h3>
          <span class="hadith-count">${d.data.available} حديث</span>
        </div>
        <div id="hadithList" class="hadith-list"></div>
        <button class="btn ghost wide" id="moreHadith">تحميل المزيد</button>`;
      $('#moreHadith').addEventListener('click', () => loadHadithChunk(false));
    }
    const wrap = $('#hadithList');
    list.forEach(h => {
      const id = `h-${book}-${h.number}`;
      const el = document.createElement('div');
      el.className = 'hadith-item';
      el.innerHTML = `
        <p class="hadith-text">${h.arab}</p>
        <div class="hadith-foot">
          <span class="badge">حديث ${h.number}</span>
          <button class="mini-btn hadith-fav" data-id="${id}" data-num="${h.number}" title="حفظ">${favIcon('hadith', id)}</button>
        </div>`;
      wrap.appendChild(el);
    });
    $$('.hadith-fav').forEach(b => b.addEventListener('click', () => toggleFav('hadith', b.dataset.id, +b.dataset.num)));
    refreshFavIcons();
    hadithState.from += list.length;
    if (!list.length || hadithState.from > d.data.available) {
      const m = $('#moreHadith'); if (m) m.remove();
    }
  } catch {
    toast('تعذر تحميل الأحاديث', false);
  }
  hadithState.loading = false;
}

/* ============================================================
   AZKAR
   ============================================================ */
let azkarCache = null;
const AZKAR_MAP = { morning: 'أذكار الصباح', evening: 'أذكار المساء', afterPrayer: 'أذكار بعد الصلاة' };
let azkarCat = 'morning';

async function loadAzkar(cat) {
  azkarCat = cat;
  const listEl = $('#azkarList');
  listEl.innerHTML = '<div class="skeleton tall"></div>';
  try {
    if (!azkarCache) azkarCache = (await jget(API.azkarJson));
    const catName = AZKAR_MAP[cat];
    const items = (azkarCache[catName] || []).map(z => ({ ...z, left: +z.count || 1, done: false }));
    if (!items.length) throw new Error('empty');
    listEl.innerHTML = '';
    items.forEach((z, i) => {
      const el = document.createElement('div');
      el.className = 'dhikr-card';
      el.innerHTML = `
        <p class="dhikr-text">${z.content}</p>
        ${z.description && z.description !== catName ? `<p class="dhikr-desc">${z.description}</p>` : ''}
        ${z.reference ? `<p class="dhikr-ref">${z.reference}</p>` : ''}
        <button class="dhikr-count" data-i="${i}"><span>${z.left}</span></button>`;
      el.querySelector('.dhikr-count').addEventListener('click', ev => {
        const btn = ev.currentTarget;
        z.left--;
        if (z.left <= 0) { z.left = 0; z.done = true; el.classList.add('done'); }
        btn.querySelector('span').textContent = z.left;
        if (z.done) toast('ما شاء الله، أتممت هذا الذكر');
      });
      listEl.appendChild(el);
    });
  } catch {
    listEl.innerHTML = '<p class="error-msg">تعذر تحميل الأذكار من الخادم. تحقق من الاتصال وحاول مجدداً.</p>';
  }
}
$$('#azkarTabs .tab').forEach(t => t.addEventListener('click', () => {   $$
('#azkarTabs .tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  loadAzkar(t.dataset.cat);
}));

/* ============================================================
   PRAYER TIMES
   ============================================================ */
let prayerTimer = null;
async function fetchTimings(lat, lng) {
  const method = $('#methodSelect').value;
  const ts = Math.floor(Date.now() / 1000);
  const d = await jget(API.timings(lat, lng, ts, method));
  renderPrayers(d.data);
}
async function fetchByCity(city) {
  const method = $('#methodSelect').value;
  const d = await jget(API.timingsByCity(city, method));
  if (d.code !== 200) throw new Error('city');
  renderPrayers(d.data);
}
function to12h(t) {
  let [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${p}`;
}
function renderPrayers(data) {
  const t = data.timings;
  $('#prayerGrid').innerHTML = PRAYERS.map(([k, ar]) => `
    <div class="prayer-card ${k}" data-k="${k}">
      <span class="prayer-name">${ar}</span>
      <span class="prayer-time">${to12h(t[k])}</span>
    </div>`).join('');
  const h = data.date.hijri;
  $('#hijriDate').textContent = `${h.weekday.ar}، ${h.day} ${h.month.ar} ${h.year} هـ`;

  clearInterval(prayerTimer);
  const now = new Date();
  const order = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  let next = null;
  for (const k of order) {
    const [hH, hM] = t[k].split(':').map(Number);
    const dte = new Date(); dte.setHours(hH, hM, 0, 0);
    if (dte > now) { next = { k, dte }; break; }
  }
  if (!next) {
    const [hH, hM] = t['Fajr'].split(':').map(Number);
    const dte = new Date(); dte.setDate(dte.getDate() + 1); dte.setHours(hH, hM, 0, 0);
    next = { k: 'Fajr', dte };
  }
  const tick = () => {
    const diff = next.dte - Date.now();
    if (diff <= 0) return renderPrayers(data);
    const hh = Math.floor(diff / 36e5), mm = Math.floor(diff % 36e5 / 6e4), ss = Math.floor(diff % 6e4 / 1e3);
    const ar = PRAYERS.find(p => p[0] === next.k)[1];
    $('#nextPrayerHome').innerHTML =
      `<span class="np-name">${ar}</span> بعد <span class="np-count">${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</span>`;
  };
  tick(); prayerTimer = setInterval(tick, 1000);
  $$('#prayerGrid .prayer-card').forEach(c => c.classList.toggle('next', c.dataset.k === next.k));
}
function useLocation(cb, errCb) {
  if (!navigator.geolocation) return errCb('المتصفح لا يدعم تحديد الموقع');
  navigator.geolocation.getCurrentPosition(
    p => cb(p.coords.latitude, p.coords.longitude),
    () => errCb('تعذر الوصول إلى موقعك'),
    { timeout: 10000 });
}
$('#locateBtn').addEventListener('click', () =>
  useLocation(fetchTimings, m => toast(m, false)));
$('#cityBtn').addEventListener('click', async () => {
  const c = $('#cityInput').value.trim();
  if (!c) return toast('اكتب اسم المدينة', false);
  try { await fetchByCity(c); } catch { toast('لم يتم العثور على المدينة', false); }
});
$('#methodSelect').addEventListener('change', () => {
  useLocation(fetchTimings, () => {});
});

/* ============================================================
   TASBIH
   ============================================================ */
const tasbih = JSON.parse(localStorage.getItem('ward-tasbih') || '{"count":0,"total":0,"rounds":0,"target":100}');
const RING_LEN = 552.9;
function saveTasbih() { localStorage.setItem('ward-tasbih', JSON.stringify(tasbih)); }
function renderTasbih() {
  $('#tasbihCount').textContent = tasbih.count;
  $('#tasbihTotal').textContent = tasbih.total;
  $('#tasbihRounds').textContent = tasbih.rounds;
  $('#tasbihDhikr').textContent = $('#dhikrSelect').value;
  const off = RING_LEN * (1 - tasbih.count / tasbih.target);
  $('#ringFg').style.strokeDashoffset = Math.max(0, off);
}
$('#tasbihRing').addEventListener('click', () => {
  tasbih.count++; tasbih.total++;
  if (tasbih.count >= tasbih.target) {
    tasbih.count = 0; tasbih.rounds++;
    toast('أتممت جولة تسبيح كاملة');
  }
  saveTasbih(); renderTasbih();
});
$('#tasbihReset').addEventListener('click', () => { tasbih.count = 0; saveTasbih(); renderTasbih(); });
$('#dhikrSelect').addEventListener('change', renderTasbih);
$$('.tasbih-targets .chip').forEach(c => c.addEventListener('click', () => {$$
('.tasbih-targets .chip').forEach(x => x.classList.remove('active'));
  c.classList.add('active');
  tasbih.target = +c.dataset.target; tasbih.count = 0;
  saveTasbih(); renderTasbih();
}));

/* ============================================================
   QIBLA
   ============================================================ */
const KAABA = { lat: 21.4225, lng: 39.8262 };
function qiblaAngle(lat, lng) {
  const φ = lat * Math.PI / 180, λ = lng * Math.PI / 180;
  const φK = KAABA.lat * Math.PI / 180, λK = KAABA.lng * Math.PI / 180;
  const y = Math.sin(λK - λ);
  const x = Math.cos(φ) * Math.tan(φK) - Math.sin(φ) * Math.cos(λK - λ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
$('#qiblaLocateBtn').addEventListener('click', () =>
  useLocation((la, ln) => {
    const ang = qiblaAngle(la, ln);
    $('#qiblaResult').innerHTML =
      `اتجاه القبلة من موقعك: <strong>${ang.toFixed(1)}°</strong> من الشمال باتجاه عقارب الساعة`;
    $('#compassWrap').hidden = false;
    $('#qiblaDegree').textContent = `${ang.toFixed(1)}° من الشمال`;
    $('#qiblaNeedle').setAttribute('transform', `rotate(${ang} 130 130)`);
  }, m => toast(m, false)));
$('#manualRotate').addEventListener('input', e => {
  $('#compassDial').setAttribute('transform', `rotate(${-e.target.value} 130 130)`);
});

/* ============================================================
   FAVORITES
   ============================================================ */
function favKey(type, id) { return `${type}:${id}`; }
function getLocalFavs() { return JSON.parse(localStorage.getItem('ward-favs') || '[]'); }
function setLocalFavs(v) { localStorage.setItem('ward-favs', JSON.stringify(v)); }

async function getFavs() {
  const u = auth.currentUser;
  if (u) {
    const snap = await db.ref('users/' + u.uid + '/favs').get();
    const val = snap.val();
    return val ? Object.values(val) : [];
  }
  return getLocalFavs();
}
async function toggleFav(type, idx, num) {
  let id, payload;
  if (type === 'ayah' && currentSurah) {
    const a = currentSurah.ayahs[+idx];
    id = a.num;
    payload = { type, id: favKey(type, id), text: a.text, ref: `سورة ${currentSurah.name} — الآية ${a.numInSurah}` };
  } else if (type === 'hadith') {
    id = idx;
    payload = { type, id: favKey(type, id), text: document.querySelector(`[data-id="${id}"]`).closest('.hadith-item').querySelector('.hadith-text').textContent, ref: `${hadithState.name} — حديث رقم ${num}` };
  }
  const key = favKey(type, id);
  const favs = await getFavs();
  const exists = favs.some(f => f.id === key);
  const u = auth.currentUser;
  if (exists) {
    if (u) {
      const snap = await db.ref('users/' + u.uid + '/favs').get();
      const val = snap.val() || {};
      const k = Object.keys(val).find(k => val[k].id === key);
      if (k) await db.ref('users/' + u.uid + '/favs/' + k).remove();
    } else setLocalFavs(favs.filter(f => f.id !== key));
    toast('تمت الإزالة من المحفوظات');
  } else {
    if (u) await db.ref('users/' + u.uid + '/favs').push(payload);
    else setLocalFavs([...favs, payload]);
    toast('تمت الإضافة إلى المحفوظات');
  }
  refreshFavIcons();
  if ($('#sec-favorites').classList.contains('active')) renderFavorites();
}
function favIcon(type, id) {
  const key = favKey(type, id);
  const has = (toggleFav._cache || []).some(f => f.id === key);
  return has ? svgBookmarkFill : svgBookmark;
}
async function refreshFavIcons() {
  const favs = await getFavs();
  toggleFav._cache = favs;
  $$('.ayah-fav').forEach(b => {     const a = currentSurah && currentSurah.ayahs[+b.dataset.i];     if (a) b.innerHTML = favs.some(f => f.id === favKey('ayah', a.num)) ? svgBookmarkFill : svgBookmark;   });   $$
('.hadith-fav').forEach(b => {
    b.innerHTML = favs.some(f => f.id === favKey('hadith', b.dataset.id)) ? svgBookmarkFill : svgBookmark;
  });
}
async function renderFavorites() {
  const listEl = $('#favList');
  const favs = await getFavs();
  if (!favs.length) {
    listEl.innerHTML = `<div class="reader-empty">
      <svg viewBox="0 0 96 96" class="empty-art"><path d="M48 12C36 7 20 7 12 11v58c8-4 24-4 36 1 12-5 28-5 36-1V11c-8-4-24-4-36 1z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M48 12v59" stroke="currentColor" stroke-width="2"/></svg>
      <p>لا توجد محفوظات بعد — احفظ آياتك وأحاديثك المفضلة بالضغط على أيقونة الحفظ</p></div>`;
    return;
  }
  listEl.innerHTML = '';
  favs.forEach(f => {
    const el = document.createElement('div');
    el.className = 'fav-item';
    el.innerHTML = `
      <span class="badge">${f.type === 'ayah' ? 'آية قرآنية' : 'حديث نبوي'}</span>
      <p class="${f.type === 'ayah' ? 'quran-text' : 'hadith-text'}">${f.text}</p>
      <p class="daily-ref">${f.ref || ''}</p>
      <button class="mini-btn fav-del">${svgClose}</button>`;
    el.querySelector('.fav-del').addEventListener('click', async () => {
      const u = auth.currentUser;
      if (u) {
        const snap = await db.ref('users/' + u.uid + '/favs').get();
        const val = snap.val() || {};
        const k = Object.keys(val).find(k => val[k].id === f.id);
        if (k) await db.ref('users/' + u.uid + '/favs/' + k).remove();
      } else setLocalFavs((await getFavs()).filter(x => x.id !== f.id));
      renderFavorites(); refreshFavIcons();
    });
    listEl.appendChild(el);
  });
}

/* ============================================================
   AUTH — Email / Phone / Google
   ============================================================ */
function openAuth() { $('#authModal').hidden = false; }
function closeAuth() { $('#authModal').hidden = true; }
$('#authClose').addEventListener('click', closeAuth);
$('#authModal').addEventListener('click', e => { if (e.target.id === 'authModal') closeAuth(); }); $$('.auth-tabs .tab').forEach(t => t.addEventListener('click', () => {$$('.auth-tabs .tab').forEach(x => x.classList.remove('active'));   t.classList.add('active');   $$('.auth-pane').forEach(p => p.classList.remove('active'));$('#pane-' + t.dataset.atab).classList.add('active');
}));

const msg = (id, m, ok) => { const e = $(id); e.textContent = m; e.className = 'auth-msg ' + (ok ? 'ok' : 'err'); };

$('#loginBtn').addEventListener('click', async () => {
  try {
    await auth.signInWithEmailAndPassword($('#emailInput').value.trim(), $('#passwordInput').value);
    msg('#emailMsg', 'تم تسجيل الدخول بنجاح', true); closeAuth();
  } catch (e) { msg('#emailMsg', e.message.replace('Firebase:', ''), false); }
});
$('#signupBtn').addEventListener('click', async () => {
  try {
    await auth.createUserWithEmailAndPassword($('#emailInput').value.trim(), $('#passwordInput').value);
    msg('#emailMsg', 'تم إنشاء الحساب بنجاح', true); closeAuth();
  } catch (e) { msg('#emailMsg', e.message.replace('Firebase:', ''), false); }
});
$('#resetBtn').addEventListener('click', async () => {
  const em = $('#emailInput').value.trim();
  if (!em) return msg('#emailMsg', 'اكتب بريدك أولاً', false);
  try { await auth.sendPasswordResetEmail(em); msg('#emailMsg', 'أُرسل رابط الاستعادة إلى بريدك', true); }
  catch (e) { msg('#emailMsg', e.message.replace('Firebase:', ''), false); }
});

/* Phone */
let confirmationResult = null;
function initRecaptcha() {
  if (window.recaptchaVerifier) return;
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'normal' });
  window.recaptchaVerifier.render();
}
$('#sendCodeBtn').addEventListener('click', async () => {
  try {
    initRecaptcha();
    let rawPhone = $('#phoneInput').value.trim();
    let cleanNumber = rawPhone.replace(/^0+/, "");
    if (cleanNumber.startsWith("20")) {
        cleanNumber = cleanNumber.substring(2);
    }
    const phone = '+20' + cleanNumber;
    
    confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
    $('#codeStep').hidden = false;
    msg('#phoneMsg', 'تم إرسال رمز التحقق', true);
  } catch (e) { msg('#phoneMsg', e.message.replace('Firebase:', ''), false); }
});
$('#verifyCodeBtn').addEventListener('click', async () => {
  try {
    await confirmationResult.confirm($('#codeInput').value.trim());
    msg('#phoneMsg', 'تم تسجيل الدخول بنجاح', true); closeAuth();
  } catch (e) { msg('#phoneMsg', 'رمز غير صحيح', false); }
});

/* Google */
function initGoogle() {
  if (!window.google || !google.accounts) return setTimeout(initGoogle, 500);
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleToken });
  google.accounts.id.renderButton($('#googleBtnWrap'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ar' });
}
function onGoogleToken(resp) {
  const cred = firebase.auth.GoogleAuthProvider.credential(resp.credential);
  auth.signInWithCredential(cred)
    .then(() => { msg('#googleMsg', 'تم تسجيل الدخول بنجاح', true); closeAuth(); })
    .catch(e => msg('#googleMsg', e.message.replace('Firebase:', ''), false));
}

function renderAuthArea(user) {
  const area = $('#authArea');
  if (user) {
    area.innerHTML = `
      <div class="user-chip">
        <span class="avatar">${(user.displayName || user.email || user.phoneNumber || 'م')[0]}</span>
        <span class="user-name">${user.displayName || (user.email ? user.email.split('@')[0] : user.phoneNumber)}</span>
        <button class="mini-btn" id="logoutBtn" title="تسجيل الخروج">
          <svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-5 4 5 4M5 12h11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;
    $('#logoutBtn').addEventListener('click', () => auth.signOut());
  } else {
    area.innerHTML = `<button class="btn small" id="loginOpenBtn">تسجيل الدخول</button>`;
    $('#loginOpenBtn').addEventListener('click', openAuth);
  }
}
auth.onAuthStateChanged(async u => {
  renderAuthArea(u);
  if (u) {
    const snap = await db.ref('users/' + u.uid).get();
    if (!snap.exists()) await db.ref('users/' + u.uid).set({ created: Date.now() });
  }
  refreshFavIcons();
});

/* ============================================================
   INIT
   ============================================================ */
route();
loadHijri();
loadDailyAyah();
loadDailyHadith();
loadSurahList();
loadBooks();
loadAzkar('morning');
renderTasbih();
initGoogle();
useLocation(fetchTimings, () => {});
