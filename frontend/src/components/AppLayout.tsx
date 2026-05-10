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
          width: '260px',
          background: 'rgba(10,10,10,0.8)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column',
          padding: '32px 24px',
          flexShrink: 0,
          zIndex: 100
        }}>
          <div style={{ marginBottom: '32px', padding: '0 8px' }}>
            <h1 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 900, 
              color: 'var(--text-1)', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase',
              textShadow: '0 0 16px var(--accent-glow)'
            }}>
              {user?.business_name || <>HUS<span style={{ color: 'var(--accent)' }}>TLE</span></>}
            </h1>
          </div>
          
          <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)', marginBottom: '32px' }}></div>

          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className={`desktop-nav-btn ${currentTab === 'orders' ? 'active' : ''}`}
              onClick={() => onTabChange('orders')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: currentTab === 'orders' ? 'var(--accent)' : 'inherit' }}>
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              {t('orders')}
            </button>

            <button
              className={`desktop-nav-btn ${currentTab === 'inventory' ? 'active' : ''}`}
              onClick={() => onTabChange('inventory')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: currentTab === 'inventory' ? 'var(--accent)' : 'inherit' }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              {t('inventory')}
            </button>

            <button
              className={`desktop-nav-btn ${currentTab === 'profile' ? 'active' : ''}`}
              onClick={() => onTabChange('profile')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: currentTab === 'profile' ? 'var(--accent)' : 'inherit' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              {t('profile')}
            </button>
          </nav>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Profit Indicator */}
            <div style={{
              padding: '16px',
              background: '#111111',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.04)'
            }}>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                {t('total_profit')}
              </p>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: 900,
                color: globalProfit >= 0 ? 'var(--success)' : 'var(--danger)',
                textShadow: `0 0 12px ${globalProfit >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
              }}>
                {formatPrice(globalProfit, user?.currency)}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--text-3)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--danger)';
                e.currentTarget.style.background = 'rgba(255,82,82,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-3)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
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
