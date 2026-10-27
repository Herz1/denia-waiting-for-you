import assert from 'node:assert/strict';
import '../memorial/records-core.js';
const core = globalThis.DeniaRecords;
const key = 'denia.memorial.cakes.v1';
class Storage {
  constructor(entries = []) { this.data = new Map(entries); }
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i]; }
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k,v) { if (k === this.failKey) throw Error('quota'); this.data.set(k,v); }
  removeItem(k) { this.data.delete(k); }
}
const source = new Storage([[key,'7'], ['unrelated-secret','never export']]);
const backup = core.snapshot(source, 'https://example.test');
assert.equal(backup.entries.length, 1);
assert.equal(core.parse(JSON.stringify(backup)).entries[0].value, '7');
const target = new Storage([[key,'3']]);
assert.equal(core.apply(target, core.plan(target, backup, false)), 0);
assert.equal(target.getItem(key), '3');
assert.equal(core.apply(target, core.plan(target, backup, true)), 1);
assert.equal(target.getItem(key), '7');
assert.throws(() => core.parse(JSON.stringify({...backup,entries:[{key:'other',value:'x'}]})));
assert.throws(() => core.parse(JSON.stringify({...backup,entries:[...backup.entries,...backup.entries]})));
const pet = 'denia.memorial.pet.v1';
const failing = new Storage([[key,'2']]); failing.failKey = pet;
const next = {...backup, entries:[{key,value:'9'},{key:pet,value:'{}'}]};
assert.throws(() => core.apply(failing,core.plan(failing,next,true)));
assert.equal(failing.getItem(key),'2');
const stale = core.plan(target,backup,true); target.setItem(key,'10');
// A changed no-op is never overwritten; a stale planned replacement is rejected.
const staleChange=core.plan(target,{...backup,entries:[{key,value:'11'}]},true); target.setItem(key,'12');
assert.throws(()=>core.apply(target,staleChange)); assert.equal(target.getItem(key),'12');
console.log('PASS: scoped export, exact roundtrip, conflict preservation, explicit replacement, invalid-key/duplicate rejection, rollback and stale-write protection.');
