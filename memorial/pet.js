/* Original Denia sprite, presented locally when the original pet script cannot mount.
 * Row, frame count and duration were checked against the original site's controls. */
(function (global, doc) {
  'use strict';

  const PREF_KEY = 'denia.memorial.pet.v1';
  const DEFAULT_SPRITE = 'https://preview.daniya.cc/pet/denia.webp';
  const DEFAULT_CHAT = 'https://preview.daniya.cc/pet-preview.html';
  const ACTIONS = [
    { id: 'idle', label: '待机', row: 0, frames: 6, duration: 1100, end: -1152 },
    { id: 'run-right', label: '向右跑', row: -208, frames: 8, duration: 1060, end: -1536 },
    { id: 'run-left', label: '向左跑', row: -416, frames: 8, duration: 1060, end: -1536 },
    { id: 'wave', label: '挥手', row: -624, frames: 4, duration: 700, end: -768 },
    { id: 'bubble-jump', label: '泡泡跳跃', row: -832, frames: 5, duration: 840, end: -960 },
    { id: 'sad', label: '低落', row: -1040, frames: 8, duration: 1220, end: -1536 },
    { id: 'waiting', label: '等待', row: -1248, frames: 6, duration: 1010, end: -1152 },
    { id: 'run-in-place', label: '原地跑', row: -1456, frames: 6, duration: 820, end: -1152 },
    { id: 'thinking', label: '思考', row: -1664, frames: 6, duration: 1030, end: -1152 }
  ];
  let activeInstance = null;
  let instanceNumber = 0;

  function safeURL(value, fallback) {
    try {
      const parsed = new URL(value || fallback, doc.baseURI);
      return /^https?:$/.test(parsed.protocol) ? parsed.href : fallback;
    } catch (_) { return fallback; }
  }

  function readPreferences() {
    try {
      const value = JSON.parse(global.localStorage.getItem(PREF_KEY) || 'null');
      return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
  }

  function mount(options) {
    if (activeInstance) activeInstance.destroy();
    const config = options || {};
    const spriteUrl = safeURL(config.spriteUrl, DEFAULT_SPRITE);
    const chatUrl = safeURL(config.chatUrl, DEFAULT_CHAT);
    const preferences = readPreferences();
    const id = 'denia-local-pet-' + (++instanceNumber);
    const cleanups = [];
    const state = {
      hidden: preferences.hidden === true,
      collapsed: preferences.collapsed === true,
      manualPause: preferences.manualPause === true,
      action: ACTIONS.some(function (a) { return a.id === preferences.action; }) ? preferences.action : 'idle',
      loaded: false,
      failed: false,
      destroyed: false,
      panelOpen: false,
      left: Number.isFinite(preferences.left) ? preferences.left : null,
      top: Number.isFinite(preferences.top) ? preferences.top : null
    };
    let drag = null;
    let dragFrame = 0;
    let suppressClick = false;
    let animationRevision = 0;
    let focusFrame = 0;
    const media = typeof global.matchMedia === 'function' ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const host = doc.createElement('div');
    host.id = id;
    host.setAttribute('data-denia-pet', 'compatibility');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { --pet-scale: .64; --pet-gap: 22px; --pet-safe-inset: env(safe-area-inset-bottom, 0px); --pet-ink: #49384d; --pet-muted: #68576e; position: fixed; right: 20px; bottom: var(--pet-gap); width: calc(192px * var(--pet-scale)); height: calc(208px * var(--pet-scale)); z-index: 70; display: block; font: 13px/1.6 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: var(--pet-ink); pointer-events: none; }
        :host([hidden]) { display: none !important; }
        * { box-sizing: border-box; }
        [hidden] { display: none !important; }
        button, select, a, input { font: inherit; }
        button, select { color: inherit; }
        button, a, select, input { -webkit-tap-highlight-color: transparent; }
        button { cursor: pointer; }
        button:focus-visible, a:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid #486e9a; outline-offset: 3px; }
        .shell { width: 100%; height: 100%; position: relative; pointer-events: auto; }
        .handle { border: 0; padding: 0; background: transparent; width: 100%; height: 100%; display: block; border-radius: 24px; position: relative; overflow: visible; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
        .shell[data-dragging='true'] .handle, .shell[data-dragging='true'] .restore { cursor: grabbing; }
        .sprite { display: block; position: absolute; left: 0; top: 0; width: 192px; height: 208px; transform: scale(var(--pet-scale)); transform-origin: left top; background-repeat: no-repeat; background-size: 1536px 1872px; background-position: 0 var(--pet-row, 0px); animation-name: denia-pet-strip-a; animation-duration: var(--pet-duration, 1100ms); animation-timing-function: steps(var(--pet-frames, 6), end); animation-iteration-count: infinite; pointer-events: none; opacity: 0; }
        .shell[data-loaded='true'] .sprite { opacity: 1; }
        .shell[data-paused='true'] .sprite { animation-play-state: paused; }
        @keyframes denia-pet-strip-a { from { background-position-x: 0; } to { background-position-x: var(--pet-end, -1152px); } }
        @keyframes denia-pet-strip-b { from { background-position-x: 0; } to { background-position-x: var(--pet-end, -1152px); } }
        .fallback { position: absolute; inset: 32px 0 0; display: grid; place-content: center; gap: 4px; min-height: 72px; padding: 10px; border: 1px solid #d6c4d5; border-radius: 24px; background: #fff8fc; color: var(--pet-muted); font-size: 11px; text-align: center; }
        .shell[data-loaded='true'] .fallback { display: none; }
        .quick-tools { position: absolute; right: -4px; top: -3px; display: flex; gap: 4px; opacity: 0; transition: opacity .16s ease; }
        .shell:hover .quick-tools, .shell:focus-within .quick-tools, .shell[data-panel='true'] .quick-tools { opacity: 1; }
        .quick-button { display: grid; place-content: center; width: 30px; height: 30px; padding: 0; border: 1px solid #d6c4d5; border-radius: 50%; background: #fff8fc; box-shadow: 0 2px 8px #48334a14; font-size: 18px; }
        .quick-button:hover { background: #f5e8f3; }
        .panel { position: fixed; width: min(286px, calc(100vw - 24px)); max-height: min(390px, calc(100dvh - 32px)); overflow: auto; padding: 17px; border: 1px solid #d5bfd4; border-radius: 20px; background: #fffafd; box-shadow: 0 15px 45px #46324d24; overscroll-behavior: contain; }
        .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .panel-title { font-size: 14px; font-weight: 650; margin: 0; }
        .panel-close { width: 30px; height: 30px; border: 0; background: transparent; border-radius: 8px; font-size: 20px; }
        .compatibility { display: inline-block; margin: 0 0 8px; padding: 2px 8px; border-radius: 20px; background: #f0e5f2; color: #67506e; font-size: 10px; letter-spacing: .06em; }
        .description { margin: 0 0 13px; color: var(--pet-muted); font-size: 12px; }
        .field { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; margin: 12px 0; }
        select { width: 100%; min-height: 38px; padding: 6px 9px; border: 1px solid #c9b6ce; border-radius: 10px; background: #fff; }
        .pause-label { display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; }
        input { width: 17px; height: 17px; margin: 0; accent-color: #7e5889; }
        .pause-label:has(input:disabled) { cursor: default; }
        .status { min-height: 18px; margin: 5px 0 10px; color: var(--pet-muted); font-size: 11px; }
        .original-link { display: block; padding: 9px 12px; text-align: center; text-decoration: none; color: #fff; background: #775383; border-radius: 11px; font-size: 12px; }
        .original-link:hover { background: #654473; }
        .tools { display: flex; gap: 5px; justify-content: space-between; margin-top: 10px; }
        .text-button { border: 0; border-radius: 8px; padding: 5px 6px; background: transparent; color: #685071; font-size: 11px; }
        .text-button:hover { background: #f3e8f4; }
        .keyboard-note { margin: 9px 0 0; color: var(--pet-muted); font-size: 10px; }
        .restore { width: 50px; height: 50px; display: grid; place-items: center; position: relative; overflow: hidden; padding: 0; border: 1px solid #d6c4d5; border-radius: 50%; background: #fff8fc; box-shadow: 0 3px 14px #46324d14; cursor: grab; touch-action: none; user-select: none; }
        .mini-sprite { width: 192px; height: 208px; position: absolute; top: 0; left: 2px; background-repeat: no-repeat; background-size: 1536px 1872px; background-position: 0 0; transform: scale(.24); transform-origin: left top; pointer-events: none; display: none; }
        .shell[data-loaded='true'] .mini-sprite { display: block; }
        .shell[data-loaded='true'] .mini-fallback { visibility: hidden; }
        .mini-fallback { font-size: 11px; }
        :host([data-collapsed='true']) { width: 50px; height: 50px; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        @media (max-width: 720px) { :host { --pet-scale: .56; --pet-gap: calc(88px + env(safe-area-inset-bottom, 0px)); right: 12px; } .quick-tools { right: -3px; } }
        @media (hover: none) { .quick-tools { opacity: 1; } .quick-button { width: 36px; height: 36px; } .panel-close, .text-button { min-height: 42px; } }
        @media (prefers-reduced-motion: reduce) { .quick-tools { transition: none; } }
      </style>
      <section class="shell" aria-label="达妮娅桌宠" data-paused="true" data-loaded="false">
        <button class="handle" type="button" aria-label="达妮娅桌宠，打开操作" aria-expanded="false" aria-controls="${id}-panel" aria-describedby="${id}-hint">
          <span class="sprite" aria-hidden="true"></span>
          <span class="fallback" aria-hidden="true">正在载入原站桌宠…</span>
        </button>
        <div class="quick-tools">
          <button class="quick-button collapse" type="button" aria-label="收起桌宠" title="收起桌宠">−</button>
          <button class="quick-button close-pet" type="button" aria-label="关闭桌宠" title="关闭桌宠">×</button>
        </div>
        <button class="restore" type="button" hidden aria-label="展开达妮娅桌宠" aria-describedby="${id}-hint">
          <span class="mini-sprite" aria-hidden="true"></span><span class="mini-fallback" aria-hidden="true">娅娅</span>
        </button>
        <div class="panel" id="${id}-panel" role="group" aria-labelledby="${id}-title" hidden>
          <div class="panel-header"><h2 class="panel-title" id="${id}-title">达妮娅桌宠</h2><button class="panel-close" type="button" aria-label="关闭桌宠操作">×</button></div>
          <span class="compatibility">本地兼容模式</span>
          <p class="description">这里沿用原站桌宠与动作。聊天、选图、表情包和朗读请前往原版页面，聊天状态以原页为准。</p>
          <label class="field">动作<select class="action-select" aria-label="选择桌宠动作"></select></label>
          <label class="pause-label"><input class="pause-input" type="checkbox">暂停桌宠动画</label>
          <p class="status" role="status" aria-live="polite"></p>
          <a class="original-link" target="_blank" rel="noopener noreferrer">打开原版桌宠与聊天 ↗</a>
          <div class="tools"><button class="text-button reset-position" type="button">恢复位置</button><button class="text-button collapse" type="button">收起桌宠</button><button class="text-button close-pet" type="button">关闭桌宠</button></div>
          <p class="keyboard-note">拖动可移动 · 方向键微调 · Shift 加速 · Home 归位</p>
        </div>
        <span class="sr-only" id="${id}-hint">可以拖动移动；聚焦后使用方向键微调，按 Home 恢复位置。点击或按回车打开操作。</span>
      </section>`;

    const shell = root.querySelector('.shell');
    const handle = root.querySelector('.handle');
    const sprite = root.querySelector('.sprite');
    const miniSprite = root.querySelector('.mini-sprite');
    const fallback = root.querySelector('.fallback');
    const restore = root.querySelector('.restore');
    const quickTools = root.querySelector('.quick-tools');
    const panel = root.querySelector('.panel');
    const actionSelect = root.querySelector('.action-select');
    const pauseInput = root.querySelector('.pause-input');
    const status = root.querySelector('.status');
    root.querySelector('.original-link').href = chatUrl;
    sprite.style.backgroundImage = 'url(' + JSON.stringify(spriteUrl) + ')';
    miniSprite.style.backgroundImage = 'url(' + JSON.stringify(spriteUrl) + ')';
    ACTIONS.forEach(function (action) {
      const option = doc.createElement('option');
      option.value = action.id;
      option.textContent = action.label;
      actionSelect.appendChild(option);
    });

    function listen(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      cleanups.push(function () { target.removeEventListener(type, listener, options); });
    }

    function toast(message) {
      if (typeof config.onToast === 'function') {
        try { config.onToast(message); } catch (_) {}
      }
    }

    function save() {
      try {
        global.localStorage.setItem(PREF_KEY, JSON.stringify({ hidden: state.hidden, collapsed: state.collapsed, manualPause: state.manualPause, action: state.action, left: state.left, top: state.top }));
      } catch (_) {}
    }

    function reducedMotion() {
      const setting = doc.documentElement.getAttribute('data-reduced-motion');
      if (setting === 'true') return true;
      if (setting === 'false') return false;
      return !!(media && media.matches);
    }

    function syncAnimation() {
      if (state.destroyed) return;
      const reduced = reducedMotion();
      const paused = state.hidden || state.collapsed || state.manualPause || reduced || doc.hidden || !state.loaded;
      shell.dataset.paused = String(paused);
      pauseInput.checked = state.manualPause || reduced;
      pauseInput.disabled = reduced;
      if (state.failed) status.textContent = '原图暂时无法载入，请打开原版页面查看。';
      else if (!state.loaded) status.textContent = '正在载入原站桌宠图片。';
      else if (reduced) status.textContent = '已随减少动效设置暂停。';
      else if (state.manualPause) status.textContent = '动画已暂停，仍可移动和查看原页。';
      else status.textContent = '原站图片 · 动作参数与原版一致';
    }

    function setAction(actionId) {
      const action = ACTIONS.find(function (item) { return item.id === actionId; }) || ACTIONS[0];
      state.action = action.id;
      actionSelect.value = action.id;
      sprite.style.setProperty('--pet-row', action.row + 'px');
      sprite.style.setProperty('--pet-frames', String(action.frames));
      sprite.style.setProperty('--pet-duration', action.duration + 'ms');
      sprite.style.setProperty('--pet-end', action.end + 'px');
      sprite.style.animationName = (++animationRevision % 2) ? 'denia-pet-strip-a' : 'denia-pet-strip-b';
      syncAnimation();
    }

    function viewport() {
      return { width: global.innerWidth || doc.documentElement.clientWidth, height: global.innerHeight || doc.documentElement.clientHeight };
    }

    function bounds() {
      const view = viewport();
      const box = host.getBoundingClientRect();
      const inset = parseFloat(global.getComputedStyle(host).getPropertyValue('--pet-safe-inset')) || 0;
      const reserve = view.width <= 720 ? 90 + inset : 14;
      return { x: Math.max(10, view.width - box.width - 10), y: Math.max(10, view.height - box.height - reserve) };
    }

    function adjustPanel() {
      if (!state.panelOpen || state.hidden) return;
      const view = viewport();
      const box = host.getBoundingClientRect();
      const inset = parseFloat(global.getComputedStyle(host).getPropertyValue('--pet-safe-inset')) || 0;
      const usableBottom = view.height - (view.width <= 720 ? 78 + inset : 12);
      panel.style.maxHeight = Math.max(80, Math.min(390, usableBottom - 12)) + 'px';
      const height = panel.offsetHeight;
      const preferredTop = box.top - height - 12 >= 12 ? box.top - height - 12 : box.bottom + 10;
      panel.style.top = Math.max(12, Math.min(usableBottom - height, preferredTop)) + 'px';
      panel.style.left = Math.max(12, Math.min(view.width - panel.offsetWidth - 12, box.right - panel.offsetWidth)) + 'px';
    }

    function moveTo(left, top) {
      if (state.destroyed || state.hidden) return;
      const limit = bounds();
      state.left = Math.max(10, Math.min(limit.x, left));
      state.top = Math.max(10, Math.min(limit.y, top));
      host.style.left = state.left + 'px';
      host.style.top = state.top + 'px';
      host.style.right = 'auto';
      host.style.bottom = 'auto';
      adjustPanel();
    }

    function resetPosition() {
      state.left = null;
      state.top = null;
      host.style.left = '';
      host.style.top = '';
      host.style.right = '';
      host.style.bottom = '';
      adjustPanel();
      save();
    }

    function closePanel(returnFocus) {
      state.panelOpen = false;
      panel.hidden = true;
      shell.dataset.panel = 'false';
      handle.setAttribute('aria-expanded', 'false');
      if (focusFrame) { global.cancelAnimationFrame(focusFrame); focusFrame = 0; }
      if (returnFocus && !state.hidden && !state.collapsed) handle.focus({ preventScroll: true });
    }

    function openPanel() {
      if (state.destroyed || state.hidden || state.collapsed) return;
      state.panelOpen = true;
      panel.hidden = false;
      shell.dataset.panel = 'true';
      handle.setAttribute('aria-expanded', 'true');
      adjustPanel();
      focusFrame = global.requestAnimationFrame(function () {
        focusFrame = 0;
        if (!state.destroyed && state.panelOpen) actionSelect.focus({ preventScroll: true });
      });
    }

    function syncShape() {
      host.hidden = state.hidden;
      host.dataset.collapsed = String(state.collapsed);
      handle.hidden = state.collapsed;
      quickTools.hidden = state.collapsed;
      restore.hidden = !state.collapsed;
      if (state.collapsed || state.hidden) closePanel(false);
      if (!state.hidden && state.left !== null && state.top !== null) moveTo(state.left, state.top);
      syncAnimation();
    }

    function collapse() {
      state.collapsed = true;
      syncShape();
      save();
      restore.focus({ preventScroll: true });
    }

    function show() {
      if (state.destroyed) return;
      state.hidden = false;
      state.collapsed = false;
      syncShape();
      save();
    }

    function hide() {
      if (state.destroyed) return;
      state.hidden = true;
      endDrag(null);
      syncShape();
      save();
    }

    function queueDrag() {
      if (dragFrame || !drag) return;
      dragFrame = global.requestAnimationFrame(function () {
        dragFrame = 0;
        if (drag && drag.moved) moveTo(drag.left, drag.top);
      });
    }

    function startDrag(event) {
      if (state.destroyed || event.button !== 0 || event.isPrimary === false) return;
      const rect = host.getBoundingClientRect();
      suppressClick = false;
      drag = { pointerId: event.pointerId, target: event.currentTarget, x: event.clientX, y: event.clientY, baseLeft: rect.left, baseTop: rect.top, left: rect.left, top: rect.top, moved: false };
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
    }

    function continueDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      drag.left = drag.baseLeft + dx;
      drag.top = drag.baseTop + dy;
      shell.dataset.dragging = 'true';
      closePanel(false);
      queueDrag();
      event.preventDefault();
    }

    function endDrag(event) {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      const completed = drag;
      if (dragFrame) { global.cancelAnimationFrame(dragFrame); dragFrame = 0; }
      if (completed.moved) {
        moveTo(completed.left, completed.top);
        suppressClick = !!(event && event.type === 'pointerup');
      }
      drag = null;
      shell.dataset.dragging = 'false';
      try { if (completed.target.hasPointerCapture(completed.pointerId)) completed.target.releasePointerCapture(completed.pointerId); } catch (_) {}
      save();
    }

    function keyboardMove(event) {
      if (event.ctrlKey || event.metaKey) return;
      const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (event.key === 'Home') {
        event.preventDefault();
        event.stopPropagation();
        resetPosition();
      } else if (steps[event.key]) {
        event.preventDefault();
        event.stopPropagation();
        const rect = host.getBoundingClientRect();
        const size = event.shiftKey ? 32 : event.altKey ? 2 : 12;
        moveTo(rect.left + steps[event.key][0] * size, rect.top + steps[event.key][1] * size);
        save();
      }
    }

    [handle, restore].forEach(function (button) {
      listen(button, 'pointerdown', startDrag);
      listen(button, 'pointermove', continueDrag);
      listen(button, 'pointerup', endDrag);
      listen(button, 'pointercancel', endDrag);
      listen(button, 'lostpointercapture', endDrag);
      listen(button, 'keydown', keyboardMove);
    });
    listen(handle, 'click', function () {
      if (suppressClick) { suppressClick = false; return; }
      if (state.panelOpen) closePanel(false); else openPanel();
    });
    listen(restore, 'click', function () {
      if (suppressClick) { suppressClick = false; return; }
      show();
      handle.focus({ preventScroll: true });
    });
    root.querySelectorAll('.collapse').forEach(function (button) { listen(button, 'click', collapse); });
    root.querySelectorAll('.close-pet').forEach(function (button) { listen(button, 'click', function () { hide(); toast('桌宠已关闭。'); }); });
    listen(root.querySelector('.panel-close'), 'click', function () { closePanel(true); });
    listen(root.querySelector('.reset-position'), 'click', resetPosition);
    listen(actionSelect, 'change', function () { setAction(actionSelect.value); save(); });
    listen(pauseInput, 'change', function () { state.manualPause = pauseInput.checked; syncAnimation(); save(); });
    listen(root, 'keydown', function (event) {
      if (event.key === 'Escape' && state.panelOpen) { event.preventDefault(); event.stopPropagation(); closePanel(true); }
    });
    listen(doc, 'pointerdown', function (event) { if (state.panelOpen && !event.composedPath().includes(host)) closePanel(false); });
    listen(doc, 'visibilitychange', function () { if (doc.hidden) endDrag(null); syncAnimation(); });
    listen(doc, 'denia:motionchange', syncAnimation);
    listen(global, 'resize', function () {
      if (state.left !== null && state.top !== null) moveTo(state.left, state.top);
      else adjustPanel();
    });
    if (media) {
      if (typeof media.addEventListener === 'function') listen(media, 'change', syncAnimation);
      else if (typeof media.addListener === 'function') { media.addListener(syncAnimation); cleanups.push(function () { media.removeListener(syncAnimation); }); }
    }
    const motionObserver = new MutationObserver(syncAnimation);
    motionObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });
    cleanups.push(function () { motionObserver.disconnect(); });

    const image = new Image();
    image.onload = function () {
      if (state.destroyed) return;
      state.loaded = true;
      state.failed = false;
      shell.dataset.loaded = 'true';
      handle.setAttribute('aria-label', '达妮娅桌宠，打开操作');
      actionSelect.disabled = false;
      syncAnimation();
    };
    image.onerror = function () {
      if (state.destroyed) return;
      state.failed = true;
      state.loaded = false;
      shell.dataset.loaded = 'false';
      fallback.textContent = '原图暂时不可用\n点击打开原页入口';
      handle.setAttribute('aria-label', '桌宠原图暂时不可用，打开原版页面入口与桌宠操作');
      actionSelect.disabled = true;
      syncAnimation();
    };

    function destroy() {
      if (state.destroyed) return;
      endDrag(null);
      state.destroyed = true;
      if (focusFrame) global.cancelAnimationFrame(focusFrame);
      image.onload = null;
      image.onerror = null;
      cleanups.forEach(function (cleanup) { cleanup(); });
      host.remove();
      if (activeInstance === api) activeInstance = null;
    }

    const api = { show: show, hide: hide, destroy: destroy };
    activeInstance = api;
    (doc.body || doc.documentElement).appendChild(host);
    setAction(state.action);
    syncShape();
    image.src = spriteUrl;
    return api;
  }

  global.DeniaPet = { mount: mount };
})(window, document);
