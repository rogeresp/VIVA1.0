import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import * as api from '../lib/api';
import type { Client, Property, Owner, Exchange, Bank, Building, AIAction } from '../lib/types';

interface Ctx {
  clients: Client[]; properties: Property[]; owners: Owner[]; exchanges: Exchange[]; banks: Bank[]; buildings: Building[]; aiActions: AIAction[]; totalProperties: number;
  refreshAll: () => Promise<void>;
  fetchPropertiesPage: (page: number, limit: number, search?: string, type?: string, status?: string, building_id?: string) => Promise<void>;
  addClient: (c: Partial<Client>) => Promise<Client>; updateClient: (id: string, c: Partial<Client>) => Promise<void>; deleteClient: (id: string) => Promise<void>;
  addProperty: (p: Partial<Property>) => Promise<Property>; updateProperty: (id: string, p: Partial<Property>) => Promise<void>; deleteProperty: (id: string) => Promise<void>;
  addOwner: (o: Partial<Owner>) => Promise<Owner>; updateOwner: (id: string, o: Partial<Owner>) => Promise<void>; deleteOwner: (id: string) => Promise<void>;
  addExchange: (e: Partial<Exchange>) => Promise<Exchange>; updateExchange: (id: string, e: Partial<Exchange>) => Promise<void>; deleteExchange: (id: string) => Promise<void>;
  addBank: (b: Partial<Bank>) => Promise<Bank>; updateBank: (id: string, b: Partial<Bank>) => Promise<void>; deleteBank: (id: string) => Promise<void>;
  addBuilding: (b: Partial<Building>) => Promise<Building>; updateBuilding: (id: string, b: Partial<Building>) => Promise<void>; deleteBuilding: (id: string) => Promise<void>;
}
const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [aiActions, setAIActions] = useState<AIAction[]>([]);
  const [totalProperties, setTotalProperties] = useState(0);

  const fetchPropertiesPage = useCallback(async (page: number, limit: number, search?: string, type?: string, status?: string, building_id?: string) => {
    try {
      const res = await api.fetchProperties(page, limit, search, type, status, building_id) as any;
      if (res && res.data) {
        setProperties(res.data as Property[]);
        setTotalProperties(res.total);
        return;
      }
    } catch {}
    try {
      let data: any[] = (await supabase.from('properties').select('*').order('created_at', { ascending: false })).data || [];
      data = data.filter((p: any) => !type || p.property_type === type);
      data = data.filter((p: any) => !status || p.status === status);
      data = data.filter((p: any) => !building_id || p.building_id === building_id || p.buildingId === building_id);
      if (search) {
        const s = search.toLowerCase();
        data = data.filter((p: any) =>
          (p.code && p.code.toLowerCase().includes(s)) ||
          (p.neighborhood && p.neighborhood.toLowerCase().includes(s)) ||
          (p.city && p.city.toLowerCase().includes(s))
        );
      }
      setTotalProperties(data.length);
      setProperties(data.slice((page - 1) * limit, page * limit) as Property[]);
    } catch {
      setProperties([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!profile) return;
    try {
      const [c, o, e, b, bld] = await Promise.all([
        api.fetchClients().catch(() => []),
        api.fetchOwners().catch(() => []),
        api.fetchExchanges().catch(() => []),
        supabase.from('banks').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).then(r => r.data || []),
        api.fetchBuildings().catch(() => []),
      ]);
      setClients(c as Client[]);
      setOwners(o as Owner[]);
      setExchanges(e as Exchange[]);
      setBanks(b as Bank[]);
      setBuildings(bld as Building[]);
      await fetchPropertiesPage(1, 10);
    } catch {
      const tables = ['clients', 'owners', 'exchanges', 'banks', 'buildings', 'properties'] as const;
      const [c, o, e, b, bld, props] = await Promise.all(tables.map(t =>
        supabase.from(t).select('*').order('created_at', { ascending: false }).then(r => r.data || [])
      ));
      setClients(c as any); setOwners(o as any); setExchanges(e as any); setBanks(b as any); setBuildings(bld as any);
      setProperties(props as any); setTotalProperties((props as any[]).length);
    }
    const { data } = await supabase.from('ai_actions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(10);
    setAIActions((data as AIAction[]) || []);
  }, [profile, fetchPropertiesPage]);

  const addClient = async (c: Partial<Client>) => {
    try {
      const r = (await api.createClient(c)) as Client;
      setClients(p => [r, ...p]); return r;
    } catch {
      const { data, error } = await supabase.from('clients').insert({ ...c, user_id: profile!.id }).select().single();
      if (error) throw error; const r = data as Client; setClients(p => [r, ...p]); return r;
    }
  };
  const updateClient = async (id: string, c: Partial<Client>) => {
    try { await api.updateClient(id, c); } catch { await supabase.from('clients').update(c).eq('id', id); }
    setClients(p => p.map(i => i.id === id ? { ...i, ...c } : i));
  };
  const deleteClient = async (id: string) => {
    try { await api.deleteClient(id); } catch { await supabase.from('clients').delete().eq('id', id); }
    setClients(p => p.filter(i => i.id !== id));
  };

  const addProperty = async (p: Partial<Property>) => {
    try {
      console.log('addProperty: trying API', p);
      const r = (await api.createProperty(p)) as Property;
      console.log('addProperty: API success', r);
      setProperties(p2 => [r, ...p2]); return r;
    } catch (e: any) {
      console.log('addProperty: API failed', e?.message || e);
      const code = `IMV-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase.from('properties').insert({ ...p, user_id: profile!.id, code }).select().single();
      if (error) throw error; const r = data as Property; setProperties(p2 => [r, ...p2]); return r;
    }
  };
  const updateProperty = async (id: string, p: Partial<Property>) => {
    try { await api.updateProperty(id, p); } catch { await supabase.from('properties').update(p).eq('id', id); }
    setProperties(p2 => p2.map(i => i.id === id ? { ...i, ...p } : i));
  };
  const deleteProperty = async (id: string) => {
    try { await api.deleteProperty(id); } catch { await supabase.from('properties').delete().eq('id', id); }
    setProperties(px => px.filter(i => i.id !== id));
  };

  const addOwner = async (o: Partial<Owner>) => {
    try {
      const r = (await api.createOwner(o)) as Owner;
      setOwners(p => [r, ...p]); return r;
    } catch {
      const { data, error } = await supabase.from('owners').insert({ ...o, user_id: profile!.id }).select().single();
      if (error) throw error; const r = data as Owner; setOwners(p => [r, ...p]); return r;
    }
  };
  const updateOwner = async (id: string, o: Partial<Owner>) => {
    try { await api.updateOwner(id, o); } catch { await supabase.from('owners').update(o).eq('id', id); }
    setOwners(p => p.map(i => i.id === id ? { ...i, ...o } : i));
  };
  const deleteOwner = async (id: string) => {
    try { await api.deleteOwner(id); } catch { await supabase.from('owners').delete().eq('id', id); }
    setOwners(p => p.filter(i => i.id !== id));
  };

  const addExchange = async (e: Partial<Exchange>) => {
    try {
      const r = (await api.createExchange(e)) as Exchange;
      setExchanges(p => [r, ...p]); return r;
    } catch {
      const { data, error } = await supabase.from('exchanges').insert({ ...e, user_id: profile!.id }).select().single();
      if (error) throw error; const r = data as Exchange; setExchanges(p => [r, ...p]); return r;
    }
  };
  const updateExchange = async (id: string, e: Partial<Exchange>) => {
    try { await api.updateExchange(id, e); } catch { await supabase.from('exchanges').update(e).eq('id', id); }
    setExchanges(p => p.map(i => i.id === id ? { ...i, ...e } : i));
  };
  const deleteExchange = async (id: string) => {
    try { await api.deleteExchange(id); } catch { await supabase.from('exchanges').delete().eq('id', id); }
    setExchanges(p => p.filter(i => i.id !== id));
  };

  const addBank = async (b: Partial<Bank>) => {
    const { data, error } = await supabase.from('banks').insert({ ...b, user_id: profile!.id }).select().single();
    if (error) throw error; const r = data as Bank; setBanks(p => [r, ...p]); return r;
  };
  const updateBank = async (id: string, b: Partial<Bank>) => {
    const { error } = await supabase.from('banks').update(b).eq('id', id);
    if (error) throw error; setBanks(p => p.map(i => i.id === id ? { ...i, ...b } : i));
  };
  const deleteBank = async (id: string) => {
    const { error } = await supabase.from('banks').delete().eq('id', id);
    if (error) throw error; setBanks(p => p.filter(i => i.id !== id));
  };

  const addBuilding = async (b: Partial<Building>) => {
    try {
      const r = (await api.createBuilding(b)) as Building;
      setBuildings(p => [r, ...p]); return r;
    } catch {
      const { data, error } = await supabase.from('buildings').insert({ ...b, user_id: profile!.id }).select().single();
      if (error) throw error; const r = data as Building; setBuildings(p => [r, ...p]); return r;
    }
  };
  const updateBuilding = async (id: string, b: Partial<Building>) => {
    try { const { error } = await supabase.from('buildings').update(b).eq('id', id); if (error) throw error; } catch {}
    setBuildings(p => p.map(i => i.id === id ? { ...i, ...b } : i));
  };
  const deleteBuilding = async (id: string) => {
    try { await supabase.from('buildings').delete().eq('id', id); } catch {}
    setBuildings(p => p.filter(i => i.id !== id));
  };

  return (
    <DataContext.Provider value={{
      clients, properties, owners, exchanges, banks, buildings, aiActions, totalProperties, refreshAll, fetchPropertiesPage,
      addClient, updateClient, deleteClient,
      addProperty, updateProperty, deleteProperty,
      addOwner, updateOwner, deleteOwner,
      addExchange, updateExchange, deleteExchange,
      addBank, updateBank, deleteBank,
      addBuilding, updateBuilding, deleteBuilding,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => { const c = useContext(DataContext); if (!c) throw new Error('useData outside provider'); return c; };
