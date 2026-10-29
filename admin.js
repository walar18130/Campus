
import {
  initializeApp,
  getApp,
  getApps
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

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
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// ==================================================
// CAMPUS ARENA ADMIN DASHBOARD
// ==================================================

const $ = (selector) => document.querySelector(selector);

const loginPanel = $("#login-panel");
const adminPanel = $("#admin-panel");
const loginForm = $("#login-form");
const loginMessage = $("#login-message");
const formMessage = $("#form-message");
const matchForm = $("#match-form");
const adminMatches = $("#admin-matches");

let app;
let auth;
let db;
let currentUser = null;
let matches = [];
let stopListening = null;
let authGeneration = 0;
let saving = false;

function message(element, text, error = false) {
  if (!element) return;

  element.textContent = text;
  element.classList.toggle("error", error);
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function validConfig(config) {
  return Boolean(
    config &&
    typeof config.apiKey === "string" &&
    config.apiKey.trim() &&
    typeof config.projectId === "string" &&
    config.projectId.trim() &&
    typeof config.appId === "string" &&
    config.appId.trim()
  );
}

function errorDetails(error) {
  const code = error?.code || "unknown";
  const details = error?.message || String(error);

  console.error("Campus Arena Firebase error:", error);

  return `${code}: ${details}`;
}

function stopMatchListener() {
  if (stopListening) {
    stopListening();
    stopListening = null;
  }
}

function setLoggedInUI(user) {
  if (loginPanel) loginPanel.hidden = Boolean(user);
  if (adminPanel) adminPanel.hidden = !user;

  const signedIn = $("#signed-in-as");

  if (signedIn) {
    signedIn.textContent = user
      ? `Signed in: ${user.email || "Admin"}`
      : "";
  }
}

function resetForm() {
  if (!matchForm) return;

  matchForm.reset();

  const id = $("#match-id");
  const title = $("#form-title");
  const homeScore = $("#home-score");
  const awayScore = $("#away-score");

  if (id) id.value = "";
  if (title) title.textContent = "ပွဲစဉ်အသစ် ထည့်ရန်";
  if (homeScore) homeScore.value = "";
  if (awayScore) awayScore.value = "";

  message(formMessage, "");
}

function toInputDate(value) {
  if (!value) return "";

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 16);
}

function getMatchDate(value) {
  if (!value) return null;

  const date = value instanceof Date
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function renderAdminMatches() {
  if (!adminMatches) return;

  if (!matches.length) {
    adminMatches.innerHTML =
      '<p class="muted">ပွဲစဉ်မရှိသေးပါ။ ဘယ်ဘက် Form ကနေ ထည့်နိုင်ပါတယ်။</p>';
    return;
  }

  adminMatches.innerHTML = matches.map((match) => {
    const isFootball = match.sport === "football";
    const homeScore = match.homeScore ?? "–";
    const awayScore = match.awayScore ?? "–";

    return `
      <article class="admin-match">
        <div>
          <span class="tag ${isFootball ? "tag-football" : "tag-esports"}">
            ${isFootball ? "FOOTBALL" : "ESPORTS"}
          </span>

          <strong>
            ${esc(match.homeTeam)} ${homeScore} : ${awayScore}
            ${esc(match.awayTeam)}
          </strong>

          <small>
            ${esc(match.title)} • ${esc(match.status)}
          </small>
        </div>

        <div class="button-row">
          <button
            type="button"
            class="button button-small button-outline"
            data-edit="${esc(match.id)}"
          >Edit</button>

          <button
            type="button"
            class="button button-small button-danger"
            data-delete="${esc(match.id)}"
          >Delete</button>
        </div>
      </article>
    `;
  }).join("");

  adminMatches.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const match = matches.find(
        (item) => item.id === button.dataset.edit
      );

      if (!match) return;

      $("#match-id").value = match.id;
      $("#sport").value = match.sport || "football";
      $("#game-title").value = match.title || "";
      $("#home-team").value = match.homeTeam || "";
      $("#away-team").value = match.awayTeam || "";
      $("#home-score").value = match.homeScore ?? "";
      $("#away-score").value = match.awayScore ?? "";
      $("#kickoff").value = toInputDate(match.kickoff);
      $("#status").value = match.status || "scheduled";

      $("#form-title").textContent = "ပွဲစဉ် ပြင်ဆင်ရန်";

      message(
        formMessage,
        "အချက်အလက်ပြင်ပြီး သိမ်းမယ်ကို နှိပ်ပါ။"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  });

  adminMatches.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const match = matches.find(
        (item) => item.id === button.dataset.delete
      );

      if (!match || !currentUser) return;

      const confirmed = window.confirm(
        `${match.homeTeam} vs ${match.awayTeam} ပွဲစဉ်ကို ဖျက်မှာ သေချာပါသလား?`
      );

      if (!confirmed) return;

      button.disabled = true;

      try {
        await deleteDoc(doc(db, "matches", match.id));

        message(formMessage, "ပွဲစဉ် ဖျက်ပြီးပါပြီ။");
      } catch (error) {
        message(
          formMessage,
          "ပွဲစဉ်ဖျက်မရပါ။ " + errorDetails(error),
          true
        );
      } finally {
        button.disabled = false;
      }
    });
  });
}

// ==================================================
// VERIFY ADMIN DOCUMENT
// ==================================================

async function verifyAdmin(user) {
  const adminRef = doc(db, "admins", user.uid);
  const adminSnapshot = await getDoc(adminRef);

  if (!adminSnapshot.exists()) {
    throw new Error(
      "Admin document မတွေ့ပါ။ admins document ID ကို Authentication UID နဲ့ စစ်ပါ။"
    );
  }

  const adminData = adminSnapshot.data();

  if (adminData.active !== true) {
    throw new Error(
      "admins document ရဲ့ active field သည် Boolean true မဟုတ်ပါ။"
    );
  }

  return true;
}

// ==================================================
// LISTEN TO MATCHES
// ==================================================

function listenToMatches(user) {
  stopMatchListener();

  const matchesQuery = query(
    collection(db, "matches"),
    orderBy("kickoff", "asc")
  );

  stopListening = onSnapshot(
    matchesQuery,
    (snapshot) => {
      matches = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data()
      }));

      renderAdminMatches();
    },
    (error) => {
      message(
        formMessage,
        "Match data ဖတ်မရပါ။ " + errorDetails(error),
        true
      );

      if (adminMatches) {
        adminMatches.textContent =
          "Match data ဖတ်ခွင့်မရှိပါ သို့မဟုတ် query မှာ ပြဿနာရှိပါတယ်။";
      }
    }
  );
}

// ==================================================
// INITIALIZE FIREBASE
// ==================================================

if (!loginPanel || !adminPanel || !loginForm || !matchForm) {
  console.error(
    "Campus Arena HTML ထဲမှာ လိုအပ်တဲ့ element ID တချို့ မတွေ့ပါ။"
  );
} else if (!validConfig(firebaseConfig)) {
  message(
    loginMessage,
    "firebase-config.js ထဲက apiKey, projectId, appId ကို စစ်ပါ။",
    true
  );
} else {
  try {
    app = getApps().length
      ? getApp()
      : initializeApp(firebaseConfig);

    auth = getAuth(app);
    db = getFirestore(app);

    console.log("Campus Arena project:", firebaseConfig.projectId);
  } catch (error) {
    message(
      loginMessage,
      "Firebase စတင်ဖွင့်မရပါ။ " + errorDetails(error),
      true
    );
  }
}

// ==================================================
// LOGIN
// ==================================================

if (auth && db) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("#email")?.value.trim();
    const password = $("#password")?.value;

    if (!email || !password) {
      message(loginMessage, "Email နဲ့ Password ဖြည့်ပါ။", true);
      return;
    }

    const submitButton = loginForm.querySelector(
      'button[type="submit"], button:not([type])'
    );

    if (submitButton) submitButton.disabled = true;

    message(loginMessage, "Login စစ်ဆေးနေပါတယ်…");

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      message(
        loginMessage,
        "Login မအောင်မြင်ပါ။ " + errorDetails(error),
        true
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  // ==================================================
  // AUTH STATE + ADMIN CHECK
  // ==================================================

  onAuthStateChanged(auth, async (user) => {
    const generation = ++authGeneration;

    currentUser = user;
    stopMatchListener();
    matches = [];

    if (!user) {
      setLoggedInUI(null);
      if (adminMatches) adminMatches.innerHTML = "";
      message(loginMessage, "");
      return;
    }

    setLoggedInUI(user);

    message(
      formMessage,
      `Admin စစ်ဆေးနေပါတယ်… Project: ${firebaseConfig.projectId}`
    );

    console.info("Signed-in email:", user.email);
    console.info("Signed-in UID:", user.uid);
    console.info("Firebase project:", firebaseConfig.projectId);

    try {
      await verifyAdmin(user);

      if (generation !== authGeneration) return;

      message(
        formMessage,
        "Admin document OK ဖြစ်ပါတယ်။ Match data ကို ဖတ်နေပါတယ်။"
      );

      listenToMatches(user);
    } catch (error) {
      if (generation !== authGeneration) return;

      message(
        formMessage,
        "Admin စစ်ဆေးမှု မအောင်မြင်ပါ။ " + errorDetails(error),
        true
      );

      if (adminMatches) {
        adminMatches.textContent =
          "Admin ခွင့်ပြုချက်ကို အတည်မပြုနိုင်ပါ။";
      }
    }
  });

  // ==================================================
  // LOGOUT
  // ==================================================

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

  // ==================================================
  // CANCEL EDIT
  // ==================================================

  $("#cancel-edit")?.addEventListener("click", resetForm);

  // ==================================================
  // CREATE / UPDATE MATCH
  // ==================================================

  matchForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (saving) return;

    if (!currentUser) {
      message(formMessage, "အရင် Login ဝင်ပါ။", true);
      return;
    }

    const sport = $("#sport")?.value;
    const title = $("#game-title")?.value.trim();
    const homeTeam = $("#home-team")?.value.trim();
    const awayTeam = $("#away-team")?.value.trim();
    const kickoffValue = $("#kickoff")?.value;
    const status = $("#status")?.value;

    const homeScoreText = $("#home-score")?.value ?? "";
    const awayScoreText = $("#away-score")?.value ?? "";

    if (!["football", "esports"].includes(sport)) {
      message(formMessage, "Football သို့မဟုတ် Esports ကို ရွေးပါ။", true);
      return;
    }

    if (!title || !homeTeam || !awayTeam || !kickoffValue) {
      message(formMessage, "လိုအပ်သောအချက်အလက်အားလုံး ဖြည့်ပါ။", true);
      return;
    }

    if (!["scheduled", "live", "finished"].includes(status)) {
      message(formMessage, "ပွဲစဉ်အခြေအနေကို မှန်ကန်စွာ ရွေးပါ။", true);
      return;
    }

    if ((homeScoreText === "") !== (awayScoreText === "")) {
      message(
        formMessage,
        "Score နှစ်ဖက်လုံး ထည့်ပါ၊ သို့မဟုတ် နှစ်ဖက်လုံး အလွတ်ထားပါ။",
        true
      );
      return;
    }

    let homeScore = null;
    let awayScore = null;

    if (homeScoreText !== "" && awayScoreText !== "") {
      homeScore = Number(homeScoreText);
      awayScore = Number(awayScoreText);

      if (
        !Number.isInteger(homeScore) ||
        !Number.isInteger(awayScore) ||
        homeScore < 0 ||
        awayScore < 0
      ) {
        message(
          formMessage,
          "Score ကို အနုတ်မဟုတ်တဲ့ ကိန်းပြည့်အဖြစ် ထည့်ပါ။",
          true
        );
        return;
      }
    }

    if (
      status === "finished" &&
      (homeScore === null || awayScore === null)
    ) {
      message(
        formMessage,
        "ပြီးဆုံးတဲ့ပွဲအတွက် Score နှစ်ဖက်လုံး လိုအပ်ပါတယ်။",
        true
      );
      return;
    }

    const kickoffDate = getMatchDate(kickoffValue);

    if (!kickoffDate) {
      message(formMessage, "ပွဲစဉ်နေ့ရက် မမှန်ပါ။", true);
      return;
    }

    const payload = {
      sport,
      title,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      kickoff: Timestamp.fromDate(kickoffDate),
      status,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };

    const matchId = $("#match-id")?.value;

    saving = true;

    const submitButton = matchForm.querySelector(
      'button[type="submit"], button:not([type])'
    );

    if (submitButton) submitButton.disabled = true;

    message(formMessage, "Firebase မှာ သိမ်းဆည်းနေပါတယ်…");

    try {
      // Re-check current signed-in user before writing.
      const user = auth.currentUser;

      if (!user || user.uid !== currentUser.uid) {
        throw new Error("Login session ပြောင်းလဲသွားပါတယ်။ ပြန်ဝင်ပါ။");
      }

      if (matchId) {
        await updateDoc(doc(db, "matches", matchId), payload);
      } else {
        await addDoc(collection(db, "matches"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
      }

      resetForm();

      message(
        formMessage,
        "Firebase မှာ သိမ်းဆည်းပြီးပါပြီ။ User View မှာလည်း ပြောင်းလဲပါမယ်။"
      );
    } catch (error) {
      message(
        formMessage,
        "Match Save မအောင်မြင်ပါ။ " + errorDetails(error),
        true
      );

      alert(
        "Match Save မအောင်မြင်ပါ။\n\n" +
        "Error: " + (error.code || "unknown") +
        "\nအသေးစိတ်: " + (error.message || String(error))
      );
    } finally {
      saving = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}
