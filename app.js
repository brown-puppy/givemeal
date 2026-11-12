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

/* ---------- 질문 읽어주기 (브라우저 내장 TTS) ---------- */
const TTS = {
  ok: "speechSynthesis" in window,
  voice: null,
  pick() {
    if (!this.ok) return null;
    const vs = speechSynthesis.getVoices().filter(v => /^en[-_]US/i.test(v.lang));
    const pref = ["Samantha", "Google US English", "Aria", "Jenny", "Ava", "Allison", "Zira"];
    this.voice = pref.map(n => vs.find(v => v.name.includes(n))).find(Boolean) || vs.find(v => v.localService) || vs[0] || null;
    return this.voice;
  },
  speak(text, btn) {
    if (!this.ok) return;
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); if (btn && btn.classList.contains("on")) return; }
    audio.pause();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 0.95;
    if (this.voice || this.pick()) u.voice = this.voice;
    const off = () => document.querySelectorAll(".q-say").forEach(b => b.classList.remove("on"));
    off(); if (btn) btn.classList.add("on");
    u.onend = u.onerror = off;
    speechSynthesis.speak(u);
  },
  stop() { if (this.ok) speechSynthesis.cancel(); }
};
if (TTS.ok) speechSynthesis.onvoiceschanged = () => TTS.pick();
const SAY_ICON = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const sayBtn = label => TTS.ok ? `<button class="q-say" type="button">${SAY_ICON}<span>${label}</span></button>` : "";

/* ---------- list ---------- */
function renderList() {
  const total = DATA.topics.reduce((n, t) => n + t.items.length, 0);
  $("#count").textContent = `${DATA.topics.length}개 주제 · ${total}개 답변`;
  if (!total) { $("#list").innerHTML = '<div class="empty">아직 스크립트가 없어요<small>관리자에게 스크립트·녹음을 보내면 여기에 추가돼요</small></div>'; return; }
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
    ${sayBtn("질문 듣기")}
    <div class="seg" role="tablist">
      <button data-m="script">전문</button>
      <button data-m="kw">키워드</button>
      <button data-m="blind">가리기</button>
    </div>
    <div id="d-body"></div>
    ${it.notes ? `<div class="note"><b>메모</b> · ${md(it.notes)}</div>` : ""}`;
  const qs = root.querySelector(".q-say"); if (qs) qs.onclick = () => TTS.speak(it.question, qs);
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
// 흐름: 시작 → 질문 1회 재생 → 5초 대기(이 안에 다시 듣기 1회 가능) → 답변 타이머
//       다시 듣기를 누르면 2번째 재생이 끝나는 즉시 답변 타이머
let timerId = null, lastPick = null, session = 0;
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; session++; TTS.stop(); }

// 질문 음성 재생. 끝나면 resolve. (onend가 안 오는 브라우저 대비 예상 시간 + 여유로 강제 진행)
function sayQuestion(text) {
  return new Promise(resolve => {
    if (!TTS.ok) { resolve(); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
    const words = text.split(/\s+/).length;
    const guard = setTimeout(finish, (words / 2.2 + 4) * 1000);
    speechSynthesis.cancel(); audio.pause();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 0.95;
    if (TTS.voice || TTS.pick()) u.voice = TTS.voice;
    u.onend = finish; u.onerror = finish;
    speechSynthesis.speak(u);
  });
}

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
      ${TTS.ok ? "" : `<p class="pq">${esc(it.question)}</p>`}
      <div class="stage" id="stage">
        <div class="stage-label" id="s-label">준비되면 시작 · 질문은 음성으로만 나와요</div>
        <div class="timer" id="t">0:00</div>
        <p class="timer-sub" id="s-sub">질문을 듣고 5초 안에 한 번 더 들을 수 있어요</p>
      </div>
      <div class="btns">
        <button class="btn primary wide" id="t-main">시작</button>
        <button class="btn wide" id="t-replay" hidden>다시 듣기 (1회)</button>
        <button class="btn" id="t-kw">키워드 보기</button>
        <button class="btn" id="t-sc">스크립트 보기</button>
        <button class="btn wide" id="t-next">다음 문제</button>
      </div>
      <div class="pkw" id="t-kwbox" hidden><ol class="kw">${it.keywords.map(k => `<li><span>${md(k)}</span></li>`).join("")}</ol></div>
      <div class="pkw script" id="t-scbox" hidden><p class="question">${esc(it.question)}</p>${it.script.map(p => `<p>${md(p)}</p>`).join("")}</div>
    </div>`;

  const t = $("#t"), label = $("#s-label"), sub = $("#s-sub");
  const main = $("#t-main"), replay = $("#t-replay");
  let state = "idle";   // idle | q1 | wait | q2 | answer | done
  const setState = (st, l, sb) => {
    state = st; label.textContent = l; if (sb !== undefined) sub.textContent = sb;
    $("#stage").dataset.state = st;
  };

  function startAnswer(my) {
    if (my !== session) return;
    clearInterval(timerId);
    replay.hidden = true;
    setState("answer", "답변 중", "목표 1:30 ~ 2:00");
    main.textContent = "답변 끝";
    const t0 = Date.now(); t.textContent = "0:00"; t.classList.remove("over");
    timerId = setInterval(() => {
      const sec = (Date.now() - t0) / 1000;
      t.textContent = fmt(sec); t.classList.toggle("over", sec > 120);
    }, 250);
  }

  function startWait(my) {
    if (my !== session) return;
    setState("wait", "5초 후 답변 시작", "지금 다시 듣기 가능 (1회)");
    replay.hidden = false; main.textContent = "바로 답변 시작";
    let left = 5; t.textContent = "0:05"; t.classList.remove("over");
    clearInterval(timerId);
    timerId = setInterval(() => {
      if (my !== session) return;
      left--; t.textContent = "0:0" + Math.max(left, 0);
      if (left <= 0) startAnswer(my);
    }, 1000);
  }

  async function begin() {
    stopTimer(); const my = session;
    setState("q1", "질문 듣는 중", "질문을 잘 들어보세요");
    main.textContent = "건너뛰기"; t.textContent = "🔊";
    await sayQuestion(it.question);
    startWait(my);
  }

  replay.onclick = async () => {
    if (state !== "wait") return;
    clearInterval(timerId); timerId = null;
    const my = session;
    replay.hidden = true;
    setState("q2", "다시 듣는 중", "끝나면 바로 답변 시작");
    main.textContent = "건너뛰기"; t.textContent = "🔊";
    await sayQuestion(it.question);
    startAnswer(my);
  };

  main.onclick = () => {
    if (state === "idle" || state === "done") return begin();
    if (state === "q1") { TTS.stop(); return; }             // sayQuestion resolve → wait
    if (state === "q2") { TTS.stop(); return; }             // → answer
    if (state === "wait") return startAnswer(session);
    if (state === "answer") {
      clearInterval(timerId); timerId = null;
      setState("done", "답변 시간", "키워드·스크립트로 확인해보세요");
      main.textContent = "처음부터 다시";
    }
  };

  const toggle = (btn, box, on, off) => { box.hidden = !box.hidden; btn.textContent = box.hidden ? on : off; };
  $("#t-kw").onclick = () => toggle($("#t-kw"), $("#t-kwbox"), "키워드 보기", "키워드 숨기기");
  $("#t-sc").onclick = () => toggle($("#t-sc"), $("#t-scbox"), "스크립트 보기", "스크립트 숨기기");
  $("#t-next").onclick = renderPractice;
}

/* ---------- auth (브라우저 localStorage, base64 저장 — 보안 용도 아님, 공간 구분용) ---------- */
const b64e = str => btoa(unescape(encodeURIComponent(str)));
const b64d = str => { try { return decodeURIComponent(escape(atob(str))); } catch (e) { return ""; } };
const ACC_KEY = "opic.accounts", SES_KEY = "opic.session";
const Auth = {
  accounts() { const raw = store.get(ACC_KEY, ""); if (!raw) return {}; try { return JSON.parse(b64d(raw)) || {}; } catch (e) { return {}; } },
  save(acc) { store.set(ACC_KEY, b64e(JSON.stringify(acc))); },
  current() { const u = b64d(store.get(SES_KEY, "")); return u || null; },
  signup(u, p) {
    const acc = this.accounts();
    if (acc[u]) return "이미 있는 아이디예요";
    acc[u] = b64e(p); this.save(acc); store.set(SES_KEY, b64e(u)); return null;
  },
  login(u, p) {
    const acc = this.accounts();
    if (!acc[u]) return "없는 아이디예요. 이 기기에서 처음이면 회원가입부터 해주세요";
    if (b64d(acc[u]) !== p) return "비밀번호가 맞지 않아요";
    store.set(SES_KEY, b64e(u)); return null;
  },
  logout() { try { localStorage.removeItem(SES_KEY); } catch (e) {} }
};

let authMode = "login";
function setAuthMode(m) {
  authMode = m;
  document.querySelectorAll("#auth-tabs button").forEach(b => b.classList.toggle("on", b.dataset.a === m));
  $("#a-pass2-wrap").hidden = m !== "signup";
  $("#a-pass").autocomplete = m === "signup" ? "new-password" : "current-password";
  $("#a-submit").textContent = m === "signup" ? "가입하고 시작하기" : "로그인";
  $("#a-err").textContent = "";
}
document.querySelectorAll("#auth-tabs button").forEach(b => b.onclick = () => setAuthMode(b.dataset.a));
$("#auth-form").addEventListener("submit", async e => {
  e.preventDefault();
  const u = $("#a-user").value.trim().toLowerCase(), p = $("#a-pass").value;
  const err = m => { $("#a-err").textContent = m; };
  if (!/^[a-z][a-z0-9_-]{1,19}$/.test(u)) return err("아이디는 영문 소문자로 시작, 소문자·숫자·_·- 2~20자");
  if (!p) return err("비밀번호를 입력해주세요");
  let r;
  if (authMode === "signup") {
    if (p !== $("#a-pass2").value) return err("비밀번호가 서로 달라요");
    r = Auth.signup(u, p);
  } else r = Auth.login(u, p);
  if (r) return err(r);
  $("#a-pass").value = $("#a-pass2").value = "";
  await loadUser();
});

function openSheet(open) { $("#user-sheet").hidden = !open; }
$("#user-chip").onclick = () => openSheet(true);
$("#sheet-close").onclick = () => openSheet(false);
$("#user-sheet").onclick = e => { if (e.target.id === "user-sheet") openSheet(false); };
$("#logout").onclick = () => {
  openSheet(false); Auth.logout(); audio.pause(); stopTimer();
  DATA = { topics: [] }; byId.clear();
  history.replaceState(null, "", location.pathname);
  showAuth();
};
function showAuth() {
  document.body.classList.add("authing");
  loadAudio(null);
  ["list", "detail", "practice"].forEach(n => $("#screen-" + n).hidden = true);
  $("#screen-auth").hidden = false;
  setAuthMode(Object.keys(Auth.accounts()).length ? "login" : "signup");
}

/* ---------- router ---------- */
function show(name) {
  $("#screen-auth").hidden = true; document.body.classList.remove("authing");
  ["list", "detail", "practice"].forEach(n => $("#screen-" + n).hidden = n !== name);
  document.querySelectorAll(".tab").forEach(a => a.classList.toggle("on",
    a.dataset.tab === (name === "practice" ? "practice" : "list")));
}
function route() {
  TTS.stop();
  if (!Auth.current()) { showAuth(); return; }
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === "practice") { loadAudio(null); show("practice"); renderPractice(); return; }
  stopTimer();
  if (h && byId.has(h)) { show("detail"); renderDetail(byId.get(h)); return; }
  loadAudio(null); show("list"); window.scrollTo(0, 0);
}
$("#back").onclick = () => { location.hash = ""; };
window.addEventListener("hashchange", route);

/* ---------- boot ---------- */
let loadError = "";
async function loadUser() {
  const u = Auth.current();
  if (!u) { showAuth(); return; }
  $("#user-chip").innerHTML = `<span class="av">${esc(u[0].toUpperCase())}</span><span class="nm">${esc(u)}</span>`;
  $("#sheet-user").innerHTML = `로그인 중<b>${esc(u)}</b>`;
  DATA = { topics: [] }; byId.clear(); loadError = "";
  try {
    const res = await fetch(`data/users/${encodeURIComponent(u)}/scripts.json`, { cache: "no-cache" });
    if (res.status === 404) loadError = "empty";
    else if (!res.ok) throw new Error(res.status);
    else DATA = await res.json();
  } catch (e) { loadError = "fail"; }
  DATA.topics = DATA.topics || [];
  DATA.topics.forEach(t => t.items.forEach(it => byId.set(it.id, { ...it, topicName: t.name })));
  renderList();
  if (loadError === "fail") $("#list").innerHTML = '<div class="empty">스크립트를 불러오지 못했어요<small>인터넷 연결을 확인해주세요</small></div>';
  route();
}
loadUser();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
