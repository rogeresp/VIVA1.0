const FIELD_DESCRIPTIONS = [
  'nome do proprietário',
  'telefone do proprietário',
  'email do proprietário',
  'tipo de imóvel (apartamento, casa, terreno, sala comercial)',
  'categoria (venda, temporada, permuta)',
  'preço de venda',

  'cidade',
  'bairro',
  'rua / logradouro',
  'número do imóvel',
  'complemento',
  'área privativa em metros quadrados',
  'quantidade de quartos / dormitórios',
  'quantidade de suítes',
  'quantidade de vagas de garagem',
  'descrição do imóvel',
  'nome do edifício ou condomínio',
  'nome do cliente',
  'orçamento do cliente',
  'observações / notas',
];

let classifier: any = null;

async function getClassifier() {
  if (!classifier) {
    const { pipeline } = await import('@xenova/transformers');
    classifier = await pipeline('zero-shot-classification', 'Xenova/all-MiniLM-L6-v2');
  }
  return classifier;
}

export async function classifyText(text: string): Promise<string> {
  const clf = await getClassifier();
  const result = await clf(text, FIELD_DESCRIPTIONS);
  return result.labels[0];
}

export async function classifyColumnHeaders(headers: string[]): Promise<Record<string, string>> {
  const clf = await getClassifier();
  const mapping: Record<string, string> = {};

  const batchSize = 5;
  for (let i = 0; i < headers.length; i += batchSize) {
    const batch = headers.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (h) => {
        const result = await clf(h, FIELD_DESCRIPTIONS);
        return { header: h, label: result.labels[0] };
      })
    );
    for (const r of results) {
      const fieldKey = mapLabelToFieldKey(r.label);
      if (fieldKey) {
        mapping[fieldKey] = r.header;
      }
    }
  }

  return mapping;
}

function mapLabelToFieldKey(label: string): string | null {
  const map: Record<string, string> = {
    'nome do proprietário': 'owner_name',
    'telefone do proprietário': 'owner_phone',
    'email do proprietário': 'owner_email',
    'tipo de imóvel (apartamento, casa, terreno, sala comercial)': 'property_type',
    'categoria (venda, temporada, permuta)': 'category',
    'preço de venda': 'sale_price',
    'cidade': 'city',
    'bairro': 'neighborhood',
    'rua / logradouro': 'street',
    'número do imóvel': 'number',
    'complemento': 'complement',
    'área privativa em metros quadrados': 'private_area',
    'quantidade de quartos / dormitórios': 'bedrooms',
    'quantidade de suítes': 'suites',
    'quantidade de vagas de garagem': 'garages',
    'descrição do imóvel': 'description',
    'nome do edifício ou condomínio': 'building_name',
    'nome do cliente': 'name',
    'orçamento do cliente': 'budget_max',
    'observações / notas': 'notes',
  };
  return map[label] || null;
}

export async function extractFromText(text: string, fields: string[]): Promise<Record<string, string>> {
  const lines = text.split('\n').filter(l => l.trim());
  const result: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const clf = await getClassifier();
    const classification = await clf(trimmed, FIELD_DESCRIPTIONS);
    const topLabel = classification.labels[0];
    const topScore = classification.scores[0];

    if (topScore > 0.3) {
      const fieldKey = mapLabelToFieldKey(topLabel);
      if (fieldKey && fields.includes(fieldKey) && !result[fieldKey]) {
        result[fieldKey] = trimmed;
      }
    }
  }

  return result;
}
