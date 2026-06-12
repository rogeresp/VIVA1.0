import * as fs from 'fs';
const cp = JSON.parse(fs.readFileSync('D:/USER/Downloads/project-bolt-github-rzwmpwpp/KENIXXXXX/data/checkpoint_correcao.json','utf-8'));
const j = JSON.parse(fs.readFileSync('D:/USER/Downloads/project-bolt-github-rzwmpwpp/KENIXXXXX/data/imoveis_exportados.json','utf-8'));
const refs = new Set(j.map(i => i.referencia));
const lost = cp.concluidos.filter((r:string) => !refs.has(r));
console.log('Lost in checkpoint (concluidos but not in JSON):', lost);
if (lost.length > 0) {
  cp.pendentes = [...new Set([...cp.pendentes, ...lost])];
  cp.concluidos = cp.concluidos.filter((r:string) => !lost.includes(r));
  fs.writeFileSync('D:/USER/Downloads/project-bolt-github-rzwmpwpp/KENIXXXXX/data/checkpoint_correcao.json', JSON.stringify(cp));
  console.log('Fixed. Pendentes:', cp.pendentes.length, 'Concluidos:', cp.concluidos.length);
}
