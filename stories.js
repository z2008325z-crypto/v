/* ========== STORIES: upload, view, like. Each story lasts 24 hours. ========== */
(function () {
  const STORY_TTL = 24 * 60 * 60 * 1000;
  const IMG_MS = 5000;
  const MAX_CHARS = 2500000;
  const SEEN_KEY = 'nexus_story_seen';

  let storiesData = {};
  let viewList = [], viewIdx = 0, viewOwner = null;
  let viewTimer = null, viewElapsed = 0, viewDur = 1, viewTick = 0, viewPaused = false;

  const $ = id => document.getElementById(id);
  const me = () => (currentUser && !currentUser.isGuest ? currentUser : null);

  /* ----- DOM (built here so index.html only needs the script tag) ----- */
  document.querySelector('#sidebar .chat-tabs').insertAdjacentHTML('beforebegin',
    '<div id="storiesBar" class="stories-bar hidden"></div>');

  document.body.insertAdjacentHTML('beforeend',
    '<div id="storyViewer" class="story-viewer hidden">' +
      '<div class="sv-progress" id="svProgress"></div>' +
      '<div class="sv-top">' +
        '<div class="sv-author"><div class="sv-avatar" id="svAvatar"></div>' +
          '<div class="sv-meta"><span id="svName"></span><small id="svTime"></small></div></div>' +
        '<div class="sv-top-actions">' +
          '<button class="sv-icon hidden" id="svDelete" aria-label="حذف">' + icon('trash', 18) + '</button>' +
          '<button class="sv-icon" id="svClose" aria-label="إغلاق">' + icon('close', 18) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="sv-media" id="svMedia"></div>' +
      '<div class="sv-tap sv-prev" id="svPrev"></div>' +
      '<div class="sv-tap sv-next" id="svNext"></div>' +
      '<div class="sv-bottom"><button class="sv-like" id="svLike">' + icon('heart', 20) +
        '<span id="svLikeCount">0</span></button></div>' +
    '</div>' +
    '<input type="file" id="storyFileInput" accept="image/*,video/*" class="hidden-input">');

  /* ----- helpers ----- */
  function seenMap() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; }
  }
  function markSeen(sid) {
    const s = seenMap(); s[sid] = 1;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function activeOf(uid) {
    const now = Date.now();
    return Object.entries(storiesData[uid] || {})
      .map(([sid, s]) => Object.assign({ sid: sid, uid: uid }, s, { likes: (s && s.likes) || {} }))
      .filter(s => s.expiresAt > now)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  function avatarHtml(src, name) {
    return src ? '<img src="' + escapeHtml(src) + '" alt="">'
               : '<span>' + escapeHtml((name || 'م').charAt(0)) + '</span>';
  }
  function timeText(t) {
    return new Date(t).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  /* ----- stories bar ----- */
  function renderBar() {
    const bar = $('storiesBar');
    if (!me()) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const keep = bar.scrollLeft;
    const uids = Object.keys(storiesData).filter(u => activeOf(u).length);
    uids.sort((a, b) => (b === me().uid) - (a === me().uid));
    const seen = seenMap();
    let html = '<button class="story-item" id="storyAddBtn">' +
      '<span class="story-ring plain"><span class="story-plus">' + icon('plus', 22) + '</span></span>' +
      '<span class="story-name">أضف قصة</span></button>';
    uids.forEach(uid => {
      const list = activeOf(uid), last = list[list.length - 1];
      const own = uid === me().uid;
      const allSeen = list.every(s => seen[s.sid]);
      const name = own ? 'قصتك' : (last.name || 'مستخدم');
      const avatar = own ? me().avatar : last.avatar;
      html += '<button class="story-item' + (allSeen ? ' seen' : '') + '" data-uid="' + uid + '">' +
        '<span class="story-ring"><span class="story-img">' + avatarHtml(avatar, last.name) + '</span></span>' +
        '<span class="story-name">' + escapeHtml(name) + '</span></button>';
    });
    bar.innerHTML = html;
    bar.scrollLeft = keep;
    $('storyAddBtn').onclick = pickStory;
    bar.querySelectorAll('[data-uid]').forEach(b => { b.onclick = () => openViewer(b.dataset.uid); });
  }

  /* ----- live feed (starts after login, see onAuthSuccess) ----- */
  window.startStories = function () {
    if (!me() || window.__storiesOn) return;
    window.__storiesOn = true;
    db.ref('stories').on('value', s => {
      storiesData = s.val() || {};
      renderBar();
      refreshViewer();
    }, err => console.warn('stories:', err));
  };

  /* ----- upload ----- */
  function pickStory() {
    if (!me()) return showToast('سجّل الدخول لإضافة قصة');
    if (window.Android && Android.pickImage) {
      window.__storyNativePending = true;   // receiveFileFromAndroid will hand the file here
      Android.pickImage();
      return;
    }
    $('storyFileInput').click();
  }
  window.storyNativeReceive = function (dataUrl, type) {
    saveStory(dataUrl, type === 'video' ? 'video' : 'image');
  };

  $('storyFileInput').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      if (f.type.startsWith('video/')) {
        const data = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
        saveStory(data, 'video');
      } else {
        saveStory(await compressImage(f, 1080), 'image');
      }
    } catch (err) { showToast('الملف غير صالح'); }
  });

  async function saveStory(data, kind) {
    const user = me();
    if (!user) return;
    if (!data || data.length < 100) return showToast('الملف غير صالح');
    if (data.length > MAX_CHARS) return showToast('الملف كبير، جرّب صورة أصغر أو فيديو أقصر');
    const now = Date.now();
    const sid = db.ref('stories/' + user.uid).push().key;
    try {
      await db.ref('stories/' + user.uid + '/' + sid).set({
        kind: kind,
        mediaData: data,
        createdAt: now,
        expiresAt: now + STORY_TTL,
        name: user.name || '',
        username: user.username || '',
        avatar: user.avatar || ''
      });
      showToast('تم نشر القصة');
    } catch (err) { showToast('فشل النشر، تحقق من الاتصال'); }
  }

  /* ----- viewer ----- */
  function openViewer(uid) {
    const list = activeOf(uid);
    if (!list.length) return;
    viewOwner = uid;
    viewList = list;
    $('storyViewer').classList.remove('hidden');
    showAt(0);
  }

  function closeViewer() {
    clearInterval(viewTimer); viewTimer = null;
    $('storyViewer').classList.add('hidden');
    $('svMedia').innerHTML = '';
    viewList = []; viewOwner = null;
  }

  function showAt(i) {
    if (i >= viewList.length) return closeViewer();
    if (i < 0) i = 0;
    viewIdx = i;
    const s = viewList[i];
    markSeen(s.sid);

    const media = $('svMedia');
    media.innerHTML = '';
    let el;
    if (s.kind === 'video') {
      el = document.createElement('video');
      el.src = s.mediaData;
      el.playsInline = true;
      el.autoplay = true;
      el.onloadedmetadata = () => {
        const cur = viewList[viewIdx];
        if (cur && cur.sid === s.sid && isFinite(el.duration)) startProgress(Math.max(1000, el.duration * 1000));
      };
    } else {
      el = document.createElement('img');
      el.src = s.mediaData;
      el.alt = '';
    }
    media.appendChild(el);

    $('svProgress').innerHTML = viewList.map((_, k) =>
      '<span class="sv-bar"><i style="width:' + (k < i ? 100 : 0) + '%"></i></span>').join('');
    startProgress(IMG_MS);

    $('svName').textContent = s.name || 'مستخدم';
    $('svTime').textContent = timeText(s.createdAt);
    $('svAvatar').innerHTML = avatarHtml(s.avatar, s.name);
    $('svDelete').classList.toggle('hidden', !me() || s.uid !== me().uid);
    renderLikes(s);
  }

  function startProgress(ms) {
    clearInterval(viewTimer);
    const bar = document.querySelectorAll('#svProgress i')[viewIdx];
    viewDur = ms; viewElapsed = 0; viewTick = Date.now(); viewPaused = false;
    viewTimer = setInterval(() => {
      const now = Date.now();
      if (!viewPaused) viewElapsed += now - viewTick;
      viewTick = now;
      if (bar) bar.style.width = Math.min(100, viewElapsed / viewDur * 100) + '%';
      if (!viewPaused && viewElapsed >= viewDur) showAt(viewIdx + 1);
    }, 60);
  }

  function setPaused(p) {
    viewPaused = p;
    viewTick = Date.now();
    const v = document.querySelector('#svMedia video');
    if (v) { if (p) v.pause(); else v.play().catch(() => {}); }
  }

  $('storyViewer').addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    setPaused(true);
  });
  ['pointerup', 'pointercancel'].forEach(ev =>
    $('storyViewer').addEventListener(ev, () => { if (viewPaused) setPaused(false); }));

  $('svNext').onclick = () => showAt(viewIdx + 1);
  $('svPrev').onclick = () => showAt(viewIdx - 1);
  $('svClose').onclick = closeViewer;

  /* ----- likes ----- */
  function renderLikes(s) {
    const user = me();
    $('svLike').classList.toggle('liked', !!(user && s.likes[user.uid]));
    $('svLikeCount').textContent = Object.keys(s.likes).length;
  }

  $('svLike').addEventListener('click', async e => {
    e.stopPropagation();
    const s = viewList[viewIdx], user = me();
    if (!s) return;
    if (!user) return showToast('سجّل الدخول للإعجاب');
    const liked = !!s.likes[user.uid];
    try {
      await db.ref('stories/' + s.uid + '/' + s.sid + '/likes/' + user.uid).set(liked ? null : true);
    } catch (err) { showToast('تعذر تسجيل الإعجاب'); }
  });

  /* ----- owner delete ----- */
  $('svDelete').addEventListener('click', async () => {
    const s = viewList[viewIdx], user = me();
    if (!s || !user || s.uid !== user.uid) return;
    if (!(await uiConfirm('حذف هذه القصة؟'))) return;
    try {
      await db.ref('stories/' + s.uid + '/' + s.sid).remove();
      showToast('تم حذف القصة');
    } catch (err) { showToast('فشل الحذف'); }
  });

  /* keep the open viewer in sync with live data (likes, deletions, new stories) */
  function refreshViewer() {
    if ($('storyViewer').classList.contains('hidden') || !viewOwner) return;
    const cur = viewList[viewIdx];
    const fresh = activeOf(viewOwner);
    if (!fresh.length) return closeViewer();
    viewList = fresh;
    const idx = cur ? fresh.findIndex(s => s.sid === cur.sid) : -1;
    if (idx === -1) return showAt(Math.min(viewIdx, fresh.length - 1));
    viewIdx = idx;
    renderLikes(fresh[idx]);
  }

  renderBar();
})();
