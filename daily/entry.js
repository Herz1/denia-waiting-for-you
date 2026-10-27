// The original bundle owns the home markup. Wait for its documented hydration
// signal before adding one independent portal; leave the daily entrance intact.
function addCollectionLink() {
  const root = document.getElementById('root');
  if (root?.dataset.hydrated !== 'true') return;
  const portals = root.querySelector('.portals');
  if (!portals || portals.querySelector('[data-collection-entry]')) return;
  const link = document.createElement('a'); link.href = './daily/library.html'; link.dataset.collectionEntry = 'true';
  link.className = 'portal'; link.setAttribute('aria-label', '星光收藏室 · 搜索与收藏本期作品');
  link.innerHTML = '<span class="portal-icon" aria-hidden="true">✧</span><span><small>YOUR COLLECTION</small><strong>星光收藏室</strong><em>搜索作品 · 收藏 · 随身带走</em></span><span class="portal-arrow" aria-hidden="true">↗</span>';
  portals.append(link);
}
const observer = new MutationObserver(addCollectionLink);
function start() {
  const root = document.getElementById('root'); if (!root) return;
  observer.observe(root, { childList: true, subtree: true }); addCollectionLink();
}
if (document.getElementById('root')?.dataset.hydrated === 'true') start();
else document.addEventListener('denia:hydrated', start, { once: true });
window.addEventListener('pagehide', () => observer.disconnect());
window.addEventListener('pageshow', event => { if (event.persisted) start(); });
