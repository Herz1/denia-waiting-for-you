(function () {
  'use strict';
  const core = window.DeniaRecords;
  const $ = id => document.getElementById(id);
  let pending = null;
  const message = text => { $('record-status').textContent = text; };
  function exportText() { return JSON.stringify(core.snapshot(localStorage, location.origin), null, 2); }
  function reset() { pending = null; $('record-apply').disabled = true; }
  $('record-export').onclick = () => {
    try { $('record-text').value = exportText(); reset(); message('已生成本机记录备份。可复制文本或下载；原记录保持不变。'); } catch (_) { message('浏览器不允许读取本机存储，请保留当前页面并使用各功能自己的导出入口。'); }
  };
  $('record-download').onclick = () => {
    try {
      const text = exportText(); $('record-text').value = text; reset();
      const url = URL.createObjectURL(new Blob([text], {type:'application/json'}));
      const a = document.createElement('a'); a.href = url; a.download = 'denia-records-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      message('已准备 JSON 下载；若浏览器没有保存，可复制下方完整文本。');
    } catch (_) { message('无法导出本机存储。'); }
  };
  $('record-file').onchange = async event => {
    reset(); const file = event.target.files[0]; if (!file) return;
    if (file.size > 4000000) { message('文件超过 4 MB，未读取。'); return; }
    try { $('record-text').value = await file.text(); message('备份已载入，请检查导入内容。'); } catch (_) { message('无法读取文件，请粘贴备份文本。'); }
  };
  $('record-text').oninput = reset; $('record-replace').onchange = reset;
  $('record-check').onclick = () => {
    reset();
    try {
      const data = core.parse($('record-text').value); const rows = core.plan(localStorage, data, $('record-replace').checked);
      const names = {add:'新增', replace:'替换', keep:'保留本机', same:'相同'};
      $('record-plan').textContent = rows.map(row => names[row.action]+' · '+row.key).join('\n') || '这份备份没有记录。';
      // Keep a pre-import copy visible and downloadable before accepting the plan.
      $('record-before').value = exportText(); $('record-before-wrap').hidden = false;
      pending = rows; $('record-apply').disabled = !rows.some(r => r.action === 'add' || r.action === 'replace');
      message('检查完成。默认保留同名本机记录；导入不会带走剧情解锁状态。');
    } catch (error) { message(error.message); }
  };
  $('record-apply').onclick = () => {
    if (!pending) return;
    try { const count = core.apply(localStorage, pending); reset(); message('已导入 '+count+' 项。请通过导航重新打开相册或课间页，载入恢复后的记录。'); }
    catch (error) { reset(); message(error.message); }
  };
})();
