import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, useTranslation } from '../context/AuthContext';
import { API, authFetch } from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';
import { StatsScreen } from './StatsScreen';

type SubTab = 'menu' | 'profile' | 'appearance' | 'stats' | 'data' | 'help';

export function ProfileScreen() {
  const { user, logout, updateUser, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [showSaved, setShowSaved] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [currentSubTab, setCurrentSubTab] = useState<SubTab>('menu');

  // Stats & App info
  const [stats, setStats] = useState<any>(null);
  const [version, setVersion] = useState("1.0.0");
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Form States (Local copies)
  const [localUser, setLocalUser] = useState<any>(null);
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [passMsg, setPassMsg] = useState({ text: '', type: '' });

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkUsernameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchExtra = async () => {
      try {
        const [statsRes, verRes] = await Promise.all([
          authFetch(`${API}/api/users/me/stats`),
          fetch(`${API}/api/app/version`)
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (verRes.ok) {
          const v = await verRes.json();
          setVersion(v.version);
        }
      } catch (err) {}
    };
    fetchExtra();

    const handleRefresh = () => fetchExtra();
    window.addEventListener('hustle-refresh', handleRefresh);
    return () => window.removeEventListener('hustle-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    if (user && !localUser) {
      setLocalUser(user);
      setLoading(false);
    }
  }, [user, localUser]);

  const triggerAutoSave = useCallback((updatedFields: any) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await authFetch(`${API}/api/users/me`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields)
        });
        if (res.ok) {
          const data = await res.json();
          updateUser(data);
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 2000);
        }
      } catch (err) {}
    }, 800);
  }, [updateUser]);

  const handleFieldChange = (field: string, value: any) => {
    const updated = { ...localUser, [field]: value };
    setLocalUser(updated);
    if (field !== 'username') triggerAutoSave({ [field]: value });
    else checkUsernameAvailability(value);
  };

  const checkUsernameAvailability = (name: string) => {
    if (name === user?.username) { setUsernameStatus('idle'); return; }
    if (name.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    if (checkUsernameTimeoutRef.current) clearTimeout(checkUsernameTimeoutRef.current);
    checkUsernameTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/users/check-username?username=${name}`);
        const data = await res.json();
        if (data.available) {
          setUsernameStatus('available');
          triggerAutoSave({ username: name });
        } else setUsernameStatus('taken');
      } catch { setUsernameStatus('idle'); }
    }, 500);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await authFetch(`${API}/api/users/me/photo`, { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        updateUser({ profile_photo: data.profile_photo });
        setLocalUser({ ...localUser, profile_photo: data.profile_photo });
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      }
    } catch {}
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const res = await authFetch(`${API}/api/data/export?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hustle_backup_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {}
  };

  const handleImport = async () => {
    if (!importFile) return;
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      const res = await authFetch(`${API}/api/data/import`, { method: 'POST', body: formData });
      if (res.ok) window.location.reload();
    } catch {}
  };

  if (loading || authLoading) return <div className="profile-container"><div className="skeleton" style={{ height: '300px', borderRadius: '24px' }} /></div>;

  const renderBackHeader = (title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', animation: 'fade-in 0.3s ease' }}>
      <button 
        onClick={() => setCurrentSubTab('menu')}
        style={{ 
          width: '40px', height: '40px', borderRadius: '12px', background: 'var(--bg-elevated)', 
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-1)', fontSize: '1.2rem', cursor: 'pointer'
        }}
      >
        ←
      </button>
      <h2 style={{ fontSize: '20px', fontWeight: 800 }}>{title}</h2>
    </div>
  );

  return (
    <div className="profile-container">
      {showSaved && <div className="saved-indicator">✓ Saved</div>}

      {currentSubTab === 'menu' ? (
        <div className="animate-fade-in">
          {/* USER HEADER */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div 
              onClick={() => document.getElementById('avatar-input')?.click()}
              style={{ 
                width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto 12px',
                background: 'var(--bg-surface)', border: '3px solid var(--p-accent-soft)',
                boxShadow: '0 0 20px rgba(123, 44, 191, 0.1)', overflow: 'hidden', position: 'relative'
              }}
              className="avatar-hover"
            >
              {localUser?.profile_photo ? (
                <img src={`${API}${localUser.profile_photo}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', background: 'var(--bg-elevated)' }}>
                  {localUser?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <input id="avatar-input" type="file" hidden accept="image/*" onChange={handlePhotoUpload} />
            <h1 style={{ fontSize: '22px', fontWeight: 800 }}>{localUser?.username}</h1>
            <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>@{localUser?.username?.toLowerCase()}</p>
          </div>

          {/* MENU LIST */}
          <div className="profile-card" style={{ padding: '8px' }}>
            <MenuItem icon="👤" label="Perfil" sub="Identidad, Seguridad, Negocio" onClick={() => setCurrentSubTab('profile')} />
            <MenuItem icon="🎨" label="Apariencia" sub="Tema, Animaciones, Efectos" onClick={() => setCurrentSubTab('appearance')} />
            <div className="profile-divider" style={{ margin: '8px 16px' }} />
            <MenuItem icon="💰" label="Estadísticas" sub="ROI, Profit total" onClick={() => setCurrentSubTab('stats')} />
            <MenuItem icon="💾" label="Gestión de Datos" sub="Backup y Restauración" onClick={() => setCurrentSubTab('data')} />
            <MenuItem icon="❓" label="Ayuda y Soporte" sub="Versión, Contacto" onClick={() => setCurrentSubTab('help')} />
          </div>

          <button 
            onClick={() => setShowLogoutConfirm(true)}
            style={{ width: '100%', marginTop: '24px', padding: '16px', borderRadius: '16px', background: 'rgba(255, 82, 82, 0.05)', border: '1px solid rgba(255, 82, 82, 0.1)', color: 'var(--danger)', fontWeight: 700 }}
          >
            Cerrar Sesión
          </button>
        </div>
      ) : (
        <div className="animate-slide-in-right">
          {currentSubTab === 'profile' && (
            <>
              {renderBackHeader("Perfil")}
              <div className="profile-card">
                {/* 1. IDENTIDAD */}
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px', letterSpacing: '0.05em' }}>Identidad</h3>
                <div className="profile-input-group">
                  <label className="profile-label">Nombre de usuario</label>
                  <div style={{ position: 'relative' }}>
                    <input className="neon-input" value={localUser?.username || ''} onChange={(e) => handleFieldChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
                    {usernameStatus === 'checking' && <div className="spinner-small" style={{ position: 'absolute', right: '12px', top: '14px' }} />}
                    {usernameStatus === 'available' && <span style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--success)' }}>✓</span>}
                  </div>
                </div>
                <div className="profile-input-group">
                  <label className="profile-label">Email</label>
                  <input className="neon-input" type="email" value={localUser?.email || ''} onChange={(e) => handleFieldChange('email', e.target.value)} />
                </div>

                <div className="profile-divider" style={{ margin: '24px 0' }} />

                <div className="profile-divider" style={{ margin: '24px 0' }} />
                
                {/* 4. SEGURIDAD */}
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px', letterSpacing: '0.05em' }}>Seguridad</h3>
                <button className="neon-button" style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} onClick={() => setShowPassModal(true)}>🔑 Cambiar contraseña</button>
              </div>
            </>
          )}

          {currentSubTab === 'appearance' && (
            <>
              {renderBackHeader("Apariencia")}
              <div className="profile-card">
                {/* 🌑 TEMA */}
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px', letterSpacing: '0.05em' }}>Tema</h3>
                <div className="profile-input-group">
                  <label className="profile-label">Tema Principal</label>
                  <select className="neon-input" value={localUser?.theme || 'dark-amoled'} onChange={(e) => handleFieldChange('theme', e.target.value)}>
                    <option value="dark-amoled">🌑 Dark AMOLED</option>
                    <option value="dark-premium">🌌 Dark Premium (V2)</option>
                    <option value="light">☀️ Modo Claro (Light)</option>
                  </select>
                </div>

                <div className="profile-divider" style={{ margin: '24px 0' }} />

                {/* 🎨 COLOR DE ACENTO */}
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px', letterSpacing: '0.05em' }}>Color de Acento</h3>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  {[
                    { name: 'Morado', hex: '#7B2CBF' },
                    { name: 'Azul', hex: '#3B82F6' },
                    { name: 'Verde', hex: '#10B981' },
                    { name: 'Rojo', hex: '#EF4444' },
                    { name: 'Amarillo', hex: '#F59E0B' },
                    { name: 'Rosa', hex: '#EC4899' }
                  ].map(color => (
                    <div 
                      key={color.hex}
                      onClick={() => handleFieldChange('accent_color', color.hex)}
                      style={{ 
                        width: '36px', height: '36px', borderRadius: '50%', background: color.hex,
                        cursor: 'pointer', border: localUser?.accent_color === color.hex ? '3px solid white' : '2px solid transparent',
                        boxShadow: localUser?.accent_color === color.hex ? `0 0 15px ${color.hex}` : 'none',
                        transition: 'all 0.2s'
                      }}
                      title={color.name}
                    />
                  ))}
                </div>

                <div className="profile-divider" style={{ margin: '24px 0' }} />

                {/* 🎬 ANIMACIONES */}
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px', letterSpacing: '0.05em' }}>Animaciones</h3>
                <div className="profile-input-group">
                  <label className="profile-label">Nivel de Animación</label>
                  <select className="neon-input" value={localUser?.animation_level || 'full'} onChange={(e) => handleFieldChange('animation_level', e.target.value)}>
                    <option value="full">⚡ Full (Todo activado)</option>
                    <option value="reduced">🕯️ Reduced (Suave)</option>
                    <option value="none">⏹️ Off (Instantáneo)</option>
                  </select>
                </div>

                <div className="profile-divider" style={{ margin: '24px 0' }} />

                {/* ✨ EFECTOS & UI */}
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px', letterSpacing: '0.05em' }}>Efectos & UI</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <AppearanceToggle 
                    label="Neon Glow" 
                    sub="Efectos de resplandor en botones y tarjetas" 
                    active={localUser?.neon_glow} 
                    onChange={(val) => handleFieldChange('neon_glow', val)} 
                  />
                  <AppearanceToggle 
                    label="Modo Compacto" 
                    sub="Reduce espacios para ver más contenido" 
                    active={localUser?.compact_mode} 
                    onChange={(val) => handleFieldChange('compact_mode', val)} 
                  />
                </div>

                <div className="profile-divider" style={{ margin: '24px 0' }} />

                {/* 📱 MOBILE EXPERIENCE */}
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px', letterSpacing: '0.05em' }}>Mobile Experience</h3>
                <AppearanceToggle 
                  label="Haptic Feedback" 
                  sub="Vibración ligera al interactuar" 
                  active={localUser?.haptics} 
                  onChange={(val) => {
                    handleFieldChange('haptics', val);
                    if (val && window.navigator.vibrate) window.navigator.vibrate(20);
                  }} 
                />
              </div>
            </>
          )}

          {currentSubTab === 'stats' && (
            <StatsScreen onBack={() => setCurrentSubTab('menu')} />
          )}

          {currentSubTab === 'data' && (
            <>
              {renderBackHeader("Gestión de Datos")}
              <div className="profile-card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <button className="neon-button" style={{ background: 'var(--bg-elevated)' }} onClick={() => handleExport('csv')}>📊 CSV</button>
                  <button className="neon-button" style={{ background: 'var(--bg-elevated)' }} onClick={() => handleExport('json')}>📦 JSON</button>
                </div>
                <button className="neon-button" style={{ width: '100%', background: 'var(--accent-soft)', border: '1px dashed var(--accent)', color: 'var(--accent)' }} onClick={() => document.getElementById('import-input')?.click()}>📥 Importar Backup</button>
                <input type="file" accept=".json" id="import-input" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) { setImportFile(file); setShowImportConfirm(true); } }} />
              </div>
            </>
          )}

          {currentSubTab === 'help' && (
            <>
              {renderBackHeader("Ayuda")}
              <div className="profile-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ color: 'var(--text-2)' }}>Versión</span>
                  <span style={{ fontWeight: 800 }}>v{version}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <a href="mailto:support@hustle.app" className="neon-button" style={{ textAlign: 'center', textDecoration: 'none', background: 'var(--bg-elevated)' }}>📧 Soporte</a>
                  <a href="#" className="neon-button" style={{ textAlign: 'center', textDecoration: 'none', background: 'var(--bg-elevated)' }}>🐞 Bug</a>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODALS */}
      {showImportConfirm && (
        <ConfirmModal title="¿Importar datos?" message="Esta acción reemplazará todos tus datos actuales. No se puede deshacer." confirmText="Importar Ahora" type="danger" onConfirm={handleImport} onCancel={() => { setShowImportConfirm(false); setImportFile(null); }} />
      )}
      {showLogoutConfirm && (
        <ConfirmModal title="¿Cerrar sesión?" message="Tendrás que volver a entrar con tus credenciales." confirmText="Cerrar Sesión" type="danger" onConfirm={logout} onCancel={() => setShowLogoutConfirm(false)} />
      )}
      
      {/* PASSWORD MODAL */}
      {showPassModal && (
        <div className="modal-overlay">
          <div className="modal-content profile-card" style={{ maxWidth: '400px', width: '90%' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '18px' }}>Cambiar contraseña</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (passData.new !== passData.confirm) { setPassMsg({ text: 'No coinciden', type: 'danger' }); return; }
              try {
                const res = await authFetch(`${API}/api/users/me/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: passData.current, new_password: passData.new }) });
                if (res.ok) { setPassMsg({ text: 'Éxito', type: 'success' }); setTimeout(() => setShowPassModal(false), 1500); }
                else { const err = await res.json(); setPassMsg({ text: err.detail, type: 'danger' }); }
              } catch { setPassMsg({ text: 'Error', type: 'danger' }); }
            }}>
              <input className="neon-input" type="password" placeholder="Actual" style={{ marginBottom: '12px' }} onChange={e => setPassData({...passData, current: e.target.value})} />
              <input className="neon-input" type="password" placeholder="Nueva" style={{ marginBottom: '12px' }} onChange={e => setPassData({...passData, new: e.target.value})} />
              <input className="neon-input" type="password" placeholder="Confirmar" style={{ marginBottom: '16px' }} onChange={e => setPassData({...passData, confirm: e.target.value})} />
              {passMsg.text && <div style={{ color: passMsg.type === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: '13px', marginBottom: '12px', fontWeight: 700 }}>{passMsg.text}</div>}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="neon-button" style={{ flex: 1, background: 'var(--bg-elevated)' }} onClick={() => setShowPassModal(false)}>Cancelar</button>
                <button type="submit" className="neon-button" style={{ flex: 1 }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <style>{`
        .spinner-small {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.1);
          border-top-color: var(--p-accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function AppearanceToggle({ label, sub, active, onChange }: { label: string, sub: string, active: boolean, onChange: (v: boolean) => void }) {
  return (
    <div 
      onClick={() => onChange(!active)}
      style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '12px 0', cursor: 'pointer' 
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '14px' }}>{label}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{sub}</div>
      </div>
      <div style={{ 
        width: '44px', height: '24px', borderRadius: '12px', 
        background: active ? 'var(--accent)' : 'var(--bg-elevated)',
        border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)',
        position: 'relative', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: active ? '0 0 10px var(--accent-soft)' : 'none'
      }}>
        <div style={{ 
          width: '18px', height: '18px', borderRadius: '50%', background: 'white',
          position: 'absolute', top: '2px', left: active ? '22px' : '2px',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }} />
      </div>
    </div>
  );
}

function MenuItem({ icon, label, sub, onClick }: { icon: string, label: string, sub: string, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '16px',
        cursor: 'pointer', transition: 'all 0.2s'
      }}
      className="menu-item-hover"
    >
      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '15px' }}>{label}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{sub}</div>
      </div>
      <div style={{ color: 'var(--text-3)', fontSize: '1.2rem' }}>›</div>
    </div>
  );
}

function StatBox({ label, value, isPrice, currency, lang, suffix, color }: any) {
  const displayValue = isPrice 
    ? new Intl.NumberFormat(lang === 'ES' ? 'es-ES' : 'en-US', { style: 'currency', currency: currency || 'EUR' }).format(value || 0)
    : `${(value || 0).toFixed(1)}${suffix || ''}`;
    
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 900, color }}>{value != null ? displayValue : '---'}</div>
    </div>
  );
}
