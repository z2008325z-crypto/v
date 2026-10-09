# Nexus Backend

باك اند بسيط: تسجيل حساب، تفعيل بكود على الإيميل، تسجيل دخول، نسيت كلمة السر، وإعدادات أدمن للشكل.

## التشغيل
1. Node.js 20.6 أو أحدث.
2. `cp .env.example .env` وغيّر `JWT_SECRET` (32 حرف على الأقل).
3. `npm install`
4. `npm start`

من غير GMAIL في `.env` الكود بيتطبع في الـ Terminal (وضع تجربة).
لإرسال حقيقي ضع `GMAIL_USER` و`GMAIL_PASS` (App Password من Google).

## الـ API

| Method | Route | Body | ملاحظات |
|---|---|---|---|
| POST | /api/register | email, password, name | يبعت كود تفعيل |
| POST | /api/verify | email, code | يفعّل الحساب |
| POST | /api/resend-verify | email | |
| POST | /api/login | email, password | يرجع token |
| POST | /api/forgot | email | يبعت كود استرداد |
| POST | /api/reset | email, code, newPassword | |
| GET | /api/me | Header: Authorization: Bearer TOKEN | |
| GET | /api/settings | | شكل الموقع للزوار |
| PUT | /api/admin/settings | primaryColor, backgroundColor, backgroundImage | أدمن بس |
| POST | /api/admin/promote | email | أدمن بس |

## أمثلة تجربة (curl)
```bash
curl -X POST localhost:3000/api/register -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"123456","name":"Ahmed"}'

# خد الكود من الـ Terminal
curl -X POST localhost:3000/api/verify -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","code":"123456"}'

curl -X POST localhost:3000/api/login -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"123456"}'

curl localhost:3000/api/settings

curl -X PUT localhost:3000/api/admin/settings -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"primaryColor":"#ff0066","backgroundImage":"https://example.com/bg.jpg"}'
```

## الأدمن
الإيميلات اللي في `ADMIN_EMAILS` بتبقى أدمن تلقائيًا. أدمن جديد يتضاف من `/api/admin/promote`.

## ملاحظات
- التخزين في `data/db.json` للتجربة. للإنتاج استخدم قاعدة بيانات.
- `.env` و`data/` مش هيتعملهم push على GitHub (موجودين في .gitignore).
