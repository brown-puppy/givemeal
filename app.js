"use strict";

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const fmt = s => (isFinite(s) && s >= 0) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  audio: '<svg viewBox="0 0 24 24"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

let DATA = { topics: [] };
const byId = new Map();

/* ---------- audio player ---------- */
const audio = new Audio();
audio.preload = "metadata";
const SPEEDS = [1, 1.2, 0.8];
let seeking = false;

const P = {
  el: $("#player"), range: $("#p-range"), cur: $("#p-cur"), dur: $("#p-dur"),
  play: $("#p-play"), back: $("#p-back"), speed: $("#p-speed"), loop: $("#p-loop")
};
P.play.innerHTML = ICON.play;

audio.addEventListener("loadedmetadata", () => P.dur.textContent = fmt(audio.duration));
audio.addEventListener("timeupdate", () => {
  if (!seeking && audio.duration) P.range.value = audio.currentTime / audio.duration * 1000;
  P.cur.textContent = fmt(audio.currentTime);
});
audio.addEventListener("play", () => { P.play.innerHTML = ICON.pause; P.play.setAttribute("aria-label", "일시정지"); });
audio.addEventListener("pause", () => { P.play.innerHTML = ICON.play; P.play.setAttribute("aria-label", "재생"); });
P.play.onclick = async () => {
  if (audio.paused) { try { await audio.play(); } catch (e) {} } else audio.pause();
};
P.back.onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 5); };
P.speed.onclick = () => {
  const i = (SPEEDS.indexOf(audio.playbackRate) + 1) % SPEEDS.length;
  audio.playbackRate = SPEEDS[i];
  P.speed.textContent = SPEEDS[i] + "×";
  P.speed.classList.toggle("on", SPEEDS[i] !== 1);
};
P.loop.onclick = () => { audio.loop = !audio.loop; P.loop.classList.toggle("on", audio.loop); };
P.range.addEventListener("input", () => { seeking = true; if (audio.duration) P.cur.textContent = fmt(P.range.value / 1000 * audio.duration); });
P.range.addEventListener("change", () => { if (audio.duration) audio.currentTime = P.range.value / 1000 * audio.duration; seeking = false; });

function loadAudio(src) {
  if (!src) { audio.pause(); audio.removeAttribute("src"); P.el.hidden = true; document.body.classList.remove("has-player"); return; }
  P.el.hidden = false; document.body.classList.add("has-player");
  const abs = new URL(src, location.href).href;
  if (audio.src !== abs) {
    audio.pause();
    audio.src = src;
    audio.playbackRate = 1; P.speed.textContent = "1×"; P.speed.classList.remove("on");
    audio.loop = false; P.loop.classList.remove("on");
    P.range.value = 0; P.cur.textContent = "0:00"; P.dur.textContent = "0:00";
  }
}

/* ---------- list ---------- */
function renderList() {
  const total = DATA.topics.reduce((n, t) => n + t.items.length, 0);
  $("#count").textContent = `${DATA.topics.length}개 주제 · ${total}개 답변`;
  if (!total) { $("#list").innerHTML = '<div class="empty">아직 스크립트가 없어요</div>'; return; }
  $("#list").innerHTML = DATA.topics.map(t => `
    <div class="group">
      <div class="group-h">${esc(t.emoji || "")} ${esc(t.name)}</div>
      <div class="rows">
        ${t.items.map(it => `
          <a class="row" href="#${esc(it.id)}">
            <span class="qno">Q${esc(it.no)}</span>
            <span class="row-main">
              <div class="row-title">${esc(it.title)}</div>
              <div class="row-sub">${esc(it.question)}</div>
            </span>
            <span class="row-ic">${it.audio ? ICON.audio : ""}${ICON.chev}</span>
          </a>`).join("")}
      </div>
    </div>`).join("");
}

/* ---------- detail ---------- */
function renderDetail(it) {
  $("#d-title").textContent = `${it.topicName} · Q${it.no} ${it.title}`;
  let mode = store.get("mode", "script");
  const root = $("#detail");
  root.innerHTML = `
    <p class="question">${esc(it.question)}</p>
    <div class="seg" role="tablist">
      <button data-m="script">전문</button>
      <button data-m="kw">키워드</button>
      <button data-m="blind">가리기</button>
    </div>
    <div id="d-body"></div>
    ${it.notes ? `<div class="note"><b>메모</b> · ${md(it.notes)}</div>` : ""}`;
  const body = $("#d-body");
  const set = m => {
    mode = m; store.set("mode", m);
    root.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
    if (m === "kw") {
      body.className = "";
      body.innerHTML = `<ol class="kw">${it.keywords.map(k => `<li><span>${md(k)}</span></li>`).join("")}</ol>`;
    } else {
      body.className = "script" + (m === "blind" ? " blur" : "");
      body.innerHTML = (m === "blind" ? '<p class="hint">먼저 말해보고, 문단을 탭해서 확인</p>' : "")
        + it.script.map(p => `<p class="para">${md(p)}</p>`).join("");
      if (m === "blind") body.querySelectorAll(".para").forEach(p => p.onclick = () => p.classList.toggle("show"));
    }
  };
  root.querySelectorAll(".seg button").forEach(b => b.onclick = () => set(b.dataset.m));
  set(mode);
  loadAudio(it.audio);
  window.scrollTo(0, 0);
}

/* ---------- practice ---------- */
let timerId = null, lastPick = null;
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
function renderPractice() {
  stopTimer();
  const all = [...byId.values()];
  const root = $("#practice");
  if (!all.length) { root.innerHTML = '<div class="empty">아직 스크립트가 없어요</div>'; return; }
  let it = all[Math.floor(Math.random() * all.length)];
  if (all.length > 1) while (it.id === lastPick) it = all[Math.floor(Math.random() * all.length)];
  lastPick = it.id;
  root.innerHTML = `
    <div class="pcard">
      <div class="pmeta"><span class="pill">${esc(it.topicName)}</span><span class="pill">Q${esc(it.no)} ${esc(it.type || it.title)}</span></div>
      <p class="pq">${esc(it.question)}</p>
      <div class="timer" id="t">0:00</div>
      <p class="timer-sub">답변 목표 1:30 ~ 2:00</p>
      <div class="btns">
        <button class="btn primary wide" id="t-start">말하기 시작</button>
        <button class="btn" id="t-kw">키워드 보기</button>
        <a class="btn" href="#${esc(it.id)}">스크립트 보기</a>
        <button class="btn wide" id="t-next">다음 문제</button>
      </div>
      <div class="pkw" id="t-kwbox" hidden><ol class="kw">${it.keywords.map(k => `<li><span>${md(k)}</span></li>`).join("")}</ol></div>
    </div>`;
  const t = $("#t"), start = $("#t-start");
  let t0 = 0;
  start.onclick = () => {
    if (timerId) { stopTimer(); start.textContent = "다시 시작"; return; }
    t0 = Date.now(); t.textContent = "0:00"; t.classList.remove("over");
    start.textContent = "멈추기";
    timerId = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      t.textContent = fmt(s);
      t.classList.toggle("over", s > 120);
    }, 250);
  };
  $("#t-kw").onclick = () => { const b = $("#t-kwbox"); b.hidden = !b.hidden; $("#t-kw").textContent = b.hidden ? "키워드 보기" : "키워드 숨기기"; };
  $("#t-next").onclick = renderPractice;
}

/* ---------- router ---------- */
function show(name) {
  ["list", "detail", "practice"].forEach(n => $("#screen-" + n).hidden = n !== name);
  document.querySelectorAll(".tab").forEach(a => a.classList.toggle("on",
    a.dataset.tab === (name === "practice" ? "practice" : "list")));
}
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === "practice") { loadAudio(null); show("practice"); renderPractice(); return; }
  stopTimer();
  if (h && byId.has(h)) { show("detail"); renderDetail(byId.get(h)); return; }
  loadAudio(null); show("list"); window.scrollTo(0, 0);
}
$("#back").onclick = () => { location.hash = ""; };
window.addEventListener("hashchange", route);

/* ---------- boot ---------- */
async function boot() {
  try {
    const res = await fetch("data/scripts.json", { cache: "no-cache" });
    DATA = await res.json();
  } catch (e) {
    $("#list").innerHTML = '<div class="empty">스크립트를 불러오지 못했어요</div>';
  }
  DATA.topics.forEach(t => t.items.forEach(it => byId.set(it.id, { ...it, topicName: t.name })));
  renderList();
  route();
}
boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
