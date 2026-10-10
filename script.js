import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ===== إعدادات Supabase =====
// Project Settings > API
// المفتاح ده (anon / publishable) آمن يبقى ظاهر. ماتحطش أبداً service_role.
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-OR-PUBLISHABLE-KEY';

const CONFIG_OK = !SUPABASE_URL.includes('YOUR-') && !SUPABASE_ANON_KEY.includes('YOUR-');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== أدوات مساعدة =====
const $ = (selector) => document.querySelector(selector);
const msg = $('#message');

const views = {
  login: $('#view-login'),
  recover: $('#view-recover'),
  home: $('#view-home'),
};

function showView(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
  showMessage('');
}

function showMessage(text, type = 'error') {
  msg.textContent = text;
  msg.className = `message ${type}`;
  msg.hidden = !text;
}

function friendlyError(err) {
  const raw = err?.message || '';
  const text = raw.toLowerCase();
  if (!CONFIG_OK) return 'لازم تحط SUPABASE_URL و SUPABASE_ANON_KEY في script.js الأول.';
  if (text.includes('failed to fetch') || text.includes('networkerror') || text.includes('load failed')) {
    return 'ما قدرتش أوصل لسيرفر Supabase. اتأكد من الرابط والمفتاح في script.js، والإنترنت شغال.';
  }
  if (text.includes('invalid login credentials')) return 'الإيميل أو كلمة السر غلط.';
  if (text.includes('expired') || text.includes('invalid')) return 'الكود غلط أو انتهت صلاحيته، اطلب كود جديد.';
  if (text.includes('seconds') || text.includes('rate limit') || text.includes('security purposes')) {
    return 'استنى شوية قبل ما تطلب كود تاني.';
  }
  if (text.includes('password should be')) return 'كلمة السر لازم تكون 6 حروف على الأقل.';
  if (text.includes('email')) return 'تأكد من الإيميل وجرب تاني.';
  return `حصلت مشكلة: ${raw || 'غير معروف'}`;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSixDigits(code) {
  return /^\d{6}$/.test(code);
}

function setBusy(button, busy, busyText = 'استنى...') {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.label;
}

// يقفل الزرار ويعد تنازلي عشان ما حدش يبعت كود كتير
function startCooldown(button, seconds = 60) {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = true;
  let left = seconds;
  const tick = () => {
    if (left <= 0) {
      button.disabled = false;
      button.textContent = button.dataset.label;
      return;
    }
    button.textContent = `استنى ${left} ثانية`;
    left -= 1;
    setTimeout(tick, 1000);
  };
  tick();
}

// ===== تسجيل الدخول بالكود =====
let loginEmail = '';

const emailForm = $('#email-form');
const emailInput = $('#email-input');
const sendCodeBtn = $('#send-code-btn');
const codeForm = $('#code-form');
const codeInput = $('#code-input');
const verifyBtn = $('#verify-btn');
const resendBtn = $('#resend-btn');
const backBtn = $('#back-btn');

function showCodeStep(show) {
  codeForm.hidden = !show;
  emailForm.hidden = show;
}

async function requestLoginCode(email) {
  // أول مرة الإيميل يدخل، Supabase بيعمل حساب تلقائي
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  if (!isValidEmail(email)) return showMessage('اكتب إيميل صحيح');

  setBusy(sendCodeBtn, true);
  try {
    await requestLoginCode(email);
    loginEmail = email;
    showCodeStep(true);
    showMessage('اتبعتلك كود على إيميلك، اكتبه هنا.', 'success');
    startCooldown(resendBtn);
  } catch (err) {
    showMessage(friendlyError(err));
  } finally {
    setBusy(sendCodeBtn, false);
  }
});

resendBtn.addEventListener('click', async () => {
  try {
    await requestLoginCode(loginEmail);
    showMessage('اتبعت كود جديد.', 'success');
    startCooldown(resendBtn);
  } catch (err) {
    showMessage(friendlyError(err));
  }
});

codeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = codeInput.value.trim();
  if (!isSixDigits(token)) return showMessage('الكود لازم يكون 6 أرقام');

  setBusy(verifyBtn, true);
  try {
    const { error } = await supabase.auth.verifyOtp({ email: loginEmail, token, type: 'email' });
    if (error) throw error;
    // onAuthStateChange هيوديك للصفحة الرئيسية
  } catch (err) {
    showMessage(friendlyError(err));
  } finally {
    setBusy(verifyBtn, false);
  }
});

backBtn.addEventListener('click', () => {
  showCodeStep(false);
  showMessage('');
});

// ===== تسجيل الدخول بكلمة السر =====
const passwordForm = $('#password-form');
const pwEmail = $('#pw-email');
const pwInput = $('#pw-input');
const pwBtn = $('#pw-btn');

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = pwEmail.value.trim().toLowerCase();
  if (!isValidEmail(email)) return showMessage('اكتب إيميل صحيح');

  setBusy(pwBtn, true);
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwInput.value });
    if (error) throw error;
  } catch (err) {
    showMessage(friendlyError(err));
  } finally {
    setBusy(pwBtn, false);
  }
});

// ===== التبويب بين الكود وكلمة السر =====
const tabCode = $('#tab-code');
const tabPassword = $('#tab-password');

function switchTab(toPassword) {
  $('#code-login').hidden = toPassword;
  passwordForm.hidden = !toPassword;
  tabCode.classList.toggle('active', !toPassword);
  tabPassword.classList.toggle('active', toPassword);
  showMessage('');
}

tabCode.addEventListener('click', () => switchTab(false));
tabPassword.addEventListener('click', () => switchTab(true));

// ===== استرجاع الحساب =====
let recoverEmail = '';

const recoverEmailForm = $('#recover-email-form');
const recoverEmailInput = $('#recover-email');
const recoverSendBtn = $('#recover-send-btn');
const recoverResetForm = $('#recover-reset-form');
const recoverCodeInput = $('#recover-code');
const newPwInput = $('#new-password');
const confirmPwInput = $('#confirm-password');
const recoverResetBtn = $('#recover-reset-btn');
const recoverResendBtn = $('#recover-resend-btn');

function showRecoverStep(show) {
  recoverResetForm.hidden = !show;
  recoverEmailForm.hidden = show;
}

async function requestRecoveryCode(email) {
  // ماينفعش نقول إن الإيميل موجود ولا لأ، عشان ما نكشفش الحسابات
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

$('#go-recover').addEventListener('click', () => {
  showRecoverStep(false);
  showView('recover');
});

$('#back-login').addEventListener('click', () => {
  showView('login');
});

recoverEmailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = recoverEmailInput.value.trim().toLowerCase();
  if (!isValidEmail(email)) return showMessage('اكتب إيميل صحيح');

  setBusy(recoverSendBtn, true);
  try {
    await requestRecoveryCode(email);
    recoverEmail = email;
    showRecoverStep(true);
    showMessage('لو الإيميل مسجل، هيوصلك كود استرجاع. اكتبه تحت.', 'success');
    startCooldown(recoverResendBtn);
  } catch (err) {
    showMessage(friendlyError(err));
  } finally {
    setBusy(recoverSendBtn, false);
  }
});

recoverResendBtn.addEventListener('click', async () => {
  try {
    await requestRecoveryCode(recoverEmail);
    showMessage('اتبعت كود جديد.', 'success');
    startCooldown(recoverResendBtn);
  } catch (err) {
    showMessage(friendlyError(err));
  }
});

recoverResetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = recoverCodeInput.value.trim();
  const password = newPwInput.value;

  if (!isSixDigits(token)) return showMessage('الكود لازم يكون 6 أرقام');
  if (password.length < 6) return showMessage('كلمة السر لازم تكون 6 حروف على الأقل');
  if (password !== confirmPwInput.value) return showMessage('كلمتين السر مش متطابقين');

  setBusy(recoverResetBtn, true);
  try {
    // الكود بيسجّل الدخول مؤقتاً، وبعدين نغيّر كلمة السر
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: recoverEmail,
      token,
      type: 'recovery',
    });
    if (verifyError) throw verifyError;

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;

    showMessage('اتغيرت كلمة السر بنجاح.', 'success');
  } catch (err) {
    showMessage(friendlyError(err));
  } finally {
    setBusy(recoverResetBtn, false);
  }
});

// ===== الصفحة الرئيسية =====
const userEmail = $('#user-email');
const setPwForm = $('#set-password-form');
const setPwInput = $('#set-password');
const setPwBtn = $('#set-password-btn');

setPwForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = setPwInput.value;
  if (password.length < 6) return showMessage('كلمة السر لازم تكون 6 حروف على الأقل');

  setBusy(setPwBtn, true);
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setPwInput.value = '';
    showMessage('اتحفظت كلمة السر. دلوقتي تقدر تدخل بيها أو بالكود.', 'success');
  } catch (err) {
    showMessage(friendlyError(err));
  } finally {
    setBusy(setPwBtn, false);
  }
});

$('#logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

// ===== حالة الجلسة =====
function renderSession(session) {
  if (session) {
    userEmail.textContent = session.user.email;
    showView('home');
  } else {
    showView('login');
  }
}

if (!CONFIG_OK) {
  showView('login');
  showMessage('لازم تحط SUPABASE_URL و SUPABASE_ANON_KEY في script.js الأول.');
} else {
  try {
    const { data: initial } = await supabase.auth.getSession();
    renderSession(initial.session);
  } catch (err) {
    showView('login');
    showMessage(friendlyError(err));
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') return showView('login');
  if (session) renderSession(session);
});
