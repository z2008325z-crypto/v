/* ========== FEATURES: archive & delete chats, group editing, message deletion, settings, custom themes ========== */

ICON_PATHS.archive   = '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>';
ICON_PATHS.unarchive = '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M12 17v-6m-2.5 2.5L12 11l2.5 2.5"/>';
ICON_PATHS.edit      = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
ICON_PATHS.gear      = '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>';

const DEFAULT_COLORS = { accent: '#d4af37', bg: '#050505', surface: '#161616', text: '#f4f4f4', bubble: '#d4af37' };
const FX_LIST = [
  ['none', 'بدون مؤثر'], ['aurora', 'شفق متحرك'], ['rays', 'أشعة دوّارة'],
  ['stars', 'نجوم متساقطة'], ['pulse', 'نبض ضوئي'], ['ember', 'شرر ناري'], ['dragon', 'تنين متحرك'], ['grid', 'شبكة مستقبلية'], ['snow', 'ثلج'], ['bubbles', 'فقاعات صاعدة'], ['neon', 'نيون نابض']
];
const PRESETS = [
  { id: 'ember',  name: 'أحمر ناري',  effect: 'ember',  colors: { accent: '#ff4d2e', bg: '#0a0404', surface: '#220c0c', text: '#fff3ef', bubble: '#ff4d2e' } },
  { id: 'night',  name: 'ليل أزرق',   effect: 'stars',  colors: { accent: '#60a5fa', bg: '#03060d', surface: '#0f2140', text: '#eef5ff', bubble: '#3b82f6' } },
  { id: 'rays',   name: 'أشعة ذهبية', effect: 'rays',   colors: { accent: '#facc15', bg: '#0b0a03', surface: '#23200f', text: '#fffbea', bubble: '#eab308' } },
  { id: 'aurora', name: 'شفق',        effect: 'aurora', colors: { accent: '#34d399', bg: '#02080a', surface: '#0e2a36', text: '#ecfeff', bubble: '#14b8a6' } },
  { id: 'pulse',  name: 'نبض بنفسجي', effect: 'pulse',  colors: { accent: '#c084fc', bg: '#080413', surface: '#1c1234', text: '#f5f3ff', bubble: '#a855f7' } }
];
const CUSTOM_KEYS = ['--bg','--bg-secondary','--bg-tertiary','--surface','--surface-hover','--border','--border-light',
  '--accent','--accent-light','--accent-dark','--accent-glow','--text','--text-secondary','--text-muted','--bubble-sent'];
const FX_CLASSES = FX_LIST.map(x => 'fx-' + x[0]);

let currentUserTheme = null, savedTheme = null, draft = null;
let archiveView = false, suppressUntil = 0, userFeaturesStarted = false, pendingGroupAvatar = null;
const roomMetaRefs = {};

/* ----- colour helpers ----- */
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
  const r = Math.round((t - (n >> 16)) * p + (n >> 16));
  const g = Math.round((t - ((n >> 8) & 255)) * p + ((n >> 8) & 255));
  const b = Math.round((t - (n & 255)) * p + (n & 255));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function buildCustomVars(c) {
  const bg = c.bg, acc = c.accent;
  return {
    '--bg': bg, '--bg-secondary': shade(bg, 4), '--bg-tertiary': shade(bg, 9),
    '--surface': c.surface, '--surface-hover': shade(c.surface, 8),
    '--border': shade(bg, 16), '--border-light': shade(bg, 26),
    '--accent': acc, '--accent-light': shade(acc, 35), '--accent-dark': shade(acc, -30),
    '--accent-glow': hexToRgba(acc, 0.28),
    '--text': c.text, '--text-secondary': shade(c.text, -20), '--text-muted': shade(c.text, -45),
    '--bubble-sent': 'linear-gradient(135deg, ' + shade(c.bubble, 25) + ', ' + c.bubble + ' 60%, ' + shade(c.bubble, -20) + ')'
  };
}

/* ----- personal theme: applied on top of the global admin theme ----- */
function setMedia(m) {
  const box = document.getElementById('bgMedia');
  box.textContent = '';
  if (!m || !m.url) return;
  const el = m.kind === 'video' ? document.createElement('video') : document.createElement('img');
  el.src = m.url;
  if (m.kind === 'video') { el.autoplay = true; el.muted = true; el.loop = true; el.playsInline = true; }
  else el.alt = '';
  box.appendChild(el);
}

function reapplyUserTheme() {
  const root = document.documentElement, body = document.body;
  CUSTOM_KEYS.forEach(k => root.style.removeProperty(k));
  body.classList.remove(...FX_CLASSES, 'media-theme');
  if (typeof applyTheme === 'function') applyTheme(currentSettings.theme);
  const t = currentUserTheme;
  if (!t || t.mode === 'global') { setMedia(null); return; }
  if (t.mode === 'custom') {
    Object.entries(buildCustomVars(t.colors || DEFAULT_COLORS)).forEach(([k, v]) => root.style.setProperty(k, v));
  }
  if (t.effect && t.effect !== 'none') body.classList.add('fx-' + t.effect);
  if (t.mode === 'media' && t.media && t.media.url) { body.classList.add('media-theme'); setMedia(t.media); }
  else setMedia(null);
}

function startUserFeatures() {
  if (userFeaturesStarted || !currentUser || currentUser.isGuest) return;
  userFeaturesStarted = true;
  db.ref('users/' + currentUser.uid + '/theme').on('value', s => {
    currentUserTheme = s.val();
    savedTheme = currentUserTheme;
    if (settingsScreen.classList.contains('active')) return; // don't fight the live preview
    reapplyUserTheme();
  });
}

/* ----- DOM for the new screens and sheets ----- */
(function buildFeatureDom() {
  document.body.insertAdjacentHTML('afterbegin',
    '<div id="bgMedia"></div><div id="fxLayer"></div>' +
    '<div id="dragonFx"><svg viewBox="0 0 240 120" width="240" height="120" aria-hidden="true">' +
    '<path class="dw dw-back" d="M112 56 L62 6 L72 52 L28 30 L98 72 Z"/>' +
    '<path class="dw dw-front" d="M122 58 L152 8 L142 60 L192 40 L130 76 Z"/>' +
    '<path class="dragon-body" d="M70 64 Q112 42 166 52 Q204 58 236 40 Q214 74 170 72 Q124 82 82 88 Z"/>' +
    '<path class="dragon-body" d="M158 50 Q176 36 198 44 L186 56 Z"/>' +
    '<path class="dragon-body" d="M192 42 L204 26 L200 46 Z"/>' +
    '<circle cx="190" cy="47" r="1.8" fill="#000"/>' +
    '</svg></div>');

  chatsList.insertAdjacentHTML('beforebegin', '<button id="archiveBar" class="archive-bar hidden"></button>');
  menuBtn.insertAdjacentHTML('afterend', '');
  logoutBtn.insertAdjacentHTML('beforebegin',
    '<button id="profileEditBtn" class="btn-ghost-wide">' + icon('edit', 16) + '<span>تعديل الاسم واسم المستخدم</span></button>');
  membersList.insertAdjacentHTML('beforebegin',
    '<button id="editGroupBtn" class="btn-ghost-wide hidden">' + icon('edit', 16) + '<span>تعديل الغرفة</span></button>');

  document.body.insertAdjacentHTML('beforeend', `
<div id="sheet" class="sheet hidden">
  <div class="sheet-backdrop"></div>
  <div class="sheet-box">
    <div id="sheetTitle" class="sheet-title"></div>
    <div id="sheetList"></div>
    <button id="sheetCancel" class="sheet-btn cancel">إلغاء</button>
  </div>
</div>

<div id="editProfileModal" class="modal hidden">
  <div class="modal-overlay"></div>
  <div class="modal-content">
    <div class="modal-header"><h3>تعديل الملف الشخصي</h3></div>
    <div class="modal-body">
      <div class="input-group"><label>الاسم</label><input type="text" id="epName" maxlength="25"></div>
      <div class="input-group"><label>اسم المستخدم <small>(إنجليزي، أرقام، _)</small></label>
        <div class="username-input-wrap"><span class="username-at">@</span><input type="text" id="epUser" maxlength="20" style="text-align:left;direction:ltr"></div>
      </div>
      <div id="epMsg" class="form-error hidden"></div>
      <button id="epSave" class="btn-primary">حفظ</button>
      <button id="epCancel" class="btn-ghost-wide">إلغاء</button>
    </div>
  </div>
</div>

<div id="editGroupModal" class="modal hidden">
  <div class="modal-overlay"></div>
  <div class="modal-content">
    <div class="modal-header"><h3>تعديل الغرفة</h3></div>
    <div class="modal-body">
      <div class="group-avatar-upload">
        <div class="group-avatar" id="egAvatarBox"><span></span></div>
        <div class="copy-row" style="justify-content:center">
          <label class="btn-text file-pick" id="egPickBtn">تغيير الصورة<input type="file" id="egFile" accept="image/*" class="pick-input"></label>
          <button class="btn-text" id="egRemoveBtn">إزالة</button>
        </div>
      </div>
      <div class="input-group"><label>اسم الغرفة</label><input type="text" id="egName" maxlength="30"></div>
      <div class="input-group"><label>الوصف</label><input type="text" id="egDesc" maxlength="100"></div>
      <div id="egMsg" class="form-error hidden"></div>
      <button id="egSave" class="btn-primary">حفظ التعديلات</button>
      <button id="egCancel" class="btn-ghost-wide">إلغاء</button>
    </div>
  </div>
</div>

<div id="settingsScreen" class="screen">
  <header class="admin-head">
    <button class="icon-btn" id="settingsBackBtn" aria-label="رجوع">${icon('back', 20)}</button>
    <div class="admin-title"><span class="admin-title-main">الإعدادات</span><span class="admin-title-sub">حسابك ومظهر التطبيق</span></div>
  </header>
  <div class="admin-body">
    <section class="card">
      <h4>${icon('user', 18)}الحساب</h4>
      <div class="acct-row">
        <div class="admin-avatar" id="setAvatar">ن</div>
        <div class="admin-row-info"><b id="setName">مستخدم</b><small id="setUsername"></small></div>
      </div>
      <button class="btn-ghost-wide" id="setEditProfile">${icon('edit', 16)}<span>تعديل الاسم واسم المستخدم</span></button>
    </section>

    <section class="card">
      <h4>${icon('palette', 18)}المظهر الشخصي</h4>
      <div class="seg-sm" id="modeSeg">
        <button data-mode="global">الثيم العام</button>
        <button data-mode="custom">ثيم خاص</button>
        <button data-mode="media">خلفية وسائط</button>
      </div>

      <div id="paneCustom" class="mode-pane">
        <div class="preset-grid" id="presetGrid"></div>
        <label class="color-row">اللون الأساسي <input type="color" data-color="accent"></label>
        <label class="color-row">لون الخلفية <input type="color" data-color="bg"></label>
        <label class="color-row">لون الأسطح <input type="color" data-color="surface"></label>
        <label class="color-row">لون النص <input type="color" data-color="text"></label>
        <label class="color-row">لون رسايلي <input type="color" data-color="bubble"></label>
      </div>

      <div id="paneMedia" class="mode-pane">
        <div class="input-group"><label>رابط صورة أو فيديو (mp4 / webm)</label>
          <input type="url" id="mediaUrl" placeholder="https://..." style="direction:ltr;text-align:left"></div>
      </div>

      <div class="input-group"><label>المؤثر المتحرك</label>
        <select id="fxSelect" class="admin-select">${FX_LIST.map(f => '<option value="' + f[0] + '">' + f[1] + '</option>').join('')}</select>
      </div>

      <p class="hint">التغييرات بتظهر مباشرة. اضغط حفظ لتثبيتها على حسابك في كل الأجهزة.</p>
      <button class="btn-primary" id="saveThemeBtn">حفظ الثيم</button>
      <button class="btn-ghost-wide" id="resetThemeBtn">الرجوع للثيم العام</button>
    </section>
  </div>
</div>`);
})();

/* ----- archive ----- */
function chatVisible(c, kind) {
  if (!!c.archived !== archiveView) return false;
  if (kind === 'dm' && c.deletedAt && (c.lastTime || 0) <= c.deletedAt) return false;
  return true;
}

function updateArchiveBar() {
  const n = Object.values(chatsCache).filter(c => c.archived).length +
            Object.values(roomsCache).filter(r => r.archived).length;
  archiveBar.classList.toggle('hidden', n === 0 && !archiveView);
  archiveBar.innerHTML = icon(archiveView ? 'back' : 'archive', 17) +
    '<span>' + (archiveView ? 'رجوع للمحادثات' : 'الأرشيف') + '</span><span class="count">' + n + '</span>';
}

archiveBar.addEventListener('click', () => {
  archiveView = !archiveView;
  updateArchiveBar();
  renderChatsList();
  renderGroupsList();
});

function setChatFlag(kind, id, field, value) {
  const base = kind === 'dm' ? 'userChats/' : 'userRooms/';
  return db.ref(base + currentUser.uid + '/' + id + '/' + field).set(value)
    .catch(() => showToast('فشلت العملية'));
}

async function deleteDm(id) {
  if (!(await uiConfirm('حذف المحادثة من حسابك؟ ستعود فقط عند وصول رسالة جديدة.'))) return;
  await db.ref('userChats/' + currentUser.uid + '/' + id + '/deletedAt').set(Date.now());
  if (currentChatId === id) resetChatView();
  showToast('تم حذف المحادثة');
}

async function leaveRoomFromList(code) {
  if (!(await uiConfirm('مغادرة هذه الغرفة؟'))) return;
  const uid = currentUser.uid;
  await db.ref('rooms/' + code + '/members/' + uid).remove();
  await db.ref('rooms/' + code + '/mods/' + uid).remove();
  await db.ref('userRooms/' + uid + '/' + code).remove();
  if (currentChatId === code) resetChatView();
  showToast('غادرت الغرفة');
}

/* ----- action sheets (long press / right click) ----- */
function openSheet(title, actions) {
  sheetTitle.textContent = title;
  sheetList.innerHTML = '';
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = 'sheet-btn' + (a.danger ? ' danger' : '');
    b.innerHTML = icon(a.icon, 18) + '<span>' + escapeHtml(a.label) + '</span>';
    b.onclick = () => { closeSheet(); a.run(); };
    sheetList.appendChild(b);
  });
  document.getElementById('sheet').classList.remove('hidden');
}
function closeSheet() { document.getElementById('sheet').classList.add('hidden'); }
sheetCancel.addEventListener('click', closeSheet);
document.querySelector('#sheet .sheet-backdrop').addEventListener('click', closeSheet);

function openChatSheet(item) {
  const id = item.dataset.cid, kind = item.dataset.kind;
  const c = kind === 'dm' ? chatsCache[id] : roomsCache[id];
  if (!c) return;
  const actions = [];
  if (c.archived) actions.push({ label: 'إلغاء الأرشفة', icon: 'unarchive', run: () => setChatFlag(kind, id, 'archived', null) });
  else actions.push({ label: 'أرشفة', icon: 'archive', run: () => setChatFlag(kind, id, 'archived', true) });
  if (kind === 'dm') actions.push({ label: 'حذف المحادثة من عندي', icon: 'trash', danger: true, run: () => deleteDm(id) });
  else if (c.createdBy !== currentUser.uid) actions.push({ label: 'مغادرة الغرفة', icon: 'logout', danger: true, run: () => leaveRoomFromList(id) });
  openSheet(c.otherName || c.name || '', actions);
}

function bindLongPress(listEl, onOpen, selector) {
  let timer = null;
  listEl.addEventListener('pointerdown', e => {
    const el = e.target.closest(selector);
    if (!el) return;
    timer = setTimeout(() => { suppressUntil = Date.now() + 600; onOpen(el); }, 480);
  });
  ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach(ev =>
    listEl.addEventListener(ev, () => clearTimeout(timer)));
  listEl.addEventListener('contextmenu', e => {
    const el = e.target.closest(selector);
    if (el) { e.preventDefault(); onOpen(el); }
  });
}
bindLongPress(chatsList, openChatSheet, '.chat-item');
bindLongPress(groupsList, openChatSheet, '.chat-item');
bindLongPress(messagesList, w => openMessageSheet(w), '.msg-wrapper');

// swallow the click that a long press would otherwise trigger
document.addEventListener('click', e => {
  if (Date.now() < suppressUntil) { e.stopPropagation(); e.preventDefault(); }
}, true);

/* ----- message deletion ----- */
function canDeleteMsg(w) {
  if (w.classList.contains('sent')) return true;
  if (currentChatType !== 'group') return false;
  const g = roomsCache[currentChatId];
  if (!g) return false;
  return g.createdBy === currentUser.uid || !!(g.mods && g.mods[currentUser.uid]);
}

function openMessageSheet(w) {
  if (!w.dataset.key) return;
  const actions = [];
  const bubble = w.querySelector('.msg-bubble');
  if (bubble && !w.querySelector('.msg-media-img, .msg-media-video')) {
    actions.push({ label: 'نسخ النص', icon: 'copy', run: () => {
      navigator.clipboard.writeText(bubble.textContent).then(() => showToast('تم النسخ')).catch(() => {});
    }});
  }
  if (canDeleteMsg(w)) {
    actions.push({ label: 'حذف الرسالة', icon: 'trash', danger: true, run: async () => {
      if (!(await uiConfirm('حذف هذه الرسالة للجميع؟'))) return;
      db.ref('messages/' + currentChatId + '/' + w.dataset.key).remove().catch(() => showToast('فشل الحذف'));
    }});
  }
  if (actions.length) openSheet('الرسالة', actions);
}

/* ----- group meta: live name/avatar/roles for everyone ----- */
function watchRoomMeta(code) {
  if (roomMetaRefs[code]) return;
  const ref = db.ref('rooms/' + code);
  roomMetaRefs[code] = ref;
  ref.on('value', s => {
    const r = s.val(), g = roomsCache[code];
    if (!r || !g) return;
    Object.assign(g, {
      name: r.name || code, desc: r.desc || '', avatar: r.avatar || '',
      createdBy: r.createdBy || '', mods: r.mods || {}, members: r.members || {}
    });
    renderGroupsList();
    if (currentChatId === code && currentChatType === 'group') {
      chatHeaderName.textContent = g.name;
      setAvatarEl(chatHeaderAvatar, chatHeaderAvatar.querySelector('img'), chatHeaderAvatar.querySelector('span'), g.avatar, g.name);
      currentChatData = Object.assign(currentChatData || {}, { name: g.name, avatar: g.avatar });
    }
  });
}

/* ----- group editing (owner only) ----- */
function updateEditGroupBtn(g) {
  editGroupBtn.classList.toggle('hidden', !(currentUser && g.createdBy === currentUser.uid));
}

function renderEgAvatar(avatar, name) {
  const box = document.getElementById('egAvatarBox');
  box.innerHTML = '';
  if (avatar) {
    const img = document.createElement('img');
    img.src = avatar;
    box.appendChild(img);
  } else {
    box.innerHTML = '<span>' + escapeHtml((name || 'غ').charAt(0)) + '</span>';
  }
}

function showEgMsg(text) {
  egMsg.textContent = text;
  egMsg.classList.remove('hidden');
}

function compressImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, (max || 256) / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

editGroupBtn.addEventListener('click', () => {
  const g = roomsCache[currentChatId];
  if (!g) return;
  egName.value = g.name || '';
  egDesc.value = g.desc || '';
  pendingGroupAvatar = null;
  egMsg.classList.add('hidden');
  renderEgAvatar(g.avatar, g.name);
  editGroupModal.classList.remove('hidden');
});

egFile.addEventListener('change', async () => {
  const f = egFile.files[0];
  if (!f) return;
  try {
    pendingGroupAvatar = await compressImage(f, 256);
    renderEgAvatar(pendingGroupAvatar, egName.value);
  } catch (e) { showEgMsg('الصورة غير صالحة'); }
  egFile.value = '';
});
egRemoveBtn.addEventListener('click', () => { pendingGroupAvatar = ''; renderEgAvatar('', egName.value); });

egSave.addEventListener('click', async () => {
  const code = currentChatId, g = roomsCache[code];
  if (!g || g.createdBy !== currentUser.uid) return showEgMsg('هذا الإجراء للمنشئ فقط');
  const name = egName.value.trim().slice(0, 30);
  if (!name) return showEgMsg('أدخل اسم الغرفة');
  const data = {
    name: name,
    desc: egDesc.value.trim().slice(0, 100),
    avatar: pendingGroupAvatar !== null ? pendingGroupAvatar : (g.avatar || '')
  };
  try {
    await db.ref('rooms/' + code).update(data);
    editGroupModal.classList.add('hidden');
    showToast('تم حفظ تعديلات الغرفة');
  } catch (e) { showEgMsg('فشل الحفظ، تحقق من الصلاحيات'); }
});
egCancel.addEventListener('click', () => editGroupModal.classList.add('hidden'));
editGroupModal.querySelector('.modal-overlay').addEventListener('click', () => editGroupModal.classList.add('hidden'));

/* ----- profile: name and username ----- */
function openEditProfile() {
  epName.value = currentUser.name || '';
  epUser.value = currentUser.username || '';
  epMsg.classList.add('hidden');
  editProfileModal.classList.remove('hidden');
}

function showEpMsg(text) { epMsg.textContent = text; epMsg.classList.remove('hidden'); }

epSave.addEventListener('click', async () => {
  const name = epName.value.trim().slice(0, 25);
  const uname = epUser.value.trim().toLowerCase();
  if (!name) return showEpMsg('أدخل الاسم');
  if (!/^[a-z0-9_]{3,20}$/.test(uname)) return showEpMsg('اسم المستخدم 3 إلى 20 حرف إنجليزي أو أرقام أو _');
  const uid = currentUser.uid, oldU = currentUser.username || '';
  try {
    if (uname !== oldU) {
      if ((await db.ref('usernames/' + uname).once('value')).exists()) return showEpMsg('اسم المستخدم مستخدم بالفعل');
      await db.ref('usernames/' + uname).set(uid);
      if (oldU) await db.ref('usernames/' + oldU).remove();
    }
    await db.ref('users/' + uid).update({ name: name, username: uname });
    currentUser.name = name;
    currentUser.username = uname;
    localStorage.setItem('nexus_name', name);
    localStorage.setItem('nexus_username', uname);
    updateSidebarUser();
    updateSettingsAccount();
    editProfileModal.classList.add('hidden');
    showToast('تم تحديث الملف الشخصي');
  } catch (e) { showEpMsg('فشل الحفظ، حاول مرة أخرى'); }
});
epCancel.addEventListener('click', () => editProfileModal.classList.add('hidden'));
editProfileModal.querySelector('.modal-overlay').addEventListener('click', () => editProfileModal.classList.add('hidden'));

profileEditBtn.addEventListener('click', () => { profileModal.classList.add('hidden'); openEditProfile(); });
setEditProfile.addEventListener('click', openEditProfile);
userCard.addEventListener('click', () => profileModal.classList.remove('hidden'));

/* ----- settings screen ----- */
function updateSettingsAccount() {
  if (!currentUser) return;
  setName.textContent = currentUser.name || 'مستخدم';
  setUsername.textContent = currentUser.username ? '@' + currentUser.username : '';
  setAvatar.innerHTML = currentUser.avatar
    ? '<img src="' + currentUser.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
    : escapeHtml((currentUser.name || 'ن').charAt(0));
}

function normalizeTheme(t) {
  return {
    mode: (t && t.mode) || 'global',
    colors: Object.assign({}, DEFAULT_COLORS, (t && t.colors) || {}),
    effect: (t && t.effect) || 'none',
    media: Object.assign({ url: '', kind: 'image' }, (t && t.media) || {})
  };
}

function liveApply() { currentUserTheme = draft; reapplyUserTheme(); }

function renderPresets() {
  presetGrid.innerHTML = '';
  PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.className = 'preset-chip';
    b.style.background = 'linear-gradient(135deg, ' + p.colors.bg + ', ' + p.colors.accent + ')';
    b.textContent = p.name;
    b.onclick = () => {
      draft.colors = Object.assign({}, p.colors);
      draft.effect = p.effect;
      draft.mode = 'custom';
      renderSettingsForm();
      liveApply();
    };
    presetGrid.appendChild(b);
  });
}

function renderSettingsForm() {
  document.querySelectorAll('#modeSeg [data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === draft.mode));
  paneCustom.classList.toggle('active', draft.mode === 'custom');
  paneMedia.classList.toggle('active', draft.mode === 'media');
  document.querySelectorAll('[data-color]').forEach(inp => { inp.value = draft.colors[inp.dataset.color]; });
  fxSelect.value = draft.effect;
  mediaUrl.value = draft.media.url || '';
  renderPresets();
}

function openSettings() {
  if (!currentUser || currentUser.isGuest) return showToast('سجّل الدخول لتغيير الإعدادات');
  savedTheme = currentUserTheme;
  draft = normalizeTheme(currentUserTheme);
  updateSettingsAccount();
  renderSettingsForm();
  settingsScreen.classList.add('active');
}

function closeSettings(keep) {
  if (!keep) { currentUserTheme = savedTheme; reapplyUserTheme(); }
  settingsScreen.classList.remove('active');
}

document.querySelectorAll('#modeSeg [data-mode]').forEach(b => b.addEventListener('click', () => {
  draft.mode = b.dataset.mode;
  renderSettingsForm();
  liveApply();
}));
document.querySelectorAll('[data-color]').forEach(inp => inp.addEventListener('input', () => {
  draft.colors[inp.dataset.color] = inp.value;
  draft.mode = 'custom';
  liveApply();
}));
fxSelect.addEventListener('change', () => { draft.effect = fxSelect.value; liveApply(); });
mediaUrl.addEventListener('input', () => {
  const url = mediaUrl.value.trim();
  draft.media.url = url;
  draft.media.kind = /\.(mp4|webm|ogg)(\?|#|$)/i.test(url) ? 'video' : 'image';
  if (/^https?:\/\//i.test(url)) liveApply();
});

saveThemeBtn.addEventListener('click', async () => {
  if (draft.mode === 'media' && draft.media.url) {
    if (!/^https?:\/\//i.test(draft.media.url)) return showToast('الرابط لازم يبدأ بـ https://');
    if (draft.media.kind !== 'video') {
      const ok = await new Promise(res => {
        const img = new Image();
        img.onload = () => res(true);
        img.onerror = () => res(false);
        img.src = draft.media.url;
      });
      if (!ok) return showToast('الرابط مش صورة مباشرة، لازم ينتهي بـ .jpg أو .png');
    }
  }
  const data = { mode: draft.mode, colors: draft.colors, effect: draft.effect, media: draft.media };
  try {
    await db.ref('users/' + currentUser.uid + '/theme').set(data);
    savedTheme = data;
    currentUserTheme = data;
    showToast('تم حفظ الثيم');
    closeSettings(true);
  } catch (e) { showToast('فشل الحفظ'); }
});

resetThemeBtn.addEventListener('click', async () => {
  try {
    await db.ref('users/' + currentUser.uid + '/theme').remove();
    savedTheme = null;
    currentUserTheme = null;
    draft = normalizeTheme(null);
    renderSettingsForm();
    reapplyUserTheme();
    showToast('رجعت للثيم العام');
  } catch (e) { showToast('فشلت العملية'); }
});

settingsBackBtn.addEventListener('click', () => closeSettings(false));
menuBtn.addEventListener('click', openSettings);


/* ========== ANDROID BACK BUTTON: closes the top open thing (sheet > modal > screen > chat) ========== */
const BACK_SEL = '.modal, .sheet, #settingsScreen, #adminScreen, #activeChat';
const openStack = [];
const wasOpenMap = new Map();
const popClosing = new Set();
let skipPop = 0;

function overlayOpen(el) {
  if (el.id === 'settingsScreen' || el.id === 'adminScreen') return el.classList.contains('active');
  return !el.classList.contains('hidden');
}
function closeOverlay(el) {
  if (el.id === 'activeChat') resetChatView();
  else if (el.id === 'settingsScreen' || el.id === 'adminScreen') el.classList.remove('active');
  else el.classList.add('hidden');
}
document.querySelectorAll(BACK_SEL).forEach(el => wasOpenMap.set(el, overlayOpen(el)));

new MutationObserver(muts => {
  for (const m of muts) {
    const el = m.target;
    if (!el.matches || !el.matches(BACK_SEL)) continue;
    const now = overlayOpen(el);
    const before = wasOpenMap.has(el) ? wasOpenMap.get(el) : false;
    if (before === now) continue;
    wasOpenMap.set(el, now);
    if (now) {
      openStack.push(el);
      history.pushState({ nxOverlay: true }, '');
    } else {
      const i = openStack.lastIndexOf(el);
      if (i >= 0) openStack.splice(i, 1);
      if (popClosing.has(el)) popClosing.delete(el);
      else { skipPop++; history.back(); }   // closed from the UI: drop the history entry we added
    }
  }
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

window.addEventListener('popstate', () => {
  if (skipPop > 0) { skipPop--; return; }
  const el = openStack[openStack.length - 1];
  if (!el) return;            // nothing open: let the browser leave normally
  popClosing.add(el);
  closeOverlay(el);
});

/* ========== "use my account picture" as the group picture ========== */
(function addUseAvatarButtons() {
  const createUpload = document.querySelector('#createGroupPane .group-avatar-upload');
  createUpload.insertAdjacentHTML('beforeend', '<button class="btn-text" id="useMyAvatarCreate">استخدام صورة حسابي</button>');
  const editRow = document.querySelector('#editGroupModal .copy-row');
  editRow.insertAdjacentHTML('beforeend', '<button class="btn-text" id="useMyAvatarEdit">صورة حسابي</button>');

  useMyAvatarCreate.addEventListener('click', () => {
    if (!currentUser || !currentUser.avatar) return showToast('ما عندكش صورة بروفايل');
    groupAvatarPreview.innerHTML = '<img src="' + currentUser.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
    groupAvatarPreview.dataset.avatar = currentUser.avatar;
  });
  useMyAvatarEdit.addEventListener('click', () => {
    if (!currentUser || !currentUser.avatar) return showToast('ما عندكش صورة بروفايل');
    pendingGroupAvatar = currentUser.avatar;
    renderEgAvatar(pendingGroupAvatar, egName.value);
  });
})();

/* ----- avatar pick target: native picker returns the photo to whichever screen asked ----- */
let avatarTarget = 'profile';
function bindAvatarPick(labelId, target) {
  document.getElementById(labelId).addEventListener('click', e => {
    avatarTarget = target;
    if (window.Android && Android.pickAvatar) { e.preventDefault(); Android.pickAvatar(); }
  });
}
bindAvatarPick('egPickBtn', 'editRoom');
bindAvatarPick('changeGroupAvatar', 'createRoom');
bindAvatarPick('changeProfileAvatar', 'profile');
