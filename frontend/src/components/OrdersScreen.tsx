import React, { useState, useEffect } from "react";
import type { Order, Article, OrderItem } from "../types";
import { API, capitalizeFirst, authFetch, formatPrice, triggerRefresh } from "../utils/helpers";
import { useDevice } from "../hooks/useMediaQuery";
import { useAuth, useTranslation } from "../context/AuthContext";

export function OrdersScreen({ onProfitChange }: { onProfitChange: (profit: number) => void }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const { isDesktop } = useDevice()
  
  // Detail view state
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({})

  const toggleItemExpansion = (itemId: number) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  // Modal states
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [newOrderName, setNewOrderName] = useState("")

  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  
  // Form for new item/article
  const [newItemName, setNewItemName] = useState("")
  const [newItemCategory, setNewItemCategory] = useState(user?.product_type || "")
  const [newItemBuyPrice, setNewItemBuyPrice] = useState("")
  const [newItemRecPrice, setNewItemRecPrice] = useState("")
  const [newItemQuantity, setNewItemQuantity] = useState("1")
  const [newItemFile, setNewItemFile] = useState<File | null>(null)
  const [newItemSellPrice, setNewItemSellPrice] = useState("") 
  
  // Article Detail State
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [selectedItemSales, setSelectedItemSales] = useState<number | null>(null)

  const [editBuyPriceModalOpen, setEditBuyPriceModalOpen] = useState(false)
  const [editBuyPrice, setEditBuyPrice] = useState("")
  const [activeItemId, _setActiveItemId] = useState<number | null>(null)
  
  // Delete confirm states
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<number | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<number | null>(null)
  const [animatingDeleteId, setAnimatingDeleteId] = useState<number | null>(null)

  useEffect(() => {
    if (!isDesktop) {
      const isAnySheetOpen = addItemModalOpen || selectedArticle !== null || deleteOrderTarget !== null || deleteItemTarget !== null || orderModalOpen;
      window.dispatchEvent(new CustomEvent('bottomSheetState', { detail: { isOpen: isAnySheetOpen } }));
    }
  }, [addItemModalOpen, selectedArticle, deleteOrderTarget, deleteItemTarget, orderModalOpen, isDesktop]);

  const fetchOrders = async () => {
    try {
      const res = await authFetch(`${API}/api/orders`)
      if (!res.ok) return;
      const data = await res.json()
      if (Array.isArray(data)) setOrders(data)
    } catch (err) {}
  }

  const fetchArticles = async () => {
    try {
      const res = await authFetch(`${API}/api/articles`)
      if (!res.ok) return;
      const data = await res.json()
      if (Array.isArray(data)) setArticles(data)
    } catch (err) {}
  }

  useEffect(() => {
    fetchOrders()
    fetchArticles()
    const handleRefresh = () => { fetchOrders(); fetchArticles(); }
    window.addEventListener('hustle-refresh', handleRefresh)
    return () => window.removeEventListener('hustle-refresh', handleRefresh)
  }, [])

  useEffect(() => {
    const totalProfit = orders.reduce((acc, order) => {
      return acc + order.items.reduce((itemAcc, item) => {
        return itemAcc + item.sales.reduce((saleAcc, sale) => {
          if (sale.sell_price) return saleAcc + (sale.sell_price - item.buy_price)
          return saleAcc
        }, 0)
      }, 0)
    }, 0)
    onProfitChange(totalProfit)
  }, [orders, onProfitChange])

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const formData = new FormData()
      formData.append("name", newOrderName)
      const res = await authFetch(`${API}/api/orders`, { method: "POST", body: formData })
      if (res.ok) {
        const order = await res.json()
        setOrders([order, ...orders])
        setOrderModalOpen(false)
        setNewOrderName("")
        setDetailOrderId(order.id)
      }
    } catch {}
  }

  const handleDeleteOrder = async () => {
    if (!deleteOrderTarget) return
    try {
      await authFetch(`${API}/api/orders/${deleteOrderTarget}`, { method: "DELETE" })
      setOrders(orders.filter(o => o.id !== deleteOrderTarget))
      if (detailOrderId === deleteOrderTarget) setDetailOrderId(null)
      setDeleteOrderTarget(null)
    } catch {}
  }

  const openAddItem = (orderId: number) => {
    setActiveOrderId(orderId)
    setAddItemModalOpen(true)
    setNewItemName("")
    setNewItemBuyPrice("")
    setNewItemRecPrice("")
    setNewItemSellPrice("")
    setNewItemQuantity("1")
    setNewItemFile(null)
  }

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrderId) return
    const buy_price = parseFloat(newItemBuyPrice.replace(',','.'))
    const quantity = parseInt(newItemQuantity) || 1
    if (isNaN(buy_price)) return

    try {
      let article_id: number | null = null
      const existingArt = articles.find(a => a.name.toLowerCase() === newItemName.trim().toLowerCase())
      
      if (!existingArt) {
        const artData = new FormData()
        artData.append("name", capitalizeFirst(newItemName.trim()))
        artData.append("category", newItemCategory)
        artData.append("purchase_price", buy_price.toString())
        if (newItemRecPrice.trim()) artData.append("recommended_price", newItemRecPrice.replace(',','.').trim())
        if (newItemFile) artData.append("image", newItemFile)
        const artRes = await authFetch(`${API}/api/articles`, { method: "POST", body: artData })
        if (artRes.ok) {
          const newArt = await artRes.json()
          article_id = newArt.id
          fetchArticles()
        }
      } else {
        article_id = existingArt.id
      }

      const res = await authFetch(`${API}/api/orders/${activeOrderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: capitalizeFirst(newItemName.trim()), buy_price, article_id, quantity })
      })
      
      if (res.ok && newItemSellPrice.trim() !== "") {
        const item = await res.json()
        const sell_price = parseFloat(newItemSellPrice.replace(',','.'))
        if (!isNaN(sell_price) && item.sales && item.sales.length > 0) {
          await authFetch(`${API}/api/orders/items/sales/${item.sales[item.sales.length - 1].id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sell_price })
          })
        }
      }
      fetchOrders(); triggerRefresh(); setAddItemModalOpen(false);
    } catch {}
  }

  const handleUpdateUnitSalePrice = async (saleId: number, priceStr: string, _orderId: number) => {
    const sell_price = priceStr.trim() === "" ? null : parseFloat(priceStr.replace(',', '.'))
    if (sell_price !== null && isNaN(sell_price)) return

    try {
      await authFetch(`${API}/api/orders/items/sales/${saleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sell_price })
      })
      fetchOrders(); triggerRefresh();
    } catch {}
  }

  const renderPriceBadge = (label: string, price: number | null | undefined, type: 'red' | 'yellow' | 'green') => {
    if (price === null || price === undefined) return null;
    const colors = {
      red: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
      yellow: { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)", text: "#f59e0b" },
      green: { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.3)", text: "#10b981" }
    }
    const style = colors[type];
    return (
      <div className={`price-badge price-badge--${type} tabular-nums`} style={{
        display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "8px",
        fontSize: "0.75rem", fontWeight: 700, gap: "6px", background: style.bg, border: `1px solid ${style.border}`, color: style.text
      }}>
        {isDesktop && <span style={{ fontSize: "0.6rem", opacity: 0.7, textTransform: "uppercase" }}>{label}</span>}
        <span>{formatPrice(price, user?.currency)}</span>
      </div>
    )
  }

  const renderProfitBadge = (profit: number) => {
    const isPositive = profit >= 0;
    return (
      <div className="profit-badge-special tabular-nums" style={{
        marginLeft: "auto", display: "inline-flex", alignItems: "center", padding: "4px 10px",
        borderRadius: "10px", background: isPositive ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
        color: isPositive ? "#10b981" : "#ef4444", fontWeight: 800, fontSize: "0.95rem"
      }}>
        {formatPrice(profit, user?.currency)}
      </div>
    )
  }

  const UnitSaleInput = ({ sale, buyPrice, orderId }: { sale: any, buyPrice: number, orderId: number }) => {
    const [val, setVal] = useState(sale.sell_price != null ? sale.sell_price.toString() : "")
    const currentPrice = val.trim() === "" ? null : parseFloat(val.replace(',', '.'))
    const profit = currentPrice != null ? currentPrice - buyPrice : null
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
        <input 
          type="text" value={val} onChange={(e) => setVal(e.target.value)}
          onBlur={() => handleUpdateUnitSalePrice(sale.id, val, orderId)}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: "10px", border: `1px solid ${currentPrice != null ? "var(--success)" : "rgba(255,255,255,0.08)"}`,
            background: "#1A1A1A", color: currentPrice != null ? "var(--success)" : "var(--text-1)", fontSize: "1rem", outline: "none"
          }}
        />
        {profit !== null && <span style={{ fontSize: "0.8rem", fontWeight: 700, color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>{formatPrice(profit, user?.currency)}</span>}
      </div>
    )
  }

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return
    const idToAnimate = deleteItemTarget
    setDeleteItemTarget(null)
    setAnimatingDeleteId(idToAnimate)
    setTimeout(async () => {
      try {
        await authFetch(`${API}/api/orders/items/${idToAnimate}`, { method: "DELETE" })
        setAnimatingDeleteId(null); fetchOrders(); triggerRefresh();
      } catch { setAnimatingDeleteId(null); }
    }, 400)
  }

  const renderOrderList = () => (
    <div className={`card-list ${isDesktop ? 'desktop' : 'mobile'}`}>
      {orders.map((order) => {
        const cost = order.items.reduce((acc, item) => acc + (item.buy_price * item.quantity), 0)
        const revenue = order.items.reduce((acc, item) => acc + item.sales.reduce((s, sale) => s + (sale.sell_price || 0), 0), 0)
        const profit = revenue - cost
        const isActive = detailOrderId === order.id
        const totalItems = order.items.reduce((acc, item) => acc + item.quantity, 0)
        const soldItems = order.items.reduce((acc, item) => acc + item.sales.filter(s => s.sell_price !== null).length, 0)
        let statusColor = 'rgba(255,255,255,0.1)';
        if (totalItems > 0) statusColor = soldItems === totalItems ? 'var(--success)' : 'var(--warning)';
        
        return (
          <div key={order.id} className={`order-card glow-hover ${isActive && isDesktop ? 'active' : ''}`} onClick={() => setDetailOrderId(order.id)} style={{ borderLeft: `3px solid ${statusColor}` }}>
            <div className="order-card-header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {order.platform && <span className="platform-tag">{order.platform}</span>}
                <h3 className="order-name">{order.name}</h3>
                <span className="order-date">{order.date}</span>
              </div>
              <button className="btn-delete-order" onClick={(e) => { e.stopPropagation(); setDeleteOrderTarget(order.id); }}>×</button>
            </div>
            <div className="order-summary">
              <div style={{ display: "flex", gap: "16px" }}>
                <div className="summary-stat"><span>Artículos</span><strong>{totalItems}</strong></div>
                <div className="summary-stat"><span>Beneficio</span><strong style={{ color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>{formatPrice(profit, user?.currency)}</strong></div>
              </div>
              <div className="arrow-icon">→</div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderUnitSales = (item: OrderItem, _orderId: number) => (
    <div className="unit-sales-expanded">
      {item.sales.map((sale: any) => (
        <div key={sale.id} className="unit-sale-row">
          <div className="status-dot" style={{ background: sale.sell_price !== null ? "var(--success)" : "rgba(255,255,255,0.2)" }} />
          <UnitSaleInput sale={sale} buyPrice={item.buy_price} orderId={_orderId} />
        </div>
      ))}
    </div>
  )

  const renderOrderDetailContent = (order: Order) => {
    const profit = order.items.reduce((acc, item) => acc + item.sales.reduce((sAcc, sale) => sale.sell_price ? sAcc + (sale.sell_price - item.buy_price) : sAcc, 0), 0)
    const soldUnits = order.items.reduce((acc, item) => acc + item.sales.filter(s => s.sell_price !== null).length, 0)
    const totalUnits = order.items.reduce((acc, item) => acc + item.quantity, 0)

    return (
      <div className="order-detail-view">
        <div className="detail-header-container">
          <div className="detail-header">
            <div><h2>{order.name}</h2><p>{order.date}</p></div>
            <div className="header-stats">
              <div className="header-stat"><span>Artículos</span><strong>{soldUnits}/{totalUnits}</strong></div>
              <div className="header-stat"><span>Beneficio</span><strong style={{ color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>{formatPrice(profit, user?.currency)}</strong></div>
            </div>
          </div>
          <div className="detail-actions"><h3>Artículos</h3><button onClick={() => openAddItem(order.id)}>+ Añadir</button></div>
        </div>
        <div className="order-items-list">
          {order.items.map(item => {
            const isExpanded = expandedItems[item.id]
            const soldCount = item.sales.filter(s => s.sell_price !== null).length
            const totalRevenue = item.sales.reduce((acc, s) => acc + (s.sell_price || 0), 0)
            const itemProfit = item.sales.reduce((sAcc, sale) => sale.sell_price ? sAcc + (sale.sell_price - item.buy_price) : sAcc, 0)
            return (
              <div key={item.id} className="order-item-group">
                <div className="order-item-row" style={{ borderLeft: `3px solid ${soldCount > 0 ? '#10b981' : '#f59e0b'}` }}>
                  <div className="item-info" onClick={() => { if(item.article) { setSelectedArticle(item.article); setSelectedItemSales(totalRevenue > 0 ? totalRevenue : null); } }}>
                    <div className="item-image-container">
                      {item.article?.image_url ? <img src={item.article.image_url.startsWith('http') ? item.article.image_url : `${API}${item.article.image_url}`} alt="" /> : <div className="placeholder">📦</div>}
                    </div>
                    <div className="item-text"><span>{item.name}</span>{item.quantity > 1 && <span className="qty-tag">x{item.quantity}</span>}</div>
                    <button className="btn-delete-item" onClick={(e) => { e.stopPropagation(); setDeleteItemTarget(item.id); }}>×</button>
                  </div>
                  <div className="item-badges" onClick={(e) => { if(item.quantity > 1) { e.stopPropagation(); toggleItemExpansion(item.id); } }}>
                    <div className="badges-row">
                      {renderPriceBadge("Compra", item.buy_price * item.quantity, "red")}
                      {renderPriceBadge("Rec.", (item.article?.recommended_price || 0) * item.quantity, "yellow")}
                      {item.quantity === 1 ? <UnitSaleInput sale={item.sales[0]} buyPrice={item.buy_price} orderId={order.id} /> : renderPriceBadge("Venta", totalRevenue, "green")}
                    </div>
                    {item.quantity > 1 && renderProfitBadge(itemProfit)}
                    {item.quantity > 1 && <div className={`expand-icon ${isExpanded ? 'up' : ''}`}>↓</div>}
                  </div>
                </div>
                {isExpanded && item.quantity > 1 && renderUnitSales(item, order.id)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const selectedOrder = orders.find(o => o.id === detailOrderId)

  return (
    <div className="orders-container">
      {isDesktop ? (
        <div className="orders-desktop-layout">
          <div className="orders-sidebar">
            <div className="sidebar-header"><h1>Pedidos</h1><button onClick={() => setOrderModalOpen(true)}>+</button></div>
            {renderOrderList()}
          </div>
          <div className="orders-content">{selectedOrder ? renderOrderDetailContent(selectedOrder) : <div className="empty-selection">Selecciona un pedido</div>}</div>
        </div>
      ) : (
        <div className="orders-mobile-layout">
          <h1>Pedidos</h1>
          <button className="fab" onClick={() => setOrderModalOpen(true)}>+</button>
          {renderOrderList()}
          {selectedOrder && <div className="mobile-detail-overlay">{renderOrderDetailContent(selectedOrder)}<button className="btn-close" onClick={() => setDetailOrderId(null)}>Volver</button></div>}
        </div>
      )}

      {/* Modales simplificados por espacio */}
      {orderModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Nuevo Pedido</h2>
            <form onSubmit={handleCreateOrder}>
              <input value={newOrderName} onChange={e => setNewOrderName(e.target.value)} placeholder="Nombre del pedido" />
              <div className="modal-actions"><button type="button" onClick={() => setOrderModalOpen(false)}>Cancelar</button><button type="submit">Crear</button></div>
            </form>
          </div>
        </div>
      )}

      {addItemModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Añadir Producto</h2>
            <form onSubmit={handleAddItemSubmit}>
              <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nombre" />
              <input value={newItemBuyPrice} onChange={e => setNewItemBuyPrice(e.target.value)} placeholder="Precio Compra" />
              <input value={newItemRecPrice} onChange={e => setNewItemRecPrice(e.target.value)} placeholder="Precio Rec." />
              <input type="file" onChange={e => setNewItemFile(e.target.files?.[0] || null)} />
              <div className="modal-actions"><button type="button" onClick={() => setAddItemModalOpen(false)}>Cancelar</button><button type="submit">Añadir</button></div>
            </form>
          </div>
        </div>
      )}

      {selectedArticle && (
        <div className="modal-overlay" onClick={() => setSelectedArticle(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Detalle Artículo</h2>
            <p>{selectedArticle.name}</p>
            {selectedItemSales && <p>Venta Total: {formatPrice(selectedItemSales, user?.currency)}</p>}
            <button onClick={() => setSelectedArticle(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {deleteOrderTarget && <div className="modal-overlay">Confirmar eliminar pedido... <button onClick={handleDeleteOrder}>Sí</button><button onClick={() => setDeleteOrderTarget(null)}>No</button></div>}
      {deleteItemTarget && <div className="modal-overlay">Confirmar eliminar artículo... <button onClick={handleDeleteItem}>Sí</button><button onClick={() => setDeleteItemTarget(null)}>No</button></div>}
    </div>
  );
}
