import React, { useState, useEffect } from 'react';
import { useDevice } from '../hooks/useMediaQuery';
import type { TabType } from '../App';
import { useAuth, useTranslation } from '../context/AuthContext';
import { formatPrice } from '../utils/helpers';

interface AppLayoutProps {
  children: React.ReactNode;
  globalProfit: number;
  onLogout: () => void;
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function AppLayout({ children, globalProfit, onLogout, currentTab, onTabChange }: AppLayoutProps) {
  const { isDesktop } = useDevice();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isNavHidden, setIsNavHidden] = useState(false);

  useEffect(() => {
    const handleSheetState = (e: CustomEvent<{isOpen: boolean}>) => {
      setIsNavHidden(e.detail.isOpen);
    };
    window.addEventListener('bottomSheetState' as any, handleSheetState);
    return () => window.removeEventListener('bottomSheetState' as any, handleSheetState);
  }, []);

  if (isDesktop) {
    return (
      <div className="desktop-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
        {/* Sidebar */}
        <aside style={{
          width: '280px',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '32px 24px',
          flexShrink: 0,
          zIndex: 100
        }}>
          <div style={{ marginBottom: '48px', padding: '0 8px' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.04em', textTransform: 'uppercase' }}>
              {user?.business_name || <>HUS<span style={{ color: 'var(--accent)' }}>TLE</span></>}
            </h1>
          </div>

          <div style={{
            marginBottom: '40px',
            padding: '24px',
            background: 'var(--bg-elevated)',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              {t('total_profit')}
            </p>
            <div style={{
              fontSize: '1.8rem',
              fontWeight: 900,
              color: globalProfit >= 0 ? 'var(--success)' : 'var(--danger)'
            }}>
              {formatPrice(globalProfit, user?.currency)}
            </div>
          </div>

          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => onTabChange('orders')}
              style={{
                textAlign: 'left',
                padding: '16px 20px',
                borderRadius: '16px',
                background: currentTab === 'orders' ? 'var(--accent-soft)' : 'transparent',
                color: currentTab === 'orders' ? 'var(--accent)' : 'var(--text-2)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: currentTab === 'orders' ? '1px solid var(--accent)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <span style={{fontSize: '1.3rem'}}>🛒</span> {t('orders')}
            </button>

            <button
              onClick={() => onTabChange('inventory')}
              style={{
                textAlign: 'left',
                padding: '16px 20px',
                borderRadius: '16px',
                background: currentTab === 'inventory' ? 'var(--accent-soft)' : 'transparent',
                color: currentTab === 'inventory' ? 'var(--accent)' : 'var(--text-2)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: currentTab === 'inventory' ? '1px solid var(--accent)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <span style={{fontSize: '1.3rem'}}>📦</span> {t('inventory')}
            </button>

            <button
              onClick={() => onTabChange('profile')}
              style={{
                textAlign: 'left',
                padding: '16px 20px',
                borderRadius: '16px',
                background: currentTab === 'profile' ? 'var(--accent-soft)' : 'transparent',
                color: currentTab === 'profile' ? 'var(--accent)' : 'var(--text-2)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: currentTab === 'profile' ? '1px solid var(--accent)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <span style={{fontSize: '1.3rem'}}>👤</span> {t('profile')}
            </button>
          </nav>

          <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
             <button
              onClick={onLogout}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid rgba(255,82,82,0.1)',
                background: 'rgba(255,82,82,0.05)',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              Cerrar Sesión
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, height: '100vh', overflow: 'hidden', position: 'relative' }}>
          {children}
        </main>
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="mobile-layout" style={{ 
      minHeight: '100vh', 
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Mobile Top Header */}
      <header style={{
        padding: '16px 20px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
          {user?.business_name || <>HUS<span style={{ color: 'var(--accent)' }}>TLE</span></>}
        </h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('profit')}</div>
          <div style={{ 
            fontSize: '1rem', 
            fontWeight: 900, 
            color: globalProfit >= 0 ? 'var(--success)' : 'var(--danger)' 
          }}>
            {formatPrice(globalProfit, user?.currency)}
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main style={{ flex: 1, paddingBottom: '100px', overflowY: 'auto' }}>
        {children}
      </main>

      {/* Premium Floating Bottom Navigation */}
      <nav className={`bottom-nav ${isNavHidden ? 'hidden' : ''}`}>
        <a 
          href="#" 
          className={`bottom-nav-item ${currentTab === 'inventory' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); onTabChange('inventory'); }}
        >
          <div className="nav-icon-circle">📦</div>
          <span>{t('inventory')}</span>
        </a>
        
        <a 
          href="#" 
          className={`bottom-nav-item ${currentTab === 'orders' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); onTabChange('orders'); }}
        >
          <div className="nav-icon-circle">🛒</div>
          <span>{t('orders')}</span>
        </a>
        
        <a 
          href="#" 
          className={`bottom-nav-item ${currentTab === 'profile' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); onTabChange('profile'); }}
        >
          <div className="nav-icon-circle">👤</div>
          <span>{t('profile')}</span>
        </a>
      </nav>
    </div>
  );
}
