import { useState, useMemo } from 'react';
import { UserCheck, Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import type { Owner } from '../lib/types';

const GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-pink-500 to-pink-600',
  'from-green-500 to-green-600',
  'from-amber-500 to-amber-600',
  'from-red-500 to-red-600',
  'from-indigo-500 to-indigo-600',
  'from-cyan-500 to-cyan-600',
];

export default function Owners() {
  const { owners, addOwner, updateOwner, deleteOwner } = useData();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [formData, setFormData] = useState<Partial<Owner>>({});
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const filteredOwners = useMemo(() => {
    return owners.filter(o => {
      const matchSearch = o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.phone?.includes(search) || o.email?.toLowerCase().includes(search.toLowerCase()) ||
        o.cpf_cnpj?.includes(search);
      return matchSearch;
    });
  }, [owners, search]);

  const getGradient = (ownerId: string) => {
    const index = owners.findIndex(o => o.id === ownerId);
    return GRADIENTS[index % GRADIENTS.length];
  };

  const openForm = (owner?: Owner) => {
    if (owner) {
      setFormData(owner);
      setSelectedOwner(owner);
    } else {
      setFormData({});
      setSelectedOwner(null);
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedOwner) {
        await updateOwner(selectedOwner.id, formData);
      } else {
        await addOwner(formData);
      }
      setShowForm(false);
      setFormData({});
    } catch (error) {
      console.error('Error saving owner:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja deletar este proprietário?')) {
      try {
        await deleteOwner(id);
      } catch (error) {
        console.error('Error deleting owner:', error);
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="section-card border-0 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="page-header-box">
            <div className="icon-box">
              <UserCheck className="w-6 h-6 text-viva-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Proprietários</h1>
              <p className="text-xs text-muted mt-1">{owners.length} proprietários</p>
            </div>
          </div>
          <button onClick={() => openForm()} className="btn-primary gap-2">
            <Plus className="w-4 h-4" />
            Novo Proprietário
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, email ou CPF/CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Owner Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOwners.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <p className="text-slate-400">Nenhum proprietário encontrado</p>
            </div>
          ) : (
            filteredOwners.map(owner => (
              <div
                key={owner.id}
                onMouseEnter={() => setHoveredCard(owner.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className="card group hover:border-slate-700 transition-all relative"
              >
                <div className="space-y-3">
                  {/* Header with Avatar */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGradient(owner.id)} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-sm font-bold text-white">
                          {owner.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm truncate">{owner.name}</h3>
                        {owner.cpf_cnpj && (
                          <p className="text-xs text-slate-400 truncate">{owner.cpf_cnpj}</p>
                        )}
                      </div>
                    </div>
                    {hoveredCard === owner.id && (
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openForm(owner);
                          }}
                          className="p-1.5 bg-slate-700/50 hover:bg-slate-600 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(owner.id);
                          }}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800">
                    {owner.phone && (
                      <p><span className="text-slate-500">Tel:</span> {owner.phone}</p>
                    )}
                    {owner.whatsapp && (
                      <p><span className="text-slate-500">WhatsApp:</span> {owner.whatsapp}</p>
                    )}
                    {owner.email && (
                      <p><span className="text-slate-500">Email:</span> {owner.email}</p>
                    )}
                    {owner.city && (
                      <p><span className="text-slate-500">Cidade:</span> {owner.city}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl">
            <div className="border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {selectedOwner ? 'Editar Proprietário' : 'Novo Proprietário'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-800 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="section-label">Nome Completo</label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="section-label">Telefone</label>
                  <input
                    type="text"
                    placeholder="Telefone"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="section-label">WhatsApp</label>
                  <input
                    type="text"
                    placeholder="WhatsApp"
                    value={formData.whatsapp || ''}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="section-label">Email</label>
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="section-label">Cidade</label>
                <input
                  type="text"
                  placeholder="Cidade"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="section-label">CPF/CNPJ</label>
                <input
                  type="text"
                  placeholder="CPF ou CNPJ"
                  value={formData.cpf_cnpj || ''}
                  onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="section-label">Notas</label>
                <textarea
                  placeholder="Observações adicionais..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input resize-none h-20"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {selectedOwner ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
