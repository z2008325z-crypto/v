/* ========== VOICE CALLS: WebRTC audio. Firebase only carries the handshake. ========== */
(function () {
  const RING_MS = 45000;
  const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

  Object.assign(ICON_PATHS, {
    phone:    '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    phoneOff: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/><path d="M3 3l18 18"/>',
    mic:      '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    micOff:   '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M3 3l18 18"/>',
    eye:      '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>'
  });

  let pc = null, localStream = null, callId = null, role = null;
  let peerUid = null, peerName = '', peerAvatar = '';
  let pending = null, connected = false, muted = false, lastSent = null;
  let ringTimer = null, clockTimer = null, clockStart = 0;
  let watchers = [];
  let inboxRef = null, inboxUid = null;

  const $ = id => document.getElementById(id);
  const me = () => (currentUser && !currentUser.isGuest ? currentUser : null);
  const fmt = ms => {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  const avatarHtml = (src, name) => src
    ? '<img src="' + escapeHtml(src) + '" alt="">'
    : '<span>' + escapeHtml((name || 'م').charAt(0)) + '</span>';

  /* ----- DOM ----- */
  document.body.insertAdjacentHTML('beforeend',
    '<div id="callOverlay" class="call-overlay hidden">' +
      '<div class="call-box">' +
        '<div class="call-avatar" id="callAvatar"></div>' +
        '<h3 id="callName"></h3>' +
        '<p id="callStatus"></p>' +
        '<div class="call-row" id="callRowIncoming">' +
          '<button class="call-btn accept" id="callAccept" aria-label="رد">' + icon('phone', 26) + '</button>' +
          '<button class="call-btn end" id="callDecline" aria-label="رفض">' + icon('phoneOff', 26) + '</button>' +
        '</div>' +
        '<div class="call-row hidden" id="callRowActive">' +
          '<button class="call-btn" id="callMute" aria-label="كتم">' + icon('mic', 24) + '</button>' +
          '<button class="call-btn end" id="callEnd" aria-label="إنهاء">' + icon('phoneOff', 26) + '</button>' +
        '</div>' +
      '</div>' +
      '<audio id="callAudio" autoplay playsinline></audio>' +
    '</div>');

  document.querySelector('.chat-header #chatInfoBtn').insertAdjacentHTML('beforebegin',
    '<button class="icon-btn hidden" id="chatCallBtn" aria-label="اتصال">' + icon('phone', 19) + '</button>');

  function syncChatCallBtn() {
    const d = currentChatData, user = me();
    const ok = currentChatType === 'dm' && d && d.uid && user && d.uid !== user.uid;
    $('chatCallBtn').classList.toggle('hidden', !ok);
  }
  new MutationObserver(syncChatCallBtn).observe($('chatHeaderName'), { childList: true, characterData: true, subtree: true });

  $('chatCallBtn').addEventListener('click', () => {
    if (currentChatType !== 'dm' || !currentChatData) return showToast('الاتصال متاح في المحادثات الخاصة');
    startCall(currentChatData.uid, currentChatData.name, currentChatData.avatar);
  });

  /* ----- helpers ----- */
  function getMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(Object.assign(new Error('nomedia'), { name: 'NoMedia' }));
    }
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
  }
  function micError(err) {
    if (err && err.name === 'NotAllowedError') return 'اسمح للتطبيق بالوصول للميكروفون';
    if (err && err.name === 'NoMedia') return 'الجهاز مش بيدعم المكالمات';
    return 'تعذر بدء المكالمة';
  }
  function waitIce(p) {
    return new Promise(res => {
      if (p.iceGatheringState === 'complete') return res();
      const done = () => {
        if (p.iceGatheringState === 'complete') { p.removeEventListener('icegatheringstatechange', done); res(); }
      };
      p.addEventListener('icegatheringstatechange', done);
      setTimeout(res, 4000);
    });
  }
  function messageFor(r) {
    return { declined: 'تم رفض المكالمة', missed: 'لم يتم الرد', busy: 'الطرف الآخر مشغول', failed: 'فشل الاتصال' }[r] || null;
  }
  function watch(ref, event, cb) { ref.on(event, cb); watchers.push([ref, event, cb]); }
  function unwatchAll() { watchers.forEach(([r, e, cb]) => r.off(e, cb)); watchers = []; }

  function showOverlay(state) {
    const incoming = state === 'incoming';
    $('callRowIncoming').classList.toggle('hidden', !incoming);
    $('callRowActive').classList.toggle('hidden', incoming);
    $('callName').textContent = peerName;
    $('callStatus').textContent = state === 'incoming' ? 'مكالمة صوتية واردة' : 'جاري الاتصال...';
    $('callAvatar').innerHTML = avatarHtml(peerAvatar, peerName);
    $('callOverlay').classList.remove('hidden');
  }
  function hideOverlay() { $('callOverlay').classList.add('hidden'); }

  function newPC() {
    const p = new RTCPeerConnection(RTC_CONFIG);
    p.ontrack = e => { $('callAudio').srcObject = e.streams[0]; };
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'connected') onConnected();
      else if (p.connectionState === 'failed') endCall('failed');
    };
    return p;
  }

  function onConnected() {
    if (connected) return;
    connected = true;
    clearTimeout(ringTimer); ringTimer = null;
    $('callRowIncoming').classList.add('hidden');
    $('callRowActive').classList.remove('hidden');
    clockStart = Date.now();
    $('callStatus').textContent = '00:00';
    clockTimer = setInterval(() => { $('callStatus').textContent = fmt(Date.now() - clockStart); }, 1000);
  }

  function cleanup(msg) {
    clearTimeout(ringTimer); clearInterval(clockTimer);
    ringTimer = clockTimer = null;
    unwatchAll();
    if (pc) { pc.onconnectionstatechange = null; pc.close(); pc = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    $('callAudio').srcObject = null;
    role = null; callId = null; peerUid = null; pending = null;
    connected = false; muted = false; lastSent = null;
    $('callMute').classList.remove('on');
    $('callMute').innerHTML = icon('mic', 24);
    hideOverlay();
    if (msg) showToast(msg);
  }

  /* Ends the call and tells the other side why. */
  function endCall(reason) {
    const r = reason || 'ended';
    const wasIncoming = role === 'incoming';
    if (callId) {
      const id = callId, user = me();
      if (role === 'caller' && !connected && peerUid) db.ref('calls/' + peerUid + '/' + id).remove().catch(() => {});
      if (wasIncoming && user) db.ref('calls/' + user.uid + '/' + id).remove().catch(() => {});
      lastSent = r;
      db.ref('callSignals/' + id + '/ended').set(r).catch(() => {});
    }
    cleanup(wasIncoming ? null : messageFor(r));
  }

  /* ----- caller ----- */
  window.startCall = async function (uid, name, avatar) {
    const user = me();
    if (!user) return showToast('سجّل الدخول للاتصال');
    if (!uid || uid === user.uid) return;
    if (pc || pending) return showToast('أنت في مكالمة بالفعل');
    role = 'caller'; peerUid = uid;
    peerName = name || 'مستخدم'; peerAvatar = avatar || '';
    showOverlay('outgoing');
    try {
      localStream = await getMic();
      pc = newPC();
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
      await pc.setLocalDescription(await pc.createOffer());
      await waitIce(pc);
      callId = db.ref('callSignals').push().key;
      await db.ref('calls/' + uid + '/' + callId).set({
        from: user.uid, fromName: user.name || '', sdp: pc.localDescription.sdp, createdAt: Date.now()
      });
      watch(db.ref('callSignals/' + callId + '/answer'), 'value', async s => {
        const sdp = s.val();
        if (!sdp || role !== 'caller' || !pc || pc.currentRemoteDescription) return;
        clearTimeout(ringTimer);
        try { await pc.setRemoteDescription({ type: 'answer', sdp: sdp }); }
        catch (e) { endCall('failed'); }
      });
      watchEnded();
      ringTimer = setTimeout(() => endCall('missed'), RING_MS);
    } catch (err) {
      cleanup(micError(err));
    }
  };

  function watchEnded() {
    const id = callId;
    watch(db.ref('callSignals/' + id + '/ended'), 'value', s => {
      const v = s.val();
      if (!v || id !== callId) return;
      if (v === lastSent) return cleanup(null);
      cleanup(messageFor(v));
    });
  }

  /* ----- callee: incoming invites ----- */
  function startInbox() {
    const user = me();
    if (!user || inboxUid === user.uid) return;
    if (inboxRef) inboxRef.off();
    inboxUid = user.uid;
    inboxRef = db.ref('calls/' + user.uid);
    inboxRef.on('child_added', s => onInvite(s.key, s.val()));
    inboxRef.on('child_removed', s => {
      if (pending && pending.id === s.key) cleanup(null);
    });
  }

  async function onInvite(id, data) {
    const user = me();
    if (!user || !data || !data.sdp) return;
    const age = Date.now() - (data.createdAt || 0);
    if (age > RING_MS) { db.ref('calls/' + user.uid + '/' + id).remove().catch(() => {}); return; }
    if (pc || pending) {
      db.ref('calls/' + user.uid + '/' + id).remove().catch(() => {});
      db.ref('callSignals/' + id + '/ended').set('busy').catch(() => {});
      return;
    }
    pending = { id: id, data: data };
    role = 'incoming'; callId = id; peerUid = data.from;
    peerName = data.fromName || 'مستخدم'; peerAvatar = '';
    showOverlay('incoming');
    watchEnded();
    ringTimer = setTimeout(() => endCall('missed'), RING_MS - age);
    db.ref('users/' + data.from + '/avatar').once('value').then(s => {
      if (pending && pending.id === id) { peerAvatar = s.val() || ''; showOverlay('incoming'); }
    }).catch(() => {});
  }

  async function acceptCall() {
    if (!pending || !me()) return;
    const p = pending;
    pending = null;
    clearTimeout(ringTimer); ringTimer = null;
    role = 'callee';
    showOverlay('connecting');
    try {
      localStream = await getMic();
      pc = newPC();
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
      await pc.setRemoteDescription({ type: 'offer', sdp: p.data.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIce(pc);
      await db.ref('calls/' + me().uid + '/' + p.id).remove();
      await db.ref('callSignals/' + p.id + '/answer').set(pc.localDescription.sdp);
    } catch (err) {
      endCall('failed');
      showToast(micError(err));
    }
  }

  /* ----- controls ----- */
  $('callAccept').onclick = acceptCall;
  $('callDecline').onclick = () => endCall('declined');
  $('callEnd').onclick = () => endCall('ended');
  $('callMute').onclick = () => {
    muted = !muted;
    if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = !muted; });
    $('callMute').classList.toggle('on', muted);
    $('callMute').innerHTML = icon(muted ? 'micOff' : 'mic', 24);
  };

  /* Start listening for invites once someone is logged in (and again if the account changes). */
  setInterval(startInbox, 1000);
  startInbox();
})();
