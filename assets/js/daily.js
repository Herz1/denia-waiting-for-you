/* ============================================================================
 * daily.js —— 《达妮娅日报 · 2026-10-17》收录页
 * 49 部作品：分类筛选 / 搜索 / 排序；全部外链回 B 站原投稿，作者署名完整保留。
 * ==========================================================================*/
(function (global) {
  'use strict';
  var C = global.DENIA_CORE, D = global.DENIA_DAILY;
  if (!C || !D) return;
  var el = C.el, esc = C.esc;

  var state = { kind: '', q: '', sort: 'n' };

  function kinds() {
    var m = {};
    D.works.forEach(function (w) { m[w.kind] = (m[w.kind] || 0) + 1; });
    return Object.keys(m).map(function (k) { return [k, m[k]]; });
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = D.works.filter(function (w) {
      if (state.kind && w.kind !== state.kind) return false;
      if (!q) return true;
      return (w.title + ' ' + w.author + ' ' + w.tags.join(' ')).toLowerCase().indexOf(q) >= 0;
    });
    if (state.sort === 'plays') list.sort(function (a, b) { return b.plays - a.plays; });
    else if (state.sort === 'fav') list.sort(function (a, b) { return b.fav - a.fav; });
    else list.sort(function (a, b) { return a.n - b.n; });
    return list;
  }
  function fmt(n) { return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n); }

  function render() {
    var host = document.querySelector('[data-daily-list]');
    var count = document.querySelector('[data-daily-count]');
    if (!host) return;
    host.innerHTML = '';
    var list = filtered();
    list.forEach(function (w) {
      var card = el('article', 'card work-card reveal in');
      card.innerHTML =
        '<div class="idx">' + ('0' + w.n).slice(-2) + '</div>' +
        '<div>' +
        '<h3><a href="' + esc(w.url) + '" target="_blank" rel="noopener noreferrer">' + esc(w.title) + ' ↗</a></h3>' +
        '<div class="who"><a href="' + esc(w.authorUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(w.author) + '</a>' +
        ' · ' + esc(w.kind) + ' · ' + esc(w.duration) + ' · 10 月 17 日 ' + esc(w.time.split(' ')[1] || w.time) + ' 发布</div>' +
        '<div class="stats"><span>▶ ' + fmt(w.plays) + '</span><span>弹 ' + w.danmaku + '</span><span>★ ' + fmt(w.fav) + '</span><span>币 ' + w.coin + '</span>' +
        '<span>' + w.bv + '</span></div>' +
        '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' + w.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        (w.desc ? '<details><summary>作品简介</summary><p>' + esc(w.desc) + '</p></details>' : '') +
        '</div>';
      host.appendChild(card);
    });
    if (count) count.textContent = '本期 ' + D.works.length + ' 部 · 当前显示 ' + list.length + ' 部';
    if (!list.length) host.appendChild(el('p', '', '没有匹配的收录。换个关键词试试。'));
  }

  function boot() {
    var bar = document.querySelector('[data-daily-toolbar]');
    if (bar) {
      var all = el('button', 'chip');
      all.type = 'button'; all.textContent = '全部 ' + D.works.length;
      all.setAttribute('aria-pressed', 'true');
      all.addEventListener('click', function () {
        state.kind = '';
        bar.querySelectorAll('[data-kind]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        all.setAttribute('aria-pressed', 'true'); render();
      });
      bar.appendChild(all);
      kinds().forEach(function (k) {
        var b = el('button', 'chip');
        b.type = 'button'; b.textContent = k[0] + ' ' + k[1];
        b.setAttribute('data-kind', k[0]);
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          state.kind = k[0];
          bar.querySelectorAll('[data-kind]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          all.setAttribute('aria-pressed', 'false');
          b.setAttribute('aria-pressed', 'true'); render();
        });
        bar.appendChild(b);
      });
      var q = el('input');
      q.type = 'search'; q.placeholder = '搜索标题 / 作者 / 标签';
      q.setAttribute('aria-label', '搜索收录');
      q.className = 'chip'; q.style.padding = '7px 14px'; q.style.minWidth = '180px';
      q.addEventListener('input', function () { state.q = q.value; render(); });
      bar.appendChild(q);
      var s = el('select');
      s.className = 'chip'; s.style.padding = '7px 10px';
      s.setAttribute('aria-label', '排序方式');
      s.innerHTML = '<option value="n">按序号</option><option value="plays">按播放</option><option value="fav">按收藏</option>';
      s.addEventListener('change', function () { state.sort = s.value; render(); });
      bar.appendChild(s);
      var count = el('span', 'gal-count'); count.setAttribute('data-daily-count', '');
      bar.appendChild(count);
    }
    var note = document.querySelector('[data-daily-note]');
    if (note) note.textContent = D.note;
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
