import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Database, Palette, Sun, Moon, Camera, Save, Plus, CreditCard as Edit2, Trash2, X, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import * as api from '../lib/api';

type Tab = 'profile' | 'banks' | 'appearance';

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const { banks, addBank, updateBank, deleteBank, refreshAll } = useData();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState({ name: '', description: '' });
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    region: '',
    agency: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshAll();
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        region: profile.region || '',
        agency: profile.agency || '',
      });
    }
  }, [profile, refreshAll]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.updateProfile(profileForm);
      await refreshProfile();
      alert('Perfil atualizado com sucesso!');
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBankModal = (bank?: { id: string; name: string; description?: string }) => {
    if (bank) {
      setEditingBankId(bank.id);
      setBankForm({ name: bank.name, description: bank.description || '' });
    } else {
      setEditingBankId(null);
      setBankForm({ name: '', description: '' });
    }
    setShowBankModal(true);
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBankId) {
        await updateBank(editingBankId, bankForm);
      } else {
        await addBank(bankForm);
      }
      setShowBankModal(false);
      setBankForm({ name: '', description: '' });
    } catch (error) {
      console.error('Error saving bank:', error);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este banco?')) {
      await deleteBank(id);
    }
  };

  const tabs = [
    { id: 'profile' as Tab, label: 'Perfil', icon: User },
    { id: 'banks' as Tab, label: 'Bancos', icon: Database },
    { id: 'appearance' as Tab, label: 'Aparência', icon: Palette },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="section-card border-0 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="page-header-box flex items-center gap-3">
            <div className="icon-box">
              <SettingsIcon className="w-6 h-6 text-viva-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Configurações</h1>
              <p className="text-xs text-muted mt-1">Gerencie seu perfil, bancos e preferências</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white/[0.05] text-primary shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-primary mb-4">Perfil Público</h2>

                {/* Avatar */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-viva-500 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {profileForm.full_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-white/[0.05] border divider text-muted hover:bg-white/[0.04] transition-colors">
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted">Foto de perfil</p>
                    <p className="text-xs text-muted">JPG, PNG ou GIF. Máximo 2MB.</p>
                  </div>
                </div>

                {/* Form */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted mb-1 block">Nome profissional</label>
                    <input
                      type="text"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      className="input"
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted mb-1 block">Telefone de contato</label>
                      <input
                        type="text"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="input"
                        placeholder="(51) 99999-9999"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted mb-1 block">Área de atuação</label>
                      <input
                        type="text"
                        value={profileForm.region}
                        onChange={(e) => setProfileForm({ ...profileForm, region: e.target.value })}
                        className="input"
                        placeholder="Porto Alegre, RS"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">Imobiliária</label>
                    <input
                      type="text"
                      value={profileForm.agency}
                      onChange={(e) => setProfileForm({ ...profileForm, agency: e.target.value })}
                      className="input"
                      placeholder="Nome da sua imobiliária"
                    />
                  </div>

                  <button onClick={handleSaveProfile} disabled={saving} className="btn-primary gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'banks' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Bancos (Workspaces)</h2>
                  <p className="text-xs text-muted mt-1">Organize imóveis, clientes e permutas em bancos compartilhados</p>
                </div>
                <button onClick={() => handleOpenBankModal()} className="btn-primary gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Banco
                </button>
              </div>

              {banks.length === 0 ? (
                <div className="empty-state text-center py-12">
                  <Database className="w-12 h-12 text-muted mx-auto mb-4" />
                  <p className="text-muted text-sm">Nenhum banco criado</p>
                  <p className="text-muted text-xs mt-1">Crie um banco para organizar seus imóveis e clientes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {banks.map(bank => (
                    <div
                      key={bank.id}
                      className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border divider hover:border-white/[0.06] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/[0.05] rounded-lg">
                          <Database className="w-4 h-4 text-viva-500" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-primary">{bank.name}</h3>
                          {bank.description && (
                            <p className="text-xs text-muted">{bank.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <Users className="w-3.5 h-3.5" />
                          <span>1 membro</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleOpenBankModal(bank)}
                            className="p-1.5 bg-white/[0.04] hover:bg-white/[0.06] rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-muted" />
                          </button>
                          <button
                            onClick={() => handleDeleteBank(bank.id)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4">Aparência</h2>
              <p className="text-xs text-muted mb-6">Escolha entre o tema noturno premium ou diurno premium</p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => theme === 'dark' || toggleTheme()}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-viva-500 bg-viva-500/10'
                      : 'divider hover:border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-center mb-4 h-24 bg-gradient-to-br from-[#0f1a12] to-[#1a2f1f] rounded-lg">
                    <Moon className="w-8 h-8 text-viva-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-sm font-medium text-primary">🌙 Noturno Premium</p>
                      <p className="text-xs text-muted">Madeira escura · Iluminação indireta</p>
                    </div>
                    {theme === 'dark' && (
                      <div className="w-4 h-4 rounded-full bg-viva-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => theme === 'light' || toggleTheme()}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    theme === 'light'
                      ? 'border-viva-500 bg-viva-500/10'
                      : 'divider hover:border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-center mb-4 h-24 bg-gradient-to-br from-[#F8F5EF] to-[#ECE4D8] rounded-lg border border-[#d4c8b8]/30">
                    <Sun className="w-8 h-8 text-viva-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-sm font-medium text-primary">☀️ Diurno Premium</p>
                      <p className="text-xs text-muted">Marfim · Madeira clara · Luminosidade</p>
                    </div>
                    {theme === 'light' && (
                      <div className="w-4 h-4 rounded-full bg-viva-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                </button>
              </div>

              <div className="mt-6 p-4 bg-white/[0.03] rounded-lg border divider">
                <p className="text-xs text-muted">
                  A escolha do tema é salva automaticamente no seu navegador.
                </p>
              </div>
            </div>
          )}
        </div>

      {/* Bank Modal */}
      {showBankModal && (
        <div className="modal-overlay" onClick={() => setShowBankModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 divider">
              <h2 className="text-lg font-bold text-primary">
                {editingBankId ? 'Editar Banco' : 'Novo Banco'}
              </h2>
              <button onClick={() => setShowBankModal(false)} className="p-1 hover:bg-white/[0.04] rounded">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="p-6 space-y-4">
              <div>
                <label className="text-xs text-muted mb-1 block">Nome do banco *</label>
                <input
                  type="text"
                  value={bankForm.name}
                  onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Banco Permutas RS"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Descrição</label>
                <textarea
                  value={bankForm.description}
                  onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })}
                  className="input resize-none h-20"
                  placeholder="Descrição opcional..."
                />
              </div>
              <div className="flex gap-3 pt-4 divider">
                <button type="button" onClick={() => setShowBankModal(false)} className="btn-ghost flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingBankId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
