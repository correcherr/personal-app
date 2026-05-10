import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API, authFetch, formatPrice } from '../utils/helpers';

type Period = '7d' | '30d' | '3m' | '1y' | 'all';

export function StatsScreen({ onBack, hideBackButton }: { onBack: () => void, hideBackButton?: boolean }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [ovRes, chRes, topRes, acRes] = await Promise.all([
          authFetch(`${API}/api/stats/overview?period=${period}`),
          authFetch(`${API}/api/stats/profit-chart?period=${period}`),
          authFetch(`${API}/api/stats/top-products`),
          authFetch(`${API}/api/stats/recent-activity`)
        ]);
        if (ovRes.ok) setData(await ovRes.json());
        if (chRes.ok) setChartData(await chRes.json());
        if (topRes.ok) setTopProducts(await topRes.json());
        if (acRes.ok) setActivity(await acRes.json());
      } catch (err) {}
      setLoading(false);
    };
    fetchStats();

    const handleRefresh = () => fetchStats();
    window.addEventListener('hustle-refresh', handleRefresh);
    return () => window.removeEventListener('hustle-refresh', handleRefresh);
  }, [period]);

  if (loading && !data) {
    return (
      <div className="stats-screen animate-fade-in" style={{ padding: '20px' }}>
        <div className="skeleton" style={{ height: '40px', width: '150px', marginBottom: '24px' }} />
        <div className="skeleton" style={{ height: '180px', borderRadius: '24px', marginBottom: '20px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div className="skeleton" style={{ height: '100px', borderRadius: '20px' }} />
          <div className="skeleton" style={{ height: '100px', borderRadius: '20px' }} />
          <div className="skeleton" style={{ height: '100px', borderRadius: '20px' }} />
          <div className="skeleton" style={{ height: '100px', borderRadius: '20px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="stats-screen" style={{ paddingBottom: '100px' }}>
      {!hideBackButton && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button 
            onClick={onBack}
            style={{ 
              width: '40px', height: '40px', borderRadius: '12px', background: 'var(--bg-elevated)', 
              border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-1)', fontSize: '1.2rem', cursor: 'pointer'
            }}
          >
            ←
          </button>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Estadísticas</h2>
        </div>
      )}

      {/* PERIOD SELECTOR */}
      <div style={{ 
        display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px',
        position: 'sticky', top: '0', zIndex: 10, background: 'var(--bg-base)'
      }}>
        <PeriodBtn label="7d" active={period === '7d'} onClick={() => setPeriod('7d')} />
        <PeriodBtn label="30d" active={period === '30d'} onClick={() => setPeriod('30d')} />
        <PeriodBtn label="3m" active={period === '3m'} onClick={() => setPeriod('3m')} />
        <PeriodBtn label="1y" active={period === '1y'} onClick={() => setPeriod('1y')} />
        <PeriodBtn label="Todo" active={period === 'all'} onClick={() => setPeriod('all')} />
      </div>

      {/* MAIN PROFIT CARD */}
      <div className="profile-card" style={{ 
        padding: '32px 24px', background: '#000', border: 'none', 
        boxShadow: '0 0 30px rgba(123, 44, 191, 0.08)', marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '8px' }}>
          Profit {period === 'all' ? 'Total' : 'del periodo'}
        </div>
        <div style={{ fontSize: '3.2rem', fontWeight: 900, color: (data?.period_profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.04em', lineHeight: 1 }}>
          <CountUp value={data?.period_profit || 0} currency={user?.currency} />
        </div>
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--success)', padding: '4px 10px', borderRadius: '20px', background: 'rgba(105, 240, 174, 0.1)' }}>
            +{data?.period_percentage}%
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 600 }}>este mes</span>
        </div>
      </div>

      {/* QUICK STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <QuickStat icon="🟢" label="Profit total" value={data?.total_profit} isPrice currency={user?.currency} />
        <QuickStat icon="📦" label="Vendidos" value={data?.items_sold} />
        <QuickStat icon="📈" label="ROI medio" value={data?.average_roi} suffix="%" color="var(--warning)" />
        <QuickStat icon="🛒" label="Activos" value={data?.active_items} />
      </div>

      {/* PROFIT CHART */}
      <div className="profile-card" style={{ marginBottom: '24px', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '20px' }}>Crecimiento</h3>
        <div style={{ height: '180px', width: '100%', position: 'relative' }}>
          <SimpleLineChart data={chartData} />
        </div>
      </div>

      {/* TOP PRODUCTS */}
      <div className="profile-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', padding: '20px 20px 10px' }}>Top Productos</h3>
        {topProducts.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
              {p.image ? <img src={`${API}${p.image}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>}
            </div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: '14px' }}>{p.name}</div>
            <div style={{ fontWeight: 800, color: 'var(--success)' }}>+{formatPrice(p.profit, user?.currency)}</div>
          </div>
        ))}
      </div>

      {/* RECENT ACTIVITY */}
      <div className="profile-card">
        <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', padding: '20px 20px 10px' }}>Actividad Reciente</h3>
        {activity.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px', borderBottom: i < activity.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{a.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Hoy, {a.date}</div>
            </div>
            <div style={{ fontWeight: 800, color: 'var(--success)' }}>+{formatPrice(a.amount, user?.currency)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeriodBtn({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      style={{ 
        padding: '8px 16px', borderRadius: '12px', background: active ? 'var(--p-accent-soft)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--p-accent)' : 'transparent'}`,
        color: active ? 'var(--p-accent)' : 'var(--text-3)', fontWeight: 700, fontSize: '13px',
        transition: 'all 0.2s', whiteSpace: 'nowrap'
      }}
    >
      {label}
    </button>
  );
}

function QuickStat({ icon, label, value, isPrice, currency, suffix, color }: any) {
  return (
    <div className="profile-card" style={{ padding: '16px', transition: 'transform 0.2s' }} onPointerDown={(e) => e.currentTarget.style.transform='scale(0.96)'} onPointerUp={(e) => e.currentTarget.style.transform='scale(1)'}>
      <div style={{ fontSize: '18px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: color || 'var(--text-1)' }}>
        {isPrice ? formatPrice(value || 0, currency) : `${(value || 0).toFixed(value % 1 === 0 ? 0 : 1)}${suffix || ''}`}
      </div>
    </div>
  );
}

function CountUp({ value, currency }: { value: number, currency?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1000;
    let startTime: number | null = null;
    
    const animate = (now: number) => {
      if (!startTime) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      setDisplayValue(start + progress * (end - start));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <>{formatPrice(displayValue, currency)}</>;
}

function SimpleLineChart({ data }: { data: any[] }) {
  if (!data || data.length < 2) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
      No hay datos suficientes para mostrar la gráfica
    </div>
  );

  const profits = data.map(d => d.profit);
  const max = Math.max(...profits, 10);
  const min = Math.min(...profits, 0);
  const range = max - min || 10;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.profit - min) / range) * 80 - 10;
    return { x, y, profit: d.profit, date: d.date };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Sample labels for X axis (max 5)
  const labelIndices = [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor(data.length * 3 / 4), data.length - 1];
  const uniqueIndices = [...new Set(labelIndices)];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--p-accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--p-accent)" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal Grid Lines */}
        {[0, 25, 50, 75].map(tick => (
          <line key={tick} x1="0" y1={tick + 10} x2="100" y2={tick + 10} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        ))}

        {/* Area Fill */}
        <path 
          d={`M 0,100 L ${polylinePoints} L 100,100 Z`} 
          fill="url(#chartGradient)" 
          style={{ animation: 'chart-fade 2s ease-out' }}
        />

        {/* Main Line */}
        <polyline
          fill="none"
          stroke="var(--p-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
          filter="url(#glow)"
          style={{ strokeDasharray: '500', strokeDashoffset: '500', animation: 'chart-draw 2s forwards ease-out' }}
        />

        {/* Data Points (Dots) */}
        {points.map((p, i) => (
          <circle 
            key={i} 
            cx={p.x} cy={p.y} r="0.8" 
            fill="var(--p-accent)" 
            style={{ animation: `fade-in 0.5s ease forwards ${1 + (i / points.length)}s`, opacity: 0 }}
          />
        ))}

        {/* Axis Bottom */}
        <line x1="0" y1="95" x2="100" y2="95" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      </svg>

      {/* X Axis Labels */}
      <div style={{ 
        position: 'absolute', bottom: '-25px', left: 0, right: 0, 
        display: 'flex', justifyContent: 'space-between', padding: '0 2px' 
      }}>
        {uniqueIndices.map(idx => (
          <span key={idx} style={{ fontSize: '9px', color: 'var(--text-3)', fontWeight: 600 }}>
            {data[idx]?.date}
          </span>
        ))}
      </div>
    </div>
  );
}
