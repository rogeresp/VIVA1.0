export interface ParsedProperty {
  id: number;
  tipo: string;
  descricao: string;
  valor: number;
  endereco: string;
  numeroApt: string;
  bairro: string;
  cidade: string;
  area: number;
  dormitorios: number;
  suites: number;
  proprietario: string;
  telefone: string;
  building_name: string;
}

const TIPOS = ['Apartamento', 'Casa', 'Terreno', 'Sala Comercial', 'Outros'] as const;
const RE_PHONE = /\(\d{2}\)\s*\d{4,5}-?\d{4}/;
const RE_VALUE_BR = /(?:\[V\]|R\$\s?)\s*([\d.]+,\d{2})/i;
const RE_AREA = /(\d{3,5})\s*\/\s*(\d{3,5})/;

function parseBRL(v: string): number {
  return Number(v.replace(/\./g, '').replace(',', '.'));
}

function extractEnderecoNumero(text: string): { endereco: string; numeroApt: string } {
  const m = text.match(/^(.+?),\s*(\d+)\s*\/\s*(\d+)$/);
  if (m) return { endereco: `${m[1]}, ${m[2]}`, numeroApt: m[3] };
  const m2 = text.match(/^(.+?),\s*(\d+)$/);
  if (m2) return { endereco: text, numeroApt: '' };
  return { endereco: text, numeroApt: '' };
}

function parseMultiLineBlock(lines: string[]): ParsedProperty | null {
  const text0 = lines[0];
  const idMatch = text0.match(/^(\d{4,6})/);
  if (!idMatch) return null;
  const id = parseInt(idMatch[1]);

  let tipo = 'apartamento';
  for (const t of TIPOS) {
    if (text0.includes(t)) { tipo = t.toLowerCase(); break; }
  }

  let dormitorios = 0, suites = 0;
  const dormLine = lines.find(l => /Dormit/i.test(l));
  if (dormLine) {
    const nums = dormLine.match(/\d+/g);
    if (nums) {
      dormitorios = parseInt(nums[0]) || 0;
      suites = parseInt(nums[1]) || 0;
    }
  }

  let area = 0;
  for (const l of lines) {
    const m = l.match(RE_AREA);
    if (m && !/Dormit/i.test(l)) {
      area = parseFloat(m[2].replace(',', '.'));
      break;
    }
  }

  let proprietario = '', telefone = '';
  for (const l of lines) {
    const pm = l.match(RE_PHONE);
    if (pm) { telefone = pm[0]; break; }
  }
  for (let i = 0; i < lines.length; i++) {
    const pm = lines[i].match(RE_PHONE);
    if (pm) {
      for (let j = i; j >= Math.max(0, i - 3); j--) {
        const cand = lines[j].replace(RE_PHONE, '').replace(/\[V\]/g, '').trim();
        if (cand && !RE_VALUE_BR.test(cand) && !/Quadra|Lote|Dormit|Chaves|^\d/.test(cand) && /[A-Za-zÀ-ú]/.test(cand) && cand.length < 60) {
          proprietario = cand.split('|').pop()!.trim();
          break;
        }
      }
      break;
    }
  }

  let building_name = '';
  const dormIdx = lines.findIndex(l => /Dormit/i.test(l));
  if (dormIdx >= 0 && dormIdx + 1 < lines.length) {
    const cand = lines[dormIdx + 1].trim();
    if (cand.length > 2 && cand.length < 60 && !/^\d/.test(cand) && !RE_PHONE.test(cand) && !RE_VALUE_BR.test(cand) && !/Quadra|Lote|Rua|Av\.|Avenida|Chaves|\[V\]|Dormit/i.test(cand) && /[A-Za-zÀ-ú]/.test(cand)) {
      building_name = cand;
    }
  }

  let valor = 0;
  for (const l of lines) {
    const vm = l.match(RE_VALUE_BR);
    if (vm) { valor = parseBRL(vm[1]); break; }
  }
  if (!valor) {
    const nums: number[] = [];
    for (const l of lines) {
      const vm = l.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
      if (vm) for (const v of vm) nums.push(parseBRL(v));
    }
    valor = nums[0] || 0;
  }

  let endereco = '', numeroApt = '';
  let bairro = '', cidade = '';

  const addrLines: string[] = [];
  for (const l of lines) {
    const clean = l.trim();
    if (!clean || /Dormit|Quadra:|Lote:|Chaves:|\[V\]/.test(clean)) continue;
    if (RE_PHONE.test(clean) || RE_VALUE_BR.test(clean)) continue;
    if (building_name && clean === building_name) continue;
    if (proprietario && clean.includes(proprietario)) continue;
    if (/^\d{3,5}\s*\/\s*\d{3,5}$/.test(clean)) continue;
    if (/^\d{4,6}$/.test(clean)) continue;
    addrLines.push(clean);
  }

  for (let i = addrLines.length - 1; i >= 0; i--) {
    if (/ - /.test(addrLines[i])) {
      const parts = addrLines[i].split(' - ');
      if (building_name && parts[0].trim().toLowerCase() === building_name.toLowerCase()) {
        cidade = parts.slice(1).join(' - ').trim();
      } else {
        bairro = parts[0].trim();
        cidade = parts.slice(1).join(' - ').trim();
      }
      addrLines.splice(i);
      break;
    }
  }

  const fullAddr = addrLines.join(' ').trim();
  if (fullAddr) {
    const parsed = extractEnderecoNumero(fullAddr);
    endereco = parsed.endereco;
    numeroApt = parsed.numeroApt;
  }

  return {
    id, tipo: tipo.replace(/ /g, '_'),
    descricao: lines.join(' | '),
    valor, endereco, numeroApt, bairro, cidade, area,
    dormitorios, suites, proprietario, telefone, building_name,
  };
}

function parseSingleLineBlock(text: string): ParsedProperty | null {
  if (!text.trim()) return null;

  const idMatch = text.match(/^(\d{4,6})/);
  if (!idMatch) return null;
  const id = parseInt(idMatch[1]);

  let tipo = 'apartamento';
  for (const t of TIPOS) {
    if (text.includes(t)) { tipo = t.toLowerCase(); break; }
  }

  let area = 0, dormitorios = 0, suites = 0;
  const dormMatch = text.match(/Dormit[óo]rio\(s\):\s*(\d+)/i);
  if (dormMatch) {
    let numStr = dormMatch[1];
    const areaMatch = numStr.match(RE_AREA);
    if (areaMatch) {
      area = parseFloat(areaMatch[2].replace(',', '.'));
      numStr = numStr.substring(0, numStr.indexOf(areaMatch[1]));
    } else {
      const laterArea = text.match(RE_AREA);
      if (laterArea) {
        area = parseFloat(laterArea[2].replace(',', '.'));
        const between = text.substring(dormMatch.index! + dormMatch[0].length, laterArea.index!);
        const extracted = between.match(/\d+/);
        if (extracted) numStr = extracted[0];
      }
    }
    numStr = numStr.replace(/\D/g, '');
    if (numStr.length >= 4) {
      dormitorios = parseInt(numStr.substring(0, 2)) || 0;
      suites = parseInt(numStr.substring(2, 4)) || 0;
    } else if (numStr.length > 0) {
      dormitorios = parseInt(numStr) || 0;
    }
  }

  const phoneMatch = text.match(RE_PHONE);
  const telefone = phoneMatch ? phoneMatch[0] : '';

  let proprietario = '';
  if (phoneMatch) {
    const valIdx = text.search(RE_VALUE_BR);
    const afterValue = valIdx >= 0 ? text.substring(valIdx) : text;
    const phoneIdx = afterValue.search(RE_PHONE);
    if (phoneIdx > 0) {
      const candidate = afterValue.substring(0, phoneIdx)
        .replace(RE_VALUE_BR, '').replace(/\[V\]/g, '').replace(/\s*\|\s*/g, ' ').trim();
      if (candidate) {
        proprietario = candidate.split('|').pop()!.split(' - ')[0].trim();
      }
    }
  }

  const valueMatch = text.match(RE_VALUE_BR);
  const valor = valueMatch ? parseBRL(valueMatch[1]) : (() => {
    const nums = text.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
    return nums ? parseBRL(nums[0]) : 0;
  })();

  let bairro = '', cidade = '';
  const nhoodMatch = text.match(/([A-Za-zÀ-ú][\w\s]+?)\s*-\s*([A-Za-zÀ-ú][\w\s]+?)(?=\s*(?:\[V\]|R\s*\$|[\d.]{6,}))/);
  if (nhoodMatch) {
    bairro = nhoodMatch[1].trim();
    cidade = nhoodMatch[2].trim();
  }

  let endereco = '', numeroApt = '';
  const addrPattern = /((?:Rua|Av\.?|Avenida|Estrada|Alameda|Travessa|Praça)\s[\wÀ-ú\s]+?,\s*\d+(?:\s*\/\s*\d+)?)/i;
  const addrMatch = text.match(addrPattern);
  if (addrMatch) {
    const parsed = extractEnderecoNumero(addrMatch[1].trim());
    endereco = parsed.endereco;
    numeroApt = parsed.numeroApt;
  } else {
    const genericAddr = text.match(/([A-ZÀ-Ú][a-zÀ-ú]+[\s\w]*?,\s*\d+(?:\s*\/\s*\d+)?)(?=\s+(?:Quadra|Lote|[A-Z][a-z]+\s*-\s*[A-Z]))/);
    if (genericAddr) {
      const parsed = extractEnderecoNumero(genericAddr[1].trim());
      endereco = parsed.endereco;
      numeroApt = parsed.numeroApt;
    }
  }

  let building_name = '';
  const afterDorm = dormMatch ? text.substring(dormMatch.index! + dormMatch[0].length) : text;
  const bldMatch = afterDorm.match(/^\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s.'\-]{2,40}?)(?=\s+(?:Rua|Av\.|Avenida|Quadra|Lote|Centro|Capão|Zona|\[V\]))/);
  if (bldMatch) {
    const cand = bldMatch[1].trim();
    if (!/^\d/.test(cand) && !RE_PHONE.test(cand) && !RE_VALUE_BR.test(cand)) {
      building_name = cand;
    }
  }

  return {
    id, tipo, descricao: text,
    valor, endereco, numeroApt, bairro, cidade, area,
    dormitorios, suites, proprietario, telefone, building_name,
  };
}

export function parseBrokerPDF(text: string): ParsedProperty[] {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of rawLines) {
    if (/^\d{4,6}\s+(Apartamento|Casa|Terreno|Sala Comercial|Outros)/i.test(line)) {
      if (current.length > 0) blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  const results: ParsedProperty[] = [];

  for (const block of blocks) {
    if (block.length === 0) continue;

    const joined = block.join(' ');
    const oneLine = block.length === 1;

    const isSingle = oneLine && (
      /\[V\]/.test(block[0]) ||
      /Dormit/i.test(block[0]) ||
      block[0].split(/\s+/).length > 6
    );

    const p = isSingle ? parseSingleLineBlock(block[0]) : parseMultiLineBlock(block);
    if (p) results.push(p);
  }

  return results;
}
