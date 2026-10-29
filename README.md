# Campus Arena — Firebase Starter

## ပါဝင်သောဖိုင်များ
- `index.html` — User View
- `admin.html` — Admin View
- `styles.css` — Responsive design
- `app.js` — Public matches + automatic football standings
- `admin.js` — Login, add/edit/delete matches
- `firebase-config.js` — Firebase Web App config
- `firestore.rules` — Admin-only write security rules

## A. Firebase project ပြုလုပ်ရန်
1. Safari မှ https://console.firebase.google.com ကိုဖွင့်ပြီး Google account ဖြင့် ဝင်ပါ။
2. **Create a project** ကိုနှိပ်ပြီး `Campus Arena` ဟု နာမည်ပေးပါ။
3. Project Overview မှ Web `</>` icon ကိုနှိပ်ပြီး Web App register လုပ်ပါ။
4. Firebase config object ထဲက `apiKey`, `authDomain`, `projectId`, `appId` တန်ဖိုးတွေကို `firebase-config.js` ထဲမှာ အစားထိုးပါ။ Config ကို HTML/JS ထဲထည့်တာက ပုံမှန်ဖြစ်ပြီး database လုံခြုံရေးကို Rules က ကာကွယ်ပေးရပါမယ်။ Service-account/private key ကို browser code ထဲ လုံးဝမထည့်ပါနဲ့။

## B. Authentication ဖွင့်ရန်
1. Firebase Console > **Build > Authentication** > **Get started** ကိုနှိပ်ပါ။
2. **Sign-in method** ထဲက **Email/Password** ကို Enable လုပ်ပြီး Save ပါ။
3. **Users** tab မှ **Add user** ကိုနှိပ်ပြီး ကိုယ့် Admin email/password နဲ့ user တစ်ခု ဖန်တီးပါ။
4. Users စာရင်းထဲက အဲဒီ account ရဲ့ **UID** ကို copy လုပ်ထားပါ။

## C. Firestore database နဲ့ security rules
1. **Build > Firestore Database** > **Create database** ကိုနှိပ်ပါ။
2. Production mode ကိုရွေးပါ (နောက်တစ်ဆင့် Rules ကို အောက်က code နဲ့ အစားထိုးမယ်)။
3. **Rules** tab ထဲက လက်ရှိ rules အားလုံးကို `firestore.rules` ဖိုင်ထဲက code နဲ့ အစားထိုးပြီး **Publish** လုပ်ပါ။
4. **Data** tab > **Start collection** > Collection ID `admins` ထည့်ပါ။
5. Document ID နေရာမှာ အဆင့် B မှာ ကူးထားတဲ့ Admin **UID အတိအကျ** ထည့်ပါ။
6. Field ထည့်ပါ: `active` (Boolean) = `true`။ Save လုပ်ပါ။
   - ဒီ admin record ကို app မှာ create မလုပ်နိုင်ပါ။ Firebase Console မှာပဲ ဖန်တီးရပါမယ်။
   - Admin အသစ်ထပ်ထည့်ရင် Authentication user တစ်ခုဖန်တီးပြီး UID နဲ့ `admins/{UID}` document ထပ်ထည့်ပါ။
   - Admin ပိတ်ချင်ရင် `active` ကို `false` ပြောင်းပါ၊ သို့မဟုတ် admin document ကိုဖျက်ပါ။

## D. Hosting
အလွယ်ဆုံးက Firebase Hosting ပါ။ GitHub Pages/Netlify လို static hosting ကိုလည်း သုံးနိုင်ပါတယ်။
### iPad နဲ့ GitHub Pages (CLI မလို)
1. GitHub မှာ repository အသစ်ဖန်တီးပါ (ဥပမာ `campus-arena`)။
2. ဒီ ZIP ထဲက ဖိုင်အားလုံးကို repository root ထဲ upload လုပ်ပါ။ `index.html` root မှာ ရှိရပါမယ်။
3. `firebase-config.js` ထဲမှာ ကိုယ့် config အမှန် ထည့်ထားပြီး commit လုပ်ပါ။
4. Repository **Settings > Pages** > Build and deployment > Deploy from a branch ကိုရွေးပါ။ Branch `main`, folder `/(root)` ကိုရွေးပြီး Save လုပ်ပါ။
5. Public URL ပေါ်လာရင် User View ဖြစ်ပါတယ်။ အဲဒီ URL နောက်မှာ `/admin.html` ထည့်ရင် Admin Login page ဖြစ်ပါတယ်။
6. Firebase Console > Authentication > Settings > Authorized domains ထဲမှာ GitHub Pages domain ကို လိုအပ်ပါက ထည့်ပါ။ (ဥပမာ `username.github.io`; ကိုယ့် domain အမှန်ကို သုံးပါ။)

> GitHub Pages မှာ `admin.html` ကို လူတိုင်းဖွင့်နိုင်တာ ပုံမှန်ပါ။ လုံခြုံရေးက login UI ကိုဖုံးထားခြင်းတစ်ခုတည်း မဟုတ်ဘဲ Firebase Authentication + Firestore Rules ဖြစ်ပါတယ်။

## E. Test
1. User URL ဖွင့်ပြီး ပွဲမရှိသေးကြောင်းပြမယ်။
2. `/admin.html` ဖွင့်ပြီး Admin email/password နဲ့ login ဝင်ပါ။
3. Match form ထဲမှာ sport, title, teams, kickoff ထည့်ပါ။
4. Scheduled ပွဲအတွက် score ကို အလွတ်ထားနိုင်ပါတယ်။ Finished ပွဲအတွက် score နှစ်ဖက်လုံး ထည့်ပါ။
5. Save လုပ်ပါ။ User View ကို ပြန်ဖွင့်ကြည့်ပါ — data ပြောင်းလဲလာပါမယ်။
6. Finished Football matches တွေမှ standings ကို အလိုအလျောက်တွက်ပါမယ်: Win = 3, Draw = 1, Loss = 0. Esports ကို Football standings ထဲ မထည့်ပါ။

## မှတ်ချက်များ
- `firebase-config.js` သည် public web config ဖြစ်ပါတယ်။ Password, service-account key, private API secrets မထည့်ပါနှင့်။
- `firestore.rules` ကို `allow read, write: if true;` လို့ မပြောင်းပါနဲ့။
- ဒီ starter မှာ Football standings ကို played finished football matches မှတွက်သည်။ Esports results ကို match cards မှာပြသည်။
- Hosting/Firebase service တွေကို Myanmar ကနေ VPN မလိုဘဲ အမြဲရမယ်လို့ အာမမခံနိုင်ပါ။ တင်ပြီးနောက် VPN မပါဘဲ User/Admin URLs နှစ်ခုလုံးကို စမ်းသပ်ပါ။
- Production အတွက် rate limits, audit logs, stronger field validation, backups, and admin recovery procedure တို့ကို ထပ်တိုးစဉ်းစားပါ။
