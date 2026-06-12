import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, FileSpreadsheet, FileText, Check, AlertTriangle, RefreshCw, Eye, Download, Trash2, Sparkles, Building, Phone, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { extractTextLines, parsePropertiesFromLines, type ParsedProperty } from '../lib/pdf-parser';
import { BRL } from '../lib/constants';
import { uploadPDF, confirmImport as confirmBackend, AIFallbackError, batchImportProperties, fetchBuildings } from '../lib/api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const propertyFields = [
  { key: 'owner_name', label: 'Proprietário (Nome)', required: false },
  { key: 'owner_phone', label: 'Proprietário (Telefone)', required: false },
  { key: 'owner_email', label: 'Proprietário (Email)', required: false },
  { key: 'building_name', label: 'Edifício / Condomínio', required: false },
  { key: 'property_type', label: 'Tipo do Imóvel', required: true },
  { key: 'category', label: 'Categoria (venda / temporada / permuta)', required: true },
  { key: 'sale_price', label: 'Preço de Venda' },
  { key: 'city', label: 'Cidade' },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'street', label: 'Rua' },
  { key: 'number', label: 'Número' },
  { key: 'private_area', label: 'Área Privativa (m²)' },
  { key: 'bedrooms', label: 'Quartos' },
  { key: 'suites', label: 'Suítes' },
  { key: 'garages', label: 'Vagas de Garagem' },
  { key: 'description', label: 'Descrição' },
];

const clientFields = [
  { key: 'name', label: 'Nome Completo', required: true },
  { key: 'phone', label: 'Telefone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'Cidade' },
  { key: 'budget_max', label: 'Orçamento Máximo' },
  { key: 'property_type', label: 'Tipo de Imóvel Desejado' },
];

const ownerFields = [
  { key: 'name', label: 'Nome Completo', required: true },
  { key: 'phone', label: 'Telefone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'Cidade' },
  { key: 'notes', label: 'Observações' },
];

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { profile } = useAuth();
  const { refreshAll } = useData();

  const [step, setStep] = useState<'upload' | 'mapping' | 'review' | 'importing' | 'completed'>('upload');
  const [dataType, setDataType] = useState<'Imóveis' | 'Clientes' | 'Proprietários'>('Imóveis');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');

  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [extractedOwners, setExtractedOwners] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [defaultBuildingName, setDefaultBuildingName] = useState('');
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);
  const [buildingSearch, setBuildingSearch] = useState('');

  const [report, setReport] = useState<{
    success: number;
    duplicates: number;
    errors: number;
    errorsList: any[];
    pendingList?: any[];
  } | null>(null);

  const [brokerSession, setBrokerSession] = useState<{ chave: string; total: number; proprietariosUnicos: number; proprietariosLista: { nome: string; telefone: string }[] } | null>(null);

  const [buildingOptions, setBuildingOptions] = useState<any[]>([]);
  const [buildingSelectIdx, setBuildingSelectIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'mapping' || step === 'review') {
      fetchBuildings().then(setBuildingOptions).catch(() => {});
    }
  }, [step]);

  if (isOpen && step === 'upload') {
    // reset on open
  }

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setParsedRows([]);
    setColumns([]);
    setMapping({});
    setExtractedData([]);
    setExtractedOwners([]);
    setProgress(0);
    setReport(null);
    setBrokerSession(null);
    setBuildingOptions([]);
    setBuildingSelectIdx(null);
    setDefaultBuildingName('');
    setShowBuildingPicker(false);
    setBuildingSearch('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    if (selectedFile.size > 50 * 1024 * 1024) {
      alert('Tamanho do arquivo excede o limite de 50 MB.');
      return;
    }

    const name = selectedFile.name.toLowerCase();
    const isPDF = name.endsWith('.pdf');
    const isExcelOrCsv = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');

    if (!isPDF && !isExcelOrCsv) {
      alert('Formato de arquivo não suportado. Use PDF, Excel ou CSV.');
      return;
    }

    setFile(selectedFile);

    if (isExcelOrCsv) {
      readExcelFile(selectedFile);
    }
    // PDF: just select file, let user choose parser or Groq AI manually
  };

  const readExcelFile = (excelFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) {
        alert('Falha ao ler o arquivo: dados vazios.');
        resetState();
        return;
      }
      try {
        let json: any[];
        if (excelFile.name.endsWith('.csv')) {
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          json = XLSX.utils.sheet_to_json(XLSX.utils.aoa_to_sheet(text.split('\n').map((r: string) => r.split(','))));
        } else {
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          json = XLSX.utils.sheet_to_json(sheet);
        }

        if (!json || json.length === 0) {
          alert('O arquivo selecionado está vazio ou não pôde ser lido.');
          resetState();
          return;
        }

        setParsedRows(json);
        const cols = Object.keys(json[0]);
        setColumns(cols);

        const fields = dataType === 'Imóveis' ? propertyFields : dataType === 'Clientes' ? clientFields : ownerFields;
        const initialMapping = autoMapColumns(cols, fields);
        setMapping(initialMapping);
        setStep('mapping');
      } catch (err) {
        console.error('Erro ao ler Excel:', err);
        alert(`Falha ao ler o arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}. Verifique se é um Excel válido.`);
        resetState();
      }
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo no navegador.');
      resetState();
    };
    reader.readAsArrayBuffer(excelFile);
  };

  const autoMapColumns = (cols: string[], fields: { key: string; label: string }[]) => {
    const initialMapping: Record<string, string> = {};
    const keywords: Record<string, string[]> = {
      owner_name: ['proprietário', 'proprietario', 'dono', 'proprietário nome', 'nome proprietário', 'nome do proprietário', 'owner'],
      owner_phone: ['telefone proprietário', 'tel proprietário', 'fone proprietário', 'celular proprietário', 'proprietário telefone', 'proprietário tel', 'owner phone', 'telefone do proprietário'],
      owner_email: ['email proprietário', 'e-mail proprietário', 'proprietário email', 'proprietário e-mail', 'owner email', 'email do proprietário'],
      building_name: ['edifício', 'edificio', 'condomínio', 'condominio', 'edifício/condomínio', 'empreendimento', 'building', 'nome do edifício', 'bloco', 'torre', 'predio', 'prédio'],
      property_type: ['tipo', 'tipo do imóvel', 'tipo_imovel', 'classificação', 'categoria de imóvel'],
      category: ['categoria', 'finalidade', 'transação', 'transacao', 'negócio'],
      sale_price: ['preço', 'valor', 'venda', 'custo', 'preco', 'preço de venda', 'preco_venda'],

      city: ['cidade', 'municipio', 'município', 'localidade'],
      neighborhood: ['bairro', 'região', 'regiao', 'distrito'],
      street: ['rua', 'logradouro', 'endereço', 'endereco', 'av', 'avenida'],
      number: ['número', 'numero', 'nº', 'num'],
      private_area: ['área', 'area', 'm2', 'tamanho', 'metragem', 'área privativa', 'area_privativa'],
      bedrooms: ['quarto', 'dormitorio', 'dormitório', 'quartos', 'dormitorios', 'dorm'],
      suites: ['suite', 'suíte', 'suites', 'suítes'],
      garages: ['vaga', 'garagem', 'vagas', 'garagens'],
      description: ['descrição', 'descricao', 'detalhes', 'observações', 'obs'],
      name: ['nome', 'cliente', 'proprietário', 'proprietario', 'contato', 'completo', 'dono', 'nome completo'],
      phone: ['telefone', 'tel', 'celular', 'cel', 'fone'],
      whatsapp: ['whatsapp', 'whats', 'wpp'],
      email: ['email', 'e-mail', 'correio'],
      budget_max: ['orçamento', 'orcamento', 'limite', 'max', 'valor máximo', 'orcamento_max'],
      notes: ['observações', 'notas', 'detalhes', 'obs'],
    };

    fields.forEach(f => {
      const synonyms = keywords[f.key] || [];
      const match = cols.find(c => {
        const lowerCol = c.toLowerCase().trim();
        return lowerCol === f.key.toLowerCase() ||
               lowerCol === f.label.toLowerCase() ||
               synonyms.some(s => lowerCol.includes(s) || s.includes(lowerCol));
      });
      initialMapping[f.key] = match || '';
    });

    return initialMapping;
  };

  const handlePdfProcess = async (pdfFile: File) => {
    setStep('importing');
    setProgress(10);
    setStatusText('Enviando PDF para análise...');

    try {
      let result;
      try {
        result = await uploadPDF(pdfFile, 'imoveis');
      } catch (err: any) {
        if (err instanceof AIFallbackError && err.rawText) {
          setProgress(30);
          setStatusText('Parser padrão falhou. Usando IA para classificar campos...');
          result = await handleAIFallback(err.rawText);
        } else {
          throw err;
        }
      }

      if (!result) {
        throw new Error('Não foi possível extrair dados do PDF.');
      }

      setProgress(60);
      setStatusText(`${result.total} imóveis detectados. ${result.proprietariosUnicos} proprietários únicos.`);

      setExtractedData(result.preview);
      setBrokerSession({
        chave: result.chave,
        total: result.total,
        proprietariosUnicos: result.proprietariosUnicos,
        proprietariosLista: result.proprietariosLista,
      });
      setStep('review');
    } catch (err: any) {
      console.error(err);
      setReport({
        success: 0,
        duplicates: 0,
        errors: 1,
        errorsList: [{ row: 'Geral', message: err.message || 'Erro inesperado no processamento do PDF', data: {} }],
      });
      setStep('completed');
    }
  };

  const handleAIFallback = async (rawText: string) => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    const blocks: string[][] = [];
    let cur: string[] = [];
    for (const line of lines) {
      if (/^\d{4,6}\s/.test(line) && cur.length > 0) {
        blocks.push(cur);
        cur = [line];
      } else {
        cur.push(line);
      }
    }
    if (cur.length) blocks.push(cur);

    setStatusText(`Carregando modelo de IA (${blocks.length} blocos encontrados)...`);

    try {
      const { pipeline } = await import('@xenova/transformers');
      const classifier = await pipeline('zero-shot-classification', 'Xenova/all-MiniLM-L6-v2');

      setStatusText('Classificando campos com IA...');

      const { parsePDFBlockWithAI } = await import('../lib/ai-pdf-parser');
      const aiData = await parsePDFBlockWithAI(blocks, classifier);

      if (aiData.length === 0) {
        throw new Error('IA não conseguiu identificar imóveis no PDF.');
      }

      setStatusText(`Enviando ${aiData.length} registros classificados...`);

      const res = await fetch('/api/upload/classified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dados: aiData, tipo: 'imoveis' }),
      });
      const bodyText = await res.text();
      let resBody: any;
      try {
        resBody = JSON.parse(bodyText);
      } catch {
        throw new Error('Servidor retornou HTML. Verifique se o backend está rodando (npm run dev na pasta server/)');
      }
      if (!res.ok) {
        throw new Error(resBody.error || `HTTP ${res.status}`);
      }
      return resBody;
    } catch (aiErr: any) {
      console.error('AI fallback error:', aiErr);
      throw new Error(`Falha na IA: ${aiErr.message}. Tente novamente ou verifique o formato do PDF.`);
    }
  };

  const handleGroqProcess = async () => {
    if (!file || !aiInstructions.trim()) {
      alert('Selecione um PDF e descreva o formato.');
      return;
    }

    setStep('importing');
    setProgress(10);
    setStatusText('Enviando para IA (Groq)...');

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('instrucoes', aiInstructions);
      form.append('tipo', 'imoveis');

      const res = await fetch('/api/upload/groq', { method: 'POST', body: form });
      const rawText = await res.text();
      let body: any;
      try {
        body = JSON.parse(rawText);
      } catch {
        throw new Error('Servidor retornou HTML. Verifique se o backend está rodando (npm run dev na pasta server/)');
      }

      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setProgress(60);
      setStatusText(`${body.total} imóveis detectados pela IA. ${body.proprietariosUnicos} proprietários únicos.`);

      setExtractedData(body.preview);
      setBrokerSession({
        chave: body.chave,
        total: body.total,
        proprietariosUnicos: body.proprietariosUnicos,
        proprietariosLista: body.proprietariosLista,
      });
      setStep('review');
    } catch (err: any) {
      console.error(err);
      setReport({
        success: 0, duplicates: 0, errors: 1,
        errorsList: [{ row: 'IA', message: err.message || 'Erro na IA', data: {} }],
      });
      setStep('completed');
    }
  };

  const handleStartImportClick = async () => {
    if (file?.name.toLowerCase().endsWith('.pdf')) {
      await handleBackendImport();
      return;
    }

    if (!profile || parsedRows.length === 0) return;

    setStep('importing');
    setProgress(5);
    setStatusText('Lendo registros do arquivo...');

    const total = parsedRows.length;
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errorsList: any[] = [];

    let existingItems: any[] = [];
    try {
      const table = dataType === 'Imóveis' ? 'properties' : dataType === 'Clientes' ? 'clients' : 'owners';
      const { data } = await supabase.from(table).select('*');
      existingItems = data || [];
    } catch (err) {
      console.warn('Falha ao obter registros existentes:', err);
    }

    setStatusText('Validando e cruzando dados...');
    const toInsert: any[] = [];

    for (let i = 0; i < total; i++) {
      const row = parsedRows[i];
      const item: any = {};
      let hasRequiredFields = true;
      let missingFieldLabel = '';

      const fields = dataType === 'Imóveis' ? propertyFields : dataType === 'Clientes' ? clientFields : ownerFields;

      fields.forEach(f => {
        const excelCol = mapping[f.key];
        let val = excelCol ? row[excelCol] : undefined;

        if (val !== undefined && val !== null) {
          if (f.key.includes('price') || f.key.includes('area') || f.key === 'budget_max' || f.key === 'budget_min') {
            const parsedNum = parseFloat(String(val).replace(/[^\d.,]/g, '').replace(',', '.'));
            val = isNaN(parsedNum) ? null : parsedNum;
          } else if (f.key === 'bedrooms' || f.key === 'suites' || f.key === 'garages' || f.key === 'bathrooms') {
            const parsedInt = parseInt(String(val).replace(/[^\d]/g, ''), 10);
            val = isNaN(parsedInt) ? null : parsedInt;
          } else {
            val = String(val).trim();
          }
        }

        if (f.required && (val === undefined || val === null || val === '')) {
          hasRequiredFields = false;
          missingFieldLabel = f.label;
        }

        if (val !== undefined) {
          item[f.key] = val;
        }
      });

      // Handle __building: prefix from building dropdown selection
      const bldMapping = mapping.building_name;
      if (bldMapping && bldMapping.startsWith('__building:')) {
        item.building_name = bldMapping.slice(11);
        setDefaultBuildingName(item.building_name);
      }

      if (!hasRequiredFields) {
        errorCount++;
        errorsList.push({
          row: i + 2,
          message: `Campo obrigatório ausente: ${missingFieldLabel}`,
          data: row,
        });
        continue;
      }

      if (dataType === 'Imóveis') {
        if (!item.status) item.status = 'disponivel';
        if (!item.visibility) item.visibility = 'privado';
        item.code = `IMV-${(Date.now() + i).toString(36).toUpperCase()}`;

        const mappedType = String(item.property_type).toLowerCase();
        if (mappedType.includes('apt') || mappedType.includes('apto') || mappedType.includes('apartamento')) {
          item.property_type = 'apartamento';
        } else if (mappedType.includes('casa')) {
          item.property_type = 'casa';
        } else if (mappedType.includes('terr') || mappedType.includes('lote')) {
          item.property_type = 'terreno';
        } else if (mappedType.includes('sala') || mappedType.includes('comercial')) {
          item.property_type = 'sala_comercial';
        } else if (mappedType.includes('condominio') || mappedType.includes('condomínio')) {
          item.property_type = 'condominio';
        } else if (mappedType.includes('predio') || mappedType.includes('prédio') || mappedType.includes('edif')) {
          item.property_type = 'predio';
        } else if (mappedType.includes('loja')) {
          item.property_type = 'loja';
        } else if (mappedType.includes('cobertura') || mappedType.includes('duplex')) {
          item.property_type = 'cobertura';
        } else if (mappedType.includes('sitio') || mappedType.includes('sítio') || mappedType.includes('chac') || mappedType.includes('fazenda')) {
          item.property_type = 'sitio';
        } else {
          item.property_type = 'outros';
        }

        const mappedCat = String(item.category).toLowerCase();
        if (mappedCat.includes('perm')) {
          item.category = 'permuta';
        } else if (mappedCat.includes('temp') || mappedCat.includes('sazonal')) {
          item.category = 'temporada';
        } else {
          item.category = 'venda';
        }
      } else if (dataType === 'Clientes') {
        if (!item.funil) item.funil = 'frio';
      }

      let isDuplicate = false;
      if (dataType === 'Imóveis') {
        isDuplicate = existingItems.some((x: any) =>
          String(x.street || '').toLowerCase() === String(item.street || '').toLowerCase() &&
          String(x.number || '').toLowerCase() === String(item.number || '').toLowerCase() &&
          String(x.neighborhood || '').toLowerCase() === String(item.neighborhood || '').toLowerCase() &&
          String(x.city || '').toLowerCase() === String(item.city || '').toLowerCase() &&
          Number(x.sale_price || 0) === Number(item.sale_price || 0)
        );
      } else if (dataType === 'Clientes') {
        if (item.email) {
          isDuplicate = existingItems.some((x: any) => String(x.email || '').toLowerCase() === String(item.email).toLowerCase());
        }
      } else if (dataType === 'Proprietários') {
        if (item.email || item.phone || item.whatsapp) {
          isDuplicate = existingItems.some((x: any) =>
            (item.email && String(x.email || '').toLowerCase() === String(item.email).toLowerCase()) ||
            (item.phone && String(x.phone || '').replace(/[^\d]/g, '') === String(item.phone).replace(/[^\d]/g, '')) ||
            (item.whatsapp && String(x.whatsapp || '').replace(/[^\d]/g, '') === String(item.whatsapp).replace(/[^\d]/g, ''))
          );
        }
      }

      if (isDuplicate) {
        duplicateCount++;
        continue;
      }

      item.user_id = profile.id;
      toInsert.push(item);
    }

    if (toInsert.length > 10000) {
      alert('Limite de 10.000 registros excedido.');
      resetState();
      return;
    }

    // Try to match buildings from street addresses for preview
    try {
      setStatusText('Identificando edifícios/condomínios...');
      const buildings = await fetchBuildings();
      setBuildingOptions(buildings);
      for (const item of toInsert) {
        if (item.building_name) continue;
        const street = String(item.street || '').trim();
        if (!street) continue;
        const upper = street.toUpperCase();
        // Try longest building name first
        const sorted = [...buildings].sort((a: any, b: any) => b.name.length - a.name.length);
        for (const b of sorted) {
          if (upper.startsWith(b.name.toUpperCase())) {
            item.building_name = b.name;
            break;
          }
        }
      }
    } catch {}

    // Categorize: houses always ready; others need building match
    for (const item of toInsert) {
      if (item.property_type === 'casa') {
        item._ready = true;
      } else {
        item._ready = !!item.building_name;
      }
    }

    const ready = toInsert.filter(i => i._ready).length;
    const pending = toInsert.filter(i => !i._ready).length;
    setStatusText(`Preparando revisão (${ready} prontos, ${pending} pendentes)...`);
    setProgress(80);

    setExtractedData(toInsert);
    setStep('review');
  };

  const handleBackendImport = async () => {
    if (!brokerSession) return;
    setStep('importing');
    setProgress(30);
    setStatusText('Salvando imóveis e proprietários no banco...');
    try {
      const result = await confirmBackend(brokerSession.chave);
      setProgress(100);
      setStatusText(`${result.total} registros importados com sucesso!`);
      setReport({ success: result.total, duplicates: 0, errors: 0, errorsList: [] });
      setStep('completed');
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      setReport({
        success: 0, duplicates: 0, errors: 1,
        errorsList: [{ row: 'Backend', message: err.message || 'Erro ao importar', data: {} }],
      });
      setStep('completed');
    }
  };

  const confirmImport = async () => {
    if (!profile) return;

    setStep('importing');
    setProgress(10);
    setStatusText('Salvando dados...');

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errorsList: any[] = [];

    try {
      if (dataType === 'Imóveis') {
        // Extract unique owners from property data
        const owners: { name: string; phone: string; email?: string; city?: string }[] = [];
        const ownerSeen = new Set<string>();
        for (const item of extractedData) {
          const name = (item.owner_name || '').trim();
          if (!name) continue;
          const key = `${name}|${(item.owner_phone || '').replace(/\D/g, '')}|${(item.owner_email || '').trim().toLowerCase()}`;
          if (!ownerSeen.has(key)) {
            ownerSeen.add(key);
            owners.push({ name, phone: item.owner_phone || '', email: item.owner_email || '', city: item.city || '' });
          }
        }

        // Separate ready from pending
        const readyItems = extractedData.filter((i: any) => i._ready);
        const pendingItems = extractedData.filter((i: any) => !i._ready);

        setStatusText(owners.length > 0
          ? `${readyItems.length} imóveis, ${owners.length} proprietários — importando...`
          : `${readyItems.length} imóveis — importando...`
        );

        const mapType = (t: string) => {
          const m = t.toLowerCase();
          if (m.includes('apt') || m.includes('apartamento')) return 'apartamento';
          if (m.includes('casa')) return 'casa';
          if (m.includes('terr') || m.includes('lote')) return 'terreno';
          if (m.includes('sala') || m.includes('comercial')) return 'sala_comercial';
          if (m.includes('condominio') || m.includes('condomínio')) return 'condominio';
          if (m.includes('predio') || m.includes('prédio') || m.includes('edif')) return 'predio';
          if (m.includes('loja')) return 'loja';
          if (m.includes('cobertura') || m.includes('duplex')) return 'cobertura';
          if (m.includes('sitio') || m.includes('sítio') || m.includes('chac') || m.includes('fazenda')) return 'sitio';
          return 'outros';
        };

        const propertiesToSend = readyItems.map((item: any) => ({
          property_type: mapType(item.property_type || ''),
          category: item.category || 'venda',
          status: item.status || 'disponivel',
          visibility: 'privado',
          city: item.city || '',
          neighborhood: item.neighborhood || '',
          street: item.street || '',
          number: item.number || '',
          complement: item.complement || '',
          private_area: item.private_area || null,
          bedrooms: item.bedrooms || null,
          garages: item.garages || null,
          sale_price: item.sale_price || null,
          description: item.description || '',
          building_name: item.building_name || '',
          owner_name: item.owner_name || '',
          owner_phone: item.owner_phone || '',
          owner_email: item.owner_email || '',
        }));

        try {
          setStatusText(`Importando ${propertiesToSend.length} imóveis via API...`);
          const apiResult = await batchImportProperties(propertiesToSend, owners);
          successCount = apiResult.created;
          duplicateCount = apiResult.duplicates;
          errorCount = apiResult.errors;
          if (apiResult.errorsList) {
            for (const e of apiResult.errorsList) {
              errorsList.push({ row: e.row, message: e.message, data: e.data });
            }
          }
          setProgress(100);
          setStatusText(`${apiResult.created} imóveis importados com sucesso!`);
        } catch (apiErr: any) {
          console.error('API batch import failed:', apiErr);
          errorCount += propertiesToSend.length;
          errorsList.push({ row: 'API', message: apiErr.message || 'Erro ao importar via API', data: {} });
          setProgress(100);
        }
      } else if (dataType === 'Clientes') {
        const toInsert: any[] = extractedData.map((item: any) => ({
          name: item.name || item.nome || '',
          phone: item.phone || item.telefone || '',
          whatsapp: item.whatsapp || '',
          email: item.email || '',
          city: item.city || item.cidade || '',
          neighborhood: item.neighborhood || item.bairro || '',
          description: item.description || item.descricao || '',
          budgetMax: item.budget_max || item.budgetMax || null,
          budgetMin: item.budget_min || item.budgetMin || null,
          desiredPropertyType: item.property_type || item.propertyType || item.desiredPropertyType || '',
          funil: item.funil || 'frio',
        }));

        setStatusText(`Importando ${toInsert.length} clientes...`);
        for (let i = 0; i < toInsert.length; i++) {
          try {
            const res = await fetch('/api/clients', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': profile.id },
              body: JSON.stringify(toInsert[i]),
            });
            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              errorsList.push({ row: i + 1, message: errBody.error || `HTTP ${res.status}`, data: toInsert[i] });
              errorCount++;
            } else {
              successCount++;
            }
          } catch (e: any) {
            errorsList.push({ row: i + 1, message: e.message, data: toInsert[i] });
            errorCount++;
          }
        }
        setProgress(100);
      } else if (dataType === 'Proprietários') {
        const toInsert: any[] = extractedData.map((item: any) => ({
          name: item.name || item.nome || '',
          phone: item.phone || item.telefone || '',
          whatsapp: item.whatsapp || '',
          email: item.email || '',
          city: item.city || item.cidade || '',
          notes: item.notes || item.observacoes || '',
        }));

        setStatusText(`Importando ${toInsert.length} proprietários...`);
        for (let i = 0; i < toInsert.length; i++) {
          try {
            const res = await fetch('/api/owners', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': profile.id },
              body: JSON.stringify(toInsert[i]),
            });
            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              errorsList.push({ row: i + 1, message: errBody.error || `HTTP ${res.status}`, data: toInsert[i] });
              errorCount++;
            } else {
              successCount++;
            }
          } catch (e: any) {
            errorsList.push({ row: i + 1, message: e.message, data: toInsert[i] });
            errorCount++;
          }
        }
        setProgress(100);
      }

      await refreshAll();
    } catch (err: any) {
      console.error(err);
      errorCount += extractedData.length - successCount;
      errorsList.push({ row: 'Geral', message: err.message || 'Falha ao salvar no banco de dados', data: {} });
    }

    let pendingList: any[] = [];
    if (dataType === 'Imóveis') {
      pendingList = extractedData.filter((i: any) => !i._ready);
      setExtractedData(pendingList);
    }
    setReport({ success: successCount, duplicates: duplicateCount, errors: errorCount, errorsList, pendingList });
    setStep('completed');
  };

  const handleNavigateReview = () => {
    setStep('review');
  };

  const downloadErrorReport = () => {
    if (!report || report.errorsList.length === 0) return;
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Linha,Mensagem de Erro,Dados Originais'].join(',') +
      '\n' +
      report.errorsList
        .map(e =>
          `"${e.row}","${e.message.replace(/"/g, '""')}","${JSON.stringify(e.data).replace(/"/g, '""')}"`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_erros_importacao_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPendingCSV = () => {
    if (!report || !report.pendingList || report.pendingList.length === 0) return;
    const headers = ['Ref', 'Tipo', 'Endereço', 'Bairro', 'Quartos', 'Garagem', 'Valor', 'Proprietário', 'Telefone'];
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      headers.join(',') +
      '\n' +
      report.pendingList
        .map((item: any) =>
          [
            `"${(item.ref || item.code || '')}"`,
            `"${(item.property_type || '')}"`,
            `"${(item.street || '').replace(/"/g, '""')}"`,
            `"${(item.neighborhood || '')}"`,
            `"${item.bedrooms || ''}"`,
            `"${item.garages || ''}"`,
            `"${item.sale_price || ''}"`,
            `"${(item.owner_name || '').replace(/"/g, '""')}"`,
            `"${(item.owner_phone || '').replace(/"/g, '""')}"`,
          ].join(',')
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pendentes_importacao_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Close handler that resets state
  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="dark:bg-slate-900 bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col border dark:border-slate-800/80 border-gray-200">

        {/* Header */}
        <div className="sticky top-0 dark:bg-slate-900 bg-white dark:border-slate-800 border-gray-200 border-b p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold dark:text-white text-gray-900">Importar Dados</h2>
            <p className="text-xs dark:text-slate-400 text-gray-500 mt-1">
              {step === 'upload' && 'Extraia imóveis, clientes e proprietários de arquivos'}
              {step === 'mapping' && 'Mapeie as colunas do arquivo para os campos do sistema'}
              {step === 'review' && 'Revise os dados antes de importar'}
              {step === 'importing' && 'Processando dados...'}
              {step === 'completed' && 'Resultado da importação'}
            </p>
          </div>
          {step !== 'importing' && (
            <button onClick={handleClose} className="p-1 dark:hover:bg-slate-800 hover:bg-gray-100 rounded transition-colors">
              <X className="w-5 h-5 dark:text-slate-400 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Data Type Selection */}
              <div>
                <label className="section-label">1. Escolha o tipo de dado do arquivo</label>
                <div className="flex gap-3 mt-2">
                  {(['Imóveis', 'Clientes', 'Proprietários'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDataType(type)}
                      className={`flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                        dataType === type
                          ? 'dark:border-viva-500 border-viva-600 bg-viva-500/10 text-viva-500'
                          : 'dark:border-slate-800 border-gray-200 hover:dark:bg-slate-800/50 hover:bg-gray-50 dark:text-slate-300 text-gray-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {dataType === 'Imóveis' && (
                  <p className="text-xs dark:text-slate-500 text-gray-400 mt-2">
                    Para PDFs do sistema Broker: o extrator identifica automaticamente imóveis e seus respectivos proprietários.
                  </p>
                )}
              </div>

              {/* Drag & Drop Area */}
              <div>
                <label className="section-label">2. Envie o arquivo</label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`mt-2 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px] ${
                    dragOver
                      ? 'dark:border-viva-500 border-viva-600 dark:bg-viva-500/5 bg-viva-600/5'
                      : 'dark:border-slate-800 border-gray-300 hover:dark:border-slate-700 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.xlsx,.xls,.csv"
                    className="hidden"
                  />
                  {file ? (
                    <div className="space-y-3">
                      <div className="p-3 dark:bg-slate-800 bg-gray-100 rounded-2xl w-fit mx-auto">
                        {file.name.toLowerCase().endsWith('.pdf') ? (
                          <FileText className="w-8 h-8 text-rose-500" />
                        ) : (
                          <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold dark:text-white text-gray-900 truncate max-w-md">{file.name}</p>
                        <p className="text-xs dark:text-slate-400 text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 dark:bg-slate-800 bg-gray-100 rounded-2xl w-fit mx-auto">
                        <Upload className="w-8 h-8 text-viva-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold dark:text-white text-gray-900">Arraste seu arquivo aqui ou clique para buscar</p>
                        <p className="text-xs dark:text-slate-500 text-gray-400 mt-1">Formatos aceitos: PDF, Excel (.xlsx, .xls) ou CSV (Máx. 50MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            {/* AI Instructions for PDF */}
            {file && file.name.toLowerCase().endsWith('.pdf') && (
              <div className="space-y-4">
                <div>
                  <label className="section-label">3. (Opcional) Instruções para a IA</label>
                  <p className="text-xs dark:text-slate-500 text-gray-400 mt-1 mb-2">
                    Descreva como o PDF está formatado. A IA vai seguir suas instruções para extrair os dados.
                  </p>
                  <textarea
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder='Ex: "cada imóvel começa com um número de 4-6 dígitos (ID), depois vem o tipo (Apartamento/Casa), Dormitório(s): XX, área, endereço, bairro - cidade, valor, proprietário, telefone"'
                    className="input w-full h-24 resize-none text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={handlePdfProcess} className="btn-primary flex-1" disabled={!file}>
                    <FileText className="w-4 h-4 mr-1.5 inline" />
                    Processar (Parser Automático)
                  </button>
                  <button onClick={handleGroqProcess} className="btn-secondary flex-1" disabled={!file || !aiInstructions.trim()}>
                    <Sparkles className="w-4 h-4 mr-1.5 inline" />
                    Processar com IA (Groq)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="section-label">Mapeamento de Colunas ({dataType})</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setStatusText('Carregando IA...');
                      try {
                        const { classifyColumnHeaders } = await import('../lib/smart-parser');
                        setStatusText('Analisando colunas com IA...');
                        const aiMapping = await classifyColumnHeaders(columns);
                        setMapping(prev => ({ ...prev, ...aiMapping }));
                        setStatusText('Colunas mapeadas com IA!');
                      } catch (err) {
                        console.error(err);
                        setStatusText('Erro ao carregar IA, usando mapeamento padrão.');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border dark:border-viva-500/30 border-viva-300 text-viva-500 text-xs font-semibold hover:dark:bg-viva-500/10 hover:bg-viva-50 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Detectar com IA
                  </button>
                  <span className="text-xs dark:text-slate-400 text-gray-500">{parsedRows.length} linhas</span>
                </div>
              </div>
              <div className="border dark:border-slate-800 border-gray-200 rounded-xl overflow-hidden divide-y dark:divide-slate-800 divide-gray-200 max-h-[350px] overflow-y-auto">
                {(dataType === 'Imóveis' ? propertyFields : dataType === 'Clientes' ? clientFields : ownerFields).map(field => (
                  <div key={field.key} className="flex items-center justify-between p-3.5 hover:dark:bg-slate-800/20 hover:bg-gray-50/50">
                    <div>
                      <p className={`text-sm font-medium ${field.label === 'Edifício / Condomínio' ? 'dark:text-amber-300 text-amber-700' : 'dark:text-slate-200 text-gray-900'}`}>
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </p>
                    </div>
                    <div className="w-64">
                      {field.key === 'building_name' ? (
                        <button
                          type="button"
                          onMouseDown={() => {
                            if (!profile) return;
                            setMapping({ ...mapping, building_name: '__auto' });
                            setStatusText('Edifícios serão identificados automaticamente pelo endereço');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium border-2 border-dashed transition-all ${
                            mapping.building_name === '__auto'
                              ? 'dark:border-viva-500 border-viva-400 dark:text-viva-400 text-viva-600 dark:bg-viva-500/10 bg-viva-50'
                              : 'dark:border-slate-700 border-gray-300 dark:text-slate-400 text-gray-500 hover:dark:border-viva-600 hover:border-viva-400 hover:dark:text-viva-400 hover:text-viva-500'
                          }`}
                        >
                          🏢 Edifícios/Condomínios
                          {mapping.building_name !== '__auto' && (
                            <span className="block text-[10px] font-normal dark:text-slate-500 text-gray-400 mt-0.5">Clique para ativar detecção automática</span>
                          )}
                          {mapping.building_name === '__auto' && (
                            <span className="block text-[10px] font-normal dark:text-viva-400/70 text-viva-500/70 mt-0.5">Detecção automática ativada ✓</span>
                          )}
                        </button>
                      ) : (
                        <select
                          value={mapping[field.key] || ''}
                          onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                          className="input !py-1.5"
                        >
                          <option value="">-- Não mapear --</option>
                          {columns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 dark:bg-slate-800/30 bg-gray-50 rounded-2xl border dark:border-slate-700/50 border-gray-200">
                <Eye className="w-6 h-6 text-viva-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold dark:text-white text-gray-900">Prévia dos Dados Extraídos</h3>
                  <p className="text-xs dark:text-slate-400 text-gray-500 mt-1">
                    Revise os dados antes de confirmar a importação.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                <div className="card text-center dark:bg-slate-800/30 bg-gray-50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-viva-400">{extractedData.length}</p>
                  <p className="text-[10px] dark:text-slate-400 text-gray-500 uppercase font-semibold mt-1">Total</p>
                </div>
                <div className="card text-center dark:bg-slate-800/30 bg-gray-50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-emerald-400">{extractedData.filter((i: any) => i._ready).length}</p>
                  <p className="text-[10px] dark:text-slate-400 text-gray-500 uppercase font-semibold mt-1">Prontos</p>
                </div>
                <div className="card text-center dark:bg-slate-800/30 bg-gray-50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-amber-400">{extractedData.filter((i: any) => !i._ready).length}</p>
                  <p className="text-[10px] dark:text-slate-400 text-gray-500 uppercase font-semibold mt-1">Pendentes</p>
                </div>
                <div className="card text-center dark:bg-slate-800/30 bg-gray-50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-amber-400">
                    {extractedData.filter((i: any) => i.owner_name || i.proprietario).length}
                  </p>
                  <p className="text-[10px] dark:text-slate-400 text-gray-500 uppercase font-semibold mt-1">Proprietários</p>
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold dark:text-slate-200 text-gray-800">Primeiros registros</h4>
                  {extractedData.filter((i: any) => !i._ready).length > 0 && (
                    <p className="text-[10px] text-amber-400">Clique em "Selecionar..." para vincular edifício nos pendentes</p>
                  )}
                </div>
                <div className="border dark:border-slate-800 border-gray-200 rounded-xl overflow-hidden">
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-xs min-w-[800px]">
                      <thead className="dark:bg-slate-800/50 bg-gray-100 sticky top-0">
                        <tr>
                          <th className="text-center p-2 font-semibold dark:text-slate-300 text-gray-700 w-8">#</th>
                          {dataType === 'Imóveis' && (
                              <>
                                <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Ref</th>
                                <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Tipo</th>
                                <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Endereço</th>
                                <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Bairro</th>
                                <th className="text-center p-2 font-semibold dark:text-slate-300 text-gray-700">Q/S/G</th>
                                <th className="text-right p-2 font-semibold dark:text-slate-300 text-gray-700">Valor</th>
                                <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Proprietário</th>
                                <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Edifício</th>
                              </>
                          )}
                          {dataType === 'Clientes' && (
                            <>
                              <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Nome</th>
                              <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Telefone</th>
                              <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Email</th>
                              <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Cidade</th>
                            </>
                          )}
                          {dataType === 'Proprietários' && (
                            <>
                              <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Nome</th>
                              <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Telefone</th>
                              <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Email</th>
                              <th className="text-left p-2 font-semibold dark:text-slate-300 text-gray-700">Cidade</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-800 divide-gray-200">
                        {extractedData.slice(0, 10).map((item: any, idx: number) => (
                          <tr key={idx} className={`dark:hover:bg-slate-800/20 hover:bg-gray-50 ${item._ready ? '' : 'dark:bg-amber-500/5 bg-amber-50/30'}`}>
                            <td className="p-2 text-center">
                              {item._ready
                                ? <span className="text-emerald-400 text-xs">✓</span>
                                : <span className="text-amber-400 text-xs" title="Sem edifício identificado">!</span>
                              }
                            </td>
                            {dataType === 'Imóveis' && (
                              <>
                                <td className="p-2 font-mono dark:text-slate-200 text-gray-800 whitespace-nowrap">{item.ref || item.id || item.code || `#${idx + 1}`}</td>
                                <td className="p-2 dark:text-slate-300 text-gray-600 capitalize whitespace-nowrap">{item.property_type || '—'}</td>
                                <td className="p-2 dark:text-slate-300 text-gray-600 truncate max-w-[100px]">{item.street || '—'}</td>
                                <td className="p-2 dark:text-slate-300 text-gray-600 truncate max-w-[70px]">{item.neighborhood || '—'}</td>
                                <td className="p-2 text-center dark:text-slate-300 text-gray-600 text-[10px]">{item.bedrooms || '—'}/{item.suites || '—'}/{item.garages || '—'}</td>
                                <td className="p-2 text-right dark:text-slate-200 text-gray-800 font-medium whitespace-nowrap">
                                  {item.sale_price ? BRL(item.sale_price) : '—'}
                                </td>
                                <td className="p-2 dark:text-slate-300 text-gray-600 truncate max-w-[80px]">{item.owner_name || '—'}</td>
                                <td className="p-2 relative">
                                  <button
                                    type="button"
                                    onClick={() => setBuildingSelectIdx(buildingSelectIdx === idx ? null : idx)}
                                    className={`w-full text-left text-xs truncate max-w-[80px] transition-colors ${
                                      item._ready
                                        ? 'dark:text-slate-300 text-gray-600 hover:text-viva-400'
                                        : 'text-amber-400 font-semibold hover:text-amber-300'
                                    }`}
                                  >
                                    {item.building_name || <span className="text-amber-400">Selecionar...</span>}
                                  </button>
                                  {buildingSelectIdx === idx && buildingOptions.length > 0 && (
                                    <div className="absolute z-50 left-0 top-full mt-1 w-72 max-h-48 overflow-auto rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-gray-200 shadow-2xl">
                                      {buildingOptions.slice(0, 20).map((b: any) => (
                                        <button
                                          key={b.id}
                                          type="button"
                                          onMouseDown={() => {
                                            const updated = [...extractedData];
                                            updated[idx] = { ...updated[idx], building_name: b.name, _ready: true };
                                            setExtractedData(updated);
                                            setBuildingSelectIdx(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs dark:text-slate-200 text-gray-700 dark:hover:bg-slate-700 hover:bg-gray-100 border-b dark:border-slate-700/50 border-gray-100 last:border-0"
                                        >
                                          <span className="font-medium">{b.name}</span>
                                          {b.neighborhood && (
                                            <span className="ml-2 text-[10px] dark:text-slate-500 text-gray-400">{b.neighborhood}</span>
                                          )}
                                        </button>
                                      ))}
                                      <button
                                        type="button"
                                        onMouseDown={() => {
                                          const name = window.prompt('Nome do edifício/condomínio:');
                                          if (name && name.trim()) {
                                            const updated = [...extractedData];
                                            updated[idx] = { ...updated[idx], building_name: name.trim(), _ready: true };
                                            setExtractedData(updated);
                                          }
                                          setBuildingSelectIdx(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs dark:text-slate-400 text-gray-500 dark:hover:bg-slate-700 hover:bg-gray-100 italic"
                                      >
                                        + Outro (digitar nome)
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </>
                            )}
                            {dataType === 'Clientes' && (
                              <>
                                <td className="p-2 dark:text-slate-200 text-gray-800 font-medium">{item.name || '—'}</td>
                                <td className="p-2 dark:text-slate-300 text-gray-600">{item.phone || '—'}</td>
                                <td className="p-2 dark:text-slate-300 text-gray-600">{item.email || '—'}</td>
                                <td className="p-2 dark:text-slate-300 text-gray-600">{item.city || '—'}</td>
                              </>
                            )}
                            {dataType === 'Proprietários' && (
                              <>
                                <td className="p-2 dark:text-slate-200 text-gray-800 font-medium">{item.name || '—'}</td>
                                <td className="p-2 dark:text-slate-300 text-gray-600">{item.phone || '—'}</td>
                                <td className="p-2 dark:text-slate-300 text-gray-600">{item.email || '—'}</td>
                                <td className="p-2 dark:text-slate-300 text-gray-600">{item.city || '—'}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {extractedData.length > 10 && (
                    <div className="p-2 text-center text-xs dark:text-slate-500 text-gray-400 border-t dark:border-slate-800 border-gray-200">
                      ...e mais {extractedData.length - 10} registro(s)
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-viva-500 animate-spin" />
              <div className="w-full max-w-sm">
                <p className="text-sm font-semibold dark:text-white text-gray-900">{statusText}</p>
                <div className="w-full bg-gray-200 dark:bg-slate-800 h-2.5 rounded-full mt-4 overflow-hidden">
                  <div
                    className="bg-viva-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs dark:text-slate-500 text-gray-400 mt-2">{progress}% concluído</p>
              </div>
            </div>
          )}

          {step === 'completed' && report && (
            <div className="space-y-6">
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold dark:text-white text-gray-900">Importação Concluída</h3>
                <p className="text-xs dark:text-slate-400 text-gray-500 mt-1">Processamento concluído com sucesso</p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="card text-center dark:bg-slate-800/30 bg-gray-50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-emerald-400">{report.success}</p>
                  <p className="text-[10px] dark:text-slate-400 text-gray-500 uppercase font-semibold mt-1">Importados</p>
                </div>
                <div className="card text-center dark:bg-slate-800/30 bg-gray-50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-amber-400">{report.duplicates}</p>
                  <p className="text-[10px] dark:text-slate-400 text-gray-500 uppercase font-semibold mt-1">Duplicados</p>
                </div>
                <div className="card text-center dark:bg-slate-800/30 bg-gray-50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-rose-500">{report.errors}</p>
                  <p className="text-[10px] dark:text-slate-400 text-gray-500 uppercase font-semibold mt-1">Erros</p>
                </div>
                <div className="card text-center dark:bg-slate-800/30 bg-gray-50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-blue-400">{report.pendingList?.length || 0}</p>
                  <p className="text-[10px] dark:text-slate-400 text-gray-500 uppercase font-semibold mt-1">Pendentes</p>
                </div>
              </div>

              {report.errors > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-400">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-bold">Erros Encontrados ({report.errors})</span>
                    </div>
                    <button
                      onClick={downloadErrorReport}
                      className="text-xs text-rose-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar Relatório
                    </button>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto divide-y dark:divide-slate-800/40 divide-gray-200">
                    {report.errorsList.slice(0, 50).map((err, idx) => (
                      <div key={idx} className="py-2 text-xs dark:text-slate-300 text-gray-700 flex justify-between">
                        <span>Linha {err.row}: {err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.pendingList && report.pendingList.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-bold">Pendentes ({report.pendingList.length})</span>
                      <span className="text-[10px] dark:text-slate-400 text-gray-500 font-normal ml-1">
                        (sem edifício/condomínio identificado)
                      </span>
                    </div>
                    <button
                      onClick={downloadPendingCSV}
                      className="text-xs text-amber-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar Pendentes
                    </button>
                  </div>
                  <div className="max-h-[120px] overflow-y-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="dark:text-slate-400 text-gray-500">
                          <th className="text-left p-1">Endereço</th>
                          <th className="text-left p-1">Bairro</th>
                          <th className="text-left p-1">Proprietário</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-800/40 divide-gray-200">
                        {report.pendingList.slice(0, 20).map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-1 dark:text-slate-300 text-gray-600 truncate max-w-[150px]">{item.street || '—'}</td>
                            <td className="p-1 dark:text-slate-300 text-gray-600 truncate max-w-[80px]">{item.neighborhood || '—'}</td>
                            <td className="p-1 dark:text-slate-300 text-gray-600 truncate max-w-[100px]">{item.owner_name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 dark:bg-slate-900 bg-white dark:border-slate-800 border-gray-200 border-t p-6 flex gap-3 z-10">
          {step === 'upload' && (
            <>
              <button onClick={handleClose} className="btn-ghost flex-1">
                Cancelar
              </button>
              {file && !file.name.toLowerCase().endsWith('.pdf') && (
                <button
                  onClick={() => setStep('mapping')}
                  disabled={!file}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar
                </button>
              )}
            </>
          )}

          {step === 'mapping' && (
            <>
              <button onClick={() => setStep('upload')} className="btn-ghost flex-1">
                Voltar
              </button>
              <button onClick={handleStartImportClick} className="btn-primary flex-1">
                Revisar Dados
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={() => {
                  resetState();
                }}
                className="btn-ghost flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={confirmImport}
                className="btn-primary flex-1"
                disabled={extractedData.length === 0}
              >
                {(() => {
                  const r = extractedData.filter((i: any) => i._ready).length;
                  const p = extractedData.length - r;
                  if (p > 0) return `Importar ${r} Prontos (${p} Pendentes)`;
                  return `Importar ${extractedData.length} Registros`;
                })()}
              </button>
            </>
          )}

          {step === 'importing' && (
            <button
              onClick={() => {
                alert('A importação continuará em segundo plano.');
                handleClose();
              }}
              className="btn-primary w-full"
            >
              Minimizar
            </button>
          )}

          {step === 'completed' && (
            <>
              {report?.pendingList && report.pendingList.length > 0 && (
                <button onClick={handleNavigateReview} className="btn-secondary flex-1">
                  ← Revisar Pendentes
                </button>
              )}
              <button
                onClick={async () => {
                  if (confirm('Limpar todos os dados importados?')) {
                    setStatusText('Limpando dados importados...');
                    const { error } = await supabase.from('properties').delete().eq('user_id', profile!.id);
                    if (!error) {
                      await refreshAll();
                      resetState();
                    }
                  }
                }}
                className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
                Limpar
              </button>
              <button onClick={handleClose} className="btn-primary flex-1">
                Fechar
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
