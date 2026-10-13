/* ========== FIREBASE CONFIG ========== */
const firebaseConfig = {
  apiKey: "AIzaSyD3Pwd-YAufk7LMMobSagfnRnPi8n3OOU4",
  databaseURL: "https://nexus-39896-default-rtdb.firebaseio.com",
  projectId: "nexus-39896",
  storageBucket: "nexus-39896.firebasestorage.app",
  messagingSenderId: "171087365242",
  appId: "1:171087365242:android:19881ef916c0d20b2567c3"
};

const API_KEY = firebaseConfig.apiKey;
const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1/accounts";

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => console.warn(e));

/* ========== STATE ========== */
let currentUser = null;
let currentChatId = null;
let currentChatType = null;
let currentChatData = null;
let messagesRef = null;
let typingRef = null;
let headerStatusRef = null;
let typingTimeout = null;
let replyTo = null;
let activeReactionPicker = null;
let isMobile = window.innerWidth <= 768;
let authToken = localStorage.getItem("nexus_auth_token") || "";
let authRefreshToken = localStorage.getItem("nexus_auth_refresh") || "";

const messageReactions = new Map();

/* ========== HELPERS ========== */
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
function generateRoomCode() {
  // Mixed letters (upper+lower, ambiguous chars removed), digits, and a
  // small set of symbols that are safe both as a Firebase Realtime
  // Database key AND when typed/copied around (avoiding characters like
  // + = & % which have special meaning in URLs and can get mangled).
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@!';
  let code = '';
  for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'الآن';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' د';
  if (diff < 86400000) return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}
/* WhatsApp-style "last seen" label */
function fmtLastSeen(ts) {
  if (!ts) return 'غير متصل';
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(d, now)) return 'آخر ظهور اليوم الساعة ' + time;
  if (isSameDay(d, yesterday)) return 'آخر ظهور أمس الساعة ' + time;

  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays < 7) return 'آخر ظهور ' + d.toLocaleDateString('ar-EG', { weekday: 'long' }) + ' الساعة ' + time;
  return 'آخر ظهور ' + d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) + ' الساعة ' + time;
}
function getDefaultAvatar(name) {
  const colors = ['#d4af37', '#e8c766', '#d4af37', '#a8841f', '#c9a227', '#8a6b1a', '#6b5313'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  const letter = (name.charAt(0) || '؟').toUpperCase();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="' + color + '"/><text x="20" y="27" font-size="18" fill="#fff" text-anchor="middle" font-family="sans-serif" font-weight="bold">' + letter + '</text></svg>';
  // btoa() only supports Latin1, but names can contain Arabic (or any
  // Unicode) letters, so encode as a URI-escaped SVG data URI instead —
  // works for any character set and every browser supports it.
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function setAvatarEl(el, imgEl, letterEl, src, name) {
  if (src) {
    imgEl.src = src;
    imgEl.classList.remove('hidden');
    imgEl.style.display = 'block';
    letterEl.style.display = 'none';
  } else {
    imgEl.classList.add('hidden');
    imgEl.style.display = 'none';
    letterEl.style.display = 'flex';
    letterEl.textContent = (name || '؟').charAt(0).toUpperCase();
  }
}
function getDmChatId(uid1, uid2) {
  return uid1 < uid2 ? 'dm_' + uid1 + '_' + uid2 : 'dm_' + uid2 + '_' + uid1;
}
function saveAuth(data, email) {
  authToken = data.idToken;
  authRefreshToken = data.refreshToken;
  localStorage.setItem("nexus_auth_token", authToken);
  localStorage.setItem("nexus_auth_refresh", authRefreshToken);
  localStorage.setItem("nexus_uid", data.localId);
  if (email) localStorage.setItem("nexus_email", email);
}
function clearAuth() {
  authToken = "";
  authRefreshToken = "";
  localStorage.removeItem("nexus_auth_token");
  localStorage.removeItem("nexus_auth_refresh");
  localStorage.removeItem("nexus_uid");
  localStorage.removeItem("nexus_email");
  localStorage.removeItem("nexus_name");
  localStorage.removeItem("nexus_username");
  localStorage.removeItem("nexus_avatar");
}
function apiRequest(endpoint, body) {
  return fetch(AUTH_BASE + endpoint + "?key=" + API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json());
}
function translateAuthError(msg) {
  var map = {
    "EMAIL_EXISTS": "هذا البريد مستخدم بالفعل",
    "EMAIL_NOT_FOUND": "البريد الإلكتروني غير مسجل",
    "INVALID_PASSWORD": "كلمة المرور غير صحيحة",
    "INVALID_EMAIL": "البريد الإلكتروني غير صالح",
    "WEAK_PASSWORD": "كلمة المرور ضعيفة (6 أحرف على الأقل)",
    "USER_DISABLED": "الحساب معطل",
    "TOO_MANY_ATTEMPTS_TRY_LATER": "محاولات كثيرة، حاول لاحقاً",
    "INVALID_LOGIN_CREDENTIALS": "البريد أو كلمة المرور غير صحيحة",
    "auth/email-already-in-use": "هذا البريد مستخدم بالفعل",
    "auth/invalid-email": "البريد الإلكتروني غير صالح",
    "auth/user-not-found": "البريد الإلكتروني غير مسجل",
    "auth/wrong-password": "كلمة المرور غير صحيحة",
    "auth/weak-password": "كلمة المرور ضعيفة (6 أحرف على الأقل)"
  };
  return map[msg] || (msg ? "خطأ: " + msg : "حدث خطأ، حاول مرة أخرى");
}

/* ========== DOM ELEMENTS ========== */
const authScreen = document.getElementById('authScreen');
const mainApp = document.getElementById('mainApp');
const authTabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginEmail = document.getElementById('loginEmail');
const loginPass = document.getElementById('loginPass');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const regName = document.getElementById('regName');
const regUsername = document.getElementById('regUsername');
const regEmail = document.getElementById('regEmail');
const regPass = document.getElementById('regPass');
const regError = document.getElementById('regError');
const registerBtn = document.getElementById('registerBtn');
const usernameStatus = document.getElementById('usernameStatus');
const guestBtn = document.getElementById('guestBtn');
const sidebar = document.querySelector('.sidebar');
const sidebarAvatar = document.getElementById('sidebarAvatar');
const sidebarAvatarImg = document.getElementById('sidebarAvatarImg');
const sidebarAvatarLetter = document.getElementById('sidebarAvatarLetter');
const sidebarName = document.getElementById('sidebarName');
const sidebarStatus = document.getElementById('sidebarStatus');
const menuBtn = document.getElementById('menuBtn');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const searchResultsList = document.getElementById('searchResultsList');
const chatTabs = document.querySelectorAll('.chat-tab');
const chatsList = document.getElementById('chatsList');
const groupsList = document.getElementById('groupsList');
const createGroupFab = document.getElementById('createGroupFab');
const joinGroupFab = document.getElementById('joinGroupFab');
const emptyChat = document.getElementById('emptyChat');
const activeChat = document.getElementById('activeChat');
const mobileBackBtn = document.getElementById('mobileBackBtn');
const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
const chatHeaderName = document.getElementById('chatHeaderName');
const chatHeaderStatus = document.getElementById('chatHeaderStatus');
const chatInfoBtn = document.getElementById('chatInfoBtn');
const messagesContainer = document.getElementById('messagesContainer');
const messagesList = document.getElementById('messagesList');
const typingIndicator = document.getElementById('typingIndicator');
const typingAvatar = document.getElementById('typingAvatar');
const typingText = document.getElementById('typingText');
const replyBar = document.getElementById('replyBar');
const replyName = document.getElementById('replyName');
const replyText = document.getElementById('replyText');
const cancelReply = document.getElementById('cancelReply');
const attachBtn = document.getElementById('attachBtn');
const attachMenu = document.getElementById('attachMenu');
const attachImage = document.getElementById('attachImage');
const attachVideo = document.getElementById('attachVideo');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const createGroupModal = document.getElementById('createGroupModal');
const closeGroupModal = document.getElementById('closeGroupModal');
const groupModalTitle = document.getElementById('groupModalTitle');
const groupTabs = document.querySelectorAll('[data-gtab]');
const createGroupPane = document.getElementById('createGroupPane');
const joinGroupPane = document.getElementById('joinGroupPane');
const joinCodeInput = document.getElementById('joinCodeInput');
const joinGroupError = document.getElementById('joinGroupError');
const joinGroupBtn = document.getElementById('joinGroupBtn');
const groupInfoCode = document.getElementById('groupInfoCode');
const copyGroupCode = document.getElementById('copyGroupCode');
const deleteGroupBtn = document.getElementById('deleteGroupBtn');
const groupAvatarPreview = document.getElementById('groupAvatarPreview');
const changeGroupAvatar = document.getElementById('changeGroupAvatar');
const groupNameInput = document.getElementById('groupNameInput');
const groupDescInput = document.getElementById('groupDescInput');
const groupError = document.getElementById('groupError');
const createGroupBtn = document.getElementById('createGroupBtn');
const groupInfoModal = document.getElementById('groupInfoModal');
const closeGroupInfo = document.getElementById('closeGroupInfo');
const groupInfoAvatar = document.getElementById('groupInfoAvatar');
const groupInfoName = document.getElementById('groupInfoName');
const groupInfoDesc = document.getElementById('groupInfoDesc');
const groupInfoCount = document.getElementById('groupInfoCount');
const membersList = document.getElementById('membersList');
const profileModal = document.getElementById('profileModal');
const closeProfile = document.getElementById('closeProfile');
const profileAvatar = document.getElementById('profileAvatar');
const changeProfileAvatar = document.getElementById('changeProfileAvatar');
const profileName = document.getElementById('profileName');
const profileUsername = document.getElementById('profileUsername');
const profileEmail = document.getElementById('profileEmail');
const logoutBtn = document.getElementById('logoutBtn');
const avatarFileInput = document.getElementById('avatarFileInput');
const groupAvatarFileInput = document.getElementById('groupAvatarFileInput');
const mediaFileInput = document.getElementById('mediaFileInput');

/* ========== AUTH TABS ========== */
authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    loginForm.classList.toggle('active', target === 'login');
    registerForm.classList.toggle('active', target === 'register');
  });
});

/* ========== USERNAME CHECK ========== */
let usernameDebounce;
regUsername.addEventListener('input', () => {
  const val = regUsername.value.trim().toLowerCase();
  clearTimeout(usernameDebounce);
  if (!val) { usernameStatus.textContent = ''; return; }
  if (!/^[a-z0-9_]+$/.test(val)) {
    usernameStatus.textContent = 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة سفلية فقط';
    usernameStatus.className = 'input-hint taken';
    return;
  }
  if (val.length < 3) {
    usernameStatus.textContent = '3 أحرف على الأقل';
    usernameStatus.className = 'input-hint taken';
    return;
  }
  usernameStatus.textContent = 'جاري التحقق...';
  usernameStatus.className = 'input-hint';
  usernameDebounce = setTimeout(() => {
    db.ref('usernames/' + val).once('value').then(snap => {
      if (snap.exists()) {
        usernameStatus.textContent = ' اسم المستخدم مستخدم';
        usernameStatus.className = 'input-hint taken';
      } else {
        usernameStatus.textContent = ' متاح';
        usernameStatus.className = 'input-hint available';
      }
    });
  }, 500);
});

/* ========== REGISTER (REST API) ========== */
registerBtn.addEventListener('click', async () => {
  const name = regName.value.trim();
  const username = regUsername.value.trim().toLowerCase();
  const email = regEmail.value.trim();
  const pass = regPass.value;

  regError.classList.add('hidden');

  if (!name || !username || !email || !pass) {
    regError.textContent = 'جميع الحقول مطلوبة';
    regError.classList.remove('hidden');
    return;
  }
  if (pass.length < 6) {
    regError.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    regError.classList.remove('hidden');
    return;
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    regError.textContent = 'اسم المستخدم غير صالح';
    regError.classList.remove('hidden');
    return;
  }

  registerBtn.disabled = true;
  try {
    // 1. Check username
    const usernameSnap = await db.ref('usernames/' + username).once('value');
    if (usernameSnap.exists()) {
      regError.textContent = 'اسم المستخدم مستخدم بالفعل';
      regError.classList.remove('hidden');
      registerBtn.disabled = false;
      return;
    }

    // 2. Sign up via REST API (WebView-safe)
    const signupData = await apiRequest(":signUp", {
      email: email,
      password: pass,
      returnSecureToken: true
    });

    if (signupData.error) {
      regError.textContent = translateAuthError(signupData.error.message);
      regError.classList.remove('hidden');
      registerBtn.disabled = false;
      return;
    }

    const uid = signupData.localId;
    saveAuth(signupData, email);
    await sdkSignIn(email, pass);

    // 3. Update display name
    await apiRequest(":update", {
      idToken: authToken,
      displayName: name,
      returnSecureToken: true
    });

    // 4. Save user to DB
    await db.ref('users/' + uid).set({
      name: name,
      username: username,
      email: email,
      avatar: '',
      online: true,
      lastSeen: Date.now(),
      createdAt: Date.now()
    });
    await db.ref('usernames/' + username).set(uid);

    // 5. Set current user
    currentUser = { uid: uid, name: name, username: username, email: email, avatar: '' };
    localStorage.setItem("nexus_name", name);
    localStorage.setItem("nexus_username", username);
    localStorage.setItem("nexus_avatar", '');
    onAuthSuccess();

  } catch (err) {
    regError.textContent = "خطأ شبكة: " + (err.message || "حاول مرة أخرى");
    regError.classList.remove('hidden');
  }
  registerBtn.disabled = false;
});

/* ========== LOGIN (REST API) ========== */
loginBtn.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  const pass = loginPass.value;
  loginError.classList.add('hidden');

  if (!email || !pass) {
    loginError.textContent = 'أدخل البريد وكلمة المرور';
    loginError.classList.remove('hidden');
    return;
  }

  loginBtn.disabled = true;
  try {
    const data = await apiRequest(":signInWithPassword", {
      email: email,
      password: pass,
      returnSecureToken: true
    });

    if (data.error) {
      loginError.textContent = translateAuthError(data.error.message);
      loginError.classList.remove('hidden');
      loginBtn.disabled = false;
      return;
    }

    saveAuth(data, email);
    await sdkSignIn(email, pass);
    const uid = data.localId;

    // Get user profile from DB
    const userSnap = await db.ref('users/' + uid).once('value');
    const u = userSnap.val() || {};

    currentUser = {
      uid: uid,
      name: u.name || data.displayName || 'مستخدم',
      username: u.username || '',
      email: email,
      avatar: u.avatar || ''
    };
    localStorage.setItem("nexus_name", currentUser.name);
    localStorage.setItem("nexus_username", currentUser.username);
    localStorage.setItem("nexus_avatar", currentUser.avatar);

    // Update online status
    await db.ref('users/' + uid).update({ online: true, lastSeen: Date.now() });

    onAuthSuccess();

  } catch (err) {
    loginError.textContent = "خطأ شبكة: " + (err.message || "حاول مرة أخرى");
    loginError.classList.remove('hidden');
  }
  loginBtn.disabled = false;
});

/* ========== GUEST ========== */
guestBtn.addEventListener('click', async () => {
  await firebase.auth().signInAnonymously().catch(e => console.warn('anon sign-in failed', e));
  const guestUid = 'guest_' + generateId();
  currentUser = {
    uid: guestUid,
    name: 'ضيف',
    username: '',
    email: '',
    avatar: '',
    isGuest: true
  };
  onAuthSuccess();
});

/* ========== AUTH SUCCESS ========== */
async function onAuthSuccess() {
  if (await afterLoginChecks()) return;
  authScreen.classList.remove('active');
  mainApp.classList.add('active');
  updateSidebarUser();
  setupOnlineStatus();
  loadChats();
  loadGroups();
  if (typeof startStories === 'function') startStories();
}

function updateSidebarUser() {
  if (!currentUser) return;
  sidebarName.textContent = currentUser.name;
  setAvatarEl(sidebarAvatar, sidebarAvatarImg, sidebarAvatarLetter, currentUser.avatar, currentUser.name);
  profileName.textContent = currentUser.name;
  profileUsername.textContent = currentUser.username ? '@' + currentUser.username : '';
  profileEmail.textContent = currentUser.email || 'ضيف';
  const pImg = profileAvatar.querySelector('img');
  const pSpan = profileAvatar.querySelector('span');
  setAvatarEl(profileAvatar, pImg, pSpan, currentUser.avatar, currentUser.name);
}

function setupOnlineStatus() {
  if (!currentUser || currentUser.isGuest) return;
  const userRef = db.ref('users/' + currentUser.uid);
  const connectedRef = db.ref('.info/connected');
  connectedRef.on('value', snap => {
    if (snap.val() === true) {
      userRef.update({ online: true, lastSeen: Date.now() });
      userRef.onDisconnect().update({ online: false, lastSeen: Date.now() });
    }
  });
}

/* ========== SEARCH USERS ========== */
let searchDebounce;
searchInput.addEventListener('input', () => {
  let query = searchInput.value.trim().toLowerCase();
  // Strip leading @ if user typed it
  if (query.startsWith('@')) query = query.slice(1);
  clearTimeout(searchDebounce);
  if (!query || query.length < 2) {
    searchResults.classList.add('hidden');
    return;
  }
  searchDebounce = setTimeout(() => doSearch(query), 400);
});

async function doSearch(query) {
  if (!currentUser) return;
  searchResultsList.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">جاري البحث...</div>';
  searchResults.classList.remove('hidden');

  // Usernames only ever contain a-z, 0-9 and _ (enforced at registration).
  // Reject anything else BEFORE building a Firebase path with it, since
  // characters like ".", "#", "$", "[", "]", "/" are invalid in RTDB paths
  // and would throw instead of just returning "no results".
  if (!/^[a-z0-9_]+$/.test(query)) {
    searchResultsList.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">لا يوجد مستخدم بهذا الاسم</div>';
    return;
  }

  try {
    const usernameSnap = await db.ref('usernames/' + query).once('value');
    const results = [];

    if (usernameSnap.exists() && usernameSnap.val() !== currentUser.uid) {
      const userSnap = await db.ref('users/' + usernameSnap.val()).once('value');
      const u = userSnap.val();
      if (u) results.push({ uid: usernameSnap.val(), ...u });
    }

    searchResultsList.innerHTML = '';
    if (results.length === 0) {
      searchResultsList.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">لا يوجد مستخدم بهذا الاسم</div>';
    } else {
      results.forEach(user => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        const avatar = user.avatar || getDefaultAvatar(user.name);
        div.innerHTML = '<div class="result-avatar"><img src="' + avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div><div class="result-info"><div class="result-name">' + escapeHtml(user.name) + badgeFor(user.uid) + '</div><div class="result-username">@' + (user.username || '') + '</div></div>';
        div.addEventListener('click', () => startDm(user));
        searchResultsList.appendChild(div);
      });
    }
  } catch (err) {
    console.error('[SEARCH] Error:', err && err.message, err);
    searchResultsList.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">حدث خطأ أثناء البحث: ' + escapeHtml((err && err.message) || '') + '</div>';
  }
  searchResults.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
  // Don't hide if clicking inside search results or on search input
  if (searchResults.contains(e.target) || e.target === searchInput) return;
  // Don't hide if clicking a search result item (let the click handler run first)
  if (e.target.closest('.search-result-item')) return;
  searchResults.classList.add('hidden');
});

/* ========== START DM ========== */
async function startDm(otherUser) {
  searchResults.classList.add('hidden');
  searchInput.value = '';

  const chatId = getDmChatId(currentUser.uid, otherUser.uid);

  const chatSnap = await db.ref('chats/' + chatId).once('value');
  if (!chatSnap.exists()) {
    await db.ref('chats/' + chatId).set({
      type: 'dm',
      participants: { [currentUser.uid]: true, [otherUser.uid]: true },
      createdAt: Date.now()
    });
    await db.ref('userChats/' + currentUser.uid + '/' + chatId).set({ type: 'dm', otherUid: otherUser.uid, createdAt: Date.now() });
    await db.ref('userChats/' + otherUser.uid + '/' + chatId).set({ type: 'dm', otherUid: currentUser.uid, createdAt: Date.now() });
  }

  openChat(chatId, 'dm', otherUser);
}

/* ========== LOAD CHATS ========== */
const chatsCache = {};        // cid -> chat display data
const chatMsgListenerRefs = {};   // cid -> Firebase ref (last message)
const chatOnlineListenerRefs = {}; // cid -> Firebase ref (other user's online status)

function loadChats() {
  if (!currentUser) return;
  const ref = db.ref('userChats/' + currentUser.uid);
  ref.on('value', async snap => {
    const chats = snap.val() || {};
    const chatIds = Object.keys(chats);

    // Detach listeners for chats that no longer exist and drop their cache
    Object.keys(chatMsgListenerRefs).forEach(cid => {
      if (!chatIds.includes(cid)) {
        chatMsgListenerRefs[cid].off();
        delete chatMsgListenerRefs[cid];
        if (chatOnlineListenerRefs[cid]) { chatOnlineListenerRefs[cid].off(); delete chatOnlineListenerRefs[cid]; }
        delete chatsCache[cid];
      }
    });

    for (const cid of chatIds) {
      const c = chats[cid];
      if (!c || !c.otherUid) continue;
      if (chatsCache[cid]) { chatsCache[cid].archived = !!c.archived; chatsCache[cid].deletedAt = c.deletedAt || 0; continue; } // already set up — live listeners keep it fresh

      try {
        const otherSnap = await db.ref('users/' + c.otherUid).once('value');
        const other = otherSnap.val() || {};
        chatsCache[cid] = {
          id: cid,
          otherUid: c.otherUid,
          otherName: other.name || 'مستخدم',
          otherAvatar: other.avatar || '',
          otherOnline: other.online || false,
          lastText: '',
          lastTime: c.createdAt || 0,
          archived: !!c.archived,
          deletedAt: c.deletedAt || 0
        };

        // Live: other user's online status (updates the green dot instantly)
        const onlineRef = db.ref('users/' + c.otherUid + '/online');
        chatOnlineListenerRefs[cid] = onlineRef;
        onlineRef.on('value', s => {
          if (chatsCache[cid]) {
            chatsCache[cid].otherOnline = s.val() || false;
            renderChatsList();
          }
        });

        // Live: last message in this chat (updates the preview + time instantly)
        const msgRef = db.ref('messages/' + cid).limitToLast(1);
        chatMsgListenerRefs[cid] = msgRef;
        msgRef.on('value', msnap => {
          const val = msnap.val() || {};
          const key = Object.keys(val)[0];
          const m = key ? val[key] : null;
          if (chatsCache[cid]) {
            chatsCache[cid].lastText = m ? (m.type === 'text' ? m.text : (m.type === 'image' ? 'صورة' : 'فيديو')) : '';
            chatsCache[cid].lastTime = m ? m.timestamp : (c.createdAt || 0);
            renderChatsList();
          }
        });
      } catch (e) {
        console.error('Error loading chat', cid, e);
      }
    }
    renderChatsList();
  });
}

function renderChatsList() {
  if (typeof updateArchiveBar === 'function') updateArchiveBar();
  const chatData = Object.values(chatsCache).filter(c => chatVisible(c, 'dm'));
  if (chatData.length === 0) {
    chatsList.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted);font-size:13px;">لا توجد محادثات خاصة</div>';
    return;
  }
  chatData.sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));

  chatsList.innerHTML = '';
  chatData.forEach(chat => {
    const div = document.createElement('div');
    div.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
    div.dataset.cid = chat.id;
    div.dataset.kind = 'dm';
    const avatar = chat.otherAvatar || getDefaultAvatar(chat.otherName);
    const firstLetter = (chat.otherName || 'م').charAt(0).toUpperCase();
    const onlineDot = chat.otherOnline ? '<span style="position:absolute;bottom:2px;left:2px;width:10px;height:10px;border-radius:50%;background:#22c55e;border:2px solid var(--bg-secondary);"></span>' : '';
    div.innerHTML = '<div class="chat-avatar" style="position:relative;"><img src="' + avatar + '" class="' + (chat.otherAvatar ? '' : 'hidden') + '"><span>' + (chat.otherAvatar ? '' : firstLetter) + '</span>' + onlineDot + '</div><div class="chat-details"><div class="chat-name-row"><span class="chat-name">' + escapeHtml(chat.otherName) + badgeFor(chat.otherUid) + '</span><span class="chat-time">' + fmtTime(chat.lastTime) + '</span></div><div class="chat-preview">' + escapeHtml(chat.lastText || 'ابدأ المحادثة...') + '</div></div>';
    div.addEventListener('click', () => {
      document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
      div.classList.add('active');
      openChat(chat.id, 'dm', { uid: chat.otherUid, name: chat.otherName, avatar: chat.otherAvatar, online: chat.otherOnline });
    });
    chatsList.appendChild(div);
  });
}

/* ========== LOAD GROUPS ========== */
const roomsCache = {};
const roomMsgListenerRefs = {};

function loadGroups() {
  if (!currentUser) return;
  // OLD way: load from userRooms/{uid}/
  const ref = db.ref('userRooms/' + currentUser.uid);
  ref.on('value', async snap => {
    const rooms = snap.val() || {};
    const roomIds = Object.keys(rooms);

    Object.keys(roomMsgListenerRefs).forEach(rid => {
      if (!roomIds.includes(rid)) {
        roomMsgListenerRefs[rid].off();
        delete roomMsgListenerRefs[rid];
        delete roomsCache[rid];
      }
    });

    for (const rid of roomIds) {
      if (roomsCache[rid]) { roomsCache[rid].archived = !!(rooms[rid] && rooms[rid].archived); continue; }
      try {
        const rSnap = await db.ref('rooms/' + rid).once('value');
        const r = rSnap.val() || {};
        if (!rSnap.exists()) {
          console.warn('Room data missing for', rid);
          continue;
        }
        roomsCache[rid] = {
          id: rid,
          archived: !!(rooms[rid] && rooms[rid].archived),
          name: r.name || rid,
          avatar: r.avatar || '',
          desc: r.desc || '',
          type: r.type || 'public',
          createdBy: r.createdBy || '',
          members: r.members || {},
          lastText: '',
          lastTime: r.createdAt || 0
        };

        watchRoomMeta(rid);
        const msgRef = db.ref('messages/' + rid).limitToLast(1);
        roomMsgListenerRefs[rid] = msgRef;
        msgRef.on('value', msnap => {
          const val = msnap.val() || {};
          const key = Object.keys(val)[0];
          const m = key ? val[key] : null;
          if (roomsCache[rid]) {
            roomsCache[rid].lastText = m ? (m.type === 'text' ? m.text : (m.type === 'image' ? 'صورة' : 'فيديو')) : '';
            roomsCache[rid].lastTime = m ? m.timestamp : (r.createdAt || 0);
            renderGroupsList();
          }
        });
      } catch (e) {
        console.error('Error loading room', rid, e);
      }
    }
    renderGroupsList();
  });
}

function renderGroupsList() {
  if (typeof updateArchiveBar === 'function') updateArchiveBar();
  const roomData = Object.values(roomsCache).filter(r => chatVisible(r, 'group'));
  if (roomData.length === 0) {
    groupsList.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted);font-size:13px;">لم تنضم لأي غرفة</div>';
    return;
  }
  roomData.sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));

  groupsList.innerHTML = '';
  roomData.forEach(r => {
    const div = document.createElement('div');
    div.className = 'chat-item' + (r.id === currentChatId ? ' active' : '');
    div.dataset.cid = r.id;
    div.dataset.kind = 'group';
    const avatar = r.avatar || getDefaultAvatar(r.name);
    const firstLetter = (r.name || 'غ').charAt(0).toUpperCase();
    const lockIcon = r.type === 'private' ? '' : '';
    div.innerHTML = '<div class="chat-avatar group-avatar"><img src="' + avatar + '" class="' + (r.avatar ? '' : 'hidden') + '"><span>' + (r.avatar ? '' : firstLetter) + '</span></div><div class="chat-details"><div class="chat-name-row"><span class="chat-name">' + lockIcon + escapeHtml(r.name) + '</span><span class="chat-time">' + fmtTime(r.lastTime) + '</span></div><div class="chat-preview">' + escapeHtml(r.lastText || 'غرفة دردشة') + '</div></div>';
    div.addEventListener('click', () => {
      document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
      div.classList.add('active');
      openChat(r.id, 'group', r);
    });
    groupsList.appendChild(div);
  });
}


/* ========== CHAT TABS ========== */
chatTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    chatTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    chatsList.classList.toggle('hidden', target !== 'chats');
    groupsList.classList.toggle('hidden', target !== 'groups');
  });
});

/* ========== OPEN CHAT ========== */
async function openChat(chatId, type, data) {
  // Leaving whatever chat was open before — make sure we don't leave a
  // stuck "typing..." flag behind for the old chat.
  if (currentChatId && currentChatId !== chatId && currentUser) {
    clearTimeout(typingTimeout);
    db.ref('typing/' + currentChatId + '/' + currentUser.uid).set(false).catch(() => {});
  }

  currentChatId = chatId;
  currentChatType = type;
  currentChatData = data;

  emptyChat.classList.add('hidden');
  activeChat.classList.remove('hidden');
  if (isMobile) sidebar.classList.add('hidden-mobile');

  chatHeaderName.innerHTML = escapeHtml(data.name) + (type === 'dm' && data.uid ? badgeFor(data.uid) : '');
  const avatar = data.avatar || getDefaultAvatar(data.name);
  const headerImg = chatHeaderAvatar.querySelector('img');
  const headerSpan = chatHeaderAvatar.querySelector('span');
  setAvatarEl(chatHeaderAvatar, headerImg, headerSpan, data.avatar, data.name);
  if (type === 'group') chatHeaderAvatar.classList.add('group-avatar');
  else chatHeaderAvatar.classList.remove('group-avatar');

  if (headerStatusRef) { headerStatusRef.off(); headerStatusRef = null; }
  if (type === 'dm') {
    headerStatusRef = db.ref('users/' + data.uid);
    headerStatusRef.on('value', snap => {
      const u = snap.val() || {};
      if (!chatHeaderStatus.classList.contains('typing-force')) {
        chatHeaderStatus.textContent = u.online ? 'متصل الآن' : fmtLastSeen(u.lastSeen);
        chatHeaderStatus.classList.toggle('typing', false);
      }
    });
  } else {
    chatHeaderStatus.textContent = '';
  }

  messagesList.innerHTML = '';
  if (messagesRef) messagesRef.off();
  if (typingRef) typingRef.off();

  messagesRef = db.ref('messages/' + chatId);
  messagesRef.on('child_added', snap => {
    renderMessage(snap.key, snap.val());
  });
  messagesRef.on('child_removed', snap => {
    const el = document.querySelector('[data-key="' + snap.key + '"]');
    if (el) el.remove();
  });
  messagesRef.on('child_changed', snap => {
    updateReactions(snap.key, snap.val().reactions || {});
  });

  typingRef = db.ref('typing/' + chatId);
  typingRef.on('value', snap => {
    const typings = snap.val() || {};
    const typers = Object.keys(typings).filter(uid => uid !== currentUser.uid && typings[uid]);
    if (typers.length > 0) {
      showTyping(typers[0]);
    } else {
      hideTyping();
    }
  });

  // Defensive reset: clears out any already-stuck "typing" flag left
  // behind by a previous session (e.g. before this fix existed, or the
  // app was killed mid-typing before onDisconnect had a chance to run).
  if (currentUser && !currentUser.isGuest) {
    db.ref('typing/' + chatId + '/' + currentUser.uid).set(false).catch(() => {});
  }

  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.focus();
}

async function showTyping(uid) {
  const userSnap = await db.ref('users/' + uid).once('value');
  const user = userSnap.val() || {};
  const avatar = user.avatar || getDefaultAvatar(user.name);
  const img = typingAvatar.querySelector('img');
  const span = typingAvatar.querySelector('span');
  setAvatarEl(typingAvatar, img, span, user.avatar, user.name);
  typingText.textContent = (user.name || 'مستخدم') + ' يكتب...';
  typingIndicator.classList.remove('hidden');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  if (currentChatType === 'dm') {
    chatHeaderStatus.textContent = 'يكتب...';
    chatHeaderStatus.classList.add('typing');
    chatHeaderStatus.classList.add('typing-force');
  }
}

function hideTyping() {
  typingIndicator.classList.add('hidden');
  if (currentChatType === 'dm' && currentChatData) {
    chatHeaderStatus.classList.remove('typing-force');
    db.ref('users/' + currentChatData.uid).once('value').then(snap => {
      const u = snap.val() || {};
      chatHeaderStatus.textContent = u.online ? 'متصل الآن' : fmtLastSeen(u.lastSeen);
      chatHeaderStatus.classList.remove('typing');
    });
  }
}

/* ========== RENDER MESSAGE ========== */
function renderMessage(msgId, msg) {
  const isMe = msg.senderUid === currentUser.uid;
  const wrapper = document.createElement('div');
  wrapper.className = 'msg-wrapper ' + (isMe ? 'sent' : 'received');
  wrapper.dataset.key = msgId;

  let html = '';

  if (!isMe && currentChatType === 'group') {
    const avatar = msg.senderAvatar || getDefaultAvatar(msg.senderName);
    html += '<div class="msg-header-row"><div class="msg-avatar-small"><img src="' + avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div><span class="msg-author-small">' + escapeHtml(msg.senderName) + badgeFor(msg.senderUid) + '</span></div>';
  }

  if (msg.replyTo) {
    const replyPreview = msg.replyTo.type === 'text' ? escapeHtml(msg.replyTo.text.substring(0, 40)) : (msg.replyTo.type === 'image' ? 'صورة' : 'فيديو');
    html += '<div class="msg-reply"><div class="msg-reply-line"></div><div class="msg-reply-body"><span class="msg-reply-name">' + escapeHtml(msg.replyTo.name) + '</span><span class="msg-reply-text">' + replyPreview + ((msg.replyTo.text || '').length > 40 ? '...' : '') + '</span></div></div>';
  }

  if (msg.type === 'image') {
    html += '<div class="msg-bubble media-bubble"><img src="' + escapeHtml(msg.mediaData) + '" class="msg-media-img" alt="صورة" loading="lazy" onclick="downloadMedia(this.src)"></div>';
  } else if (msg.type === 'video') {
    html += '<div class="msg-bubble media-bubble"><video src="' + escapeHtml(msg.mediaData) + '" class="msg-media-video" controls playsinline></video></div>';
  } else {
    html += '<div class="msg-bubble">' + escapeHtml(msg.text) + '</div>';
  }

  html += '<div class="msg-meta"><span class="msg-time">' + fmtTime(msg.timestamp) + '</span></div>';
  html += '<div class="msg-reactions"></div>';

  wrapper.innerHTML = html;
  messagesList.appendChild(wrapper);

  messageReactions.set(msgId, msg.reactions || {});
  const reactionsBar = wrapper.querySelector('.msg-reactions');
  renderReactionsBar(reactionsBar, msg.reactions || {}, msgId);

  addSwipeReply(wrapper, msg, msgId);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* ========== SEND MESSAGE ========== */
function sendMessage(text, type, mediaData) {
  if (!currentChatId || !currentUser) {
    showToast('لا يوجد محادثة نشطة');
    return;
  }
  type = type || 'text';
  mediaData = mediaData || '';

  // Check media size (max ~2MB for base64)
  if (mediaData && mediaData.length > 2500000) {
    showToast('الملف كبير جداً (الحد الأقصى 2MB)');
    return;
  }

  const msg = {
    senderUid: currentUser.uid,
    senderName: currentUser.name,
    senderAvatar: currentUser.avatar || '',
    text: text,
    type: type,
    mediaData: mediaData,
    replyTo: replyTo,
    reactions: {},
    timestamp: Date.now()
  };

  // Clear the typing flag right away instead of waiting for the idle timer.
  clearTimeout(typingTimeout);
  if (!currentUser.isGuest) {
    db.ref('typing/' + currentChatId + '/' + currentUser.uid).set(false).catch(() => {});
  }

  db.ref('messages/' + currentChatId).push().set(msg)
    .catch(err => {
      console.error('Send message error:', err);
      showToast('فشل إرسال الرسالة ');
    });

  if (currentChatType === 'dm') {
    db.ref('chats/' + currentChatId).update({ lastMessage: msg, updatedAt: Date.now() })
      .catch(err => console.error('Update chat error:', err));
  }

  cancelReplyFn();
}

sendBtn.addEventListener('click', () => {
  const text = messageInput.value.trim();
  if (!text) return;
  sendMessage(text);
  messageInput.value = '';
  if (document.activeElement !== messageInput) messageInput.focus();
});

messageInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

messageInput.addEventListener('input', () => {
  if (!currentChatId || (currentUser && currentUser.isGuest)) return;
  const typingSelfRef = db.ref('typing/' + currentChatId + '/' + currentUser.uid);
  clearTimeout(typingTimeout);

  if (!messageInput.value.trim()) {
    // Text box is empty — clear the typing flag immediately instead of
    // waiting out the idle timer.
    typingSelfRef.set(false).catch(() => {});
    return;
  }

  typingSelfRef.set(true).catch(() => {});
  // Safety net: if the connection drops (app closed, network lost, tab
  // killed) before the idle timer below fires, Firebase clears the flag
  // on our behalf so we never get stuck showing "typing..." forever.
  typingSelfRef.onDisconnect().set(false);

  typingTimeout = setTimeout(() => {
    typingSelfRef.set(false).catch(() => {});
  }, 3000);
});

/* ========== REPLY ========== */
function setReplyTo(msg, msgId) {
  replyTo = { key: msgId, name: msg.senderName, text: msg.text, type: msg.type };
  const preview = msg.type === 'text' ? msg.text.substring(0, 50) : (msg.type === 'image' ? 'صورة' : 'فيديو');
  replyName.textContent = msg.senderName;
  replyText.textContent = preview + (msg.text && msg.text.length > 50 ? '...' : '');
  replyBar.classList.remove('hidden');
  messageInput.focus();
}

function cancelReplyFn() {
  replyTo = null;
  replyBar.classList.add('hidden');
}
cancelReply.addEventListener('click', cancelReplyFn);

/* ========== REACTIONS ========== */
function toggleReaction(msgKey, emoji) {
  if (!currentUser) return;
  const path = 'messages/' + currentChatId + '/' + msgKey + '/reactions/' + currentUser.uid;
  const reactions = messageReactions.get(msgKey) || {};
  const current = reactions[currentUser.uid];
  if (current === emoji) {
    db.ref(path).remove();
  } else {
    db.ref(path).set(emoji);
  }
  hideReactionPicker();
}

function renderReactionsBar(container, reactions, msgKey) {
  const counts = {};
  Object.keys(reactions).forEach(user => {
    const emoji = reactions[user];
    counts[emoji] = (counts[emoji] || 0) + 1;
  });
  const myReaction = reactions && reactions[currentUser.uid] ? reactions[currentUser.uid] : null;
  let html = '';
  Object.keys(counts).forEach(emoji => {
    const active = myReaction === emoji ? 'active' : '';
    html += '<button class="reaction-pill ' + active + '" data-emoji="' + emoji + '">' + reactionHtml(emoji) + ' <span>' + counts[emoji] + '</span></button>';
  });
  html += '<button class="reaction-pill add" data-add>' + icon('plus', 14) + '</button>';
  container.innerHTML = html;

  container.querySelectorAll('.reaction-pill:not([data-add])').forEach(btn => {
    btn.addEventListener('click', () => toggleReaction(msgKey, btn.dataset.emoji));
  });
  const addBtn = container.querySelector('[data-add]');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => showReactionPicker(msgKey, container, e));
  }
}

function showReactionPicker(msgKey, anchorEl, event) {
  event.stopPropagation();
  hideReactionPicker();

  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.innerHTML = Object.keys(REACTIONS).map(k => '<button data-emoji="' + k + '">' + reactionHtml(k) + '</button>').join('');
  document.body.appendChild(picker);
  activeReactionPicker = picker;

  const rect = anchorEl.getBoundingClientRect();
  let top = rect.bottom + 8;
  let left = rect.left;
  if (top + 50 > window.innerHeight) top = rect.top - 50;
  if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
  picker.style.top = top + 'px';
  picker.style.left = left + 'px';

  picker.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => toggleReaction(msgKey, btn.dataset.emoji));
  });
}

function hideReactionPicker() {
  if (activeReactionPicker) {
    activeReactionPicker.remove();
    activeReactionPicker = null;
  }
}
document.addEventListener('click', hideReactionPicker);

function updateReactions(msgKey, reactions) {
  messageReactions.set(msgKey, reactions || {});
  const wrapper = document.querySelector('[data-key="' + msgKey + '"]');
  if (!wrapper) return;
  const container = wrapper.querySelector('.msg-reactions');
  if (container) renderReactionsBar(container, reactions || {}, msgKey);
}

/* ========== SWIPE REPLY ========== */
function addSwipeReply(element, msg, msgKey) {
  let startX = 0, currentX = 0, isSwiping = false;

  const onStart = (x) => { startX = x; isSwiping = true; element.style.transition = 'none'; };
  const onMove = (x) => {
    if (!isSwiping) return;
    const dx = x - startX;
    if (Math.abs(dx) > 5) {
      currentX = dx;
      element.style.transform = 'translateX(' + (dx * 0.4) + 'px)';
    }
  };
  const onEnd = () => {
    isSwiping = false;
    element.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1)';
    element.style.transform = '';
    if (Math.abs(currentX) > 50) setReplyTo(msg, msgKey);
    currentX = 0;
  };

  element.addEventListener('touchstart', e => onStart(e.touches[0].clientX), { passive: true });
  element.addEventListener('touchmove', e => onMove(e.touches[0].clientX), { passive: true });
  element.addEventListener('touchend', onEnd);
}

/* ========== ATTACHMENTS ========== */
attachBtn.addEventListener('click', () => {
  attachMenu.classList.toggle('show');
});
document.addEventListener('click', (e) => {
  if (!attachMenu.contains(e.target) && e.target !== attachBtn) {
    attachMenu.classList.remove('show');
  }
});

attachImage.addEventListener('click', () => {
  attachMenu.classList.remove('show');
  if (window.Android && Android.pickImage) {
    Android.pickImage();
  } else {
    mediaFileInput.accept = 'image/*';
    mediaFileInput.click();
  }
});
attachVideo.addEventListener('click', () => {
  attachMenu.classList.remove('show');
  if (window.Android && Android.pickVideo) {
    Android.pickVideo();
  } else {
    mediaFileInput.accept = 'video/*';
    mediaFileInput.click();
  }
});

mediaFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const type = file.type.startsWith('image/') ? 'image' : 'video';
  const reader = new FileReader();
  reader.onload = (ev) => { sendMessage('', type, ev.target.result); };
  reader.readAsDataURL(file);
  mediaFileInput.value = '';
});

window.receiveFileFromAndroid = function(base64, type) {
  if (window.__storyNativePending) {
    window.__storyNativePending = false;
    storyNativeReceive(base64, type);
    return;
  }
  if (!base64 || base64.length < 100) {
    showToast('فشل تحميل الملف');
    return;
  }
  // Check size (max ~2MB base64)
  if (base64.length > 2500000) {
    showToast('الملف كبير جداً (الحد الأقصى 2MB)');
    return;
  }
  sendMessage('', type, base64);
  showToast(type === 'image' ? 'تم إرسال الصورة ' : 'تم إرسال الفيديو ');
};

function downloadMedia(src) {
  if (window.Android && Android.saveImage) {
    Android.saveImage(src);
  } else {
    const a = document.createElement('a');
    a.href = src;
    a.download = 'nexus-media-' + Date.now();
    a.click();
  }
}

/* ========== CREATE / JOIN GROUP ========== */
function openGroupModal(defaultTab) {
  createGroupModal.classList.remove('hidden');
  groupNameInput.value = '';
  groupDescInput.value = '';
  groupError.classList.add('hidden');
  groupAvatarPreview.innerHTML = '<span>غ</span>';
  groupAvatarPreview.dataset.avatar = '';
  joinCodeInput.value = '';
  joinGroupError.classList.add('hidden');

  const targetIndex = defaultTab === 'join' ? 1 : 0;
  groupTabs.forEach(t => t.classList.remove('active'));
  groupTabs[targetIndex].classList.add('active');
  createGroupPane.classList.toggle('active', defaultTab !== 'join');
  joinGroupPane.classList.toggle('active', defaultTab === 'join');
  if (defaultTab === 'join') joinCodeInput.focus();
}

createGroupFab.addEventListener('click', () => openGroupModal('create'));
joinGroupFab.addEventListener('click', () => openGroupModal('join'));

closeGroupModal.addEventListener('click', () => createGroupModal.classList.add('hidden'));
createGroupModal.querySelector('.modal-overlay').addEventListener('click', () => createGroupModal.classList.add('hidden'));

groupTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    groupTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.gtab;
    createGroupPane.classList.toggle('active', target === 'create');
    joinGroupPane.classList.toggle('active', target === 'join');
  });
});

/* ========== JOIN ROOM BY CODE ========== */
async function joinRoomByCode(rawCode) {
  const code = (rawCode || '').trim();
  if (!code) {
    joinGroupError.textContent = 'أدخل كود الغرفة';
    joinGroupError.classList.remove('hidden');
    return false;
  }
  // Firebase RTDB keys can't contain ".", "#", "$", "[", "]", "/" — reject
  // before building a path with it instead of letting the SDK throw.
  if (/[.#$\[\]\/]/.test(code)) {
    joinGroupError.textContent = 'كود الغرفة غير صالح';
    joinGroupError.classList.remove('hidden');
    return false;
  }
  joinGroupBtn.disabled = true;
  try {
    const roomSnap = await db.ref('rooms/' + code).once('value');
    if (!roomSnap.exists()) {
      joinGroupError.textContent = 'لا توجد غرفة بهذا الكود';
      joinGroupError.classList.remove('hidden');
      joinGroupBtn.disabled = false;
      return false;
    }
    await db.ref('rooms/' + code + '/members/' + currentUser.uid).set(true);
    await db.ref('userRooms/' + currentUser.uid + '/' + code).set({
      joinedAt: Date.now(),
      type: roomSnap.val().type || 'public',
      lastActive: Date.now()
    });
    createGroupModal.classList.add('hidden');
    chatTabs.forEach(t => t.classList.remove('active'));
    chatTabs[1].classList.add('active');
    chatsList.classList.add('hidden');
    groupsList.classList.remove('hidden');
    showToast('انضممت للغرفة "' + (roomSnap.val().name || code) + '" ');
    openChat(code, 'group', { id: code, ...roomSnap.val() });
    joinGroupBtn.disabled = false;
    return true;
  } catch (err) {
    console.error('[JOIN] Error:', err);
    joinGroupError.textContent = 'خطأ: ' + (err.message || 'تحقق من الاتصال');
    joinGroupError.classList.remove('hidden');
    joinGroupBtn.disabled = false;
    return false;
  }
}

joinGroupBtn.addEventListener('click', () => {
  joinGroupError.classList.add('hidden');
  joinRoomByCode(joinCodeInput.value);
});
joinCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinGroupBtn.click();
});


groupAvatarFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = await compressImage(file, 256);
    groupAvatarPreview.innerHTML = '<img src="' + data + '" style="width:100%;height:100%;object-fit:cover;">';
    groupAvatarPreview.dataset.avatar = data;
  } catch (err) { showToast('الصورة غير صالحة'); }
  e.target.value = '';
});

window.receiveAvatarFromAndroid = function (base64) {
  if (!base64 || base64.length < 100) return showToast('فشل تحميل الصورة');
  if (avatarTarget === 'createRoom' && !createGroupModal.classList.contains('hidden')) {
    groupAvatarPreview.innerHTML = '<img src="' + base64 + '" style="width:100%;height:100%;object-fit:cover;">';
    groupAvatarPreview.dataset.avatar = base64;
    return showToast('تم تحميل صورة الغرفة');
  }
  if (avatarTarget === 'editRoom' && !editGroupModal.classList.contains('hidden')) {
    pendingGroupAvatar = base64;
    renderEgAvatar(base64, egName.value);
    return showToast('تم تحميل صورة الغرفة');
  }
  // profile
  currentUser.avatar = base64;
  updateSidebarUser();
  if (!currentUser.isGuest) {
    db.ref('users/' + currentUser.uid).update({ avatar: base64 });
    localStorage.setItem('nexus_avatar', base64);
  }
  showToast('تم تحديث الصورة الشخصية');
};

createGroupBtn.addEventListener('click', async () => {
  const name = groupNameInput.value.trim();
  const desc = groupDescInput.value.trim();
  const avatar = groupAvatarPreview.dataset.avatar || '';

  groupError.classList.add('hidden');
  if (!name) {
    groupError.textContent = 'أدخل اسم الغرفة';
    groupError.classList.remove('hidden');
    return;
  }

  createGroupBtn.disabled = true;

  // Safety timeout
  const safetyTimeout = setTimeout(() => {
    createGroupBtn.disabled = false;
    groupError.textContent = 'انتهى الوقت - تحقق من الاتصال';
    groupError.classList.remove('hidden');
  }, 10000);

  try {
    // Fail fast with a clear message if we're not even connected to the
    // server, instead of silently waiting the full 10s for a generic timeout.
    const connSnap = await Promise.race([
      db.ref('.info/connected').once('value'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('لا يوجد اتصال بالخادم - تحقق من الإنترنت')), 4000))
    ]);
    if (!connSnap.val()) {
      throw new Error('لا يوجد اتصال بالخادم - تحقق من الإنترنت');
    }

    // 10 random letters/digits/symbols gives an astronomically low chance
    // of collision, so we write directly instead of doing an extra
    // round-trip to check if the code already exists first.
    const code = generateRoomCode();
    console.log('[CREATE] Room code:', code);

    // Save room data (OLD structure: rooms/{code})
    await db.ref('rooms/' + code).set({
      name: name,
      desc: desc,
      avatar: avatar,
      type: 'public',
      createdBy: currentUser.uid,
      createdAt: Date.now(),
      members: { [currentUser.uid]: true }
    });
    console.log('[CREATE] rooms/' + code + ' write OK');

    // Save to user's rooms list (OLD way)
    await db.ref('userRooms/' + currentUser.uid + '/' + code).set({
      joinedAt: Date.now(),
      type: 'public',
      lastActive: Date.now()
    });
    console.log('[CREATE] userRooms write OK');

    clearTimeout(safetyTimeout);

    // Show success with code, and copy it to the clipboard right away
    showToast('تم إنشاء الغرفة! الكود: ' + code);
    try { await navigator.clipboard.writeText(code); } catch (e) {}

    setTimeout(() => {
      uiAlert('تم إنشاء الغرفة \n\nكود الغرفة (تم نسخه):\n' + code + '\n\nشاركه مع من تريد ليدخل للغرفة!');
    }, 500);

    createGroupModal.classList.add('hidden');

    // Switch to groups tab and refresh
    chatTabs.forEach(t => t.classList.remove('active'));
    chatTabs[1].classList.add('active');
    chatsList.classList.add('hidden');
    groupsList.classList.remove('hidden');

    // Clear inputs
    groupNameInput.value = '';
    groupDescInput.value = '';
    groupAvatarPreview.innerHTML = '<span>غ</span>';
    groupAvatarPreview.dataset.avatar = '';

  } catch (err) {
    clearTimeout(safetyTimeout);
    console.error('[CREATE] Error:', err);
    groupError.textContent = 'خطأ: ' + (err.message || err.code || 'تحقق من الاتصال أو صلاحيات Firebase');
    groupError.classList.remove('hidden');
    showToast('فشل إنشاء الغرفة ');
  }
  createGroupBtn.disabled = false;
});

/* ========== GROUP INFO ========== */
chatInfoBtn.addEventListener('click', async () => {
  if (currentChatType !== 'group') return;
  const code = currentChatId;
  const snap = await db.ref('rooms/' + code).once('value');
  const g = snap.val() || {};
  groupInfoName.textContent = g.name || code;
  groupInfoDesc.textContent = g.desc || '';
  groupInfoAvatar.innerHTML = g.avatar ? '<img src="' + g.avatar + '" style="width:100%;height:100%;object-fit:cover;">' : '<span>' + (g.name || code).charAt(0).toUpperCase() + '</span>';

  groupInfoCode.value = code;

  const memberIds = g.members ? Object.keys(g.members) : (g.createdBy ? [g.createdBy] : []);
  groupInfoCount.textContent = memberIds.length + ' عضو';
  membersList.innerHTML = '';

  for (const uid of memberIds) {
    try {
      const uSnap = await db.ref('users/' + uid).once('value');
      const u = uSnap.val();
      if (!u) continue;
      const div = document.createElement('div');
      div.className = 'member-item';
      const mAvatar = u.avatar || getDefaultAvatar(u.name);
      const roleLabel = roleOf(uid, g);
      div.innerHTML = '<div class="member-avatar"><img src="' + mAvatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div><div><div class="member-name">' + escapeHtml(u.name || 'مستخدم') + '</div><div class="member-role">' + roleLabel + '</div></div>';
      decorateMember(div, uid, g);
      membersList.appendChild(div);
    } catch (e) { console.warn('Could not load member', uid, e); }
  }

  // Only the room creator can delete it
  deleteGroupBtn.classList.toggle('hidden', !(currentUser && g.createdBy === currentUser.uid));
  updateGroupButtons(g);

  groupInfoModal.classList.remove('hidden');
});

closeGroupInfo.addEventListener('click', () => groupInfoModal.classList.add('hidden'));
groupInfoModal.querySelector('.modal-overlay').addEventListener('click', () => groupInfoModal.classList.add('hidden'));

copyGroupCode.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(groupInfoCode.value);
  } catch (e) {
    groupInfoCode.select();
    document.execCommand('copy');
  }
  showToast('تم نسخ كود الغرفة ');
});

/* ========== DELETE GROUP ========== */
deleteGroupBtn.addEventListener('click', async () => {
  if (currentChatType !== 'group' || !currentChatId) return;
  const code = currentChatId;
  if (!(await uiConfirm('هل أنت متأكد من حذف هذه الغرفة نهائياً؟ سيتم حذف كل الرسائل ولن يستطيع أحد الوصول إليها.'))) return;

  deleteGroupBtn.disabled = true;
  try {
    const snap = await db.ref('rooms/' + code).once('value');
    const g = snap.val() || {};
    if (g.createdBy !== currentUser.uid) {
      showToast('غير مصرح لك بحذف هذه الغرفة');
      deleteGroupBtn.disabled = false;
      return;
    }

    const memberIds = g.members ? Object.keys(g.members) : [];
    // Remove the room from every member's room list
    await Promise.all(memberIds.map(uid =>
      db.ref('userRooms/' + uid + '/' + code).remove().catch(e => console.warn('Could not remove userRooms for', uid, e))
    ));
    // Delete the room's messages and the room itself
    await db.ref('messages/' + code).remove();
    await db.ref('rooms/' + code).remove();

    groupInfoModal.classList.add('hidden');
    activeChat.classList.add('hidden');
    emptyChat.classList.remove('hidden');
    currentChatId = null;
    if (messagesRef) { messagesRef.off(); messagesRef = null; }
    if (typingRef) { typingRef.off(); typingRef = null; }
    if (isMobile) sidebar.classList.remove('hidden-mobile');
    showToast('تم حذف الغرفة ');
  } catch (err) {
    console.error('[DELETE GROUP] Error:', err);
    showToast('فشل حذف الغرفة ');
  }
  deleteGroupBtn.disabled = false;
});

/* ========== PROFILE ========== */

closeProfile.addEventListener('click', () => profileModal.classList.add('hidden'));
profileModal.querySelector('.modal-overlay').addEventListener('click', () => profileModal.classList.add('hidden'));


avatarFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = await compressImage(file, 256);
    currentUser.avatar = data;
    updateSidebarUser();
    if (!currentUser.isGuest) {
      await db.ref('users/' + currentUser.uid).update({ avatar: data });
      localStorage.setItem("nexus_avatar", data);
    }
    showToast('تم تحديث الصورة الشخصية');
  } catch (err) { showToast('فشل تحديث الصورة'); }
  e.target.value = '';
});

logoutBtn.addEventListener('click', async () => {
  if (!currentUser.isGuest) {
    clearTimeout(typingTimeout);
    if (currentChatId) {
      await db.ref('typing/' + currentChatId + '/' + currentUser.uid).set(false).catch(() => {});
    }
    await db.ref('users/' + currentUser.uid).update({ online: false, lastSeen: Date.now() });
  }
  try { await firebase.auth().signOut(); } catch (e) {}
  clearAuth();
  location.reload();
});

/* ========== MOBILE BACK ========== */
mobileBackBtn.addEventListener('click', () => {
  clearTimeout(typingTimeout);
  if (currentChatId && currentUser && !currentUser.isGuest) {
    db.ref('typing/' + currentChatId + '/' + currentUser.uid).set(false).catch(() => {});
  }
  activeChat.classList.add('hidden');
  emptyChat.classList.remove('hidden');
  currentChatId = null;
  if (isMobile) sidebar.classList.remove('hidden-mobile');
  if (messagesRef) { messagesRef.off(); messagesRef = null; }
  if (typingRef) { typingRef.off(); typingRef = null; }
});

window.addEventListener('resize', () => {
  isMobile = window.innerWidth <= 768;
});

/* Keep the latest messages in view once the keyboard finishes opening.
   The `.screen` height itself is handled purely by CSS (100dvh), so no
   JS height tracking is needed -- this just scrolls the chat down. */
messageInput.addEventListener('focus', () => {
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 300);
});

/* ========== AUTO LOGIN ========== */
async function tryAutoLogin() {
  const savedUid = localStorage.getItem("nexus_uid");
  if (!authRefreshToken || !savedUid) return;

  try {
    // ID tokens expire after ~1h, so exchange the refresh token for a fresh one
    const uid = await refreshIdToken();
    if (uid !== savedUid) { clearAuth(); return; }

    // Wait for the Firebase Auth SDK to restore its session (the DB rules need it)
    const sdkUser = await new Promise(resolve => {
      const unsub = firebase.auth().onAuthStateChanged(u => { unsub(); resolve(u); });
    });
    if (!sdkUser) { clearAuth(); return; }

    const userSnap = await db.ref('users/' + uid).once('value');
    const u = userSnap.val() || {};
    currentUser = {
      uid: uid,
      name: u.name || 'مستخدم',
      username: u.username || '',
      email: sdkUser.email || localStorage.getItem("nexus_email") || '',
      avatar: u.avatar || localStorage.getItem("nexus_avatar") || ''
    };
    await db.ref('users/' + uid).update({ online: true, lastSeen: Date.now() });
    onAuthSuccess();
  } catch (err) {
    console.warn('Auto login failed:', err);
    // Only drop the session when we are online; offline we keep it for next time
    if (navigator.onLine) clearAuth();
  }
}

/* ========== TOAST ========== */
function showToast(message) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}

/* ========== FIREBASE CONNECTION CHECK ========== */
function checkFirebaseConnection() {
  const connectedRef = db.ref('.info/connected');
  connectedRef.on('value', snap => {
    if (snap.val() === true) {
      console.log('Firebase: Connected ');
    } else {
      console.log('Firebase: Disconnected ');
    }
  });
}
checkFirebaseConnection();

/* ========== INIT ========== */
window.addEventListener('load', () => tryAutoLogin());
