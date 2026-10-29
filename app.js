import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const notice = document.querySelector("#notice");
const matchesList = document.querySelector("#matches-list");
const standingsBody = document.querySelector("#standings-body");
const countEl = document.querySelector("#match-count");
document.querySelector("#year").textContent = new Date().getFullYear();

let allMatches = [];
let activeFilter = "all";
const validConfig = firebaseConfig.apiKey !== "PASTE_API_KEY" && firebaseConfig.projectId !== "PASTE_PROJECT_ID";

document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button));
    activeFilter = button.dataset.filter;
    renderMatches();
  });
});

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function formatDate(value) {
  if (!value) return "အချိန် မသတ်မှတ်ရသေး";
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "အချိန် မသတ်မှတ်ရသေး" : date.toLocaleString("my-MM", { dateStyle:"medium", timeStyle:"short" });
}
function statusLabel(status) {
  return ({ scheduled:"လာမည့်ပွဲ", live:"LIVE", finished:"ပြီးဆုံး" })[status] || "လာမည့်ပွဲ";
}
function renderMatches() {
  const rows = allMatches.filter(m => activeFilter === "all" || m.sport === activeFilter);
  countEl.textContent = allMatches.length;
  if (!rows.length) {
    matchesList.innerHTML = `<div class="empty-card">လောလောဆယ် ပွဲစဉ်မရှိသေးပါ။</div>`;
    return;
  }
  matchesList.innerHTML = rows.map(m => {
    const scoresAvailable = m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined;
    return `<article class="match-card">
      <div class="match-meta"><span class="tag ${m.sport === "football" ? "tag-football" : "tag-esports"}">${m.sport === "football" ? "FOOTBALL" : "ESPORTS"}</span><span class="status status-${esc(m.status)}">${statusLabel(m.status)}</span></div>
      <h3>${esc(m.title || (m.sport === "football" ? "Football Match" : "Esports Match"))}</h3>
      <div class="versus"><div class="team"><span class="team-icon">A</span><strong>${esc(m.homeTeam)}</strong></div><div class="score">${scoresAvailable ? `${Number(m.homeScore)} <i>:</i> ${Number(m.awayScore)}` : `<i>VS</i>`}</div><div class="team team-away"><span class="team-icon">B</span><strong>${esc(m.awayTeam)}</strong></div></div>
      <div class="match-date">◷ &nbsp;${esc(formatDate(m.kickoff))}</div>
    </article>`;
  }).join("");
}
function renderStandings() {
  const table = new Map();
  function getTeam(name) {
    if (!table.has(name)) table.set(name, { name, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, points:0 });
    return table.get(name);
  }
  allMatches.filter(m => m.sport === "football" && m.status === "finished" && Number.isFinite(Number(m.homeScore)) && Number.isFinite(Number(m.awayScore)) && m.homeScore !== "" && m.awayScore !== "").forEach(m => {
    const a = getTeam(m.homeTeam), b = getTeam(m.awayTeam);
    const hs = Number(m.homeScore), as = Number(m.awayScore);
    a.played++; b.played++; a.gf += hs; a.ga += as; b.gf += as; b.ga += hs;
    if (hs > as) { a.won++; b.lost++; a.points += 3; }
    else if (hs < as) { b.won++; a.lost++; b.points += 3; }
    else { a.drawn++; b.drawn++; a.points++; b.points++; }
  });
  const sorted = [...table.values()].sort((a,b) => b.points-a.points || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf || a.name.localeCompare(b.name));
  standingsBody.innerHTML = sorted.length ? sorted.map((t,i) => `<tr><td>${i+1}</td><td class="team-name">${esc(t.name)}</td><td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td><td>${t.gf-t.ga}</td><td><strong>${t.points}</strong></td></tr>`).join("") : `<tr><td colspan="8" class="empty">ပြီးဆုံးပြီး Football ပွဲစဉ်များ ထည့်ပြီးမှ အမှတ်ပေးဇယား ပေါ်လာပါမယ်။</td></tr>`;
}
if (!validConfig) {
  notice.textContent = "အရင်ဆုံး firebase-config.js ထဲမှာ Firebase Web App config ထည့်ပါ။";
  matchesList.innerHTML = `<div class="empty-card">Firebase config မထည့်ရသေးပါ။ README.md ထဲက အဆင့်များကို လိုက်လုပ်ပါ။</div>`;
} else {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    onSnapshot(query(collection(db, "matches"), orderBy("kickoff", "asc")), snapshot => {
      allMatches = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
      notice.textContent = "ရလဒ်များကို Firebase မှ တိုက်ရိုက်ရယူထားသည်။";
      renderMatches(); renderStandings();
    }, error => {
      console.error(error);
      notice.textContent = "ဒေတာဖတ်မရပါ။ Firebase config၊ Internet နဲ့ Firestore Rules ကို စစ်ဆေးပါ။";
    });
  } catch (error) {
    console.error(error);
    notice.textContent = "Firebase ချိတ်ဆက်မှု မအောင်မြင်ပါ။ Config ကို စစ်ဆေးပါ။";
  }
}