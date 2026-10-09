const $ = (id) => document.getElementById(id);
let token = localStorage.getItem("nexus_token") || "";
let currentUser = null;
let pending = { email: "", purpose: "" };

class ApiError extends Error {}

async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(data.error || "حصل خطأ");
    err.status = res.status;
    throw err;
  }
  return data;
}

function say(text, isError = false) {
  const m = $("msg");
  m.textContent = text;
  m.className = "msg " + (isError ? "error" : "ok");
}

function showOnly(id) {
  ["authScreen", "codeScreen", "gameScreen", "adminScreen"].forEach((s) =>
    $(s).classList.toggle("hidden", s !== id)
  );
  const inApp = id === "gameScreen" || id === "adminScreen";
  $("topbar").classList.toggle("hidden", !inApp);
}

function showForm(name) {
  ["loginForm", "registerForm", "forgotForm"].forEach((f) =>
    $(f).classList.toggle("hidden", f !== name + "Form")
  );
}

function applySettings(s) {
  const st = document.documentElement.style;
  st.setProperty("--primary", s.primaryColor);
  st.setProperty("--bg", s.backgroundColor);
  const img = (s.backgroundImage || "").replace(/["\\()]/g, "");
  document.body.style.backgroundImage = img ? `url("${img}")` : "";
}

function openCode(title, withNewPass) {
  $("codeTitle").textContent = title;
  $("newPasswordInput").classList.toggle("hidden", !withNewPass);
  $("codeInput").value = "";
  $("newPasswordInput").value = "";
  showOnly("codeScreen");
}

// ---------- التنقل بين الفورمات ----------
document.querySelectorAll("[data-go]").forEach((b) =>
  b.addEventListener("click", () => {
    showOnly("authScreen");
    showForm(b.dataset.go);
    say("");
  })
);

// ---------- تسجيل الدخول ----------
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: { email, password: $("loginPassword").value },
    });
    token = data.token;
    localStorage.setItem("nexus_token", token);
    currentUser = data.user;
    enterApp();
  } catch (err) {
    if (err.status === 403) {
      await api("/api/resend-verify", { method: "POST", body: { email } }).catch(() => {});
      pending = { email, purpose: "verify" };
      openCode("تفعيل الحساب", false);
      say("لازم تفعّل الإيميل، بعتنالك كود جديد", true);
    } else {
      say(err.message, true);
    }
  }
});

// ---------- إنشاء حساب ----------
$("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("regEmail").value.trim();
  try {
    await api("/api/register", {
      method: "POST",
      body: { name: $("regName").value, email, password: $("regPassword").value },
    });
    pending = { email, purpose: "verify" };
    openCode("تفعيل الحساب", false);
    say("اتبعت كود التفعيل على إيميلك");
  } catch (err) {
    say(err.message, true);
  }
});

// ---------- نسيت كلمة السر ----------
$("forgotForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("forgotEmail").value.trim();
  try {
    await api("/api/forgot", { method: "POST", body: { email } });
    pending = { email, purpose: "reset" };
    openCode("استرداد كلمة السر", true);
    say("لو الإيميل مسجل هيوصلك كود");
  } catch (err) {
    say(err.message, true);
  }
});

// ---------- تأكيد الكود ----------
$("codeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("codeInput").value.trim();
  try {
    let successMsg;
    if (pending.purpose === "verify") {
      await api("/api/verify", { method: "POST", body: { email: pending.email, code } });
      successMsg = "تم تفعيل الحساب، سجل دخول";
    } else {
      await api("/api/reset", {
        method: "POST",
        body: { email: pending.email, code, newPassword: $("newPasswordInput").value },
      });
      successMsg = "تم تغيير كلمة السر، سجل دخول";
    }
    $("loginEmail").value = pending.email;
    showOnly("authScreen");
    showForm("login");
    say(successMsg);
  } catch (err) {
    say(err.message, true);
  }
});

$("resendBtn").addEventListener("click", async () => {
  try {
    if (pending.purpose === "verify") {
      await api("/api/resend-verify", { method: "POST", body: { email: pending.email } });
    } else {
      await api("/api/forgot", { method: "POST", body: { email: pending.email } });
    }
    say("اتبعت كود جديد");
  } catch (err) {
    say(err.message, true);
  }
});

// ---------- الخروج ----------
$("logoutBtn").addEventListener("click", () => {
  token = "";
  currentUser = null;
  localStorage.removeItem("nexus_token");
  showOnly("authScreen");
  showForm("login");
  say("");
});

// ---------- لعبة الذاكرة ----------
const EMOJIS = ["🍎", "🍌", "🍇", "🍓", "🍒", "🍑", "🥝", "🍍"];
let cards = [];
let opened = [];
let matches = 0;
let moves = 0;
let seconds = 0;
let locked = false;
let timer = null;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function updateStats() {
  $("moves").textContent = moves;
  $("time").textContent = seconds;
}

function renderBoard() {
  $("board").innerHTML = cards
    .map((c) => {
      const show = c.open || c.done;
      return `<button class="card${c.done ? " done" : ""}" data-id="${c.id}">${show ? c.emoji : "?"}</button>`;
    })
    .join("");
}

function startGame() {
  clearInterval(timer);
  timer = null;
  seconds = 0;
  moves = 0;
  matches = 0;
  opened = [];
  locked = false;
  cards = shuffle(
    [...EMOJIS, ...EMOJIS].map((emoji, id) => ({ id, emoji, open: false, done: false }))
  );
  $("status").textContent = "";
  updateStats();
  renderBoard();
}

function win() {
  clearInterval(timer);
  timer = null;
  $("status").textContent = `🎉 خلصت في ${moves} حركة و${seconds} ثانية`;
}

$("board").addEventListener("click", (e) => {
  const btn = e.target.closest(".card");
  if (!btn || locked) return;
  const card = cards[Number(btn.dataset.id)];
  if (card.open || card.done) return;

  if (!timer) timer = setInterval(() => { seconds++; updateStats(); }, 1000);

  card.open = true;
  opened.push(card);
  renderBoard();

  if (opened.length === 2) {
    moves++;
    updateStats();
    locked = true;
    const [a, b] = opened;
    if (a.emoji === b.emoji) {
      a.open = b.open = false;
      a.done = b.done = true;
      matches++;
      opened = [];
      locked = false;
      renderBoard();
      if (matches === EMOJIS.length) win();
    } else {
      setTimeout(() => {
        a.open = b.open = false;
        opened = [];
        locked = false;
        renderBoard();
      }, 800);
    }
  }
});

$("restartBtn").addEventListener("click", startGame);

// ---------- لوحة الأدمن ----------
$("adminBtn").addEventListener("click", async () => {
  try {
    const s = await api("/api/settings");
    $("primaryColor").value = s.primaryColor;
    $("backgroundColor").value = s.backgroundColor;
    $("backgroundImage").value = s.backgroundImage || "";
    showOnly("adminScreen");
    say("");
  } catch (err) {
    say(err.message, true);
  }
});

$("backToGame").addEventListener("click", () => showOnly("gameScreen"));

$("saveSettingsBtn").addEventListener("click", async () => {
  try {
    const data = await api("/api/admin/settings", {
      method: "PUT",
      body: {
        primaryColor: $("primaryColor").value,
        backgroundColor: $("backgroundColor").value,
        backgroundImage: $("backgroundImage").value.trim(),
      },
    });
    applySettings(data.settings);
    say("تم حفظ الشكل ✅");
  } catch (err) {
    say(err.message, true);
  }
});

$("promoteBtn").addEventListener("click", async () => {
  try {
    await api("/api/admin/promote", {
      method: "POST",
      body: { email: $("promoteEmail").value.trim() },
    });
    say("تمت ترقية المستخدم لأدمن ✅");
  } catch (err) {
    say(err.message, true);
  }
});

// ---------- الدخول للتطبيق ----------
function enterApp() {
  $("welcome").textContent = "أهلاً " + (currentUser.name || currentUser.email);
  $("adminBtn").classList.toggle("hidden", !currentUser.isAdmin);
  showOnly("gameScreen");
  startGame();
  say("");
}

async function init() {
  try {
    applySettings(await api("/api/settings"));
  } catch {}

  if (token) {
    try {
      currentUser = (await api("/api/me")).user;
      enterApp();
      return;
    } catch {
      token = "";
      localStorage.removeItem("nexus_token");
    }
  }
  showOnly("authScreen");
  showForm("login");
}

init();
