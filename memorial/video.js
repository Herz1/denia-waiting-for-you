/* Original video archive. No framework, fetch, or build step is required. */
(function () {
  'use strict';

  const moduleSource = document.currentScript && document.currentScript.src;
  const favoriteKey = 'denia-memorial-video-favorites:v1';
  const safeMetadataOrders = new Set([1, 2, 4, 5, 10, 12, 13, 15, 17, 18, 22, 23, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 40, 42, 43, 44, 48, 49]);
  let dataPromise = null;
  let instanceNumber = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function validArchive(value) {
    return value && Array.isArray(value.videos) && value.videos.length > 0 && value.videos.every(function (video) {
      return video && typeof video.id === 'string' && typeof video.title === 'string' && typeof video.href === 'string' && typeof video.cover === 'string';
    });
  }

  function loadArchive(base) {
    if (validArchive(window.DENIA_ORIGINAL)) return Promise.resolve(window.DENIA_ORIGINAL);
    if (dataPromise) return dataPromise;
    dataPromise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      let settled = false;
      let timer;
      function finish(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (error) {
          script.remove();
          reject(error);
        } else if (validArchive(window.DENIA_ORIGINAL)) {
          resolve(window.DENIA_ORIGINAL);
        } else {
          script.remove();
          reject(new Error('原始作品数据格式不完整。'));
        }
      }
      script.async = true;
      script.src = moduleSource ? new URL('original-data.js', moduleSource).href : String(base || './') + 'memorial/original-data.js';
      script.dataset.deniaOriginal = 'true';
      script.onload = function () { finish(); };
      script.onerror = function () { finish(new Error('原始作品数据未能加载。')); };
      timer = setTimeout(function () { finish(new Error('作品数据加载超时，请重试。')); }, 20000);
      document.head.appendChild(script);
    }).catch(function (error) {
      dataPromise = null;
      throw error;
    });
    return dataPromise;
  }

  function externalUrl(value) {
    try {
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
    } catch (error) {
      return false;
    }
  }

  function externalLink(label, href, className) {
    if (!externalUrl(href)) return element('span', className, label);
    const link = element('a', className, label);
    link.setAttribute('href', href);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.referrerPolicy = 'no-referrer';
    return link;
  }

  function readFavorites() {
    try {
      const raw = localStorage.getItem(favoriteKey);
      if (raw === null) return { values: new Set(), writable: true };
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved) || saved.length > 5000 || saved.some(function (id) { return typeof id !== 'string' || id.length > 160; })) {
        throw new Error('Invalid favorites');
      }
      return { values: new Set(saved), writable: true };
    } catch (error) {
      return { values: new Set(), writable: false };
    }
  }

  function publishedNumber(video, edition) {
    const parts = String(video.published || '').match(/(\d+)\s*月\s*(\d+)\s*日\s*(\d+):(\d+)/);
    if (!parts) return -Infinity;
    const year = Number(String(edition || '2026').slice(0, 4));
    return Date.UTC(year, Number(parts[1]) - 1, Number(parts[2]), Number(parts[3]), Number(parts[4]));
  }

  function mount(target, options) {
    options = options || {};
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container || typeof container.replaceChildren !== 'function') throw new TypeError('DeniaVideos.mount requires a container element.');
    const prefix = 'denia-videos-' + (++instanceNumber);
    const initialFavorites = readFavorites();
    let favorites = initialFavorites.values;
    let storageWritable = initialFavorites.writable;
    let archive = null;
    let destroyed = false;
    let loading = false;
    let unlockPending = false;
    let category = 'all';
    let query = '';
    let sort = 'original';
    let onlyFavorites = false;
    let shell;
    let resultNode;
    let grid;
    let favoriteFilter;
    let storageNote;
    let dialog;
    let dialogBody;
    let activeModal = null;
    let returnFocus = null;
    let readyResolve;
    const ready = new Promise(function (resolve) { readyResolve = resolve; });

    function unlocked() {
      try { return typeof options.isUnlocked === 'function' && options.isUnlocked() === true; }
      catch (error) { return false; }
    }

    function canShowMetadata(video) {
      return unlocked() || safeMetadataOrders.has(Number(video.order));
    }

    function tell(message) {
      if (typeof options.toast === 'function') {
        try { options.toast(message); } catch (error) { /* The local status remains available. */ }
      }
      if (storageNote) storageNote.textContent = message;
    }

    function button(label, className, onClick) {
      const node = element('button', className || 'button', label);
      node.type = 'button';
      if (onClick) node.addEventListener('click', onClick);
      return node;
    }

    function focusKey(key) {
      if (!key || !shell) return;
      const found = Array.from(shell.querySelectorAll('[data-video-focus]')).find(function (node) { return node.dataset.videoFocus === key; });
      if (found) found.focus({ preventScroll: true });
      else if (resultNode) resultNode.focus({ preventScroll: true });
    }

    function disposeClosedDialog(closedDialog, restore) {
      // A queued close event from an earlier opening must not clear a newly opened dialog.
      if (!closedDialog || closedDialog !== dialog || closedDialog.open) return;
      activeModal = null;
      closedDialog.hidden = true;
      if (dialogBody) dialogBody.replaceChildren();
      const focusTarget = returnFocus;
      returnFocus = null;
      if (restore !== false && focusTarget && focusTarget.isConnected && !document.querySelector('dialog[open]')) {
        focusTarget.focus({ preventScroll: true });
      }
    }

    function closeDialog(restore) {
      if (!dialog) return;
      const closingDialog = dialog;
      activeModal = null;
      if (typeof closingDialog.close === 'function' && closingDialog.open) closingDialog.close();
      closingDialog.removeAttribute('open');
      disposeClosedDialog(closingDialog, restore);
    }

    function openDialog(title, render, modalState) {
      const wasOpen = dialog && dialog.open;
      if (!wasOpen) returnFocus = document.activeElement;
      activeModal = modalState;
      dialogBody.replaceChildren();
      const heading = element('h2', '', title);
      heading.id = prefix + '-dialog-title';
      const close = button('关闭', 'button button-ghost video-close', function () { closeDialog(); });
      close.setAttribute('aria-label', '关闭作品对话框');
      dialogBody.append(close, heading);
      render(dialogBody);
      dialog.hidden = false;
      if (!wasOpen) {
        if (typeof dialog.showModal === 'function') {
          try { dialog.showModal(); }
          catch (error) { dialog.setAttribute('open', ''); }
        } else dialog.setAttribute('open', '');
      }
      close.focus({ preventScroll: true });
    }

    async function askUnlock(reopenVideo) {
      if (unlockPending || destroyed) return;
      unlockPending = true;
      closeDialog(false);
      try {
        if (typeof options.requestUnlock !== 'function') {
          tell('请使用页面的“我已通关，展开”入口解锁剧情内容。');
          return;
        }
        const granted = await options.requestUnlock();
        if (destroyed) return;
        refresh();
        if (granted && unlocked() && reopenVideo) showDetails(reopenVideo);
      } catch (error) {
        if (!destroyed) tell('暂时无法展开，请重试。');
      } finally {
        unlockPending = false;
      }
    }

    function cover(video, className) {
      const frame = element('div', className || 'video-image');
      const image = document.createElement('img');
      image.setAttribute('src', video.cover);
      image.alt = video.coverAlt || video.title;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 640;
      image.height = 360;
      image.addEventListener('error', function () {
        image.hidden = true;
        if (!frame.querySelector('.video-image-error')) frame.append(element('p', 'video-image-error', '原封面暂时无法显示'));
      }, { once: true });
      frame.append(image);
      if (video.duration) frame.append(element('span', 'pill video-duration', video.duration));
      return frame;
    }

    function authorLine(video) {
      const node = element('p', 'video-meta video-author');
      node.append(document.createTextNode('作者 · '));
      const author = externalLink(video.author || '原投稿作者', video.authorUrl, 'video-author-link');
      if (author.tagName === 'A') author.setAttribute('aria-label', '前往 ' + (video.author || '原作者') + ' 的主页（新标签页）');
      node.append(author);
      return node;
    }

    function favoriteButton(video) {
      const node = button(favorites.has(video.id) ? '已收藏' : '收藏', 'button button-ghost video-favorite', function () {
        const remembered = node.dataset.videoFocus;
        if (storageWritable) {
          const current = readFavorites();
          if (current.writable) favorites = current.values;
          else storageWritable = false;
        }
        if (favorites.has(video.id)) favorites.delete(video.id);
        else favorites.add(video.id);
        let saved = false;
        if (storageWritable) {
          try {
            localStorage.setItem(favoriteKey, JSON.stringify(Array.from(favorites).sort()));
            saved = true;
          } catch (error) { storageWritable = false; }
        }
        renderCards();
        focusKey(remembered);
        tell(saved ? '收藏已保存在当前浏览器。' : '本地存储不可用，本次收藏仅在当前页面保留；已有数据未覆盖。');
      });
      node.dataset.videoFocus = 'favorite-' + video.id;
      node.setAttribute('aria-pressed', String(favorites.has(video.id)));
      node.setAttribute('aria-label', (favorites.has(video.id) ? '取消收藏：' : '收藏：') + (canShowMetadata(video) ? video.title : '封存作品 ' + video.order));
      return node;
    }

    function watchLink(video, label) {
      if (!externalUrl(video.href)) return element('span', 'video-meta', '原帖入口暂不可用');
      if (!unlocked()) {
        // A button also prevents middle-click/context-menu navigation from bypassing the notice.
        const guarded = button(label || '前往原帖 ↗', 'button button-ghost', function () { showExternalNotice(video); });
        guarded.setAttribute('aria-haspopup', 'dialog');
        return guarded;
      }
      const link = externalLink(label || '前往原帖 ↗', video.href, 'button button-ghost');
      link.setAttribute('aria-label', (label || '前往原帖') + '（新标签页）');
      return link;
    }

    function showExternalNotice(video) {
      openDialog('前往原帖之前', function (body) {
        if (canShowMetadata(video)) body.append(element('p', 'video-notice-title', video.title));
        else body.append(element('p', 'video-meta', '封存作品 · ' + String(video.order).padStart(2, '0')));
        body.append(authorLine(video));
        body.append(element('p', '', '视频内容尚未逐帧审核，原帖可能包含 3.2–3.3 主线剧情。前往后由原平台展示内容，本站会保留在当前标签页。'));
        const actions = element('div', 'video-actions');
        const proceed = externalLink('继续前往原帖 ↗', video.href, 'button');
        if (proceed.tagName === 'A') proceed.addEventListener('click', function () { closeDialog(); });
        actions.append(proceed, button('留在这里', 'button button-ghost', function () { closeDialog(); }));
        body.append(actions);
      }, { type: 'external', id: video.id });
    }

    function showDetails(video) {
      const visible = canShowMetadata(video);
      openDialog(visible ? video.title : '封存作品 · ' + String(video.order).padStart(2, '0'), function (body) {
        if (visible) body.append(cover(video, 'video-image video-detail-image'));
        else body.append(element('p', 'empty-state video-sealed', '这份作品的标题与封面暂时封存。'));
        body.append(authorLine(video));
        const facts = [video.category, video.duration, video.published].filter(Boolean);
        if (facts.length) body.append(element('p', 'video-meta', facts.join(' · ')));
        if (video.stats && typeof video.stats === 'object') {
          const statistics = element('dl', 'video-stats');
          Object.entries(video.stats).forEach(function (entry) {
            const item = element('div');
            item.append(element('dt', '', entry[0]), element('dd', '', entry[1]));
            statistics.append(item);
          });
          body.append(statistics, element('p', 'video-meta', '以上为原日报在 ' + ((archive.meta && archive.meta.statsSnapshotDate) || '2026-10-18') + ' 采集的历史数据。'));
        }
        if (unlocked()) {
          body.append(element('h3', '', '原作简介'));
          const description = element('p', 'video-description', video.description || '原日报未提供作品简介。');
          description.style.whiteSpace = 'pre-wrap';
          body.append(description);
          if (Array.isArray(video.tags) && video.tags.length) body.append(element('p', 'video-meta video-tags', video.tags.map(function (tag) { return '#' + tag; }).join('　')));
        } else {
          const sealed = element('div', 'empty-state video-description-sealed');
          sealed.append(element('p', '', '作品简介与标签已封存，展开后可能涉及剧情。'));
          sealed.append(button('我已通关，展开', 'button', function () { askUnlock(video); }));
          body.append(sealed);
        }
        const actions = element('div', 'video-actions');
        actions.append(watchLink(video), button('关闭详情', 'button button-ghost', function () { closeDialog(); }));
        body.append(actions);
      }, { type: 'details', id: video.id });
    }

    function filteredVideos() {
      const term = query.trim().toLocaleLowerCase();
      return archive.videos.filter(function (video) {
        if (category !== 'all' && video.category !== category) return false;
        if (onlyFavorites && !favorites.has(video.id)) return false;
        if (!term) return true;
        const fields = [video.author || '', video.category || ''];
        if (canShowMetadata(video)) fields.push(video.title);
        if (unlocked()) fields.push(video.description || '', ...(Array.isArray(video.tags) ? video.tags : []));
        return fields.join(' ').toLocaleLowerCase().includes(term);
      }).sort(function (a, b) {
        if (sort === 'new') {
          const difference = publishedNumber(b, archive.meta && archive.meta.dailyEdition) - publishedNumber(a, archive.meta && archive.meta.dailyEdition);
          if (Number.isFinite(difference) && difference !== 0) return difference;
        }
        return Number(a.order) - Number(b.order);
      });
    }

    function renderCards() {
      if (destroyed || !archive || !grid) return;
      const activeKey = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.videoFocus;
      const returnKey = returnFocus && returnFocus.dataset && returnFocus.dataset.videoFocus;
      const items = filteredVideos();
      grid.replaceChildren();
      const fragment = document.createDocumentFragment();
      items.forEach(function (video) {
        const visible = canShowMetadata(video);
        const card = element('article', 'video-card' + (visible ? '' : ' video-card-sealed'));
        if (visible) {
          const imageButton = button('', 'video-cover-button', function () { showDetails(video); });
          imageButton.setAttribute('aria-label', '查看作品：' + video.title);
          imageButton.dataset.videoFocus = 'cover-' + video.id;
          imageButton.append(cover(video));
          card.append(imageButton);
        } else {
          const sealed = element('div', 'video-image video-sealed');
          sealed.append(element('span', 'pill', '剧情保护'), element('p', '', '先把这份心意收好。'));
          card.append(sealed);
        }
        const body = element('div', 'video-body');
        const meta = element('p', 'video-meta', String(video.order).padStart(2, '0') + ' · ' + (video.category || '视频'));
        const heading = element('h3');
        const title = button(visible ? video.title : '封存的作品', 'video-title', function () { showDetails(video); });
        title.dataset.videoFocus = 'title-' + video.id;
        heading.append(title);
        body.append(meta, heading, authorLine(video));
        if (video.published) body.append(element('p', 'video-meta', video.published));
        if (!visible) body.append(button('我已通关，展开', 'button button-ghost', function () { askUnlock(video); }));
        const actions = element('div', 'video-actions');
        actions.append(watchLink(video), favoriteButton(video));
        body.append(actions);
        card.append(body);
        fragment.append(card);
      });
      grid.append(fragment);
      resultNode.textContent = (onlyFavorites ? '我的收藏 · ' : '') + items.length + ' / ' + archive.videos.length + ' 部作品' + (unlocked() ? ' · 剧情内容已展开' : ' · 剧情保护开启');
      const count = archive.videos.filter(function (video) { return favorites.has(video.id); }).length;
      favoriteFilter.textContent = '我的收藏 · ' + count;
      favoriteFilter.setAttribute('aria-pressed', String(onlyFavorites));
      if (!items.length) {
        const empty = element('div', 'empty-state');
        empty.append(element('h3', '', onlyFavorites && !count ? '先收藏一份喜欢的心意。' : '还没有符合条件的作品。'));
        empty.append(element('p', '', !unlocked() && query ? '当前仅搜索可公开的标题、作者与分类。封存的标题、简介和标签不会参与搜索。' : '试试其他关键词或分类，也可以回到全部作品。'));
        empty.append(button('浏览全部作品', 'button button-ghost', function () {
          category = 'all'; query = ''; onlyFavorites = false;
          shell.querySelector('[data-video-category]').value = 'all';
          shell.querySelector('[data-video-search]').value = '';
          renderCards();
          resultNode.focus({ preventScroll: true });
        }));
        grid.append(empty);
      }
      if (activeKey) focusKey(activeKey);
      if (returnKey) returnFocus = Array.from(shell.querySelectorAll('[data-video-focus]')).find(function (node) { return node.dataset.videoFocus === returnKey; }) || resultNode;
    }

    function buildInterface() {
      shell = element('section', 'video-library');
      shell.setAttribute('aria-label', '达妮娅原站视频收录');
      const intro = element('p', 'video-meta', '原日报 · ' + ((archive.meta && archive.meta.dailyEdition) || '2026-10-17') + ' · 完整保留 ' + archive.videos.length + ' 部作品与原作者入口');
      const toolbar = element('div', 'filter-row video-toolbar');
      const categoryLabel = element('label', 'field');
      categoryLabel.append(element('span', '', '作品分类'));
      const categorySelect = element('select', 'field');
      categorySelect.dataset.videoCategory = 'true';
      const allOption = element('option', '', '全部分类'); allOption.value = 'all'; categorySelect.append(allOption);
      Array.from(new Set(archive.videos.map(function (video) { return video.category || '视频'; }))).forEach(function (name) {
        const option = element('option', '', name); option.value = name; categorySelect.append(option);
      });
      categorySelect.value = category;
      categorySelect.addEventListener('change', function () { category = categorySelect.value; renderCards(); });
      categoryLabel.append(categorySelect);
      const searchLabel = element('label', 'field video-search');
      searchLabel.append(element('span', '', '搜索作品'));
      const search = element('input', 'field');
      search.type = 'search'; search.placeholder = '标题、作者或分类'; search.value = query; search.dataset.videoSearch = 'true';
      search.setAttribute('aria-describedby', prefix + '-search-help');
      search.addEventListener('input', function () { query = search.value; renderCards(); });
      searchLabel.append(search);
      const sortLabel = element('label', 'field');
      sortLabel.append(element('span', '', '排序'));
      const sortSelect = element('select', 'field');
      [['original', '原收录顺序'], ['new', '投稿较新']].forEach(function (entry) { const option = element('option', '', entry[1]); option.value = entry[0]; sortSelect.append(option); });
      sortSelect.value = sort;
      sortSelect.addEventListener('change', function () { sort = sortSelect.value; renderCards(); });
      sortLabel.append(sortSelect);
      favoriteFilter = button('我的收藏', 'button button-ghost', function () { onlyFavorites = !onlyFavorites; renderCards(); });
      toolbar.append(categoryLabel, searchLabel, sortLabel, favoriteFilter);
      const help = element('p', 'video-meta', '剧情保护开启时，封存的标题、简介与标签不会参与搜索。收藏仅保存在当前浏览器。');
      help.id = prefix + '-search-help';
      resultNode = element('p', 'video-meta video-result');
      resultNode.setAttribute('role', 'status'); resultNode.setAttribute('aria-live', 'polite'); resultNode.tabIndex = -1;
      storageNote = element('p', 'video-meta video-storage-note', storageWritable ? '' : '本地存储不可读取，已有数据已保留；本次收藏仅在当前页面生效。');
      storageNote.setAttribute('role', 'status');
      grid = element('div', 'video-grid');
      dialog = element('dialog', 'video-dialog');
      dialog.hidden = true;
      dialog.setAttribute('aria-labelledby', prefix + '-dialog-title');
      dialog.setAttribute('aria-modal', 'true');
      dialogBody = element('div', 'video-dialog-body');
      dialog.append(dialogBody);
      dialog.addEventListener('close', function (event) { disposeClosedDialog(event.currentTarget); });
      dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeDialog(); });
      dialog.addEventListener('click', function (event) {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog();
      });
      shell.append(intro, toolbar, help, resultNode, storageNote, grid, dialog);
      container.replaceChildren(shell);
      renderCards();
    }

    async function begin() {
      if (loading || destroyed) return;
      loading = true;
      container.setAttribute('aria-busy', 'true');
      const state = element('div', 'empty-state');
      state.setAttribute('role', 'status');
      state.append(element('p', '', '正在打开原站收录的 49 份心意……'));
      container.replaceChildren(state);
      try {
        archive = await loadArchive(options.base || './');
        if (destroyed) return;
        buildInterface();
        readyResolve(controller);
        if (typeof options.onReady === 'function') {
          try { options.onReady({ count: archive.videos.length, controller: controller }); }
          catch (error) { /* A host callback cannot break the archive. */ }
        }
      } catch (error) {
        if (destroyed) return;
        const failure = element('div', 'empty-state');
        failure.setAttribute('role', 'alert');
        failure.append(element('h3', '', '作品暂时未能加载。'));
        failure.append(element('p', '', '请稍后重试，或重新打开完整解压的网站文件。'));
        failure.append(button('重新加载', 'button', function () { begin(); }));
        container.replaceChildren(failure);
        readyResolve(null);
      } finally {
        loading = false;
        if (!destroyed) container.removeAttribute('aria-busy');
      }
    }

    function refresh() {
      if (destroyed || !archive) return;
      // Native close() changes .open immediately, but its close event is queued after this refresh.
      if (activeModal && (!dialog || !dialog.open || dialog.hidden)) {
        if (dialog) closeDialog(false);
        else activeModal = null;
      }
      renderCards();
      if (activeModal) {
        const current = activeModal;
        const video = archive.videos.find(function (item) { return item.id === current.id; });
        if (video) {
          if (current.type === 'details') showDetails(video);
          else showExternalNotice(video);
        }
      }
    }

    function onStorage(event) {
      if (destroyed || (event.key !== favoriteKey && event.key !== null)) return;
      const current = readFavorites();
      storageWritable = current.writable;
      if (current.writable) favorites = current.values;
      else tell('另一标签页的收藏数据无法读取，当前页面收藏仍保留。');
      renderCards();
    }

    function onKeydown(event) {
      if (!dialog || dialog.hidden || !dialog.open) return;
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(function (node) { return !node.hidden; });
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      closeDialog(false);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('keydown', onKeydown);
      container.removeAttribute('aria-busy');
      container.replaceChildren();
      readyResolve(null);
    }

    const controller = { refresh: refresh, destroy: destroy, ready: ready };
    window.addEventListener('storage', onStorage);
    document.addEventListener('keydown', onKeydown);
    begin();
    return controller;
  }

  window.DeniaVideos = Object.freeze({ mount: mount, version: '1.0.0' });
})();
