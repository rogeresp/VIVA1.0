import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import pdf from 'pdf-parse';
import OpenAI from 'openai';
import Queue from 'bull';
import formidable from 'formidable';
import fs from 'fs';

// Disable standard Next.js body parser to allow formidable to parse multipart form data
export const config = {
  api: {
    bodyParser: false,
  },
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Initialize Bull Queue for async background imports
const importQueue = new Queue('import-queue', process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Define job processor
importQueue.process(async (job) => {
  const { userId, companyId, dataType, records } = job.data;
  const total = records.length;
  let success = 0;
  let duplicates = 0;
  let errors = 0;
  const errorsList: any[] = [];

  const table = dataType === 'Imóveis' ? 'properties' : dataType === 'Clientes' ? 'clients' : 'owners';

  // Fetch existing records for duplicate check
  const { data: existingItems } = await supabaseAdmin.from(table).select('*');
  const existing = existingItems || [];

  const toInsert: any[] = [];

  for (let i = 0; i < total; i++) {
    const item = records[i];
    
    // Duplicate check rules
    let isDuplicate = false;
    if (dataType === 'Imóveis') {
      isDuplicate = existing.some((x: any) => 
        String(x.street || '').toLowerCase() === String(item.street || '').toLowerCase() &&
        String(x.number || '').toLowerCase() === String(item.number || '').toLowerCase() &&
        String(x.neighborhood || '').toLowerCase() === String(item.neighborhood || '').toLowerCase() &&
        String(x.city || '').toLowerCase() === String(item.city || '').toLowerCase() &&
        Number(x.sale_price || 0) === Number(item.sale_price || 0)
      );
    } else if (dataType === 'Clientes') {
      if (item.email) {
        isDuplicate = existing.some((x: any) => String(x.email || '').toLowerCase() === String(item.email).toLowerCase());
      }
    } else if (dataType === 'Proprietários') {
      if (item.email || item.phone || item.whatsapp) {
        isDuplicate = existing.some((x: any) => 
          (item.email && String(x.email || '').toLowerCase() === String(item.email).toLowerCase()) ||
          (item.phone && String(x.phone || '').replace(/[^\d]/g, '') === String(item.phone).replace(/[^\d]/g, '')) ||
          (item.whatsapp && String(x.whatsapp || '').replace(/[^\d]/g, '') === String(item.whatsapp).replace(/[^\d]/g, ''))
        );
      }
    }

    if (isDuplicate) {
      duplicates++;
      continue;
    }

    // Set defaults and codes
    if (dataType === 'Imóveis') {
      item.code = `IMV-${(Date.now() + i).toString(36).toUpperCase()}`;
      if (!item.status) item.status = 'disponivel';
      if (!item.visibility) item.visibility = 'privado';
    } else if (dataType === 'Clientes') {
      if (!item.funil) item.funil = 'frio';
    }

    // Inject tenant info
    item.user_id = userId;
    if (companyId) {
      item.company_id = companyId;
    }

    toInsert.push(item);
  }

  // Insert records in chunks
  if (toInsert.length > 0) {
    const chunkSize = 200;
    for (let offset = 0; offset < toInsert.length; offset += chunkSize) {
      const chunk = toInsert.slice(offset, offset + chunkSize);
      const { error } = await supabaseAdmin.from(table).insert(chunk);
      if (error) {
        errors += chunk.length;
        errorsList.push({
          row: `Chunk ${offset / chunkSize + 1}`,
          message: error.message,
        });
      } else {
        success += chunk.length;
      }
      // Update job progress
      job.progress(Math.round(((offset + chunk.length) / toInsert.length) * 100));
    }
  }

  return {
    success,
    duplicates,
    errors,
    errorsList,
  };
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Método não suportado' });
  }

  // 1. Authentication (JWT token verification)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso negado: Token ausente ou inválido' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }

  // Retrieve company_id for tenant segregation if exists
  const { data: profile } = await supabaseAdmin.from('profiles').select('company_id').eq('id', user.id).single() as any;
  const companyId = profile?.company_id || null;

  // 2. Parse Multipart File Upload
  const form = formidable({ maxFileSize: 50 * 1024 * 1024 }); // Limit: 50MB
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: 'Falha ao carregar arquivo. Tamanho máximo: 50MB.' });
    }

    const dataType = Array.isArray(fields.dataType) ? fields.dataType[0] : fields.dataType;
    const fileField = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!fileField || !dataType) {
      return res.status(400).json({ error: 'Arquivo ou tipo de dado não fornecido.' });
    }

    const filePath = fileField.filepath;
    const fileName = fileField.originalFilename?.toLowerCase() || '';
    const isPDF = fileName.endsWith('.pdf');
    const isExcelOrCsv = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv');

    if (!isPDF && !isExcelOrCsv) {
      return res.status(400).json({ error: 'Formato inválido. Aceitos: PDF, Excel, CSV.' });
    }

    try {
      let records: any[] = [];

      // A. CSV / Excel Parsing
      if (isExcelOrCsv) {
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet);
        
        if (rawJson.length > 10000) {
          return res.status(400).json({ error: 'Arquivo excede o limite de 10.000 registros.' });
        }

        // Apply custom mappings if supplied, otherwise auto-map
        const userMapping = fields.mapping ? JSON.parse(Array.isArray(fields.mapping) ? fields.mapping[0] : fields.mapping) : null;
        
        records = rawJson.map(row => {
          const mapped: any = {};
          if (userMapping) {
            Object.keys(userMapping).forEach(dbField => {
              const fileCol = userMapping[dbField];
              if (fileCol && row[fileCol] !== undefined) {
                mapped[dbField] = row[fileCol];
              }
            });
          } else {
            // Default mapping mapping columns as keys
            Object.assign(mapped, row);
          }
          return mapped;
        });
      } 
      
      // B. PDF Parsing via OpenAI
      else if (isPDF) {
        const fileBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(fileBuffer);
        const text = pdfData.text.slice(0, 15000); // safety cap

        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Você é um assistente especializado em extrair dados imobiliários de textos não estruturados (PDFs, tabelas, descrições).
Retorne APENAS um JSON válido com a seguinte estrutura:

{
  "imoveis": [
    {
      "tipo": "casa|apartamento|terreno|comercial",
      "endereco": "string",
      "cidade": "string",
      "estado": "string",
      "area_m2": number,
      "quartos": number,
      "suites": number,
      "vagas": number,
      "preco": number,
      "descricao": "string",
      "proprietario_nome": "string",
      "proprietario_telefone": "string",
      "proprietario_email": "string"
    }
  ],
  "clientes": [],
  "proprietarios": []
}

Se não encontrar um campo, use null. Se o texto não tiver dados imobiliários, retorne {"erro": "sem dados"}`
            },
            {
              role: 'user',
              content: text,
            }
          ]
        });

        const gptResponse = JSON.parse(chatCompletion.choices[0].message.content || '{}');
        
        if (gptResponse.erro) {
          return res.status(400).json({ error: `IA não detectou dados válidos no PDF: ${gptResponse.erro}` });
        }

        // Format PDF results based on chosen data type
        if (dataType === 'Imóveis') {
          records = gptResponse.imoveis || [];
        } else if (dataType === 'Clientes') {
          records = gptResponse.clientes || [];
        } else {
          records = gptResponse.proprietarios || [];
        }
      }

      // Check record length limit
      if (records.length === 0) {
        return res.status(400).json({ error: 'Nenhum registro válido encontrado para importação.' });
      }

      // 3. Dispatch to Bull Queue for Async Processing
      const job = await importQueue.add({
        userId: user.id,
        companyId,
        dataType,
        records,
      });

      return res.status(202).json({
        message: 'Importação iniciada em segundo plano. Você será notificado ao final.',
        jobId: job.id,
        totalRecords: records.length,
      });

    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Erro interno ao processar a importação.' });
    } finally {
      // Cleanup uploaded temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });
}
