/* oreum 미션 인증 프로토타입
   흐름: 홈 → 활동 시작하기 → 카메라(실제 카메라) → 촬영 → 인증 확인 중 → 인증 완료(포인트) → 연속활동 갱신 → 홈(갱신 반영) */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const app = $('#app');

  const GOAL = 7;                 // 다음 단계까지 필요한 연속 일수 (홈 카드의 점 7개)
  const BASE = { streak: 2, total: 23000, homeBar: 58 };
  const REWARD = { won: 1400, point: 1000, bonus: 200 };

  const state = {
    done: false,                  // 오늘 미션 인증 완료 여부
    celebrate: false,             // 홈으로 돌아갈 때 갱신 애니메이션을 보여줄지
    total: BASE.total,
    photo: null, photoTime: null,
    facing: 'environment', stream: null,
    z: 1, frame: false,
    calMonth: null,
  };
  const streakNow = () => BASE.streak + (state.done ? 1 : 0);

  /* ───────── 레이아웃: 402×874 Figma 좌표계를 기기에 맞춰 확대·축소 ───────── */
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const frame = vw >= 560;      // 데스크톱·태블릿: 폰 프레임 미리보기
    let z, H, left = 0, top = 0;
    if (frame) {
      H = 874;
      z = Math.min(1, (vh - 48) / 874, (vw - 48) / 402);
      left = (vw - 402 * z) / 2; top = (vh - 874 * z) / 2;
    } else {
      z = vw / 402; H = vh / z;
      if (H < 700) { z = vh / 700; H = 700; left = (vw - 402 * z) / 2; }
    }
    state.z = z; state.frame = frame;
    document.body.classList.toggle('frame', frame);
    app.style.setProperty('--H', H.toFixed(2));
    app.style.transform = `translate(${left}px, ${top}px) scale(${z})`;
    syncBodyBg();
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 250));

  /* ───────── 공통 UI 주입: 상태바(미리보기 전용) · 탭바 ───────── */
  const sbTpl = $('#tpl-statusbar');
  $$('.screen').forEach((sc) => {
    const sb = sbTpl.content.firstElementChild.cloneNode(true);
    const dir = sc.dataset.sb === 'light' ? 'camera' : 'home';
    sb.querySelector('.sb-cell').src = `assets/${dir}/cell.svg`;
    sb.querySelector('.sb-wifi').src = `assets/${dir}/wifi.svg`;
    sb.querySelector('.sb-batt').src = `assets/${dir}/battery.svg`;
    sc.prepend(sb);
  });

  const TABS = [
    { id: 'home', label: '홈', on: 'assets/home/tab-home.svg', off: 'assets/activity/tab-home.svg' },
    { id: 'activity', label: '활동', on: 'assets/activity/tab-activity.svg', off: 'assets/home/tab-activity.svg' },
    { id: 'chapter', label: '챕터', off: 'assets/home/tab-chapter.svg' },
    { id: 'reward', label: '보상', off: 'assets/home/tab-reward.svg' },
    { id: 'my', label: '마이', off: 'assets/home/tab-my.svg' },
  ];
  $$('.tabs').forEach((nav) => {
    const active = nav.dataset.active;
    nav.innerHTML = '<div class="tabs-inner">' + TABS.map((t) => {
      const on = t.id === active;
      return `<button class="tab${on ? ' on' : ''}" data-tab="${t.id}" aria-label="${t.label}">
        <span class="tab-ic"><img src="${on ? t.on : t.off}" alt=""></span>
        <span class="tab-lb">${t.label}</span></button>`;
    }).join('') + '</div>';
  });

  /* ───────── 토스트 ───────── */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg, ms = 2200) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  /* ───────── 화면 전환 ───────── */
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const ANIM = {
    fade: { d: 260, in: [{ opacity: 0 }, { opacity: 1 }] },
    up: { d: 380, in: [{ transform: 'translateY(100%)' }, { transform: 'none' }] },
    down: { d: 340, out: [{ transform: 'none' }, { transform: 'translateY(100%)' }], outOnTop: true },
    push: { d: 360, in: [{ transform: 'translateX(100%)' }, { transform: 'none' }], out: [{ transform: 'none' }, { transform: 'translateX(-28%)' }] },
  };
  let current = 'home';

  function syncBodyBg() {
    const dark = $('#' + current).classList.contains('dark');
    document.body.classList.toggle('bg-dark', dark && !state.frame);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#1c1612' : '#ffffff';
  }

  function go(id, kind = 'fade') {
    if (id === current) return;
    const from = $('#' + current), to = $('#' + id);
    const a = ANIM[kind] || ANIM.fade;
    leave(current, id);
    to.classList.add('active');
    from.style.zIndex = a.outOnTop ? 3 : 1;
    to.style.zIndex = a.outOnTop ? 1 : 3;
    const opts = { duration: a.d, easing: EASE };
    let anim = null;
    if (a.in) anim = to.animate(a.in, opts);
    if (a.out) {
      const o = from.animate(a.out, { ...opts, fill: 'forwards' });
      anim = anim || o;
    }
    const prev = current;
    current = id;
    syncBodyBg();
    const cleanup = () => {
      if (current !== prev) from.classList.remove('active');
      from.getAnimations().forEach((x) => x.cancel());
      from.style.zIndex = ''; to.style.zIndex = '';
    };
    if (anim) anim.onfinish = cleanup; else cleanup();
    enter(id, prev);
  }

  function enter(id, prev) {
    if (id === 'camera') startCamera();
    if (id === 'loading') startVerify();
    if (id === 'done') showDone();
    if (id === 'streak') showStreak();
    if (id === 'home' && state.celebrate) setTimeout(celebrateHome, 380);
    if (id === 'activity') renderActivity();
    if (id === 'home' && prev !== 'activity') setSheet(SHEET_MAX, false);
  }
  function leave(id, next) {
    if (id === 'camera') stopCamera();
    if (id === 'loading') clearTimeout(verifyTimer);
  }

  /* ───────── 홈: 바텀시트 ───────── */
  const sheet = $('#sheet'), dim = $('#sheetDim'), more = $('.sheet-more');
  const SHEET_MAX = 189;          // 펼친 상태(top 295) ↔ 접힌 상태(top 484) 거리
  let sheetY = SHEET_MAX;

  function setSheet(y, animate = true) {
    sheetY = Math.max(0, Math.min(SHEET_MAX, y));
    const tr = animate ? `transform .38s ${EASE}` : 'none';
    sheet.style.transition = tr;
    dim.style.transition = animate ? `opacity .38s ${EASE}` : 'none';
    more.style.transition = dim.style.transition;
    sheet.style.transform = `translateY(${sheetY}px)`;
    const p = 1 - sheetY / SHEET_MAX;
    dim.style.opacity = p;
    more.style.opacity = p;
    dim.style.pointerEvents = sheetY < SHEET_MAX ? 'auto' : 'none';
    sheet.classList.toggle('expanded', sheetY === 0);
  }

  let drag = null, suppressClick = false;
  sheet.addEventListener('pointerdown', (e) => {
    drag = { y0: e.clientY, s0: sheetY, t0: performance.now(), moved: false, id: e.pointerId, last: e.clientY, lt: performance.now(), v: 0 };
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = (e.clientY - drag.y0) / state.z;
    if (!drag.moved && Math.abs(dy) > 6) {
      drag.moved = true;
      try { sheet.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    }
    if (!drag.moved) return;
    const now = performance.now();
    drag.v = (e.clientY - drag.last) / state.z / Math.max(1, now - drag.lt);
    drag.last = e.clientY; drag.lt = now;
    let y = drag.s0 + dy;
    if (y < 0) y = y / 4;                        // 위로 당길 때 고무줄
    if (y > SHEET_MAX) y = SHEET_MAX + (y - SHEET_MAX) / 4;
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${y}px)`;
    const p = 1 - Math.max(0, Math.min(SHEET_MAX, y)) / SHEET_MAX;
    dim.style.transition = more.style.transition = 'none';
    dim.style.opacity = more.style.opacity = p;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.moved) {
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 60);
      const cur = d.s0 + (e.clientY - d.y0) / state.z;
      const target = Math.abs(d.v) > 0.35 ? (d.v < 0 ? 0 : SHEET_MAX) : (cur < SHEET_MAX / 2 ? 0 : SHEET_MAX);
      setSheet(target);
    } else if (e.target.closest('.sheet-handle')) {
      setSheet(sheetY === 0 ? SHEET_MAX : 0);
    }
  };
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);
  sheet.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  dim.addEventListener('click', () => setSheet(SHEET_MAX));

  /* ───────── 홈: 상태 반영 ───────── */
  const fmt = (n) => n.toLocaleString('ko-KR');
  const startBtn = $('#startBtn');

  function renderHome() {
    $('#homeChipNum').textContent = streakNow();
    $('#todayDot').classList.toggle('done', state.done);
    $('#homeBarFill').style.width = (state.done ? BASE.homeBar + 343 / GOAL : BASE.homeBar) + 'px';
    $('#totalPoint').textContent = fmt(state.total);
    startBtn.textContent = state.done ? '오늘의 오름 완료' : '활동 시작하기';
    startBtn.classList.toggle('completed', state.done);
  }

  function pop(el, from = 0.3) {
    el.animate([
      { transform: `scale(${from})`, opacity: 0 },
      { transform: 'scale(1.18)', opacity: 1, offset: 0.6 },
      { transform: 'scale(1)', opacity: 1 },
    ], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' });
  }
  function bump(el) {
    el.animate([
      { transform: 'translateY(0)' }, { transform: 'translateY(-6px) scale(1.25)' }, { transform: 'translateY(0)' },
    ], { duration: 460, easing: 'ease-out' });
  }

  function celebrateHome() {
    if (!state.celebrate || current !== 'home') return;
    state.celebrate = false;
    const chipNum = $('#homeChipNum');
    chipNum.textContent = BASE.streak;
    $('#todayDot').classList.remove('done');
    $('#homeBarFill').style.width = BASE.homeBar + 'px';
    requestAnimationFrame(() => {
      renderHome();
      pop($('#todayDot .today-check'));
      bump(chipNum);
      $('#homeChip').animate([{ boxShadow: '0 0 0 0 rgba(255,106,0,.45)' }, { boxShadow: '0 0 0 10px rgba(255,106,0,0)' }], { duration: 800 });
    });
  }

  startBtn.addEventListener('click', () => {
    if (state.done) { toast('오늘의 오름은 완료했어요. 로고를 길게 누르면 처음부터 다시 볼 수 있어요', 2800); return; }
    go('camera', 'up');
  });

  // 로고 길게 누르기 → 처음 상태로 (전시·시연 반복용)
  let lp;
  const logo = $('#logo');
  logo.addEventListener('pointerdown', () => { lp = setTimeout(resetAll, 700); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => logo.addEventListener(ev, () => clearTimeout(lp)));
  logo.addEventListener('contextmenu', (e) => e.preventDefault());
  function resetAll() {
    Object.assign(state, { done: false, celebrate: false, total: BASE.total, photo: null, photoTime: null, calMonth: null });
    renderHome(); setSheet(SHEET_MAX);
    toast('처음 상태로 돌렸어요');
  }

  /* ───────── 카메라 ───────── */
  const vf = $('#viewfinder'), video = $('#camVideo'), shotImg = $('#camShot'), fallbackImg = $('#camFallback');
  const camMsg = $('#camMsg'), camMsgText = $('#camMsgText'), shutter = $('#shutter');
  let camSeq = 0;

  function showMsg(text, { center = false, retry = false } = {}) {
    camMsgText.textContent = text;
    camMsg.classList.add('show');
    camMsg.classList.toggle('center', center);
    camMsg.classList.toggle('retry', retry);
  }
  const hideMsg = () => camMsg.classList.remove('show');

  function stopCamera() {
    camSeq++;
    if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
    video.srcObject = null;
  }

  async function startCamera() {
    stopCamera();
    const seq = camSeq;
    vf.classList.remove('shot', 'fallback');
    shutter.disabled = false;
    showMsg('카메라를 켜는 중이에요…', { center: true });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      useFallback(window.isSecureContext ? '이 브라우저에서는 카메라를 쓸 수 없어요.' : '카메라는 https 주소에서만 켤 수 있어요.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: state.facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
      if (seq !== camSeq || current !== 'camera') { stream.getTracks().forEach((t) => t.stop()); return; }
      state.stream = stream;
      video.srcObject = stream;
      const track = stream.getVideoTracks()[0];
      const fm = (track.getSettings && track.getSettings().facingMode) || state.facing;
      video.classList.toggle('mirror', fm === 'user');
      await video.play().catch(() => {});
      if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
      if (seq === camSeq) hideMsg();
    } catch (err) {
      if (seq !== camSeq) return;
      const name = err && err.name;
      const msg = name === 'NotAllowedError' || name === 'SecurityError'
        ? '카메라 권한이 꺼져 있어요. 설정 › Safari › 카메라에서 허용해 주세요.'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? '사용할 수 있는 카메라가 없어요.'
          : '카메라를 켜지 못했어요.';
      useFallback(msg);
    }
  }

  function useFallback(msg) {
    vf.classList.add('fallback');
    showMsg(msg + '\n지금은 예시 사진으로 진행할 수 있어요.', { retry: true });
    camMsgText.style.whiteSpace = 'pre-line';
  }

  function capture() {
    const isFallback = vf.classList.contains('fallback');
    const src = isFallback ? fallbackImg : video;
    const sw = isFallback ? fallbackImg.naturalWidth : video.videoWidth;
    const sh = isFallback ? fallbackImg.naturalHeight : video.videoHeight;
    if (!sw || !sh) { toast('카메라가 아직 준비되지 않았어요'); return; }
    shutter.disabled = true;

    const cw = vf.clientWidth * 2, ch = vf.clientHeight * 2;   // 보이는 영역 그대로(cover) 저장
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const r = Math.max(cw / sw, ch / sh);
    const dw = sw * r, dh = sh * r;
    if (!isFallback && video.classList.contains('mirror')) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
    ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    state.photo = canvas.toDataURL('image/jpeg', 0.85);
    state.photoTime = new Date();

    shotImg.src = state.photo;
    vf.classList.add('shot');
    hideMsg();
    stopCamera();
    $('#camFlash').animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
    setTimeout(() => { if (current === 'camera') go('loading', 'fade'); }, 650);
  }

  shutter.addEventListener('click', capture);
  $('#camRetry').addEventListener('click', startCamera);
  $('#camClose').addEventListener('click', () => go('home', 'down'));
  $('#flip').addEventListener('click', (e) => {
    state.facing = state.facing === 'environment' ? 'user' : 'environment';
    e.currentTarget.classList.toggle('spin');
    startCamera();
  });

  /* ───────── 인증 확인 중 ───────── */
  let verifyTimer;
  function startVerify() {
    clearTimeout(verifyTimer);
    verifyTimer = setTimeout(() => { if (current === 'loading') go('done', 'fade'); }, 2600);
  }
  $('#cancelVerify').addEventListener('click', () => go('camera', 'fade'));

  /* ───────── 인증 완료 · 포인트 ───────── */
  function countUp(el, to, fmtFn, delay = 0, dur = 900) {
    el.textContent = fmtFn(0);
    setTimeout(() => {
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmtFn(Math.round(to * e / 10) * 10);
        if (p < 1) requestAnimationFrame(step); else el.textContent = fmtFn(to);
      };
      requestAnimationFrame(step);
    }, delay);
  }
  const FMT = { won: (n) => `${fmt(n)}원`, plus: (n) => `+${fmt(n)}P` };

  function showDone() {
    if (!state.done) {
      state.done = true;
      state.total += REWARD.point + REWARD.bonus;
      state.celebrate = true;
      renderHomeQuiet();
    }
    const scr = $('#done');
    pop($('.dn-mascot', scr), 0.5);
    [$('.dn-title', scr), $('.dn-sub', scr), $('.reward-box', scr)].forEach((el, i) => {
      el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, delay: 120 + i * 90, easing: EASE, fill: 'backwards' });
    });
    $$('.rw-val', scr).forEach((el, i) => countUp(el, +el.dataset.count, FMT[el.dataset.fmt], 450 + i * 160));
  }
  // 홈 화면은 보이지 않을 때 값만 바꿔 두고, 돌아올 때 celebrateHome이 애니메이션을 보여 준다
  function renderHomeQuiet() { $('#totalPoint').textContent = fmt(state.total); }

  $('#toStreak').addEventListener('click', () => go('streak', 'push'));

  /* ───────── 연속활동 갱신 ───────── */
  function showStreak() {
    const before = BASE.streak, after = streakNow();
    const scr = $('#streak');
    $('#stTitleNum').textContent = after;
    const days = $('#stDays'), left = $('#stLeft'), fill = $('#stBarFill');
    days.textContent = before; left.textContent = GOAL - before;
    fill.style.transition = 'none';
    fill.style.width = (342 * before / GOAL) + 'px';
    pop($('.st-mascot', scr), 0.5);
    setTimeout(() => {
      if (current !== 'streak') return;
      fill.style.transition = `width .9s ${EASE}`;
      fill.style.width = (342 * after / GOAL) + 'px';
      setTimeout(() => {
        days.textContent = after; left.textContent = GOAL - after;
        bump(days); bump(left);
      }, 380);
    }, 520);
  }

  /* ───────── 활동 탭 · 캘린더 ───────── */
  const COLS = [51.5, 101.5, 151.5, 201.5, 251.5, 301.5, 351.5];
  const ROW0 = 267, ROWH = 42, WD_Y = 230;   // act-scroll 기준 좌표 (디자인 y − 120)
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  function renderActivity() {
    const today = new Date();
    if (!state.calMonth) state.calMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const y = state.calMonth.getFullYear(), m = state.calMonth.getMonth();
    const n = streakNow();
    const doneSet = new Set();
    for (let i = 0; i < n; i++) {
      const d = new Date(today); d.setDate(today.getDate() - (state.done ? i : i + 1));
      doneSet.add(dayKey(d));
    }
    const first = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const rows = Math.ceil((first + dim) / 7);
    let html = '';
    ['일', '월', '화', '수', '목', '금', '토'].forEach((w, i) => {
      html += `<span class="cal-num wd" style="left:${COLS[i]}px;top:${WD_Y}px">${w}</span>`;
    });
    // 이어진 활동 막대
    for (let r = 0; r < rows; r++) {
      let runStart = null;
      for (let c = 0; c <= 7; c++) {
        const dnum = r * 7 + c - first + 1;
        const on = c < 7 && dnum >= 1 && dnum <= dim && doneSet.has(dayKey(new Date(y, m, dnum)));
        if (on && runStart === null) runStart = c;
        if (!on && runStart !== null) {
          const l = COLS[runStart] - 17, w = COLS[c - 1] + 16 - l;
          html += `<span class="cal-pill" style="left:${l}px;top:${ROW0 + r * ROWH - 15}px;width:${w}px"></span>`;
          runStart = null;
        }
      }
    }
    for (let d = 1; d <= dim; d++) {
      const idx = first + d - 1, r = Math.floor(idx / 7), c = idx % 7;
      const date = new Date(y, m, d);
      const isToday = dayKey(date) === dayKey(today);
      const cx = COLS[c], cy = ROW0 + r * ROWH;
      if (isToday) html += `<span class="cal-today" style="left:${cx - 15}px;top:${cy - 15}px"></span>`;
      const cls = isToday ? 'today' : doneSet.has(dayKey(date)) ? 'on' : '';
      html += `<span class="cal-num ${cls}" style="left:${cx}px;top:${cy}px">${d}</span>`;
    }
    $('#cal').innerHTML = html;

    const extra = (rows - 5) * ROWH;   // 6주짜리 달이면 아래 요소를 한 줄 내림
    $('.cal-legend').style.top = (461 + extra) + 'px';
    $('#actDayLabel').style.top = (513 + extra) + 'px';
    $('#actCard').style.top = (547 + extra) + 'px';
    $('.act-scroll').style.setProperty('--extra', extra);
    $('#calMonth').textContent = `${y}년 ${m + 1}월`;
    $('#actDays').textContent = n;
    $('.ah-sub').textContent = state.done ? '오늘도 작은 실천을 쌓았어요' : '오늘의 오름을 기다리고 있어요';
    $('#actDayLabel').textContent = `${today.getMonth() + 1}월 ${today.getDate()}일 · 오늘`;
    const card = $('#actCard');
    card.classList.toggle('done', state.done);
    if (state.done && state.photoTime) {
      const t = state.photoTime, h = t.getHours();
      const ampm = h < 12 ? '오전' : '오후';
      $('#actCardSub').textContent = `${ampm} ${h % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')} 사진 인증 완료`;
    } else {
      $('#actCardSub').textContent = state.done ? '사진 인증 완료' : '아직 인증 전이에요';
    }
  }
  $('#calPrev').addEventListener('click', () => { state.calMonth.setMonth(state.calMonth.getMonth() - 1); renderActivity(); });
  $('#calNext').addEventListener('click', () => { state.calMonth.setMonth(state.calMonth.getMonth() + 1); renderActivity(); });

  $('#actCard').addEventListener('click', () => {
    if (!state.done) { toast('홈에서 오늘의 오름을 인증해 보세요'); return; }
    if (!state.photo) return;
    $('#photoViewImg').src = state.photo;
    $('#photoView').classList.add('show');
  });
  $('#photoView').addEventListener('click', () => $('#photoView').classList.remove('show'));

  /* ───────── 공통 이벤트 ───────── */
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      const id = tab.dataset.tab;
      if (id === 'home' || id === 'activity') go(id, 'fade');
      else toast('이 프로토타입에서는 홈·활동 탭만 열려요');
      return;
    }
    const goEl = e.target.closest('[data-go]');
    if (goEl) { go(goEl.dataset.go, 'push'); return; }
    if (e.target.closest('[data-home]')) { go('home', 'fade'); return; }
    const t = e.target.closest('[data-toast]');
    if (t) toast(t.dataset.toast);
  });
  // 핀치 확대 방지
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  /* ───────── 홈 화면 추가 안내 · 오프라인 캐시 ───────── */
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function maybeShowA2HS() {
    let dismissed = false;
    try { dismissed = localStorage.getItem('oreum-a2hs') === '1'; } catch (_) { /* noop */ }
    if (isIOS && !standalone && !state.frame && !dismissed) $('#a2hs').hidden = false;
  }
  $('#a2hsClose').addEventListener('click', () => {
    $('#a2hs').hidden = true;
    try { localStorage.setItem('oreum-a2hs', '1'); } catch (_) { /* noop */ }
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // 다음 화면 이미지 미리 불러오기
  ['assets/loading/mascot.png', 'assets/done/mascot.png', 'assets/streak/mascot-crop.png', 'assets/camera/mascot.png', 'assets/activity/hedgehog.png']
    .forEach((s) => { const i = new Image(); i.src = s; });

  /* ───────── 시작 ───────── */
  layout();
  $('#home').classList.add('active');
  renderHome();
  setSheet(SHEET_MAX, false);
  syncBodyBg();
  maybeShowA2HS();

  // 개발 확인용: ?screen=done 처럼 특정 화면으로 바로 이동
  const q = new URLSearchParams(location.search).get('screen');
  if (q && $('#' + q)) { if (q === 'streak' || q === 'done') state.photoTime = new Date(); go(q, 'fade'); }
  if (new URLSearchParams(location.search).has('sheet')) setSheet(0, false);
})();
