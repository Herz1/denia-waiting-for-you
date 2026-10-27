/* ============================================================================
 * home.js —— 首页分区逻辑
 * 0 开场泡泡 1 首屏逐字台词 2 蛋糕仪式 3 语录墙（复制 / 分享为图片）
 * 4 时间线渲染 5 心愿泡泡（localStorage，预留后端接口） 6 生日彩蛋
 * ==========================================================================*/
(function (global) {
  'use strict';
  var C = global.DENIA_CORE, D = global.DENIA;
  if (!C || !D) return;
  var el = C.el, esc = C.esc, toast = C.toast, store = C.store;

  /* ------------------------------------------------------- 0. 开场 */
  function intro() {
    if (store.get('denia.seen-intro', '') === '1' || C.motionOff()) return;
    var box = el('div', 'intro');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '开场：一颗泡泡正在升起');
    box.innerHTML =
      '<div class="bubble-seed" aria-hidden="true"></div>' +
      '<p class="intro-line">不要看，不要听，<br>然后忘掉吧……</p>' +
      '<button class="btn ghosty small skip" type="button">跳过开场</button>';
    document.body.appendChild(box);
    function done() {
      box.classList.add('done');
      store.set('denia.seen-intro', '1');
      setTimeout(function () { box.remove(); }, 1200);
    }
    box.querySelector('.skip').addEventListener('click', done);
    addEventListener('keydown', function h(e) { if (e.key === 'Escape' || e.key === 'Enter') { done(); removeEventListener('keydown', h); } });
    setTimeout(done, 2600);
  }

  /* -------------------------------------------------- 1. 逐字台词 */
  function typeLine() {
    var host = document.querySelector('[data-type-line]');
    if (!host) return;
    var text = host.getAttribute('data-type-line');
    if (C.motionOff()) { host.textContent = text; return; }
    host.innerHTML = '<span class="txt"></span><span class="caret" aria-hidden="true"></span>';
    var span = host.querySelector('.txt'), i = 0;
    (function step() {
      if (i <= text.length) {
        span.textContent = text.slice(0, i);
        i++;
        setTimeout(step, 90 + Math.random() * 60);
      } else {
        setTimeout(function () { var c = host.querySelector('.caret'); if (c) c.remove(); }, 1600);
      }
    })();
  }

  /* -------------------------------------------------- 2. 蛋糕仪式 */
  function cakeRite() {
    var shelf = document.querySelector('[data-cake-shelf]');
    var btn = document.querySelector('[data-cake-btn]');
    var num = document.querySelector('[data-cake-count]');
    if (!shelf || !btn) return;
    var n = parseInt(store.get('denia.cake', '0'), 10) || 0;
    function paint() {
      shelf.innerHTML = '';
      var show = Math.min(n, 10);
      for (var i = 0; i < show; i++) {
        var c = el('span', 'cake', '🍰');
        c.style.animationDelay = (i * 40) + 'ms';
        shelf.appendChild(c);
      }
      shelf.classList.toggle('empty', n === 0);
      if (n > 10) shelf.appendChild(el('span', 'cake', '+' + (n - 10)));
      if (num) num.textContent = n;
    }
    btn.addEventListener('click', function () {
      n += 1; store.set('denia.cake', String(n)); paint();
      toast('给娅娅留了一块蛋糕。她现在大概在假装睡觉。');
      if (global.DENIA_PET_SAY) global.DENIA_PET_SAY('……蛋糕？我闻到了。谢谢，放架子上就好。');
    });
    paint();
  }

  /* -------------------------------------------------- 3. 语录墙 */
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('已复制。'); }, function () { fallbackCopy(t); });
    } else fallbackCopy(t);
  }
  function fallbackCopy(t) {
    var ta = el('textarea'); ta.value = t; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制。'); } catch (e) { toast('复制失败，请手动选择文本。'); }
    ta.remove();
  }

  function shareCard(q) {
    /* 分享为图片：纯 canvas 绘制，不依赖任何外部服务 */
    var W = 1200, H = 675, cv = el('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#fdf3f6'); grd.addColorStop(0.55, '#f3e9f4'); grd.addColorStop(1, '#e8eef8');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    /* 泡泡装饰 */
    var i, b;
    for (i = 0; i < 14; i++) {
      b = { x: Math.random() * W, y: Math.random() * H, r: 14 + Math.random() * 70 };
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.2832);
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = 'rgba(246,169,196,.10)'; g.fill();
    }
    g.fillStyle = '#8a71c9';
    g.font = '600 26px Georgia, "Songti SC", serif';
    g.fillText('До свидания · 直到下次再见', 72, 96);
    /* 正文换行 */
    g.fillStyle = '#382e3f';
    g.font = '700 44px Georgia, "Songti SC", serif';
    var words = q.text, line = '', y = 210, maxW = W - 144;
    for (i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (g.measureText(test).width > maxW) { g.fillText(line, 72, y); line = words[i]; y += 66; }
      else line = test;
    }
    g.fillText('「' + line + '」', 72, y);
    g.fillStyle = '#6b5f72';
    g.font = '400 24px Georgia, "Songti SC", serif';
    g.fillText('—— ' + q.source, 72, H - 120);
    g.fillStyle = '#8d8194';
    g.font = '400 20px Georgia, serif';
    g.fillText('dania · fan memorial · ' + new Date().toISOString().slice(0, 10), 72, H - 76);
    cv.toBlob(function (blob) {
      if (!blob) { toast('图片生成失败。'); return; }
      var a = el('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'denia-quote-' + Date.now() + '.png';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      toast('已生成分享卡片。');
    }, 'image/png');
  }

  function quotes() {
    var wall = document.querySelector('[data-quotes]');
    if (!wall) return;
    D.quotes.forEach(function (q, idx) {
      var card = el('article', 'card quote-card reveal ' + (q.kind === 'official' ? 'official' : 'site'));
      card.innerHTML =
        '<p class="q">' + esc(q.text) + '</p>' +
        '<div class="row">' +
        '<span class="src-tag ' + (q.kind === 'official' ? 'official' : 'site') + '">' +
        (q.kind === 'official' ? '官方 · ' : '站点 · ') + esc(q.source) + '</span>' +
        '<span class="acts">' +
        '<button class="icon-btn" type="button" data-copy title="复制台词" aria-label="复制台词"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>' +
        '<button class="icon-btn" type="button" data-share title="分享为图片" aria-label="分享为图片"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/></svg></button>' +
        '</span></div>';
      card.querySelector('[data-copy]').addEventListener('click', function () { copyText('「' + q.text + '」 —— ' + q.source); });
      card.querySelector('[data-share]').addEventListener('click', function () { shareCard(q); });
      wall.appendChild(card);
    });
    /* 「不要看」隐藏卡：只有点了的人才能读到的一句站点私语 */
    var secret = el('article', 'card quote-card reveal dontlook site');
    secret.innerHTML =
      '<p class="q">……其实我今天没有睡。我在等你翻到这一页。</p>' +
      '<div class="row"><span class="src-tag site">站点 · 不要看</span><span class="acts"></span></div>';
    var lock = el('button', 'btn ghosty small');
    lock.type = 'button';
    lock.textContent = '不要看（点了才会显示）';
    lock.style.cssText = 'position:absolute;inset:0;margin:auto;width:max-content;height:max-content';
    lock.addEventListener('click', function () {
      secret.classList.add('open'); lock.remove();
      toast('……你看了。那要负责记住她。');
    });
    secret.appendChild(lock);
    wall.appendChild(secret);
  }

  /* -------------------------------------------------- 3.5 档案表 */
  function profile() {
    var tb = document.querySelector('[data-profile]');
    if (tb && D.profile) {
      D.profile.rows.forEach(function (r) {
        var tr = el('tr');
        tr.innerHTML = '<th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) +
          (r[2] ? ' <span class="spoiler-box" style="display:inline-block"><span class="spoiler-body"><span class="src-tag official">剧透</span> ' + esc(r[2]) + '</span><span class="spoiler-lock"><button class="btn ghosty small" type="button" data-spoiler-toggle aria-expanded="false">已通关？展开</button></span></span>' : '') +
          '</td>';
        tb.appendChild(tr);
      });
    }
    var look = document.querySelector('[data-look]');
    if (look && D.profile) look.innerHTML = D.profile.look.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var per = document.querySelector('[data-personality]');
    if (per && D.profile) per.innerHTML = D.profile.personality.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
  }

  /* -------------------------------------------------- 4. 时间线 */
  function timeline() {
    var host = document.querySelector('[data-timeline]');
    if (!host) return;
    D.timeline.forEach(function (t, i) {
      var item = el('article', 'tl-item reveal');
      item.innerHTML =
        '<h3 class="ch"><small>CHAPTER ' + ('0' + (i + 1)).slice(-2) + ' · 共鸣链</small>' + esc(t.chapter) + '</h3>' +
        '<div class="card body">' +
        '<p>' + esc(t.safe) + '</p>' +
        '<div class="spoiler-box">' +
        '<div class="spoiler-body"><p style="margin:0">' + esc(t.spoiler) + '</p></div>' +
        '<div class="spoiler-lock"><button class="btn ghosty small" type="button" data-spoiler-toggle aria-expanded="false">我已通关，展开剧透</button></div>' +
        '</div></div>';
      host.appendChild(item);
    });
  }

  /* ------------------------------------- 5. 心愿泡泡（localStorage） */
  /* 预留后端：若站长部署了接口，把 DENIA_WISH.endpoint 指过去即可，
     load/save 会自动改走 fetch（GET/POST {text,who}），localStorage 仅作离线回落。 */
  var WISH = { key: 'denia.wishes', endpoint: null };
  function wishDefaults() {
    return [
      { t: '希望娅娅每天都有甜点吃。', w: '路过的漂泊者' },
      { t: '等她回来的那天，我要在评论区写一整页。', w: '匿名' },
      { t: '泡泡里见。', w: '站务组' }
    ];
  }
  function wishes() {
    var pool = document.querySelector('[data-wish-pool]');
    var form = document.querySelector('[data-wish-form]');
    if (!pool) return;
    var list;
    try { list = JSON.parse(store.get(WISH.key, '')) || null; } catch (e) { list = null; }
    if (!list) { list = wishDefaults(); store.set(WISH.key, JSON.stringify(list)); }

    function paint() {
      pool.innerHTML = '';
      list.forEach(function (w, i) {
        var size = 96 + ((i * 37) % 70);
        var b = el('button', 'wish-bubble');
        b.type = 'button';
        b.style.width = size + 'px'; b.style.height = size + 'px';
        b.style.left = (6 + ((i * 53) % 78)) + '%';
        b.style.top = (8 + ((i * 31) % 66)) + '%';
        b.style.animationDelay = (i * 0.4) + 's';
        b.setAttribute('aria-label', '心愿泡泡：' + w.t + '（点击戳破）');
        b.innerHTML = '<span>' + esc(w.t) + '<span class="who">— ' + esc(w.w || '匿名') + '</span></span>';
        b.addEventListener('click', function () {
          b.style.transition = 'transform .3s, opacity .3s';
          b.style.transform = 'scale(1.35)'; b.style.opacity = '0';
          setTimeout(function () { b.remove(); }, 320);
          toast('泡泡戳破了。心愿已经送达。');
        });
        pool.appendChild(b);
      });
      if (!list.length) pool.appendChild(el('p', '', '还没有心愿泡泡。写一个放进去吧。'));
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ta = form.querySelector('textarea'), who = form.querySelector('input');
        var t = (ta.value || '').trim().slice(0, 60);
        if (!t) { toast('先写一句心愿吧。'); return; }
        list.push({ t: t, w: (who.value || '').trim().slice(0, 12) || '匿名' });
        store.set(WISH.key, JSON.stringify(list));
        ta.value = '';
        paint();
        toast('心愿放进泡泡里了。');
      });
    }
    paint();
  }

  /* -------------------------------------------------- 6. 生日彩蛋 */
  function birthday() {
    var md = new Date();
    var mmdd = ('0' + (md.getMonth() + 1)).slice(-2) + '-' + ('0' + md.getDate()).slice(-2);
    var force = location.search.indexOf('bday=1') >= 0;
    if (!(force || mmdd === D.meta.birthdayHintMonthDay)) return;
    var box = el('div', 'bday');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '生日彩蛋');
    box.innerHTML =
      '<div class="card"><p class="ru">С днём рождения</p>' +
      '<h2>5 月 21 日，泡泡全部亮了一秒。</h2>' +
      '<p style="color:var(--ink-2)">до свидания 也是 С днём рождения。<br>如果有人记得，这一天就不只是实装纪念日。</p>' +
      '<button class="btn" type="button" data-close>替她吹蜡烛</button></div>';
    document.body.appendChild(box);
    box.querySelector('[data-close]').addEventListener('click', function () {
      box.remove();
      toast('蜡烛吹完了。愿望她收下了。');
    });
  }

  function boot() {
    intro();
    typeLine();
    cakeRite();
    profile();
    quotes();
    timeline();
    wishes();
    birthday();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
