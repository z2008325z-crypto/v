import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, set, get, update, push, onValue, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const ADMIN_EMAIL = "abmen@gmail.com";

const firebaseConfig = {
  apiKey: "AIzaSyDTF63y8dhvmVBwId57Ojk0gFBnHpwrGK8",
  authDomain: "axel-16012.firebaseapp.com",
  databaseURL: "https://axel-16012-default-rtdb.firebaseio.com",
  projectId: "axel-16012",
  storageBucket: "axel-16012.firebasestorage.app",
  messagingSenderId: "643863426516",
  appId: "1:643863426516:android:4717bd833c24aab2b65241"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isUrl = s => /^https?:\/\/[^\s]+$/.test(s);
const timeAgo = t => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "الآن";
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`;
  return new Date(t).toLocaleDateString("ar-EG");
};

const badge = `<svg class="verified" viewBox="0 0 24 24" aria-label="موثق">
  <circle cx="12" cy="12" r="11" fill="#1d9bf0"/>
  <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

let currentUser = null, isAdmin = false, pendingName = null, started = false;
let usersCache = {}, verifiedMap = {}, postsCache = {}, likesCache = {}, tasksCache = {};

function toast(msg, isErr = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (isErr ? " err" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = "toast"), 2600);
}

// ===== الإعدادات العامة =====
onValue(ref(db, "settings"), snap => {
  const s = snap.val() || {};
  const root = document.documentElement.style;
  root.setProperty("--bg", s.bg || "#000000");
  root.setProperty("--accent", s.accent || "#4f8cff");
  if (s.bg) $("set-bg").value = s.bg;
  if (s.accent) $("set-accent").value = s.accent;
});

// ===== الشاشات =====
function show(id) {
  $("auth-screen").classList.toggle("hidden", id !== "auth-screen");
  $("app-screen").classList.toggle("hidden", id !== "app-screen");
}

// ===== الدخول =====
let signupMode = false;
function setMode(signup) {
  signupMode = signup;
  $("auth-name").classList.toggle("hidden", !signup);
  $("auth-submit").textContent = signup ? "إنشاء حساب" : "دخول";
  $("tab-login").classList.toggle("active", !signup);
  $("tab-signup").classList.toggle("active", signup);
  $("auth-error").textContent = "";
}
$("tab-login").onclick = () => setMode(false);
$("tab-signup").onclick = () => setMode(true);

const friendly = err => {
  const c = err.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "البريد أو كلمة السر غير صحيحة";
  if (c.includes("email-already-in-use")) return "البريد مسجل بالفعل";
  if (c.includes("weak-password")) return "كلمة السر ضعيفة (6 أحرف على الأقل)";
  if (c.includes("invalid-email")) return "البريد الإلكتروني غير صالح";
  if (c.includes("too-many-requests")) return "محاولات كثيرة، جرب بعد قليل";
  return "حدث خطأ، حاول مرة أخرى";
};

$("auth-form").onsubmit = async e => {
  e.preventDefault();
  $("auth-error").textContent = "";
  const btn = $("auth-submit");
  btn.disabled = true;
  const email = $("auth-email").value.trim();
  const pass = $("auth-pass").value;
  try {
    if (signupMode) {
      pendingName = $("auth-name").value.trim() || email.split("@")[0];
      await createUserWithEmailAndPassword(auth, email, pass);
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  } catch (err) {
    pendingName = null;
    $("auth-error").textContent = friendly(err);
  } finally {
    btn.disabled = false;
  }
};

$("google-btn").onclick = async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    $("auth-error").textContent = friendly(err);
  }
};

$("logout-btn").onclick = () => signOut(auth);

async function ensureProfile(user, name) {
  const userRef = ref(db, `users/${user.uid}`);
  const snap = await get(userRef);
  if (!snap.exists()) {
    await set(userRef, {
      name: name || user.displayName || user.email.split("@")[0],
      email: user.email,
      photo: user.photoURL || "",
      createdAt: Date.now()
    });
  }
}

// حساب الأدمن يتفعل تلقائيا عند أول دخول بالإيميل ده
async function ensureAdmin(user) {
  if (user.email?.toLowerCase() !== ADMIN_EMAIL) return;
  await set(ref(db, `admins/${user.uid}`), true);
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) { show("auth-screen"); return; }

  try {
    await ensureAdmin(user);
    await ensureProfile(user, pendingName);
  } catch (err) {
    toast("تعذر تحميل الحساب", true);
  }
  pendingName = null;

  const adminSnap = await get(ref(db, `admins/${user.uid}`));
  isAdmin = adminSnap.val() === true;
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !isAdmin));

  show("app-screen");
  if (!started) { started = true; startListeners(); }
});

// ===== المستمعات اللحظية =====
function startListeners() {
  onValue(ref(db, "users"), snap => {
    usersCache = snap.val() || {};
    renderProfile(); renderUsers();
  });
  onValue(ref(db, "verified"), snap => {
    verifiedMap = snap.val() || {};
    renderFeed(); renderProfile(); renderUsers();
  });
  onValue(ref(db, "posts"), snap => { postsCache = snap.val() || {}; renderFeed(); });
  onValue(ref(db, "likes"), snap => { likesCache = snap.val() || {}; renderFeed(); });
  onValue(ref(db, "tasks"), snap => {
    tasksCache = snap.val() || {};
    if (isAdmin) renderTasks();
  });
}

// ===== التبويبات =====
document.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".page").forEach(p =>
      p.classList.toggle("hidden", p.id !== "tab-" + btn.dataset.tab));
    if (btn.dataset.tab === "profile") $("edit-name").value = usersCache[currentUser.uid]?.name || "";
  };
});

// ===== المنشورات =====
$("post-text").oninput = e => {
  $("counter").textContent = `${e.target.value.length}/500`;
};

$("post-btn").onclick = async () => {
  const text = $("post-text").value.trim();
  const image = $("post-image").value.trim();
  if (!text && !image) return toast("اكتب شيئا أولا", true);
  if (image && !isUrl(image)) return toast("رابط الصورة غير صحيح", true);

  const btn = $("post-btn");
  btn.disabled = true;
  try {
    await push(ref(db, "posts"), {
      uid: currentUser.uid,
      authorName: usersCache[currentUser.uid]?.name || currentUser.displayName || "مستخدم",
      text,
      image,
      createdAt: Date.now()
    });
    $("post-text").value = "";
    $("post-image").value = "";
    $("counter").textContent = "0/500";
    toast("تم النشر");
  } catch {
    toast("فشل النشر", true);
  } finally {
    btn.disabled = false;
  }
};

function renderFeed() {
  if (!currentUser) return;
  const posts = Object.entries(postsCache).sort((a, b) => b[1].createdAt - a[1].createdAt);
  $("feed").innerHTML = posts.map(([id, p]) => {
    const likes = likesCache[id] || {};
    const count = Object.keys(likes).length;
    const liked = !!likes[currentUser.uid];
    const canDelete = isAdmin || p.uid === currentUser.uid;
    const img = p.image && isUrl(p.image) ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : "";
    return `
      <article class="glass card post">
        <div class="post-head">
          <div class="avatar">${esc((p.authorName || "?")[0])}</div>
          <div>
            <div class="name">${esc(p.authorName)}${verifiedMap[p.uid] ? badge : ""}</div>
            <div class="muted small">${timeAgo(p.createdAt)}</div>
          </div>
        </div>
        <p class="body">${esc(p.text)}</p>
        ${img}
        <div class="post-actions">
          <button class="btn shine like-btn ${liked ? "liked" : ""}" data-like="${id}"><svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9C1 8.6 3.1 5 6.6 5c2.1 0 3.6 1.2 4.4 2.5C11.8 6.2 13.3 5 15.4 5c3.5 0 5.6 3.6 4.2 7C19.5 16.4 12 21 12 21z"/></svg>${count}</button>
          ${canDelete ? `<button class="btn shine danger" data-del="${id}">حذف</button>` : ""}
        </div>
      </article>`;
  }).join("") || `<p class="muted center">لا توجد منشورات بعد</p>`;
}

$("feed").onclick = async e => {
  const likeBtn = e.target.closest("[data-like]");
  if (likeBtn) {
    const id = likeBtn.dataset.like;
    const likeRef = ref(db, `likes/${id}/${currentUser.uid}`);
    const liked = !!likesCache[id]?.[currentUser.uid];
    liked ? await remove(likeRef) : await set(likeRef, true);
    return;
  }
  const delBtn = e.target.closest("[data-del]");
  if (delBtn && confirm("حذف المنشور؟")) {
    await remove(ref(db, `posts/${delBtn.dataset.del}`));
    toast("تم الحذف");
  }
};

// ===== الملف الشخصي =====
function renderProfile() {
  if (!currentUser) return;
  const u = usersCache[currentUser.uid] || {};
  $("profile-card").innerHTML = `
    <div class="post-head">
      <div class="avatar big">${esc((u.name || "?")[0])}</div>
      <div>
        <div class="name" style="font-size:22px">${esc(u.name)}${verifiedMap[currentUser.uid] ? badge : ""}</div>
        <p class="muted small">${esc(u.email)}</p>
        ${isAdmin ? '<span class="pill on" style="margin-top:6px;display:inline-block">مدير</span>' : ""}
      </div>
    </div>`;
}

$("save-name").onclick = async () => {
  const name = $("edit-name").value.trim();
  if (!name) return;
  try {
    await update(ref(db, `users/${currentUser.uid}`), { name });
    await updateProfile(currentUser, { displayName: name });
    toast("تم حفظ الاسم");
  } catch {
    toast("فشل الحفظ", true);
  }
};

// ===== الأدمن: المستخدمون =====
$("user-search").oninput = () => renderUsers();

function renderUsers() {
  if (!isAdmin) return;
  const q = $("user-search").value.trim().toLowerCase();
  const list = Object.entries(usersCache)
    .filter(([, u]) => !q || (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q));
  $("users-list").innerHTML = list.map(([uid, u]) => {
    const verified = !!verifiedMap[uid];
    return `
      <div class="row">
        <div class="row-info">
          <div class="name">${esc(u.name)}${verified ? badge : ""}</div>
          <span class="muted small">${esc(u.email)}</span>
        </div>
        <button class="btn shine ${verified ? "" : "primary"}" data-verify="${uid}" data-on="${!verified}">
          ${verified ? "إلغاء التوثيق" : "توثيق"}
        </button>
      </div>`;
  }).join("") || `<p class="muted">لا يوجد مستخدمون</p>`;
}

$("users-list").onclick = async e => {
  const btn = e.target.closest("[data-verify]");
  if (!btn) return;
  const turnOn = btn.dataset.on === "true";
  try {
    await set(ref(db, `verified/${btn.dataset.verify}`), turnOn ? true : null);
    toast(turnOn ? "تم التوثيق" : "تم إلغاء التوثيق");
  } catch {
    toast("لا توجد صلاحية", true);
  }
};

// ===== الأدمن: الألوان =====
$("save-settings").onclick = async () => {
  try {
    await set(ref(db, "settings"), { bg: $("set-bg").value, accent: $("set-accent").value });
    toast("تم حفظ الألوان");
  } catch {
    toast("لا توجد صلاحية", true);
  }
};

// ===== الأدمن: المهام =====
$("task-form").onsubmit = async e => {
  e.preventDefault();
  const title = $("task-input").value.trim();
  if (!title) return;
  await push(ref(db, "tasks"), { title, done: false, createdAt: Date.now() });
  $("task-input").value = "";
};

function renderTasks() {
  const items = Object.entries(tasksCache).sort((a, b) => a[1].createdAt - b[1].createdAt);
  $("tasks-list").innerHTML = items.map(([id, t]) => `
    <div class="row">
      <label class="task-title">
        <input type="checkbox" data-task="${id}" ${t.done ? "checked" : ""}>
        <span class="${t.done ? "done" : ""}">${esc(t.title)}</span>
      </label>
      <button class="btn shine danger" data-tdel="${id}">حذف</button>
    </div>`).join("") || `<p class="muted">لا توجد مهام</p>`;
}

$("tasks-list").onclick = async e => {
  const del = e.target.closest("[data-tdel]");
  if (del) await remove(ref(db, `tasks/${del.dataset.tdel}`));
};
$("tasks-list").onchange = async e => {
  const cb = e.target.closest("[data-task]");
  if (cb) await update(ref(db, `tasks/${cb.dataset.task}`), { done: cb.checked });
};
