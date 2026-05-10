import React, { useState, useEffect } from "react";
import type { Order, Article } from "../types";
import { API, capitalizeFirst, authFetch, formatPrice, triggerRefresh } from "../utils/helpers";
import { useDevice } from "../hooks/useMediaQuery";
import { useAuth } from "../context/AuthContext";

type View = 'list' | 'detail';

export function OrdersScreen({ onProfitChange }: { onProfitChange: (profit: number) => void }) {
  const { user } = useAuth();
  const { isDesktop } = useDevice();
  const [view, setView] = useState<View>('list');
  const [orders, setOrders] = useState<Order[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [animatingDeleteId, setAnimatingDeleteId] = useState<number | null>(null);

  // Modals
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderName, setNewOrderName] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);

  // Add item form
  const [itemName, setItemName] = useState('');
  const [itemBuyPrice, setItemBuyPrice] = useState('');
  const [itemRecPrice, setItemRecPrice] = useState('');
  const [itemSellPrice, setItemSellPrice] = useState('');
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [itemCategory] = useState(user?.product_type || '');

  const fetchOrders = async () => {
    try {
      const res = await authFetch(`${API}/api/orders`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOrders(data);
          if (selectedOrder) {
            const updated = data.find((o: Order) => o.id === selectedOrder.id);
            if (updated) setSelectedOrder(updated);
          }
        }
      }
    } catch {}
  };

  const fetchArticles = async () => {
    try {
      const res = await authFetch(`${API}/api/articles`);
      if (res.ok) { const d = await res.json(); if (Array.isArray(d)) setArticles(d); }
    } catch {}
  };

  useEffect(() => {
    fetchOrders(); fetchArticles();
    const h = () => { fetchOrders(); fetchArticles(); };
    window.addEventListener('hustle-refresh', h);
    return () => window.removeEventListener('hustle-refresh', h);
  }, []);

  useEffect(() => {
    const total = orders.reduce((a, o) =>
      a + o.items.reduce((b, i) =>
        b + i.sales.reduce((c, s) => s.sell_price ? c + (s.sell_price - i.buy_price) : c, 0), 0), 0);
    onProfitChange(total);
  }, [orders, onProfitChange]);

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
    setExpandedItems({});
    if (!isDesktop) setView('detail');
  };

  const goBack = () => { setView('list'); setSelectedOrder(null); };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderName.trim()) return;
    try {
      const fd = new FormData(); fd.append('name', newOrderName);
      const res = await authFetch(`${API}/api/orders`, { method: 'POST', body: fd });
      if (res.ok) {
        const order = await res.json();
        setOrders([order, ...orders]);
        setShowNewOrder(false); setNewOrderName('');
        openOrder(order);
      }
    } catch {}
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrderId) return;
    await authFetch(`${API}/api/orders/${deleteOrderId}`, { method: 'DELETE' });
    setOrders(orders.filter(o => o.id !== deleteOrderId));
    setDeleteOrderId(null);
    if (selectedOrder?.id === deleteOrderId) goBack();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const buy_price = parseFloat(itemBuyPrice.replace(',', '.'));
    if (isNaN(buy_price)) return;
    try {
      let article_id: number | null = null;
      const existing = articles.find(a => a.name.toLowerCase() === itemName.trim().toLowerCase());
      if (!existing) {
        const fd = new FormData();
        fd.append('name', capitalizeFirst(itemName.trim()));
        fd.append('category', itemCategory);
        fd.append('purchase_price', buy_price.toString());
        if (itemRecPrice.trim()) fd.append('recommended_price', itemRecPrice.replace(',', '.').trim());
        if (itemFile) fd.append('image', itemFile);
        const ar = await authFetch(`${API}/api/articles`, { method: 'POST', body: fd });
        if (ar.ok) { const a = await ar.json(); article_id = a.id; fetchArticles(); }
      } else { article_id = existing.id; }

      const res = await authFetch(`${API}/api/orders/${selectedOrder.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: capitalizeFirst(itemName.trim()), buy_price, article_id, quantity: 1 })
      });
      if (res.ok && itemSellPrice.trim()) {
        const item = await res.json();
        const sp = parseFloat(itemSellPrice.replace(',', '.'));
        if (!isNaN(sp) && item.sales?.length > 0) {
          await authFetch(`${API}/api/orders/items/sales/${item.sales[item.sales.length - 1].id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sell_price: sp })
          });
        }
      }
      setShowAddItem(false); setItemName(''); setItemBuyPrice(''); setItemRecPrice(''); setItemSellPrice(''); setItemFile(null);
      fetchOrders(); triggerRefresh();
    } catch {}
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    setAnimatingDeleteId(deleteItemId);
    setDeleteItemId(null);
    setTimeout(async () => {
      await authFetch(`${API}/api/orders/items/${deleteItemId}`, { method: 'DELETE' });
      setAnimatingDeleteId(null); fetchOrders(); triggerRefresh();
    }, 350);
  };

  const updateSalePrice = async (saleId: number, val: string) => {
    const sell_price = val.trim() === '' ? null : parseFloat(val.replace(',', '.'));
    if (sell_price !== null && isNaN(sell_price)) return;
    await authFetch(`${API}/api/orders/items/sales/${saleId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sell_price })
    });
    fetchOrders(); triggerRefresh();
  };

  // ─── SUB-COMPONENTS ───

  const SaleInput = ({ sale, buyPrice }: { sale: any; buyPrice: number }) => {
    const [val, setVal] = useState(sale.sell_price != null ? String(sale.sell_price) : '');
    const cur = val.trim() === '' ? null : parseFloat(val.replace(',', '.'));
    const profit = cur != null ? cur - buyPrice : null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <input
          value={val} onChange={e => setVal(e.target.value)}
          onBlur={() => updateSalePrice(sale.id, val)}
          placeholder="Precio venta"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10, outline: 'none', fontSize: '0.95rem',
            background: cur != null ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${cur != null ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: cur != null ? '#10b981' : 'var(--text-1)'
          }}
        />
        {profit != null && (
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: profit >= 0 ? '#10b981' : '#ef4444', whiteSpace: 'nowrap' }}>
            {profit >= 0 ? '+' : ''}{formatPrice(profit, user?.currency)}
          </span>
        )}
      </div>
    );
  };

  // ─── ORDER LIST VIEW ───

  const renderList = () => (
    <div className="os-list-view">
      <div className="os-list-header">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-1)', margin: 0 }}>Pedidos</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', margin: '4px 0 0' }}>{orders.length} pedido{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="os-btn-new" onClick={() => setShowNewOrder(true)}>
          <span>+</span> Nuevo
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="os-empty">
          <div className="os-empty-icon">📦</div>
          <h3>Sin pedidos aún</h3>
          <p>Crea tu primer pedido para empezar a registrar tus compras y ventas</p>
          <button className="os-btn-new" onClick={() => setShowNewOrder(true)}>+ Crear pedido</button>
        </div>
      ) : (
        <div className="os-cards">
          {orders.map(order => {
            const cost = order.items.reduce((a, i) => a + i.buy_price * i.quantity, 0);
            const rev = order.items.reduce((a, i) => a + i.sales.reduce((b, s) => b + (s.sell_price || 0), 0), 0);
            const profit = rev - cost;
            const total = order.items.reduce((a, i) => a + i.quantity, 0);
            const sold = order.items.reduce((a, i) => a + i.sales.filter(s => s.sell_price != null).length, 0);
            const pct = total > 0 ? (sold / total) * 100 : 0;
            const statusColor = total === 0 ? 'rgba(255,255,255,0.1)' : sold === total ? '#10b981' : sold > 0 ? '#f59e0b' : '#ef4444';

            return (
              <div key={order.id} className={`os-card ${isDesktop && selectedOrder?.id === order.id ? 'os-card--active' : ''}`} onClick={() => openOrder(order)}>
                <div className="os-card-accent" style={{ background: statusColor }} />
                <div className="os-card-body">
                  <div className="os-card-top">
                    <div>
                      {order.platform && <span className="os-platform-tag">{order.platform}</span>}
                      <h3 className="os-card-title">{order.name}</h3>
                      <span className="os-card-date">{order.date}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div className={`os-profit ${profit >= 0 ? 'pos' : 'neg'}`}>{formatPrice(profit, user?.currency)}</div>
                      <button className="os-btn-icon os-btn-del" onClick={e => { e.stopPropagation(); setDeleteOrderId(order.id); }}>×</button>
                    </div>
                  </div>

                  <div className="os-card-stats">
                    <div className="os-stat"><span>Artículos</span><strong>{total}</strong></div>
                    <div className="os-stat"><span>Vendidos</span><strong style={{ color: statusColor }}>{sold}/{total}</strong></div>
                    <div className="os-stat"><span>Inversión</span><strong style={{ color: '#ef4444' }}>{formatPrice(cost, user?.currency)}</strong></div>
                  </div>

                  <div className="os-progress-bar">
                    <div className="os-progress-fill" style={{ width: `${pct}%`, background: statusColor }} />
                  </div>
                </div>
                <div className="os-card-arrow">→</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─── ORDER DETAIL VIEW ───

  const renderDetail = (order: Order) => {
    const cost = order.items.reduce((a, i) => a + i.buy_price * i.quantity, 0);
    const rev = order.items.reduce((a, i) => a + i.sales.reduce((b, s) => b + (s.sell_price || 0), 0), 0);
    const profit = rev - cost;
    const total = order.items.reduce((a, i) => a + i.quantity, 0);
    const sold = order.items.reduce((a, i) => a + i.sales.filter(s => s.sell_price != null).length, 0);

    return (
      <div className="os-detail-view">
        {/* Header */}
        <div className="os-detail-header">
          {!isDesktop && (
            <button className="os-btn-back" onClick={goBack}>
              ← Volver
            </button>
          )}
          <div className="os-detail-title-row">
            <div>
              {order.platform && <span className="os-platform-tag">{order.platform}</span>}
              <h2 className="os-detail-title">{order.name}</h2>
              <span className="os-card-date">{order.date}</span>
            </div>
            <button className="os-btn-new" onClick={() => setShowAddItem(true)}>+ Añadir</button>
          </div>

          {/* Stats strip */}
          <div className="os-detail-stats">
            <div className="os-detail-stat">
              <span>Inversión</span>
              <strong style={{ color: '#ef4444' }}>{formatPrice(cost, user?.currency)}</strong>
            </div>
            <div className="os-detail-stat os-detail-stat--main">
              <span>Beneficio</span>
              <strong style={{ color: profit >= 0 ? '#10b981' : '#ef4444', fontSize: '1.3rem' }}>
                {formatPrice(profit, user?.currency)}
              </strong>
            </div>
            <div className="os-detail-stat">
              <span>Vendidos</span>
              <strong>{sold}/{total}</strong>
            </div>
          </div>
        </div>

        {/* Items list */}
        <div className="os-items-list">
          {order.items.length === 0 ? (
            <div className="os-empty" style={{ padding: '60px 20px' }}>
              <div className="os-empty-icon">🛍️</div>
              <h3>Sin productos</h3>
              <p>Añade productos a este pedido</p>
              <button className="os-btn-new" onClick={() => setShowAddItem(true)}>+ Añadir producto</button>
            </div>
          ) : (
            order.items.map(item => {
              const isExpanded = expandedItems[item.id];
              const isDeleting = animatingDeleteId === item.id;
              const itemSold = item.sales.filter(s => s.sell_price != null).length;
              const itemRev = item.sales.reduce((a, s) => a + (s.sell_price || 0), 0);
              const itemProfit = item.sales.reduce((a, s) => s.sell_price ? a + (s.sell_price - item.buy_price) : a, 0);
              const statusColor = itemSold === item.quantity ? '#10b981' : itemSold > 0 ? '#f59e0b' : 'rgba(255,255,255,0.15)';

              return (
                <div key={item.id} className={`os-item ${isDeleting ? 'os-item--deleting' : ''}`} style={{ borderLeft: `3px solid ${statusColor}` }}>
                  {/* Item header row */}
                  <div className="os-item-header">
                    {/* Thumbnail */}
                    <div className="os-item-thumb">
                      {item.article?.image_url
                        ? <img src={item.article.image_url.startsWith('http') ? item.article.image_url : `${API}${item.article.image_url}`} alt="" />
                        : <span>📦</span>
                      }
                    </div>

                    {/* Name & qty */}
                    <div className="os-item-info">
                      <span className="os-item-name">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="os-item-qty">x{item.quantity} · {itemSold}/{item.quantity} vendidos</span>
                      )}
                    </div>

                    {/* Delete */}
                    <button className="os-btn-icon os-btn-del" onClick={() => setDeleteItemId(item.id)}>×</button>
                  </div>

                  {/* Prices row */}
                  <div className="os-item-prices">
                    <div className="os-price-badge os-price-badge--red">
                      <span>Compra</span>
                      <strong>{formatPrice(item.buy_price, user?.currency)}</strong>
                    </div>
                    {item.article?.recommended_price != null && item.article.recommended_price > 0 && (
                      <div className="os-price-badge os-price-badge--yellow">
                        <span>Rec.</span>
                        <strong>{formatPrice(item.article.recommended_price, user?.currency)}</strong>
                      </div>
                    )}
                    {item.quantity === 1 ? (
                      <SaleInput sale={item.sales[0]} buyPrice={item.buy_price} />
                    ) : (
                      <div className="os-price-badge os-price-badge--green" onClick={() => setExpandedItems(p => ({ ...p, [item.id]: !p[item.id] }))} style={{ cursor: 'pointer' }}>
                        <span>Venta total</span>
                        <strong>{formatPrice(itemRev, user?.currency)}</strong>
                        <span className="os-expand-arrow">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    )}
                  </div>

                  {/* Profit for multi-qty */}
                  {item.quantity > 1 && (
                    <div className="os-item-profit" style={{ color: itemProfit >= 0 ? '#10b981' : '#ef4444' }}>
                      {itemProfit >= 0 ? '+' : ''}{formatPrice(itemProfit, user?.currency)} beneficio
                    </div>
                  )}

                  {/* Expanded unit sales */}
                  {isExpanded && item.quantity > 1 && (
                    <div className="os-unit-sales">
                      {item.sales.map((sale, idx) => (
                        <div key={sale.id} className="os-unit-row">
                          <div className="os-unit-dot" style={{ background: sale.sell_price != null ? '#10b981' : 'rgba(255,255,255,0.2)' }} />
                          <span className="os-unit-label">Unidad {idx + 1}</span>
                          <SaleInput sale={sale} buyPrice={item.buy_price} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ─── LAYOUT ───

  return (
    <div className="os-root">
      {isDesktop ? (
        <div className="os-desktop">
          <div className="os-desktop-sidebar">{renderList()}</div>
          <div className="os-desktop-main">
            {selectedOrder ? renderDetail(selectedOrder) : (
              <div className="os-empty os-empty--center">
                <div className="os-empty-icon">←</div>
                <h3>Selecciona un pedido</h3>
                <p>Haz clic en un pedido para ver sus productos</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="os-mobile">
          {view === 'list' ? renderList() : selectedOrder ? renderDetail(selectedOrder) : null}
        </div>
      )}

      {/* ── MODALS ── */}

      {showNewOrder && (
        <div className="modal-overlay" onClick={() => setShowNewOrder(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nuevo Pedido</h2>
              <button className="modal-close" onClick={() => setShowNewOrder(false)}>×</button>
            </div>
            <form onSubmit={handleCreateOrder}>
              <div className="form-group">
                <label>Nombre del pedido *</label>
                <input className="form-input" value={newOrderName} onChange={e => setNewOrderName(e.target.value)} placeholder="Ej: Lote Sneakers Mayo" autoFocus required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowNewOrder(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Crear pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddItem && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Añadir Producto</h2>
              <button className="modal-close" onClick={() => setShowAddItem(false)}>×</button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="form-group">
                <label>Nombre *</label>
                <input className="form-input" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Ej: Air Jordan 1" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Precio compra *</label>
                  <input className="form-input" value={itemBuyPrice} onChange={e => setItemBuyPrice(e.target.value)} placeholder="0.00" required />
                </div>
                <div className="form-group">
                  <label>Precio rec.</label>
                  <input className="form-input" value={itemRecPrice} onChange={e => setItemRecPrice(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="form-group">
                <label>Precio venta (opcional)</label>
                <input className="form-input" value={itemSellPrice} onChange={e => setItemSellPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Imagen</label>
                <input className="form-input" type="file" accept="image/*" onChange={e => setItemFile(e.target.files?.[0] || null)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddItem(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Añadir</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOrderId && (
        <div className="modal-overlay" onClick={() => setDeleteOrderId(null)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🗑️</div>
              <h2 style={{ marginBottom: 8 }}>Eliminar pedido</h2>
              <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Esta acción no se puede deshacer</p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteOrderId(null)}>Cancelar</button>
              <button className="btn-danger" onClick={handleDeleteOrder}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {deleteItemId && (
        <div className="modal-overlay" onClick={() => setDeleteItemId(null)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🗑️</div>
              <h2 style={{ marginBottom: 8 }}>Eliminar artículo</h2>
              <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Esta acción no se puede deshacer</p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteItemId(null)}>Cancelar</button>
              <button className="btn-danger" onClick={handleDeleteItem}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
