import { createClient } from '@supabase/supabase-js';
import { mockStorage } from './mock-storage';

// Check if we should use the mock client
const isMock =
  !import.meta.env.VITE_SUPABASE_URL ||
  !import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_URL === 'YOUR_SUPABASE_URL' ||
  import.meta.env.VITE_SUPABASE_URL === '';

// Seed data function to prepopulate tables for a great first experience
function seedTable(table: string): any[] {
  const currentUserId = localStorage.getItem('mock_user_id') || 'user-123';
  const otherUserId = 'user-456';

  if (table === 'profiles') {
    return [
      {
        id: currentUserId,
        email: 'corretor@viva.com',
        full_name: 'Corretor VIVA',
        phone: '(11) 99999-9999',
        region: 'São Paulo - SP',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces',
        created_at: new Date().toISOString()
      },
      {
        id: otherUserId,
        email: 'roberto.imoveis@viva.com',
        full_name: 'Roberto Silva',
        phone: '(21) 98888-8888',
        region: 'Rio de Janeiro - RJ',
        avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=faces',
        created_at: new Date().toISOString()
      }
    ];
  }

  if (table === 'banks') {
    return [
      {
        id: 'bank-1',
        user_id: currentUserId,
        name: 'Carteira Compartilhada Jardins',
        description: 'Imóveis exclusivos na região dos Jardins - SP',
        created_at: new Date().toISOString()
      }
    ];
  }

  if (table === 'owners') {
    return [
      {
        id: 'owner-1',
        user_id: currentUserId,
        name: 'Maria Constança',
        phone: '(11) 97777-7777',
        whatsapp: '(11) 97777-7777',
        email: 'maria.const@outlook.com',
        city: 'São Paulo',
        notes: 'Cliente antiga, exige discrição',
        created_at: new Date().toISOString()
      },
      {
        id: 'owner-2',
        user_id: currentUserId,
        name: 'João Pedro Silveira',
        phone: '(11) 96666-6666',
        whatsapp: '(11) 96666-6666',
        email: 'jpsilveira@gmail.com',
        city: 'São Paulo',
        notes: 'Aceita permuta por apartamento menor',
        created_at: new Date().toISOString()
      }
    ];
  }

  if (table === 'clients') {
    return [
      {
        id: 'client-1',
        user_id: currentUserId,
        name: 'Dr. Fernando Gomes',
        phone: '(11) 95555-5555',
        whatsapp: '(11) 95555-5555',
        email: 'fernando.gomes@clinic.com.br',
        city: 'São Paulo',
        notes: 'Busca cobertura ou apartamento amplo no Itaim Bibi',
        budget_min: 2500000,
        budget_max: 4500000,
        desired_neighborhood: 'Itaim Bibi',
        desired_city: 'São Paulo',
        property_type: 'apartamento',
        bedrooms: 3,
        suites: 3,
        garage: true,
        accepts_reform: false,
        profile_type: 'moradia',
        funil: 'morno',
        created_at: new Date().toISOString()
      },
      {
        id: 'client-2',
        user_id: currentUserId,
        name: 'Ana Carolina Souza',
        phone: '(11) 94444-4444',
        whatsapp: '(11) 94444-4444',
        email: 'carol.souza@gmail.com',
        city: 'São Paulo',
        notes: 'Investidora, busca terrenos para incorporação ou casas antigas',
        budget_min: 1000000,
        budget_max: 2000000,
        desired_neighborhood: 'Pinheiros',
        desired_city: 'São Paulo',
        property_type: 'terreno',
        funil: 'quente',
        profile_type: 'investidor',
        created_at: new Date().toISOString()
      }
    ];
  }

  if (table === 'properties') {
    return [
      {
        id: 'property-1',
        user_id: currentUserId,
        code: 'IMV-L1J8',
        property_type: 'apartamento',
        category: 'venda',
        status: 'disponivel',
        visibility: 'privado',
        country: 'Brasil',
        state: 'SP',
        city: 'São Paulo',
        neighborhood: 'Jardins',
        street: 'Alameda Lorena',
        number: '1200',
        private_area: 180,
        total_area: 250,
        bedrooms: 3,
        suites: 2,
        bathrooms: 3,
        garages: 2,
        sale_price: 2800000,
        condo_fee: 1800,
        iptu: 600,
        owner_id: 'owner-1',
        description: 'Lindo apartamento nos Jardins totalmente reformado, living amplo para 3 ambientes, ensolarado e próximo a ótimos restaurantes.',
        amenities: ['Academia', 'Salão de festas', 'Segurança'],
        accepts_exchange: true,
        exchange_percent: 50,
        exchange_seeking: 'Apartamento de menor valor nos Jardins ou Pinheiros',
        created_at: new Date().toISOString()
      },
      {
        id: 'property-2',
        user_id: otherUserId,
        code: 'IMV-N5X2',
        property_type: 'apartamento',
        category: 'venda',
        status: 'disponivel',
        visibility: 'rede',
        country: 'Brasil',
        state: 'RJ',
        city: 'Rio de Janeiro',
        neighborhood: 'Ipanema',
        street: 'Avenida Vieira Souto',
        number: '500',
        private_area: 220,
        total_area: 300,
        bedrooms: 4,
        suites: 4,
        bathrooms: 5,
        garages: 3,
        sale_price: 8500000,
        condo_fee: 3500,
        iptu: 1200,
        description: 'Exclusiva cobertura linear na Vieira Souto com vista espetacular para o mar de Ipanema. Pé direito alto, finamente decorada por arquiteto renomado.',
        amenities: ['Piscina', 'Churrasqueira', 'Portaria 24h', 'Ar condicionado'],
        accepts_exchange: false,
        created_at: new Date().toISOString()
      },
      {
        id: 'property-3',
        user_id: otherUserId,
        code: 'IMV-T9A3',
        property_type: 'casa',
        category: 'venda',
        status: 'disponivel',
        visibility: 'rede',
        country: 'Brasil',
        state: 'SP',
        city: 'São Paulo',
        neighborhood: 'Alto de Pinheiros',
        street: 'Rua Pedroso Alvarenga',
        private_area: 450,
        total_area: 600,
        bedrooms: 4,
        suites: 2,
        bathrooms: 4,
        garages: 4,
        sale_price: 4900000,
        description: 'Maravilhosa casa moderna integrada com muito verde no Alto de Pinheiros. Projeto paisagístico impecável, piscina aquecida e área gourmet fantástica.',
        amenities: ['Piscina', 'Espaço gourmet', 'Churrasqueira', 'Energia solar'],
        accepts_exchange: true,
        exchange_percent: 30,
        exchange_seeking: 'Terreno ou automóveis importados',
        created_at: new Date().toISOString()
      }
    ];
  }

  if (table === 'buildings') {
    return [
      {
        id: 'building-1',
        user_id: currentUserId,
        name: 'Edifício Corporate',
        address: 'Av. Paulista, 1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        notes: 'Edifício comercial com 20 andares',
        created_at: new Date().toISOString()
      },
      {
        id: 'building-2',
        user_id: currentUserId,
        name: 'Residencial Park Avenue',
        address: 'Rua das Flores, 500',
        neighborhood: 'Jardins',
        city: 'São Paulo',
        state: 'SP',
        notes: 'Condomínio fechado com 3 torres',
        created_at: new Date().toISOString()
      },
      {
        id: 'building-3',
        user_id: otherUserId,
        name: 'Edifício Oceania',
        address: 'Av. Atlântica, 2000',
        neighborhood: 'Copacabana',
        city: 'Rio de Janeiro',
        state: 'RJ',
        notes: 'Frente para o mar, 15 andares',
        created_at: new Date().toISOString()
      },
    ];
  }

  if (table === 'exchanges') {
    return [
      {
        id: 'exchange-1',
        user_id: currentUserId,
        asset_type: 'Apartamento',
        asset_name: 'Apto Duplex Campo Belo',
        description: 'Excelente duplex com 120m², reformado, andar alto.',
        estimated_value: 1200000,
        visibility: 'privado',
        seeking: 'Casa em condomínio fechado na Granja Viana',
        percent_accepted: 100,
        created_at: new Date().toISOString()
      }
    ];
  }

  if (table === 'conversations') {
    return [
      {
        id: 'conv-1',
        type: 'property',
        reference_id: 'property-2',
        participants: [currentUserId, otherUserId],
        last_message: 'Olá Roberto, tenho um cliente interessado nesse imóvel na Vieira Souto.',
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ];
  }

  if (table === 'chat_messages') {
    return [
      {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: otherUserId,
        content: 'Olá! Sim, a cobertura é maravilhosa. O proprietário está aberto a visitas agendadas.',
        read: true,
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg-2',
        conversation_id: 'conv-1',
        sender_id: currentUserId,
        content: 'Olá Roberto, tenho um cliente interessado nesse imóvel na Vieira Souto.',
        read: true,
        created_at: new Date().toISOString()
      }
    ];
  }

  if (table === 'ai_actions') {
    return [
      {
        id: 'ai-1',
        user_id: currentUserId,
        action_type: 'matchmaking',
        input: 'Buscar cruzamentos para Cliente Fernando Gomes',
        result: 'Encontrado 1 imóvel compatível: Cobertura Vieira Souto (Pontuação: 92%)',
        created_at: new Date().toISOString()
      }
    ];
  }

  return [];
}

// Global listener registry for mock real-time events
interface MockListener {
  channelName: string;
  event: string;
  table: string;
  filter: string;
  callback: (payload: any) => void;
}
const channelListeners: MockListener[] = [];

// Helper to notify channel listeners when data inserts
function notifyChannel(table: string, event: string, payload: any) {
  channelListeners.forEach(l => {
    if (l.table === table && (l.event === event || l.event === '*')) {
      if (l.filter) {
        const parts = l.filter.split('=eq.');
        if (parts.length === 2) {
          const col = parts[0].trim();
          const val = parts[1].trim();
          if (String(payload[col]) !== String(val)) return;
        }
      }
      l.callback({ new: payload });
    }
  });
}

// Helper auth state change listeners
const authListeners: ((event: string, session: any) => void)[] = [];

const mockAuth = {
  async getSession() {
    const sessionStr = await mockStorage.getItem('mock_supabase_session');
    if (sessionStr) {
      return { data: { session: JSON.parse(sessionStr) }, error: null };
    }
    return { data: { session: null }, error: null };
  },
  onAuthStateChange(callback: (event: string, session: any) => void) {
    authListeners.push(callback);
    mockStorage.getItem('mock_supabase_session').then(sessionStr => {
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      setTimeout(() => {
        callback('INITIAL_SESSION', session);
      }, 0);
    });
    return {
      data: {
        subscription: {
          unsubscribe() {
            const idx = authListeners.indexOf(callback);
            if (idx !== -1) authListeners.splice(idx, 1);
          }
        }
      }
    };
  },
  async signInWithPassword({ email }: any) {
    const stored = await mockStorage.getItem('mock_supabase_profiles');
    let profiles = stored ? JSON.parse(stored) : [];
    if (profiles.length === 0) {
      profiles = seedTable('profiles');
      await mockStorage.setItem('mock_supabase_profiles', JSON.stringify(profiles));
    }
    
    let profile = profiles.find((p: any) => p.email === email);
    if (!profile) {
      profile = {
        id: crypto.randomUUID(),
        email,
        full_name: email.split('@')[0].toUpperCase(),
        phone: '(11) 99999-9999',
        region: 'São Paulo - SP',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces',
        created_at: new Date().toISOString()
      };
      profiles.push(profile);
      await mockStorage.setItem('mock_supabase_profiles', JSON.stringify(profiles));
    }

    const session = {
      access_token: 'mock-token-' + profile.id,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token-' + profile.id,
      user: {
        id: profile.id,
        email: profile.email,
        user_metadata: {
          full_name: profile.full_name
        }
      }
    };

    await mockStorage.setItem('mock_supabase_session', JSON.stringify(session));
    await mockStorage.setItem('mock_user_id', profile.id);

    authListeners.forEach(l => l('SIGNED_IN', session));

    return { data: { user: session.user, session }, error: null };
  },
  async signUp({ email, options }: any) {
    const fullName = options?.data?.full_name || email.split('@')[0].toUpperCase();
    const stored = await mockStorage.getItem('mock_supabase_profiles');
    let profiles = stored ? JSON.parse(stored) : [];
    if (profiles.length === 0) {
      profiles = seedTable('profiles');
    }

    if (profiles.some((p: any) => p.email === email)) {
      return { data: { user: null, session: null }, error: new Error('Usuário já existe') };
    }

    const newProfile = {
      id: crypto.randomUUID(),
      email,
      full_name: fullName,
      phone: '(11) 99999-9999',
      region: 'São Paulo - SP',
      avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces',
      created_at: new Date().toISOString()
    };
    profiles.push(newProfile);
    await mockStorage.setItem('mock_supabase_profiles', JSON.stringify(profiles));

    const session = {
      access_token: 'mock-token-' + newProfile.id,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token-' + newProfile.id,
      user: {
        id: newProfile.id,
        email: newProfile.email,
        user_metadata: {
          full_name: newProfile.full_name
        }
      }
    };

    await mockStorage.setItem('mock_supabase_session', JSON.stringify(session));
    await mockStorage.setItem('mock_user_id', newProfile.id);

    authListeners.forEach(l => l('SIGNED_IN', session));

    return { data: { user: session.user, session }, error: null };
  },
  async signOut() {
    await mockStorage.removeItem('mock_supabase_session');
    await mockStorage.removeItem('mock_user_id');
    authListeners.forEach(l => l('SIGNED_OUT', null));
    return { error: null };
  }
};

class MockBuilder {
  private table: string;
  private operation: 'select' | 'insert' | 'update' | 'delete';
  private dataToInsertOrUpdate: any;
  private filters: { col: string; val: any; isContains?: boolean }[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private isSingle = false;

  constructor(table: string, operation: 'select' | 'insert' | 'update' | 'delete' = 'select', data: any = null) {
    this.table = table;
    this.operation = operation;
    this.dataToInsertOrUpdate = data;
  }

  select(_columns?: string) {
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push({ col, val });
    return this;
  }

  contains(col: string, val: any) {
    this.filters.push({ col, val, isContains: true });
    return this;
  }

  order(col: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderCol = col;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const result = await this.execute();
      return onfulfilled ? onfulfilled(result) : result;
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  private async execute() {
    const key = `mock_supabase_${this.table}`;
    const stored = await mockStorage.getItem(key);
    let items: any[] = stored ? JSON.parse(stored) : [];

    if (items.length === 0) {
      items = seedTable(this.table);
      await mockStorage.setItem(key, JSON.stringify(items));
    }

    // Pre-load profiles for relation resolution
    const profilesStr = await mockStorage.getItem('mock_supabase_profiles');
    const cachedProfiles = profilesStr ? JSON.parse(profilesStr) : [];

    if (this.operation === 'insert') {
      const newItems = Array.isArray(this.dataToInsertOrUpdate)
        ? this.dataToInsertOrUpdate.map(x => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...x }))
        : [{ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...this.dataToInsertOrUpdate }];
      
      const updatedTable = [...newItems, ...items];
      await mockStorage.setItem(key, JSON.stringify(updatedTable));
      
      const returnedData = Array.isArray(this.dataToInsertOrUpdate) ? newItems : newItems[0];

      setTimeout(() => {
        notifyChannel(this.table, 'INSERT', returnedData);
      }, 0);

      if (this.isSingle) {
        return { data: returnedData, error: null };
      }
      return { data: returnedData, error: null };
    }

    if (this.operation === 'update') {
      let updatedCount = 0;
      let lastUpdatedItem: any = null;
      const updatedTable = items.map((item: any) => {
        const matches = this.filters.every(f => {
          if (f.isContains) {
            return Array.isArray(item[f.col]) && f.val.every((v: any) => item[f.col].includes(v));
          }
          return String(item[f.col]) === String(f.val);
        });
        if (matches) {
          updatedCount++;
          const updated = { ...item, ...this.dataToInsertOrUpdate };
          lastUpdatedItem = updated;
          return updated;
        }
        return item;
      });
      await mockStorage.setItem(key, JSON.stringify(updatedTable));

      if (lastUpdatedItem) {
        setTimeout(() => {
          notifyChannel(this.table, 'UPDATE', lastUpdatedItem);
        }, 0);
      }

      if (this.isSingle) {
        return { data: lastUpdatedItem, error: null };
      }
      return { data: lastUpdatedItem, error: null };
    }

    if (this.operation === 'delete') {
      let deletedItem: any = null;
      const filteredTable = items.filter((item: any) => {
        const matches = this.filters.every(f => {
          if (f.isContains) {
            return Array.isArray(item[f.col]) && f.val.every((v: any) => item[f.col].includes(v));
          }
          return String(item[f.col]) === String(f.val);
        });
        if (matches) {
          deletedItem = item;
        }
        return !matches;
      });
      await mockStorage.setItem(key, JSON.stringify(filteredTable));

      if (deletedItem) {
        setTimeout(() => {
          notifyChannel(this.table, 'DELETE', deletedItem);
        }, 0);
      }

      return { data: null, error: null };
    }

    let filtered = [...items];
    this.filters.forEach(f => {
      filtered = filtered.filter((item: any) => {
        if (f.isContains) {
          return Array.isArray(item[f.col]) && f.val.every((v: any) => item[f.col].includes(v));
        }
        return String(item[f.col]) === String(f.val);
      });
    });

    if (this.orderCol) {
      filtered.sort((a: any, b: any) => {
        const valA = a[this.orderCol!];
        const valB = b[this.orderCol!];
        if (valA == null) return this.orderAsc ? 1 : -1;
        if (valB == null) return this.orderAsc ? -1 : 1;
        if (valA < valB) return this.orderAsc ? -1 : 1;
        if (valA > valB) return this.orderAsc ? 1 : -1;
        return 0;
      });
    }

    if (this.limitCount !== null) {
      filtered = filtered.slice(0, this.limitCount);
    }

    // Handle relations like profiles:user_id
    filtered = filtered.map((item: any) => {
      const resolved = { ...item };
      if (this.table === 'properties') {
        const prof = cachedProfiles.find((p: any) => p.id === item.user_id);
        if (prof) {
          resolved.profiles = prof;
        } else {
          resolved.profiles = {
            id: item.user_id,
            email: 'corretor@viva.com',
            full_name: 'Corretor VIVA',
            phone: '(11) 99999-9999',
            region: 'São Paulo - SP',
            avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces',
            created_at: new Date().toISOString()
          };
        }
      }
      return resolved;
    });

    if (this.isSingle) {
      return { data: filtered[0] || null, error: null };
    }

    return { data: filtered, error: null };
  }
}

const mockSupabase = {
  auth: mockAuth,
  from(table: string) {
    return {
      select(columns?: string) {
        return new MockBuilder(table, 'select').select(columns);
      },
      insert(data: any) {
        return new MockBuilder(table, 'insert', data);
      },
      update(data: any) {
        return new MockBuilder(table, 'update', data);
      },
      delete() {
        return new MockBuilder(table, 'delete');
      }
    };
  },
  channel(channelName: string) {
    return {
      on(_event: string, filterConfig: { event: string; schema: string; table: string; filter?: string }, callback: (payload: any) => void) {
        channelListeners.push({
          channelName,
          event: filterConfig.event || '*',
          table: filterConfig.table,
          filter: filterConfig.filter || '',
          callback
        });
        return this;
      },
      subscribe() {
        return { channelName };
      }
    };
  },
  removeChannel(channelObj: { channelName: string }) {
    if (!channelObj || !channelObj.channelName) return;
    const name = channelObj.channelName;
    for (let i = channelListeners.length - 1; i >= 0; i--) {
      if (channelListeners[i].channelName === name) {
        channelListeners.splice(i, 1);
      }
    }
  }
};

// Run migration from localStorage to IndexedDB on startup
if (isMock) {
  mockStorage.migrateFromLocalStorage().catch(() => {});
}

export const supabase = (isMock
  ? mockSupabase
  : createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )) as any;
