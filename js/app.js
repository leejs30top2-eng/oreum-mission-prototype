/* oreum 전시용 프로토타입 (Figma '중간-끝' 프로토타입 페이지 기준)
   시작: 홈(+첫 진입 온보딩) → 미션 카메라 → 인증 확인 → 인증 완료 → 챕터 / 보너스·부활 미션 / 챕터 지도 → 배경 해금 →
   꾸미기 / 활동 / 보상(내역·환급 모드) / 마이(프로필). 자가진단·로그인은 제외. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const app = $('#app');

  const GOAL = 7;
  const BASE = { streak: 2, total: 23000, homeBar: 58, refund: 30000 };
  const PAY = 1200;               // 미션 리워드 1,000P + 연속 보너스 200P

  const MISSIONS = {
    main: { title: '이불 정리하기', sub: '이불을 갠 모습이 화면에 보이게 찍어주세요', sample: 'assets/camera/sample.jpg', cls: '' },
    bonus: { title: '편의점에서 라면먹기', sub: '라면 먹는 모습이 화면에 보이게 찍어주세요', icon: 'assets/bonus/ramen.png', sample: 'assets/bonus/sample.jpg', cls: 'm-bonus' },
    rev: { title: '버스정류장 다녀오기', sub: '버스정류장이 화면에 보이게 찍어주세요', icon: 'assets/revival/bus.png', sample: 'assets/revival/sample.jpg', cls: 'm-rev' },
  };
  const HISTORY_NAME = { main: '이불 정리하기', bonus: '편의점에서 라면 먹기', rev: '버스정류장 다녀오기', walk: '집 근처 10분 산책하기' };

  const freshState = () => ({
    done: false, bonusDone: false, walkDone: false,
    revMode: false, revDone: false,
    celebrate: false,
    total: BASE.total, refund: BASE.refund, widget: false,
    bg: 'tree', wear: null, prop: null,
    history: [],
    photo: null, photoTime: null,
    calMonth: null,
  });
  const state = Object.assign(freshState(), { facing: 'environment', stream: null, z: 1, frame: false, mission: 'main', streakFrom: 2, streakTo: 3 });
  const streakNow = () => (state.revMode ? (state.revDone ? 11 : 10) : BASE.streak + (state.done ? 1 : 0));

  /* ───────── 레이아웃: 402×874 Figma 좌표계를 기기에 맞춰 확대·축소 ───────── */
  // 홈 화면 앱(black-translucent): iOS가 문서를 상태바 높이만큼 짧게 계산(874→812) → 상태바 높이만큼 늘린다.
  const safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden;pointer-events:none';
  document.body.appendChild(safeProbe);
  const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const frame = vw >= 560;
    let z, H, left = 0, top = 0, docH = vh;
    state.legacyInstall = false;
    if (isStandalone() && vw < vh) {
      const safeTop = safeProbe.offsetHeight;
      const screenH = Math.max(screen.width, screen.height);
      if (safeTop >= 1) docH = Math.min(vh + safeTop, Math.max(vh, screenH));
      else state.legacyInstall = true;
    }
    document.documentElement.style.setProperty('--doc-h', docH.toFixed(2));
    if (frame) {
      H = 874;
      z = Math.min(1, (vh - 48) / 874, (vw - 48) / 402);
      left = (vw - 402 * z) / 2; top = (vh - 874 * z) / 2;
    } else {
      z = vw / 402; H = docH / z;
      if (H < 700) { z = docH / 700; H = 700; left = (vw - 402 * z) / 2; }
    }
    state.z = z; state.frame = frame; state.H = H;
    document.body.classList.toggle('frame', frame);
    app.style.setProperty('--H', H.toFixed(2));
    app.style.transform = `translate(${left}px, ${top}px) scale(${z})`;
    syncBodyBg();
    if (!$('#onb').hidden) drawOnb();
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 250));

  // 페이지 자체는 스크롤되지 않게 고정 (내부 스크롤 영역만 허용)
  const SCROLLERS = '.act-scroll, .map, .rd-scroll, .rh-list, .my-scroll';
  window.addEventListener('scroll', () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    const sc = e.target.closest && e.target.closest(SCROLLERS);
    if (!sc || sc.scrollHeight <= sc.clientHeight) e.preventDefault();
  }, { passive: false });

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
    { id: 'chapter', label: '챕터', on: 'assets/tabs/chapter-on.svg', off: 'assets/home/tab-chapter.svg' },
    { id: 'reward', label: '보상', on: 'assets/tabs/reward-on.svg', off: 'assets/home/tab-reward.svg' },
    { id: 'my', label: '마이', on: 'assets/tabs/my-on.svg', off: 'assets/home/tab-my.svg' },
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
    fade: { d: 240, in: [{ opacity: 0 }, { opacity: 1 }] },
    up: { d: 380, in: [{ transform: 'translateY(100%)' }, { transform: 'none' }] },
    down: { d: 340, out: [{ transform: 'none' }, { transform: 'translateY(100%)' }], outOnTop: true },
    push: { d: 340, in: [{ transform: 'translateX(100%)' }, { transform: 'none' }], out: [{ transform: 'none' }, { transform: 'translateX(-28%)' }] },
    pop: { d: 320, in: [{ transform: 'translateX(-28%)' }, { transform: 'none' }], out: [{ transform: 'none' }, { transform: 'translateX(100%)' }], outOnTop: true },
  };
  const ROOTS = ['home', 'activity', 'chapter', 'reward', 'my'];
  let current = 'home';
  let stack = [];

  function syncBodyBg() {
    const dark = $('#' + current).classList.contains('dark');
    document.body.classList.toggle('bg-dark', dark && !state.frame);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#1c1612' : '#ffffff';
  }

  function go(id, kind = 'fade', opts = {}) {
    if (id === current) { enter(id, current); return; }
    const from = $('#' + current), to = $('#' + id);
    if (!to) return;
    if (opts.root || ROOTS.includes(id) && kind === 'fade' && opts.tab) stack = [];
    else if (!opts.isBack) stack.push(current);
    const a = ANIM[kind] || ANIM.fade;
    leave(current, id);
    to.classList.add('active');
    from.style.zIndex = a.outOnTop ? 3 : 1;
    to.style.zIndex = a.outOnTop ? 1 : 3;
    const o = { duration: a.d, easing: EASE };
    let anim = null;
    if (a.in) anim = to.animate(a.in, o);
    if (a.out) { const x = from.animate(a.out, { ...o, fill: 'forwards' }); anim = anim || x; }
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
  function back() {
    const prev = stack.pop() || 'home';
    go(prev, 'pop', { isBack: true });
  }
  const goHome = () => { stack = []; go('home', 'fade', { root: true }); };

  function enter(id, prev) {
    if (id === 'home') {
      renderHome();
      if (prev !== 'activity' && prev !== 'home') setSheet(SHEET_MAX, false);
      if (state.celebrate) setTimeout(celebrateHome, 380);
    }
    if (id === 'camera') prepareCamera();
    if (id === 'loading') startVerify();
    if (id === 'done') showDone();
    if (id === 'fail') pop($('.fl-mascot'), 0.6);
    if (id === 'streak') showStreak();
    if (id === 'activity') renderActivity();
    if (id === 'chapter') enterChapter(prev);
    if (id === 'unlock') pop($('.ul-img'), 0.6);
    if (id === 'walk') startWalk();
    if (id === 'deco') enterDeco();
    if (id === 'reward' || id === 'rhist') renderReward();
    if (id === 'rhist') renderHistory();
    if (id === 'refund') enterRefund();
    if (id === 'revonb') pop($('.ro-mascot'), 0.6);
  }
  function leave(id) {
    if (id === 'camera') stopCamera();
    if (id === 'loading') clearTimeout(verifyTimer);
    if (id === 'walk') stopWalk();
    closeModals();
  }

  /* ───────── 공용 애니메이션 ───────── */
  function pop(el, from = 0.3) {
    if (!el) return;
    el.animate([
      { transform: `scale(${from})`, opacity: 0 },
      { transform: 'scale(1.12)', opacity: 1, offset: 0.6 },
      { transform: 'scale(1)', opacity: 1 },
    ], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' });
  }
  function bump(el) {
    el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px) scale(1.25)' }, { transform: 'translateY(0)' }], { duration: 460, easing: 'ease-out' });
  }
  const fmt = (n) => n.toLocaleString('ko-KR');

  /* ───────── 장면: 배경·착용·소품 (홈·꾸미기 공통) ───────── */
  const BG = {
    tree: { src: 'assets/home/bg.jpg', l: '-0.99%', t: '-0.04%', w: '100.99%', h: '100.08%' },
    xmas: { src: 'assets/deco/bg-xmas.jpg', l: '-0.03%', t: '-35.36%', w: '100.07%', h: '135.36%' },
    concert: { src: 'assets/deco/bg-concert.jpg', l: '-0.05%', t: '0%', w: '100.1%', h: '141.52%' },
    park: { src: 'assets/deco/bg-park.jpg', l: '0%', t: '0%', w: '100%', h: '100%' },
    aquarium: { src: 'assets/deco/bg-aquarium.jpg', l: '-7.98%', t: '-24.4%', w: '115.94%', h: '156.94%' },
    cinema: { src: 'assets/deco/bg-cinema.jpg', l: '-0.13%', t: '-0.108%', w: '100.13%', h: '134.79%' },
  };
  const WEAR = { goggle: 'w-goggle', '4d': 'w-4d', band: 'w-band', glasses: 'w-glasses', santa: 'w-santa' };
  const PROP = { sotteok: 'p-sotteok', popcorn: 'p-popcorn', cola: 'p-cola', stick: 'p-stick', ticket: 'p-ticket' };

  function renderScene(root, cfg) {
    const b = BG[cfg.bg] || BG.tree;
    const img = $('.scene-bg', root);
    if (img.getAttribute('src') !== b.src) img.src = b.src;
    Object.assign(img.style, { left: b.l, top: b.t, width: b.w, height: b.h });
    const slot = $('.wear-slot', root);
    let html = '';
    if (cfg.wear) html += `<div class="wear ${WEAR[cfg.wear]}"><img src="assets/deco/${WEAR[cfg.wear]}.png" alt=""></div>`;
    if (cfg.prop) html += `<div class="prop ${PROP[cfg.prop]}"><img src="assets/deco/${PROP[cfg.prop]}.png" alt=""></div>`;
    slot.innerHTML = html;
  }

  /* ───────── 홈: 바텀시트 ───────── */
  const sheet = $('#sheet'), dim = $('#sheetDim'), more = $('.sheet-more');
  const SHEET_MAX = 189;
  let sheetY = SHEET_MAX;

  function setSheet(y, animate = true) {
    sheetY = Math.max(0, Math.min(SHEET_MAX, y));
    const tr = animate ? `opacity .38s ${EASE}` : 'none';
    sheet.style.transition = animate ? `transform .38s ${EASE}` : 'none';
    dim.style.transition = more.style.transition = tr;
    sheet.style.transform = `translateY(${sheetY}px)`;
    const p = 1 - sheetY / SHEET_MAX;
    dim.style.opacity = more.style.opacity = p;
    dim.style.pointerEvents = sheetY < SHEET_MAX ? 'auto' : 'none';
    sheet.classList.toggle('expanded', sheetY === 0);
  }

  let drag = null, suppressClick = false;
  sheet.addEventListener('pointerdown', (e) => {
    drag = { y0: e.clientY, s0: sheetY, moved: false, id: e.pointerId, last: e.clientY, lt: performance.now(), v: 0 };
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
    if (y < 0) y /= 4;
    if (y > SHEET_MAX) y = SHEET_MAX + (y - SHEET_MAX) / 4;
    sheet.style.transition = dim.style.transition = more.style.transition = 'none';
    sheet.style.transform = `translateY(${y}px)`;
    dim.style.opacity = more.style.opacity = 1 - Math.max(0, Math.min(SHEET_MAX, y)) / SHEET_MAX;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.moved) {
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 60);
      const cur = d.s0 + (e.clientY - d.y0) / state.z;
      setSheet(Math.abs(d.v) > 0.35 ? (d.v < 0 ? 0 : SHEET_MAX) : (cur < SHEET_MAX / 2 ? 0 : SHEET_MAX));
    } else if (e.target.closest('.sheet-handle')) {
      setSheet(sheetY === 0 ? SHEET_MAX : 0);
    }
  };
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);
  sheet.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  dim.addEventListener('click', () => setSheet(SHEET_MAX));

  /* ───────── 홈: 상태 반영 ───────── */
  const startBtn = $('#startBtn');
  function renderTotals() { $$('.js-total').forEach((el) => { el.textContent = fmt(state.total); }); }

  function renderHome() {
    renderScene($('#home'), state);
    $('#homeChipNum').textContent = streakNow();
    $('#todayDot').classList.toggle('done', state.done);
    $('#homeBarFill').style.width = (state.done ? BASE.homeBar + 343 / GOAL : BASE.homeBar) + 'px';
    renderTotals();
    startBtn.textContent = state.done ? '오늘의 오름 완료' : '활동 시작하기';
    startBtn.classList.toggle('completed', state.done);
    $('#homeBubble').classList.toggle('show', state.done && !state.bonusDone);
  }

  function celebrateHome() {
    if (!state.celebrate || current !== 'home') return;
    state.celebrate = false;
    const chipNum = $('#homeChipNum');
    const after = streakNow();
    chipNum.textContent = after - 1;
    const wasDone = state.done;
    if (wasDone) { $('#todayDot').classList.remove('done'); $('#homeBarFill').style.width = BASE.homeBar + 'px'; }
    requestAnimationFrame(() => {
      renderHome();
      if (wasDone) pop($('#todayDot .today-check'));
      bump(chipNum);
      $('#homeChip').animate([{ boxShadow: '0 0 0 0 rgba(255,106,0,.45)' }, { boxShadow: '0 0 0 10px rgba(255,106,0,0)' }], { duration: 800 });
      if ($('#homeBubble').classList.contains('show')) pop($('#homeBubble'), 0.4);
    });
  }

  startBtn.addEventListener('click', () => {
    if (state.done) { toast('오늘의 오름은 완료했어요. 로고를 길게 누르면 처음부터 다시 볼 수 있어요', 2800); return; }
    startMission('main');
  });
  $('#homeBubble').addEventListener('click', () => openModal('bonusModal'));

  // 길게 누르기: 로고 = 처음 상태로, 연속 활동 칩 = 부활(하루 빠진) 상황 체험
  function longPress(el, ms, fn) {
    let t, fired = false;
    el.addEventListener('pointerdown', () => { fired = false; t = setTimeout(() => { fired = true; fn(); }, ms); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, () => clearTimeout(t)));
    el.addEventListener('click', (e) => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  longPress($('#logo'), 700, resetAll);
  longPress($('#homeChip'), 700, () => {
    state.revMode = true; state.revDone = false;
    toast('어제 하루를 쉬었다고 가정할게요');
    go('revonb', 'fade');
  });
  function resetAll() {
    Object.assign(state, freshState());
    renderHome(); setSheet(SHEET_MAX);
    $('#carousel').classList.remove('got');
    toast('처음 상태로 돌렸어요');
    setTimeout(openOnb, 500);
  }

  /* ───────── 첫 진입 온보딩 ───────── */
  const ONB = [
    { hole: [21, 240, 355, 236], anchor: 'lift', card: [515, 112], off: [16, 38, 62], title: '여기서 오늘의 단계를 볼 수 있어요!', desc: '연속으로 며칠째인지, 다음 단계까지 얼마나 남았는지 알 수 있어요' },
    { hole: [24, 516, 355, 259], anchor: 'bottom', card: [393, 98], off: [17, 39, 63], title: '오늘은 이 활동 하나면 충분해요', desc: '부담 갖지 말고 준비되면 시작해봐요' },
    { hole: [23, 782, 355, 88], anchor: 'bottom', card: [649, 112], off: [16, 38, 62], title: '오늘은 이 활동 하나면 충분해요', desc: '활동 기록, 챕터 지도, 리워드는 아래 탭에서 볼 수 있어요' },
  ];
  let onbStep = 0;
  const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  function drawOnb() {
    const s = ONB[onbStep], H = state.H || 874;
    const dyB = H - 874, dyL = Math.min(0, (H - 874) * 0.55);
    const [x, y, w, h] = s.hole;
    const hy = y + (s.anchor === 'lift' ? dyL : dyB);
    $('.onb-dim').setAttribute('viewBox', `0 0 402 ${H}`);
    $('#onbPath').setAttribute('d', `M0 0H402V${H}H0Z ${rr(x, hy, w, h, 10)}`);
    const card = $('#onbCard');
    card.style.top = (s.card[0] + dyB) + 'px'; card.style.height = s.card[1] + 'px';
    $('#onbStep').textContent = `${onbStep + 1}/3`; $('#onbStep').style.top = s.off[0] + 'px';
    $('#onbTitle').textContent = s.title; $('#onbTitle').style.top = s.off[1] + 'px';
    $('#onbDesc').textContent = s.desc; $('#onbDesc').style.top = s.off[2] + 'px';
    const skip = $('#onbSkip');
    skip.textContent = onbStep === 2 ? '시작하기' : '건너뛰기';
    skip.classList.toggle('start', onbStep === 2);
  }
  function openOnb() {
    if (current !== 'home') return;
    onbStep = 0; setSheet(SHEET_MAX, false);
    $('#onb').hidden = false; drawOnb();
    $('#onb').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }
  function closeOnb() {
    const o = $('#onb');
    o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).onfinish = () => { o.hidden = true; };
  }
  $('#onbCard').addEventListener('click', () => {
    if (onbStep < 2) { onbStep++; drawOnb(); $('#onbCard').animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE }); }
    else closeOnb();
  });
  $('#onbSkip').addEventListener('click', closeOnb);
  $('#onb').addEventListener('click', (e) => { if (e.target.closest('.onb-dim') && onbStep < 2) $('#onbCard').click(); });

  /* ───────── 모달 (보너스·부활·배경 획득) ───────── */
  let revTick;
  function openModal(id) {
    const m = $('#' + id);
    m.hidden = false;
    m.querySelector('.modal-dim').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
    pop(m.querySelector('.mpanel'), 0.85);
    if (id === 'revModal') {
      let left = 23 * 3600 + 59 * 60 + 30;
      const draw = () => { const h = Math.floor(left / 3600), mm = Math.floor(left % 3600 / 60), ss = left % 60; $('#revTimer').textContent = [h, mm, ss].map((v) => String(v).padStart(2, '0')).join(':'); };
      draw(); clearInterval(revTick); revTick = setInterval(() => { left = Math.max(0, left - 1); draw(); }, 1000);
    }
  }
  function closeModal(m) {
    if (m.hidden) return;
    m.querySelector('.modal-dim').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 });
    m.querySelector('.mpanel').animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 180 }).onfinish = () => { m.hidden = true; };
    if (m.id === 'revModal') clearInterval(revTick);
  }
  function closeModals() { $$('.modal').forEach((m) => { m.hidden = true; }); clearInterval(revTick); }
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target.classList.contains('modal-dim')) closeModal(m); });
  });
  $('#bonusStart').addEventListener('click', () => startMission('bonus'));
  $('#revStart').addEventListener('click', () => startMission('rev'));

  /* ───────── 카메라 ───────── */
  const cam = $('#camera'), vf = $('#viewfinder'), video = $('#camVideo'), shotImg = $('#camShot'), fallbackImg = $('#camFallback');
  const camMsg = $('#camMsg'), camMsgText = $('#camMsgText'), shutter = $('#shutter');
  let camSeq = 0;

  function startMission(kind) {
    state.mission = kind;
    go('camera', 'up');
  }
  function prepareCamera() {
    const m = MISSIONS[state.mission] || MISSIONS.main;
    cam.classList.remove('m-bonus', 'm-rev');
    if (m.cls) cam.classList.add(m.cls);
    $('#camTitle').textContent = m.title;
    $('#camSub').textContent = m.sub;
    if (m.icon) $('#camIcon').src = m.icon;
    if (fallbackImg.getAttribute('src') !== m.sample) fallbackImg.src = m.sample;
    Object.assign(fallbackImg.style, state.mission === 'main' ? { left: '', top: '', width: '', height: '' } : { left: '0', top: '0', width: '100%', height: '100%' });
    startCamera();
  }

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

    const cw = vf.clientWidth * 2, ch = vf.clientHeight * 2;
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const r = Math.max(cw / sw, ch / sh);
    const dw = sw * r, dh = sh * r;
    if (!isFallback && video.classList.contains('mirror')) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
    ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    state.photo = canvas.toDataURL('image/jpeg', 0.85);
    state.photoTime = new Date();
    // 렌즈를 가렸거나 너무 어두우면 인증 실패 화면으로
    try {
      const t = document.createElement('canvas'); t.width = 24; t.height = 24;
      const tc = t.getContext('2d'); tc.drawImage(canvas, 0, 0, 24, 24);
      const px = tc.getImageData(0, 0, 24, 24).data; let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      state.lastDark = sum / (px.length / 4) < 28;
    } catch (_) { state.lastDark = false; }

    shotImg.src = state.photo;
    vf.classList.add('shot');
    hideMsg();
    stopCamera();
    $('#camFlash').animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
    setTimeout(() => { if (current === 'camera') go('loading', 'fade'); }, 650);
  }

  shutter.addEventListener('click', capture);
  $('#camRetry').addEventListener('click', startCamera);
  $('#camClose').addEventListener('click', () => { const p = stack.pop() || 'home'; go(p, 'down', { isBack: true }); });
  $('#flip').addEventListener('click', (e) => {
    state.facing = state.facing === 'environment' ? 'user' : 'environment';
    e.currentTarget.classList.toggle('spin');
    startCamera();
  });

  /* ───────── 인증 확인 중 (Figma: 1.5초 뒤 완료) ───────── */
  let verifyTimer;
  function startVerify() {
    clearTimeout(verifyTimer);
    verifyTimer = setTimeout(() => {
      if (current !== 'loading') return;
      stack = stack.filter((s) => s !== 'camera' && s !== 'loading');
      go(state.lastDark ? 'fail' : 'done', 'fade');
    }, 1500);
  }
  $('#cancelVerify').addEventListener('click', () => go('camera', 'fade'));
  $('#failRetry').addEventListener('click', () => go('camera', 'fade'));

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

  function award(kind) {
    state.total += PAY;
    state.history.unshift({ kind, name: HISTORY_NAME[kind], time: new Date(), val: PAY });
  }
  function showDone() {
    const kind = state.mission;
    const scr = $('#done');
    scr.classList.toggle('v-rev', kind === 'rev');
    if (kind === 'main' && !state.done) { state.done = true; state.celebrate = true; award('main'); }
    if (kind === 'bonus' && !state.bonusDone) { state.bonusDone = true; award('bonus'); }
    if (kind === 'rev' && !state.revDone) { state.revDone = true; state.celebrate = true; award('rev'); }
    if (kind === 'walk' && !state.walkDone) { state.walkDone = true; award('walk'); }
    renderTotals();
    pop($('.dn-mascot', scr), 0.5);
    [$('.dn-title', scr), $('.dn-sub', scr), $('.reward-box', scr)].forEach((el, i) => {
      el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120 + i * 90, easing: EASE, fill: 'backwards' });
    });
    $$('.rw-val', scr).forEach((el, i) => countUp(el, +el.dataset.count, FMT[el.dataset.fmt], 450 + i * 160));
  }
  // Figma 연결: 일반 미션 → 챕터, 보너스·부활 → 연속활동
  $('#doneNext').addEventListener('click', () => {
    const k = state.mission;
    if (k === 'main' || k === 'walk') { stack = []; go('chapter', 'push', { root: true }); }
    else {
      state.streakTo = streakNow(); state.streakFrom = k === 'rev' ? 10 : state.streakTo - 1;
      go('streak', 'push');
    }
  });

  /* ───────── 연속활동 갱신 ───────── */
  const stepOf = (n) => (n % GOAL) || GOAL;
  function showStreak() {
    const from = state.streakFrom, to = state.streakTo;
    const scr = $('#streak');
    $('#stTitleNum').textContent = to;
    const days = $('#stDays'), left = $('#stLeft'), fill = $('#stBarFill');
    days.textContent = from; left.textContent = GOAL - stepOf(from);
    fill.style.transition = 'none';
    fill.style.width = (342 * (stepOf(to) === 1 && from % GOAL === 0 ? 0 : stepOf(from)) / GOAL) + 'px';
    pop($('.st-mascot', scr), 0.5);
    setTimeout(() => {
      if (current !== 'streak') return;
      fill.style.transition = `width .9s ${EASE}`;
      fill.style.width = (342 * stepOf(to) / GOAL) + 'px';
      setTimeout(() => { days.textContent = to; left.textContent = GOAL - stepOf(to); bump(days); bump(left); }, 380);
    }, 520);
  }
  $('#toBonus').addEventListener('click', () => {
    if (state.bonusDone) { toast('오늘의 보너스 미션은 이미 완료했어요'); return; }
    goHome();
    setTimeout(() => openModal('bonusModal'), 280);
  });

  /* ───────── 부활 ───────── */
  $('#revOpen').addEventListener('click', () => { goHome(); setTimeout(() => openModal('revModal'), 280); });

  /* ───────── 활동 탭 · 캘린더 ───────── */
  const COLS = [51.5, 101.5, 151.5, 201.5, 251.5, 301.5, 351.5];
  const ROW0 = 267, ROWH = 42, WD_Y = 230;
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  function renderActivity() {
    const today = new Date();
    if (!state.calMonth) state.calMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const y = state.calMonth.getFullYear(), m = state.calMonth.getMonth();
    const n = streakNow();
    const doneToday = state.revMode ? state.revDone : state.done;
    const doneSet = new Set();
    for (let i = 0; i < n; i++) {
      const d = new Date(today); d.setDate(today.getDate() - (doneToday ? i : i + 1));
      doneSet.add(dayKey(d));
    }
    const first = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const rows = Math.ceil((first + dim) / 7);
    let html = '';
    ['일', '월', '화', '수', '목', '금', '토'].forEach((w, i) => { html += `<span class="cal-num wd" style="left:${COLS[i]}px;top:${WD_Y}px">${w}</span>`; });
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
    const extra = (rows - 5) * ROWH;
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
      $('#actCardSub').textContent = `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')} 사진 인증 완료`;
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

  /* ───────── 챕터 지도 ───────── */
  const map = $('#map');
  function enterChapter(prev) {
    $('#chCount').textContent = state.done ? '2/7' : '1/7';
    $('#chBar').style.width = (state.done ? 69 + 297 / GOAL : 69) + 'px';
    if (prev !== 'unlock') requestAnimationFrame(() => { map.scrollTop = map.scrollHeight; });
  }
  const openUnlock = () => go('unlock', 'push');
  $('#carousel').addEventListener('click', openUnlock);
  $('#nodeNext').addEventListener('click', () => { state.mission = 'walk'; go('walk', 'up'); });
  $('#chMission').addEventListener('click', () => {
    if (state.done) { toast('오늘의 오름은 이미 완료했어요'); return; }
    startMission('main');
  });
  $('#unlockGet').addEventListener('click', () => {
    stack = stack.filter((s) => s !== 'unlock');
    go('chapter', 'fade', { isBack: true });
    setTimeout(() => openModal('bgPop'), 260);
  });
  $('#bgApply').addEventListener('click', () => {
    state.bg = 'park';
    $('#carousel').classList.add('got');
    goHome();
    setTimeout(() => toast('홈 배경을 놀이공원으로 바꿨어요'), 300);
  });

  /* ───────── 산책 미션 ───────── */
  let walkTick;
  const PATH = [[35, 343], [60, 300], [75, 265], [92, 232], [108, 200], [124, 168], [140, 138]];
  function startWalk() {
    let sec = 73, i = 0;
    const me = $('#wkMe'), tm = $('#wkTimer');
    me.style.transition = 'none'; me.style.left = PATH[0][0] + 'px'; me.style.top = PATH[0][1] + 'px';
    const draw = () => { tm.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };
    draw();
    clearInterval(walkTick);
    walkTick = setInterval(() => {
      sec++; draw();
      if (sec % 3 === 0 && i < PATH.length - 1) { i++; me.style.transition = ''; me.style.left = PATH[i][0] + 'px'; me.style.top = PATH[i][1] + 'px'; }
    }, 1000);
  }
  function stopWalk() { clearInterval(walkTick); }
  $('#wkDone').addEventListener('click', () => { state.mission = 'walk'; stack = stack.filter((s) => s !== 'walk'); go('done', 'fade'); });

  /* ───────── 꾸미기 ───────── */
  const BG_CARDS = [
    { k: 'tree', label: '나무집', src: 'assets/deco/thumb-tree.jpg', c: ['0%', '-24.23%', '108.81%', '160.19%'] },
    { k: 'xmas', label: '크리스마스 마켓', src: 'assets/deco/bg-xmas.jpg', c: ['-0.03%', '-35.36%', '100.07%', '135.36%'] },
    { k: 'concert', label: '콘서트장', src: 'assets/deco/bg-concert.jpg', c: ['-0.05%', '0%', '100.1%', '141.53%'] },
    { k: 'park', label: '놀이공원', src: 'assets/deco/bg-park.jpg', cover: true },
    { k: 'aquarium', label: '아쿠아리움', src: 'assets/deco/bg-aquarium.jpg', c: ['-7.97%', '-24.4%', '115.95%', '156.93%'], flip: true },
    { k: 'cinema', label: '영화관', src: 'assets/deco/bg-cinema.jpg', c: ['-0.13%', '-0.11%', '100.13%', '134.79%'] },
  ];
  const WEAR_CARDS = [
    { k: null, label: '없음' },
    { k: 'goggle', label: '물안경', th: [11, 18, 77, 51] },
    { k: '4d', label: '4D 안경', th: [10, 22, 81, 43], cls: 't-4d' },
    { k: 'band', label: '머리띠', th: [7, 20, 87, 58] },
    { k: 'glasses', label: '안경', th: [15, 31, 70, 35] },
    { k: 'santa', label: '산타 모자', th: [18, 11, 73, 67] },
  ];
  const PROP_CARDS = [
    { k: null, label: '없음' },
    { k: 'sotteok', label: '소떡소떡', th: [24, 20, 51, 54] },
    { k: 'popcorn', label: '팝콘', th: [22, 17, 58, 57] },
    { k: 'cola', label: '콜라', th: [18, 11, 61, 60] },
    { k: 'stick', label: '응원봉', th: [27, 15, 47, 58] },
    { k: 'ticket', label: '티켓', th: [14, 28, 73, 32], cls: 't-ticket' },
  ];
  const CARD_POS = [[30, 137], [151, 137], [271, 137], [30, 253], [151, 253], [271, 253]];
  const deco = { tab: 'bg', tmp: null };

  function enterDeco() {
    deco.tmp = { bg: state.bg, wear: state.wear, prop: state.prop };
    deco.tab = 'bg';
    renderDeco();
    $('#dsheet').animate([{ transform: 'translateY(60%)' }, { transform: 'none' }], { duration: 380, easing: EASE });
  }
  function renderDeco() {
    renderScene($('#deco'), deco.tmp);
    $$('.ds-tab').forEach((t) => t.classList.toggle('on', t.dataset.dtab === deco.tab));
    const list = deco.tab === 'bg' ? BG_CARDS : deco.tab === 'wear' ? WEAR_CARDS : PROP_CARDS;
    const sel = deco.tmp[deco.tab];
    $('#dsGrid').innerHTML = list.map((it, i) => {
      const [x, y] = CARD_POS[i];
      let inner = '';
      if (deco.tab === 'bg') {
        inner = it.cover
          ? `<div class="th"><img src="${it.src}" alt="" style="left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:bottom"></div>`
          : `<div class="th"${it.flip ? ' style="transform:scaleX(-1)"' : ''}><img src="${it.src}" alt="" style="left:${it.c[0]};top:${it.c[1]};width:${it.c[2]};height:${it.c[3]}"></div>`;
      } else if (!it.k) {
        inner = `<img class="it" src="assets/deco/none.svg" alt="" style="left:31px;top:${deco.tab === 'wear' ? 24 : 25}px;width:39.1px;height:39.1px">`;
      } else {
        const f = deco.tab === 'wear' ? WEAR[it.k] : PROP[it.k];
        inner = `<div class="it-wrap ${it.cls || ''}" style="left:${it.th[0]}px;top:${it.th[1]}px;width:${it.th[2]}px;height:${it.th[3]}px"><img src="assets/deco/${f}.png" alt=""></div>`;
      }
      return `<button class="ds-card${i > 2 ? ' r2' : ''}${it.k === sel ? ' sel' : ''}" data-pick="${it.k === null ? '' : it.k}" style="left:${x}px;top:${y}px">${inner}<span class="lb">${it.label}</span></button>`;
    }).join('');
  }
  $('.ds-tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-dtab]'); if (t) { deco.tab = t.dataset.dtab; renderDeco(); } });
  $('#dsGrid').addEventListener('click', (e) => {
    const c = e.target.closest('[data-pick]'); if (!c) return;
    deco.tmp[deco.tab] = c.dataset.pick || null;
    if (deco.tab === 'bg' && !deco.tmp.bg) deco.tmp.bg = 'tree';
    renderDeco();
    const w = $('#deco .wear-slot').lastElementChild; if (w && deco.tab !== 'bg') pop(w, 0.6);
  });
  const closeDeco = () => goHome();
  $('#decoClose').addEventListener('click', closeDeco);
  $('#decoHanger').addEventListener('click', () => { deco.tab = 'bg'; renderDeco(); });
  $('#decoSave').addEventListener('click', () => { Object.assign(state, deco.tmp); goHome(); setTimeout(() => toast('꾸미기를 저장했어요'), 300); });
  (() => { // 시트 핸들 아래로 끌어 닫기
    const h = $('#dsheetHandle'), sh = $('#dsheet'); let y0 = null;
    h.addEventListener('pointerdown', (e) => { y0 = e.clientY; try { h.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } });
    h.addEventListener('pointermove', (e) => { if (y0 === null) return; const dy = Math.max(0, (e.clientY - y0) / state.z); sh.style.transform = `translateY(${dy}px)`; });
    const end = (e) => { if (y0 === null) return; const dy = (e.clientY - y0) / state.z; y0 = null; sh.style.transform = ''; if (dy > 80) closeDeco(); };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  })();

  /* ───────── 보상 · 내역 · 환급 모드 ───────── */
  function renderReward() {
    renderTotals();
    $('#refundAmt').textContent = fmt(state.refund);
    const t = $('#widgetToggle'); t.classList.toggle('on', state.widget); t.setAttribute('aria-pressed', String(state.widget));
  }
  $('#widgetToggle').addEventListener('click', () => { state.widget = !state.widget; renderReward(); });

  const BASE_HISTORY = [
    { date: '09.17', name: '9시에 이불 정리하기', time: '09:00', val: 1000 },
    { date: '09.16', name: '점심 먹고 10분 산책하기', time: '13:10', val: 2000 },
    { date: '09.15', name: '오늘 할 일 3개 적어보기', time: '18:30', val: 1000 },
    { date: '09.14', name: '가족들에게 먼저 안부 묻기', time: '20:00', val: 3000 },
  ];
  const hist = { tab: 'chapter', chapter: 1, month: new Date().getMonth() + 1 };
  const p2 = (n) => String(n).padStart(2, '0');
  function renderHistory() {
    $$('.rh-tab').forEach((t) => t.classList.toggle('on', t.dataset.htab === hist.tab));
    $('#rhLabel').textContent = hist.tab === 'chapter' ? `챕터 ${hist.chapter}` : `${hist.month}월`;
    const added = state.history.map((h) => ({ date: `${p2(h.time.getMonth() + 1)}.${p2(h.time.getDate())}`, name: h.name, time: `${p2(h.time.getHours())}:${p2(h.time.getMinutes())}`, val: h.val, isNew: true }));
    const rows = hist.chapter === 1 || hist.tab === 'date' ? added.concat(BASE_HISTORY) : [];
    $('#rhList').innerHTML = rows.length
      ? rows.map((r) => `<div class="rh-item${r.isNew ? ' new' : ''}"><span class="rh-date">${r.date}</span><span class="rh-name">${r.name}</span><span class="rh-val">+${fmt(r.val)}P</span><span class="rh-time">${r.time}</span></div>`).join('')
      : '<div class="rh-item"><span class="rh-name" style="color:rgba(0,0,0,.3)">아직 열리지 않은 챕터예요</span></div>';
  }
  $('.rh-tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-htab]'); if (t) { hist.tab = t.dataset.htab; renderHistory(); } });
  $('#rhPrev').addEventListener('click', () => { if (hist.tab === 'chapter') hist.chapter = Math.max(1, hist.chapter - 1); else hist.month = hist.month === 1 ? 12 : hist.month - 1; renderHistory(); });
  $('#rhNext').addEventListener('click', () => { if (hist.tab === 'chapter') hist.chapter = Math.min(4, hist.chapter + 1); else hist.month = hist.month === 12 ? 1 : hist.month + 1; renderHistory(); });

  let refundDraft = BASE.refund;
  function drawRefund() {
    $('#rfValue').textContent = fmt(refundDraft);
    $('#rfBet').textContent = `${fmt(refundDraft)}원`;
    $('#rfWin').textContent = `${fmt(refundDraft * 2)}원 (2배)`;
  }
  function enterRefund() { refundDraft = state.refund; drawRefund(); }
  $$('.rf-chip').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.add;
    const next = a === 'max' ? 50000 : Math.min(50000, refundDraft + +a);
    if (a !== 'max' && refundDraft >= 50000) toast('최대 50,000원까지 걸 수 있어요');
    refundDraft = next; drawRefund(); bump($('#rfValue'));
  }));
  $('#refundYes').addEventListener('click', () => { state.refund = refundDraft; back(); });

  /* ───────── 공통 이벤트 ───────── */
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { stack = []; go(tab.dataset.tab, 'fade', { root: true }); return; }
    const goEl = e.target.closest('[data-go]');
    if (goEl) { go(goEl.dataset.go, goEl.dataset.anim || 'push'); return; }
    if (e.target.closest('[data-home]')) { goHome(); return; }
    if (e.target.closest('[data-back]')) { back(); return; }
    const t = e.target.closest('[data-toast]');
    if (t) toast(t.dataset.toast);
  });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  /* ───────── 홈 화면 추가 안내 · 오프라인 캐시 ───────── */
  const standalone = isStandalone();
  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function maybeShowA2HS() {
    let dismissed = false;
    try { dismissed = localStorage.getItem('oreum-a2hs') === '1'; } catch (_) { /* noop */ }
    if (isIOS && !standalone && !state.frame && !dismissed) { $('#a2hs').hidden = false; return true; }
    if (standalone && state.legacyInstall) {
      $('.a2hs-title').textContent = '앱을 다시 추가해 주세요';
      $('.a2hs-body').innerHTML = '화면 배치와 아이콘이 바뀌었어요. 홈 화면에서 이 앱을 <b>삭제</b>한 뒤, 사파리에서 주소를 열고 <b>공유 → 홈 화면에 추가</b>를 다시 해 주세요.';
      $('#a2hsClose').textContent = '나중에 할게요';
      $('#a2hs').hidden = false; return true;
    }
    return false;
  }
  $('#a2hsClose').addEventListener('click', () => {
    $('#a2hs').hidden = true;
    try { localStorage.setItem('oreum-a2hs', '1'); } catch (_) { /* noop */ }
    setTimeout(openOnb, 200);
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  ['assets/loading/mascot.png', 'assets/done/mascot.png', 'assets/streak/mascot-crop.png', 'assets/camera/mascot.png', 'assets/chapter/bg.jpg', 'assets/chapter/carousel.png', 'assets/unlock/gate.png', 'assets/deco/bg-park.jpg', 'assets/bonus/sample.jpg', 'assets/revival/sample.jpg', 'assets/fail/mascot.png']
    .forEach((s) => { const i = new Image(); i.src = s; });

  /* ───────── 시작: 홈 + 첫 진입 온보딩 ───────── */
  layout();
  $('#home').classList.add('active');
  renderHome();
  setSheet(SHEET_MAX, false);
  syncBodyBg();
  const params = new URLSearchParams(location.search);
  const blocked = maybeShowA2HS();
  if (!blocked && !params.has('noonb') && !params.get('screen')) setTimeout(openOnb, 450);

  // 개발 확인용: ?screen=chapter 처럼 특정 화면으로 바로 이동 (?mission=bonus 등과 함께)
  const q = params.get('screen');
  if (q && $('#' + q)) {
    if (params.get('mission')) state.mission = params.get('mission');
    if (q === 'streak') { state.streakFrom = 2; state.streakTo = 3; }
    go(q, 'fade');
    if (params.get('modal')) setTimeout(() => openModal(params.get('modal')), 300);
  } else if (params.get('modal')) setTimeout(() => openModal(params.get('modal')), 300);
  if (params.has('sheet')) setSheet(0, false);
})();
