/* ============================================================================
 * core.js —— 全站共用的运行时
 * 内容：工具函数 / 双形态主题 / 动效开关 / 泡泡粒子层 / 自定义光标 / 滚动进度
 *       移动抽屉 / 滚动入场 / 剧透折叠 / toast / 迷你桌宠 / 等待计数
 * 全部为经典脚本（非 ESM），保证 file:// 直接打开也能运行。
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.DENIA || {};
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式：忽略 */ } }
  };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function motionOff() {
    var m = document.documentElement.getAttribute('data-motion');
    if (m === 'off') return true;
    if (m === 'on') return false;
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ------------------------------------------------------------- toast */
  var toastWrap = null;
  function toast(text) {
    if (!toastWrap) { toastWrap = el('div', 'toast-wrap'); toastWrap.setAttribute('aria-live', 'polite'); document.body.appendChild(toastWrap); }
    var t = el('div', 'toast', esc(text));
    toastWrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 2200);
    setTimeout(function () { t.remove(); }, 2700);
  }

  /* ------------------------------------------------------ 双形态主题 */
  var veil = null;
  function applyMode(mode, animate) {
    var root = document.documentElement;
    if (animate && !motionOff()) {
      if (!veil) { veil = el('div', 'mode-veil'); veil.innerHTML = '<div class="ring"></div>'; document.body.appendChild(veil); }
      veil.classList.remove('play');
      void veil.offsetWidth;
      veil.classList.add('play');
      setTimeout(function () { root.setAttribute('data-mode', mode); }, 260);
    } else {
      root.setAttribute('data-mode', mode);
    }
    store.set('denia.mode', mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'echo' ? '#0b1026' : '#fbf6f3');
    document.querySelectorAll('[data-mode-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', mode === 'echo' ? 'true' : 'false');
      var lab = b.querySelector('.lab');
      if (lab) lab.textContent = mode === 'echo' ? '鸣式' : '日常';
    });
  }

  /* ------------------------------------------------------ 动效开关 */
  function applyMotion(val) {
    var root = document.documentElement;
    if (val === 'off') root.setAttribute('data-motion', 'off');
    else if (val === 'on') root.setAttribute('data-motion', 'on');
    else root.removeAttribute('data-motion');
    if (val) store.set('denia.motion', val); else store.set('denia.motion', '');
    document.querySelectorAll('[data-motion-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', motionOff() ? 'true' : 'false');
    });
    if (motionOff()) Bubbles.stop(); else Bubbles.start();
  }

  /* --------------------------------------------------- 泡泡粒子层 */
  var Bubbles = (function () {
    var cv, ctx, list = [], raf = 0, running = false, W = 0, Hh = 0, dpr = 1;
    var pointer = { x: -9999, y: -9999 };

    function size() {
      dpr = Math.min(2, global.devicePixelRatio || 1);
      W = global.innerWidth; Hh = global.innerHeight;
      cv.width = W * dpr; cv.height = Hh * dpr;
      cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function targetCount() {
      /* 依设备性能与屏幕尺寸自适应：面积越大越多，上限 26 */
      var area = global.innerWidth * global.innerHeight;
      var low = (global.navigator && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
      var n = Math.round(area / 52000);
      if (low) n = Math.round(n / 2);
      return Math.max(6, Math.min(26, n));
    }
    function make(seedY) {
      var r = 6 + Math.random() * 26;
      return {
        x: Math.random() * W,
        y: seedY === undefined ? Hh + r + Math.random() * Hh * 0.4 : Math.random() * Hh,
        r: r, vy: 0.16 + Math.random() * 0.42, ph: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 0.9, pop: 0, hue: Math.random()
      };
    }
    function sync() {
      var n = targetCount();
      while (list.length < n) list.push(make());
      if (list.length > n) list.length = n;
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, Hh);
      var echo = document.documentElement.getAttribute('data-mode') === 'echo';
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        b.y -= b.vy;
        b.x += Math.sin(t / 1400 * b.sp + b.ph) * 0.35;
        /* 鼠标靠近时轻微避让 */
        var dx = b.x - pointer.x, dy = b.y - pointer.y;
        var d2 = dx * dx + dy * dy, rr = b.r + 60;
        if (d2 < rr * rr && d2 > 0.01) {
          var d = Math.sqrt(d2), f = (1 - d / rr) * 0.9;
          b.x += (dx / d) * f * 2.2; b.y += (dy / d) * f * 2.2;
        }
        if (b.pop > 0) {
          b.pop += 0.08;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - b.pop);
          ctx.strokeStyle = echo ? 'rgba(180,225,255,.9)' : 'rgba(255,255,255,.95)';
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 + b.pop * 0.9), 0, 6.2832); ctx.stroke();
          ctx.restore();
          if (b.pop >= 1) { list[i] = make(); }
          continue;
        }
        if (b.y < -b.r - 8) { list[i] = make(Hh + b.r); continue; }
        var g = ctx.createRadialGradient(b.x - b.r * 0.34, b.y - b.r * 0.38, b.r * 0.1, b.x, b.y, b.r);
        if (echo) {
          g.addColorStop(0, 'rgba(220,240,255,.5)');
          g.addColorStop(0.42, 'rgba(143,211,232,.14)');
          g.addColorStop(1, 'rgba(143,211,232,0)');
        } else {
          g.addColorStop(0, 'rgba(255,255,255,.62)');
          g.addColorStop(0.42, 'rgba(246,169,196,.16)');
          g.addColorStop(1, 'rgba(183,164,230,0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
        /* 彩虹薄膜边缘 */
        ctx.strokeStyle = echo ? 'rgba(190,230,255,.42)' : 'rgba(255,255,255,.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.stroke();
        ctx.strokeStyle = 'rgba(143,211,232,.28)';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.94, -0.6, 0.9); ctx.stroke();
        /* 泡内星点 */
        ctx.fillStyle = echo ? 'rgba(230,245,255,.55)' : 'rgba(255,255,255,.7)';
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.34, Math.max(1, b.r * 0.09), 0, 6.2832); ctx.fill();
      }
      raf = global.requestAnimationFrame(draw);
    }
    function onDown(e) {
      if (motionOff()) return;
      var x = e.clientX, y = e.clientY;
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        var dx = b.x - x, dy = b.y - y;
        if (dx * dx + dy * dy < (b.r + 10) * (b.r + 10) && b.pop === 0) { b.pop = 0.001; }
      }
    }
    function onMove(e) { pointer.x = e.clientX; pointer.y = e.clientY; }
    function onVis() { if (document.hidden) stop(); else start(); }
    function start() {
      if (running || motionOff() || !cv) return;
      running = true; sync(); raf = global.requestAnimationFrame(draw);
    }
    function stop() { if (!running) return; running = false; cancelAnimationFrame(raf); if (ctx) ctx.clearRect(0, 0, W, Hh); }
    function init() {
      cv = document.getElementById('bubbles');
      if (!cv) return;
      ctx = cv.getContext && cv.getContext('2d');
      if (!ctx) return; /* 环境不支持 canvas：安静退出，不影响其余功能 */
      size();
      global.addEventListener('resize', function () { size(); sync(); }, { passive: true });
      global.addEventListener('pointerdown', onDown, { passive: true });
      global.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('visibilitychange', onVis);
      start();
    }
    return { init: init, start: start, stop: stop };
  })();

  /* --------------------------------------------------- 自定义光标 */
  function initCursor() {
    if (!global.matchMedia || !matchMedia('(pointer: fine)').matches) return;
    var c = el('div'); c.id = 'cursor'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    var x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, on = false;
    function loop() {
      x += (tx - x) * 0.24; y += (ty - y) * 0.24;
      c.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    }
    addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!on && !motionOff()) { on = true; document.documentElement.classList.add('has-cursor'); }
    }, { passive: true });
    addEventListener('pointerdown', function () { c.classList.add('press'); }, { passive: true });
    addEventListener('pointerup', function () { c.classList.remove('press'); }, { passive: true });
    document.addEventListener('mouseleave', function () { on = false; document.documentElement.classList.remove('has-cursor'); });
    loop();
  }

  /* ------------------------------------------- 滚动进度 / 入场 / 抽屉 */
  function initScrollUI() {
    var bar = document.querySelector('.progress');
    if (bar) {
      var tick = function () {
        var h = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
      };
      addEventListener('scroll', tick, { passive: true }); tick();
    }
    if ('IntersectionObserver' in global) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      document.querySelectorAll('.reveal').forEach(function (n) { io.observe(n); });
      /* 动态插入的 .reveal（语录/时间线/画廊卡片）也要被观察到 */
      if ('MutationObserver' in global) {
        var mo = new MutationObserver(function (muts) {
          muts.forEach(function (m) {
            m.addedNodes.forEach(function (n) {
              if (n.nodeType !== 1) return;
              if (n.classList && n.classList.contains('reveal') && !n.classList.contains('in')) io.observe(n);
              if (n.querySelectorAll) n.querySelectorAll('.reveal:not(.in)').forEach(function (x) { io.observe(x); });
            });
          });
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }
    } else {
      document.querySelectorAll('.reveal').forEach(function (n) { n.classList.add('in'); });
    }
    var menuBtn = document.querySelector('[data-menu]');
    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        var open = document.body.classList.toggle('nav-open');
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.querySelectorAll('.nav-links a').forEach(function (a) {
        a.addEventListener('click', function () { document.body.classList.remove('nav-open'); menuBtn.setAttribute('aria-expanded', 'false'); });
      });
      addEventListener('keydown', function (e) { if (e.key === 'Escape') document.body.classList.remove('nav-open'); });
    }
  }

  /* ------------------------------------------------------ 剧透折叠 */
  function initSpoilers() {
    var unlocked = store.get('denia.spoilers', '') === '1';
    function paint() {
      document.querySelectorAll('.spoiler-box').forEach(function (b) {
        b.classList.toggle('open', unlocked);
        var btn = b.querySelector('[data-spoiler-toggle]');
        if (btn) btn.setAttribute('aria-expanded', unlocked ? 'true' : 'false');
      });
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-spoiler-toggle]');
      if (!t) return;
      unlocked = !unlocked;
      store.set('denia.spoilers', unlocked ? '1' : '');
      paint();
      toast(unlocked ? '已展开剧透内容。……是你自己选择的哦。' : '剧透已重新折叠。有些事，还是不知道比较幸福。');
    });
    paint();
  }

  /* ------------------------------------------------------ 迷你桌宠 */
  function initMiniPet() {
    if (!D.art) return;
    if (document.body.hasAttribute('data-no-minipet')) return; /* 互动区已有完整桌宠 */
    var pet = el('button', 'mini-pet');
    pet.type = 'button';
    pet.setAttribute('aria-label', '迷你桌宠：达妮娅。拖拽可以移动她，点她会说话，停留可以摸摸头。');
    pet.innerHTML =
      '<img class="pet-img" alt="" src="' + D.art.sleepPortrait.path + '" draggable="false">' +
      '<span class="zzz" hidden>z z</span>' +
      '<span class="speech" role="status"></span>';
    document.body.appendChild(pet);
    var img = pet.querySelector('.pet-img'), zzz = pet.querySelector('.zzz'), speech = pet.querySelector('.speech');
    var lines = (D.chat && D.chat.greet || []).concat(D.chat && D.chat.idle || []);
    var li = 0, nap = false, hoverT = 0, dragging = false, vx = 0, vy = 0, px = 0, py = 0;

    function say(text, ms) {
      speech.textContent = text;
      pet.classList.add('talk');
      clearTimeout(say._t);
      say._t = setTimeout(function () { pet.classList.remove('talk'); }, ms || 2600);
    }
    function setNap(on) {
      nap = on;
      zzz.hidden = !on;
      img.src = on ? D.art.sleepPortrait.path : D.art.sleepFull.path;
      img.style.objectPosition = on ? '50% 30%' : '50% 16%';
    }
    setNap(false);

    /* 拖拽 + 抛掷 */
    var rect = null, ox = 0, oy = 0, last = null;
    pet.addEventListener('pointerdown', function (e) {
      dragging = true; pet.setPointerCapture(e.pointerId);
      rect = pet.getBoundingClientRect();
      ox = e.clientX - rect.left; oy = e.clientY - rect.top;
      last = { x: e.clientX, y: e.clientY, t: performance.now() };
      vx = vy = 0;
    });
    pet.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var nx = e.clientX - ox, ny = e.clientY - oy;
      pet.style.right = 'auto'; pet.style.bottom = 'auto';
      pet.style.left = nx + 'px'; pet.style.top = ny + 'px';
      var now = performance.now(), dt = Math.max(8, now - last.t);
      vx = (e.clientX - last.x) / dt * 16; vy = (e.clientY - last.y) / dt * 16;
      last = { x: e.clientX, y: e.clientY, t: now };
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      /* 惯性抛掷，落地回弹到视口内 */
      var r = pet.getBoundingClientRect(), x = r.left, y = r.top;
      var steps = 0;
      (function fly() {
        if (steps++ > 40) return;
        x += vx; y += vy; vy += 0.6;
        var w = innerWidth - r.width, h = innerHeight - r.height;
        if (x < 4) { x = 4; vx *= -0.5; } if (x > w) { x = w; vx *= -0.5; }
        if (y > h) { y = h; vy *= -0.42; vx *= 0.86; if (Math.abs(vy) < 1.2) return; }
        if (y < 4) { y = 4; vy *= -0.5; }
        pet.style.left = x + 'px'; pet.style.top = y + 'px';
        requestAnimationFrame(fly);
      })();
      say(lines[li++ % lines.length]);
    }
    pet.addEventListener('pointerup', endDrag);
    pet.addEventListener('pointercancel', endDrag);

    /* 点击说话 / 停留摸头 */
    pet.addEventListener('click', function () { if (!dragging) say(lines[li++ % lines.length]); });
    pet.addEventListener('pointerenter', function () {
      hoverT = setTimeout(function () {
        say('（摸摸头）……嗯，再摸一下也可以。');
        pet.querySelector('.pet-img').style.transform = 'scale(1.1) rotate(-4deg)';
        setTimeout(function () { pet.querySelector('.pet-img').style.transform = ''; }, 700);
      }, 1100);
    });
    pet.addEventListener('pointerleave', function () { clearTimeout(hoverT); });

    /* 久不看她 → 打盹 */
    var napT = setTimeout(function () { setNap(true); }, 26000);
    ['pointerdown', 'keydown'].forEach(function (ev) {
      addEventListener(ev, function () {
        if (nap) setNap(false);
        clearTimeout(napT);
        napT = setTimeout(function () { setNap(true); }, 40000);
      }, { passive: true });
    });
    global.DENIA_PET_SAY = say;
  }

  /* ------------------------------------- 温柔的谎言：悬停改口 */
  function initLies() {
    document.querySelectorAll('[data-lie]').forEach(function (n) {
      var truth = n.textContent;
      var lie = n.getAttribute('data-lie');
      function to(l) { n.style.transition = 'opacity .18s'; n.style.opacity = '0'; setTimeout(function () { n.textContent = l; n.style.opacity = '1'; }, 180); }
      n.addEventListener('pointerenter', function () { to(lie); });
      n.addEventListener('pointerleave', function () { to(truth); });
      n.addEventListener('focus', function () { to(lie); });
      n.addEventListener('blur', function () { to(truth); });
    });
  }

  /* ------------------------------------------------------ 等待计数 */
  function waitDays() {
    var start = new Date((D.meta && D.meta.waitStart || '2026-05-20') + 'T00:00:00');
    var now = new Date();
    var ms = now.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round(ms / 86400000));
  }

  /* ------------------------------------------------------------ boot */
  function boot() {
    var root = document.documentElement;
    root.setAttribute('data-mode', store.get('denia.mode', 'daily'));
    var mv = store.get('denia.motion', '');
    if (mv === 'off') root.setAttribute('data-motion', 'off');
    else if (mv === 'on') root.setAttribute('data-motion', 'on');

    document.querySelectorAll('[data-mode-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        applyMode(root.getAttribute('data-mode') === 'echo' ? 'daily' : 'echo', true);
      });
    });
    document.querySelectorAll('[data-motion-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        applyMotion(motionOff() ? 'on' : 'off');
        toast(motionOff() ? '已减少动效。泡泡们先休息一会儿。' : '动效已恢复。泡泡回来了。');
      });
    });
    applyMode(root.getAttribute('data-mode'), false);
    applyMotion(store.get('denia.motion', '') || null);

    Bubbles.init();
    initCursor();
    initScrollUI();
    initSpoilers();
    initLies();
    initMiniPet();

    /* 页脚年份 */
    document.querySelectorAll('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
    /* 等待天数（所有页面通用） */
    document.querySelectorAll('[data-wait-days]').forEach(function (n) { n.textContent = waitDays(); });
  }

  global.DENIA_CORE = {
    el: el, esc: esc, toast: toast, store: store, motionOff: motionOff,
    applyMode: applyMode, waitDays: waitDays, Bubbles: Bubbles
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
