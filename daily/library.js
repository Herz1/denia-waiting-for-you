import { FORMAT, MAX_BYTES, selectWorks, readBackup, readSaved, serializeSaved } from './collection-core.js';

const $ = id => document.getElementById(id);
const key = 'denia:daily:collection:v1';
const controls = ['search', 'category', 'sort', 'saved-filter', 'reset', 'export', 'import'];
let works = [], known = new Set(), saved = new Set(), onlySaved = false, storageAvailable = true;
const notice = message => { $('notice').textContent = message; };
function latestSaved() {
  if (!storageAvailable) return new Set(saved);
  try { return readSaved(localStorage.getItem(key), known); }
  catch { storageAvailable = false; notice('当前浏览器未能读取收藏。你仍可在本次访问中收藏，并导出清单保存。'); return new Set(saved); }
}
function persist() {
  try { localStorage.setItem(key, serializeSaved(saved)); storageAvailable = true; return true; }
  catch { storageAvailable = false; notice('当前浏览器无法保存收藏；本次访问仍可使用，请导出清单备份。'); return false; }
}
function textElement(tag, className, value) {
  const element = document.createElement(tag); element.className = className; element.textContent = value; return element;
}
function outsideLink(href, className) {
  const link = document.createElement('a'); link.href = href; link.className = className;
  link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
function renderCard(work) {
  const card = document.createElement('article'); card.className = 'work';
  const cover = outsideLink(work.url, 'cover'); cover.setAttribute('aria-label', '观看：' + work.title);
  if (work.image) {
    const image = document.createElement('img'); image.src = work.image; image.alt = work.title;
    image.loading = 'lazy'; image.decoding = 'async'; cover.append(image);
  }
  if (work.duration) cover.append(textElement('span', 'duration', work.duration));
  const body = document.createElement('div'); body.className = 'work-body';
  const kicker = textElement('div', 'work-kicker', work.category);
  kicker.append(textElement('span', '', String(work.order + 1).padStart(2, '0')));
  const heading = document.createElement('h3'), link = outsideLink(work.url, ''); link.textContent = work.title; heading.append(link);
  const author = work.authorUrl ? outsideLink(work.authorUrl, 'author') : document.createElement('span');
  author.className = 'author'; author.textContent = '创作 / ' + work.author;
  const tags = document.createElement('div'); tags.className = 'work-tags';
  work.tags.slice(0, 3).forEach(tag => tags.append(textElement('span', '', tag)));
  const bottom = document.createElement('div'); bottom.className = 'work-bottom';
  const save = document.createElement('button'); save.type = 'button'; save.className = 'save';
  const isSaved = saved.has(work.id);
  save.textContent = isSaved ? '♥ 已收藏' : '♡ 收藏';
  save.dataset.workId = work.id;
  save.setAttribute('aria-pressed', String(isSaved)); save.setAttribute('aria-label', (isSaved ? '取消收藏：' : '收藏：') + work.title);
  save.addEventListener('click', () => {
    saved = latestSaved(); const removing = saved.has(work.id);
    if (removing) saved.delete(work.id); else saved.add(work.id);
    if (onlySaved && removing) $('saved-filter').focus();
    const durable = persist(); render();
    if (!(onlySaved && removing)) $('works').querySelector(`[data-work-id="${work.id}"]`)?.focus();
    if (durable) notice(removing ? '已从收藏中移除。' : '已收藏，下次打开仍可找到。');
  });
  bottom.append(textElement('span', 'views', `${work.views.toLocaleString('zh-CN')} 播放 · 本期快照`), save);
  body.append(kicker, heading, author, tags, bottom); card.append(cover, body); return card;
}
function state() { return { query: $('search').value, category: $('category').value, sort: $('sort').value, onlySaved, saved }; }
function updateUrl(push = false) {
  const url = new URL(location.href), s = state();
  for (const name of ['q', 'type', 'sort', 'saved']) url.searchParams.delete(name);
  if (s.query) url.searchParams.set('q', s.query);
  if (s.category) url.searchParams.set('type', s.category);
  if (s.sort !== 'original') url.searchParams.set('sort', s.sort);
  if (onlySaved) url.searchParams.set('saved', '1');
  if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](null, '', url);
}
function restoreUrl() {
  const params = new URL(location.href).searchParams;
  $('search').value = (params.get('q') || '').slice(0, 160);
  const category = params.get('type') || '';
  $('category').value = [...$('category').options].some(option => option.value === category) ? category : '';
  $('sort').value = ['views', 'title'].includes(params.get('sort')) ? params.get('sort') : 'original';
  onlySaved = params.get('saved') === '1';
}
function render() {
  const filtered = selectWorks(works, state());
  $('works').replaceChildren(...filtered.map(renderCard));
  $('results').textContent = `找到 ${filtered.length} / ${works.length} 部作品${onlySaved ? ' · 我的收藏' : ''}`;
  $('saved-count').textContent = String(saved.size);
  $('saved-filter').setAttribute('aria-pressed', String(onlySaved));
  $('empty').hidden = filtered.length > 0;
  $('empty-message').textContent = onlySaved ? '还没有符合筛选的收藏。可以关闭收藏筛选，寻找下一部喜欢的作品。' : '换一个关键词或作品类型试试看，星光也许就在下一页。';
}
function readWorks(html) {
  const page = new DOMParser().parseFromString(html, 'text/html');
  const used = new Set();
  return [...page.querySelectorAll('article[id]')].flatMap((card, order) => {
    const id = card.id, title = card.querySelector('h3')?.textContent.trim();
    if (!/^BV[A-Za-z0-9]{10}$/.test(id) || !title || used.has(id)) return [];
    used.add(id);
    const kicker = card.querySelector('.kicker')?.cloneNode(true); kicker?.querySelector('span')?.remove();
    const category = kicker?.textContent.trim() || '其他作品';
    const rawImage = card.querySelector('.cover img')?.getAttribute('src') || '';
    const image = /^data:image\/(?:jpeg|png|webp|avif);base64,[A-Za-z0-9+/=]+$/.test(rawImage) ? rawImage : '';
    const rawAuthor = card.querySelector('.author')?.getAttribute('href') || '';
    const authorUrl = /^https:\/\/space\.bilibili\.com\/\d+\/?$/.test(rawAuthor) ? rawAuthor : '';
    const views = [...card.querySelectorAll('dl > div')].find(item => item.querySelector('dt')?.textContent.trim() === '播放')?.querySelector('dd')?.textContent || '0';
    return [{ id, order, title, category, image, authorUrl, author: card.querySelector('.author')?.textContent.trim() || '原视频作者',
      url: `https://www.bilibili.com/video/${id}/`, duration: card.querySelector('.duration')?.textContent.trim() || '',
      tags: [...card.querySelectorAll('.tags span')].map(tag => tag.textContent.trim()), views: Number(views.replace(/,/g, '')) || 0 }];
  });
}
async function init() {
  try {
    const response = await fetch(new URL('./index.html', import.meta.url));
    if (!response.ok) throw new Error('日报读取失败');
    works = readWorks(await response.text()); if (!works.length) throw new Error('日报没有可读取作品');
    known = new Set(works.map(work => work.id)); saved = latestSaved();
    [...new Set(works.map(work => work.category))].forEach(category => {
      const option = document.createElement('option'); option.value = category; option.textContent = category; $('category').append(option);
    });
    controls.forEach(id => { $(id).disabled = false; });
    $('total-count').textContent = `${works.length} 部作品`; restoreUrl(); render();
  } catch {
    $('error').hidden = false; $('results').textContent = '本期作品暂时不可读取。'; $('total-count').textContent = '完整日报仍可阅读';
  } finally { $('works').setAttribute('aria-busy', 'false'); }
}
$('filters').addEventListener('submit', event => event.preventDefault());
$('search').addEventListener('input', () => { updateUrl(); render(); });
for (const id of ['category', 'sort']) $(id).addEventListener('change', () => { updateUrl(true); render(); });
$('saved-filter').addEventListener('click', () => { onlySaved = !onlySaved; updateUrl(true); render(); });
$('reset').addEventListener('click', () => { $('search').value = ''; $('category').value = ''; $('sort').value = 'original'; onlySaved = false; updateUrl(true); render(); $('search').focus(); });
window.addEventListener('popstate', () => { if (works.length) { restoreUrl(); render(); } });
window.addEventListener('storage', event => {
  if (!works.length || !storageAvailable || (event.key !== key && event.key !== null)) return;
  try { saved = readSaved(event.key === null ? null : event.newValue, known); render(); }
  catch { notice('另一窗口的收藏数据无法读取，当前清单仍然保留。'); }
});
$('export').addEventListener('click', () => {
  saved = latestSaved(); render();
  const data = { format: FORMAT, version: 1, issue: '2026-10-17', exportedAt: new Date().toISOString(), ids: [...saved] };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'denia-stars-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice('已准备收藏清单，请在浏览器下载中确认。');
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  if (file.size > MAX_BYTES) { notice('文件过大，请选择本站导出的收藏清单。'); return; }
  try {
    const imported = readBackup(await file.text(), known); saved = latestSaved(); const before = saved.size;
    imported.ids.forEach(id => saved.add(id)); const durable = persist(); render();
    notice(`已合并 ${saved.size - before} 项新收藏。${imported.skipped ? `跳过 ${imported.skipped} 项本期未收录作品。` : ''}${durable ? '' : '当前浏览器无法保存，请再次导出清单备份。'}`);
  } catch (error) { notice(error.message || '读取失败，原有收藏已保留。'); }
});
init();
