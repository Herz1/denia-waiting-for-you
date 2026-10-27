/* До свидания · memorial controller. Classic scripts keep file:// usable. */
(function () {
  'use strict';
  const doc = document;
  const page = doc.body.dataset.page || 'home';
  const base = doc.body.dataset.base || './';
  const originalOrigin = 'https://preview.daniya.cc';
  const $ = (selector, scope = doc) => scope.querySelector(selector);
  const $$ = (selector, scope = doc) => Array.from(scope.querySelectorAll(selector));
  const asset = path => /^(https?:|data:|blob:)/.test(path) ? path : base + path.replace(/^\//, '');
  const remote = path => /^(?:https?:|file:|blob:|data:)/.test(path) ? path : path.startsWith('/api/gallery/') ? originalOrigin + path : new URL(asset(path), location.href).href;
  const modules = new Map();
  let galleryController = null;
  let videosController = null;
  let toastTimer;
  let spoilerUnlocked = false;
  let pendingUnlock = null;
  let memoryFavorites = [];
  let favoritesWritable = true;
  try { spoilerUnlocked = sessionStorage.getItem('denia.memorial.spoilers.session') === 'yes'; } catch (_) {}
  try { const old = JSON.parse(localStorage.getItem('denia.memorial.gallery.favorites.v1') || '[]'); if (!Array.isArray(old) || old.length > 5000 || old.some(v => typeof v !== 'string' || v.length > 160)) throw new Error('Invalid favorites'); memoryFavorites = old; } catch (_) { favoritesWritable = false; }

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function external(text, href, className) {
    const a = el('a', className, text);
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  }
  function toast(message) {
    const node = $('.toast');
    if (!node) return;
    node.textContent = message; node.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('visible'), 5000);
  }
  function loadScript(name, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (modules.has(name)) return modules.get(name);
    const promise = new Promise((resolve, reject) => {
      const script = doc.createElement('script'); script.src = asset('memorial/' + name); script.async = true;
      script.onload = () => resolve(globalName ? window[globalName] : true);
      script.onerror = () => { modules.delete(name); script.remove(); reject(new Error('内容暂时没有载入，请重试。')); };
      doc.head.append(script);
    });
    modules.set(name, promise); return promise;
  }
  function showDialog(dialog, removeOnClose = true) {
    const focused = doc.activeElement;
    if (!dialog.isConnected) doc.body.append(dialog);
    dialog.addEventListener('close', () => {
      if (removeOnClose) dialog.remove();
      if (!doc.querySelector('dialog[open]')) doc.body.classList.remove('modal-open');
      if (focused && focused.isConnected && typeof focused.focus === 'function') focused.focus({ preventScroll: true });
    }, { once: true });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    $$('[data-close]', dialog).forEach(button => button.addEventListener('click', () => dialog.close()));
    doc.body.classList.add('modal-open');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); }
    return dialog;
  }
  function setSpoilers(value) {
    spoilerUnlocked = value;
    try { if (value) sessionStorage.setItem('denia.memorial.spoilers.session', 'yes'); else sessionStorage.removeItem('denia.memorial.spoilers.session'); } catch (_) {}
    $$('dialog.lightbox[open], dialog.video-dialog[open]').forEach(d => d.close());
    updateSpoilerButtons();
    galleryController?.refresh(); videosController?.refresh();
    if (page === 'story') renderStory();
    if (!value) { $('#original-copy')?.replaceChildren(); $('#material-cabinet')?.replaceChildren(); $('#review-frame')?.replaceChildren(); if ($('#review-gate')) $('#review-gate').hidden = false; }
    doc.dispatchEvent(new CustomEvent('denia:spoilerchange', { detail: { unlocked: value } }));
  }
  function updateSpoilerButtons() {
    $$('[data-unlock]').forEach(button => {
      if (button.closest('.sealed-gate')) return;
      button.textContent = button.hasAttribute('data-compact') ? (spoilerUnlocked ? '◆' : '◇') : (spoilerUnlocked ? '重新封存剧情 ◇' : '剧情保护已开启 ◇');
      button.setAttribute('aria-label', spoilerUnlocked ? '重新封存剧情' : '剧情保护已开启，点击展开确认');
      button.title = spoilerUnlocked ? '重新封存剧情' : '剧情保护已开启';
      button.setAttribute('aria-pressed', String(spoilerUnlocked));
    });
  }
  function requestUnlock() {
    if (spoilerUnlocked) return Promise.resolve(true);
    if (pendingUnlock) return pendingUnlock;
    pendingUnlock = new Promise(resolve => {
      const dialog = el('dialog', 'confirm-dialog'); dialog.setAttribute('aria-labelledby', 'unlock-title');
      const title = el('h2', '', '这一页，准备好翻开了吗？'); title.id = 'unlock-title';
      const text = el('p', '', '接下来的内容涉及 3.2–3.3 主线剧情，部分作品标题与画面也会一同展开。此选择仅在当前浏览会话中记住，随时可以重新封存。');
      const actions = el('div', 'confirm-actions'); const yes = el('button', 'button', '我已通关，展开'); const no = el('button', 'button button-ghost', '再等一等'); no.autofocus = true;
      let accepted = false;
      yes.addEventListener('click', () => { accepted = true; dialog.close(); }); no.addEventListener('click', () => dialog.close());
      actions.append(no, yes); dialog.append(el('p', 'eyebrow', 'SEALED WITH CARE'), title, text, actions);
      dialog.addEventListener('close', () => { if (accepted) setSpoilers(true); pendingUnlock = null; resolve(accepted); }, { once: true });
      showDialog(dialog);
    });
    return pendingUnlock;
  }
  function imageFailure(image, message = '原图暂时无法载入') {
    image.addEventListener('error', () => { image.classList.add('broken-image'); image.parentElement?.classList.add('image-unavailable'); image.alt = message; }, { once: true });
  }
  function categoryName(category) { return ({ illustration: '插画', photography: '摄影 / COS', ai: 'AI 创作' })[category] || '原站收录'; }
  function workTitle(work, show = spoilerUnlocked || work.publicSafe) {
    if (!show) return '封存相册 · ' + String(work.number).padStart(2, '0');
    const originalTitle = work.group?.title;
    return originalTitle && originalTitle !== '未命名组图' ? originalTitle : '相册 · ' + String(work.number).padStart(2, '0');
  }
  function favorite(work, button) {
    try { const current = JSON.parse(localStorage.getItem('denia.memorial.gallery.favorites.v1') || '[]'); if (!Array.isArray(current) || current.length > 5000 || current.some(v => typeof v !== 'string' || v.length > 160)) throw new Error('Invalid favorites'); memoryFavorites = current; favoritesWritable = true; } catch (_) { favoritesWritable = false; }
    if (!favoritesWritable) { toast('原收藏记录暂时无法读取，已保留原数据。请先到「本机记录」导出备份。'); return; }
    const saved = memoryFavorites.includes(work.id);
    memoryFavorites = saved ? memoryFavorites.filter(v => v !== work.id) : memoryFavorites.concat(work.id);
    try { localStorage.setItem('denia.memorial.gallery.favorites.v1', JSON.stringify(memoryFavorites)); }
    catch (_) { toast('已记在本页；浏览器不允许本地保存，关闭后可能丢失。'); }
    if (button) { button.textContent = saved ? '♡' : '♥'; button.setAttribute('aria-pressed', String(!saved)); button.setAttribute('aria-label', (saved ? '收藏' : '取消收藏') + '这组作品'); }
    if (galleryController?.favoritesOnly()) galleryController.refresh();
  }
  function makeFavorite(work) {
    const saved = memoryFavorites.includes(work.id);
    const button = el('button', 'favorite-button', saved ? '♥' : '♡');
    button.setAttribute('aria-label', (saved ? '取消收藏' : '收藏') + '这组作品'); button.setAttribute('aria-pressed', String(saved));
    button.addEventListener('click', () => favorite(work, button)); return button;
  }
  function creatorLine(work) {
    const line = el('p', 'creator-line');
    if (work.author && work.authorUrl) line.append(external(work.author, work.authorUrl));
    else line.textContent = work.author || '原作者待补录';
    if (work.category === 'ai') line.append(el('span', 'pill', 'AI 创作'));
    return line;
  }
  function buildGalleryCard(work, list) {
    const safe = spoilerUnlocked || work.publicSafe;
    const article = el('article', 'gallery-card');
    const open = el('button', 'gallery-image-button'); open.setAttribute('aria-label', safe ? '打开' + workTitle(work) : '打开封存作品确认');
    if (safe) {
      const img = el('img'); img.src = remote(work.thumb); img.loading = 'lazy'; img.decoding = 'async'; img.width = 400; img.height = 510;
      img.alt = '达妮娅' + categoryName(work.category) + '，原站相册第 ' + work.number + ' 组';
      if (work.cover) img.style.objectPosition = `${work.cover.x * 100}% ${work.cover.y * 100}%`;
      imageFailure(img); open.append(img, el('span', 'pill', categoryName(work.category) + (work.images.length > 1 ? ' · ' + work.images.length + ' 张' : '')));
    } else {
      const sealed = el('span', 'sealed-tile'); sealed.append(el('span', 'seal-orbit', '✧'), el('strong', '', '这一页，暂时合上'), el('small', '', '剧情关联 / 待确认画面')); open.append(sealed);
    }
    const heading = el('div', 'gallery-card-title'); const titleButton = el('button', '', workTitle(work)); titleButton.setAttribute('aria-label', safe ? '查看' + workTitle(work) : '查看封存作品');
    const action = async () => { if (!safe && !(await requestUnlock())) return; openWork(work, list()); };
    open.addEventListener('click', action); titleButton.addEventListener('click', action); heading.append(titleButton, makeFavorite(work));
    article.append(open, heading, creatorLine(work), el('p', 'gallery-filehint', 'ORIGINAL ARCHIVE / ' + String(work.number).padStart(3, '0')));
    return article;
  }
  function openWork(work, works) {
    const sequence = (works || [work]).filter(w => spoilerUnlocked || w.publicSafe).flatMap(w => w.images.map(im => ({ work: w, image: im })));
    let index = sequence.findIndex(entry => entry.work.id === work.id); if (index < 0) return;
    let loadVersion = 0; let zoomed = false;
    const dialog = el('dialog', 'lightbox'); dialog.setAttribute('aria-label', '相册作品详情');
    const inner = el('div', 'lightbox-inner'); const media = el('div', 'lightbox-media'); const info = el('aside', 'lightbox-details');
    const img = el('img', 'lightbox-image'); img.draggable = false;
    const help = el('span', 'lightbox-help', '← → 翻页 · Esc 合上 · 双击缩放');
    const counter = el('div', 'lightbox-counter'); const previous = el('button', '', '←'); previous.setAttribute('aria-label', '上一张');
    const count = el('span'); const next = el('button', '', '→'); next.setAttribute('aria-label', '下一张'); counter.append(previous, count, next);
    media.append(img, help, counter); inner.append(media, info); dialog.append(inner);
    function resetZoom() { zoomed = false; media.classList.remove('zoomed'); media.scrollTop = 0; media.scrollLeft = 0; }
    function toggleZoom() { zoomed = !zoomed; media.classList.toggle('zoomed', zoomed); const button = $('[data-zoom]', info); if (button) { button.textContent = zoomed ? '适应窗口' : '放大'; button.setAttribute('aria-pressed', String(zoomed)); } }
    function render() {
      resetZoom(); const current = sequence[index]; const w = current.work; const im = current.image; const version = ++loadVersion;
      img.alt = '达妮娅' + categoryName(w.category) + '，原站作品 ' + w.number + '，组内第 ' + (w.images.findIndex(v => v.id === im.id) + 1) + ' 张';
      img.classList.remove('broken-image'); media.classList.remove('image-unavailable'); img.src = remote(im.thumb);
      img.onerror = () => { media.classList.add('image-unavailable'); img.classList.add('broken-image'); img.alt = '图片暂时无法载入，请使用右侧原图入口'; };
      const full = new Image(); full.decoding = 'async'; full.onload = () => { if (version === loadVersion && dialog.isConnected) { img.src = remote(im.src); media.classList.remove('image-unavailable'); img.classList.remove('broken-image'); } }; full.onerror = () => { if (version === loadVersion) help.textContent = '高清图暂未抵达 · 保留原缩略图与原图入口'; }; full.src = remote(im.src);
      count.textContent = `${index + 1} / ${sequence.length}`; previous.disabled = index === 0; next.disabled = index === sequence.length - 1;
      info.replaceChildren(); const close = el('button', 'icon-button', '×'); close.setAttribute('aria-label', '关闭作品详情'); close.addEventListener('click', () => dialog.close());
      const title = el('h2', '', workTitle(w, true)); const author = el('p', 'creator-name', w.author || '原作者待补录');
      const source = el('p', 'creator-source', w.sourceUrl ? '作品出处已登记' : '原站未提供原帖链接，等待补充。');
      const tags = el('div', 'tag-container'); im.tags.forEach(tag => tags.append(el('span', 'pill', tag))); if (w.category === 'ai') tags.append(el('span', 'pill', 'AI 创作 · 非官方'));
      const sourceLink = w.sourceUrl ? external('前往作者原帖 ↗', w.sourceUrl, 'text-link') : external('打开原站归档原图 ↗', remote(im.src), 'text-link');
      const contact = el('a', 'text-link', '补充出处 / 作者申请下架 ↗'); contact.href = asset('friends.html#contact');
      const details = el('p', 'lightbox-file', `原文件：${im.title}\n原路径：${im.src}\n文件大小：${(im.bytes / 1048576).toFixed(2)} MB · 收录 ${im.savedAt.slice(0, 10)}`); details.style.whiteSpace = 'pre-line';
      const actions = el('div', 'lightbox-actions'); const zoom = el('button', 'button button-ghost', '放大'); zoom.dataset.zoom = ''; zoom.setAttribute('aria-pressed', 'false'); zoom.addEventListener('click', toggleZoom); const favoriteButton = makeFavorite(w); actions.append(zoom, favoriteButton);
      info.append(close, el('p', 'eyebrow', `${categoryName(w.category)} / ORIGINAL ARCHIVE`), title, author, source, tags, sourceLink);
      if (w.authorUrl) info.append(external('原作者主页 ↗', w.authorUrl, 'text-link'));
      info.append(contact, actions, details);
    }
    function move(amount) { const target = index + amount; if (target >= 0 && target < sequence.length) { index = target; render(); } }
    previous.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1)); img.addEventListener('dblclick', toggleZoom);
    dialog.addEventListener('keydown', e => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return; if (e.key === 'ArrowRight') { e.preventDefault(); move(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); } else if (e.key === '+' || e.key === '=') { e.preventDefault(); toggleZoom(); } });
    let touchStart = null;
    media.addEventListener('touchstart', e => { if (e.touches.length === 1 && !zoomed) touchStart = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
    media.addEventListener('touchend', e => { if (!touchStart || zoomed) return; const x = e.changedTouches[0].clientX - touchStart[0]; const y = e.changedTouches[0].clientY - touchStart[1]; touchStart = null; if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y) * 1.4) move(x < 0 ? 1 : -1); }, { passive: true });
    render(); showDialog(dialog); dialog.addEventListener('close', () => { loadVersion++; }, { once: true });
  }
  async function renderHomeAlbum() {
    try {
      const data = await loadScript('gallery-data.js', 'DENIA_GALLERY'); const target = $('#home-gallery'); if (!target) return;
      const selection = [1, 41, 31].map(n => data.works.find(w => w.number === n));
      selection.forEach((w, i) => {
        const card = el('article', 'polaroid'); const button = el('button', 'photo-button'); button.setAttribute('aria-label', '查看原站相册选页 ' + (i + 1));
        const img = el('img'); img.src = remote(w.thumb); img.loading = 'lazy'; img.decoding = 'async'; img.width = 360; img.height = 480; img.alt = ['达妮娅身穿学院制服的原站插画', '达妮娅和西格莉卡坐在阳光下的原站插画', '达妮娅轻轻微笑的原站插画'][i]; imageFailure(img); button.append(img);
        button.addEventListener('click', () => openWork(w, selection)); const meta = el('div', 'photo-meta'); meta.append(el('strong', '', String(i + 1).padStart(2, '0')), el('span', '', ['午后的风', '一起的日常', '温柔的一瞬'][i]));
        card.append(button, meta, el('span', 'photo-credit', '相册手记 · 原作者待补录')); target.append(card);
      });
    } catch (e) { $('#home-gallery')?.append(el('p', 'empty-state', e.message)); }
  }
  function exampleWork(example, index) {
    return { id: 'example-' + index, number: 'E' + (index + 1), title: example.title, category: example.category, author: example.author || '', authorUrl: example.authorUrl || '', sourceUrl: example.sourceUrl || '', publicSafe: true, images: [{ id: 'example-' + index, title: example.title, src: example.image || example.src, thumb: example.thumb, tags: [], bytes: 0, savedAt: '2026-10-27' }] };
  }
  async function renderExamples() {
    const host = $('#gallery-examples'); if (!host) return;
    const examples = window.DENIA_GALLERY.examples;
    host.replaceChildren();
    const all = examples.map((ex, i) => {
      const w = exampleWork(ex, i); w.title = ex.title; w.group = { title: ex.title };
      w.category = ({drawing:'illustration',photo:'photography',ai:'ai'})[ex.category];
      w.publicSafe = ex.category !== 'photo';
      w.images[0].src = new URL(asset(ex.src), location.href).href;
      w.images[0].thumb = new URL(asset(ex.thumb), location.href).href;
      w.images[0].title = ex.sourceFile; return w;
    });
    examples.forEach((ex, index) => {
      const w = all[index], safe = spoilerUnlocked || w.publicSafe;
      const card = el('article', 'example-card'), button = el('button');
      button.setAttribute('aria-label', safe ? '打开' + ex.title : '打开封存摄影书签');
      if (safe) {
        const img = el('img'); img.src = asset(ex.thumb); img.alt = '原站' + ex.title;
        img.loading = 'lazy'; img.width = ex.width; img.height = ex.height; imageFailure(img); button.append(img);
      } else {
        const sealed = el('span','sealed-tile'); sealed.append(el('strong','','封存书签'),el('small','','确认后查看原画面')); button.append(sealed);
      }
      button.addEventListener('click', async () => { if (!safe && !(await requestUnlock())) return; openWork(w, all); });
      card.append(button, el('h3','', safe ? ex.title : '摄影 · 封存书签'), el('p','','原作者与原帖待补录' + (ex.category === 'ai' ? ' · AI 创作' : ''))); host.append(card);
    });
  }
  async function mountGallery() {
    const host = $('#gallery-grid'), controls = $('#gallery-controls'), pagination = $('#gallery-pagination');
    try {
      const data = await loadScript('gallery-data.js', 'DENIA_GALLERY');
      let category = page === 'dreamer' ? 'ai' : 'illustration'; let search = ''; let sort = 'original'; let favorites = false; let currentPage = 1; const perPage = 12;
      const row = el('div', 'filter-row'); const buttons = [];
      (page === 'dreamer' ? [['ai', '原站 AI 收录']] : [['all', '全部'], ['illustration', '插画'], ['photography', '摄影 / COS'], ['ai', 'AI 创作']]).forEach(([key, label]) => {
        const count = data.works.filter(w => key === 'all' || w.category === key).length; const button = el('button', 'filter-chip', label + (key === 'photography' ? ' · 书签' : ' · ' + count)); button.dataset.category = key;
        button.addEventListener('click', () => { category = key; currentPage = 1; render(); }); row.append(button); buttons.push(button);
      });
      const searchGroup = el('div', 'gallery-search'); const searchLabel = el('label', '', '找一找 '); const input = el('input', 'field'); input.type = 'search'; input.placeholder = '组名、编号、可见标签'; input.setAttribute('aria-label', '搜索相册'); searchLabel.append(input);
      const sortLabel = el('label', '', '排列 '); const select = el('select', 'field'); select.setAttribute('aria-label', '相册排序'); [['original', '原站顺序'], ['recent', '最近收录'], ['oldest', '最早收录']].forEach(([v, t]) => { const option = el('option', '', t); option.value = v; select.append(option); }); sortLabel.append(select); searchGroup.append(searchLabel, sortLabel); row.append(searchGroup);
      const resultRow = el('div', 'gallery-result'); const resultText = el('span'); resultText.setAttribute('role', 'status'); const faveLabel = el('label'); const faveInput = el('input'); faveInput.type = 'checkbox'; faveLabel.append(faveInput, doc.createTextNode('只看本机收藏')); resultRow.append(resultText, faveLabel); controls.append(row, resultRow);
      const filtered = () => data.works.filter(w => {
        if (category !== 'all' && w.category !== category) return false;
        if (favorites && !memoryFavorites.includes(w.id)) return false;
        if (search) { const publicFields = spoilerUnlocked || w.publicSafe ? [workTitle(w), String(w.number), w.author, ...w.images.flatMap(i => i.tags)] : [String(w.number), '封存相册']; if (!publicFields.join(' ').toLocaleLowerCase().includes(search)) return false; }
        return true;
      }).sort((a, b) => sort === 'original' ? a.number - b.number : sort === 'recent' ? b.savedAt.localeCompare(a.savedAt) : a.savedAt.localeCompare(b.savedAt));
      function render() {
        const all = filtered(); const pages = Math.max(1, Math.ceil(all.length / perPage)); currentPage = Math.min(currentPage, pages);
        buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
        const sealed = all.filter(w => !w.publicSafe && !spoilerUnlocked).length;
        resultText.textContent = `${all.length} 组作品${sealed ? ' · ' + sealed + ' 组封存' : ''} · 收藏仅保存在本机`;
        host.replaceChildren(); pagination.replaceChildren();
        if (!all.length) {
          const empty = el('div', 'empty-state'); empty.append(el('span', '', '◌'), el('h3', '', category === 'photography' ? '摄影书签在下方等你。' : '这一页，暂时空着。'), el('p', '', category === 'photography' ? '线上归档暂无摄影分类，原站摄影 / COS 示例完整保留在下方。' : '换一个词，或取消筛选再试试。'));
          if (category !== 'photography') { const reset = el('button', 'button button-ghost', '重置筛选'); reset.addEventListener('click', () => { search = ''; input.value = ''; favorites = false; faveInput.checked = false; category = page === 'dreamer' ? 'ai' : 'all'; render(); }); empty.append(reset); }
          host.append(empty); return;
        }
        all.slice((currentPage - 1) * perPage, currentPage * perPage).forEach(w => host.append(buildGalleryCard(w, filtered)));
        if (pages > 1) {
          for (let i = 1; i <= pages; i++) { const button = el('button', '', String(i)); button.setAttribute('aria-label', `第 ${i} 页`); if (i === currentPage) button.setAttribute('aria-current', 'page'); button.addEventListener('click', () => { currentPage = i; render(); controls.scrollIntoView({ behavior: window.DeniaExperience.isReducedMotion() ? 'auto' : 'smooth', block: 'start' }); }); pagination.append(button); }
        }
      }
      input.addEventListener('input', () => { search = input.value.trim().toLocaleLowerCase(); currentPage = 1; render(); }); select.addEventListener('change', () => { sort = select.value; render(); }); faveInput.addEventListener('change', () => { favorites = faveInput.checked; currentPage = 1; render(); });
      galleryController = { refresh: () => { render(); renderExamples(); }, favoritesOnly: () => favorites }; render(); renderExamples();
    } catch (e) { host.append(el('div', 'empty-state', e.message)); }
  }
  async function renderProfile() {
    const host = $('#profile-content'); if (!host) return;
    try {
      const data = await loadScript('profile-data.js', 'DENIA_PROFILE');
      host.append(el('p', 'eyebrow', '星炬学院 / 虚质科学部'), el('h2', 'profile-name', data.names.zhCN), el('p', 'profile-languages', `${data.names.en} · ${data.names.ja} · ${data.names.ko}`));
      const dl = el('dl', 'facts-grid'); data.facts.forEach(fact => { const div = el('div', 'fact'); div.append(el('dt', '', fact.label), el('dd', '', fact.value)); dl.append(div); }); host.append(dl);
      const source = el('p', 'source-line', '资料依据：'); source.append(external('官方角色介绍', data.sources['character-introduction-cn'].url), doc.createTextNode(' · '), external('活动唤取公告', data.sources['convene-33-en'].url)); host.append(source);
      data.biography.forEach(item => { const block = el('section', 'profile-block'); const note = el('p', 'source-line'); note.append(external(item.sourceLabel, item.sourceUrl)); block.append(el('h2', '', item.title), el('p', '', item.text), note); host.append(block); });
      [data.ability, data.signatureWeapon].forEach(item => { const block = el('section', 'profile-block'); const note = el('p', 'source-line'); note.append(external('官方介绍 ↗', item.sourceUrl)); block.append(el('h2', '', item.name), el('p', '', item.text), note); host.append(block); });
      const voices = el('section', 'profile-block'); voices.append(el('h2', '', '四种声音，同一份温柔')); const grid = el('div', 'voice-grid'); data.voiceActors.forEach(voice => { const div = el('div', 'voice-item'); div.append(el('span', '', voice.language), external(voice.name, voice.sourceUrl)); grid.append(div); }); voices.append(grid, el('p', 'source-line', '声优信息来自官方角色 PV；原站发布包未提供独立角色语音文件。')); const audioSlot = el('p', 'small-note', '已从「余温」保留中日两份角色介绍语音及原出处，请在旧站收藏册中确认剧情范围后试听。'); audioSlot.dataset.slot = 'official-voice-01'; voices.append(audioSlot); const audioLink = el('a', 'text-link', '打开旧站收藏册 · 角色语音 ↗'); audioLink.href = asset('collection.html'); voices.append(audioLink); host.append(voices);
    } catch (e) { host.append(el('p', 'empty-state', e.message)); }
  }
  async function renderStory() {
    const host = $('#story-content'); if (!host) return;
    if (!spoilerUnlocked) {
      host.innerHTML = '<div class="sealed-gate"><div class="envelope large-envelope" aria-hidden="true"><span>✧</span></div><p class="eyebrow">SEALED WITH CARE</p><h2>有些话，晚一点再说。</h2><p>本页涉及 3.2–3.3 主线剧情。<br>标题、画面与文字会一起封存，直到你亲手打开。</p><button class="button" data-story-open>我已通关，展开</button><a class="text-link" href="' + asset('index.html') + '">先回到温柔的日常 ←</a></div>';
      $('[data-story-open]', host).addEventListener('click', requestUnlock); return;
    }
    try {
      const data = await loadScript('profile-data.js', 'DENIA_PROFILE'); if (!spoilerUnlocked) return;
      const panel = el('article', 'story-open'); const back = el('button', 'button', '重新封存这一页'); back.addEventListener('click', () => { setSpoilers(false); toast('这一页已重新合上。'); });
      panel.append(el('p', 'eyebrow', 'THE OTHER SIDE / 剧情已展开'), el('h2', '', '在星穹深处，留下回声。'), el('p', '', '这页收录已核验的线索与待核对的章节名。愿我们记得的，不只有故事的结局。'), el('p', 'source-line', '以上为本站原创引言'), back);
      data.spoilers.forEach((story, i) => { const article = el('section', 'story-chapter'); article.append(el('span', 'chapter-number', String(i + 1).padStart(2, '0')), el('h2', '', story.title), el('p', '', story.text), external('查阅官方原文 ↗', story.sourceUrl)); panel.append(article); });
      const timeline = el('section', 'story-chapter'); timeline.append(el('p', 'eyebrow', 'CHAPTER NOTES'), el('h2', '', '六句，像六页折起的信。'));
      const list = el('ol', 'chain-list'); data.resonanceChain.items.forEach(item => { const li = el('li', '', item.name); li.append(el('small', '', item.verification === 'official_wiki_checked' ? '共鸣链名称 · 已对照官方 WIKI' : '用户提供的共鸣链名称 · 待游戏内原文核对')); list.append(li); });
      timeline.append(list, el('p', 'small-note', '未核实的剧情细节留待游戏内原文补充。')); panel.append(timeline);
      const galleryLink = el('a', 'text-link', '带着这些回声，再翻一次相册 ↗'); galleryLink.href = asset('gallery.html'); panel.append(galleryLink); host.replaceChildren(panel);
    } catch (e) { host.append(el('p', 'empty-state', e.message)); }
  }
  function showCake() {
    let count = 0; try { count = Math.max(0, Number(localStorage.getItem('denia.memorial.cakes.v1')) || 0); } catch (_) {}
    count += 1; let stored = true; try { localStorage.setItem('denia.memorial.cakes.v1', String(count)); } catch (_) { stored = false; }
    $$('[data-cake-count]').forEach(node => { node.textContent = stored ? `在这台设备上，你已经留下 ${count} 份甜。` : '这份甜留在本次相遇里。浏览器未允许本地保存。'; });
    const dialog = el('dialog', 'cake-dialog'); dialog.setAttribute('aria-labelledby', 'cake-title');
    const grid = el('div', 'cake-dialog-grid'); const picture = el('div', 'cake-dialog-image'); const img = el('img'); img.src = asset('assets/gallery-preview-DBxFLbBG.jpg'); img.alt = '原站蛋糕互动使用的达妮娅插画'; img.width = 2836; img.height = 4096; imageFailure(img); picture.append(img);
    const body = el('div', 'cake-dialog-copy'); const close = el('button', 'icon-button', '×'); close.setAttribute('aria-label', '收起蛋糕留言'); close.addEventListener('click', () => dialog.close());
    const title = el('h2', '', '给娅娅的那一块，留好了。'); title.id = 'cake-title'; body.append(close, el('p', 'eyebrow', 'A LITTLE SWEETNESS'), title, el('p', '', '等一个不慌不忙的午后，等她醒来，等我们再见。'), el('p', 'small-note', '本站原创互动文字 · 插画沿用原站，作者与原帖待补录'), el('p', 'small-note', stored ? `本机累计 ${count} 份 · 仅在此设备保存` : '仅在本次浏览中记录'));
    const link = el('a', 'text-link', '再留一句心愿 ↗'); link.href = asset('interactive.html#wishes'); body.append(link); grid.append(picture, body); dialog.append(grid); showDialog(dialog);
  }
  async function copyText(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); toast('台词与出处已复制。'); return; } } catch (_) {}
    const dialog = el('dialog', 'denia-copy-dialog'); dialog.setAttribute('aria-label', '复制台词与出处'); dialog.append(el('h2', '', '把这句话带走')); const area = el('textarea', 'denia-copy-text'); area.value = text; area.readOnly = true; area.setAttribute('aria-label', '可复制的完整台词及出处'); const close = el('button', '', '复制后合上'); close.addEventListener('click', () => dialog.close()); dialog.append(area, close); showDialog(dialog); area.focus(); area.select();
  }
  function setupQuote() {
    const text = '不要看，不要听，然后忘掉吧……有些事情，还是不知道比较幸福。'; const source = '达妮娅 · 官方角色介绍 https://www.bilibili.com/opus/1183931799897636868';
    $('[data-quote-copy]')?.addEventListener('click', () => copyText('“' + text + '”\n' + source));
    $('[data-quote-share]')?.addEventListener('click', async () => { const button = $('[data-quote-share]'); button.disabled = true; try { await window.DeniaExperience.shareQuote({ text: '“' + text + '”', source, title: 'До свидания · 留声卡' }); } finally { button.disabled = false; } });
  }
  async function setupVideos() {
    const target = $('#video-mount');
    try { const api = await loadScript('video.js', 'DeniaVideos'); videosController = api.mount(target, { base, isUnlocked: () => spoilerUnlocked, requestUnlock, toast }); }
    catch (e) { target.append(el('p', 'empty-state', e.message)); }
  }
  let compatiblePet = null;
  let compatiblePetVisible = false;
  function loadPet() {
    const button = $('[data-load-pet]'), status = $('[data-pet-status]');
    if (compatiblePet) { compatiblePetVisible = !compatiblePetVisible; compatiblePet[compatiblePetVisible ? 'show' : 'hide'](); button.textContent = compatiblePetVisible ? '让娅娅休息一下' : '请出原站桌宠'; return; }
    if (doc.querySelector('denia-companion')) { const companion = doc.querySelector('denia-companion'); companion.hidden = !companion.hidden; button.textContent = companion.hidden ? '请出原站桌宠' : '让娅娅休息一下'; return; }
    if (button.dataset.loading) return;
    button.dataset.loading = 'true'; button.disabled = true; status.textContent = '正在连接原站桌宠…';
    const script = doc.createElement('script'); script.src = originalOrigin + '/pet/companion.js'; script.async = true;
    let fallbackStarted = false;
    const fail = async () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      try {
        const api = await loadScript('pet.js', 'DeniaPet');
        compatiblePet = api.mount({ spriteUrl: originalOrigin + '/pet/denia.webp', chatUrl: originalOrigin + '/pet-preview.html', onToast: toast });
        compatiblePet.show(); compatiblePetVisible = true;
        button.textContent = '让娅娅休息一下';
        status.textContent = '已用原站精灵图启用本地兼容桌宠，保留九种动作。聊天、选图与朗读请进入原站页面。';
      } catch (_) { status.textContent = '桌宠暂时无法载入。可通过旁边的入口打开原站桌宠页面。'; }
      finally { delete button.dataset.loading; button.disabled = false; }
    };
    script.onerror = fail;
    // The original widget imports same-origin modules. New hosts use its unchanged
    // sprite through the compatibility controller instead of triggering a failed import.
    if (location.origin !== originalOrigin) { fail(); return; }
    script.onload = () => {
      let tries = 0;
      const check = () => {
        const companion = doc.querySelector('denia-companion');
        if (!companion && ++tries < 15) { setTimeout(check, 100); return; }
        if (!companion) { fail(); return; }
        delete button.dataset.loading; button.disabled = false; button.textContent = '让娅娅休息一下'; status.textContent = '原站桌宠已接入。可以拖动、选择动作，或进入原站聊天页。';
        // The original public component exposes its art URL. Correct it to its immutable origin on new hosts.
        companion.style.setProperty('--art', `url("${originalOrigin}/pet/denia.webp")`);
        const root = companion.shadowRoot;
        if (root) { const style = el('style'); style.textContent = ':host([data-reduce-motion="true"]) *, :host([data-page-hidden="true"]) * { animation-play-state: paused !important; transition: none !important; }'; root.append(style); }
        const sync = () => { companion.dataset.reduceMotion = String(window.DeniaExperience.isReducedMotion()); companion.dataset.pageHidden = String(doc.hidden); };
        doc.addEventListener('denia:motionchange', sync); doc.addEventListener('visibilitychange', sync); sync();
      }; check();
    };
    doc.head.append(script);
  }
  async function revealOriginalCopy() {
    if (!(await requestUnlock())) return;
    const host = $('#original-copy');
    try {
      const data = await loadScript('original-data.js', 'DENIA_ORIGINAL'); if (!spoilerUnlocked) return;
      const list = el('ul', 'copy-archive-list'); data.originalCopy.forEach(item => { const li = el('li'); if (typeof item === 'string') li.textContent = item; else { li.textContent = item.text || item.value || ''; li.append(el('small', '', (item.sourceFile || item.source || item.path || '原站') + ' · 原站文案')); } list.append(li); });
      host.replaceChildren(list); toast('原站字面文案已完整展开。');
    } catch (e) { host.append(el('p', 'empty-state', e.message)); }
  }
  async function revealMaterials() {
    if (!(await requestUnlock())) return;
    const host = $('#material-cabinet');
    try {
      const data = await loadScript('material-data.js','DENIA_MATERIALS'); if (!spoilerUnlocked) return;
      const list = el('ul','material-list');
      data.files.forEach(file => { const li = el('li'); li.append(external(file.path,new URL(asset(file.path),location.href).href),el('small','',`${(file.bytes/1024).toFixed(1)} KB · 原文件，路径保留`)); list.append(li); });
      host.replaceChildren(el('p','small-note',`${data.files.length} 个原媒体文件，包括同图的响应式版本与重复原件。`),list);
    } catch (e) { host.append(el('p','empty-state',e.message)); }
  }
  async function openReview() {
    if (!(await requestUnlock())) return;
    const host = $('#review-frame');
    try { const text = await loadScript('review-data.js', 'DENIA_REVIEW_HTML'); if (!spoilerUnlocked) return; const frame = el('iframe', 'review-iframe'); frame.title = '原站 176 条候选审核工具'; frame.srcdoc = text; host.replaceChildren(frame); $('#review-gate').hidden = true; }
    catch (e) { toast(e.message); }
  }
  function setupProgress() {
    let scheduled = false;
    const paint = () => { scheduled = false; const total = doc.documentElement.scrollHeight - innerHeight; $('.reading-progress').style.transform = `scaleX(${total > 0 ? Math.min(1, scrollY / total) : 0})`; $('[data-top]').hidden = scrollY < 650; };
    window.addEventListener('scroll', () => { if (!scheduled && !doc.hidden) { scheduled = true; requestAnimationFrame(paint); } }, { passive: true }); paint();
    $('[data-top]').addEventListener('click', () => window.scrollTo({ top: 0, behavior: window.DeniaExperience.isReducedMotion() ? 'auto' : 'smooth' }));
  }
  function setupHeroParallax() {
    const hero = $('.hero'); if (!hero || !matchMedia('(pointer:fine)').matches) return;
    let raf = 0; let x = 0, y = 0;
    hero.addEventListener('pointermove', e => { if (window.DeniaExperience.isReducedMotion() || doc.hidden) return; const rect = hero.getBoundingClientRect(); x = (e.clientX / rect.width - .5) * 9; y = ((e.clientY - rect.top) / rect.height - .5) * 6; if (!raf) raf = requestAnimationFrame(() => { hero.style.setProperty('--parallax-x', x + 'px'); hero.style.setProperty('--parallax-y', y + 'px'); raf = 0; }); }, { passive: true });
    hero.addEventListener('pointerleave', () => { hero.style.setProperty('--parallax-x', '0px'); hero.style.setProperty('--parallax-y', '0px'); });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden && raf) { cancelAnimationFrame(raf); raf = 0; } });
  }
  function setupDates() {
    const paint = () => { const dates = window.DeniaExperience.getAnniversary(); $$('[data-days]').forEach(n => n.textContent = dates.waitingDays); $$('[data-next-anniversary]').forEach(n => n.textContent = dates.daysUntilNext); if (dates.isAnniversary) $$('[data-cake-count]').forEach(n => n.textContent = '今天是相遇纪念日。再一起留一块蛋糕吧。'); };
    paint(); doc.addEventListener('visibilitychange', () => { if (!doc.hidden) paint(); });
    setInterval(() => { if (!doc.hidden) paint(); }, 60000);
  }
  window.addEventListener('pageshow', () => {
    let saved = spoilerUnlocked;
    try { saved = sessionStorage.getItem('denia.memorial.spoilers.session') === 'yes'; } catch (_) {}
    if (saved !== spoilerUnlocked) setSpoilers(saved);
  });
  function init() {
    window.DeniaExperience.init({ root: doc, onToast: toast, asset });
    const syncMotion = () => $$('[data-motion]').forEach(b => { const reduced = window.DeniaExperience.isReducedMotion(); b.setAttribute('aria-pressed', String(reduced)); b.setAttribute('aria-label', reduced ? '恢复轻柔动效' : '减少动效'); b.title = reduced ? '恢复轻柔动效' : '减少动效'; });
    $$('[data-motion]').forEach(b => b.addEventListener('click', () => { const reduced = !window.DeniaExperience.isReducedMotion(); window.DeniaExperience.setReducedMotion(reduced); toast(reduced ? '已减少动效，安静地翻阅就好。' : '轻柔动效已恢复。'); })); doc.addEventListener('denia:motionchange', syncMotion); syncMotion();
    $('[data-menu]').addEventListener('click', () => showDialog($('.menu-dialog'), false));
    $$('[data-cake]').forEach(button => button.addEventListener('click', showCake));
    $$('[data-unlock]').forEach(button => button.addEventListener('click', () => spoilerUnlocked ? setSpoilers(false) : requestUnlock())); updateSpoilerButtons();
    setupProgress(); setupHeroParallax(); setupDates(); setupQuote();
    if (page === 'home') renderHomeAlbum();
    if (page === 'gallery' || page === 'dreamer') mountGallery();
    if (page === 'profile') renderProfile();
    if (page === 'story') renderStory();
    if (page === 'fanworks' || page === 'daily') setupVideos();
    if (page === 'interactive') {
      window.DeniaExperience.bindWishForm($('#wish-form'), $('#wish-list'));
      $('[data-load-pet]').addEventListener('click', loadPet);
      $('[data-pop]').addEventListener('click', () => { const bubble = $('[data-pop]'); bubble.classList.add('popped'); window.DeniaExperience.popBubble(); toast('噗。愿今天的烦恼，也轻轻散掉。 · 本站互动文字'); setTimeout(() => bubble.classList.remove('popped'), window.DeniaExperience.isReducedMotion() ? 0 : 380); });
      try { const count = Number(localStorage.getItem('denia.memorial.cakes.v1') || 0); if (count) $('[data-cake-count]').textContent = `在这台设备上，你已经留下 ${count} 份甜。`; } catch (_) {}
    }
    $('[data-original-copy]')?.addEventListener('click', revealOriginalCopy);
    $('[data-materials]')?.addEventListener('click', revealMaterials);
    $('[data-review-open]')?.addEventListener('click', openReview);
    doc.addEventListener('visibilitychange', () => doc.documentElement.classList.toggle('is-hidden-page', doc.hidden));
    $$('img:not(.hero-art img)').forEach(img => imageFailure(img));
    // Error collection is intentionally local and in-memory; no analytics or transmission.
    doc.documentElement.dataset.ready = 'true';
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
