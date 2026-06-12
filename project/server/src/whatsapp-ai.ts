import 'dotenv/config';
import Groq from 'groq-sdk';
import { prisma } from './db.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

const SYSTEM_PROMPT = `Você é um corretor de imóveis brasileiro conversando com um proprietário no WhatsApp.

Seu papel:
- Seja natural e amigável, como se fosse uma pessoa real conversando
- Responda de forma direta e objetiva
- Se o proprietário confirmar que o imóvel ainda está disponível, pergunte se ele tem outros imóveis no litoral para vender
- Se o proprietário disser que vendeu, alugou ou mudou o valor, registre a atualização
- Se o proprietário mencionar alterações no imóvel (status, preço), extraia esses dados

Formato de resposta:
{
  "reply": "sua resposta natural aqui",
  "propertyUpdate": { "status": "vendido" } | null
}

Regras:
- "reply" é a mensagem que será enviada de volta ao proprietário no WhatsApp
- "propertyUpdate" só deve ser preenchido se o proprietário MENCIONOU explicitamente alguma mudança no imóvel (vendeu, alugou, mudou preço, retirou do mercado, etc.)
- Se não houver atualização, "propertyUpdate" deve ser null
- Não invente informações que o proprietário não disse
- Se perguntar sobre outros imóveis, seja sutil e natural, não pareça vendido
- Responda sempre em português brasileiro

Exemplos:
Proprietário: "ainta ta disponivel sim"
→ {"reply": "Que bom que ainda está disponível! Só por curiosidade, você tem outros imóveis no litoral que também esteja pensando em vender?", "propertyUpdate": null}

Proprietário: "vendi o imovel semana passada"
→ {"reply": "Ah que ótimo, parabéns pela venda! Se tiver outros imóveis no litoral pensando em vender, pode me chamar.", "propertyUpdate": {"status": "vendido"}}

Proprietário: "ainda ta disponivel, valor 350 mil agora"
→ {"reply": "Anotei aqui o novo valor. E me conta, você tem outros imóveis no litoral que também queira vender?", "propertyUpdate": {"salePrice": 350000}}

Proprietário: "nao quero mais vender"
→ {"reply": "Sem problemas, cancelei aqui. Se mudar de ideia ou tiver outros imóveis no litoral, é só falar!", "propertyUpdate": {"status": "indisponivel"}}

Proprietário: "quanto ta avaliado esse imovel?"
→ {"reply": "No momento ele está anunciado por R$ 320.000. Se tiver interesse em vender ou tiver outros imóveis no litoral, posso te ajudar.", "propertyUpdate": null}

Proprietário: "nao tenho interesse"
→ {"reply": "Tudo bem, muito obrigado pela atenção. Se um dia quiser vender ou tiver outros imóveis no litoral, estou à disposição!", "propertyUpdate": null}`;

interface AiConversationResult {
  reply: string;
  propertyUpdate: Record<string, any> | null;
}

async function processConversation(text: string, propertyInfo: string): Promise<AiConversationResult> {
  if (!process.env.GROQ_API_KEY) {
    return { reply: 'GROQ_API_KEY não configurada', propertyUpdate: null };
  }

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `DADOS DO IMÓVEL:\n${propertyInfo}\n\n---\n\nRESPOSTA DO PROPRIETÁRIO:\n${text}` },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { reply: '', propertyUpdate: null };
    }

    return {
      reply: parsed.reply || '',
      propertyUpdate: parsed.propertyUpdate || null,
    };
  } catch (err: any) {
    return { reply: '', propertyUpdate: null };
  }
}

export async function handleIncomingMessage(from: string, text: string): Promise<string | null> {
  const phone = from.replace('@s.whatsapp.net', '').replace(/\D/g, '');

  // Find owner by phone
  const owner = await prisma.owner.findFirst({
    where: { OR: [{ phone }, { whatsapp: phone }] },
    include: { properties: { include: { building: true } } },
  });

  if (owner && owner.properties.length > 0) {
    // Process conversation for the first property
    const property = owner.properties[0];
    const propInfo = [
      `Código: ${property.code}`,
      `Tipo: ${property.propertyType}`,
      `Status: ${property.status}`,
      `Preço venda: ${property.salePrice ?? 'não definido'}`,
      `Preço aluguel: ${property.rentPrice ?? 'não definido'}`,
      `Cidade: ${property.city ?? ''}`,
      `Bairro: ${property.neighborhood ?? ''}`,
      `Edifício: ${property.building?.name ?? ''}`,
      `Unidade: ${property.complement ?? property.unit ?? ''}`,
      `Proprietário: ${owner.name}`,
    ].join('\n');

    const result = await processConversation(text, propInfo);

    // Log the received message
    await prisma.whatsAppMessage.create({
      data: {
        userId: property.userId,
        to: phone,
        content: text,
        status: 'received',
        trigger: 'owner_reply',
        referenceId: property.id,
      },
    });

    // Apply property updates if any
    if (result.propertyUpdate) {
      for (const prop of owner.properties) {
        await prisma.property.update({
          where: { id: prop.id },
          data: result.propertyUpdate,
        });
      }
    }

    return result.reply || null;
  }

  // Check if it's a client
  const client = await prisma.client.findFirst({
    where: { OR: [{ phone }, { whatsapp: phone }] },
  });

  if (client) {
    await prisma.whatsAppMessage.create({
      data: {
        userId: client.userId,
        to: phone,
        content: text,
        status: 'received',
        trigger: 'client_reply',
        referenceId: client.id,
      },
    });
  }

  return null;
}
