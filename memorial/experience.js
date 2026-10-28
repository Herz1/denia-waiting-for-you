/* Denia memorial: optional motion, browser-local wishes, and text-only quote cards. */
(function (global) {
  'use strict';

  if (global.DeniaExperience && global.DeniaExperience.version === '1.0.0') return;

  const doc = global.document;
  const WISH_KEY = 'denia.memorial.wishes.v1';
  const MOTION_KEY = 'denia.memorial.reduce-motion.v1';
  const SCHEMA = 'denia.memorial.wishes';
  const MAX_WISHES = 200;
  const MAX_WISH_LENGTH = 280;
  const MAX_FILE_BYTES = 262144;
  const DAY = 86400000;
  const bindings = new Set();
  const formBindings = new WeakMap();
  let initialized = false;
  let storageAvailable = true;
  let wishes = [];
  let wishesLoaded = false;
  let motionOverride = null;
  let preferenceLoaded = false;
  let mediaQuery = null;
  let motionListener = null;
  let layer = null;
  let bubbles = [];
  let frame = 0;
  let previousTime = 0;
  let pointer = { x: -1000, y: -1000 };
  let viewport = { width: 0, height: 0 };
  let config = { root: doc, onToast: function () {}, asset: function (path) { return path; } };

  function tell(message) {
    try { config.onToast(message); } catch (_) { /* The host's toast must not stop an interaction. */ }
  }

  function readPreference() {
    try {
      const value = global.localStorage.getItem(MOTION_KEY);
      return value === 'true' ? true : value === 'false' ? false : null;
    } catch (_) { return null; }
  }

  function isReducedMotion() {
    if (!preferenceLoaded) { motionOverride = readPreference(); preferenceLoaded = true; }
    if (motionOverride !== null) return motionOverride;
    const query = mediaQuery || (typeof global.matchMedia === 'function' ? global.matchMedia('(prefers-reduced-motion: reduce)') : null);
    return !!(query && query.matches);
  }

  function syncMotion() {
    const reduced = isReducedMotion();
    if (doc && doc.documentElement) {
      doc.documentElement.classList.toggle('reduced-motion', reduced);
      doc.documentElement.setAttribute('data-reduced-motion', String(reduced));
    }
    if (layer) layer.hidden = reduced;
    stopFrames();
    if (!reduced) startFrames();
    if (doc && typeof global.CustomEvent === 'function') {
      doc.dispatchEvent(new global.CustomEvent('denia:motionchange', {
        detail: { reduced: reduced, source: motionOverride === null ? 'system' : 'user' }
      }));
    }
    return reduced;
  }

  function setReducedMotion(value) {
    preferenceLoaded = true;
    motionOverride = !!value;
    try { global.localStorage.setItem(MOTION_KEY, String(motionOverride)); } catch (_) {}
    return syncMotion();
  }

  function makeId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function characterLength(value) { return Array.from(value).length; }

  function normalizeWish(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('心愿文件中有无效记录。');
    if (typeof item.text !== 'string') throw new Error('每条心愿都需要文字。');
    const text = item.text.trim();
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!text || characterLength(text) > MAX_WISH_LENGTH) throw new Error('每条心愿需要 1–280 个字。');
    if (characterLength(name) > 20) throw new Error('署名不能超过 20 个字。');
    if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{6,100}$/.test(item.id)) throw new Error('心愿文件的记录编号无效。');
    if (typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) throw new Error('心愿文件的日期无效。');
    return { id: item.id, text: text, name: name, createdAt: new Date(item.createdAt).toISOString() };
  }

  function parseWishes(text, allowLegacy) {
    if (typeof text !== 'string' || text.length > MAX_FILE_BYTES) throw new Error('心愿文件过大，请选择 256 KB 以内的备份。');
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('这不是有效的 JSON 心愿文件。'); }
    const items = allowLegacy && Array.isArray(data) ? data : data && data.wishes;
    if (!(allowLegacy && Array.isArray(data)) && (!data || data.format !== SCHEMA || data.version !== 1)) {
      throw new Error('请选择本站导出的心愿备份。');
    }
    if (!Array.isArray(items) || items.length > MAX_WISHES) throw new Error('备份最多包含 200 条心愿。');
    const seen = new Set();
    return items.map(normalizeWish).filter(function (item) {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function loadWishes() {
    if (wishesLoaded) return;
    wishesLoaded = true;
    try {
      const text = global.localStorage.getItem(WISH_KEY);
      if (text) wishes = parseWishes(text, true);
    } catch (_) {
      storageAvailable = false;
      // Keep the original stored bytes intact if they cannot be read or parsed.
    }
  }

  function serializedWishes() {
    return JSON.stringify({ format: SCHEMA, version: 1, exportedAt: new Date().toISOString(), wishes: wishes }, null, 2);
  }

  function persistWishes() {
    if (!storageAvailable) return false;
    try {
      global.localStorage.setItem(WISH_KEY, serializedWishes());
      return true;
    } catch (_) {
      storageAvailable = false;
      return false;
    }
  }

  function notifyBindings() { bindings.forEach(function (binding) { binding.render(); }); }

  function createElement(tag, className, text) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formatWishDate(value) {
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date(value));
    } catch (_) { return value.slice(0, 10); }
  }

  function downloadBlob(blob, filename) {
    if (!blob || !global.URL || typeof global.URL.createObjectURL !== 'function') return false;
    let url;
    let anchor;
    try {
      url = global.URL.createObjectURL(blob);
      anchor = createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.hidden = true;
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 30000);
      return true;
    } catch (_) {
      if (anchor) anchor.remove();
      if (url) global.URL.revokeObjectURL(url);
      return false;
    }
  }

  async function copyText(text) {
    if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function') {
      try { await global.navigator.clipboard.writeText(text); return true; } catch (_) {}
    }
    const input = createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    const previous = doc.activeElement;
    doc.body.appendChild(input);
    input.select();
    let copied = false;
    try { copied = typeof doc.execCommand === 'function' && doc.execCommand('copy'); } catch (_) {}
    input.remove();
    if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    return copied;
  }

  function offerManualCopy(text, title, explanationText) {
    const existing = doc.getElementById('denia-manual-copy');
    if (existing) existing.remove();
    const previous = doc.activeElement;
    const dialog = createElement('dialog', 'denia-copy-dialog');
    dialog.id = 'denia-manual-copy';
    dialog.setAttribute('aria-labelledby', 'denia-copy-title');
    const heading = createElement('h2', '', title || '复制文字');
    heading.id = 'denia-copy-title';
    const explanation = createElement('p', '', explanationText || '浏览器未允许自动下载或复制。可以选中下面的文字复制。');
    const input = createElement('textarea', 'denia-copy-text');
    input.value = text;
    input.readOnly = true;
    input.rows = 8;
    input.setAttribute('aria-label', '可复制的完整文字');
    const close = createElement('button', '', '关闭');
    close.type = 'button';
    close.setAttribute('data-denia-dialog-close', '');
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      dialog.remove();
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    }
    close.addEventListener('click', finish);
    dialog.addEventListener('close', finish, { once: true });
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); finish(); });
    dialog.append(heading, explanation, input, close);
    doc.body.appendChild(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog'); }
    input.focus();
    input.select();
    return dialog;
  }

  // The preview keeps its own URL alive until the dialog closes; downloads use a separate URL.
  function offerQuotePreview(blob, text, plainText, filename) {
    if (!global.URL || typeof global.URL.createObjectURL !== 'function') throw new Error('Image preview unavailable');
    const existing = doc.getElementById('denia-quote-preview');
    if (existing) {
      const previousClose = existing.querySelector('[data-denia-dialog-close]');
      if (previousClose) previousClose.click();
      else existing.remove();
    }
    const previous = doc.activeElement;
    const url = global.URL.createObjectURL(blob);
    const dialog = createElement('dialog', 'denia-copy-dialog denia-quote-preview');
    dialog.id = 'denia-quote-preview';
    dialog.setAttribute('aria-labelledby', 'denia-quote-preview-title');
    const heading = createElement('h2', '', '留声卡已生成');
    heading.id = 'denia-quote-preview-title';
    const explanation = createElement('p', '', '可以下载图片，也可长按或右键保存。');
    const image = createElement('img', 'denia-quote-preview-image');
    image.src = url;
    image.alt = text;
    image.style.cssText = 'display:block;width:100%;max-height:62vh;height:auto;object-fit:contain;margin:18px auto;';
    const status = createElement('p', 'small-note');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const copyField = createElement('textarea', 'denia-copy-text');
    copyField.value = plainText;
    copyField.readOnly = true;
    copyField.hidden = true;
    copyField.setAttribute('aria-label', '可复制的台词与出处');
    const actions = createElement('div', 'inline-actions');
    const download = createElement('button', 'button', '下载图片');
    download.type = 'button';
    download.addEventListener('click', function () {
      status.textContent = downloadBlob(blob, filename)
        ? '已发起下载。若没有收到文件，可以长按或右键保存上方图片。'
        : '当前浏览器未允许下载，可以长按或右键保存上方图片。';
    });
    const copy = createElement('button', 'button button-ghost', '复制台词与出处');
    copy.type = 'button';
    copy.addEventListener('click', async function () {
      copyField.hidden = false;
      copyField.focus();
      copyField.select();
      copy.disabled = true;
      try {
        const copied = await copyText(plainText);
        if (!dialog.isConnected) return;
        status.textContent = copied ? '台词与出处已复制。下方也保留了完整文字。' : '已选中完整文字，请手动复制。';
        copyField.focus();
        copyField.select();
      } finally { copy.disabled = false; }
    });
    const close = createElement('button', 'button button-ghost', '合上留声卡');
    close.type = 'button';
    close.setAttribute('data-denia-dialog-close', '');
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      global.URL.revokeObjectURL(url);
      dialog.remove();
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    }
    close.addEventListener('click', finish);
    dialog.addEventListener('close', finish, { once: true });
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); finish(); });
    image.addEventListener('error', function () { status.textContent = '图片预览暂时不可用，仍可下载或复制完整台词与出处。'; }, { once: true });
    actions.append(download, copy, close);
    dialog.append(heading, explanation, image, actions, status, copyField);
    try {
      doc.body.appendChild(dialog);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else { dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); }
      close.focus({ preventScroll: true });
    } catch (error) { finish(); throw error; }
    return dialog;
  }

  async function exportWishes() {
    loadWishes();
    const text = serializedWishes();
    const name = 'Denia-心愿-' + getAnniversary().today + '.json';
    if (downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), name)) {
      tell('心愿备份已生成，请查看下载。');
      return { method: 'download', text: text };
    }
    if (await copyText(text)) { tell('心愿备份已复制，可保存为 JSON 文件。'); return { method: 'clipboard', text: text }; }
    offerManualCopy(text, '保存心愿备份');
    return { method: 'manual', text: text };
  }

  function importWishes(text) {
    loadWishes();
    const imported = parseWishes(text, false);
    const ids = new Set(wishes.map(function (item) { return item.id; }));
    const fingerprints = new Set(wishes.map(function (item) { return item.text + '\u0000' + item.name + '\u0000' + item.createdAt; }));
    const additions = imported.filter(function (item) {
      const fingerprint = item.text + '\u0000' + item.name + '\u0000' + item.createdAt;
      if (ids.has(item.id) || fingerprints.has(fingerprint)) return false;
      ids.add(item.id);
      fingerprints.add(fingerprint);
      return true;
    });
    if (wishes.length + additions.length > MAX_WISHES) throw new Error('合并后超过 200 条，现有心愿没有改动。');
    wishes = wishes.concat(additions).sort(function (a, b) { return Date.parse(b.createdAt) - Date.parse(a.createdAt); });
    const persisted = persistWishes();
    notifyBindings();
    tell('已导入 ' + additions.length + ' 条心愿' + (persisted ? '，仅保存在此设备。' : '，请导出备份以便保留。'));
    return { added: additions.length, total: wishes.length, persisted: persisted };
  }

  function bindWishForm(form, list) {
    if (!form || !list || typeof form.addEventListener !== 'function') return null;
    if (formBindings.has(form)) return formBindings.get(form);
    loadWishes();
    const input = form.querySelector('[name="wish"], [name="message"], textarea');
    const nameInput = form.querySelector('[name="name"]');
    if (!input) return null;
    input.maxLength = Math.max(Number(input.maxLength) || 0, 560);
    if (nameInput) nameInput.maxLength = 40;
    const note = form.querySelector('[data-wish-note]') || createElement('p', 'denia-wish-note');
    if (!note.parentNode) form.appendChild(note);
    note.setAttribute('data-wish-note', '');
    if (!note.id) note.id = 'denia-wish-note-' + makeId();
    const describedBy = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!describedBy.includes(note.id)) describedBy.push(note.id);
    input.setAttribute('aria-describedby', describedBy.join(' '));
    const status = form.querySelector('[data-wish-status]') || createElement('p', 'denia-wish-status');
    status.setAttribute('data-wish-status', '');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    if (!status.parentNode) form.appendChild(status);
    const counter = form.querySelector('[data-wish-count]') || createElement('span', 'denia-wish-count');
    counter.setAttribute('data-wish-count', '');
    if (!counter.parentNode) form.appendChild(counter);
    const tools = form.querySelector('.denia-wish-tools') || createElement('div', 'denia-wish-tools');
    if (!tools.parentNode) form.appendChild(tools);
    let exportButton = form.querySelector('[data-wish-export]');
    if (!exportButton) {
      exportButton = createElement('button', '', '导出心愿');
      exportButton.setAttribute('data-wish-export', '');
      tools.appendChild(exportButton);
    }
    exportButton.type = 'button';
    let importButton = form.querySelector('[data-wish-import]');
    if (!importButton) {
      importButton = createElement('button', '', '导入心愿');
      importButton.setAttribute('data-wish-import', '');
      tools.appendChild(importButton);
    }
    importButton.type = 'button';
    let copyBackupButton = form.querySelector('[data-wish-copy]');
    if (!copyBackupButton) {
      copyBackupButton = createElement('button', 'button button-ghost', '复制备份文本');
      copyBackupButton.setAttribute('data-wish-copy', '');
      tools.appendChild(copyBackupButton);
    }
    copyBackupButton.type = 'button';
    let pasteBackupButton = form.querySelector('[data-wish-paste]');
    if (!pasteBackupButton) {
      pasteBackupButton = createElement('button', 'button button-ghost', '粘贴备份文本');
      pasteBackupButton.setAttribute('data-wish-paste', '');
      tools.appendChild(pasteBackupButton);
    }
    pasteBackupButton.type = 'button';
    const fileInput = createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.hidden = true;
    form.appendChild(fileInput);

    function updateCounter() { counter.textContent = characterLength(input.value) + ' / ' + MAX_WISH_LENGTH; }
    function setStatus(message) { status.replaceChildren(); status.textContent = message; }
    function render() {
      note.textContent = storageAvailable
        ? '仅保存在此设备，不会发送到服务器。建议导出备份；清除浏览器数据会清除本地心愿。'
        : '当前浏览器无法持久保存；心愿仅保留到页面关闭，请导出备份。';
      list.replaceChildren();
      if (!wishes.length) {
        const empty = createElement(/^(UL|OL)$/.test(list.tagName) ? 'li' : 'p', 'denia-wish-empty', '这里还没有你的心愿。为下次相见，留下一句话吧。');
        list.appendChild(empty);
        return;
      }
      wishes.forEach(function (item) {
        const card = createElement(/^(UL|OL)$/.test(list.tagName) ? 'li' : 'article', 'denia-wish-card');
        const text = createElement('p', 'denia-wish-text', item.text);
        const byline = createElement('div', 'denia-wish-byline');
        byline.appendChild(createElement('span', 'denia-wish-name', item.name || '路过的同好'));
        const time = createElement('time', '', formatWishDate(item.createdAt));
        time.dateTime = item.createdAt;
        byline.appendChild(time);
        const remove = createElement('button', 'denia-wish-delete', '删除');
        remove.type = 'button';
        remove.setAttribute('aria-label', '删除这条本地心愿');
        remove.addEventListener('click', function () {
          wishes = wishes.filter(function (record) { return record.id !== item.id; });
          persistWishes();
          notifyBindings();
          setStatus('已删除这条本地心愿。');
          const undo = createElement('button', 'denia-wish-undo', '撤销');
          undo.type = 'button';
          undo.addEventListener('click', function () {
            if (!wishes.some(function (record) { return record.id === item.id; }) && wishes.length < MAX_WISHES) {
              wishes.unshift(item);
              persistWishes();
              notifyBindings();
            }
            setStatus('心愿已恢复。');
            input.focus({ preventScroll: true });
          }, { once: true });
          status.appendChild(undo);
          undo.focus({ preventScroll: true });
        });
        byline.appendChild(remove);
        card.append(text, byline);
        list.appendChild(card);
      });
    }

    function submit(event) {
      event.preventDefault();
      const text = input.value.trim();
      const name = nameInput ? nameInput.value.trim() : '';
      if (!text || characterLength(text) > MAX_WISH_LENGTH) {
        setStatus('写下 1–280 个字，就可以留下这颗心愿。');
        input.focus();
        return;
      }
      if (characterLength(name) > 20) { setStatus('署名请保持在 20 个字以内。'); nameInput.focus(); return; }
      if (wishes.length >= MAX_WISHES) { setStatus('已保存 200 条心愿，可以先导出备份，再整理本地记录。'); return; }
      wishes.unshift({ id: makeId(), text: text, name: name, createdAt: new Date().toISOString() });
      const persisted = persistWishes();
      input.value = '';
      updateCounter();
      notifyBindings();
      setStatus(persisted ? '这句心愿已保存在此设备。' : '心愿已留在本次页面中，请导出备份。');
      tell(persisted ? '留好了。下次相见时，再回来看看。' : '心愿已记录；请导出备份以便保留。');
    }
    function doExport() { exportWishes().catch(function () { setStatus('导出暂时未完成，请稍后再试。'); }); }
    function chooseImport() { fileInput.click(); }
    function copyBackup() {
      loadWishes();
      const text = serializedWishes();
      const dialog = offerManualCopy(text, '复制心愿备份', '下面是完整的 JSON 备份。复制并保存后，可以通过“粘贴备份文本”恢复心愿。');
      const area = dialog.querySelector('textarea');
      area.setAttribute('aria-label', '心愿备份 JSON');
      const result = createElement('p', 'small-note');
      result.setAttribute('role', 'status');
      result.setAttribute('aria-live', 'polite');
      const copy = createElement('button', 'button', '复制全部文本');
      copy.type = 'button';
      copy.addEventListener('click', async function () {
        copy.disabled = true;
        try {
          const copied = await copyText(text);
          if (!dialog.isConnected) return;
          result.textContent = copied ? '完整备份已复制。请将它保存到自己的文本文件中。' : '已选中完整备份，请手动复制。';
          area.focus();
          area.select();
        } finally { copy.disabled = false; }
      });
      const close = dialog.querySelector('[data-denia-dialog-close]');
      dialog.insertBefore(result, close);
      dialog.insertBefore(copy, close);
    }
    function pasteBackup() {
      const dialog = offerManualCopy('', '粘贴心愿备份', '粘贴本站导出的完整 JSON。通过校验后会合并去重，现有心愿会保留。');
      const area = dialog.querySelector('textarea');
      area.readOnly = false;
      area.spellcheck = false;
      area.placeholder = '在这里粘贴完整的 JSON 备份';
      area.setAttribute('aria-label', '待导入的心愿备份 JSON');
      area.setAttribute('autocapitalize', 'off');
      const errorNode = createElement('p', 'small-note');
      errorNode.id = 'denia-paste-error';
      errorNode.setAttribute('role', 'alert');
      area.setAttribute('aria-describedby', errorNode.id);
      const confirm = createElement('button', 'button', '校验并导入');
      confirm.type = 'button';
      const close = dialog.querySelector('[data-denia-dialog-close]');
      confirm.addEventListener('click', function () {
        try {
          const result = importWishes(area.value);
          setStatus('导入完成：新增 ' + result.added + ' 条，重复记录已跳过。' + (result.persisted ? '' : '当前仅临时保存，请保留备份文本。'));
          close.click();
        } catch (error) {
          errorNode.textContent = error && error.message ? error.message : '无法读取这份备份，现有心愿没有改动。';
          area.setAttribute('aria-invalid', 'true');
          area.focus();
        }
      });
      area.addEventListener('input', function () { area.removeAttribute('aria-invalid'); errorNode.textContent = ''; });
      dialog.insertBefore(errorNode, close);
      dialog.insertBefore(confirm, close);
      area.focus();
    }
    async function readImport() {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error('请选择 256 KB 以内的 JSON 心愿备份。');
        const text = await file.text();
        const result = importWishes(text);
        setStatus('导入完成：新增 ' + result.added + ' 条，重复记录已跳过。');
      } catch (error) { setStatus(error && error.message ? error.message : '无法读取这份备份，现有心愿没有改动。'); }
      finally { fileInput.value = ''; }
    }
    const binding = {
      render: render,
      exportJSON: exportWishes,
      importJSON: importWishes,
      destroy: function () {
        form.removeEventListener('submit', submit);
        input.removeEventListener('input', updateCounter);
        exportButton.removeEventListener('click', doExport);
        importButton.removeEventListener('click', chooseImport);
        copyBackupButton.removeEventListener('click', copyBackup);
        pasteBackupButton.removeEventListener('click', pasteBackup);
        fileInput.removeEventListener('change', readImport);
        fileInput.remove();
        bindings.delete(binding);
        formBindings.delete(form);
      }
    };
    form.addEventListener('submit', submit);
    input.addEventListener('input', updateCounter);
    exportButton.addEventListener('click', doExport);
    importButton.addEventListener('click', chooseImport);
    copyBackupButton.addEventListener('click', copyBackup);
    pasteBackupButton.addEventListener('click', pasteBackup);
    fileInput.addEventListener('change', readImport);
    bindings.add(binding);
    formBindings.set(form, binding);
    updateCounter();
    render();
    return binding;
  }

  function getAnniversary(referenceDate) {
    let now = referenceDate === undefined ? new Date() : new Date(referenceDate);
    if (!Number.isFinite(now.getTime())) now = new Date();
    let year, month, day;
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(now);
      const values = {};
      parts.forEach(function (part) { values[part.type] = part.value; });
      year = Number(values.year); month = Number(values.month); day = Number(values.day);
    } catch (_) {
      const shanghai = new Date(now.getTime() + 8 * 3600000);
      year = shanghai.getUTCFullYear(); month = shanghai.getUTCMonth() + 1; day = shanghai.getUTCDate();
    }
    const current = Date.UTC(year, month - 1, day);
    const start = Date.UTC(2026, 4, 21);
    const thisYear = Date.UTC(Math.max(year, 2026), 4, 21);
    const nextYear = current > thisYear ? Math.max(year, 2026) + 1 : Math.max(year, 2026);
    const next = Date.UTC(nextYear, 4, 21);
    const waitingDays = Math.max(0, Math.round((current - start) / DAY) + 1);
    const today = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    return {
      waitingDays: waitingDays,
      days: waitingDays,
      elapsedDays: Math.max(0, Math.round((current - start) / DAY)),
      startDate: '2026-05-21',
      today: today,
      nextDate: nextYear + '-05-21',
      daysUntilNext: Math.max(0, Math.round((next - current) / DAY)),
      isAnniversary: current >= start && month === 5 && day === 21,
      timeZone: 'Asia/Shanghai'
    };
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const lines = [];
    String(text).split('\n').forEach(function (paragraph) {
      if (!paragraph) { lines.push(''); return; }
      let line = '';
      Array.from(paragraph).forEach(function (character) {
        if (line && ctx.measureText(line + character).width > maxWidth) { lines.push(line); line = character; }
        else line += character;
      });
      lines.push(line);
    });
    return lines;
  }

  async function shareQuote(options) {
    const value = options || {};
    const text = typeof value.text === 'string' ? value.text.trim() : '';
    const source = typeof value.source === 'string' && value.source.trim() ? value.source.trim() : '出处待补充';
    const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : '留声 · 直到下次再见';
    if (!text) { tell('这张卡片还没有文字。'); return { method: 'manual', text: '' }; }
    const plainText = title + '\n\n' + text + '\n\n出处：' + source + '\nДо свидания · 直到下次再见\n非官方粉丝站';
    try {
      if (text.length > 5000 || source.length > 1000 || title.length > 200) throw new Error('Use lossless text export for a long quotation.');
      const canvas = doc.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      const width = 1080;
      const padding = 104;
      const contentWidth = width - padding * 2;
      const bodyFont = '46px "Songti SC", "Noto Serif CJK SC", "Microsoft YaHei", serif';
      const smallFont = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.font = bodyFont;
      const lines = wrapCanvasText(ctx, text, contentWidth);
      ctx.font = smallFont;
      const sourceUrls = source.match(/https?:\/\/\S+/gi) || [];
      const sourceLabel = source.replace(/https?:\/\/\S+/gi, '').trim();
      const sourceLines = wrapCanvasText(ctx, '出处：' + sourceLabel, contentWidth);
      // Keep each complete URL on its own line, fitting its type size instead of wrapping its final digits.
      const sourceLinks = sourceUrls.map(function (url) {
        ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
        const size = Math.min(20, 20 * contentWidth / Math.max(1, ctx.measureText(url).width));
        return { text: url, font: size.toFixed(2) + 'px "PingFang SC", "Microsoft YaHei", sans-serif' };
      });
      ctx.font = smallFont;
      const titleLines = wrapCanvasText(ctx, title, contentWidth);
      const height = Math.max(1120, 640 + lines.length * 78 + sourceLines.length * 38 + sourceLinks.length * 32 + titleLines.length * 34);
      if (height > 8000) throw new Error('Use lossless text export for a long quotation.');
      canvas.width = width; canvas.height = height;
      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, '#F9F6FA');
      background.addColorStop(0.6, '#F4F0F6');
      background.addColorStop(1, '#EAE5F2');
      ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 2; ctx.strokeStyle = '#D5CADC'; ctx.strokeRect(35, 35, width - 70, height - 70);
      [[width - 135, 175, 66], [width - 80, 270, 26], [105, height - 175, 44]].forEach(function (circle) {
        ctx.beginPath(); ctx.arc(circle[0], circle[1], circle[2], 0, Math.PI * 2);
        ctx.strokeStyle = '#C4B6D2'; ctx.lineWidth = 1.5; ctx.stroke();
      });
      ctx.fillStyle = '#87506E'; ctx.font = smallFont; ctx.textBaseline = 'top';
      ctx.fillText('DENIA / A PAGE TO REMEMBER', padding, 102);
      ctx.fillStyle = '#4E4057';
      titleLines.forEach(function (line, index) { ctx.fillText(line, padding, 155 + index * 34); });
      let y = 260 + (titleLines.length - 1) * 34;
      ctx.font = bodyFont;
      lines.forEach(function (line) { ctx.fillText(line, padding, y); y += 78; });
      y += 70;
      ctx.strokeStyle = '#D3C3D2'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(padding + 80, y); ctx.stroke();
      y += 30;
      ctx.font = smallFont; ctx.fillStyle = '#66596C';
      sourceLines.forEach(function (line) { ctx.fillText(line, padding, y); y += 38; });
      sourceLinks.forEach(function (link) { ctx.font = link.font; ctx.fillText(link.text, padding, y, contentWidth); y += 32; });
      ctx.fillStyle = '#4E4057'; ctx.font = '34px Georgia, "Songti SC", serif';
      ctx.fillText('До свидания', padding, height - 170);
      ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('直到下次再见 · 非官方粉丝站', padding, height - 115);
      const blob = await new Promise(function (resolve, reject) {
        if (typeof canvas.toBlob !== 'function') { reject(new Error('PNG export unavailable')); return; }
        canvas.toBlob(function (result) { result ? resolve(result) : reject(new Error('PNG export failed')); }, 'image/png');
      });
      offerQuotePreview(blob, text, plainText, 'Denia-留声-' + getAnniversary().today + '.png');
      tell('留声卡已生成，可以预览并保存。');
      return { method: 'preview', blob: blob, text: plainText };
    } catch (_) {
      if (await copyText(plainText)) { tell('图片下载暂不可用，完整文字与出处已复制。'); return { method: 'clipboard', text: plainText }; }
      offerManualCopy(plainText, '保存这句留声');
      return { method: 'manual', text: plainText };
    }
  }

  function bubbleCount() {
    const narrow = viewport.width < 640;
    const lowPower = (global.navigator && global.navigator.deviceMemory && global.navigator.deviceMemory <= 4)
      || (global.navigator && global.navigator.hardwareConcurrency && global.navigator.hardwareConcurrency <= 4);
    return narrow ? 2 : lowPower ? 3 : viewport.width > 1600 ? 7 : 5;
  }

  function stopFrames() {
    if (frame && typeof global.cancelAnimationFrame === 'function') global.cancelAnimationFrame(frame);
    frame = 0; previousTime = 0;
  }

  function startFrames() {
    if (!initialized || !layer || isReducedMotion() || doc.hidden || frame || typeof global.requestAnimationFrame !== 'function') return;
    frame = global.requestAnimationFrame(tick);
  }

  function popBubble(bubble) {
    if (!bubble || bubble.popping || isReducedMotion()) return;
    bubble.popping = true;
    bubble.popAt = global.performance && typeof global.performance.now === 'function' ? global.performance.now() : Date.now();
    bubble.node.setAttribute('aria-label', '泡泡已散开，再轻轻戳一下');
    tell('泡泡散成了小小星光。');
    startFrames();
  }

  function rebuildBubbles() {
    if (!doc || !doc.body) return;
    viewport.width = global.innerWidth || doc.documentElement.clientWidth || 1024;
    viewport.height = global.innerHeight || doc.documentElement.clientHeight || 768;
    if (!layer || !layer.isConnected) {
      const host = config.root && typeof config.root.querySelector === 'function' ? config.root.querySelector('[data-bubble-area]') : null;
      layer = createElement('div', 'denia-bubble-layer');
      layer.setAttribute('aria-label', '泡泡小互动');
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;overflow:hidden;';
      (host || doc.body).appendChild(layer);
      bubbles = [];
    }
    const count = bubbleCount();
    if (bubbles.length !== count) {
      layer.replaceChildren(); bubbles = [];
      for (let index = 0; index < count; index += 1) {
        const node = createElement('button', 'denia-bubble');
        node.type = 'button';
        node.setAttribute('aria-label', '戳破一个泡泡');
        node.style.cssText = 'position:absolute;left:0;top:0;width:44px;height:44px;padding:0;border:0;background:transparent;pointer-events:auto;display:grid;place-items:center;cursor:pointer;will-change:transform,opacity;';
        const film = createElement('span', 'denia-bubble-film');
        const size = viewport.width < 640 ? 13 + Math.random() * 5 : 16 + Math.random() * 12;
        film.setAttribute('aria-hidden', 'true');
        film.style.cssText = 'display:block;border-radius:50%;width:' + size + 'px;height:' + size + 'px;border:1px solid rgba(157,130,179,.35);background:radial-gradient(circle at 28% 25%,rgba(255,255,255,.7),rgba(188,223,244,.08) 45%,rgba(229,167,195,.18));box-shadow:inset -2px -2px 5px rgba(172,144,194,.12);';
        node.appendChild(film);
        const bubble = { node: node, side: index % 2, y: viewport.height * (0.22 + Math.random() * 0.6), speed: 7 + Math.random() * 8, phase: Math.random() * Math.PI * 2, popping: false, popAt: 0, focused: false };
        node.addEventListener('click', function () { popBubble(bubble); });
        node.addEventListener('focus', function () { bubble.focused = true; node.style.opacity = '1'; });
        node.addEventListener('blur', function () { bubble.focused = false; });
        layer.appendChild(node); bubbles.push(bubble);
      }
    }
    layer.hidden = isReducedMotion();
    startFrames();
  }

  function tick(time) {
    frame = 0;
    if (!layer || !layer.isConnected || isReducedMotion() || doc.hidden) { previousTime = 0; return; }
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
    previousTime = time;
    bubbles.forEach(function (bubble) {
      if (bubble.focused && !bubble.popping) return;
      let scale = 1;
      let opacity = 0.6;
      if (bubble.popping) {
        const progress = Math.max(0, (time - bubble.popAt) / 320);
        scale = 1 + Math.min(progress, 1) * 0.65;
        opacity = Math.max(0, 1 - progress);
        if (progress >= 1) {
          bubble.popping = false;
          bubble.y = viewport.height - 90;
          bubble.node.setAttribute('aria-label', '戳破一个泡泡');
        }
      } else {
        bubble.y -= delta * bubble.speed;
        if (bubble.y < 90) bubble.y = viewport.height - 90;
      }
      const inset = viewport.width < 640 ? -18 : -10;
      let x = bubble.side ? viewport.width - 44 - inset : inset;
      x += Math.sin(time / 3500 + bubble.phase) * (viewport.width < 640 ? 1 : 3);
      const dx = x + 22 - pointer.x;
      const dy = bubble.y + 22 - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < 70) x += Math.sign(dx) * Math.min(6, (70 - distance) / 10);
      bubble.node.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + bubble.y.toFixed(2) + 'px,0) scale(' + scale.toFixed(3) + ')';
      bubble.node.style.opacity = String(opacity);
    });
    frame = global.requestAnimationFrame(tick);
  }

  function onVisibility() { doc.hidden ? stopFrames() : startFrames(); }
  function onResize() { rebuildBubbles(); }
  function onPointer(event) { pointer = { x: event.clientX, y: event.clientY }; }
  function onPointerLeave() { pointer = { x: -1000, y: -1000 }; }
  function onStorage(event) {
    if (event.key === MOTION_KEY) {
      motionOverride = event.newValue === 'true' ? true : event.newValue === 'false' ? false : null;
      syncMotion();
    }
    if (event.key === WISH_KEY) {
      try { wishes = event.newValue ? parseWishes(event.newValue, true) : []; wishesLoaded = true; notifyBindings(); } catch (_) {}
    }
  }

  function init(options) {
    if (options && typeof options === 'object') {
      if (options.root) config.root = options.root;
      if (typeof options.onToast === 'function') config.onToast = options.onToast;
      if (typeof options.asset === 'function') config.asset = options.asset;
    }
    if (!initialized) {
      initialized = true;
      motionOverride = readPreference();
      preferenceLoaded = true;
      if (typeof global.matchMedia === 'function') mediaQuery = global.matchMedia('(prefers-reduced-motion: reduce)');
      motionListener = function () { if (motionOverride === null) syncMotion(); };
      if (mediaQuery && typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', motionListener);
      else if (mediaQuery && typeof mediaQuery.addListener === 'function') mediaQuery.addListener(motionListener);
      doc.addEventListener('visibilitychange', onVisibility);
      doc.addEventListener('pointermove', onPointer, { passive: true });
      doc.addEventListener('pointerleave', onPointerLeave, { passive: true });
      global.addEventListener('resize', onResize, { passive: true });
      global.addEventListener('storage', onStorage);
    }
    rebuildBubbles();
    syncMotion();
    return api;
  }

  function destroy() {
    stopFrames();
    bindings.forEach(function (binding) { binding.destroy(); });
    if (mediaQuery && motionListener) {
      if (typeof mediaQuery.removeEventListener === 'function') mediaQuery.removeEventListener('change', motionListener);
      else if (typeof mediaQuery.removeListener === 'function') mediaQuery.removeListener(motionListener);
    }
    if (doc) {
      doc.removeEventListener('visibilitychange', onVisibility);
      doc.removeEventListener('pointermove', onPointer);
      doc.removeEventListener('pointerleave', onPointerLeave);
    }
    global.removeEventListener('resize', onResize);
    global.removeEventListener('storage', onStorage);
    if (layer) layer.remove();
    layer = null; bubbles = []; initialized = false;
  }

  const api = {
    version: '1.0.0',
    init: init,
    bindWishForm: bindWishForm,
    shareQuote: shareQuote,
    getAnniversary: getAnniversary,
    setReducedMotion: setReducedMotion,
    isReducedMotion: isReducedMotion,
    exportWishes: exportWishes,
    importWishes: importWishes,
    getWishes: function () { loadWishes(); return wishes.map(function (item) { return Object.assign({}, item); }); },
    popBubble: function () { if (bubbles.length) popBubble(bubbles[Math.floor(Math.random() * bubbles.length)]); },
    destroy: destroy
  };
  global.DeniaExperience = Object.freeze(api);
})(window);
