export interface AIExtractedProperty {
  id: string;
  tipo: string;
  dormitorios: number;
  suites: number;
  area: number;
  endereco: string;
  numeroApt: string;
  bairro: string;
  cidade: string;
  valor: number;
  proprietario: string;
  telefone: string;
  building_name: string;
}

const FIELD_LABELS = [
  'id do imóvel',
  'tipo de imóvel',
  'dormitórios e suítes',
  'área do imóvel',
  'endereço',
  'bairro',
  'cidade',
  'edifício ou condomínio',
  'quadra e lote',
  'valor do imóvel',
  'proprietário',
  'telefone',
  'chaves ou observações',
  'código',
] as const;

function normalize(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9áéíóúàâêôãõç\s/]/g, '').trim();
}

async function classifyLine(
  classifier: any,
  line: string,
  candidates: readonly string[]
): Promise<{ label: string; score: number }> {
  if (!line.trim() || line.trim().length < 2) {
    return { label: 'ignorar', score: 0 };
  }
  try {
    const result = await classifier(line, candidates);
    return result[0];
  } catch {
    return { label: 'ignorar', score: 0 };
  }
}

function extractNumber(text: string): number {
  const m = text.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function parseValue(text: string): number {
  const m = text.match(/([\d.]+,\d{2})/);
  if (m) {
    return Number(m[1].replace(/\./g, '').replace(',', '.'));
  }
  return 0;
}

export async function parsePDFBlockWithAI(
  blocks: string[][],
  classifier: any
): Promise<AIExtractedProperty[]> {
  const results: AIExtractedProperty[] = [];
  const usedCandidates = [...FIELD_LABELS];

  for (const block of blocks) {
    if (block.length < 2) continue;

    const prop: AIExtractedProperty = {
      id: '',
      tipo: 'apartamento',
      dormitorios: 0,
      suites: 0,
      area: 0,
      endereco: '',
      numeroApt: '',
      bairro: '',
      cidade: '',
      valor: 0,
      proprietario: '',
      telefone: '',
      building_name: '',
    };

    // Classify each line in the block
    const classifications: { line: string; label: string; score: number }[] = [];

    for (const line of block) {
      const result = await classifyLine(classifier, line, usedCandidates);
      classifications.push({ line, label: result.label, score: result.score });
    }

    // Assemble fields from classifications
    for (const c of classifications) {
      const { line, label } = c;

      if (label === 'id do imóvel' || label === 'código') {
        const idMatch = line.match(/(\d{4,6})/);
        if (idMatch) prop.id = idMatch[1];
      }

      if (label === 'tipo de imóvel') {
        const lower = line.toLowerCase();
        if (lower.includes('casa')) prop.tipo = 'casa';
        else if (lower.includes('terreno')) prop.tipo = 'terreno';
        else if (lower.includes('sala') || lower.includes('comercial')) prop.tipo = 'sala_comercial';
        else if (lower.includes('loja')) prop.tipo = 'loja';
        else if (lower.includes('cobertura')) prop.tipo = 'cobertura';
        else if (lower.includes('sitio') || lower.includes('sítio')) prop.tipo = 'sitio';
        else prop.tipo = 'apartamento';
      }

      if (label === 'dormitórios e suítes') {
        const nums = line.match(/\d+/g);
        if (nums) {
          prop.dormitorios = nums.length >= 1 ? parseInt(nums[0]) : 0;
          prop.suites = nums.length >= 2 ? parseInt(nums[1]) : 0;
        }
      }

      if (label === 'área do imóvel') {
        const areaMatch = line.match(/(\d{3,5})\s*\/\s*(\d{3,5})/);
        if (areaMatch) {
          prop.area = parseInt(areaMatch[2]);
        } else {
          prop.area = extractNumber(line);
        }
      }

      if (label === 'endereço') {
        const addr = line.replace(/\s*\[V\]/, '').trim();
        const numMatch = addr.match(/^(.*?),\s*(\d+)\s*\/\s*(\d+)$/);
        if (numMatch) {
          prop.endereco = `${numMatch[1]}, ${numMatch[2]}`;
          prop.numeroApt = numMatch[3];
        } else {
          const numMatch2 = addr.match(/^(.*?),\s*(\d+)$/);
          if (numMatch2) {
            prop.endereco = addr;
          } else {
            prop.endereco = addr;
          }
        }
      }

      if (label === 'bairro') {
        const parts = line.split(' - ');
        if (parts.length > 1) {
          prop.bairro = parts[0].trim();
        } else {
          prop.bairro = line.trim();
        }
      }

      if (label === 'cidade') {
        const parts = line.split(' - ');
        if (parts.length > 1) {
          prop.cidade = parts[parts.length - 1].trim();
        } else {
          prop.cidade = line.trim();
        }
      }

      if (label === 'edifício ou condomínio') {
        const cand = line.trim();
        if (cand.length > 2 && cand.length < 60 && !/^\d/.test(cand)) {
          prop.building_name = cand;
        }
      }

      if (label === 'valor do imóvel') {
        prop.valor = parseValue(line);
      }

      if (label === 'proprietário') {
        const parts = line.split(' - ');
        prop.proprietario = parts[0].replace(/\[V\]/g, '').trim();
      }

      if (label === 'telefone') {
        const phoneMatch = line.match(/\(\d{2}\)\s*\d{4,5}-?\d{4}/);
        if (phoneMatch) prop.telefone = phoneMatch[0];
      }
    }

    // Skip if no id found
    if (!prop.id) {
      // Try to find ID from first line
      const idMatch = block[0].match(/^(\d{4,6})/);
      if (idMatch) prop.id = idMatch[1];
      else continue;
    }

    // Try to get neighborhood/city from lines classified as bairro/cidade
    for (const c of classifications) {
      if (c.label === 'bairro' && / - /.test(c.line)) {
        const parts = c.line.split(' - ');
        if (!prop.bairro) prop.bairro = parts[0].trim();
        if (parts.length > 1 && !prop.cidade) {
          const cityPart = parts.slice(1).join(' - ').trim();
          if (cityPart.includes('Capão') || cityPart.includes('Xangri') || cityPart.includes('Imbé') || cityPart.includes('Tramandaí') || cityPart.includes('Torres') || cityPart.includes('Atlântida')) {
            prop.cidade = cityPart;
          } else {
            prop.cidade = cityPart;
          }
        }
      }
    }

    results.push(prop);
  }

  return results;
}

export async function classifyLineWithAI(
  classifier: any,
  text: string
): Promise<{ line: string; label: string; score: number }> {
  const result = await classifyLine(classifier, text, FIELD_LABELS);
  return { line: text, label: result.label, score: result.score };
}

export { FIELD_LABELS };
