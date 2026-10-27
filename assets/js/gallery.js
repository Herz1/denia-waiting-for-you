/* ============================================================================
 * gallery.js —— 归档画廊
 * · 站藏/署名同人（本地镜像，带作者署名与原作链接）
 * · 原站归档 87 张（相机相册装帧 + 瀑布流 + 灯箱：键盘/滑动/缩放 + 信息栏）
 * · 图片懒加载 + 模糊占位 + 加载失败优雅降级
 * ==========================================================================*/
(function (global) {
  'use strict';
  var C = global.DENIA_CORE, D = global.DENIA, G = global.DENIA_GALLERY;
  if (!C || !D || !G) return;
  var el = C.el, esc = C.esc, toast = C.toast;

  var state = { cat: 'all', tag: '' };
  var view = [];           /* 当前过滤后的条目（灯箱导航用） */
  var lbIndex = 0;

  /* ------------------------------------------------- 站藏 / 署名同人 */
  function localCards() {
    var host = document.querySelector('[data-local-art]');
    if (!host) return;
    var keys = ['sleepFull', 'sleepPortrait', 'hirohenuri', 'stardust', 'minglu'];
    keys.forEach(function (k) {
      var a = D.art[k];
      var card = el('figure', 'card reveal local-card');
      card.style.margin = '0';
      card.style.overflow = 'hidden';
      card.innerHTML =
        '<div style="aspect-ratio:3/4;overflow:hidden;background:var(--bg-2)">' +
        '<img loading="lazy" alt="' + esc(a.trueContent) + '" src="' + a.path + '" style="width:100%;height:100%;object-fit:cover;object-position:50% 22%"></div>' +
        '<figcaption style="padding:12px 16px 16px;display:grid;gap:6px">' +
        '<strong style="font-size:.95rem">' + esc(a.trueContent) + '</strong>' +
        '<span class="src-tag official">' + esc(a.credit) + '</span>' +
        (a.sourceUrl ? '<a href="' + esc(a.sourceUrl) + '" target="_blank" rel="noopener noreferrer" style="font-size:.8rem">原作链接 ↗</a>' : '<span class="src-tag site" data-slot="credit-' + k + '">原作链接待站长补充</span>') +
        '</figcaption>';
      host.appendChild(card);
    });
  }

  /* ------------------------------------------------------- 过滤工具 */
  function filtered() {
    return G.items.filter(function (it) {
      if (state.cat === 'illustration' && it.cat !== 'illustration') return false;
      if (state.cat === 'ai' && it.cat !== 'ai') return false;
      if (state.tag && it.tags.indexOf(state.tag) < 0) return false;
      return true;
    });
  }
  function allTags() {
    var set = {};
    G.items.forEach(function (it) { it.tags.forEach(function (t) { set[t] = (set[t] || 0) + 1; }); });
    return Object.keys(set).sort(function (a, b) { return set[b] - set[a]; });
  }

  /* ------------------------------------------------------- 网格渲染 */
  var io = null;
  function lazyImg(img) {
    if (!io && 'IntersectionObserver' in global) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var im = e.target;
          io.unobserve(im);
          im.src = im.getAttribute('data-src');
        });
      }, { rootMargin: '320px 0px' });
    }
    if (io) io.observe(img); else img.src = img.getAttribute('data-src');
  }

  function render() {
    var grid = document.querySelector('[data-cam-grid]');
    var count = document.querySelector('[data-gal-count]');
    if (!grid) return;
    grid.innerHTML = '';
    view = filtered();
    var groups = {};
    view.forEach(function (it) { if (it.group) groups[it.group.id] = it.group.title; });

    view.forEach(function (it, i) {
      var card = el('div', 'cam-card reveal in' + (it.cat === 'ai' ? ' ai' : ''));
      var ar = it.crop ? '4 / 5' : ((i % 5 === 2) ? '1 / 1' : '4 / 5');
      card.innerHTML =
        '<div class="mat" style="--ar:' + ar + '">' +
        '<img class="ph" alt="' + esc(it.title) + '（归档图 ' + (i + 1) + '/' + view.length + '）" data-src="' + esc(it.thumb) + '">' +
        '<span class="chrome" aria-hidden="true">' +
        '<img class="tl" src="' + G.chrome.arrow + '" alt="" onerror="this.remove()">' +
        '<img class="tr" src="' + G.chrome.arrow + '" alt="" onerror="this.remove()">' +
        '<img class="bl" src="' + G.chrome.arrow + '" alt="" onerror="this.remove()">' +
        '<img class="br" src="' + G.chrome.arrow + '" alt="" onerror="this.remove()">' +
        '</span>' +
        (it.group ? '<span class="group-badge">' + esc(it.group.title) + ' · ' + (it.group.order + 1) + '</span>' : '') +
        '<button class="open-lb" type="button" aria-label="查看大图：' + esc(it.title) + '"></button>' +
        '</div>' +
        '<div class="meta"><span class="t" title="' + esc(it.title) + '">' + esc(it.title) + '</span>' +
        '<span class="tags">' + it.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</span>' +
        '</div>';
      var img = card.querySelector('img.ph');
      img.addEventListener('load', function () { img.classList.add('loaded'); img.classList.remove('ph'); });
      img.addEventListener('error', function () {
        var fail = el('div', 'fail', '原站暂不可达<br><small>' + esc(it.id.slice(0, 8)) + '</small>');
        card.querySelector('.mat').appendChild(fail);
        img.remove();
      });
      lazyImg(img);
      card.querySelector('.open-lb').addEventListener('click', function () { openLb(i); });
      grid.appendChild(card);
    });

    if (count) {
      count.textContent = view.length + ' 张 · ' + Object.keys(groups).length + ' 个组图 · 原站共 ' + G.totals.images + ' 张';
    }
    if (!view.length) grid.appendChild(el('p', '', '这个筛选下暂时没有图。换一个试试？'));
  }

  /* ----------------------------------------------------------- 灯箱 */
  var lb = null, lbImg = null, lbInfo = null, lbTitle = null, zoom = 1, pan = { x: 0, y: 0 };
  function ensureLb() {
    if (lb) return;
    lb = el('div', 'lightbox');
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', '画廊大图查看器');
    lb.hidden = true;
    lb.innerHTML =
      '<div class="lb-top">' +
      '<span class="title"></span><span style="flex:1"></span>' +
      '<button class="icon-btn" type="button" data-zoom-out aria-label="缩小"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6"/></svg></button>' +
      '<button class="icon-btn" type="button" data-zoom-in aria-label="放大"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6"/></svg></button>' +
      '<button class="icon-btn" type="button" data-close aria-label="关闭（Esc）"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div>' +
      '<div class="lb-stage"><img alt="" draggable="false">' +
      '<button class="icon-btn lb-nav prev" type="button" aria-label="上一张（←）"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 6-6 6 6 6"/></svg></button>' +
      '<button class="icon-btn lb-nav next" type="button" aria-label="下一张（→）"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m10 6 6 6-6 6"/></svg></button>' +
      '</div>' +
      '<div class="lb-info"><span class="meta"></span><span class="tags"></span><span class="zoom-hint">滚轮/双指缩放 · 拖拽平移 · ←→ 切换 · Esc 关闭</span></div>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('.lb-stage img');
    lbInfo = lb.querySelector('.lb-info .meta');
    lbTitle = lb.querySelector('.lb-top .title');

    lb.querySelector('[data-close]').addEventListener('click', closeLb);
    lb.querySelector('.lb-nav.prev').addEventListener('click', function () { step(-1); });
    lb.querySelector('.lb-nav.next').addEventListener('click', function () { step(1); });
    lb.querySelector('[data-zoom-in]').addEventListener('click', function () { setZoom(zoom * 1.3); });
    lb.querySelector('[data-zoom-out]').addEventListener('click', function () { setZoom(zoom / 1.3); });

    /* 键盘 */
    addEventListener('keydown', function (e) {
      if (!lb || lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.3);
      else if (e.key === '-') setZoom(zoom / 1.3);
    });
    /* 滚轮缩放 */
    lb.querySelector('.lb-stage').addEventListener('wheel', function (e) {
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.12 : 0.9));
    }, { passive: false });
    /* 拖拽平移 / 触摸滑动切换 */
    var drag = null;
    lbImg.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, t: Date.now(), moved: 0 };
      lbImg.setPointerCapture(e.pointerId);
    });
    lbImg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(dx));
      if (zoom > 1) { pan.x = drag.px + dx; pan.y = drag.py + dy; applyTransform(); }
    });
    lbImg.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (zoom <= 1 && Math.abs(dx) > 60 && Date.now() - drag.t < 600) step(dx < 0 ? 1 : -1);
      drag = null;
    });
    lbImg.addEventListener('dblclick', function () { setZoom(zoom > 1 ? 1 : 2.2); });
  }
  function setZoom(z) {
    zoom = Math.max(1, Math.min(5, z));
    if (zoom === 1) { pan.x = 0; pan.y = 0; }
    applyTransform();
  }
  function applyTransform() {
    lbImg.style.transform = 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')';
  }
  function openLb(i) {
    ensureLb();
    lbIndex = i;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    show();
    lb.querySelector('[data-close]').focus();
  }
  function closeLb() {
    lb.hidden = true;
    document.body.style.overflow = '';
  }
  function step(d) {
    lbIndex = (lbIndex + d + view.length) % view.length;
    show();
  }
  function show() {
    var it = view[lbIndex];
    zoom = 1; pan.x = 0; pan.y = 0; applyTransform();
    lbImg.classList.remove('loaded');
    lbImg.style.opacity = '0.25';
    lbImg.onerror = function () {
      /* 原图接口不可用时回落到缩略图，再不行给提示 */
      if (lbImg.getAttribute('src') !== it.thumb) { lbImg.src = it.thumb; }
      else { lbImg.style.opacity = '1'; lbInfo.textContent = '原站暂不可达：' + it.id; }
    };
    lbImg.onload = function () { lbImg.style.opacity = '1'; };
    lbImg.src = it.src;
    lbImg.alt = it.title;
    lbTitle.textContent = (lbIndex + 1) + ' / ' + view.length + ' · ' + it.title;
    lbInfo.innerHTML =
      '收录于 ' + esc(it.savedAt) +
      (it.group ? ' · 组图「' + esc(it.group.title) + '」第 ' + (it.group.order + 1) + ' 张' : '') +
      ' · <a href="' + esc(it.src) + '" target="_blank" rel="noopener noreferrer">原图</a>' +
      ' · <a href="' + esc(G.origin) + '/gallery" target="_blank" rel="noopener noreferrer">原站画廊</a>' +
      ' · <span class="src-tag site" data-slot="credit-' + esc(it.id.slice(0, 8)) + '">作者署名待站长补充</span>';
    lb.querySelector('.lb-info .tags').innerHTML = it.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
  }

  /* --------------------------------------------------------- 工具栏 */
  function toolbar() {
    var bar = document.querySelector('[data-gal-toolbar]');
    if (!bar) return;
    var cats = [['all', '全部'], ['illustration', '手绘 / 收藏'], ['ai', 'AI 草稿 · 归档']];
    cats.forEach(function (c) {
      var b = el('button', 'chip');
      b.type = 'button';
      b.textContent = c[1];
      b.setAttribute('aria-pressed', state.cat === c[0] ? 'true' : 'false');
      b.addEventListener('click', function () {
        state.cat = c[0];
        bar.querySelectorAll('[data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        render();
      });
      b.setAttribute('data-cat', c[0]);
      bar.appendChild(b);
    });
    bar.appendChild(el('span', 'spacer'));
    var tagSel = el('select');
    tagSel.setAttribute('aria-label', '按标签筛选');
    tagSel.innerHTML = '<option value="">全部标签</option>' + allTags().map(function (t) {
      return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
    }).join('');
    tagSel.className = 'chip';
    tagSel.style.padding = '6px 10px';
    tagSel.addEventListener('change', function () { state.tag = tagSel.value; render(); });
    bar.appendChild(tagSel);
    var count = el('span', 'gal-count');
    count.setAttribute('data-gal-count', '');
    bar.appendChild(count);
  }

  function boot() {
    localCards();
    toolbar();
    render();
    /* 归档说明 */
    var notice = document.querySelector('[data-ai-notice]');
    if (notice) notice.textContent = G.aiArchiveNotice;
    var pledge = document.querySelector('[data-pledge]');
    if (pledge) pledge.textContent = G.pledge;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
