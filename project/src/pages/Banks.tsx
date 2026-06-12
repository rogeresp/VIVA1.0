import { useState, useEffect } from 'react';
import { Database, Plus, Search, Edit2, Trash2, Users, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';

export default function Banks() {
  const { banks, clients, properties, owners, exchanges, addBank, updateBank, deleteBank, refreshAll } = useData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const getStats = (bankId: string) => ({
    clients: clients.filter(c => c.bank_id === bankId).length,
    properties: properties.filter(p => p.bank_id === bankId).length,
    owners: owners.filter(o => o.bank_id === bankId).length,
    exchanges: exchanges.filter(e => e.bank_id === bankId).length,
  });

  const filtered = banks.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
  const selected = banks.find(b => b.id === selectedId);
  const stats = selectedId ? getStats(selectedId) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    try {
      if (editingId) {
        await updateBank(editingId, formData);
      } else {
        await addBank(formData);
      }
      setFormData({ name: '', description: '' });
      setShowModal(false);
      setEditingId(null);
    } catch (err) { console.error(err); }
  };

  const openEdit = (id: string) => {
    const bank = banks.find(b => b.id === id);
    if (bank) {
      setFormData({ name: bank.name, description: bank.description || '' });
      setEditingId(id);
      setShowModal(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este banco?')) return;
    await deleteBank(id);
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="section-card border-0 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="page-header-box">
            <div className="icon-box">
              <Database className="w-5 h-5 text-viva-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Bancos</h1>
              <p className="text-xs text-muted mt-1">{banks.length} banco(s)</p>
            </div>
          </div>
          <button onClick={() => { setFormData({ name: '', description: '' }); setEditingId(null); setShowModal(true); }} className="btn-primary gap-2">
            <Plus className="w-3.5 h-3.5" /> Novo Banco
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input type="text" placeholder="Buscar bancos..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-slate-800/60 overflow-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Nenhum banco</p>
            </div>
          ) : filtered.map(bank => (
            <button
              key={bank.id}
              onClick={() => setSelectedId(bank.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedId === bank.id ? 'bg-viva-500/10 border border-viva-600/30' : 'bg-slate-800/30 border border-transparent hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-viva-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{bank.name}</p>
                  {bank.description && <p className="text-[10px] text-slate-500 truncate">{bank.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); openEdit(bank.id); }} className="p-1 text-slate-500 hover:text-viva-400"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(bank.id); }} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="flex gap-3 mt-2 text-[10px] text-slate-500">
                <span>{getStats(bank.id).clients} clientes</span>
                <span>{getStats(bank.id).properties} imóveis</span>
                <span>{getStats(bank.id).exchanges} permutas</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 p-6 overflow-auto">
          {selected && stats ? (
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold text-slate-100 mb-6">{selected.name}</h2>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: 'Clientes', value: stats.clients, color: 'text-viva-400' },
                  { label: 'Imóveis', value: stats.properties, color: 'text-emerald-400' },
                  { label: 'Proprietários', value: stats.owners, color: 'text-amber-400' },
                  { label: 'Permutas', value: stats.exchanges, color: 'text-rose-400' },
                ].map(s => (
                  <div key={s.label} className="card text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="card">
                <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-viva-400" /> Participantes</h3>
                <div className="text-center py-4">
                  <Users className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs">Gerencie participantes e permissões</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Selecione um banco para ver detalhes
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-100">{editingId ? 'Editar Banco' : 'Novo Banco'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="text-xs font-medium text-slate-400 mb-1 block">Nome *</label><input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="Ex: Banco Permutas RS" /></div>
              <div><label className="text-xs font-medium text-slate-400 mb-1 block">Descrição</label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="input resize-none h-20" /></div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" className="btn-primary">{editingId ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
