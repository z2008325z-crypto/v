# Nexus XO

## الإعداد
1. Firebase Console: فعّل Authentication (Email/Password)، وFirestore، وخطة Blaze.
2. أضف تطبيق Web واملأ apiKey و appId في public/index.html.
3. خزّن الأسرار:
   firebase functions:secrets:set GMAIL_USER
   firebase functions:secrets:set GMAIL_PASS
4. ثبّت الاعتماديات: cd functions && npm install && cd ..
5. انشر: firebase deploy

## أول أدمن
ضع serviceAccount.json داخل functions/ ثم:
   cd functions && node make-admin.js you@example.com

## ملاحظات أمان
- لا ترفع serviceAccount.json ولا كلمات السر على GitHub.
- قيّد الـ API key بالدومين من Google Cloud Console.
