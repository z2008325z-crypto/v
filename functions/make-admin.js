// شغّله مرة واحدة محليًا: node make-admin.js you@example.com
// محتاج serviceAccount.json (لا ترفعه على GitHub)
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccount.json")) });
const email = process.argv[2];
admin.auth().getUserByEmail(email)
  .then((u) => admin.auth().setCustomUserClaims(u.uid, { admin: true }))
  .then(() => console.log("done:", email))
  .catch(console.error);
