const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_PASS = defineSecret("GMAIL_PASS");

const CODE_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const cleanEmail = (e) => String(e || "").trim().toLowerCase();
const hashCode = (code, salt) =>
  crypto.createHash("sha256").update(salt + code).digest("hex");

function mailer() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER.value(), pass: GMAIL_PASS.value() },
  });
}

async function userExists(email) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch {
    return null;
  }
}

exports.sendCode = onCall({ secrets: [GMAIL_USER, GMAIL_PASS] }, async (req) => {
  const email = cleanEmail(req.data.email);
  const purpose = req.data.purpose;
  if (!/^\S+@\S+\.\S+$/.test(email) || !["verify", "reset"].includes(purpose)) {
    throw new HttpsError("invalid-argument", "بيانات غير صحيحة");
  }

  const user = await userExists(email);
  if (!user) return { ok: true };

  const ref = db.collection("otps").doc(`${purpose}:${email}`);
  const snap = await ref.get();
  if (snap.exists && Date.now() - snap.data().sentAt < COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "استنى دقيقة قبل ما تطلب كود تاني");
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString("hex");
  await ref.set({
    codeHash: hashCode(code, salt),
    salt,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
    sentAt: Date.now(),
  });

  const subject = purpose === "verify" ? "تفعيل حسابك" : "استرداد كلمة السر";
  await mailer().sendMail({
    from: `"Nexus" <${GMAIL_USER.value()}>`,
    to: email,
    subject,
    html: `
      <div dir="rtl" style="font-family:sans-serif">
        <h2>${subject}</h2>
        <p>الكود بتاعك:</p>
        <h1 style="letter-spacing:8px">${code}</h1>
        <p>الكود صالح 10 دقايق. لو مش انت اللي طلبته تجاهل الرسالة.</p>
      </div>`,
  });
  return { ok: true };
});

async function checkCode(ref, code) {
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "الكود غلط أو مش موجود");
  const d = snap.data();
  if (Date.now() > d.expiresAt) {
    throw new HttpsError("deadline-exceeded", "الكود انتهى، اطلب كود جديد");
  }
  if (d.attempts >= MAX_ATTEMPTS) {
    throw new HttpsError("resource-exhausted", "محاولات كتير، اطلب كود جديد");
  }
  if (hashCode(String(code), d.salt) !== d.codeHash) {
    await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new HttpsError("invalid-argument", "الكود غلط");
  }
}

exports.verifyEmail = onCall(async (req) => {
  const email = cleanEmail(req.data.email);
  const ref = db.collection("otps").doc(`verify:${email}`);
  await checkCode(ref, req.data.code);
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(user.uid, { emailVerified: true });
  await ref.delete();
  return { ok: true };
});

exports.resetPassword = onCall(async (req) => {
  const email = cleanEmail(req.data.email);
  const newPassword = String(req.data.newPassword || "");
  if (newPassword.length < 6) {
    throw new HttpsError("invalid-argument", "كلمة السر لازم 6 حروف على الأقل");
  }
  const ref = db.collection("otps").doc(`reset:${email}`);
  await checkCode(ref, req.data.code);
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(user.uid, { password: newPassword });
  await ref.delete();
  return { ok: true };
});

exports.setAdmin = onCall(async (req) => {
  if (req.auth?.token?.admin !== true) {
    throw new HttpsError("permission-denied", "مش مسموح");
  }
  const user = await admin.auth().getUserByEmail(cleanEmail(req.data.email));
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  return { ok: true };
});
