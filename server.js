const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "";
if (SECRET.length < 32) {
  console.error("JWT_SECRET لازم يكون 32 حرف على الأقل في ملف .env");
  process.exit(1);
}

const DB_FILE = path.join(__dirname, "data", "db.json");
const CODE_TTL = 10 * 60 * 1000;
const COOLDOWN = 60 * 1000;
const MAX_ATTEMPTS = 5;
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_SETTINGS = {
  primaryColor: "#4f46e5",
  backgroundColor: "#0f172a",
  backgroundImage: "",
};

// ---------- تخزين بسيط في ملف JSON ----------
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { users: {}, codes: {}, settings: { ...DEFAULT_SETTINGS } };
  }
}
const db = loadDb();
db.users ||= {};
db.codes ||= {};
db.settings ||= { ...DEFAULT_SETTINGS };

function save() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---------- أدوات مساعدة ----------
function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const cleanEmail = (e) => String(e || "").trim().toLowerCase();
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(":");
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), test);
}

// توكن موقّع بـ HMAC (بدون مكتبات إضافية)
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function readToken(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  return p.exp > Date.now() ? p : null;
}

function isAdmin(user) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return user.isAdmin === true || list.includes(user.email);
}

function publicUser(u) {
  return { email: u.email, name: u.name || "", isAdmin: isAdmin(u) };
}

// ---------- الإيميل ----------
const transporter =
  process.env.GMAIL_USER && process.env.GMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
      })
    : null;

async function sendCodeEmail(to, subject, code) {
  if (!transporter) {
    console.log(`[DEV] ${subject} -> ${to} | الكود: ${code}`);
    return;
  }
  await transporter.sendMail({
    from: `"Nexus" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html: `<div dir="rtl" style="font-family:sans-serif">
      <h2>${subject}</h2>
      <p>الكود بتاعك:</p>
      <h1 style="letter-spacing:8px">${code}</h1>
      <p>الكود صالح 10 دقايق. لو مش انت اللي طلبته تجاهل الرسالة.</p>
    </div>`,
  });
}

// ---------- الأكواد ----------
async function issueCode(email, purpose) {
  const key = `${purpose}:${email}`;
  const prev = db.codes[key];
  if (prev && Date.now() - prev.sentAt < COOLDOWN) {
    throw httpErr(429, "استنى دقيقة قبل ما تطلب كود تاني");
  }
  const code = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString("hex");
  db.codes[key] = {
    hash: sha(salt + code),
    salt,
    expiresAt: Date.now() + CODE_TTL,
    attempts: 0,
    sentAt: Date.now(),
  };
  save();
  const subject = purpose === "verify" ? "تفعيل حسابك" : "استرداد كلمة السر";
  await sendCodeEmail(email, subject, code);
}

function checkCode(email, purpose, code) {
  const key = `${purpose}:${email}`;
  const c = db.codes[key];
  if (!c) throw httpErr(400, "الكود غلط أو مش موجود");
  if (Date.now() > c.expiresAt) {
    delete db.codes[key];
    save();
    throw httpErr(400, "الكود انتهى، اطلب كود جديد");
  }
  if (c.attempts >= MAX_ATTEMPTS) {
    throw httpErr(429, "محاولات كتير، اطلب كود جديد");
  }
  if (sha(c.salt + String(code || "")) !== c.hash) {
    c.attempts += 1;
    save();
    throw httpErr(400, "الكود غلط");
  }
  delete db.codes[key];
  save();
}

// ---------- Middleware ----------
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ error: e.status ? e.message : "حصل خطأ في السيرفر" });
  });

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  const payload = readToken(token);
  const user = payload && db.users[payload.sub];
  if (!user) return res.status(401).json({ error: "سجل دخول الأول" });
  req.user = user;
  next();
}
function adminOnly(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: "مش مسموح" });
  next();
}

// ---------- Routes ----------
app.get("/api/health", (req, res) => res.json({ ok: true }));

// إنشاء حساب + إرسال كود التفعيل
app.post("/api/register", wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || "");
  const name = String(req.body.name || "").trim().slice(0, 50);
  if (!isEmail(email)) throw httpErr(400, "الإيميل مش صحيح");
  if (password.length < 6) throw httpErr(400, "كلمة السر لازم 6 حروف على الأقل");

  const existing = db.users[email];
  if (existing && existing.verified) throw httpErr(409, "الإيميل ده مسجل قبل كده");

  db.users[email] = {
    email,
    name,
    passwordHash: hashPassword(password),
    verified: false,
    createdAt: Date.now(),
  };
  save();
  await issueCode(email, "verify");
  res.json({ ok: true, message: "اتبعت كود التفعيل على الإيميل" });
}));

// تفعيل الإيميل بالكود
app.post("/api/verify", wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const user = db.users[email];
  if (!user) throw httpErr(400, "الكود غلط أو مش موجود");
  checkCode(email, "verify", req.body.code);
  user.verified = true;
  save();
  res.json({ ok: true });
}));

// إعادة إرسال كود التفعيل
app.post("/api/resend-verify", wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  if (db.users[email] && !db.users[email].verified) await issueCode(email, "verify");
  res.json({ ok: true });
}));

// تسجيل الدخول
app.post("/api/login", wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || "");
  const user = db.users[email];
  if (!user || !checkPassword(password, user.passwordHash)) {
    throw httpErr(401, "الإيميل أو كلمة السر غلط");
  }
  if (!user.verified) throw httpErr(403, "لازم تفعّل الإيميل الأول");

  const token = signToken({ sub: email, exp: Date.now() + TOKEN_TTL });
  res.json({ ok: true, token, user: publicUser(user) });
}));

// نسيت كلمة السر: إرسال كود (الرد واحد سواء الإيميل موجود أو لأ)
app.post("/api/forgot", wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  if (db.users[email] && db.users[email].verified) await issueCode(email, "reset");
  res.json({ ok: true, message: "لو الإيميل مسجل هيوصلك كود" });
}));

// تغيير كلمة السر بالكود
app.post("/api/reset", wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const newPassword = String(req.body.newPassword || "");
  if (newPassword.length < 6) throw httpErr(400, "كلمة السر لازم 6 حروف على الأقل");
  const user = db.users[email];
  if (!user) throw httpErr(400, "الكود غلط أو مش موجود");
  checkCode(email, "reset", req.body.code);
  user.passwordHash = hashPassword(newPassword);
  save();
  res.json({ ok: true });
}));

// بيانات المستخدم الحالي
app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

// إعدادات الموقع (عامة، أي زائر يشوفها)
app.get("/api/settings", (req, res) => res.json(db.settings));

// تعديل شكل الموقع (أدمن بس)
app.put("/api/admin/settings", auth, adminOnly, (req, res) => {
  const { primaryColor, backgroundColor, backgroundImage } = req.body;
  if (primaryColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) throw httpErr(400, "اللون لازم يكون بصيغة #RRGGBB");
    db.settings.primaryColor = primaryColor;
  }
  if (backgroundColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(backgroundColor)) throw httpErr(400, "اللون لازم يكون بصيغة #RRGGBB");
    db.settings.backgroundColor = backgroundColor;
  }
  if (backgroundImage !== undefined) {
    const url = String(backgroundImage);
    if (url !== "" && !/^https:\/\/\S+$/.test(url)) throw httpErr(400, "رابط الصورة لازم يبدأ بـ https://");
    db.settings.backgroundImage = url;
  }
  save();
  res.json({ ok: true, settings: db.settings });
});

// ترقية مستخدم لأدمن (أدمن بس)
app.post("/api/admin/promote", auth, adminOnly, wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const user = db.users[email];
  if (!user) throw httpErr(404, "المستخدم مش موجود");
  user.isAdmin = true;
  save();
  res.json({ ok: true });
}));

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => res.status(404).json({ error: "مش موجود" }));

app.listen(PORT, () => console.log(`Nexus backend on http://localhost:${PORT}`));
