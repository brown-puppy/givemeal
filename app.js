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
  // iOS 대비: 음성이 실제로 시작(onstart)된 뒤에만 길이 기반 안전 타이머를 건다.
  // 4초 안에 시작을 못 하면(브라우저가 막음) 대기열을 비우고 넘어간다 → 나중에 늦게 튀어나오는 일 방지
  return new Promise(resolve => {
    if (!TTS.ok) { resolve(); return; }
    let done = false, guard = null, startGuard = null;
    const words = text.split(/\s+/).length;
    const finish = () => { if (done) return; done = true; clearTimeout(guard); clearTimeout(startGuard); resolve(); };
    const armGuard = () => { clearTimeout(guard); guard = setTimeout(finish, (words / 2.2 + 4) * 1000); };
    speechSynthesis.cancel(); audio.pause();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 0.95;
    if (TTS.voice || TTS.pick()) u.voice = TTS.voice;
    u.onstart = armGuard;
    u.onend = finish; u.onerror = finish;
    startGuard = setTimeout(() => {
      if (done || guard) return;
      if (speechSynthesis.speaking) armGuard();      // onstart만 안 온 경우: 말하는 중이면 계속 기다림
      else { speechSynthesis.cancel(); finish(); }   // 시작도 못 함: 버리고 진행
    }, 4000);
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
      <div class="pkw script" id="t-scbox" hidden><div class="pmeta"><span class="pill">${esc(it.topicName)}</span><span class="pill">Q${esc(it.no)} ${esc(it.type || it.title)}</span></div><p class="question">${esc(it.question)}</p>${it.script.map(p => `<p>${md(p)}</p>`).join("")}</div>
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

/* ---------- drive mode ---------- */
// 문항마다: 질문(TTS) → 10초 정적(소리 내서 답해보기) → 내 녹음(모범답안) → 다음 문항
const THINK_SEC = 10, GAP_MS = 1500;
const driveAudio = new Audio(); driveAudio.preload = "auto";
// 질문·정적 구간에도 오디오 세션을 살려두기 위한 무음 루프 (블루투스/핸들 버튼, 잠금화면 컨트롤 유지)
const keeper = new Audio(); keeper.loop = true; keeper.src = (() => {
  const sr = 8000, n = sr, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
})();

const Drive = { running: false, paused: false, list: [], idx: 0, phase: "question", token: 0, left: THINK_SEC, wake: null, waiters: new Set(), opts: null };
const dIcon = {
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5v14M19 5L9 12l10 7z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  play: ICON.play, pause: ICON.pause,
  speak: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};

const driveKey = k => `drive.${k}.${Auth.current() || ""}`;
function allItems() { return DATA.topics.flatMap(t => t.items.map(it => byId.get(it.id)).filter(Boolean)); }
function getSel() {
  const all = allItems().map(i => i.id);
  try { const s = JSON.parse(store.get(driveKey("sel"), "null")); if (Array.isArray(s)) return new Set(s.filter(id => byId.has(id))); } catch (e) {}
  return new Set(all);
}
function getOpt(k, d) { return store.get(driveKey(k), d); }

/* ----- 설정 화면 ----- */
function renderDriveSetup() {
  const root = $("#drive");
  const items = allItems();
  if (!items.length) { root.innerHTML = '<div class="empty">아직 스크립트가 없어요</div>'; return; }
  const sel = getSel();
  const order = getOpt("order", "seq"), loop = getOpt("loop", "stop");
  root.innerHTML = `
    <div class="dcard">
      <div class="dh"><b>범위</b><button class="link" id="d-all" type="button"></button></div>
      ${DATA.topics.map(t => `
        <div class="dtopic">
          <div class="dt-row">
            <label class="chk"><input type="checkbox" data-topic="${esc(t.id)}"><span>${esc(t.emoji || "")} ${esc(t.name)}</span></label>
            <span class="cnt" data-cnt="${esc(t.id)}"></span>
            <button class="dt-exp" type="button" data-exp="${esc(t.id)}" aria-label="문항 펼치기">${ICON.chev}</button>
          </div>
          <div class="dt-items" data-items="${esc(t.id)}" hidden>
            ${t.items.map(it => `<label class="chk sub"><input type="checkbox" data-item="${esc(it.id)}"><span>Q${esc(it.no)} ${esc(it.title)}${it.audio ? "" : ' <em>녹음 없음</em>'}</span></label>`).join("")}
          </div>
        </div>`).join("")}
    </div>
    <div class="dcard">
      <div class="dh"><b>순서</b></div>
      <div class="seg two" id="d-order"><button type="button" data-v="seq">순서대로</button><button type="button" data-v="rand">랜덤</button></div>
      <div class="dh"><b>다 끝나면</b></div>
      <div class="seg two" id="d-loop"><button type="button" data-v="stop">멈춤</button><button type="button" data-v="loop">처음부터 반복</button></div>
    </div>
    <div class="dsum" id="d-sum"></div>
    <button class="btn primary wide dbig" id="d-start" type="button">시작</button>
    <p class="dnote">문항마다 <b>질문 → ${THINK_SEC}초 동안 소리 내서 답해보기 → 내 녹음</b> 순서로 흘러가요.<br>
      출발 전에 시작하고, 운전 중엔 화면을 보지 마세요. 화면은 켜진 채로 유지돼요.<br>
      차 블루투스·핸들 버튼으로 다음/이전/일시정지가 될 수 있어요 (차·기기마다 다름).</p>`;

  const refresh = () => {
    DATA.topics.forEach(t => {
      const ids = t.items.map(i => i.id), n = ids.filter(id => sel.has(id)).length;
      const tc = root.querySelector(`[data-topic="${t.id}"]`);
      tc.checked = n === ids.length && n > 0; tc.indeterminate = n > 0 && n < ids.length;
      root.querySelector(`[data-cnt="${t.id}"]`).textContent = `${n}/${ids.length}`;
    });
    root.querySelectorAll("[data-item]").forEach(c => c.checked = sel.has(c.dataset.item));
    const chosen = items.filter(i => sel.has(i.id));
    const sec = chosen.reduce((s, i) => s + 8 + THINK_SEC + (i.audio ? 50 : 0) + GAP_MS / 1000, 0);
    $("#d-sum").innerHTML = chosen.length ? `선택 <b>${chosen.length}문항</b> · 한 바퀴 약 ${Math.max(1, Math.round(sec / 60))}분` : "범위를 선택해주세요";
    $("#d-start").disabled = !chosen.length;
    $("#d-all").textContent = sel.size === items.length ? "전체 해제" : "전체 선택";
    store.set(driveKey("sel"), JSON.stringify([...sel]));
  };
  root.querySelectorAll("[data-topic]").forEach(c => c.onchange = () => {
    const t = DATA.topics.find(x => x.id === c.dataset.topic);
    t.items.forEach(i => c.checked ? sel.add(i.id) : sel.delete(i.id)); refresh();
  });
  root.querySelectorAll("[data-item]").forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.item) : sel.delete(c.dataset.item); refresh(); });
  root.querySelectorAll("[data-exp]").forEach(b => b.onclick = () => {
    const box = root.querySelector(`[data-items="${b.dataset.exp}"]`); box.hidden = !box.hidden; b.classList.toggle("open", !box.hidden);
  });
  $("#d-all").onclick = () => { if (sel.size === items.length) sel.clear(); else items.forEach(i => sel.add(i.id)); refresh(); };
  const seg = (id, key, val) => {
    const el = $(id), set = v => { el.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === v)); store.set(driveKey(key), v); };
    el.querySelectorAll("button").forEach(b => b.onclick = () => set(b.dataset.v)); set(val);
  };
  seg("#d-order", "order", order); seg("#d-loop", "loop", loop);
  $("#d-start").onclick = driveStart;
  refresh();
}

/* ----- 재생 엔진 ----- */
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function buildList() {
  const sel = getSel(); const list = allItems().filter(i => sel.has(i.id));
  return Drive.opts.order === "rand" ? shuffle(list) : list;
}
const alive = my => Drive.running && !Drive.paused && my === Drive.token;
// 취소 가능한 대기: abortWaits() 하면 false로 끝남
const until = fn => new Promise(res => { const done = v => { Drive.waiters.delete(done); res(v); }; Drive.waiters.add(done); fn(done); });
function abortWaits() { [...Drive.waiters].forEach(w => w(false)); }
const sleep = ms => until(done => { setTimeout(() => done(true), ms); });

function keepAlive(on) { if (on) keeper.play().catch(() => {}); else keeper.pause(); }

function driveStart() {
  // 주의: 이 함수 안에서 await 하지 않는다. iOS는 탭(사용자 제스처) 안에서 바로 호출된
  // speechSynthesis.speak / audio.play만 허용하고, 아니면 보류했다가 나중에 재생해서 순서가 꼬인다.
  Drive.opts = { order: getOpt("order", "seq"), loop: getOpt("loop", "stop") };
  Drive.list = buildList(); if (!Drive.list.length) return;
  Drive.running = true; Drive.paused = false; Drive.idx = 0; Drive.phase = "question"; Drive.left = THINK_SEC;
  audio.pause();
  // 녹음용 오디오 재생 권한 열기 (기다리지 않음)
  try { driveAudio.muted = true; driveAudio.src = keeper.src; const pr = driveAudio.play();
        if (pr) pr.then(() => { driveAudio.pause(); driveAudio.muted = false; }).catch(() => { driveAudio.muted = false; }); } catch (e) {}
  wakeOn(); mediaOn();
  renderDrivePlayer();
  runFrom("question");   // 첫 질문 음성이 탭 안에서 바로 시작됨
}

async function runFrom(phase) {
  const my = ++Drive.token; abortWaits();
  const it = Drive.list[Drive.idx];
  if (phase === "question") {
    setPhase("question"); keepAlive(false); driveAudio.pause();
    await sayQuestion(it.question);
    if (!alive(my)) return;
    phase = "think"; Drive.left = THINK_SEC;
  }
  if (phase === "think") {
    setPhase("think"); keepAlive(true);
    while (Drive.left > 0) {
      paintBig();
      const ok = await sleep(1000); if (!ok || !alive(my)) return;
      Drive.left--;
    }
    phase = "answer"; resetModel(it);
  }
  if (phase === "answer") {
    if (it.audio) {
      setPhase("answer"); keepAlive(false);
      const ok = await until(done => {
        const end = () => { driveAudio.onended = driveAudio.onerror = null; done(true); };
        driveAudio.onended = end; driveAudio.onerror = end;
        driveAudio.play().catch(end);
      });
      if (!ok || !alive(my)) return;
      keepAlive(true);
    }
    phase = "gap";
  }
  if (phase === "gap") {
    setPhase("gap"); keepAlive(true);
    const ok = await sleep(GAP_MS); if (!ok || !alive(my)) return;
    driveGoto(Drive.idx + 1);
  }
}
function resetModel(it) {
  driveAudio.muted = false;
  if (!it.audio) return;
  const abs = new URL(it.audio, location.href).href;
  if (driveAudio.src !== abs) driveAudio.src = it.audio;
  try { driveAudio.currentTime = 0; } catch (e) {}
}

function interrupt() { Drive.token++; abortWaits(); TTS.stop(); driveAudio.pause(); driveAudio.onended = driveAudio.onerror = null; }
function driveGoto(i) {
  interrupt();
  if (i >= Drive.list.length) {
    if (Drive.opts.loop === "loop") { Drive.list = buildList(); i = 0; }
    else return driveFinish();
  }
  Drive.idx = Math.max(0, i); Drive.phase = "question"; Drive.left = THINK_SEC;
  resetModel(Drive.list[Drive.idx]);
  if (Drive.paused) { setPhase("question"); return; }
  runFrom("question");
}
function drivePause() {
  if (!Drive.running || Drive.paused) return;
  Drive.paused = true; interrupt(); keepAlive(false);
  if (Drive.phase === "question") Drive.left = THINK_SEC; // 질문 도중이면 질문부터 다시
  setPhase(Drive.phase);
}
function driveResume() {
  if (!Drive.running || !Drive.paused) return;
  Drive.paused = false; keepAlive(true); wakeOn();
  runFrom(Drive.phase);
}
function driveStop() {
  if (!Drive.running) return;
  interrupt(); Drive.running = false; Drive.paused = false; keepAlive(false); wakeOff(); mediaOff();
}
function driveFinish() {
  const n = Drive.list.length; driveStop();
  $("#drive").innerHTML = `
    <div class="dplay done">
      <div class="dp-big">🎉</div>
      <div class="dp-phase">${n}문항 다 들었어요</div>
      <button class="btn primary wide dbig" id="d-again" type="button">한 번 더</button>
      <button class="btn wide" id="d-setup" type="button">범위 다시 고르기</button>
    </div>`;
  $("#d-again").onclick = driveStart; $("#d-setup").onclick = renderDriveSetup;
}

/* ----- 재생 화면 ----- */
const PHASE_LABEL = { question: "질문 듣는 중", think: "소리 내서 답해보세요", answer: "모범답안 (내 녹음)", gap: "다음 문항으로" };
function renderDrivePlayer() {
  $("#drive").innerHTML = `
    <div class="dplay" id="dplay">
      <div class="dp-count" id="dp-count"></div>
      <div class="dp-phase" id="dp-phase"></div>
      <div class="dp-big" id="dp-big"></div>
      <div class="dp-title" id="dp-title"></div>
      <div class="dp-ctrls">
        <button class="dp-btn" id="dp-prev" type="button" aria-label="이전 문항">${dIcon.prev}</button>
        <button class="dp-btn main" id="dp-toggle" type="button" aria-label="일시정지"></button>
        <button class="dp-btn" id="dp-next" type="button" aria-label="다음 문항">${dIcon.next}</button>
      </div>
      <button class="btn wide" id="dp-stop" type="button">종료</button>
    </div>`;
  $("#dp-prev").onclick = () => driveGoto(Drive.idx - 1);
  $("#dp-next").onclick = () => driveGoto(Drive.idx + 1);
  $("#dp-toggle").onclick = () => Drive.paused ? driveResume() : drivePause();
  $("#dp-stop").onclick = () => { driveStop(); renderDriveSetup(); };
}
function setPhase(ph) {
  Drive.phase = ph;
  const box = $("#dplay"); if (!box) return;
  const it = Drive.list[Drive.idx];
  box.dataset.phase = Drive.paused ? "paused" : ph;
  $("#dp-count").textContent = `${Drive.idx + 1} / ${Drive.list.length}`;
  $("#dp-phase").textContent = Drive.paused ? "일시정지" : PHASE_LABEL[ph];
  const reveal = ph === "answer" || ph === "gap";
  $("#dp-title").textContent = reveal ? `${it.topicName} · Q${it.no} ${it.title}` : "";
  $("#dp-toggle").innerHTML = Drive.paused ? dIcon.play : dIcon.pause;
  $("#dp-toggle").setAttribute("aria-label", Drive.paused ? "재생" : "일시정지");
  paintBig(); mediaMeta();
}
function paintBig() {
  const big = $("#dp-big"); if (!big) return;
  const ph = Drive.phase;
  if (ph === "think") big.textContent = Drive.left;
  else if (ph === "answer") big.textContent = fmt(Math.max(0, (driveAudio.duration || 0) - driveAudio.currentTime));
  else if (ph === "question") big.innerHTML = dIcon.speak;
  else big.textContent = "…";
}
driveAudio.addEventListener("timeupdate", () => { if (Drive.running && Drive.phase === "answer") paintBig(); });

/* ----- 화면 켜짐 유지 ----- */
async function wakeOn() { try { if ("wakeLock" in navigator && !(Drive.wake && !Drive.wake.released)) Drive.wake = await navigator.wakeLock.request("screen"); } catch (e) {} }
function wakeOff() { try { Drive.wake && Drive.wake.release(); } catch (e) {} Drive.wake = null; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Drive.running) wakeOn(); });

/* ----- 블루투스·핸들·잠금화면 버튼 ----- */
function mediaOn() {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession, h = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) {} };
  h("play", driveResume); h("pause", drivePause);
  h("nexttrack", () => driveGoto(Drive.idx + 1)); h("previoustrack", () => driveGoto(Drive.idx - 1));
  h("stop", () => { driveStop(); renderDriveSetup(); });
}
function mediaOff() {
  if (!("mediaSession" in navigator)) return;
  ["play", "pause", "nexttrack", "previoustrack", "stop"].forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch (e) {} });
  try { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = "none"; } catch (e) {}
}
function mediaMeta() {
  if (!("mediaSession" in navigator) || !Drive.running) return;
  const it = Drive.list[Drive.idx], reveal = Drive.phase === "answer" || Drive.phase === "gap";
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: reveal ? `Q${it.no} ${it.title}` : `${Drive.idx + 1} / ${Drive.list.length} · ${PHASE_LABEL[Drive.phase]}`,
      artist: "OPIc 노트 · 드라이브", album: reveal ? it.topicName : "",
      artwork: [{ src: new URL("icons/icon-512.png", location.href).href, sizes: "512x512", type: "image/png" }]
    });
    navigator.mediaSession.playbackState = Drive.paused ? "paused" : "playing";
  } catch (e) {}
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
  openSheet(false); driveStop(); Auth.logout(); audio.pause(); stopTimer();
  DATA = { topics: [] }; byId.clear();
  history.replaceState(null, "", location.pathname);
  showAuth();
};
function showAuth() {
  document.body.classList.add("authing");
  loadAudio(null);
  ["list", "detail", "practice", "drive"].forEach(n => $("#screen-" + n).hidden = true);
  $("#screen-auth").hidden = false;
  setAuthMode(Object.keys(Auth.accounts()).length ? "login" : "signup");
}

/* ---------- router ---------- */
function show(name) {
  $("#screen-auth").hidden = true; document.body.classList.remove("authing");
  ["list", "detail", "practice", "drive"].forEach(n => $("#screen-" + n).hidden = n !== name);
  document.querySelectorAll(".tab").forEach(a => a.classList.toggle("on",
    a.dataset.tab === (name === "practice" || name === "drive" ? name : "list")));
}
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === "drive" && Drive.running) { show("drive"); return; }  // 재생 중엔 그대로 유지
  driveStop();
  TTS.stop();
  if (!Auth.current()) { showAuth(); return; }
  if (h === "drive") { loadAudio(null); stopTimer(); show("drive"); renderDriveSetup(); window.scrollTo(0, 0); return; }
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
  // 새 서비스워커가 페이지를 넘겨받으면(=새 버전 배포) 한 번 새로고침해서 최신 코드로 전환
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true; location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then(reg => { reg.update().catch(() => {}); })
      .catch(() => {});
  });
}
