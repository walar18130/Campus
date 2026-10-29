import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = s => document.querySelector(s);
const loginPanel = $("#login-panel"), adminPanel = $("#admin-panel");
const loginMessage = $("#login-message"), formMessage = $("#form-message");
let db, auth, currentUser = null, matches = [], stopListening = null;
const validConfig = firebaseConfig.apiKey !== "PASTE_API_KEY" && firebaseConfig.projectId !== "PASTE_PROJECT_ID";

function message(el, text, error=false) { el.textContent = text; el.classList.toggle("error", error); }
function esc(value = "") { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
function toInputDate(value) {
  if (!value) return "";
  const d = value.toDate ? value.toDate() : new Date(value);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,16);
}
function resetForm() {
  $("#match-form").reset(); $("#match-id").value = ""; $("#form-title").textContent = "ပွဲစဉ်အသစ် ထည့်ရန်";
  $("#home-score").value = ""; $("#away-score").value = ""; message(formMessage, "");
}
function renderAdminMatches() {
  const root = $("#admin-matches");
  if (!matches.length) { root.innerHTML = `<p class="muted">ပွဲစဉ်မရှိသေးပါ။ ဘယ်ဘက် Form ကနေ ထည့်နိုင်ပါတယ်။</p>`; return; }
  root.innerHTML = matches.map(m => `<article class="admin-match">
    <div><span class="tag ${m.sport === "football" ? "tag-football" : "tag-esports"}">${m.sport === "football" ? "FOOTBALL" : "ESPORTS"}</span>
    <strong>${esc(m.homeTeam)} ${m.homeScore ?? "–"} : ${m.awayScore ?? "–"} ${esc(m.awayTeam)}</strong>
    <small>${esc(m.title)} • ${esc(m.status)}</small></div>
    <div class="button-row"><button class="button button-small button-outline" data-edit="${m.id}">Edit</button><button class="button button-small button-danger" data-delete="${m.id}">Delete</button></div>
  </article>`).join("");
  root.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => {
    const m = matches.find(x => x.id === btn.dataset.edit); if (!m) return;
    $("#match-id").value = m.id; $("#sport").value = m.sport; $("#game-title").value = m.title || "";
    $("#home-team").value = m.homeTeam; $("#away-team").value = m.awayTeam;
    $("#home-score").value = m.homeScore ?? ""; $("#away-score").value = m.awayScore ?? "";
    $("#kickoff").value = toInputDate(m.kickoff); $("#status").value = m.status || "scheduled";
    $("#form-title").textContent = "ပွဲစဉ် ပြင်ဆင်ရန်"; message(formMessage, "ပြင်ဆင်ပြီး သိမ်းမယ်ကို နှိပ်ပါ။");
    window.scrollTo({ top:0, behavior:"smooth" });
  }));
  root.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => {
    const m = matches.find(x => x.id === btn.dataset.delete); if (!m) return;
    if (!confirm(`${m.homeTeam} vs ${m.awayTeam} ပွဲစဉ်ကို ဖျက်မှာ သေချာပါသလား?`)) return;
    try { await deleteDoc(doc(db, "matches", m.id)); message(formMessage, "ပွဲစဉ် ဖျက်ပြီးပါပြီ။"); }
    catch (e) { console.error(e); message(formMessage, "ဖျက်မရပါ။ Admin permission / Rules ကိုစစ်ပါ။", true); }
  }));
}
if (!validConfig) message(loginMessage, "firebase-config.js ထဲမှာ Firebase config မထည့်ရသေးပါ။", true);
else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app); db = getFirestore(app);
  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault(); message(loginMessage, "Login စစ်ဆေးနေပါတယ်…");
    try { await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value); }
    catch (err) {
      console.error(err);
      message(loginMessage, "Login မအောင်မြင်ပါ။ Email/Password နဲ့ Firebase Authentication ကို စစ်ဆေးပါ။", true);
    }
  });
  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (stopListening) { stopListening(); stopListening = null; }
    if (!user) { loginPanel.hidden = false; adminPanel.hidden = true; return; }
    loginPanel.hidden = true; adminPanel.hidden = false;
    $("#signed-in-as").textContent = `Signed in: ${user.email || "Admin"}`;
    // Firestore Rules က admins/{uid} document ဖြင့် admin ခွင့်ကို အမှန်တကယ်စစ်ဆေးသည်။
    stopListening = onSnapshot(query(collection(db, "matches"), orderBy("kickoff", "asc")), snap => {
      matches = snap.docs.map(d => ({id:d.id, ...d.data()})); renderAdminMatches();
    }, err => {
      console.error(err); message(formMessage, "Admin access မရပါ။ admins/{UID} setup နဲ့ Firestore Rules ကို စစ်ပါ။", true);
      $("#admin-matches").textContent = "ခွင့်ပြုချက်မရှိပါ သို့မဟုတ် data မဖတ်နိုင်ပါ။";
    });
  });
  $("#logout-button").addEventListener("click", async () => { await signOut(auth); resetForm(); });
  $("#cancel-edit").addEventListener("click", resetForm);
  $("#match-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser) { message(formMessage, "အရင် Login ဝင်ပါ။", true); return; }
    const sport = $("#sport").value, title = $("#game-title").value.trim();
    const homeTeam = $("#home-team").value.trim(), awayTeam = $("#away-team").value.trim();
    const kickoffDate = new Date($("#kickoff").value);
    const status = $("#status").value;
    const hsText = $("#home-score").value, asText = $("#away-score").value;
    const homeScore = hsText === "" ? null : Number(hsText), awayScore = asText === "" ? null : Number(asText);
    if (!title || !homeTeam || !awayTeam || !$("#kickoff").value || Number.isNaN(kickoffDate.getTime())) { message(formMessage, "လိုအပ်သောအချက်အလက်အားလုံး ဖြည့်ပါ။", true); return; }
    if ((hsText === "") !== (asText === "")) { message(formMessage, "Score နှစ်ဖက်လုံး ထည့်ပါ၊ သို့မဟုတ် နှစ်ဖက်လုံး အလွတ်ထားပါ။", true); return; }
    if (status === "finished" && (homeScore === null || awayScore === null)) { message(formMessage, "ပြီးဆုံးသောပွဲအတွက် Score နှစ်ဖက်လုံး လိုအပ်ပါတယ်။", true); return; }
    const payload = { sport, title, homeTeam, awayTeam, homeScore, awayScore, kickoff:kickoffDate, status, updatedAt:serverTimestamp(), updatedBy:currentUser.uid };
    try {
      const id = $("#match-id").value;
      if (id) await updateDoc(doc(db, "matches", id), payload);
      else await addDoc(collection(db, "matches"), { ...payload, createdAt:serverTimestamp(), createdBy:currentUser.uid });
      resetForm(); message(formMessage, "Firebase မှာ သိမ်းဆည်းပြီးပါပြီ။ User View မှာလည်း အလိုအလျောက် ပြောင်းလဲပါမယ်။");
    } catch (err) {
      console.error(err);
      message(formMessage, "သိမ်းမရပါ။ Admin UID document နဲ့ Firestore Rules ကို စစ်ပါ။", true);
    }
  });
}