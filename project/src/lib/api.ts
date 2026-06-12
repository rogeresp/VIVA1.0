const API = '/api';
const userId = () => localStorage.getItem('viva_user_id') || '';

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'x-user-id': userId(),
    ...(options.headers as Record<string, string> || {}),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      errorMsg = err.error || errorMsg;
    } catch {
      const text = await res.text().catch(() => '');
      if (text.includes('<!doctype') || text.includes('<html')) {
        errorMsg = 'Servidor retornou HTML. Verifique se o backend está rodando.';
      }
    }
    throw new Error(errorMsg);
  }

  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

// ===== AUTH / PROFILE =====
export async function login(email: string, name?: string) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, name }),
  });
  localStorage.setItem('viva_user_id', res.id);
  return res;
}

export async function fetchProfile() {
  return request('/profile');
}

export async function updateProfile(data: any) {
  return request('/profile', { method: 'PUT', body: JSON.stringify(data) });
}

export async function fetchProfiles() {
  return request('/profiles');
}

// ===== OWNERS =====
export async function fetchOwners() {
  return request('/owners');
}

export async function createOwner(data: any) {
  return request('/owners', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateOwner(id: string, data: any) {
  return request(`/owners/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteOwner(id: string) {
  return request(`/owners/${id}`, { method: 'DELETE' });
}

// ===== CLIENTS =====
export async function fetchClients() {
  return request('/clients');
}

export async function createClient(data: any) {
  return request('/clients', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateClient(id: string, data: any) {
  return request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteClient(id: string) {
  return request(`/clients/${id}`, { method: 'DELETE' });
}

// ===== PROPERTIES =====
export async function fetchProperties(page?: number, limit?: number, search?: string, type?: string, status?: string, building_id?: string) {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (building_id) params.set('building_id', building_id);
  const qs = params.toString();
  return request(qs ? `/properties?${qs}` : '/properties');
}

export async function fetchPublicProperties(page?: number, limit?: number) {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return request(qs ? `/properties/public?${qs}` : '/properties/public');
}

export async function createProperty(data: any) {
  return request('/properties', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProperty(id: string, data: any) {
  return request(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteProperty(id: string) {
  return request(`/properties/${id}`, { method: 'DELETE' });
}

export async function batchImportProperties(properties: any[], owners?: any[]) {
  return request('/properties/batch-import', {
    method: 'POST',
    body: JSON.stringify({ properties, owners: owners || [] }),
  });
}

// ===== BUILDINGS =====
export async function fetchBuildings() {
  return request('/buildings');
}

export async function searchBuildings(query: string) {
  return request(`/buildings/search?q=${encodeURIComponent(query)}`);
}

export async function createBuilding(data: any) {
  return request('/buildings', { method: 'POST', body: JSON.stringify(data) });
}

// ===== EXCHANGES =====
export async function fetchExchanges() {
  return request('/exchanges');
}

export async function fetchPublicExchanges() {
  return request('/exchanges/public');
}

export async function createExchange(data: any) {
  return request('/exchanges', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateExchange(id: string, data: any) {
  return request(`/exchanges/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteExchange(id: string) {
  return request(`/exchanges/${id}`, { method: 'DELETE' });
}

// ===== MATCHES =====
export async function findExchangeMatches(exchangeId: string) {
  return request(`/exchanges/${exchangeId}/matches`);
}

export async function fetchMatches() {
  return request('/matches');
}

// ===== FEED =====
export async function fetchFeed(page = 1) {
  return request(`/feed?page=${page}&limit=20`);
}

export async function createFeedPost(data: any) {
  return request('/feed', { method: 'POST', body: JSON.stringify(data) });
}

// ===== CHAT =====
export async function fetchConversations() {
  return request('/conversations');
}

export async function createConversation(participants: string[]) {
  return request('/conversations', { method: 'POST', body: JSON.stringify({ participants }) });
}

export async function fetchMessages(conversationId: string) {
  return request(`/conversations/${conversationId}/messages`);
}

export async function sendMessage(conversationId: string, content: string) {
  return request(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

// ===== AI =====
export async function fetchAiTraining() {
  return request('/ai/training');
}

export async function updateAiTraining(data: any) {
  return request('/ai/training', { method: 'PUT', body: JSON.stringify(data) });
}

export async function aiCommand(command: string) {
  return request('/ai/command', { method: 'POST', body: JSON.stringify({ command }) });
}

export async function generateAd(propertyInfo: string, photos?: File[]) {
  const form = new FormData();
  form.append('propertyInfo', propertyInfo);
  if (photos) photos.forEach(p => form.append('photos', p));
  const res = await fetch(`${API}/ai/generate-ad`, {
    method: 'POST',
    headers: { 'x-user-id': userId() },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao gerar anúncio' }));
    throw new Error(err.error);
  }
  return res.json();
}

// ===== PDF UPLOAD (keep existing) =====
export interface UploadPreview {
  total: number;
  preview: any[];
}

export class AIFallbackError extends Error {
  rawText: string;
  constructor(rawText: string, message: string) {
    super(message);
    this.rawText = rawText;
    this.name = 'AIFallbackError';
  }
}

export async function uploadPDF(file: File, tipo: string = 'imoveis'): Promise<UploadPreview> {
  const form = new FormData();
  form.append('file', file);
  form.append('tipo', tipo);
  const res = await fetch(`${API}/upload`, {
    method: 'POST',
    headers: { 'x-user-id': userId() },
    body: form,
  });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch {
    throw new Error('Servidor retornou HTML. Verifique se o backend está rodando.');
  }
  if (!res.ok) {
    if (body.needsAI) throw new AIFallbackError(body.rawText || '', body.error || '');
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}

export async function confirmImport(chave: string) {
  return request('/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ chave }),
  });
}
