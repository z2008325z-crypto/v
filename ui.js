/* ========== ICONS, REACTIONS, LOGO & DIALOGS (drawn in code, no emoji) ========== */
const ICON_PATHS = {
  menu:   '<path d="M4 7h16M4 12h16M4 17h10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  back:   '<path d="M9 5l7 7-7 7"/>',
  info:   '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  attach: '<path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.3 3.3 0 0 1 4.7 4.7L10 18a1.7 1.7 0 0 1-2.3-2.3L15 8.5"/>',
  image:  '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
  video:  '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
  send:   '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  close:  '<path d="M6 6l12 12M18 6 6 18"/>',
  plus:   '<path d="M12 5v14M5 12h14"/>',
  key:    '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
  group:  '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 4.5"/>',
  chat:   '<path d="M4 5h16v11H9l-5 4z"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  lock:   '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  trash:  '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  copy:   '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  check:  '<path d="m5 12 5 5 9-10"/>',
  palette:'<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5 0-2.5 3 0 4-1 2-3 2-6a7 7 0 0 0-8-6.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="8" r="1"/>',
  bubble: '<path d="M4 6h16v10H10l-4 4v-4H4z"/>',
  ban:    '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  badge:  '<path d="M12 3l2.3 1.7 2.8-.1.9 2.7 2.3 1.6-1 2.6 1 2.6-2.3 1.6-.9 2.7-2.8-.1L12 21l-2.3-1.7-2.8.1-.9-2.7-2.3-1.6 1-2.6-1-2.6 2.3-1.6.9-2.7 2.8.1z"/><path d="m8.8 12.2 2.2 2.2 4.2-4.2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  heart:  '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  thumb:  '<path d="M7 11l4-7a2 2 0 0 1 2 2v3h6a2 2 0 0 1 2 2l-1.5 7a2 2 0 0 1-2 1.5H7z"/><path d="M3 11h4v9H3z"/>',
  laugh:  '<circle cx="12" cy="12" r="9"/><path d="M8 14a4.5 4.5 0 0 0 8 0M9 9.5h.01M15 9.5h.01"/>',
  wow:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
  sad:    '<circle cx="12" cy="12" r="9"/><path d="M8 16a4.5 4.5 0 0 1 8 0M9 9.5h.01M15 9.5h.01"/>',
  fire:   '<path d="M12 21c4 0 6-3 6-6.5 0-3-2-5-3-7-.5 2-1.5 3-2.5 3.5C12 8 11.5 5.5 9 3c0 3-3 5-3 9a6 6 0 0 0 6 9z"/>'
};

const REACTIONS = { heart: 'heart', thumb: 'thumb', laugh: 'laugh', wow: 'wow', sad: 'sad', fire: 'fire' };

function icon(name, size, cls) {
  size = size || 18;
  return '<svg class="ico ' + (cls || '') + '" width="' + size + '" height="' + size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (ICON_PATHS[name] || '') + '</svg>';
}

function reactionHtml(key) {
  if (REACTIONS[key]) return '<span class="rx rx-' + key + '">' + icon(key, 16) + '</span>';
  return escapeHtml(key); // reactions stored before this update
}

function logoSvg(size) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 48 48" aria-hidden="true">' +
    '<defs><linearGradient id="nxG" x1="0" y1="0" x2="48" y2="48"><stop offset="0" stop-color="#f7e7a4"/><stop offset="1" stop-color="#b8921f"/></linearGradient></defs>' +
    '<path d="M11 38V10h6l13 19V10h7v28h-6L18 19v19z" fill="url(#nxG)"/></svg>';
}

function fillIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon, +el.dataset.size || 18);
  });
  document.querySelectorAll('[data-logo]').forEach(el => {
    el.innerHTML = logoSvg(+el.dataset.logo || 40);
  });
}
fillIcons();

/* ----- Dialogs (replace the browser's alert/confirm) ----- */
document.body.insertAdjacentHTML('beforeend',
  '<div id="uiDialog" class="dialog hidden">' +
    '<div class="dialog-backdrop"></div>' +
    '<div class="dialog-box" role="dialog">' +
      '<p id="uiDialogMsg"></p>' +
      '<div class="dialog-actions">' +
        '<button id="uiDialogCancel" class="btn-ghost">إلغاء</button>' +
        '<button id="uiDialogOk" class="btn-primary sm">موافق</button>' +
      '</div>' +
    '</div>' +
  '</div>');

let _dlgResolve = null;
function _closeDialog(value) {
  document.getElementById('uiDialog').classList.add('hidden');
  if (_dlgResolve) { const r = _dlgResolve; _dlgResolve = null; r(value); }
}
function _openDialog(message, cancelable) {
  return new Promise(resolve => {
    if (_dlgResolve) _dlgResolve(false);
    _dlgResolve = resolve;
    document.getElementById('uiDialogMsg').textContent = message;
    document.getElementById('uiDialogCancel').classList.toggle('hidden', !cancelable);
    document.getElementById('uiDialog').classList.remove('hidden');
  });
}
function uiConfirm(message) { return _openDialog(message, true); }
function uiAlert(message) { return _openDialog(message, false).then(() => undefined); }

document.getElementById('uiDialogOk').addEventListener('click', () => _closeDialog(true));
document.getElementById('uiDialogCancel').addEventListener('click', () => _closeDialog(false));
document.querySelector('#uiDialog .dialog-backdrop').addEventListener('click', () => _closeDialog(false));
