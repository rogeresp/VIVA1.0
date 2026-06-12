import { useState } from 'react';
import { ArrowLeftRight, Edit2, Trash2, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import type { Exchange } from '../lib/types';
import { ASSET_TYPES, BRL } from '../lib/constants';

export default function Exchanges() {
  const { exchanges, properties, addExchange, updateExchange, deleteExchange } = useData();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMatchEngine, setShowMatchEngine] = useState(false);

  const [form, setForm] = useState<Partial<Exchange>>({
    visibility: 'privado',
  });

  const filtered = exchanges.filter((e) =>
    e.asset_name.toLowerCase().includes(search.toLowerCase()) ||
    e.asset_type.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  const matches = exchanges
    .filter((e) => e.seeking && e.visibility !== 'privado')
    .flatMap((exchange) =>
      exchanges
        .filter((target) =>
          target.id !== exchange.id &&
          target.asset_type.toLowerCase().includes((exchange.seeking || '').toLowerCase())
        )
        .map((target) => ({ source: exchange, target }))
    );

  const totalValue = exchanges.reduce((sum, e) => sum + (e.estimated_value || 0), 0);

  const handleOpen = (exchange?: Exchange) => {
    if (exchange) {
      setEditingId(exchange.id);
      setForm(exchange);
    } else {
      setEditingId(null);
      setForm({ visibility: 'privado' });
    }
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (editingId) {
        await updateExchange(editingId, form);
      } else {
        await addExchange(form);
      }
      handleClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja deletar esta permuta?')) {
      try {
        await deleteExchange(id);
      } catch (error) {
        console.error(error);
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
              <ArrowLeftRight className="w-6 h-6 text-viva-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Permutas</h1>
              <p className="text-xs text-muted mt-1">{filtered.length} ativo(s) · Total: {BRL(totalValue)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMatchEngine(!showMatchEngine)}
              className={`btn gap-2 ${
                showMatchEngine ? 'bg-viva-500/15 text-viva-400' : 'btn-ghost'
              }`}
            >
              Motor de Matches
            </button>
            <button
              onClick={() => handleOpen()}
              className="btn-primary gap-2"
            >
              Novo Ativo
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ativo, tipo ou descrição..."
            className="input max-w-md"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Match Engine */}
        {showMatchEngine && (
          <div className="card p-6">
            <h2 className="text-base font-semibold text-primary mb-4">Análise de Compatibilidade</h2>
            {matches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((match, idx) => (
                  <div key={idx} className="card !p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <p className="text-xs text-muted">Oferece:</p>
                        <p className="text-sm font-semibold text-primary">{match.source.asset_name}</p>
                        <p className="text-xs text-accent">{BRL(match.source.estimated_value)}</p>
                      </div>
                      <div className="text-2xl text-accent">⇄</div>
                      <div className="flex-1">
                        <p className="text-xs text-muted">Busca:</p>
                        <p className="text-sm font-semibold text-primary">{match.target.asset_name}</p>
                        <p className="text-xs text-accent">{BRL(match.target.estimated_value)}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted">
                      Compatibilidade: {Math.round((match.source.estimated_value / match.target.estimated_value) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Nenhuma compatibilidade encontrada</p>
            )}
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((exchange) => (
            <div key={exchange.id} className="card group">
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <span className="tag bg-amber-500/15 text-amber-400 mb-2">{exchange.asset_type}</span>
                  <h3 className="text-lg font-semibold text-primary">{exchange.asset_name}</h3>
                </div>
                {exchange.visibility === 'rede' && (
                  <span className="badge bg-viva-500/15 text-viva-400">Rede</span>
                )}
              </div>

              {/* Description */}
              {exchange.description && (
                <p className="text-sm text-muted mb-4">{exchange.description}</p>
              )}

              {/* Value */}
              <div className="divider my-4" />
              <p className="text-xs text-muted mb-1">Valor estimado</p>
              <p className="text-xl font-semibold text-accent">{BRL(exchange.estimated_value)}</p>

              {/* Seeking & Not Accepted */}
              <div className="space-y-3 my-4">
                {exchange.seeking && (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(63, 125, 88, 0.08)', border: '1px solid rgba(63, 125, 88, 0.15)' }}>
                    <p className="text-xs text-muted mb-1">Procura:</p>
                    <p className="text-sm" style={{ color: '#D8B47A' }}>{exchange.seeking}</p>
                  </div>
                )}
                {exchange.not_accepted && (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <p className="text-xs text-muted mb-1">Não aceita:</p>
                    <p className="text-sm" style={{ color: '#ef4444' }}>{exchange.not_accepted}</p>
                  </div>
                )}
              </div>

              {/* Percent Accepted */}
              {exchange.percent_accepted && (
                <div className="mb-4">
                  <p className="text-xs text-muted mb-1">Aceita {exchange.percent_accepted}% em permuta</p>
                  <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${exchange.percent_accepted}%`, background: 'linear-gradient(90deg, #3F7D58, #5BAA74)' }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 pt-3">
                <button
                  onClick={() => handleOpen(exchange)}
                  className="btn-ghost flex-1 justify-center text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(exchange.id)}
                  className="btn-danger flex-1 justify-center text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Deletar
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <ArrowLeftRight className="empty-icon" />
            <p>Nenhum ativo encontrado</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal-content max-w-xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 divider shrink-0">
              <h2 className="text-xl font-bold text-primary">
                {editingId ? 'Editar Permuta' : 'Novo Ativo de Permuta'}
              </h2>
              <button onClick={handleClose} className="p-1 rounded-lg hover:bg-white/[0.04] transition-colors">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm text-secondary mb-2">Tipo de Ativo</label>
                <select
                  value={form.asset_type || ''}
                  onChange={(e) => setForm({ ...form, asset_type: e.target.value })}
                  className="select"
                >
                  <option value="">Selecione...</option>
                  {ASSET_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">Nome do Ativo</label>
                <input
                  type="text"
                  value={form.asset_name || ''}
                  onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
                  placeholder="Ex: Apartamento na Barra da Tijuca"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">Valor Estimado</label>
                <input
                  type="number"
                  value={form.estimated_value || ''}
                  onChange={(e) => setForm({ ...form, estimated_value: parseFloat(e.target.value) })}
                  placeholder="0,00"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">Descrição</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalhes sobre o ativo..."
                  className="input min-h-[80px] resize-y"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">O que procura em permuta</label>
                <textarea
                  value={form.seeking || ''}
                  onChange={(e) => setForm({ ...form, seeking: e.target.value })}
                  placeholder="Ex: Imóvel residencial, terreno, veículo..."
                  className="input min-h-[80px] resize-y"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">Não aceita em permuta</label>
                <textarea
                  value={form.not_accepted || ''}
                  onChange={(e) => setForm({ ...form, not_accepted: e.target.value })}
                  placeholder="Tipos de ativos que não aceita..."
                  className="input min-h-[80px] resize-y"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">Percentual aceito em permuta (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.percent_accepted || ''}
                  onChange={(e) => setForm({ ...form, percent_accepted: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="0"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">Imóvel associado (opcional)</label>
                <select
                  value={form.property_id || ''}
                  onChange={(e) => setForm({ ...form, property_id: e.target.value || undefined })}
                  className="select"
                >
                  <option value="">Nenhum</option>
                  {properties
                    .filter((p) => p.accepts_exchange)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.code} - {p.neighborhood}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">Visibilidade</label>
                <select
                  value={form.visibility || ''}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value as any })}
                  className="select"
                >
                  <option value="privado">Privado</option>
                  <option value="banco">Banco</option>
                  <option value="rede">Rede</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 p-6 divider">
              <button onClick={handleClose} className="btn-ghost flex-1 justify-center">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 justify-center">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
