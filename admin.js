/* ========== ADMIN SCREEN, THEMES, BANS, VERIFICATION, GROUP ROLES ========== */

const BOOTSTRAP_ADMIN_EMAIL = 'abmen@gmail.com';
const PERMANENT_UNTIL = 9999999999999;
const BAN_TYPES = {
  temp: { label: 'حظر موقت (يومين)', ms: 2 * 24 * 3600 * 1000 },
  disc: { label: 'حظر تأديبي (أسبوع)', ms: 7 * 24 * 3600 * 1000 },
  perm: { label: 'حظر دائم', ms: null }
};
const DEFAULT_BUBBLE = { style: 'rounded', radius: 18, font: 15, maxw: 70 };

function themeVars(o) {
  return {
    '--bg': o.bg, '--bg-secondary': o.bg2, '--bg-tertiary': o.bg3,
    '--surface': o.surface, '--surface-hover': o.hover,
    '--border': o.border, '--border-light': o.border2,
    '--accent': o.accent, '--accent-light': o.accentL, '--accent-dark': o.accentD,
    '--accent-glow': o.glow, '--text': o.text, '--text-secondary': o.text2, '--text-muted': o.muted
  };
}
const THEMES = {
  gold: { name: 'ذهبي (افتراضي)', preview: 'linear-gradient(135deg,#050505,#d4af37)', vars: themeVars({
    bg: '#050505', bg2: '#0b0b0b', bg3: '#131313', surface: '#161616', hover: '#202020', border: '#242424', border2: '#343434',
    accent: '#d4af37', accentL: '#f0d675', accentD: '#9c7a1c', glow: 'rgba(212,175,55,0.28)',
    text: '#f4f4f4', text2: '#bdbdbd', muted: '#7a7a7a' }) },
  purple: { name: 'بنفسجي ليلي', preview: 'linear-gradient(135deg,#0b0614,#a855f7)', vars: themeVars({
    bg: '#0b0614', bg2: '#120a1e', bg3: '#1a102b', surface: '#1f1333', hover: '#2a1a44', border: '#2f2148', border2: '#3f2d5e',
    accent: '#a855f7', accentL: '#c084fc', accentD: '#7e22ce', glow: 'rgba(168,85,247,0.28)',
    text: '#f5f3ff', text2: '#cfc6e6', muted: '#8a7fa6' }) },
  ocean: { name: 'أزرق محيطي', preview: 'linear-gradient(135deg,#050d18,#38bdf8)', vars: themeVars({
    bg: '#050d18', bg2: '#091526', bg3: '#0e1d33', surface: '#12233d', hover: '#1a2f4e', border: '#1f3556', border2: '#2c4a75',
    accent: '#38bdf8', accentL: '#7dd3fc', accentD: '#0284c7', glow: 'rgba(56,189,248,0.28)',
    text: '#f0f9ff', text2: '#bcd3e6', muted: '#6b8aa6' }) },
  emerald: { name: 'أخضر زمردي', preview: 'linear-gradient(135deg,#03100a,#10b981)', vars: themeVars({
    bg: '#03100a', bg2: '#071a11', bg3: '#0c2418', surface: '#10301f', hover: '#16402a', border: '#1a4530', border2: '#24603f',
    accent: '#10b981', accentL: '#34d399', accentD: '#047857', glow: 'rgba(16,185,129,0.28)',
    text: '#ecfdf5', text2: '#b9dccb', muted: '#6b9a82' }) },
  light: { name: 'فاتح كلاسيكي', preview: 'linear-gradient(135deg,#f4f4f0,#b8860b)', vars: themeVars({
    bg: '#f4f4f0', bg2: '#ffffff', bg3: '#ebebe6', surface: '#ffffff', hover: '#f1f1ec', border: '#dcdcd5', border2: '#c9c9c0',
    accent: '#b8860b', accentL: '#d4af37', accentD: '#8a6508', glow: 'rgba(184,134,11,0.25)',
    text: '#111111', text2: '#333333', muted: '#777777' }) }
};

/* ========== ELEMENTS ========== */
const adminTopBtn = document.getElementById('adminTopBtn');
const adminScreen = document.getElementById('adminScreen');
const adminBackBtn = document.getElementById('adminBackBtn');
const adminMsg = document.getElementById('adminMsg');
const themeGrid = document.getElementById('themeGrid');
const adminsList = document.getElementById('adminsList');
const adminTarget = document.getElementById('adminTarget');
const addAdminBtn = document.getElementById('addAdminBtn');
const banTarget = document.getElementById('banTarget');
const banType = document.getElementById('banType');
const banReason = document.getElementById('banReason');
const banBtn = document.getElementById('banBtn');
const bansList = document.getElementById('bansList');
const verifyTarget = document.getElementById('verifyTarget');
const verifyBlueBtn = document.getElementById('verifyBlueBtn');
const verifyGoldBtn = document.getElementById('verifyGoldBtn');
const verifyRemoveBtn = document.getElementById('verifyRemoveBtn');
const verifiedList = document.getElementById('verifiedList');
const bubbleStyle = document.getElementById('bubbleStyle');
const bubbleRadius = document.getElementById('bubbleRadius');
const bubbleFont = document.getElementById('bubbleFont');
const bubbleMax = document.getElementById('bubbleMax');
const bubblePreview = document.getElementById('bubblePreview');
const saveBubbleBtn = document.getElementById('saveBubbleBtn');
const banScreen = document.getElementById('banScreen');
const banInfo = document.getElementById('banInfo');
const banLogoutBtn = document.getElementById('banLogoutBtn');
const leaveGroupBtn = document.getElementById('leaveGroupBtn');

let isAdmin = false;
let currentThemeKey = 'gold';
let currentSettings = {};
let verifiedCache = {};
let banWatchRef = null;
let adminMsgTimer = null;

/* ========== AUTH HELPERS (used by script.js) ========== */
function sdkSignIn(email, pass) {
  return firebase.auth().signInWithEmailAndPassword(email, pass)
    .catch(e => console.warn('SDK sign-in failed:', e));
}

async function refreshIdToken() {
  const res = await fetch('https://securetoken.googleapis.com/v1/token?key=' + API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(authRefreshToken)
  });
  const d = await res.json();
  if (!d.id_token) throw new Error('refresh failed');
  authToken = d.id_token;
  authRefreshToken = d.refresh_token;
  localStorage.setItem('nexus_auth_token', authToken);
  localStorage.setItem('nexus_auth_refresh', authRefreshToken);
  return d.user_id;
}

function activeBan(b) {
  return !!b && typeof b.until === 'number' && b.until > Date.now();
}

/* Runs after login / auto-login. Returns true when the user is blocked. */
async function afterLoginChecks() {
  if (!currentUser || currentUser.isGuest) {
    isAdmin = false;
    adminTopBtn.classList.add('hidden');
    return false;
  }
  const uid = currentUser.uid;

  const ban = (await db.ref('bans/' + uid).once('value')).val();
  if (activeBan(ban)) { showBanScreen(ban); return true; }

  const isBootstrap = (currentUser.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
  const adminSnap = await db.ref('admins/' + uid).once('value');
  if (isBootstrap && !adminSnap.exists()) {
    await db.ref('admins/' + uid).set(true).catch(e => console.warn('Bootstrap admin failed:', e));
  }
  isAdmin = isBootstrap || adminSnap.val() === true;
  adminTopBtn.classList.toggle('hidden', !isAdmin);
  watchBan(uid);
  if (typeof startUserFeatures === 'function') startUserFeatures();
  return false;
}

function watchBan(uid) {
  if (banWatchRef) banWatchRef.off();
  banWatchRef = db.ref('bans/' + uid);
  banWatchRef.on('value', s => { if (activeBan(s.val())) showBanScreen(s.val()); });
}

function showBanScreen(ban) {
  const until = ban.until >= PERMANENT_UNTIL ? 'دائم' : 'حتى ' + new Date(ban.until).toLocaleString('ar-EG');
  const label = (BAN_TYPES[ban.type] || {}).label || 'حظر';
  banInfo.innerHTML = 'نوع الحظر: ' + label + '<br>' +
    (ban.reason ? 'السبب: ' + escapeHtml(ban.reason) + '<br>' : '') +
    'المدة: ' + until;
  authScreen.classList.remove('active');
  mainApp.classList.remove('active');
  banScreen.classList.add('active');
}

banLogoutBtn.addEventListener('click', async () => {
  try { await firebase.auth().signOut(); } catch (e) {}
  clearAuth();
  location.reload();
});

/* ========== GLOBAL SETTINGS (theme + bubble style for everyone) ========== */
function applyTheme(key) {
  const k = THEMES[key] ? key : 'gold';
  const root = document.documentElement;
  Object.entries(THEMES[k].vars).forEach(([name, val]) => root.style.setProperty(name, val));
  root.style.colorScheme = k === 'light' ? 'light' : 'dark';
  currentThemeKey = k;
}

function bubbleCssVars(b) {
  const r = b.style === 'sharp' ? 4 : b.style === 'pill' ? 999 : b.radius;
  return { '--bubble-radius': r + 'px', '--bubble-font': b.font + 'px', '--bubble-max': b.maxw + '%' };
}

function applyBubble(saved) {
  const b = Object.assign({}, DEFAULT_BUBBLE, saved || {});
  Object.entries(bubbleCssVars(b)).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
}

db.ref('settings').on('value', snap => {
  currentSettings = snap.val() || {};
  applyTheme(currentSettings.theme);
  applyBubble(currentSettings.bubble);
  if (typeof reapplyUserTheme === 'function') reapplyUserTheme();
  if (isAdmin && adminScreen.classList.contains('active')) renderThemeGrid();
});

db.ref('verified').on('value', snap => {
  verifiedCache = snap.val() || {};
  if (currentUser) renderChatsList();
});

/* ========== BADGES & GROUP ROLES ========== */
function badgeFor(uid) {
  const level = verifiedCache[uid];
  if (!level) return '';
  return '<span class="vbadge vbadge-' + level + '" title="حساب موثّق">' + icon('check', 10) + '</span>';
}

function roleOf(uid, g) {
  if (uid === g.createdBy) return 'المنشئ';
  if (g.mods && g.mods[uid]) return 'مشرف';
  return 'عضو';
}

function decorateMember(div, uid, g) {
  const nameEl = div.querySelector('.member-name');
  if (nameEl) nameEl.insertAdjacentHTML('beforeend', badgeFor(uid));

  const me = currentUser.uid;
  if (uid === me || uid === g.createdBy) return;

  const iAmOwner = g.createdBy === me;
  const iAmMod = !!(g.mods && g.mods[me]);
  const targetIsMod = !!(g.mods && g.mods[uid]);
  if (!iAmOwner && !iAmMod) return;

  const act = document.createElement('div');
  act.className = 'member-actions';
  if (iAmOwner) {
    const b = document.createElement('button');
    b.className = 'mini-btn';
    b.textContent = targetIsMod ? 'إزالة الإشراف' : 'تعيين مشرف';
    b.onclick = () => setModerator(uid, !targetIsMod);
    act.appendChild(b);
  }
  if (iAmOwner || (iAmMod && !targetIsMod)) {
    const k = document.createElement('button');
    k.className = 'mini-btn danger';
    k.textContent = 'طرد';
    k.onclick = () => kickMember(uid);
    act.appendChild(k);
  }
  div.appendChild(act);
}

async function setModerator(uid, on) {
  try {
    await db.ref('rooms/' + currentChatId + '/mods/' + uid).set(on ? true : null);
    showToast(on ? 'تم تعيين مشرف' : 'تمت إزالة الإشراف');
    chatInfoBtn.click();
  } catch (e) { showToast('فشلت العملية'); }
}

async function kickMember(uid) {
  if (!currentChatId) return;
  if (!(await uiConfirm('طرد هذا العضو من الغرفة؟'))) return;
  try {
    await db.ref('rooms/' + currentChatId + '/members/' + uid).remove();
    await db.ref('rooms/' + currentChatId + '/mods/' + uid).remove();
    await db.ref('userRooms/' + uid + '/' + currentChatId).remove();
    showToast('تم طرد العضو');
    chatInfoBtn.click();
  } catch (e) { showToast('فشل الطرد'); }
}

function updateGroupButtons(g) {
  const isOwner = currentUser && g.createdBy === currentUser.uid;
  leaveGroupBtn.classList.toggle('hidden', !!isOwner);
  if (typeof updateEditGroupBtn === 'function') updateEditGroupBtn(g);
}

function resetChatView() {
  activeChat.classList.add('hidden');
  emptyChat.classList.remove('hidden');
  currentChatId = null;
  currentChatType = null;
  if (messagesRef) { messagesRef.off(); messagesRef = null; }
  if (typingRef) { typingRef.off(); typingRef = null; }
  if (isMobile) sidebar.classList.remove('hidden-mobile');
}

async function leaveGroup() {
  if (currentChatType !== 'group' || !currentChatId) return;
  if (!(await uiConfirm('هل تريد مغادرة الغرفة؟'))) return;
  try {
    const code = currentChatId;
    await db.ref('rooms/' + code + '/members/' + currentUser.uid).remove();
    await db.ref('rooms/' + code + '/mods/' + currentUser.uid).remove();
    await db.ref('userRooms/' + currentUser.uid + '/' + code).remove();
    groupInfoModal.classList.add('hidden');
    resetChatView();
    showToast('غادرت الغرفة');
  } catch (e) { showToast('فشلت المغادرة'); }
}
leaveGroupBtn.addEventListener('click', leaveGroup);

/* ========== ADMIN SCREEN ========== */
function showAdminMsg(text, ok) {
  adminMsg.textContent = text;
  adminMsg.className = 'admin-msg form-error' + (ok ? ' ok' : '');
  clearTimeout(adminMsgTimer);
  adminMsgTimer = setTimeout(() => adminMsg.classList.add('hidden'), 3000);
}

// Finds a user by @username or by email
async function resolveTarget(raw) {
  const q = (raw || '').trim().replace(/^@/, '');
  if (!q) return null;
  try {
    let uid = null;
    if (q.includes('@')) {
      const s = await db.ref('users').orderByChild('email').equalTo(q).once('value');
      uid = Object.keys(s.val() || {})[0] || null;
    } else {
      if (!/^[a-zA-Z0-9_]+$/.test(q)) return null;
      uid = (await db.ref('usernames/' + q.toLowerCase()).once('value')).val() || null;
    }
    if (!uid) return null;
    const u = (await db.ref('users/' + uid).once('value')).val() || {};
    return { uid, name: u.name || 'مستخدم', username: u.username || '' };
  } catch (e) {
    console.error('resolveTarget:', e);
    return null;
  }
}

function openAdminScreen() {
  if (!isAdmin) return;
  adminScreen.classList.add('active');
  const active = document.querySelector('.admin-seg-btn.active');
  loadAdminTab(active ? active.dataset.atab : 'theme');
}

function closeAdminScreen() {
  adminScreen.classList.remove('active');
}

function loadAdminTab(tab) {
  if (tab === 'theme') renderThemeGrid();
  if (tab === 'admins') loadAdmins();
  if (tab === 'bans') loadBans();
  if (tab === 'verify') loadVerified();
  if (tab === 'bubble') loadBubbleEditor();
}

document.querySelectorAll('.admin-seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.apane').forEach(p => p.classList.toggle('active', p.id === 'apane-' + btn.dataset.atab));
    loadAdminTab(btn.dataset.atab);
  });
});

/* Theme */
function renderThemeGrid() {
  themeGrid.innerHTML = '';
  Object.entries(THEMES).forEach(([key, t]) => {
    const btn = document.createElement('button');
    btn.className = 'theme-chip' + (key === currentThemeKey ? ' active' : '');
    btn.style.background = t.preview;
    btn.textContent = t.name;
    btn.onclick = async () => {
      try {
        await db.ref('settings/theme').set(key);
        showAdminMsg('تم تغيير الثيم للجميع', true);
      } catch (e) { showAdminMsg('فشل تغيير الثيم', false); }
    };
    themeGrid.appendChild(btn);
  });
}

/* Admins */
async function loadAdmins() {
  adminsList.innerHTML = '';
  const all = (await db.ref('admins').once('value')).val() || {};
  for (const id of Object.keys(all)) {
    if (all[id] !== true) continue;
    const u = (await db.ref('users/' + id).once('value')).val() || {};
    const isOwner = (u.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = '<div class="admin-avatar">' + escapeHtml((u.name || 'م').charAt(0)) + '</div>' +
      '<div class="admin-row-info"><b>' + escapeHtml(u.name || 'مستخدم') + '</b><small>@' + escapeHtml(u.username || '') + '</small></div>' +
      (isOwner ? '<span class="owner-pill">المالك</span>' : '');
    if (!isOwner && id !== currentUser.uid) {
      const b = document.createElement('button');
      b.className = 'mini-btn danger';
      b.textContent = 'إزالة';
      b.onclick = async () => {
        if (!(await uiConfirm('إزالة هذا الأدمن؟'))) return;
        await db.ref('admins/' + id).remove();
        showAdminMsg('تمت إزالة الأدمن', true);
        loadAdmins();
      };
      row.appendChild(b);
    }
    adminsList.appendChild(row);
  }
}

addAdminBtn.addEventListener('click', async () => {
  const t = await resolveTarget(adminTarget.value);
  if (!t) return showAdminMsg('المستخدم غير موجود', false);
  await db.ref('admins/' + t.uid).set(true);
  adminTarget.value = '';
  showAdminMsg('تمت إضافة الأدمن (يظهر له الزر بعد إعادة الدخول)', true);
  loadAdmins();
});

/* Bans */
async function loadBans() {
  bansList.innerHTML = '';
  const all = (await db.ref('bans').once('value')).val() || {};
  const active = Object.entries(all).filter(([, b]) => activeBan(b));
  if (!active.length) {
    bansList.innerHTML = '<p class="hint">لا يوجد محظورون حالياً</p>';
    return;
  }
  for (const [uid, b] of active) {
    const until = b.until >= PERMANENT_UNTIL ? 'دائم' : new Date(b.until).toLocaleString('ar-EG');
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = '<div class="admin-row-info"><b>' + escapeHtml(b.name || 'مستخدم') + '</b><small>' +
      escapeHtml((BAN_TYPES[b.type] || {}).label || '') + ' · ' + escapeHtml(until) +
      (b.reason ? ' · ' + escapeHtml(b.reason) : '') + '</small></div>';
    const unban = document.createElement('button');
    unban.className = 'mini-btn';
    unban.textContent = 'فك الحظر';
    unban.onclick = async () => {
      await db.ref('bans/' + uid).remove();
      showAdminMsg('تم فك الحظر', true);
      loadBans();
    };
    row.appendChild(unban);
    bansList.appendChild(row);
  }
}

banBtn.addEventListener('click', async () => {
  const t = await resolveTarget(banTarget.value);
  if (!t) return showAdminMsg('المستخدم غير موجود', false);
  if (t.uid === currentUser.uid) return showAdminMsg('لا يمكنك حظر نفسك', false);
  if ((await db.ref('admins/' + t.uid).once('value')).val() === true) return showAdminMsg('لا يمكن حظر أدمن', false);

  const type = banType.value;
  const until = type === 'perm' ? PERMANENT_UNTIL : Date.now() + BAN_TYPES[type].ms;
  await db.ref('bans/' + t.uid).set({
    type, until,
    reason: banReason.value.trim().slice(0, 120),
    by: currentUser.uid, at: Date.now(),
    name: t.name, username: t.username
  });
  banTarget.value = '';
  banReason.value = '';
  showAdminMsg('تم حظر ' + t.name, true);
  loadBans();
});

/* Verification */
async function setVerifyFor(level) {
  const t = await resolveTarget(verifyTarget.value);
  if (!t) return showAdminMsg('المستخدم غير موجود', false);
  await db.ref('verified/' + t.uid).set(level);
  showAdminMsg(level ? 'تم التوثيق' : 'تمت إزالة التوثيق', true);
  loadVerified();
}
verifyBlueBtn.addEventListener('click', () => setVerifyFor('blue'));
verifyGoldBtn.addEventListener('click', () => setVerifyFor('gold'));
verifyRemoveBtn.addEventListener('click', () => setVerifyFor(null));

async function loadVerified() {
  verifiedList.innerHTML = '';
  const entries = Object.entries(verifiedCache);
  if (!entries.length) {
    verifiedList.innerHTML = '<p class="hint">لا يوجد حسابات موثّقة</p>';
    return;
  }
  for (const [uid] of entries) {
    const u = (await db.ref('users/' + uid).once('value')).val() || {};
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = '<div class="admin-row-info"><b>' + escapeHtml(u.name || 'مستخدم') + badgeFor(uid) +
      '</b><small>@' + escapeHtml(u.username || '') + '</small></div>';
    const rm = document.createElement('button');
    rm.className = 'mini-btn danger';
    rm.textContent = 'إزالة';
    rm.onclick = async () => { await db.ref('verified/' + uid).set(null); loadVerified(); };
    row.appendChild(rm);
    verifiedList.appendChild(row);
  }
}

/* Bubble style */
function readBubbleInputs() {
  return { style: bubbleStyle.value, radius: +bubbleRadius.value, font: +bubbleFont.value, maxw: +bubbleMax.value };
}

function updateBubblePreview() {
  const vars = bubbleCssVars(readBubbleInputs());
  Object.entries(vars).forEach(([k, v]) => bubblePreview.style.setProperty(k, v));
}

function loadBubbleEditor() {
  const b = Object.assign({}, DEFAULT_BUBBLE, currentSettings.bubble || {});
  bubbleStyle.value = b.style;
  bubbleRadius.value = b.radius;
  bubbleFont.value = b.font;
  bubbleMax.value = b.maxw;
  updateBubblePreview();
}

[bubbleStyle, bubbleRadius, bubbleFont, bubbleMax].forEach(el => el.addEventListener('input', updateBubblePreview));

saveBubbleBtn.addEventListener('click', async () => {
  try {
    await db.ref('settings/bubble').set(readBubbleInputs());
    showAdminMsg('تم حفظ شكل الرسائل للجميع', true);
  } catch (e) { showAdminMsg('فشل الحفظ', false); }
});

adminTopBtn.addEventListener('click', openAdminScreen);
adminBackBtn.addEventListener('click', closeAdminScreen);
