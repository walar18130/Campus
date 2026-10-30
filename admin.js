import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocFromServer,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const $ = selector => document.querySelector(selector);

const loginPanel = $("#login-panel");
const adminPanel = $("#admin-panel");
const loginForm = $("#login-form");
const loginMessage = $("#login-message");
const formMessage = $("#form-message");
const adminMatches = $("#admin-matches");
const matchForm = $("#match-form");

function message(element, text, isError = false) {
  if (!element) return;
  element.textContent = text || "";
  element.classList.toggle("error", Boolean(isError));
}

function errorDetails(error) {
  return `${error?.code || "unknown"}: ${error?.message || String(error)}`;
}

function validConfig(config) {
  return ["apiKey", "authDomain", "projectId", "appId"].every(key =>
    typeof config?.[key] === "string" &&
    config[key].trim() !== "" &&
    !/your_|replace_me|placeholder/i.test(config[key])
  );
}

if (!validConfig(firebaseConfig)) {
  message(
    loginMessage,
    "firebase-config.js ထဲမှာ Firebase config အပြည့်အစုံ ထည့်ပါ။",
    true
  );
  throw new Error("Firebase configuration is missing.");
}

const APP_NAME = "CampusArenaAdmin";

const existingApp = getApps().find(
  item => item.name === APP_NAME
);

const app = existingApp || initializeApp(firebaseConfig, APP_NAME);

const auth = getAuth(app);
const db = getFirestore(app);

console.info("Firebase Project:", app.options.projectId);

let currentUser = null;
let matches = [];
let unsubscribeMatches = null;
let authGeneration = 0;

function setLoggedInUI(user) {
  if (loginPanel) loginPanel.hidden = Boolean(user);
  if (adminPanel) adminPanel.hidden = !user;

  const signedInAs = $("#signed-in-as");

  if (signedInAs) {
    signedInAs.textContent = user
      ? `Signed in: ${user.email || "Admin"}`
      : "";
  }
}

function stopMatchListener() {
  if (unsubscribeMatches) {
    unsubscribeMatches();
    unsubscribeMatches = null;
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function toInputDate(value) {
  if (!value) return "";

  const date = value.toDate
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}

function resetForm() {
  if (!matchForm) return;

  matchForm.reset();

  if ($("#match-id")) $("#match-id").value = "";
  if ($("#form-title")) {
    $("#form-title").textContent = "ပွဲစဉ်အသစ် ထည့်ရန်";
  }

  if ($("#home-score")) $("#home-score").value = "";
  if ($("#away-score")) $("#away-score").value = "";

  message(formMessage, "");
}

// Admin verification
async function verifyAdmin(user) {
  if (!user) {
    throw new Error("User is not authenticated.");
  }

  const projectId = firebaseConfig.projectId;

  if (
    auth.app.options.projectId !== projectId ||
    db.app.options.projectId !== projectId
  ) {
    throw new Error("Firebase Project ID မကိုက်ညီပါ။");
  }

  await user.getIdToken(true);

  const adminRef = doc(db, "admins", user.uid);

  console.info("Admin UID:", user.uid);
  console.info("Admin document:", adminRef.path);
  console.info("Project:", projectId);

  const snapshot = await getDocFromServer(adminRef);

  if (!snapshot.exists()) {
    throw new Error(
      `Admin document မတွေ့ပါ။ UID=${user.uid}, Project=${projectId}`
    );
  }

  const data = snapshot.data();

  if (data.active !== true) {
    throw new Error(
      "Admin active field သည် Boolean true မဟုတ်ပါ။"
    );
  }

  return true;
}

// Render matches
function renderAdminMatches() {
  if (!adminMatches) return;

  if (!matches.length) {
    adminMatches.innerHTML =
      '<p class="muted">ပွဲစဉ်မရှိသေးပါ။</p>';
    return;
  }

  adminMatches.innerHTML = matches.map(m => `
    <article class="admin-match">
      <div>
        <span class="tag ${
          m.sport === "football"
            ? "tag-football"
            : "tag-esports"
        }">
          ${m.sport === "football" ? "FOOTBALL" : "ESPORTS"}
        </span>

        <strong>
          ${escapeHTML(m.homeTeam)} ${m.homeScore ?? "–"}
          :
          ${m.awayScore ?? "–"} ${escapeHTML(m.awayTeam)}
        </strong>

        <small>
          ${escapeHTML(m.title)} • ${escapeHTML(m.status)}
        </small>
      </div>

      <div class="button-row">
        <button
          type="button"
          class="button button-small button-outline"
          data-edit="${m.id}"
        >Edit</button>

        <button
          type="button"
          class="button button-small button-danger"
          data-delete="${m.id}"
        >Delete</button>
      </div>
    </article>
  `).join("");

  adminMatches.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const m = matches.find(
        item => item.id === button.dataset.edit
      );

      if (!m) return;

      $("#match-id").value = m.id;
      $("#sport").value = m.sport || "football";
      $("#game-title").value = m.title || "";
      $("#home-team").value = m.homeTeam || "";
      $("#away-team").value = m.awayTeam || "";
      $("#home-score").value = m.homeScore ?? "";
      $("#away-score").value = m.awayScore ?? "";
      $("#kickoff").value = toInputDate(m.kickoff);
      $("#status").value = m.status || "scheduled";

      $("#form-title").textContent = "ပွဲစဉ် ပြင်ဆင်ရန်";

      message(formMessage, "ပြင်ဆင်ပြီး သိမ်းမယ်ကို နှိပ်ပါ။");

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  });

  adminMatches.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      const m = matches.find(
        item => item.id === button.dataset.delete
      );

      if (!m || !currentUser) return;

      if (!confirm(
        `${m.homeTeam} vs ${m.awayTeam} ကို ဖျက်မှာ သေချာပါသလား?`
      )) return;

      try {
        await deleteDoc(doc(db, "matches", m.id));
        message(formMessage, "ပွဲစဉ် ဖျက်ပြီးပါပြီ။");
      } catch (error) {
        console.error(error);
        message(
          formMessage,
          "ဖျက်မရပါ။ " + errorDetails(error),
          true
        );
      }
    });
  });
}

// Real-time listener
function listenToMatches(user) {
  stopMatchListener();

  if (!user || currentUser?.uid !== user.uid) return;

  const q = query(
    collection(db, "matches"),
    orderBy("kickoff", "asc")
  );

  unsubscribeMatches = onSnapshot(q, snapshot => {
    matches = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    renderAdminMatches();
  }, error => {
    console.error("Match listener:", error);

    message(
      formMessage,
      "Match data ဖတ်မရပါ။ " + errorDetails(error),
      true
    );
  });
}

// Login
if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("#email").value.trim();
    const password = $("#password").value;

    if (!email || !password) {
      message(loginMessage, "Email နဲ့ Password ဖြည့်ပါ။", true);
      return;
    }

    message(loginMessage, "Login စစ်ဆေးနေပါတယ်…");

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(error);

      message(
        loginMessage,
        "Login မအောင်မြင်ပါ။ " + errorDetails(error),
        true
      );
    }
  });
}

// Authentication state
onAuthStateChanged(auth, async user => {
  const generation = ++authGeneration;

  currentUser = user;
  stopMatchListener();
  matches = [];

  if (!user) {
    setLoggedInUI(null);

    if (adminMatches) adminMatches.innerHTML = "";

    message(loginMessage, "");
    message(formMessage, "");

    return;
  }

  if (loginPanel) loginPanel.hidden = false;
  if (adminPanel) adminPanel.hidden = true;

  message(
    loginMessage,
    "Login အောင်မြင်ပါပြီ။ Admin စစ်ဆေးနေပါတယ်…"
  );

  try {
    await verifyAdmin(user);

    if (generation !== authGeneration) return;

    if (auth.currentUser?.uid !== user.uid) return;

    setLoggedInUI(user);

    message(
      formMessage,
      "Admin document အတည်ပြုပြီးပါပြီ။"
    );

    listenToMatches(user);

  } catch (error) {
    if (generation !== authGeneration) return;

    console.error("Admin verification:", error);

    setLoggedInUI(null);

    message(
      loginMessage,
      "Admin စစ်ဆေးမှု မအောင်မြင်ပါ။ " +
      errorDetails(error),
      true
    );

    if (adminMatches) {
      adminMatches.textContent =
        "Admin ခွင့်ပြုချက်ကို အတည်မပြုနိုင်ပါ။";
    }
  }
});

// Save match
if (matchForm) {
  matchForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser) {
      message(formMessage, "အရင် Login ဝင်ပါ။", true);
      return;
    }

    const sport = $("#sport").value;
    const title = $("#game-title").value.trim();
    const homeTeam = $("#home-team").value.trim();
    const awayTeam = $("#away-team").value.trim();
    const kickoffValue = $("#kickoff").value;
    const status = $("#status").value;

    const hsText = $("#home-score").value;
    const asText = $("#away-score").value;

    const kickoffDate = new Date(kickoffValue);

    const homeScore =
      hsText === "" ? null : Number(hsText);

    const awayScore =
      asText === "" ? null : Number(asText);

    if (
      !title ||
      !homeTeam ||
      !awayTeam ||
      !kickoffValue ||
      Number.isNaN(kickoffDate.getTime())
    ) {
      message(formMessage, "လိုအပ်သောအချက်အလက်များ ဖြည့်ပါ။", true);
      return;
    }

    if ((hsText === "") !== (asText === "")) {
      message(formMessage, "Score နှစ်ဖက်လုံး ဖြည့်ပါ။", true);
      return;
    }

    if (
      (homeScore !== null &&
        (!Number.isInteger(homeScore) || homeScore < 0)) ||
      (awayScore !== null &&
        (!Number.isInteger(awayScore) || awayScore < 0))
    ) {
      message(formMessage, "Score မှန်ကန်စွာ ဖြည့်ပါ။", true);
      return;
    }

    if (
      status === "finished" &&
      (homeScore === null || awayScore === null)
    ) {
      message(
        formMessage,
        "ပြီးဆုံးသောပွဲအတွက် Score နှစ်ဖက်လုံး လိုအပ်ပါတယ်။",
        true
      );
      return;
    }

    const payload = {
      sport,
      title,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      kickoff: kickoffDate,
      status,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };

    const submitButton = matchForm.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    if (submitButton) submitButton.disabled = true;

    message(formMessage, "သိမ်းဆည်းနေပါတယ်…");

    try {
      const id = $("#match-id").value.trim();

      if (id) {
        await updateDoc(
          doc(db, "matches", id),
          payload
        );
      } else {
        await addDoc(
          collection(db, "matches"),
          {
            ...payload,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
          }
        );
      }

      resetForm();

      message(
        formMessage,
        "Firebase မှာ သိမ်းဆည်းပြီးပါပြီ။"
      );

    } catch (error) {
      console.error("Match save failed:", error);

      message(
        formMessage,
        "Save မအောင်မြင်ပါ။ " + errorDetails(error),
        true
      );

    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// Logout
$("#logout-button")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    resetForm();
  } catch (error) {
    message(
      formMessage,
      "Logout မအောင်မြင်ပါ။ " + errorDetails(error),
      true
    );
  }
});

$("#cancel-edit")?.addEventListener("click", resetForm);
