/* ============================================================================
 * pet.js —— 互动区：桌宠 + 聊天 + 吹泡泡小游戏
 * 桌宠：拖拽抛掷 / 停留摸头 / 点击说话 / 喂蛋糕 / 打盹 / 自己散步
 * 聊天：规则式引擎（台词全部手写，无 AI 生成），记住你的称呼
 * 游戏：戳泡泡掉小知识；减少动效时改为静态泡泡墙
 * ==========================================================================*/
(function (global) {
  'use strict';
  var C = global.DENIA_CORE, D = global.DENIA;
  if (!C || !D) return;
  var el = C.el, esc = C.esc, toast = C.toast, store = C.store;

  /* ---------------------------------------------------------- 桌宠 */
  function pet() {
    var stage = document.querySelector('[data-pet-stage]');
    if (!stage) return;
    var pet = el('div');
    pet.style.cssText = 'position:absolute;width:150px;height:150px;left:40%;top:44%;cursor:grab;touch-action:none;user-select:none';
    pet.setAttribute('role', 'img');
    pet.setAttribute('aria-label', '桌宠：达妮娅。可以拖拽、摸头、喂蛋糕。');
    pet.innerHTML =
      '<img alt="" draggable="false" src="' + D.art.sleepFull.path + '" style="width:100%;height:100%;object-fit:cover;object-position:50% 16%;border-radius:50%;border:3px solid var(--bubble-edge);box-shadow:0 0 0 6px var(--accent-soft), 0 18px 40px -18px rgba(0,0,0,.4)">' +
      '<span class="zzz" style="position:absolute;top:-8px;right:-4px;color:var(--ink-2)" hidden>z z</span>';
    stage.appendChild(pet);
    var img = pet.querySelector('img'), zzz = pet.querySelector('.zzz');
    var vx = 0, vy = 0, dragging = false, nap = false, wanderT = 0;

    function say(t) { if (global.DENIA_PET_SAY) global.DENIA_PET_SAY(t, 3000); }
    function setNap(on) {
      nap = on; zzz.hidden = !on;
      img.src = on ? D.art.sleepPortrait.path : D.art.sleepFull.path;
      img.style.objectPosition = on ? '50% 30%' : '50% 16%';
    }

    var ox = 0, oy = 0, last = null;
    pet.addEventListener('pointerdown', function (e) {
      dragging = true; pet.setPointerCapture(e.pointerId);
      pet.style.cursor = 'grabbing';
      var r = pet.getBoundingClientRect(), s = stage.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      last = { x: e.clientX, y: e.clientY, t: performance.now(), s: s };
      vx = vy = 0;
      clearTimeout(wanderT);
    });
    pet.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var s = last.s;
      var x = e.clientX - s.left - ox, y = e.clientY - s.top - oy;
      pet.style.left = x + 'px'; pet.style.top = y + 'px';
      var now = performance.now(), dt = Math.max(8, now - last.t);
      vx = (e.clientX - last.x) / dt * 16; vy = (e.clientY - last.y) / dt * 16;
      last.x = e.clientX; last.y = e.clientY; last.t = now;
    });
    function drop() {
      if (!dragging) return;
      dragging = false; pet.style.cursor = 'grab';
      var s = stage.getBoundingClientRect(), r = pet.getBoundingClientRect();
      var x = r.left - s.left, y = r.top - s.top, steps = 0;
      (function fly() {
        if (steps++ > 60) { scheduleWander(); return; }
        x += vx; y += vy; vy += 0.55;
        var w = s.width - r.width, h = s.height - r.height;
        if (x < 0) { x = 0; vx *= -0.5; } if (x > w) { x = w; vx *= -0.5; }
        if (y > h) { y = h; vy *= -0.4; vx *= 0.88; if (Math.abs(vy) < 1 && Math.abs(vx) < 0.6) { scheduleWander(); return; } }
        if (y < 0) { y = 0; vy *= -0.5; }
        pet.style.left = x + 'px'; pet.style.top = y + 'px';
        requestAnimationFrame(fly);
      })();
      say('……被丢来丢去也不坏。');
    }
    pet.addEventListener('pointerup', drop);
    pet.addEventListener('pointercancel', drop);

    /* 停留摸头 */
    var hoverT = 0;
    pet.addEventListener('pointerenter', function () {
      hoverT = setTimeout(function () {
        say('（摸摸头）呆毛动了动，表示满意。');
        img.style.transform = 'rotate(-5deg) scale(1.05)';
        setTimeout(function () { img.style.transform = ''; }, 700);
      }, 1000);
    });
    pet.addEventListener('pointerleave', function () { clearTimeout(hoverT); });
    pet.addEventListener('click', function () {
      if (nap) { setNap(false); say('……嗯？我没睡。我在闭眼思考。'); return; }
      var l = D.chat.greet.concat(D.chat.idle);
      say(l[Math.floor(Math.random() * l.length)]);
    });

    /* 喂蛋糕 */
    var feed = document.querySelector('[data-feed]');
    if (feed) feed.addEventListener('click', function () {
      var n = parseInt(store.get('denia.cake', '0'), 10) || 0;
      store.set('denia.cake', String(n + 1));
      say('夺目甜蜜……？放到架子上吧，我饭点准时出现。');
      toast('蛋糕 +1。她现在装作不在意。');
      var heart = el('span');
      heart.textContent = '🍰';
      heart.style.cssText = 'position:absolute;font-size:1.4rem;pointer-events:none;transition:transform 1s ease,opacity 1s ease';
      heart.style.left = pet.style.left; heart.style.top = pet.style.top;
      stage.appendChild(heart);
      requestAnimationFrame(function () { heart.style.transform = 'translateY(-90px) scale(1.4)'; heart.style.opacity = '0'; });
      setTimeout(function () { heart.remove(); }, 1100);
    });
    /* 哄睡 */
    var napBtn = document.querySelector('[data-nap]');
    if (napBtn) napBtn.addEventListener('click', function () {
      setNap(!nap);
      say(nap ? '……晚安。泡泡替我值班。' : '好啦好啦，我起来了。');
    });

    /* 散步：没人理她时自己慢慢走 */
    function scheduleWander() {
      clearTimeout(wanderT);
      wanderT = setTimeout(function () {
        if (dragging || nap || C.motionOff()) { scheduleWander(); return; }
        var s = stage.getBoundingClientRect(), r = pet.getBoundingClientRect();
        var tx = Math.random() * (s.width - r.width), ty = s.height * (0.35 + Math.random() * 0.5);
        pet.style.transition = 'left 3.4s cubic-bezier(.4,.1,.3,1), top 3.4s cubic-bezier(.4,.1,.3,1)';
        pet.style.left = tx + 'px'; pet.style.top = ty + 'px';
        setTimeout(function () { pet.style.transition = ''; scheduleWander(); }, 3600);
      }, 9000 + Math.random() * 6000);
    }
    scheduleWander();
  }

  /* ---------------------------------------------------------- 聊天 */
  function chat() {
    var log = document.querySelector('[data-chat-log]');
    var form = document.querySelector('[data-chat-form]');
    if (!log || !form) return;
    var name = store.get('denia.myname', '');
    function push(cls, text) {
      var m = el('div', 'msg ' + cls, esc(text));
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
      while (log.children.length > 80) log.removeChild(log.firstChild);
    }
    function reply(input) {
      var m = input.match(/我(?:叫|是)\s*([\u4e00-\u9fa5A-Za-z0-9_]{1,12})/);
      if (m) { name = m[1]; store.set('denia.myname', name); return '记住啦，' + name + '。泡泡也记住了。'; }
      for (var i = 0; i < D.chat.rules.length; i++) {
        var r = D.chat.rules[i];
        if (new RegExp(r.re).test(input)) return r.a[Math.floor(Math.random() * r.a.length)];
      }
      return D.chat.fallback[Math.floor(Math.random() * D.chat.fallback.length)];
    }
    function send(text) {
      if (!text.trim()) return;
      push('me', text);
      setTimeout(function () {
        var pre = name && Math.random() < 0.25 ? name + '，' : '';
        push('her', pre + reply(text));
      }, 420 + Math.random() * 500);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input');
      send(input.value); input.value = '';
    });
    document.querySelectorAll('[data-quick]').forEach(function (b) {
      b.addEventListener('click', function () { send(b.getAttribute('data-quick')); });
    });
    push('sys', '—— 今天 · 一起待一会儿 ——');
    push('her', name ? name + '，你来啦。' : D.chat.greet[0]);
  }

  /* -------------------------------------------------- 吹泡泡小游戏 */
  function game() {
    var field = document.querySelector('[data-game-field]');
    var hud = document.querySelector('[data-game-hud]');
    var triviaHost = document.querySelector('[data-trivia]');
    var startBtn = document.querySelector('[data-game-start]');
    if (!field || !startBtn) return;
    var score = 0, timer = 0, left = 30, running = false, spawnT = 0;

    function hudPaint() {
      if (hud) hud.innerHTML = '<span>得分 <b>' + score + '</b></span><span>剩余 <b>' + left + 's</b></span><span>戳破泡泡会掉下一条小知识</span>';
    }
    function spawn() {
      var b = el('button', 'g-bubble');
      var size = 44 + Math.random() * 66;
      b.style.width = size + 'px'; b.style.height = size + 'px';
      b.style.left = (Math.random() * 88) + '%';
      b.style.bottom = '-80px';
      b.type = 'button';
      b.setAttribute('aria-label', '泡泡，点击戳破');
      field.appendChild(b);
      var dur = C.motionOff() ? 0 : 5200 + Math.random() * 3600;
      if (dur) {
        b.style.transition = 'bottom ' + dur + 'ms linear, transform .2s';
        requestAnimationFrame(function () { b.style.bottom = '110%'; });
      } else {
        b.style.bottom = (Math.random() * 78) + '%';
      }
      b.addEventListener('click', function () {
        score += 1; hudPaint();
        b.style.transform = 'scale(1.5)'; b.style.opacity = '0';
        setTimeout(function () { b.remove(); }, 220);
        if (triviaHost && score % 3 === 0) {
          triviaHost.textContent = '🫧 ' + D.trivia[Math.floor(Math.random() * D.trivia.length)];
        }
      });
      setTimeout(function () { if (b.isConnected) b.remove(); }, dur ? dur + 300 : 30000);
    }
    function loop() {
      if (!running) return;
      spawn();
      spawnT = setTimeout(loop, C.motionOff() ? 900 : 620 + Math.random() * 620);
    }
    function tick() {
      if (!running) return;
      left -= 1; hudPaint();
      if (left <= 0) { end(); return; }
      timer = setTimeout(tick, 1000);
    }
    function end() {
      running = false;
      clearTimeout(spawnT); clearTimeout(timer);
      field.querySelectorAll('.g-bubble').forEach(function (b) { b.remove(); });
      hudPaint();
      toast('本轮结束：戳破 ' + score + ' 个泡泡。');
      startBtn.disabled = false;
      startBtn.textContent = '再来一轮';
    }
    startBtn.addEventListener('click', function () {
      if (running) return;
      running = true; score = 0; left = 30;
      startBtn.disabled = true;
      startBtn.textContent = '进行中……';
      hudPaint(); loop(); tick();
    });
    hudPaint();
    if (triviaHost) triviaHost.textContent = '🫧 ' + D.trivia[0];
  }

  function boot() { pet(); chat(); game(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
