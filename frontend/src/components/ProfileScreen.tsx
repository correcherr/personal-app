import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, useTranslation } from '../context/AuthContext';
import { API, authFetch } from '../utils/helpers';
import { useDevice } from '../hooks/useMediaQuery';
import { ConfirmModal } from './ConfirmModal';
import { StatsScreen } from './StatsScreen';

type SubTab = 'menu' | 'profile' | 'appearance' | 'stats' | 'data' | 'help';

export function ProfileScreen() {
  const { isDesktop } = useDevice();
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
  const saveTimeoutRef = useRef<any>(null);
  const checkUsernameTimeoutRef = useRef<any>(null);

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

  useEffect(() => {
    if (isDesktop && currentSubTab === 'menu') {
      setCurrentSubTab('profile');
    }
  }, [isDesktop, currentSubTab]);

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

  const renderBackHeader = (title: string, showBack = true) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', animation: 'fade-in 0.3s ease' }}>
      {showBack && (
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
      )}
      <h2 style={{ fontSize: '20px', fontWeight: 800 }}>{title}</h2>
    </div>
  );

  // ---------- ESTILOS INLINE DE ESCRITORIO PREMIUM ----------
  const dsCard = { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", overflow: "hidden", marginBottom: "32px" };
  const dsRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" };
  const dsRowLast = { ...dsRow, borderBottom: "none" };
  const dsLabel = { fontSize: "14px", fontWeight: 500, color: "var(--text-1)", margin: 0 };
  const dsSubLabel = { fontSize: "12px", color: "var(--text-3)", marginTop: "4px" };
  const dsInputWrap = { position: "relative" as const, width: "240px" };
  const dsInput = { width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", color: "white", fontSize: "14px", outline: "none", transition: "border 0.2s" };
  const dsSelect = { ...dsInput, appearance: "none" as const, cursor: "pointer" };
  const dsSectionTitle = { fontSize: "24px", fontWeight: 700, color: "white", marginBottom: "24px", letterSpacing: "-0.5px" };

  // ---------- SECCIONES DE CONTENIDO (Desktop / Premium) ----------
  const renderDesktopProfile = () => (
    <div className="animate-fade-in" style={{ maxWidth: "800px" }}>
      <h2 style={dsSectionTitle}>Identidad</h2>
      <div style={dsCard}>
        <div style={dsRow}>
          <div>
            <p style={dsLabel}>Nombre de usuario</p>
            <p style={dsSubLabel}>Tu @handle público</p>
          </div>
          <div style={dsInputWrap}>
            <input style={dsInput} value={localUser?.username || ''} onChange={(e) => handleFieldChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            {usernameStatus === 'checking' && <div className="spinner-small" style={{ position: 'absolute', right: '12px', top: '10px' }} />}
            {usernameStatus === 'available' && <span style={{ position: 'absolute', right: '12px', top: '8px', color: 'var(--success)', fontSize: "14px" }}>✓</span>}
          </div>
        </div>
        <div style={dsRowLast}>
          <div>
            <p style={dsLabel}>Correo electrónico</p>
            <p style={dsSubLabel}>Solo para notificaciones y seguridad</p>
          </div>
          <div style={dsInputWrap}>
            <input type="email" style={dsInput} value={localUser?.email || ''} onChange={(e) => handleFieldChange('email', e.target.value)} onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
          </div>
        </div>
      </div>

      <h2 style={dsSectionTitle}>Seguridad</h2>
      <div style={dsCard}>
        <div style={dsRowLast}>
          <div>
            <p style={dsLabel}>Contraseña</p>
            <p style={dsSubLabel}>Actualiza tu contraseña de acceso</p>
          </div>
          <div>
            <button style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "8px 16px", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 500, transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onClick={() => setShowPassModal(true)}>
              Cambiar Contraseña
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDesktopAppearance = () => (
    <div className="animate-fade-in" style={{ maxWidth: "800px" }}>
      <h2 style={dsSectionTitle}>Apariencia</h2>
      <div style={dsCard}>
        <div style={dsRow}>
          <div>
            <p style={dsLabel}>Tema Principal</p>
            <p style={dsSubLabel}>La paleta de colores base de la interfaz</p>
          </div>
          <div style={dsInputWrap}>
            <select style={dsSelect} value={localUser?.theme || 'dark-amoled'} onChange={(e) => handleFieldChange('theme', e.target.value)}>
              <option value="dark-amoled">🌑 Dark AMOLED</option>
              <option value="dark-premium">🌌 Dark Premium (V2)</option>
              <option value="light">☀️ Modo Claro (Light)</option>
            </select>
          </div>
        </div>
        
        <div style={dsRow}>
          <div>
            <p style={dsLabel}>Color de Acento</p>
            <p style={dsSubLabel}>Botones, links y estados activos</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { hex: '#7B2CBF' }, { hex: '#3B82F6' }, { hex: '#10B981' },
              { hex: '#EF4444' }, { hex: '#F59E0B' }, { hex: '#EC4899' }
            ].map(color => (
              <div 
                key={color.hex}
                onClick={() => handleFieldChange('accent_color', color.hex)}
                style={{ 
                  width: '28px', height: '28px', borderRadius: '50%', background: color.hex,
                  cursor: 'pointer', border: localUser?.accent_color === color.hex ? '2px solid white' : '2px solid transparent',
                  boxShadow: localUser?.accent_color === color.hex ? `0 0 10px ${color.hex}` : 'none',
                  transition: 'all 0.2s'
                }}
              />
            ))}
          </div>
        </div>

        <div style={dsRowLast}>
          <div>
            <p style={dsLabel}>Nivel de Animación</p>
            <p style={dsSubLabel}>Reduce los movimientos si lo prefieres</p>
          </div>
          <div style={dsInputWrap}>
            <select style={dsSelect} value={localUser?.animation_level || 'full'} onChange={(e) => handleFieldChange('animation_level', e.target.value)}>
              <option value="full">⚡ Full (Todo activado)</option>
              <option value="reduced">🕯️ Reduced (Suave)</option>
              <option value="none">⏹️ Off (Instantáneo)</option>
            </select>
          </div>
        </div>
      </div>

      <h2 style={dsSectionTitle}>Preferencias de UI</h2>
      <div style={dsCard}>
        <div style={dsRow}>
          <div>
            <p style={dsLabel}>Efecto Glow</p>
            <p style={dsSubLabel}>Resplandor estético en tarjetas (consume más GPU)</p>
          </div>
          <div>
            <DesktopToggle active={localUser?.neon_glow} onChange={(val) => handleFieldChange('neon_glow', val)} />
          </div>
        </div>
        <div style={dsRowLast}>
          <div>
            <p style={dsLabel}>Modo Compacto</p>
            <p style={dsSubLabel}>Aumenta la densidad de información en listas</p>
          </div>
          <div>
            <DesktopToggle active={localUser?.compact_mode} onChange={(val) => handleFieldChange('compact_mode', val)} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderDesktopData = () => (
    <div className="animate-fade-in" style={{ maxWidth: "800px" }}>
      <h2 style={dsSectionTitle}>Gestión de Datos</h2>
      <div style={dsCard}>
        <div style={dsRow}>
          <div>
            <p style={dsLabel}>Exportar Inventario</p>
            <p style={dsSubLabel}>Descarga un Excel o JSON con tus pedidos</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "8px 16px", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 500 }} onClick={() => handleExport('csv')}>CSV</button>
            <button style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "8px 16px", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 500 }} onClick={() => handleExport('json')}>JSON</button>
          </div>
        </div>
        <div style={dsRowLast}>
          <div>
            <p style={dsLabel}>Importar Datos</p>
            <p style={dsSubLabel}>Sube un JSON para sobrescribir tu base de datos</p>
          </div>
          <div>
             <button style={{ background: "rgba(255,82,82,0.1)", border: "1px solid rgba(255,82,82,0.2)", padding: "8px 16px", borderRadius: "8px", color: "var(--danger)", cursor: "pointer", fontSize: "13px", fontWeight: 500 }} onClick={() => document.getElementById('import-input')?.click()}>Restaurar Backup</button>
             <input type="file" accept=".json" id="import-input" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) { setImportFile(file); setShowImportConfirm(true); } }} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderDesktopHelp = () => (
    <div className="animate-fade-in" style={{ maxWidth: "800px" }}>
      <h2 style={dsSectionTitle}>Sistema & Ayuda</h2>
      <div style={dsCard}>
        <div style={dsRow}>
          <div>
            <p style={dsLabel}>Versión del Cliente</p>
            <p style={dsSubLabel}>HUSTLE Core Web</p>
          </div>
          <div style={{ color: "var(--text-3)", fontSize: "14px", fontFamily: "monospace" }}>
            v{version}
          </div>
        </div>
        <div style={dsRowLast}>
          <div>
            <p style={dsLabel}>Soporte Técnico</p>
            <p style={dsSubLabel}>Contacta si experimentas errores críticos</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
             <a href="mailto:support@hustle.app" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "8px 16px", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 500, textDecoration: "none" }}>Soporte</a>
          </div>
        </div>
      </div>
    </div>
  );

  // ---------- SECCIONES DE CONTENIDO (Móvil Legacy) ----------
  
  const renderProfileContent = (isDesktopView: boolean) => (
    <>
      {renderBackHeader("Perfil", !isDesktopView)}
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
        
        {/* 4. SEGURIDAD */}
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px', letterSpacing: '0.05em' }}>Seguridad</h3>
        <button className="neon-button glow-hover" style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setShowPassModal(true)}>🔑 Cambiar contraseña</button>
      </div>
    </>
  );

  const renderAppearanceContent = (isDesktopView: boolean) => (
    <>
      {renderBackHeader("Apariencia", !isDesktopView)}
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
  );

  const renderDataContent = (isDesktopView: boolean) => (
    <>
      {renderBackHeader("Gestión de Datos", !isDesktopView)}
      <div className="profile-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <button className="neon-button glow-hover" style={{ background: 'var(--bg-elevated)', cursor: 'pointer' }} onClick={() => handleExport('csv')}>📊 CSV</button>
          <button className="neon-button glow-hover" style={{ background: 'var(--bg-elevated)', cursor: 'pointer' }} onClick={() => handleExport('json')}>📦 JSON</button>
        </div>
        <button className="neon-button glow-hover" style={{ width: '100%', background: 'var(--accent-soft)', border: '1px dashed var(--accent)', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => document.getElementById('import-input')?.click()}>📥 Importar Backup</button>
        <input type="file" accept=".json" id="import-input" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) { setImportFile(file); setShowImportConfirm(true); } }} />
      </div>
    </>
  );

  const renderHelpContent = (isDesktopView: boolean) => (
    <>
      {renderBackHeader("Ayuda", !isDesktopView)}
      <div className="profile-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ color: 'var(--text-2)' }}>Versión</span>
          <span style={{ fontWeight: 800 }}>v{version}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <a href="mailto:support@hustle.app" className="neon-button glow-hover" style={{ textAlign: 'center', textDecoration: 'none', background: 'var(--bg-elevated)' }}>📧 Soporte</a>
          <a href="#" className="neon-button glow-hover" style={{ textAlign: 'center', textDecoration: 'none', background: 'var(--bg-elevated)' }}>🐞 Bug</a>
        </div>
      </div>
    </>
  );

  // ---------- RENDER DESKTOP ----------
  if (isDesktop) {
    return (
      <div className="desktop-profile-container" style={{ display: "flex", maxWidth: "1200px", margin: "0 auto", padding: "40px", gap: "60px", height: "100%", alignItems: "flex-start" }}>
        {showSaved && <div className="saved-indicator">✓ Guardado</div>}
        
        {/* SIDEBAR IZQUIERDA (Estilo Linear) */}
        <div style={{ width: "240px", flexShrink: 0, position: "sticky", top: "40px" }}>
          {/* USER HEADER MINI */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
            <div 
              onClick={() => document.getElementById('avatar-input')?.click()}
              style={{ 
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden', cursor: 'pointer', flexShrink: 0
              }}
            >
              {localUser?.profile_photo ? (
                <img src={`${API}${localUser.profile_photo}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: "var(--text-2)" }}>
                  {localUser?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ overflow: "hidden" }}>
              <h1 style={{ fontSize: '16px', fontWeight: 600, margin: "0 0 2px", color: "white", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{localUser?.username}</h1>
              <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>Preferencias</p>
            </div>
            <input id="avatar-input" type="file" hidden accept="image/*" onChange={handlePhotoUpload} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
             <DesktopMenuItem icon="👤" label="Mi Cuenta" active={currentSubTab === 'profile'} onClick={() => setCurrentSubTab('profile')} />
             <DesktopMenuItem icon="🎨" label="Apariencia" active={currentSubTab === 'appearance'} onClick={() => setCurrentSubTab('appearance')} />
             <DesktopMenuItem icon="💰" label="Estadísticas" active={currentSubTab === 'stats'} onClick={() => setCurrentSubTab('stats')} />
             <DesktopMenuItem icon="💾" label="Datos" active={currentSubTab === 'data'} onClick={() => setCurrentSubTab('data')} />
             <DesktopMenuItem icon="❓" label="Acerca de" active={currentSubTab === 'help'} onClick={() => setCurrentSubTab('help')} />
          </div>

          <div style={{ marginTop: "40px" }}>
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-3)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', display: "flex", gap: "12px", alignItems: "center" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(255,82,82,0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: "1.2rem" }}>🚪</span> Cerrar Sesión
            </button>
          </div>
        </div>

        {/* CONTENIDO DERECHO */}
        <div style={{ flex: 1, paddingBottom: "100px", overflowY: "auto", height: "calc(100vh - 80px)", paddingRight: "20px" }} className="scroll-hidden">
          {currentSubTab === 'profile' && renderDesktopProfile()}
          {currentSubTab === 'appearance' && renderDesktopAppearance()}
          {currentSubTab === 'stats' && (
            <div style={{ maxWidth: "800px" }}>
              <h2 style={dsSectionTitle}>Rendimiento Financiero</h2>
              <StatsScreen onBack={() => {}} hideBackButton={true} />
            </div>
          )}
          {currentSubTab === 'data' && renderDesktopData()}
          {currentSubTab === 'help' && renderDesktopHelp()}
        </div>

        {/* MODALS */}
        {showImportConfirm && (
          <ConfirmModal title="¿Importar datos?" message="Esta acción reemplazará todos tus datos actuales. No se puede deshacer." confirmText="Importar Ahora" type="danger" onConfirm={handleImport} onCancel={() => { setShowImportConfirm(false); setImportFile(null); }} />
        )}
        {showLogoutConfirm && (
          <ConfirmModal title="¿Cerrar sesión?" message="Tendrás que volver a entrar con tus credenciales." confirmText="Cerrar Sesión" type="danger" onConfirm={logout} onCancel={() => setShowLogoutConfirm(false)} />
        )}
        
        {/* PASSWORD MODAL DESKTOP */}
        {showPassModal && (
          <div className="modal-overlay" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
            <div className="modal-content" style={{ maxWidth: '400px', width: '100%', background: "#111", border: "1px solid #333", borderRadius: "16px", padding: "32px" }}>
              <h2 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 600, color: "white" }}>Cambiar Contraseña</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (passData.new !== passData.confirm) { setPassMsg({ text: 'No coinciden', type: 'danger' }); return; }
                try {
                  const res = await authFetch(`${API}/api/users/me/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: passData.current, new_password: passData.new }) });
                  if (res.ok) { setPassMsg({ text: 'Éxito', type: 'success' }); setTimeout(() => setShowPassModal(false), 1500); }
                  else { const err = await res.json(); setPassMsg({ text: err.detail, type: 'danger' }); }
                } catch { setPassMsg({ text: 'Error', type: 'danger' }); }
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                  <input style={dsInput} type="password" placeholder="Contraseña Actual" onChange={e => setPassData({...passData, current: e.target.value})} onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  <input style={dsInput} type="password" placeholder="Nueva Contraseña" onChange={e => setPassData({...passData, new: e.target.value})} onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  <input style={dsInput} type="password" placeholder="Confirmar Contraseña" onChange={e => setPassData({...passData, confirm: e.target.value})} onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
                {passMsg.text && <div style={{ color: passMsg.type === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>{passMsg.text}</div>}
                <div style={{ display: 'flex', gap: '12px', justifyContent: "flex-end" }}>
                  <button type="button" style={{ background: 'transparent', border: "none", color: "var(--text-2)", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 500 }} onClick={() => setShowPassModal(false)}>Cancelar</button>
                  <button type="submit" style={{ background: 'white', color: "black", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Actualizar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- RENDER MOBILE ----------
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
              className={`avatar-hover ${isDesktop ? 'desktop-profile-avatar' : ''}`}
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
          {currentSubTab === 'profile' && renderProfileContent(false)}
          {currentSubTab === 'appearance' && renderAppearanceContent(false)}
          {currentSubTab === 'stats' && <StatsScreen onBack={() => setCurrentSubTab('menu')} hideBackButton={false} />}
          {currentSubTab === 'data' && renderDataContent(false)}
          {currentSubTab === 'help' && renderHelpContent(false)}
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


// Sub-componente para el toggle en escritorio
function DesktopToggle({ active, onChange }: { active: boolean, onChange: (v: boolean) => void }) {
  return (
    <div 
      onClick={() => onChange(!active)}
      style={{ 
        width: '40px', height: '22px', borderRadius: '11px', 
        background: active ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.3s'
      }}
    >
      <div style={{ 
        width: '18px', height: '18px', borderRadius: '50%', background: 'white',
        position: 'absolute', top: '2px', left: active ? '20px' : '2px',
        transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }} />
    </div>
  );
}

// Sub-componente para el menú lateral de escritorio
function DesktopMenuItem({ icon, label, active, onClick }: { icon: string, label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px',
        cursor: 'pointer', transition: 'all 0.2s',
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: active ? 'white' : 'var(--text-3)',
        fontWeight: 500,
        fontSize: "14px"
      }}
      onMouseEnter={(e) => { if(!active) { e.currentTarget.style.color = "white"; e.currentTarget.style.background = "rgba(255,255,255,0.03)" } }}
      onMouseLeave={(e) => { if(!active) { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent" } }}
    >
      <span style={{ fontSize: '1.1rem', opacity: active ? 1 : 0.7 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
