import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, CreditCard as Edit2, Trash2, MapPin, BadgeCheck, X, UserCheck, Users, Plus, Target, Phone, MessageCircle, Camera, Star, ImageIcon, Building as BuildingIcon, Bed, Car, Bath, CheckSquare, Square, Send } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import type { Property, Owner, Building } from '../lib/types';
import { PROP_TYPES, CATEGORIES, STATUSES, STATES, AMENITIES, BAIRROS, BRL, label } from '../lib/constants';
import { supabase } from '../lib/supabase';

export default function Properties() {
  const { properties, owners, clients, buildings, addProperty, updateProperty, deleteProperty, addOwner, addBuilding, refreshAll, totalProperties, fetchPropertiesPage } = useData();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('basico');
  const [loading, setLoading] = useState(false);
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [ownerForm, setOwnerForm] = useState({ name: '', phone: '', email: '', city: '', cpf_cnpj: '' });
  const [showInlineOwner, setShowInlineOwner] = useState(false);
  const [inlineOwnerForm, setInlineOwnerForm] = useState({ name: '', phone: '', city: '' });
  const [showInlineBuilding, setShowInlineBuilding] = useState(false);
  const [inlineBuildingForm, setInlineBuildingForm] = useState({ name: '', street: '', number: '', address: '', neighborhood: '', city: '' });
  const [buildingSearch, setBuildingSearch] = useState('');
  const [showBuildingDropdown, setShowBuildingDropdown] = useState(false);
  const [bairroSearch, setBairroSearch] = useState('');
  const [showBairroDropdown, setShowBairroDropdown] = useState(false);
  const [bairroCustom, setBairroCustom] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [selectedPropertyForMatch, setSelectedPropertyForMatch] = useState<Property | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [viewMode, setViewMode] = useState<'imoveis' | 'proprietarios'>('imoveis');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [lightboxProps, setLightboxProps] = useState<{ photos: string[]; index: number } | null>(null);
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());
  const [filterBuilding, setFilterBuilding] = useState('');

  // Campaign selection
  const [selectedForCampaign, setSelectedForCampaign] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('campaign_properties') || '[]')); } catch { return new Set<string>(); }
  });
  const selectedRef = useRef(selectedForCampaign);
  useEffect(() => { selectedRef.current = selectedForCampaign; }, [selectedForCampaign]);

  const [form, setForm] = useState<Partial<Property>>({
    property_type: 'apartamento',
    category: 'venda',
    status: 'disponivel',
    visibility: 'privado',
  });

  useEffect(() => {
    refreshAll();
    if (searchParams.get('new') === 'true') {
      const city = searchParams.get('city') || '';
      const value = searchParams.get('value');
      setForm({
        property_type: 'apartamento',
        category: 'venda',
        status: 'disponivel',
        visibility: 'privado',
        city,
        sale_price: value ? parseFloat(value) : undefined,
      });
      setShowModal(true);
      navigate('/imoveis', { replace: true });
    }
  }, [searchParams, refreshAll, navigate]);

  useEffect(() => {
    fetchPropertiesPage(currentPage, pageSize, search || undefined, filterType || undefined, filterStatus || undefined, filterBuilding || undefined);
  }, [currentPage, search, filterType, filterStatus, fetchPropertiesPage, filterBuilding]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, filterStatus, filterBuilding]);

  const totalPages = Math.max(1, Math.ceil(totalProperties / pageSize));
  const pageNumbers: number[] = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  const filtered = properties;

  const filteredOwners = useMemo(() => {
    return owners.filter(o => 
      o.name.toLowerCase().includes(ownerSearch.toLowerCase()) ||
      o.phone?.includes(ownerSearch) ||
      o.email?.toLowerCase().includes(ownerSearch.toLowerCase()) ||
      o.cpf_cnpj?.includes(ownerSearch)
    );
  }, [owners, ownerSearch]);

  const findCompatibleClients = (property: Property) => {
    return clients.filter(c => {
      if (c.funil === 'quente' || c.funil === 'morno') {
        if (c.budget_max && property.sale_price && property.sale_price > c.budget_max) return false;
        if (c.budget_min && property.sale_price && property.sale_price < c.budget_min) return false;
        if (c.desired_city && property.city && !property.city.toLowerCase().includes(c.desired_city.toLowerCase())) return false;
        if (c.property_type && property.property_type !== c.property_type) return false;
        if (c.bedrooms && property.bedrooms && property.bedrooms < c.bedrooms) return false;
        if (c.sea_view && !property.sea_view) return false;
        return true;
      }
      return false;
    });
  };

  const handleOpen = (property?: Property) => {
    if (property) {
      setEditingId(property.id);
      setForm(property);
      setPhotoUrls(property.photos || []);
      setCoverIndex(0);
    } else {
      setEditingId(null);
      setForm({
        property_type: 'apartamento',
        category: 'venda',
        status: 'disponivel',
        visibility: 'privado',
      });
      setPhotoUrls([]);
      setCoverIndex(0);
    }
    setActiveTab('basico');
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingId(null);
    setShowInlineOwner(false);
    setInlineOwnerForm({ name: '', phone: '', city: '' });
    setShowInlineBuilding(false);
    setInlineBuildingForm({ name: '', address: '', neighborhood: '', city: '' });
    setBuildingSearch('');
    setBairroSearch('');
    setBairroCustom(false);
    setPhotoUrls([]);
    setCoverIndex(0);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Put cover first, rest after
      const orderedPhotos = photoUrls.length > 0
        ? [photoUrls[coverIndex], ...photoUrls.filter((_, i) => i !== coverIndex)]
        : [];
      const payload = { ...form, photos: orderedPhotos, owner_id: form.owner_id || undefined, building_id: form.building_id || undefined, updated_at: new Date().toISOString() };
      if (editingId) {
        await updateProperty(editingId, payload);
      } else {
        await addProperty(payload);
      }
      handleClose();
    } catch (error: any) {
      console.error(error);
      alert(error?.message || error || 'Erro ao salvar imóvel');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setPhotoUrls(prev => [...prev, url]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== idx));
    setCoverIndex(prev => {
      if (idx === prev) return 0;
      if (idx < prev) return prev - 1;
      return prev;
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja deletar este imóvel?')) {
      try {
        await deleteProperty(id);
      } catch (error) {
        console.error(error);
      }
    }
  };

  async function toggleCampaignProperty(id: string) {
    if (selectedRef.current.has(id)) {
      setSelectedForCampaign(prev => {
        const next = new Set(prev);
        next.delete(id);
        localStorage.setItem('campaign_properties', JSON.stringify([...next]));
        return next;
      });
      return;
    }
    try {
      const uid = localStorage.getItem('viva_user_id') || '';
      const res = await fetch(`/api/campaign/last-send/${id}`, { headers: uid ? { 'x-user-id': uid } : {} });
      const data = await res.json();
      if (data.lastSend) {
        const days = Math.floor((Date.now() - new Date(data.lastSend).getTime()) / (1000 * 60 * 60 * 24));
        if (days < 7 && !confirm(`Este imóvel já recebeu campanha há ${days} dia(s). Tem certeza que quer selecionar de novo?`)) {
          return;
        }
      }
    } catch {}
    setSelectedForCampaign(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('campaign_properties', JSON.stringify([...next]));
      return next;
    });
  }

  function clearCampaignSelection() {
    setSelectedForCampaign(new Set());
    localStorage.removeItem('campaign_properties');
  }

  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    const owner = await addOwner(ownerForm);
    if (showModal) {
      setForm({ ...form, owner_id: owner.id });
    }
    setShowOwnerModal(false);
    setOwnerForm({ name: '', phone: '', email: '', city: '', cpf_cnpj: '' });
  };

  const handleShowMatches = (property: Property) => {
    setSelectedPropertyForMatch(property);
    setShowMatchModal(true);
  };

  const getOwner = (ownerId?: string) => {
    if (!ownerId) return null;
    return owners.find(o => o.id === ownerId) || null;
  };
  const getBuilding = (buildingId?: string) => {
    if (!buildingId) return null;
    return buildings.find(b => b.id === buildingId) || null;
  };
  const propBuildingId = (p: any) => p.building_id || p.buildingId;

  const statusColors: Record<string, string> = {
    disponivel: 'bg-emerald-500/15 text-emerald-400',
    reservado: 'bg-amber-500/15 text-amber-400',
    vendido: 'bg-red-500/15 text-red-400',
  };

  const visibilityLabels: Record<string, string> = {
    privado: 'Privado',
    banco: 'Banco',
    rede: 'Rede Nacional',
  };

  const visibilityColors: Record<string, string> = {
    privado: 'bg-white/[0.05] text-muted',
    banco: 'bg-amber-500/15 text-amber-400',
    rede: 'bg-viva-500/15 text-viva-400',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="section-card border-0 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="page-header-box">
                <div className="icon-box">
                  <Building2 className="w-6 h-6 text-viva-500" />
                </div>
                <div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setViewMode('imoveis')}
                      className={`text-2xl font-bold transition-all ${
                        viewMode === 'imoveis'
                          ? 'text-primary border-b-2 border-viva-600'
                          : 'text-muted hover:text-secondary'
                      }`}
                    >
                      Imóveis
                    </button>
                    <button
                      onClick={() => setViewMode('proprietarios')}
                      className={`text-2xl font-bold transition-all ${
                        viewMode === 'proprietarios'
                          ? 'text-primary border-b-2 border-viva-600'
                          : 'text-muted hover:text-secondary'
                      }`}
                    >
                      Proprietários
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {viewMode === 'imoveis'
                      ? `${filtered.length} imóveis de ${totalProperties}`
                      : `${filteredOwners.length} proprietário(s) encontrado(s)`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {viewMode === 'proprietarios' ? (
                <button onClick={() => setShowOwnerModal(true)} className="btn-primary gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Proprietário
                </button>
              ) : (
                <>
                  <button onClick={() => handleOpen()} className="btn-primary gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Imóvel
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Filters */}
          {viewMode === 'imoveis' ? (
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por código, bairro ou cidade..."
                  className="input w-full"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="select w-auto"
              >
              <option value="">Todos os tipos</option>
              {PROP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="select w-auto"
            >
              <option value="">Todos os status</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
                placeholder="Buscar por nome, telefone, email ou CPF/CNPJ..."
                className="input w-full"
              />
            </div>
          </div>
        )}

        {/* Building filter indicator */}
        {viewMode === 'imoveis' && filterBuilding && (() => {
          const b = getBuilding(filterBuilding);
          return (
            <div className="flex items-center gap-3 px-6 py-3 bg-viva-500/10 border-b border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.4)]">
              <BuildingIcon className="w-4 h-4 text-viva-500" />
              <span className="text-sm font-medium text-primary">
                Filtrando por: <span className="text-viva-500">{b?.name || filterBuilding}</span>
              </span>
              <button
                onClick={() => setFilterBuilding('')}
                className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.05] text-secondary hover:bg-white/[0.08] border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.4)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Mostrar todos
              </button>
            </div>
          );
        })()}

        {/* Campaign selection bar */}
        {viewMode === 'imoveis' && selectedForCampaign.size > 0 && (
          <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/10 border-b border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.4)]">
            <CheckSquare className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium text-primary">
              {selectedForCampaign.size} imóvel(is) selecionado(s) para campanha
            </span>
            <button
              onClick={clearCampaignSelection}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.05] text-secondary hover:bg-white/[0.08] border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.4)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
            <button
              onClick={() => navigate('/automacao?tab=campanha')}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Atualizar pelo WhatsApp
            </button>
          </div>
        )}
      </div>

        {viewMode === 'imoveis' ? (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {filtered.length === 0 ? (
              <div className="empty-state col-span-full">
                <Users className="empty-icon" />
                <p>Nenhum imóvel encontrado</p>
              </div>
            ) : (
              filtered.map((prop) => {
                const owner = getOwner(prop.owner_id);
                const ownerPhone = owner?.phone || owner?.whatsapp || null;
                const ownerPhoneRaw = ownerPhone ? ownerPhone.replace(/\D/g, '') : null;
                const compatibleCount = findCompatibleClients(prop).length;

                return (
                  <div
                    key={prop.id}
                    className="card group hover:border-[rgba(212,200,184,0.5)] dark:hover:border-[rgba(26,47,31,0.5)] transition-all overflow-hidden !p-0 flex flex-col"
                  >
                    {/* Cover photo */}
                    {prop.photos && prop.photos.length > 0 ? (
                      <div className="relative w-full h-40 overflow-hidden bg-[#0f1a12] cursor-pointer" onClick={() => setLightboxProps({ photos: prop.photos || [], index: 0 })}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCampaignProperty(prop.id); }}
                          className="absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center rounded-lg bg-black/60 hover:bg-black/80 transition-colors"
                        >
                          {selectedForCampaign.has(prop.id) ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-white/70" />
                          )}
                        </button>
                        <img
                          src={prop.photos[0]}
                          alt={prop.code}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        {prop.photos.length > 1 && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full cursor-pointer" onClick={(e) => { e.stopPropagation(); setLightboxProps({ photos: prop.photos || [], index: 0 }); }}>
                            <Camera className="w-3 h-3" />{prop.photos.length}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full h-40 overflow-hidden bg-gradient-to-br from-[#0f1a12] to-[#1a2f1f]/50">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCampaignProperty(prop.id); }}
                          className="absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center rounded-lg bg-black/40 hover:bg-black/60 transition-colors"
                        >
                          {selectedForCampaign.has(prop.id) ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-white/70" />
                          )}
                        </button>
                        <div className="flex flex-col items-center justify-center h-full gap-1">
                          <ImageIcon className="w-7 h-7 text-muted/30" />
                          <span className="text-[10px] text-muted/40">Sem foto</span>
                        </div>
                      </div>
                    )}

                    <div className="p-4 pb-2 space-y-1.5 flex flex-col flex-1">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-viva-500 text-sm font-semibold">{prop.code}</p>
                          <h3 className="text-sm font-semibold text-primary mt-1">
                            {label(PROP_TYPES, prop.property_type)} - {label(CATEGORIES, prop.category)}
                          </h3>
                        </div>
                        <span className={`badge ${statusColors[prop.status] || ''}`}>
                          {label(STATUSES, prop.status)}
                        </span>
                      </div>

                      {/* Location */}
                      {(prop.neighborhood || prop.city) && (
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{prop.neighborhood && `${prop.neighborhood}, `}{prop.city}</span>
                        </div>
                      )}

                      {/* Owner with contact buttons */}
                      {owner ? (
                        <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-white/[0.03] border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <UserCheck className="w-3 h-3 text-viva-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-secondary truncate">{owner.name}</p>
                                {ownerPhone && (
                                <p className="text-[10px] text-muted truncate">{ownerPhone}</p>
                              )}
                            </div>
                          </div>
                          {ownerPhoneRaw && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <a
                                href={`tel:+55${ownerPhoneRaw}`}
                                title="Ligar"
                                onClick={(e) => e.stopPropagation()}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-viva-500/10 hover:bg-viva-500/25 text-viva-400 transition-colors"
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                              <a
                                href={`https://wa.me/55${ownerPhoneRaw}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp"
                                onClick={(e) => e.stopPropagation()}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* Features */}
                      <div className="flex flex-wrap gap-2 text-xs text-muted">
                        {prop.bedrooms && <span className="inline-flex items-center text-sm font-semibold"><Bed className="w-5 h-5 mr-1" />{prop.bedrooms}</span>}
                        {prop.suites && <span>{prop.suites}S</span>}
                        {prop.garages && <span className="inline-flex items-center text-sm font-semibold"><Car className="w-5 h-5 mr-1" />{prop.garages}</span>}
                        {prop.bathrooms && <span className="inline-flex items-center text-sm font-semibold"><Bath className="w-5 h-5 mr-1" />{prop.bathrooms}</span>}
                        {prop.total_area && <span>{prop.total_area}m²</span>}
                      </div>

                      {/* Building & Unit */}
                      <div className="flex items-center justify-between gap-2">
                        {(() => {
                          const b = getBuilding(propBuildingId(prop));
                          return b ? (
                            <button
                              onClick={() => setFilterBuilding(b.id)}
                              className="flex items-center gap-1.5 text-xs font-medium text-viva-400 hover:underline"
                            >
                              <BuildingIcon className="w-3.5 h-3.5" />
                              <span>{b.name}{prop.complement ? ` · ${prop.complement}` : ''}</span>
                            </button>
                          ) : prop.complement ? (
                            <div className="text-xs text-muted">
                              {prop.complement}
                            </div>
                          ) : null;
                        })()}
                        {prop.quadra || prop.lote ? (
                          <div className="text-[11px] text-muted font-medium whitespace-nowrap">
                            Q{prop.quadra || '—'} · L{prop.lote || '—'}
                          </div>
                        ) : null}
                      </div>

                      {/* Price & Badges */}
                      <div className="flex items-center justify-between pt-3 mt-auto border-t border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)]">
                        <div>
                          {prop.sale_price && (
                            <p className="text-viva-500 font-semibold">{BRL(prop.sale_price)}</p>
                          )}

                        </div>
                        <div className="flex gap-1">
                          {prop.accepts_exchange && (
                            <span className="badge bg-amber-500/15 text-amber-400">
                              <BadgeCheck className="w-3 h-3 mr-0.5" /> Permuta
                            </span>
                          )}
                          <span className={`badge ${visibilityColors[prop.visibility]}`}>
                            {visibilityLabels[prop.visibility]}
                          </span>
                        </div>
                      </div>

                      {/* Compatible Clients */}
                      {compatibleCount > 0 && (
                        <button
                          onClick={() => handleShowMatches(prop)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-viva-500/10 text-viva-400 text-xs font-medium hover:bg-viva-500/20 transition-colors"
                        >
                          <Target className="w-3.5 h-3.5" />
                          {compatibleCount} cliente                          {compatibleCount > 1 ? 's' : ''} compatível
                        </button>
                      )}

                      {/* Key Location & Updated */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {prop.key_location && (
                          <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            {prop.key_location}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-muted">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {prop.updated_at ? new Date(prop.updated_at).toLocaleString('pt-BR') : ''}
                        </span>
                      </div>

                      {/* Sale Terms */}
                      {prop.sale_terms && (
                        <div
                          className="flex items-start gap-2 text-xs text-secondary bg-gradient-to-r from-white/[0.03] px-3 py-2 rounded-lg border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)] cursor-pointer select-none"
                          onClick={() => {
                            const next = new Set(expandedTerms);
                            if (next.has(prop.id)) next.delete(prop.id);
                            else next.add(prop.id);
                            setExpandedTerms(next);
                          }}
                        >
                          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-viva-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className={expandedTerms.has(prop.id) ? '' : 'line-clamp-1'}>{prop.sale_terms}</span>
                        </div>
                      )}

                      {/* Financing & Installments */}
                      {(prop.accepts_financing || prop.installments) && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {prop.accepts_financing && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                              Financiamento
                            </span>
                          )}
                          {prop.installments && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] text-secondary">
                              {prop.installments.split(',').map(x => `${x}x`).join(' · ')}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpen(prop)}
                          className="w-full btn-ghost text-xs justify-center"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Atualizar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 pb-6">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: currentPage === 1 ? 'var(--muted)' : 'var(--primary)' }}
              >
                ← Anterior
              </button>
              {pageNumbers.map(n => (
                <button
                  key={n}
                  onClick={() => setCurrentPage(n)}
                  className="w-8 h-8 text-sm rounded-lg transition-all font-medium"
                  style={{
                    background: n === currentPage ? '#4A9B63' : 'transparent',
                    color: n === currentPage ? '#fff' : 'var(--primary)',
                    boxShadow: n === currentPage ? '0 2px 8px rgba(74,155,99,0.35)' : 'none',
                  }}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: currentPage === totalPages ? 'var(--muted)' : 'var(--primary)' }}
              >
                Próximo →
              </button>
              <span className="text-xs ml-3" style={{ color: 'var(--muted)' }}>
                {totalProperties} imóveis
              </span>
            </div>
          )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOwners.length === 0 ? (
              <div className="empty-state col-span-full">
                <Users className="empty-icon" />
                <p>Nenhum proprietário encontrado</p>
              </div>
            ) : (
              filteredOwners.map((owner) => {
                const ownerProps = properties.filter((p) => p.owner_id === owner.id);
                const phoneRaw = (owner.whatsapp || owner.phone || '').replace(/\D/g, '');
                const phoneDisplay = owner.phone || owner.whatsapp || null;
                const waLink = phoneRaw ? `https://wa.me/55${phoneRaw}` : null;
                const telLink = phoneRaw ? `tel:+55${phoneRaw}` : null;

                return (
                  <div
                    key={owner.id}
                    className="card group hover:border-[rgba(212,200,184,0.5)] dark:hover:border-[rgba(26,47,31,0.5)] transition-all"
                  >
                    <div className="space-y-3">
                      {/* Header: avatar + name + badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-viva-500/15 flex items-center justify-center flex-shrink-0">
                            <UserCheck className="w-4 h-4 text-viva-400" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-primary text-sm truncate">{owner.name}</h3>
                            {owner.city && <p className="text-xs text-muted truncate">{owner.city}</p>}
                          </div>
                        </div>
                        <span className="badge bg-white/[0.05] text-secondary flex-shrink-0">
                          {ownerProps.length} imóvel(is)
                        </span>
                      </div>

                      {/* Phone + action buttons */}
                      {phoneDisplay && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)]">
                          <Phone className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                          <span className="text-xs text-secondary flex-1 font-medium">{phoneDisplay}</span>
                          <div className="flex items-center gap-1.5">
                            {telLink && (
                              <a
                                href={telLink}
                                title="Ligar"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-viva-500/10 hover:bg-viva-500/25 text-viva-400 transition-colors text-[10px] font-semibold"
                              >
                                <Phone className="w-3 h-3" />
                                Ligar
                              </a>
                            )}
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 transition-colors text-[10px] font-semibold"
                              >
                                <MessageCircle className="w-3 h-3" />
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Email & CPF/CNPJ */}
                      <div className="space-y-1 text-xs text-muted">
                        {owner.email && (
                          <p className="truncate"><span className="text-muted/60">Email: </span>{owner.email}</p>
                        )}
                        {owner.cpf_cnpj && (
                          <p><span className="text-muted/60">CPF/CNPJ: </span>{owner.cpf_cnpj}</p>
                        )}
                      </div>

                      {/* Linked Properties */}
                      {ownerProps.length > 0 ? (
                        <div className="space-y-1.5 mt-2 pt-2">
                          <div className="divider mb-2" />
                          <p className="text-[10px] uppercase font-bold text-muted">
                            Imóveis Vinculados:
                          </p>
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {ownerProps.map((p) => (
                              <div
                                key={p.id}
                                className="text-xs font-medium text-secondary flex justify-between items-center bg-viva-500/5 hover:bg-viva-500/10 transition-colors p-2 rounded-lg gap-2"
                              >
                                <div className="min-w-0">
                                  <span className="text-viva-400 font-bold">{p.code}</span>
                                  <span className="text-muted"> · {label(PROP_TYPES, p.property_type)}</span>
                                  {(p.neighborhood || p.city) && (
                                    <p className="text-[10px] text-muted truncate mt-0.5">{p.neighborhood || p.city}</p>
                                  )}
                                </div>
                                {p.sale_price && (
                                  <span className="text-viva-500 font-semibold text-[11px] flex-shrink-0">{BRL(p.sale_price)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted italic mt-2">
                          Nenhum imóvel vinculado
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Compatibility Modal */}
      {showMatchModal && selectedPropertyForMatch && (
        <div className="modal-overlay" onClick={() => setShowMatchModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.4)]">
              <div>
                <h2 className="text-lg font-bold text-primary">Clientes Compatíveis</h2>
                <p className="text-sm text-muted">{selectedPropertyForMatch.code} - {selectedPropertyForMatch.city}</p>
              </div>
              <button onClick={() => setShowMatchModal(false)} className="p-1 hover:bg-white/[0.04] rounded">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {(() => {
                const compatible = findCompatibleClients(selectedPropertyForMatch);
                return compatible.length > 0 ? (
                  <div className="space-y-3">
                    {compatible.map(client => (
                      <div key={client.id} className="p-4 bg-white/[0.03] rounded-lg border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)]">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-primary">{client.name}</p>
                            <span className={`badge mt-1 ${
                              client.funil === 'quente' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'
                            }`}>
                              {client.funil === 'quente' ? 'Quente' : 'Morno'}
                            </span>
                          </div>
                          <div className="text-right">
                            {client.budget_max && (
                              <p className="text-sm text-muted">Até {BRL(client.budget_max)}</p>
                            )}
                            {client.desired_city && (
                              <p className="text-xs text-muted">{client.desired_city}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {client.bedrooms && <span className="text-xs text-muted">{client.bedrooms}+ quartos</span>}
                          {client.sea_view && <span className="text-xs text-muted">Vista mar</span>}
                          {client.garage && <span className="text-xs text-muted">Garagem</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Users className="empty-icon" />
                    <p>Nenhum cliente compatível</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Property Form Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.4)]">
              <h2 className="text-xl font-bold text-primary">
                {editingId ? 'Editar Imóvel' : 'Novo Imóvel'}
              </h2>
              <button onClick={handleClose} className="p-1 hover:bg-white/[0.04] rounded">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.4)] px-6">
              {[
                { id: 'basico', label: 'Básico' },
                { id: 'localizacao', label: 'Localização' },
                { id: 'caracteristicas', label: 'Características' },
                { id: 'valores', label: 'Valores' },
                { id: 'midia', label: `Mídia${photoUrls.length > 0 ? ` · ${photoUrls.length}` : ''}` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab flex-1 text-center ${
                    activeTab === tab.id ? 'active' : ''
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'basico' && (
                <div className="space-y-4">
                  {/* Owner Section */}
                  <div className="space-y-3">
                    <label className="section-label">Proprietário</label>

                    {/* Existing owner selector */}
                    <div className="flex gap-2">
                      <select
                        value={form.owner_id || ''}
                        onChange={(e) => { setForm({ ...form, owner_id: e.target.value }); setShowInlineOwner(false); }}
                        className="select flex-1"
                      >
                        <option value="">Selecione um existente...</option>
                        {owners.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}{o.phone ? ` — ${o.phone}` : o.whatsapp ? ` — ${o.whatsapp}` : ''}</option>
                        ))}
                      </select>
                    </div>

                    {/* Inline add owner toggle */}
                    <button
                      type="button"
                      onClick={() => { setShowInlineOwner(!showInlineOwner); setForm({ ...form, owner_id: '' }); }}
                      className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed text-sm font-medium transition-all ${
                        showInlineOwner
                          ? 'border-viva-500 text-viva-400 bg-viva-500/10'
                          : 'border-[rgba(212,200,184,0.5)] dark:border-[rgba(26,47,31,0.5)] text-muted hover:border-viva-400 hover:text-viva-500'
                      }`}
                    >
                      <Plus className={`w-4 h-4 transition-transform ${showInlineOwner ? 'rotate-45' : ''}`} />
                      {showInlineOwner ? 'Cancelar novo proprietário' : '+ Incluir Proprietário'}
                    </button>

                    {/* Inline owner form */}
                    {showInlineOwner && (
                      <div className="rounded-xl bg-white/[0.03] border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)] p-4 space-y-3">
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Novo Proprietário</p>
                        <input
                          type="text"
                          value={inlineOwnerForm.name}
                          onChange={(e) => setInlineOwnerForm({ ...inlineOwnerForm, name: e.target.value })}
                          placeholder="Nome completo *"
                          className="input"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="tel"
                            value={inlineOwnerForm.phone}
                            onChange={(e) => setInlineOwnerForm({ ...inlineOwnerForm, phone: e.target.value })}
                            placeholder="Telefone / WhatsApp"
                            className="input"
                          />
                          <input
                            type="text"
                            value={inlineOwnerForm.city}
                            onChange={(e) => setInlineOwnerForm({ ...inlineOwnerForm, city: e.target.value })}
                            placeholder="Cidade"
                            className="input"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={!inlineOwnerForm.name.trim() || savingOwner}
                          onClick={async () => {
                            if (!inlineOwnerForm.name.trim()) return;
                            setSavingOwner(true);
                            try {
                              const owner = await addOwner({
                                name: inlineOwnerForm.name,
                                phone: inlineOwnerForm.phone,
                                whatsapp: inlineOwnerForm.phone,
                                city: inlineOwnerForm.city,
                              });
                              setForm({ ...form, owner_id: owner.id });
                              setInlineOwnerForm({ name: '', phone: '', city: '' });
                              setShowInlineOwner(false);
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setSavingOwner(false);
                            }
                          }}
                          className="btn-primary w-full justify-center text-sm"
                        >
                          {savingOwner ? 'Salvando...' : '✓ Salvar e vincular proprietário'}
                        </button>
                      </div>
                    )}

                    {/* Show selected owner name */}
                    {form.owner_id && (() => { const o = owners.find(x => x.id === form.owner_id); return o ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                        <UserCheck className="w-3.5 h-3.5" />
                        Vinculado: {o.name}
                      </div>
                    ) : null; })()}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label">Tipo de Imóvel</label>
                      <select
                        value={form.property_type || ''}
                        onChange={(e) => setForm({ ...form, property_type: e.target.value as any })}
                        className="select"
                      >
                        {PROP_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="section-label">Categoria</label>
                      <select
                        value={form.category || ''}
                        onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                        className="select"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label">Status</label>
                      <select
                        value={form.status || ''}
                        onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                        className="select"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="section-label">Visibilidade</label>
                      <select
                        value={form.visibility || ''}
                        onChange={(e) => setForm({ ...form, visibility: e.target.value as any })}
                        className="select"
                      >
                        <option value="privado">Privado</option>
                        <option value="banco">Banco</option>
                        <option value="rede">Rede Nacional</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'localizacao' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label">País</label>
                      <input
                        type="text"
                        value={form.country || ''}
                        onChange={(e) => setForm({ ...form, country: e.target.value })}
                        placeholder="Brasil"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="section-label">Estado</label>
                      <select
                        value={form.state || ''}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        className="select"
                      >
                        <option value="">Selecione...</option>
                        {STATES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={form.city || ''}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Cidade"
                      className="input"
                    />
                    {bairroCustom ? (
                      <input
                        type="text"
                        value={form.neighborhood || ''}
                        onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                        placeholder="Digite o bairro..."
                        className="input"
                        onBlur={() => setTimeout(() => setShowBairroDropdown(false), 200)}
                      />
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          value={bairroSearch || form.neighborhood || ''}
                          onChange={(e) => {
                            setBairroSearch(e.target.value);
                            setShowBairroDropdown(true);
                            setForm({ ...form, neighborhood: '' });
                            setBairroCustom(false);
                          }}
                          onFocus={() => setShowBairroDropdown(true)}
                          onBlur={() => setTimeout(() => setShowBairroDropdown(false), 200)}
                          placeholder="Selecione ou digite o bairro..."
                          className="input w-full"
                        />
                        {showBairroDropdown && (
                          <div className="premium-dropdown">
                            {(form.city === 'Capão da Canoa' || form.city === 'Xangri-Lá' ? BAIRROS[form.city] || [] : Object.values(BAIRROS).flat())
                              .filter(b => !bairroSearch || b.toLowerCase().includes(bairroSearch.toLowerCase()))
                              .map(b => (
                                <button
                                  key={b}
                                  type="button"
                                  onMouseDown={() => {
                                    setForm({ ...form, neighborhood: b });
                                    setBairroSearch(b);
                                    setShowBairroDropdown(false);
                                  }}
                                  className={`w-full text-left px-4 py-3 text-sm text-secondary hover:bg-white/[0.04] border-b border-[rgba(212,200,184,0.2)] dark:border-[rgba(26,47,31,0.2)] last:border-0 ${
                                    form.neighborhood === b ? 'bg-viva-500/10 text-viva-500 font-semibold' : ''
                                  }`}
                                >
                                  {b}
                                </button>
                              ))}
                            {(!form.city || (form.city !== 'Capão da Canoa' && form.city !== 'Xangri-Lá')) && (
                              <button
                                type="button"
                                onMouseDown={() => {
                                  setBairroCustom(true);
                                  setBairroSearch('');
                                  setShowBairroDropdown(false);
                                }}
                                className="w-full text-left px-4 py-3 text-sm text-viva-500 font-medium hover:bg-white/[0.04] border-t border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)]"
                              >
                                + Digitar bairro personalizado
                              </button>
                            )}
                            {form.city && (form.city === 'Capão da Canoa' || form.city === 'Xangri-Lá') && bairroSearch && (
                              <button
                                type="button"
                                onMouseDown={() => {
                                  setBairroCustom(true);
                                  setBairroSearch(bairroSearch);
                                  setForm({ ...form, neighborhood: bairroSearch });
                                  setShowBairroDropdown(false);
                                }}
                                className="w-full text-left px-4 py-3 text-sm text-viva-500 font-medium hover:bg-white/[0.04] border-t border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)]"
                              >
                                + Criar bairro "{bairroSearch}"
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {bairroCustom && (
                      <button
                        type="button"
                        onClick={() => setBairroCustom(false)}
                        className="text-xs text-viva-500 hover:text-viva-400"
                      >
                        ← Voltar para lista de bairros
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={form.street || ''}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                    placeholder="Rua"
                    className="input"
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={form.number || ''}
                      onChange={(e) => setForm({ ...form, number: e.target.value })}
                      placeholder="Número"
                      className="input"
                    />
                    <input
                      type="text"
                      value={form.complement || ''}
                      onChange={(e) => setForm({ ...form, complement: e.target.value })}
                      placeholder="Complemento"
                      className="input"
                    />
                    <input
                      type="text"
                      value={form.zip || ''}
                      onChange={(e) => setForm({ ...form, zip: e.target.value })}
                      placeholder="CEP"
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={form.unit || ''}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      placeholder="Apto / Bloco / Casa"
                      className="input"
                    />
                    <input
                      type="text"
                      value={form.quadra || ''}
                      onChange={(e) => setForm({ ...form, quadra: e.target.value })}
                      placeholder="Quadra"
                      className="input"
                    />
                    <input
                      type="text"
                      value={form.lote || ''}
                      onChange={(e) => setForm({ ...form, lote: e.target.value })}
                      placeholder="Lote"
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label">Localização das Chaves</label>
                      <input
                        type="text"
                        value={form.key_location || ''}
                        onChange={(e) => setForm({ ...form, key_location: e.target.value })}
                        placeholder="Onde estão as chaves?"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="section-label">Ponto de Referência</label>
                      <input
                        type="text"
                        value={form.reference || ''}
                        onChange={(e) => setForm({ ...form, reference: e.target.value })}
                        placeholder="Próximo a..."
                        className="input"
                      />
                    </div>
                  </div>

                  {/* Building Section */}
                  <div className="space-y-3">
                    <label className="section-label">Edifício / Condomínio</label>

                    {form.building_id ? (() => {
                      const b = buildings.find(x => x.id === form.building_id);
                      return (
                        <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.03] border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)]">
                          <div className="flex items-center gap-2 text-xs text-viva-400 font-medium">
                            <BuildingIcon className="w-4 h-4" />
                            {b ? b.name : 'Carregando...'}
                          </div>
                          <button
                            type="button"
                            onClick={() => { setForm({ ...form, building_id: '' }); setBuildingSearch(''); }}
                            className="p-1 hover:bg-white/[0.04] rounded"
                          >
                            <X className="w-4 h-4 text-muted" />
                          </button>
                        </div>
                      );
                    })() : (
                      <div className="relative">
                        <input
                          type="text"
                          value={buildingSearch}
                          onChange={(e) => {
                            setBuildingSearch(e.target.value);
                            setShowBuildingDropdown(true);
                            setForm({ ...form, building_id: '' });
                          }}
                          onFocus={() => setShowBuildingDropdown(true)}
                          onBlur={() => setTimeout(() => setShowBuildingDropdown(false), 200)}
                          placeholder="Pesquisar edifício/condomínio..."
                          className="input w-full"
                        />
                        {showBuildingDropdown && (
                          <div className="premium-dropdown">
                            {buildings
                              .filter(b => !buildingSearch.trim() || b.name.toLowerCase().includes(buildingSearch.toLowerCase()))
                              .slice(0, 20)
                              .map(b => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onMouseDown={() => {
                                    setForm({ ...form, building_id: b.id, street: b.street || form.street, number: b.number || form.number, neighborhood: b.neighborhood || form.neighborhood, city: b.city || form.city });
                                    setBuildingSearch(b.name);
                                    setShowBuildingDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm text-secondary hover:bg-white/[0.04] border-b border-[rgba(212,200,184,0.2)] dark:border-[rgba(26,47,31,0.2)] last:border-0"
                                  >
                                   <span className="font-medium">{b.name}</span>
                                   {b.number && (
                                     <span className="ml-1 text-xs text-muted">n.{b.number}</span>
                                   )}
                                   {b.street && (
                                     <span className="ml-2 text-xs text-muted">{b.street}</span>
                                   )}
                                   {b.neighborhood && (
                                     <span className="ml-2 text-xs text-muted">{b.neighborhood}</span>
                                   )}
                                </button>
                              ))}
                            {buildings.length > 0 && buildings.filter(b => !buildingSearch.trim() || b.name.toLowerCase().includes(buildingSearch.toLowerCase())).length === 0 && (
                              <div className="px-4 py-3 text-sm text-muted">
                                Nenhum edifício encontrado para "{buildingSearch}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => { setShowInlineBuilding(!showInlineBuilding); }}
                      className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed text-sm font-medium transition-all ${
                        showInlineBuilding
                          ? 'border-viva-500 text-viva-400 bg-viva-500/10'
                          : 'border-[rgba(212,200,184,0.5)] dark:border-[rgba(26,47,31,0.5)] text-muted hover:border-viva-400 hover:text-viva-500'
                      }`}
                    >
                      <Plus className={`w-4 h-4 transition-transform ${showInlineBuilding ? 'rotate-45' : ''}`} />
                      {showInlineBuilding ? 'Cancelar' : 'Incluir Edifício / Condomínio'}
                    </button>

                    {showInlineBuilding && (
                      <div className="rounded-xl bg-white/[0.03] border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)] p-4 space-y-3">
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Novo Edifício/Condomínio</p>
                        <input
                          type="text"
                          value={inlineBuildingForm.name}
                          onChange={(e) => setInlineBuildingForm({ ...inlineBuildingForm, name: e.target.value })}
                          placeholder="Nome do edifício/condomínio *"
                          className="input"
                        />
                        <input
                          type="text"
                          value={inlineBuildingForm.street}
                          onChange={(e) => setInlineBuildingForm({ ...inlineBuildingForm, street: e.target.value })}
                          placeholder="Rua do edifício"
                          className="input"
                        />
                        <input
                          type="text"
                          value={inlineBuildingForm.number}
                          onChange={(e) => setInlineBuildingForm({ ...inlineBuildingForm, number: e.target.value })}
                          placeholder="Número"
                          className="input"
                        />
                        <input
                          type="text"
                          value={inlineBuildingForm.address}
                          onChange={(e) => setInlineBuildingForm({ ...inlineBuildingForm, address: e.target.value })}
                          placeholder="Complemento do endereço"
                          className="input"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={inlineBuildingForm.neighborhood}
                            onChange={(e) => setInlineBuildingForm({ ...inlineBuildingForm, neighborhood: e.target.value })}
                            placeholder="Bairro"
                            className="input"
                          />
                          <input
                            type="text"
                            value={inlineBuildingForm.city}
                            onChange={(e) => setInlineBuildingForm({ ...inlineBuildingForm, city: e.target.value })}
                            placeholder="Cidade"
                            className="input"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={!inlineBuildingForm.name.trim()}
                          onClick={async () => {
                            if (!inlineBuildingForm.name.trim()) return;
                            try {
                              const building = await addBuilding({
                                name: inlineBuildingForm.name,
                                street: inlineBuildingForm.street,
                                number: inlineBuildingForm.number,
                                address: inlineBuildingForm.address,
                                neighborhood: inlineBuildingForm.neighborhood,
                                city: inlineBuildingForm.city,
                              });
                              setForm({ ...form, building_id: building.id, street: building.street || form.street, number: building.number || form.number, neighborhood: building.neighborhood || form.neighborhood, city: building.city || form.city });
                              setBuildingSearch(building.name);
                              setInlineBuildingForm({ name: '', street: '', number: '', address: '', neighborhood: '', city: '' });
                              setShowInlineBuilding(false);
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="btn-primary w-full justify-center text-sm"
                        >
                          ✓ Salvar e vincular
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'caracteristicas' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      value={form.private_area || ''}
                      onChange={(e) => setForm({ ...form, private_area: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Área privada (m²)"
                      className="input"
                    />
                    <input
                      type="number"
                      value={form.total_area || ''}
                      onChange={(e) => setForm({ ...form, total_area: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Área total (m²)"
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <input
                      type="number"
                      value={form.bedrooms || ''}
                      onChange={(e) => setForm({ ...form, bedrooms: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Quartos"
                      className="input"
                    />
                    <input
                      type="number"
                      value={form.suites || ''}
                      onChange={(e) => setForm({ ...form, suites: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Suítes"
                      className="input"
                    />
                    <input
                      type="number"
                      value={form.bathrooms || ''}
                      onChange={(e) => setForm({ ...form, bathrooms: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Banheiros"
                      className="input"
                    />
                    <input
                      type="number"
                      value={form.garages || ''}
                      onChange={(e) => setForm({ ...form, garages: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Garagens"
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      value={form.floor || ''}
                      onChange={(e) => setForm({ ...form, floor: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Andar"
                      className="input"
                    />
                    <input
                      type="number"
                      value={form.elevators || ''}
                      onChange={(e) => setForm({ ...form, elevators: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Elevadores"
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.sea_view || false} onChange={(e) => setForm({ ...form, sea_view: e.target.checked })} className="checkbox-viva" />
                      <span className="text-sm text-secondary">Vista mar</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.mountain_view || false} onChange={(e) => setForm({ ...form, mountain_view: e.target.checked })} className="checkbox-viva" />
                      <span className="text-sm text-secondary">Vista serra</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.furnished || false} onChange={(e) => setForm({ ...form, furnished: e.target.checked })} className="checkbox-viva" />
                      <span className="text-sm text-secondary">Mobiliado</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.decorated || false} onChange={(e) => setForm({ ...form, decorated: e.target.checked })} className="checkbox-viva" />
                      <span className="text-sm text-secondary">Decorado</span>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'valores' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label">Preço de venda (R$)</label>
                      <input
                        type="number"
                        value={form.sale_price || ''}
                        onChange={(e) => setForm({ ...form, sale_price: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="0,00"
                        className="input"
                      />
                    </div>

                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label">Condomínio (R$)</label>
                      <input
                        type="number"
                        value={form.condo_fee || ''}
                        onChange={(e) => setForm({ ...form, condo_fee: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="0,00"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="section-label">IPTU (R$)</label>
                      <input
                        type="number"
                        value={form.iptu || ''}
                        onChange={(e) => setForm({ ...form, iptu: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="0,00"
                        className="input"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label">Valor mínimo aceito (R$)</label>
                      <input
                        type="number"
                        value={form.min_accepted || ''}
                        onChange={(e) => setForm({ ...form, min_accepted: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="0,00"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="section-label">Comissão (R$)</label>
                      <input
                        type="number"
                        value={form.commission || ''}
                        onChange={(e) => setForm({ ...form, commission: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="0,00"
                        className="input"
                      />
                    </div>
                  </div>
                  <div className="pt-4">
                    <div className="divider mb-4" />
                    <h4 className="section-label mb-3">Condições de Pagamento</h4>
                    <div className="space-y-3">
                      <div className="col-span-full">
                        <label className="section-label">Termos de Venda</label>
                        <textarea
                          placeholder="Ex: 50% entrada + saldo em 24x"
                          value={form.sale_terms || ''}
                          onChange={(e) => setForm({ ...form, sale_terms: e.target.value })}
                          className="input resize-none"
                          rows={2}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.accepts_financing || false}
                            onChange={(e) => setForm({ ...form, accepts_financing: e.target.checked })}
                            className="w-4 h-4 rounded accent-viva-500"
                          />
                          <span className="text-xs text-secondary">Aceita Financiamento Bancário</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">Prazo direto:</span>
                          <div className="flex flex-wrap gap-1">
                            {[12,24,36,48,60,72,84,100].map(n => {
                              const selected = (form.installments || '').split(',').includes(String(n));
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => {
                                    const current = (form.installments || '').split(',').filter(Boolean);
                                    const next = selected ? current.filter(x => x !== String(n)) : [...current, String(n)];
                                    setForm({ ...form, installments: next.join(',') });
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
                  </div>

                  <div className="pt-4">
                    <div className="divider mb-4" />
                    <h4 className="section-label mb-3">Permuta</h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.accepts_exchange || false}
                          onChange={(e) => setForm({ ...form, accepts_exchange: e.target.checked })}
                          className="checkbox-viva"
                        />
                        <span className="text-sm text-secondary">Aceita permuta</span>
                      </label>
                      {form.accepts_exchange && (
                        <div className="space-y-3 pl-4 border-l-2 border-viva-500/30">
                          <div>
                            <label className="section-label">Valor mínimo aceito em permuta (R$)</label>
                            <input
                              type="number"
                              value={form.exchange_percent || ''}
                              onChange={(e) => setForm({ ...form, exchange_percent: e.target.value ? parseFloat(e.target.value) : undefined })}
                              placeholder="0,00"
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="section-label">O que procura em permuta</label>
                            <textarea
                              value={form.exchange_seeking || ''}
                              onChange={(e) => setForm({ ...form, exchange_seeking: e.target.value })}
                              placeholder="Ex: Imóvel residencial, terreno comercial..."
                              className="input resize-none h-20"
                            />
                          </div>
                          <div>
                            <label className="section-label">Não aceita em permuta</label>
                            <textarea
                              value={form.exchange_not_accepted || ''}
                              onChange={(e) => setForm({ ...form, exchange_not_accepted: e.target.value })}
                              placeholder="Ex: Terrenos fora da cidade, imóveis em obras..."
                              className="input resize-none h-20"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'midia' && (
                <div className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <label className="section-label">Descrição</label>
                      <textarea
                        value={form.description || ''}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Descrição completa do imóvel..."
                        className="input resize-none h-24"
                      />
                    </div>
                    <div>
                      <label className="section-label">Destaques</label>
                      <textarea
                        value={form.highlights || ''}
                        onChange={(e) => setForm({ ...form, highlights: e.target.value })}
                        placeholder="Pontos principais do imóvel..."
                        className="input resize-none h-20"
                      />
                    </div>
                    <div>
                      <label className="section-label">Notas internas</label>
                      <textarea
                        value={form.internal_notes || ''}
                        onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                        placeholder="Observações internas..."
                        className="input resize-none h-20"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <div className="divider mb-4" />
                    <div className="flex items-center justify-between mb-1">
                      <label className="section-label mb-0">Fotos do Imóvel</label>
                      <span className="text-[11px] text-muted">{photoUrls.length}/200 fotos</span>
                    </div>
                    <p className="text-[11px] text-muted mb-3">
                      Clique em <Star className="w-2.5 h-2.5 inline fill-amber-400 text-amber-400" /> para definir a <strong>capa</strong>. A primeira foto é capa por padrão.
                    </p>

                    {/* Upload zone */}
                    {photoUrls.length < 200 && (
                      <label className="group flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all border-[rgba(212,200,184,0.5)] dark:border-[rgba(26,47,31,0.5)] hover:border-viva-400 hover:bg-viva-500/5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                        <Camera className="w-8 h-8 text-muted group-hover:text-viva-400 transition-colors relative z-10" />
                        <div className="text-center relative z-10">
                          <p className="text-sm text-secondary group-hover:text-viva-500 font-semibold transition-colors">
                            Clique ou arraste para adicionar
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">
                            JPG, JPEG, PNG, WEBP · máx. 10MB por foto · até 200 fotos
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            const remaining = 200 - photoUrls.length;
                            files.slice(0, remaining).forEach(file => {
                              if (file.size > 10 * 1024 * 1024) {
                                alert(`"${file.name}" excede 10MB e foi ignorado.`);
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setPhotoUrls(prev => [...prev, ev.target?.result as string]);
                              };
                              reader.readAsDataURL(file);
                            });
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}

                    {photoUrls.length >= 200 && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
                        <Camera className="w-4 h-4 flex-shrink-0" />
                        Limite de 200 fotos atingido. Remova uma foto para adicionar outra.
                      </div>
                    )}
                  </div>

                  {/* Photo grid */}
                  {photoUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {photoUrls.map((url, idx) => {
                        const isCover = idx === coverIndex;
                        return (
                          <div
                            key={idx}
                            className={`relative group rounded-xl overflow-hidden aspect-video transition-all ${
                              isCover
                                ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0f1a12]'
                                : 'ring-1 ring-[rgba(212,200,184,0.3)] dark:ring-[rgba(26,47,31,0.4)]'
                            }`}
                          >
                            <img
                              src={url}
                              alt={`Foto ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />

                            {/* Cover badge */}
                            {isCover && (
                              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg shadow-lg">
                                <Star className="w-2.5 h-2.5 fill-white" />
                                CAPA
                              </div>
                            )}

                            {/* Photo number */}
                            {!isCover && (
                              <div className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                                #{idx + 1}
                              </div>
                            )}

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              {!isCover && (
                                <button
                                  type="button"
                                  onClick={() => setCoverIndex(idx)}
                                  title="Definir como capa"
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-bold transition-colors shadow"
                                >
                                  <Star className="w-3 h-3" /> Capa
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removePhoto(idx)}
                                title="Remover foto"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-[10px] font-bold transition-colors shadow"
                              >
                                <Trash2 className="w-3 h-3" /> Remover
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {photoUrls.length === 0 && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.3)]">
                      <ImageIcon className="w-5 h-5 text-muted flex-shrink-0" />
                      <p className="text-xs text-muted">
                        Nenhuma foto adicionada ainda. As fotos aparecerão como capa nos cards dos imóveis.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.4)]">
              <button type="button" onClick={handleClose} className="btn-ghost flex-1">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Owner Modal */}
      {showOwnerModal && (
        <div className="modal-overlay" onClick={() => setShowOwnerModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(212,200,184,0.3)] dark:border-[rgba(26,47,31,0.4)]">
              <h2 className="text-lg font-bold text-primary">Novo Proprietário</h2>
              <button onClick={() => setShowOwnerModal(false)} className="p-1 hover:bg-white/[0.04] rounded">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <form onSubmit={handleAddOwner} className="p-6 space-y-4">
              <input
                type="text"
                value={ownerForm.name}
                onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                placeholder="Nome completo *"
                className="input"
                required
              />
              <input
                type="text"
                value={ownerForm.phone}
                onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                placeholder="Telefone"
                className="input"
              />
              <input
                type="email"
                value={ownerForm.email}
                onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                placeholder="Email"
                className="input"
              />
              <input
                type="text"
                value={ownerForm.city}
                onChange={(e) => setOwnerForm({ ...ownerForm, city: e.target.value })}
                placeholder="Cidade"
                className="input"
              />
              <input
                type="text"
                value={ownerForm.cpf_cnpj}
                onChange={(e) => setOwnerForm({ ...ownerForm, cpf_cnpj: e.target.value })}
                placeholder="CPF/CNPJ"
                className="input"
              />
              <div className="divider" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowOwnerModal(false)} className="btn-ghost flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxProps && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setLightboxProps(null)}>
          <button
            onClick={() => setLightboxProps(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxProps(p => p ? { ...p, index: Math.max(0, p.index - 1) } : p); }}
            disabled={lightboxProps.index === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white disabled:opacity-30 z-10"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <img
            src={lightboxProps.photos[lightboxProps.index]}
            alt={`Foto ${lightboxProps.index + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxProps(p => p ? { ...p, index: Math.min(p.photos.length - 1, p.index + 1) } : p); }}
            disabled={lightboxProps.index === lightboxProps.photos.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white disabled:opacity-30 z-10"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            {lightboxProps.index + 1} / {lightboxProps.photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
