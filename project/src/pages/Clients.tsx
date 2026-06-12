import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Users, Plus, CreditCard as Edit2, Trash2, X, User, FileText, Home } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { BRL, label, FUNIL, PROFILES } from '../lib/constants';
import type { Client } from '../lib/types';

export default function Clients() {
  const { clients, properties, addClient, updateClient, deleteClient } = useData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [funilFilter, setFunilFilter] = useState<string>('todos');
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [detailTab, setDetailTab] = useState('info');

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      const name = searchParams.get('name') || '';
      const phone = searchParams.get('phone') || '';
      const city = searchParams.get('city') || '';
      setFormData({ name, phone, city, funil: 'frio' });
      setShowForm(true);
      navigate('/clientes', { replace: true });
    }
    if (searchParams.get('id')) {
      const client = clients.find(c => c.id === searchParams.get('id'));
      if (client) {
        setSelectedClient(client);
        setShowDetails(true);
      }
    }
  }, [searchParams, clients, navigate]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase());
      const matchFunil = funilFilter === 'todos' || c.funil === funilFilter;
      return matchSearch && matchFunil;
    });
  }, [clients, search, funilFilter]);

  const compatibleProperties = useMemo(() => {
    if (!selectedClient) return [];
    return properties.filter(p => {
      if (selectedClient.budget_max && p.sale_price && p.sale_price > selectedClient.budget_max) return false;
      if (selectedClient.budget_min && p.sale_price && p.sale_price < selectedClient.budget_min) return false;
      if (selectedClient.desired_city && p.city !== selectedClient.desired_city) return false;
      if (selectedClient.property_type && p.property_type !== selectedClient.property_type) return false;
      if (selectedClient.bedrooms && p.bedrooms && p.bedrooms < selectedClient.bedrooms) return false;
      if (selectedClient.sea_view && !p.sea_view) return false;
      return true;
    });
  }, [selectedClient, properties]);

  const openForm = (client?: Client) => {
    if (client) {
      setFormData(client);
      setSelectedClient(client);
    } else {
      setFormData({ funil: 'frio' });
      setSelectedClient(null);
    }
    setShowForm(true);
    setShowDetails(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedClient) {
        await updateClient(selectedClient.id, formData);
      } else {
        await addClient(formData);
      }
      setShowForm(false);
      setFormData({});
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja deletar este cliente?')) {
      try {
        await deleteClient(id);
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="section-card border-0 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="page-header-box">
              <div className="icon-box">
                <Users className="w-6 h-6 text-viva-500" />
              </div>
              <div>
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-bold text-primary border-b-2 border-viva-600">
                    Clientes
                  </h1>
                </div>
                <p className="text-xs text-muted mt-1">{clients.length} cliente(s)</p>
              </div>
            </div>
          </div>

          <button onClick={() => openForm()} className="btn-primary gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full"
            />
          </div>
          <select
            value={funilFilter}
            onChange={(e) => setFunilFilter(e.target.value)}
            className="select w-auto"
          >
            <option value="todos">Todos os funis</option>
            {FUNIL.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Client Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="empty-state">
                <Users className="empty-icon" />
                <p>Nenhum cliente encontrado</p>
              </div>
            </div>
          ) : (
            filteredClients.map(client => (
              <div
                key={client.id}
                onClick={() => {
                  setSelectedClient(client);
                  setShowDetails(true);
                }}
                className="card cursor-pointer group transition-all overflow-hidden !p-0"
              >
                <div className="p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-primary text-sm">{client.name}</h3>
                      <div className="mt-2">
                        <span className={`badge ${
                          FUNIL.find(f => f.value === client.funil)?.cls || ''
                        }`}>
                          {label(FUNIL, client.funil)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 text-xs text-muted">
                    {client.phone && (
                      <p><span className="text-muted">Tel:</span> {client.phone}</p>
                    )}
                    {client.email && (
                      <p><span className="text-muted">Email:</span> {client.email}</p>
                    )}
                    {client.city && (
                      <p><span className="text-muted">Cidade:</span> {client.city}</p>
                    )}
                  </div>

                  {/* Description preview */}
                  {client.description && (
                    <div className="pt-2 divider border-t">
                      <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                        {client.description}
                      </p>
                    </div>
                  )}

                  {/* Payment conditions preview */}
                  {((client as any).paymentConditions || client.budget_max || client.desired_city || client.desired_neighborhood || client.bedrooms) && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {(client as any).paymentConditions && (
                        <span className="text-[10px] dark:bg-emerald-900/30 bg-emerald-100 dark:text-emerald-300 text-emerald-700 px-1.5 py-0.5 rounded max-w-[180px] truncate">
                          💳 {(client as any).paymentConditions}
                        </span>
                      )}
                      {client.budget_max && (
                        <span className="text-[10px] bg-white/[0.05] text-muted px-1.5 py-0.5 rounded">
                          até {BRL(client.budget_max)}
                        </span>
                      )}
                      {client.desired_city && (
                        <span className="text-[10px] bg-white/[0.05] text-muted px-1.5 py-0.5 rounded">
                          {client.desired_city}
                        </span>
                      )}
                      {client.desired_neighborhood && (
                        <span className="text-[10px] bg-white/[0.05] text-muted px-1.5 py-0.5 rounded">
                          {client.desired_neighborhood}
                        </span>
                      )}
                      {client.bedrooms && (
                        <span className="text-[10px] bg-white/[0.05] text-muted px-1.5 py-0.5 rounded">
                          {client.bedrooms}Q
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1 px-5 pb-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openForm(client);
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.08] transition-colors text-muted"
                  >
                    <Edit2 className="w-3.5 h-3.5 inline mr-1" />
                    Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(client.id);
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                    Deletar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedClient && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 divider border-b px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">{selectedClient.name}</h2>
              <button onClick={() => setShowDetails(false)} className="p-1 hover:bg-white/[0.04] rounded">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Tabs */}
            <div>
              <div className="flex divider border-b">
                {[
                  { id: 'info', label: 'Informações', icon: User },
                  { id: 'descricao', label: 'Descrição', icon: FileText },
                  { id: 'perfil', label: 'Condições de Pagamento', icon: Home },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all ${
                      detailTab === tab.id
                        ? 'border-viva-500 text-viva-400 dark:text-viva-400 text-viva-600'
                        : 'border-transparent text-muted hover:text-primary'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-6">
                {/* Info Tab */}
                {detailTab === 'info' && (
                  <div>
                    <div>
                      <h3 className="section-label">Informações Gerais</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted">Telefone</p>
                          <p className="text-primary">{selectedClient.phone || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted">WhatsApp</p>
                          <p className="text-primary">{selectedClient.whatsapp || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted">Email</p>
                          <p className="text-primary">{selectedClient.email || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted">Cidade</p>
                          <p className="text-primary">{selectedClient.city || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted">Funil</p>
                          <p className={`badge mt-1 ${FUNIL.find(f => f.value === selectedClient.funil)?.cls || ''}`}>
                            {label(FUNIL, selectedClient.funil)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted">Tipo de Perfil</p>
                          <p className="text-primary">{label(PROFILES, selectedClient.profile_type) || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {selectedClient.notes && (
                      <div>
                        <h3 className="section-label">Notas</h3>
                        <p className="text-sm text-muted whitespace-pre-wrap">{selectedClient.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Descrição Tab */}
                {detailTab === 'descricao' && (
                  <div>
                    <h3 className="section-label">Descrição do Cliente</h3>
                    {selectedClient.description ? (
                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">{selectedClient.description}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="w-10 h-10 text-muted mb-3" />
                        <p className="text-sm text-muted">Nenhuma descrição cadastrada para este cliente.</p>
                        <p className="text-xs text-muted mt-1">Use a IA para cadastrar clientes com características automaticamente.</p>
                      </div>
                    )}
                  </div>
                )}

                    {/* Condições de Pagamento Tab */}
                    {detailTab === 'perfil' && (
                      <div>
                        {(selectedClient as any).paymentConditions && (
                          <div className="mb-6">
                            <h3 className="section-label">Condições de Pagamento</h3>
                            <div className="dark:bg-emerald-900/20 bg-emerald-50 border dark:border-emerald-800/30 border-emerald-200 rounded-xl p-4">
                              <p className="text-sm dark:text-emerald-200 text-emerald-800 font-medium">{(selectedClient as any).paymentConditions}</p>
                            </div>
                          </div>
                        )}

                        {(selectedClient.budget_min || selectedClient.budget_max || selectedClient.desired_city) ? (
                          <div>
                            <h3 className="section-label">Preferências do Imóvel</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                          {selectedClient.budget_min && (
                            <div>
                              <p className="text-muted">Valor Mínimo</p>
                              <p className="text-primary">{BRL(selectedClient.budget_min)}</p>
                            </div>
                          )}
                          {selectedClient.budget_max && (
                            <div>
                              <p className="text-muted">Valor Máximo</p>
                              <p className="text-primary">{BRL(selectedClient.budget_max)}</p>
                            </div>
                          )}
                          {selectedClient.desired_city && (
                            <div>
                              <p className="text-muted">Cidade Desejada</p>
                              <p className="text-primary">{selectedClient.desired_city}</p>
                            </div>
                          )}
                          {selectedClient.desired_neighborhood && (
                            <div>
                              <p className="text-muted">Bairro Desejado</p>
                              <p className="text-primary">{selectedClient.desired_neighborhood}</p>
                            </div>
                          )}
                          {selectedClient.property_type && (
                            <div>
                              <p className="text-muted">Tipo de Imóvel</p>
                              <p className="text-primary capitalize">{selectedClient.property_type}</p>
                            </div>
                          )}
                          {selectedClient.bedrooms && (
                            <div>
                              <p className="text-muted">Quartos Mínimos</p>
                              <p className="text-primary">{selectedClient.bedrooms}</p>
                            </div>
                          )}
                          {selectedClient.suites && (
                            <div>
                              <p className="text-muted">Suítes</p>
                              <p className="text-primary">{selectedClient.suites}</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {selectedClient.garage && <span className="badge bg-white/[0.05] text-muted">Garagem</span>}
                          {selectedClient.sea_view && <span className="badge bg-white/[0.05] text-muted">Vista Mar</span>}
                          {selectedClient.mountain_view && <span className="badge bg-white/[0.05] text-muted">Vista Serra</span>}
                          {selectedClient.furnished && <span className="badge bg-white/[0.05] text-muted">Mobiliado</span>}
                          {selectedClient.accepts_reform && <span className="badge bg-white/[0.05] text-muted">Aceita Reforma</span>}
                          {selectedClient.used_property && <span className="badge bg-white/[0.05] text-muted">Usado</span>}
                          {selectedClient.new_development && <span className="badge bg-white/[0.05] text-muted">Lançamento</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Home className="w-10 h-10 text-muted mb-3" />
                        <p className="text-sm text-muted">Nenhuma preferência de compra cadastrada.</p>
                      </div>
                    )}

                    {compatibleProperties.length > 0 && (
                      <div>
                        <h3 className="section-label">Imóveis Compatíveis</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {compatibleProperties.map(prop => (
                            <div key={prop.id} className="p-3 bg-white/[0.03] rounded-lg text-sm">
                              <p className="font-medium text-primary">{prop.code} - {prop.street || 'Endereço não informado'}</p>
                              <p className="text-xs text-muted mt-1">
                                {prop.bedrooms}Q • {prop.bathrooms || 0}B • {BRL(prop.sale_price)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 divider border-t">
                  <button
                    onClick={() => {
                      setShowDetails(false);
                      openForm(selectedClient);
                    }}
                    className="btn-primary flex-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setShowDetails(false);
                      handleDelete(selectedClient.id);
                    }}
                    className="btn-danger flex-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Deletar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex justify-end">
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/[0.04] rounded -mr-3 -mt-1">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-6">
              <h2 className="text-xl font-bold text-primary mb-2">
                {selectedClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              {/* Basic Info */}
              <div>
                <h3 className="section-label">Informações Básicas</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Telefone"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input"
                    />
                    <input
                      type="text"
                      placeholder="WhatsApp"
                      value={formData.whatsapp || ''}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="input"
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* Buy Profile */}
              <div>
                <h3 className="section-label">Perfil de Compra</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted mb-1 block">Valor mínimo (R$)</label>
                      <input
                        type="number"
                        placeholder="0,00"
                        value={formData.budget_min || ''}
                        onChange={(e) => setFormData({ ...formData, budget_min: e.target.value ? Number(e.target.value) : undefined })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted mb-1 block">Valor máximo (R$)</label>
                      <input
                        type="number"
                        placeholder="0,00"
                        value={formData.budget_max || ''}
                        onChange={(e) => setFormData({ ...formData, budget_max: e.target.value ? Number(e.target.value) : undefined })}
                        className="input"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Cidade Desejada"
                      value={formData.desired_city || ''}
                      onChange={(e) => setFormData({ ...formData, desired_city: e.target.value })}
                      className="input"
                    />
                    <input
                      type="text"
                      placeholder="Bairro Desejado"
                      value={formData.desired_neighborhood || ''}
                      onChange={(e) => setFormData({ ...formData, desired_neighborhood: e.target.value })}
                      className="input"
                    />
                  </div>
                  <select
                    value={formData.property_type || ''}
                    onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                    className="input"
                  >
                    <option value="">Tipo de Imóvel</option>
                    <option value="apartamento">Apartamento</option>
                    <option value="casa">Casa</option>
                    <option value="terreno">Terreno</option>
                    <option value="sala_comercial">Sala Comercial</option>
                    <option value="loja">Loja</option>
                    <option value="cobertura">Cobertura</option>
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Quartos Mínimos"
                      value={formData.bedrooms || ''}
                      onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value ? Number(e.target.value) : undefined })}
                      className="input"
                    />
                    <input
                      type="number"
                      placeholder="Suítes"
                      value={formData.suites || ''}
                      onChange={(e) => setFormData({ ...formData, suites: e.target.value ? Number(e.target.value) : undefined })}
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.sea_view || false}
                        onChange={(e) => setFormData({ ...formData, sea_view: e.target.checked })}
                        className="w-4 h-4 rounded dark:border-slate-600 border-gray-300 dark:bg-slate-800 bg-white"
                      />
                      <span className="text-sm text-muted">Vista mar</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.mountain_view || false}
                        onChange={(e) => setFormData({ ...formData, mountain_view: e.target.checked })}
                        className="w-4 h-4 rounded dark:border-slate-600 border-gray-300 dark:bg-slate-800 bg-white"
                      />
                      <span className="text-sm text-muted">Vista serra</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.furnished || false}
                        onChange={(e) => setFormData({ ...formData, furnished: e.target.checked })}
                        className="w-4 h-4 rounded dark:border-slate-600 border-gray-300 dark:bg-slate-800 bg-white"
                      />
                      <span className="text-sm text-muted">Mobiliado</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.accepts_reform || false}
                        onChange={(e) => setFormData({ ...formData, accepts_reform: e.target.checked })}
                        className="w-4 h-4 rounded dark:border-slate-600 border-gray-300 dark:bg-slate-800 bg-white"
                      />
                      <span className="text-sm text-muted">Aceita reforma</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.garage || false}
                        onChange={(e) => setFormData({ ...formData, garage: e.target.checked })}
                        className="w-4 h-4 rounded dark:border-slate-600 border-gray-300 dark:bg-slate-800 bg-white"
                      />
                      <span className="text-sm text-muted">Garagem</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.used_property || false}
                        onChange={(e) => setFormData({ ...formData, used_property: e.target.checked })}
                        className="w-4 h-4 rounded dark:border-slate-600 border-gray-300 dark:bg-slate-800 bg-white"
                      />
                      <span className="text-sm text-muted">Usado</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.new_development || false}
                        onChange={(e) => setFormData({ ...formData, new_development: e.target.checked })}
                        className="w-4 h-4 rounded dark:border-slate-600 border-gray-300 dark:bg-slate-800 bg-white"
                      />
                      <span className="text-sm text-muted">Lançamento</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Funil */}
              <div>
                <h3 className="section-label">Funil</h3>
                <div className="flex gap-2">
                  {FUNIL.map(f => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, funil: f.value })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        formData.funil === f.value
                          ? f.cls
                          : 'bg-white/[0.03] text-muted hover:bg-white/[0.04]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Type */}
              <div>
                <h3 className="section-label">Tipo de Perfil</h3>
                <select
                  value={formData.profile_type || ''}
                  onChange={(e) => setFormData({ ...formData, profile_type: e.target.value as any })}
                  className="input"
                >
                  <option value="">Selecionar tipo...</option>
                  {PROFILES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <h3 className="section-label">Descrição</h3>
                <textarea
                  placeholder="Descrição gerada pela IA automaticamente..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input resize-none h-20"
                />
              </div>

              {/* Payment Conditions */}
              <div>
                <h3 className="section-label">Condições de Pagamento</h3>
                <textarea
                  placeholder="Ex: Pagamento à vista, financiamento 80%, entrada de R$ 200 mil..."
                  value={(formData as any).paymentConditions || ''}
                  onChange={(e) => setFormData({ ...formData, paymentConditions: e.target.value })}
                  className="input resize-none h-20"
                />
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData as any).acceptsFinancing || false}
                      onChange={(e) => setFormData({ ...formData, acceptsFinancing: e.target.checked })}
                      className="w-4 h-4 rounded accent-viva-500"
                    />
                    <span className="text-xs text-secondary">Financiamento Bancário</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Prazo direto:</span>
                    <div className="flex flex-wrap gap-1">
                      {[12,24,36,48,60,72,84,100].map(n => {
                        const selected = ((formData as any).installments || '').split(',').filter(Boolean).includes(String(n));
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              const current = ((formData as any).installments || '').split(',').filter(Boolean);
                              const next = selected ? current.filter(x => x !== String(n)) : [...current, String(n)];
                              setFormData({ ...formData, installments: next.join(',') });
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                              selected
                                ? 'bg-viva-500 text-white border-viva-500'
                                : 'text-secondary border-[rgba(212,200,184,0.5)] dark:border-[rgba(26,47,31,0.5)] hover:border-viva-400'
                            }`}
                          >
                            {n}x
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 className="section-label">Notas</h3>
                <textarea
                  placeholder="Observações adicionais..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input resize-none h-20"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 divider border-t">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {selectedClient ? 'Salvar Alterações' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
