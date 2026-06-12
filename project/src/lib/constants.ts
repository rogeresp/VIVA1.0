export const PROP_TYPES = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'sala_comercial', label: 'Sala Comercial' },
  { value: 'loja', label: 'Loja' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'sitio', label: 'Sítio' },
  { value: 'condominio', label: 'Condomínio' },
  { value: 'predio', label: 'Prédio' },
  { value: 'outros', label: 'Outros' },
] as const;

export const CATEGORIES = [
  { value: 'venda', label: 'Venda' },
  { value: 'temporada', label: 'Temporada' },
  { value: 'permuta', label: 'Permuta' },
] as const;

export const STATUSES = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'vendido', label: 'Vendido' },

] as const;

export const FUNIL = [
  { value: 'frio', label: 'Frio', cls: 'bg-sky-500/15 text-sky-400' },
  { value: 'morno', label: 'Morno', cls: 'bg-amber-500/15 text-amber-400' },
  { value: 'quente', label: 'Quente', cls: 'bg-rose-500/15 text-rose-400' },
] as const;

export const AMENITIES = [
  'Piscina', 'Academia', 'Salão de festas', 'Espaço gourmet',
  'Churrasqueira', 'Sacada', 'Ar condicionado', 'Energia solar',
  'Portaria 24h', 'Segurança', 'Prédio novo', 'Lareira',
] as const;

export const ASSET_TYPES = [
  'Imóvel', 'Terreno', 'Casa', 'Apartamento', 'Veículo', 'Caminhão',
  'Barco', 'Máquina', 'Criptomoeda', 'Consórcio', 'Material de construção',
  'Empresa', 'Participação societária',
] as const;

export const STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;

export const PROFILES = [
  { value: 'investidor', label: 'Investidor' },
  { value: 'moradia', label: 'Moradia' },
  { value: 'veraneio', label: 'Veraneio' },
] as const;

export const BAIRROS: Record<string, string[]> = {
  'Capão da Canoa': ['Centro', 'Navegantes', 'Zona Nova', 'Zona Norte', 'Araçá', 'Santa Luzia', 'Santo Antônio', 'São Jorge', 'Morada do Sol', 'Jardim Beira Mar', 'Guarani'],
  'Xangri-Lá': ['Centro', 'Atlântida', 'Atlântida Sul', 'Remanso', 'Rainha do Mar', 'Noiva do Mar', 'Maristela', 'Arpoador', 'Marina', 'Guará'],
};

export const BRL = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const label = (list: readonly { value: string; label: string }[], val?: string | null) =>
  list.find(i => i.value === val)?.label ?? '—';
