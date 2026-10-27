import assert from 'node:assert/strict';
import { FORMAT, normalize, selectWorks, readBackup, readSaved, serializeSaved } from '../daily/collection-core.js';
const works = [
  { id:'one', title:'ＤＥＮＩＡ 星空', author:'莓莓纱', category:'动画', tags:['#鸣潮'], views:5, order:0 },
  { id:'two', title:'来信', author:'莓莓纱', category:'音乐', tags:['#达妮娅'], views:20, order:1 },
  { id:'three', title:'星空', author:'另一位作者', category:'动画', tags:[], views:20, order:2 }
];
const known = new Set(works.map(x => x.id));
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS', name); }
check('NFKC and case normalization', () => assert.equal(normalize(' ＤＥＮＩＡ '), 'denia'));
check('terms combine title and author', () => assert.deepEqual(selectWorks(works,{query:'denia 莓莓纱'}).map(x=>x.id),['one']));
check('category and saved compose', () => assert.deepEqual(selectWorks(works,{category:'音乐',onlySaved:true,saved:new Set(['one','two'])}).map(x=>x.id),['two']));
check('tag search', () => assert.deepEqual(selectWorks(works,{query:'#鸣潮'}).map(x=>x.id),['one']));
check('stable view sort without source mutation', () => { assert.deepEqual(selectWorks(works,{sort:'views'}).map(x=>x.id),['two','three','one']);assert.equal(works[0].id,'one'); });
const backup = { format:FORMAT,version:1,ids:['one','one','missing','two'] };
check('backup deduplicates and skips absent IDs', () => assert.deepEqual(readBackup(JSON.stringify(backup),known),{ids:['one','two'],skipped:1}));
check('reject malformed JSON', () => assert.throws(()=>readBackup('{broken',known)));
check('reject foreign format and version', () => { for(const patch of [{format:'other'},{version:2}]) assert.throws(()=>readBackup(JSON.stringify({...backup,...patch}),known)); });
check('reject non-string IDs and excessive input', () => { for(const ids of [[{}],['a'.repeat(81)],Array(2001).fill('one')]) assert.throws(()=>readBackup(JSON.stringify({...backup,ids}),known));assert.throws(()=>readBackup(' '.repeat(100001),known)); });
check('storage round trip and empty reset', () => { assert.deepEqual([...readSaved(serializeSaved(new Set(['one','two'])),known)],['one','two']);assert.equal(readSaved(null,known).size,0); });
console.log(`${checks} behavior checks passed.`);
