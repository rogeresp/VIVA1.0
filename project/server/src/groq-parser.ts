import 'dotenv/config';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

const SYSTEM_PROMPT = `Você é um extrator de dados de imóveis de PDFs do sistema Broker Gestor Imobiliário.

O usuário vai fornecer:
1. INSTRUÇÕES: como o PDF está formatado (ex: "primeiro número é o ID, depois Apartamento, depois endereço...")
2. TEXTO: o texto extraído do PDF (um ou mais imóveis)

Regras:
- Extraia TODOS os imóveis do texto
- Para cada imóvel, retorne um objeto JSON com estes campos:
  - "id" (number): identificador único do imóvel (sempre o primeiro número)
  - "tipo" (string): tipo do imóvel (apartamento, casa, terreno, sala_comercial, loja, cobertura, sitio, predio, outros)
  - "descricao" (string): texto completo descritivo do imóvel
  - "valor" (number): preço em reais (apenas o número, sem R$)
  - "endereco" (string): rua e número
  - "numeroApt" (string): número do apartamento (se houver "/ 1202" ou similar)
  - "bairro" (string): bairro
  - "cidade" (string): cidade
  - "area" (number): área privativa em m²
  - "dormitorios" (number): quantidade de quartos
  - "suites" (number): quantidade de suítes
  - "proprietario" (string): nome do proprietário
  - "telefone" (string): telefone do proprietário no formato (XX) XXXXX-XXXX
  - "building_name" (string): nome do edifício/condomínio (se houver)

- Se um campo não existir, use null ou 0 para números, "" para strings
- Valores em moeda: converta "1.300.000,00" para 1300000.00
- Retorne APENAS um array JSON válido, sem markdown, sem texto extra
- Exemplo: [{"id": 13179, "tipo": "apartamento", "valor": 1300000, ...}]`;

export async function parsePDFWithGroq(
  text: string,
  userInstructions: string
): Promise<any[]> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada');
  }

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `INSTRUÇÕES DO USUÁRIO:\n${userInstructions}\n\n---\n\nTEXTO DO PDF:\n${text}` },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Resposta vazia da Groq');
  }

  // Try to parse the response - it might be wrapped in various ways
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // Try to find array in the text
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0]);
      } else {
        throw new Error(`Formato inválido da Groq: ${content.slice(0, 200)}`);
      }
    }
  }

  // The response might be { properties: [...] } or just [...]
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed.properties && Array.isArray(parsed.properties)) {
    return parsed.properties;
  }
  if (parsed.imoveis && Array.isArray(parsed.imoveis)) {
    return parsed.imoveis;
  }
  if (parsed.data && Array.isArray(parsed.data)) {
    return parsed.data;
  }

  throw new Error(`Formato inesperado: ${JSON.stringify(parsed).slice(0, 200)}`);
}
