import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, MapPin, Building2, User, Search, MessageCircle, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Property, Profile } from '../lib/types';
import { BRL, label, PROP_TYPES } from '../lib/constants';

export default function Network() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<(Property & { profiles?: Profile })[]>([]);
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('properties')
        .select('*, profiles:user_id(id, email, full_name, phone, region, avatar_url)')
        .eq('visibility', 'rede')
        .order('created_at', { ascending: false });
      setProperties((data as (Property & { profiles?: Profile })[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = useMemo(() => {
    return properties.filter(p => {
      const matchSearch = !search ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.city?.toLowerCase().includes(search.toLowerCase()) ||
        p.neighborhood?.toLowerCase().includes(search.toLowerCase());
      const matchCity = !filterCity || p.city?.toLowerCase().includes(filterCity.toLowerCase());
      const matchType = !filterType || p.property_type === filterType;
      const matchMinPrice = !minPrice || (p.sale_price && p.sale_price >= parseFloat(minPrice));
      const matchMaxPrice = !maxPrice || (p.sale_price && p.sale_price <= parseFloat(maxPrice));
      return matchSearch && matchCity && matchType && matchMinPrice && matchMaxPrice;
    });
  }, [properties, search, filterCity, filterType, minPrice, maxPrice]);

  const handleStartChat = async (property: Property, ownerId: string) => {
    if (!profile) return;

    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('type', 'property')
      .eq('reference_id', property.id)
      .contains('participants', [profile.id])
      .single();

    if (existing) {
      navigate(`/chat?conversation=${existing.id}`);
      return;
    }

    const participants = [profile.id];
    if (!participants.includes(ownerId)) {
      participants.push(ownerId);
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        type: 'property',
        reference_id: property.id,
        participants,
      })
      .select()
      .single();

    if (conversation) {
      navigate(`/chat?conversation=${conversation.id}`);
    }
  };

  const cities = useMemo(() => {
    const unique = new Set(properties.map(p => p.city).filter(Boolean));
    return Array.from(unique).sort();
  }, [properties]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="section-card border-0 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="page-header-box flex items-center gap-3">
            <div className="icon-box">
              <Globe className="w-6 h-6 text-viva-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Rede Nacional</h1>
              <p className="text-xs text-muted mt-1">Imóveis públicos de toda a rede VIVA</p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Buscar por código, cidade ou bairro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn flex items-center gap-2 ${showFilters ? 'bg-viva-500/15 text-viva-400' : 'btn-ghost'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 divider grid grid-cols-2 md:grid-cols-4 gap-3">
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="select"
            >
              <option value="">Todas as cidades</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="select"
            >
              <option value="">Todos os tipos</option>
              {PROP_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Valor mínimo"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Valor máximo"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="input"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Properties List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-viva-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <Globe className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted text-sm">Nenhum imóvel encontrado na rede</p>
            <p className="text-xs text-muted mt-1">Publique um imóvel com visibilidade "Rede Nacional" para aparecer aqui</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((prop) => {
              const owner = prop.profiles;
              const ownerInitial = owner?.full_name?.[0]?.toUpperCase() || '?';

              return (
                <div key={prop.id} className="card hover:border-white/[0.06] transition-all group">
                  {/* Property Type Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="badge bg-viva-500/15 text-viva-400">
                      {label(PROP_TYPES, prop.property_type)}
                    </span>
                    {prop.sale_price && (
                      <span className="text-viva-500 font-semibold">{BRL(prop.sale_price)}</span>
                    )}
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-muted mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {prop.neighborhood || prop.city || 'Localização não informada'}
                      </p>
                      {(prop.city || prop.state) && (
                        <p className="text-xs text-muted">
                          {[prop.city, prop.state].filter(Boolean).join(' - ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex gap-3 text-xs text-muted mb-4">
                    {prop.bedrooms && <span>{prop.bedrooms}Q</span>}
                    {prop.suites && <span>{prop.suites}S</span>}
                    {prop.bathrooms && <span>{prop.bathrooms}B</span>}
                    {prop.garages && <span>{prop.garages}G</span>}
                    {prop.total_area && <span>{prop.total_area}m²</span>}
                  </div>

                  {/* Owner/Agent Info */}
                  {owner && (
                    <div className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg mb-4">
                      <div className="w-10 h-10 rounded-full bg-viva-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-white">{ownerInitial}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary truncate">{owner.full_name}</p>
                        <p className="text-xs text-muted truncate">{owner.region || 'Corretor'}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={() => handleStartChat(prop, prop.user_id)}
                    className="btn-primary w-full justify-center"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Conversar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
