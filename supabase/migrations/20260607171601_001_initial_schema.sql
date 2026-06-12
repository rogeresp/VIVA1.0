-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Banks table
CREATE TABLE IF NOT EXISTS banks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank participants
CREATE TABLE IF NOT EXISTS bank_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer', 'partner')),
  UNIQUE(bank_id, user_id)
);

-- Owners table
CREATE TABLE IF NOT EXISTS owners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  city TEXT,
  cpf_cnpj TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  city TEXT,
  notes TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  desired_neighborhood TEXT,
  desired_city TEXT,
  property_type TEXT,
  bedrooms INTEGER,
  suites INTEGER,
  garage BOOLEAN DEFAULT FALSE,
  sea_view BOOLEAN DEFAULT FALSE,
  mountain_view BOOLEAN DEFAULT FALSE,
  furnished BOOLEAN DEFAULT FALSE,
  accepts_reform BOOLEAN DEFAULT FALSE,
  used_property BOOLEAN DEFAULT FALSE,
  new_development BOOLEAN DEFAULT FALSE,
  profile_type TEXT CHECK (profile_type IN ('investidor', 'moradia', 'veraneio')),
  funil TEXT NOT NULL DEFAULT 'frio' CHECK (funil IN ('frio', 'morno', 'quente')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  property_type TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponivel',
  visibility TEXT NOT NULL DEFAULT 'privado',
  country TEXT DEFAULT 'Brasil',
  state TEXT,
  city TEXT,
  neighborhood TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  zip TEXT,
  reference TEXT,
  private_area NUMERIC,
  total_area NUMERIC,
  bedrooms INTEGER,
  suites INTEGER,
  bathrooms INTEGER,
  half_bath BOOLEAN DEFAULT FALSE,
  garages INTEGER,
  floor INTEGER,
  elevators INTEGER,
  furnished BOOLEAN DEFAULT FALSE,
  decorated BOOLEAN DEFAULT FALSE,
  solar_position TEXT,
  sea_view BOOLEAN DEFAULT FALSE,
  mountain_view BOOLEAN DEFAULT FALSE,
  sale_price NUMERIC,
  rent_price NUMERIC,
  condo_fee NUMERIC,
  iptu NUMERIC,
  taxes NUMERIC,
  min_accepted NUMERIC,
  commission NUMERIC,
  owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
  photos TEXT[],
  videos TEXT[],
  tour_virtual TEXT,
  description TEXT,
  highlights TEXT,
  internal_notes TEXT,
  amenities TEXT[],
  documentation JSONB,
  accepts_exchange BOOLEAN DEFAULT FALSE,
  exchange_percent NUMERIC,
  exchange_seeking TEXT,
  exchange_not_accepted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exchanges table
CREATE TABLE IF NOT EXISTS exchanges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  description TEXT,
  estimated_value NUMERIC NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'privado',
  seeking TEXT,
  not_accepted TEXT,
  percent_accepted INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('property_client', 'exchange')),
  source_id UUID NOT NULL,
  target_id UUID NOT NULL,
  score NUMERIC DEFAULT 0,
  details JSONB,
  viewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('property', 'exchange', 'opportunity', 'direct')),
  reference_id UUID,
  participants UUID[] NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI actions table
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  input TEXT NOT NULL,
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Network listings table
CREATE TABLE IF NOT EXISTS network_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('property', 'exchange', 'opportunity')),
  reference_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  value NUMERIC,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_listings ENABLE ROW LEVEL SECURITY;