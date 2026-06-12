import * as fs from 'fs';
const cp = JSON.parse(fs.readFileSync('D:\\USER\\Downloads\\project-bolt-github-rzwmpwpp\\KENIXXXXX\\data\\checkpoint_correcao.json','utf-8'));
const cache = JSON.parse(fs.readFileSync('D:\\USER\\Downloads\\project-bolt-github-rzwmpwpp\\KENIXXXXX\\data\\listing_cache.json','utf-8'));
const cacheMap = new Map(cache);
const j = JSON.parse(fs.readFileSync('D:\\USER\\Downloads\\project-bolt-github-rzwmpwpp\\KENIXXXXX\\data\\imoveis_exportados.json','utf-8'));
const jsonRefs = new Set(j.map(i => i.referencia));
let inCache = 0, notInCache = 0, inJson = 0;
for (const ref of cp.pendentes) {
  if (cacheMap.has(ref)) inCache++; else notInCache++;
  if (jsonRefs.has(ref)) inJson++;
}
console.log('Pendentes:', cp.pendentes.length);
console.log('In cache:', inCache);
console.log('NOT in cache:', notInCache);
console.log('Already in JSON:', inJson);
const realMissing = cp.pendentes.filter(ref => cacheMap.has(ref) && !jsonRefs.has(ref));
console.log('Real pendentes to process:', realMissing.length);
if (realMissing.length > 0) console.log('Sample:', realMissing.slice(0,5));
