export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  region?: string;
  agency?: string;
  city?: string;
  state?: string;
  created_at: string;
}

export interface Bank {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface BankParticipant {
  id: string;
  bank_id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'viewer' | 'partner';
}

export interface Client {
  id: string;
  user_id: string;
  bank_id?: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  description?: string;
  payment_conditions?: string;
  notes?: string;
  budget_min?: number;
  budget_max?: number;
  desired_neighborhood?: string;
  desired_city?: string;
  property_type?: string;
  bedrooms?: number;
  suites?: number;
  garage?: boolean;
  sea_view?: boolean;
  mountain_view?: boolean;
  furnished?: boolean;
  accepts_reform?: boolean;
  used_property?: boolean;
  new_development?: boolean;
  profile_type?: 'investidor' | 'moradia' | 'veraneio';
  funil: 'frio' | 'morno' | 'quente';
  accepts_financing?: boolean;
  installments?: string;
  created_at: string;
}

export interface Owner {
  id: string;
  user_id: string;
  bank_id?: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  cpf_cnpj?: string;
  notes?: string;
  created_at: string;
}

export interface Building {
  id: string;
  user_id: string;
  bank_id?: string;
  name: string;
  street?: string;
  number?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  created_at: string;
}

export type PropType = 'apartamento' | 'casa' | 'terreno' | 'sala_comercial' | 'loja' | 'cobertura' | 'sitio' | 'condominio' | 'predio' | 'outros';
export type PropCategory = 'venda' | 'permuta';
export type PropStatus = 'disponivel' | 'reservado' | 'vendido';
export type Visibility = 'privado' | 'banco' | 'rede';

export interface Property {
  id: string;
  user_id: string;
  bank_id?: string;
  code: string;
  property_type: PropType;
  category: PropCategory;
  status: PropStatus;
  visibility: Visibility;
  country?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  number?: string;
  complement?: string;
  zip?: string;
  reference?: string;
  unit?: string;
  quadra?: string;
  lote?: string;
  private_area?: number;
  total_area?: number;
  bedrooms?: number;
  suites?: number;
  bathrooms?: number;
  half_bath?: boolean;
  garages?: number;
  floor?: number;
  elevators?: number;
  furnished?: boolean;
  decorated?: boolean;
  solar_position?: string;
  sea_view?: boolean;
  mountain_view?: boolean;
  sale_price?: number;
  condo_fee?: number;
  iptu?: number;
  taxes?: number;
  min_accepted?: number;
  commission?: number;
  owner_id?: string;
  building_id?: string;
  photos?: string[];
  videos?: string[];
  tour_virtual?: string;
  description?: string;
  highlights?: string;
  internal_notes?: string;
  amenities?: string[];
  documentation?: Record<string, boolean>;
  accepts_exchange?: boolean;
  exchange_percent?: number;
  exchange_seeking?: string;
  exchange_not_accepted?: string;
  key_location?: string;
  sale_terms?: string;
  accepts_financing?: boolean;
  installments?: string;
  created_at: string;
  updated_at?: string;
}

export interface Exchange {
  id: string;
  user_id: string;
  bank_id?: string;
  property_id?: string;
  asset_type: string;
  asset_name: string;
  description?: string;
  estimated_value: number;
  visibility: Visibility;
  seeking?: string;
  not_accepted?: string;
  percent_accepted?: number;
  created_at: string;
}

export interface Match {
  id: string;
  user_id: string;
  type: 'property_client' | 'exchange';
  source_id: string;
  target_id: string;
  score: number;
  details?: Record<string, unknown>;
  viewed: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  type: 'property' | 'exchange' | 'opportunity' | 'direct';
  reference_id?: string;
  participants: string[];
  last_message?: string;
  last_message_at?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface AIAction {
  id: string;
  user_id: string;
  action_type: string;
  input: string;
  result: string;
  created_at: string;
}

export interface NetworkListing {
  id: string;
  user_id: string;
  type: 'property' | 'exchange' | 'opportunity';
  reference_id: string;
  title: string;
  description?: string;
  value?: number;
  city?: string;
  state?: string;
  created_at: string;
}
