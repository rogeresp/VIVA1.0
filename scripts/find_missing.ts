import * as fs from 'fs';
const cache: [string,string][] = JSON.parse(fs.readFileSync('D:/USER/Downloads/project-bolt-github-rzwmpwpp/KENIXXXXX/data/listing_cache.json','utf-8'));
const j: any[] = JSON.parse(fs.readFileSync('D:/USER/Downloads/project-bolt-github-rzwmpwpp/KENIXXXXX/data/imoveis_exportados.json','utf-8'));
const refs = new Set(j.map(i => i.referencia));
const missing = cache.filter(([id,ref]) => !refs.has(ref));
console.log('Faltam:', missing.length);
console.log(JSON.stringify(missing));
