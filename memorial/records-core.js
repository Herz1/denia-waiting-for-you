/* Lossless, origin-local backup. Only these application-owned keys are read. */
(function (global) {
  'use strict';
  const keys = new Set(['denia.memorial.gallery.favorites.v1', 'denia-memorial-video-favorites:v1', 'denia.memorial.wishes.v1', 'denia.memorial.cakes.v1', 'denia.memorial.pet.v1', 'denia.memorial.reduce-motion.v1']);
  const allowed = key => keys.has(key) || /^denia-team-review:v1:[A-Za-z0-9_.:-]{1,180}$/.test(key);
  function snapshot(storage, origin) {
    const entries = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (allowed(key)) entries.push({key, value: storage.getItem(key)});
    }
    entries.sort((a, b) => a.key.localeCompare(b.key));
    return {format: 'denia-memorial-records', version: 1, origin, exportedAt: new Date().toISOString(), entries};
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > 4000000) throw Error('备份过大，最多接受 4 MB 文本。');
    let data; try { data = JSON.parse(text); } catch (_) { throw Error('JSON 不完整或格式有误。'); }
    if (data?.format !== 'denia-memorial-records' || data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 100) throw Error('请选择本机记录页导出的备份。');
    const seen = new Set();
    for (const entry of data.entries) {
      if (!entry || typeof entry.key !== 'string' || !allowed(entry.key) || seen.has(entry.key) || typeof entry.value !== 'string' || entry.value.length > 1500000) throw Error('备份含不支持、重复或过大的记录，未写入任何数据。');
      seen.add(entry.key);
    }
    return data;
  }
  function plan(storage, data, replace) {
    return data.entries.map(entry => ({...entry, previous: storage.getItem(entry.key)})).map(entry => ({...entry, action: entry.previous === entry.value ? 'same' : entry.previous === null ? 'add' : replace ? 'replace' : 'keep'}));
  }
  function apply(storage, rows) {
    const changed = [];
    try {
      for (const row of rows) {
        if (row.action !== 'add' && row.action !== 'replace') continue;
        if (storage.getItem(row.key) !== row.previous) throw Error('记录刚刚发生变化，请重新检查备份。');
        storage.setItem(row.key, row.value); changed.push(row);
      }
    } catch (error) {
      let rollbackFailed = false;
      for (const row of changed.reverse()) {
        try { if (row.previous === null) storage.removeItem(row.key); else storage.setItem(row.key, row.previous); } catch (_) { rollbackFailed = true; }
      }
      throw Error(rollbackFailed ? '保存失败，部分回滚未成功。请保留导入前备份，勿关闭本页。' : '未完成导入；已恢复本次写入前的记录。' + error.message);
    }
    return changed.length;
  }
  global.DeniaRecords = {snapshot, parse, plan, apply};
})(typeof window === 'undefined' ? globalThis : window);
