# موقع تسجيل الدخول بكود الإيميل

موقع static بيشتغل على GitHub Pages، والـ backend فيه Supabase.

## الملفات
- `index.html`: الصفحات الثلاثة (تسجيل الدخول، استرجاع الحساب، الصفحة الرئيسية)
- `script.js`: منطق الموقع وربط Supabase
- `style.css`: التصميم

## الإعداد
1. في `script.js` حط `SUPABASE_URL` و`SUPABASE_ANON_KEY` (من Project Settings > API).
2. في Supabase:
   - فعّل Email من Authentication > Providers.
   - في قالبي **Magic Link** و**Reset Password** حط `{{ .Token }}` (الكود) بدل الرابط.
   - من URL Configuration حط Site URL بتاع GitHub Pages، مثلاً `https://USERNAME.github.io/REPO/`.
   - خلي مدة صلاحية الكود 300 أو 600 ثانية من Email OTP expiration.
3. في GitHub: Settings > Pages > Deploy from a branch > main > /(root).

## ملاحظة
المفتاح اللي في `script.js` لازم يكون anon / publishable بس، ماتحطش أبداً service_role.
