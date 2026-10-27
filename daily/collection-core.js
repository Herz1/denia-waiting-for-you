export const FORMAT = 'denia-daily-collection';
export const MAX_BYTES = 100000;
export function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim();
}
export function selectWorks(works, { query = '', category = '', sort = 'original', onlySaved = false, saved = new Set() } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const result = works.filter(work => (!category || work.category === category) &&
    (!onlySaved || saved.has(work.id)) && terms.every(term => normalize([work.title, work.author, work.category, work.tags.join(' ')].join(' ')).includes(term)));
  if (sort === 'views') result.sort((a, b) => b.views - a.views || a.order - b.order);
  if (sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN') || a.order - b.order);
  return result;
}
export function readBackup(text, knownIds) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('文件过大，请选择本站导出的收藏清单。');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('无法读取这个 JSON 文件，原有收藏已保留。'); }
  if (!data || data.format !== FORMAT || data.version !== 1 || !Array.isArray(data.ids) || data.ids.length > 2000 ||
      data.ids.some(id => typeof id !== 'string' || id.length > 80)) {
    throw new Error('这不是受支持的星光收藏清单，原有收藏已保留。');
  }
  const unique = [...new Set(data.ids)];
  return { ids: unique.filter(id => knownIds.has(id)), skipped: unique.filter(id => !knownIds.has(id)).length };
}
export function readSaved(text, knownIds) {
  if (!text) return new Set();
  return new Set(readBackup(text, knownIds).ids);
}
export function serializeSaved(ids) {
  return JSON.stringify({ format: FORMAT, version: 1, ids: [...ids] });
}
