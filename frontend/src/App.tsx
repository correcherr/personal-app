import { useState } from "react"
import './index.css'
import { LoginScreen } from "./components/LoginScreen"
import { AppLayout } from "./components/AppLayout"
import { OrdersScreen } from "./components/OrdersScreen"
import { ProfileScreen } from "./components/ProfileScreen"
import { useAuth } from "./context/AuthContext"

export type TabType = 'orders' | 'inventory' | 'profile';

function AppContent() {
  const { user, logout, isLoading } = useAuth();
  const [totalOrderProfit, setTotalOrderProfit] = useState<number>(0)
  const [currentTab, setCurrentTab] = useState<TabType>('orders')

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ color: 'var(--accent)', fontWeight: 800 }}>Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const themeClass = user?.theme === 'dark-amoled' ? 'amoled-theme' : (user?.theme === 'light' ? 'light-theme' : '');
  const glowClass = user?.neon_glow ? 'glow-enabled' : '';
  const compactClass = user?.compact_mode ? 'compact-mode' : '';
  const animClass = `animations-${user?.animation_level || 'full'}`;

  // Custom accent color injection
  const accentStyle = user?.accent_color ? {
    '--accent': user.accent_color,
    '--accent-bright': `${user.accent_color}ee`, 
    '--accent-dim': `${user.accent_color}cc`,
    '--accent-glow': `${user.accent_color}66`, 
    '--accent-soft': `${user.accent_color}26`, 
    // Legacy support
    '--p-accent': user.accent_color,
    '--p-accent-bright': `${user.accent_color}ee`,
  } as React.CSSProperties : {};

  return (
    <div 
      className={`${themeClass} ${glowClass} ${compactClass} ${animClass}`} 
      style={{ 
        minHeight: '100vh', 
        background: 'var(--bg-base)',
        ...accentStyle 
      }}
    >
      <AppLayout 
        globalProfit={totalOrderProfit}
        onLogout={logout}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
      >
        <div style={{ display: currentTab === 'orders' ? 'block' : 'none', height: '100%' }}>
          <OrdersScreen onProfitChange={setTotalOrderProfit} />
        </div>
        
        {currentTab === 'inventory' && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📦</span>
            <h2>Inventario</h2>
            <p>Próximamente...</p>
          </div>
        )}

        {currentTab === 'profile' && (
          <ProfileScreen />
        )}
      </AppLayout>
    </div>
  )
}

function App() {
  return <AppContent />;
}

export default App
