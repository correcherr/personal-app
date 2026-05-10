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
  const [newItemSellPrice, setNewItemSellPrice] = useState("") // Immediate sale price for the unit
  
  // Article Detail State
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [selectedItemSales, setSelectedItemSales] = useState<number | null>(null)

  const [editBuyPriceModalOpen, setEditBuyPriceModalOpen] = useState(false)
  const [editBuyPrice, setEditBuyPrice] = useState("")
  const [activeItemId, setActiveItemId] = useState<number | null>(null)
  
  // Delete confirm states
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<number | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<number | null>(null)
  const [animatingDeleteId, setAnimatingDeleteId] = useState<number | null>(null)

  // Dispatch event to hide Bottom Tab Bar in AppLayout when a REAL modal is open
  useEffect(() => {
    if (!isDesktop) {
      // Only hide for actual modals (add item, delete, article detail), not for order detail
      const isAnySheetOpen = addItemModalOpen || selectedArticle !== null || deleteOrderTarget !== null || deleteItemTarget !== null || orderModalOpen;
      window.dispatchEvent(new CustomEvent('bottomSheetState', { detail: { isOpen: isAnySheetOpen } }));
    }
  }, [addItemModalOpen, selectedArticle, deleteOrderTarget, deleteItemTarget, orderModalOpen, isDesktop]);

  const fetchOrders = async () => {
    try {
      const res = await authFetch(`${API}/api/orders`)
      if (!res.ok) return;
      const data = await res.json()
      if (Array.isArray(data)) {
        setOrders(data)
      } else {
        console.error("Orders data is not an array:", data)
        setOrders([])
      }
    } catch (err) {
      console.error("Error fetching orders:", err)
      setOrders([])
    }
  }

  const fetchArticles = async () => {
    try {
      const res = await authFetch(`${API}/api/articles`)
      if (!res.ok) return;
      const data = await res.json()
      if (Array.isArray(data)) {
        setArticles(data)
      } else {
        console.error("Articles data is not an array:", data)
        setArticles([])
      }
    } catch (err) {
      console.error("Error fetching articles:", err)
      setArticles([])
    }
  }

  useEffect(() => {
    fetchOrders()
    fetchArticles()

    const handleRefresh = () => {
      fetchOrders()
      fetchArticles()
    }
    window.addEventListener('hustle-refresh', handleRefresh)
    return () => window.removeEventListener('hustle-refresh', handleRefresh)
  }, [])

  useEffect(() => {
    const totalProfit = orders.reduce((acc, order) => {
      const orderProfit = order.items.reduce((itemAcc, item) => {
        // Realized Profit: Sum of (Sell Price - Buy Price) for EACH unit sold
        const itemProfit = item.sales.reduce((sAcc, sale) => {
          if (sale.sell_price) {
            return sAcc + (sale.sell_price - item.buy_price)
          }
          return sAcc
        }, 0)
        return itemAcc + itemProfit
      }, 0)
      return acc + orderProfit
    }, 0)
    onProfitChange(totalProfit)
  }, [orders])

  const handleCreateOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      const formData = new FormData()
      formData.append("name", newOrderName.trim() ? capitalizeFirst(newOrderName.trim()) : "Nuevo Pedido")
      formData.append("platform", user?.platform || "")
      await authFetch(`${API}/api/orders`, { 
        method: "POST",
        body: formData
      })
      fetchOrders()
      triggerRefresh()
      setOrderModalOpen(false)
      setNewOrderName("")
    } catch {}
  }

  const handleDeleteOrder = async () => {
    if (!deleteOrderTarget) return
    try {
      await authFetch(`${API}/api/orders/${deleteOrderTarget}`, { method: "DELETE" })
      if (detailOrderId === deleteOrderTarget) setDetailOrderId(null)
      setDeleteOrderTarget(null)
      fetchOrders()
      triggerRefresh()
    } catch {}
  }

  const openAddItem = (orderId: number) => {
    setActiveOrderId(orderId)
    setNewItemName("")
    setNewItemCategory(user?.product_type || "")
    setNewItemBuyPrice("")
    setNewItemRecPrice("")
    setNewItemQuantity("1")
    setNewItemFile(null)
    setNewItemSellPrice("")
    setAddItemModalOpen(true)
  }

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrderId) return
    
    const buy_price = parseFloat(newItemBuyPrice.replace(',','.'))
    const quantity = parseInt(newItemQuantity) || 1
    if (isNaN(buy_price)) return

    try {
      // 1. First, check if we should create a new article or link to an existing one
      let article_id: number | null = null
      const existingArt = articles.find(a => a.name.toLowerCase() === newItemName.trim().toLowerCase())
      
      if (!existingArt) {
        // Create new article
        const artData = new FormData()
        artData.append("name", capitalizeFirst(newItemName.trim()))
        artData.append("category", newItemCategory)
        artData.append("purchase_price", buy_price.toString())
        if (newItemRecPrice.trim()) artData.append("recommended_price", newItemRecPrice.replace(',','.').trim())
        if (newItemFile) artData.append("image", newItemFile)
        
        const artRes = await authFetch(`${API}/api/articles`, {
          method: "POST",
          body: artData
        })
        if (artRes.ok) {
          const newArt = await artRes.json()
          article_id = newArt.id
          fetchArticles()
          triggerRefresh()
        }
      } else {
        article_id = existingArt.id
      }

      // 2. Add item to order
      const res = await authFetch(`${API}/api/orders/${activeOrderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: capitalizeFirst(newItemName.trim()), 
          buy_price,
          article_id,
          quantity
        })
      })
      
      if (res.ok) {
        triggerRefresh()
      }
      
      if (res.ok && newItemSellPrice.trim() !== "") {
        const item = await res.json()
        const sell_price = parseFloat(newItemSellPrice.replace(',','.'))
        if (!isNaN(sell_price) && item.sales && item.sales.length > 0) {
          const lastSale = item.sales[item.sales.length - 1]
          await authFetch(`${API}/api/orders/items/sales/${lastSale.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sell_price })
          })
          triggerRefresh()
        }
      }
      
      fetchOrders()
      triggerRefresh()
      setDetailOrderId(activeOrderId)
      setAddItemModalOpen(false)
    } catch {}
  }

  const handleUpdateUnitSalePrice = async (saleId: number, price: string, orderId: number) => {
    const sell_price = price.trim() === "" ? null : parseFloat(price.replace(',','.'))
    if (price.trim() !== "" && isNaN(sell_price as number)) return

    try {
      await authFetch(`${API}/api/orders/items/sales/${saleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sell_price })
      })
      fetchOrders()
      triggerRefresh()
    } catch {}
  }

  const handleUpdateBuyPriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeItemId) return
    const buy_price = parseFloat(editBuyPrice.replace(',','.'))
    if (isNaN(buy_price) || buy_price <= 0) return
    try {
      await authFetch(`${API}/api/orders/items/${activeItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buy_price })
      })
      fetchOrders()
      triggerRefresh()
      setEditBuyPriceModalOpen(false)
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
        display: "inline-flex",
        alignItems: "center",
        padding: isDesktop ? "4px 10px" : "4px 8px",
        borderRadius: "8px",
        fontSize: isDesktop ? "0.75rem" : "0.7rem",
        fontWeight: 700,
        gap: "6px",
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text
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
        marginLeft: "auto",
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "10px",
        background: isPositive ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
        color: isPositive ? "#10b981" : "#ef4444",
        fontWeight: 800,
        fontSize: "0.95rem",
        letterSpacing: "-0.3px"
      }}>
        {formatPrice(profit, user?.currency)}
      </div>
    )
  }

  const UnitSaleInput = ({ sale, buyPrice, orderId, isInline = false }: { sale: any, buyPrice: number, orderId: number, isInline?: boolean }) => {
    const [val, setVal] = useState(sale.sell_price != null ? sale.sell_price.toString() : "")
    const currentPrice = val.trim() === "" ? null : parseFloat(val.replace(',', '.'))
    const profit = currentPrice != null ? currentPrice - buyPrice : null

    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: isInline ? "none" : 1 }}>
        <input 
          key={`sale-input-${sale.id}`}
          type="text"
          inputMode="decimal"
          placeholder={isInline ? "Venta" : "Precio venta"}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => handleUpdateUnitSalePrice(sale.id, val, orderId)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: isInline ? "none" : 1,
            width: isInline ? "80px" : "100%",
            padding: "10px 14px",
            borderRadius: "10px",
            border: `1px solid ${currentPrice != null ? "var(--success)" : "rgba(255,255,255,0.08)"}`,
            background: "#1A1A1A",
            color: currentPrice != null ? "var(--success)" : "var(--text-1)",
            fontSize: "1rem",
            fontWeight: 600,
            outline: "none",
            transition: "all 0.2s ease"
          }}
        />
        {profit !== null && (
          <span style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: profit >= 0 ? "var(--success)" : "var(--danger)",
            minWidth: isInline ? "auto" : "50px",
            textAlign: "right"
          }}>
            {formatPrice(profit, user?.currency)}
          </span>
        )}
      </div>
    )
  }

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return
    const idToAnimate = deleteItemTarget
    setDeleteItemTarget(null) // Close modal first
    setAnimatingDeleteId(idToAnimate)

    // Wait for animation
    setTimeout(async () => {
      try {
        await authFetch(`${API}/api/orders/items/${idToAnimate}`, { method: "DELETE" })
        setAnimatingDeleteId(null)
        fetchOrders()
        triggerRefresh()
      } catch {
        setAnimatingDeleteId(null)
      }
    }, 400)
  }

  const renderOrderList = () => (
    <div className={`card-list ${isDesktop ? 'desktop' : 'mobile'}`}>
      {orders.map((order) => {
        const cost = order.items.reduce((acc, item) => acc + (item.buy_price * item.quantity), 0)
        const revenue = order.items.reduce((acc, item) => acc + item.sales.reduce((s, sale) => s + (sale.sell_price || 0), 0), 0)
        const profit = revenue - cost
        const isActive = detailOrderId === order.id
        
        // Status logic
        const totalItems = order.items.reduce((acc, item) => acc + item.quantity, 0)
        const soldItems = order.items.reduce((acc, item) => acc + item.sales.filter(s => s.sell_price !== null).length, 0)
        let statusColor = 'rgba(255,255,255,0.1)'; // Empty / Neutral
        if (totalItems > 0) {
          statusColor = soldItems === totalItems ? 'var(--success)' : 'var(--warning)';
        }
        
        return (
          <div 
            key={order.id} 
            className={`order-card glow-hover ${isActive && isDesktop ? 'active' : ''}`} 
            onClick={() => setDetailOrderId(order.id)} 
            style={{ 
              cursor: "pointer", 
              userSelect: "none",
              background: "#0D0D0D",
              borderRadius: "16px",
              padding: "18px",
              marginBottom: "12px",
              border: isActive && isDesktop ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.02)",
              borderLeft: `3px solid ${statusColor}`,
              position: "relative",
              overflow: "hidden"
            }}
          >
            {isActive && isDesktop && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(90deg, var(--accent-soft) 0%, transparent 100%)', pointerEvents: 'none', opacity: 0.5 }}></div>
            )}
            <div className="order-card-header" style={{ position: 'relative', zIndex: 1, marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {order.platform && (
                  <span style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: 800, 
                    color: 'var(--accent)', 
                    background: 'var(--accent-soft)', 
                    padding: '2px 8px', 
                    borderRadius: '6px', 
                    width: 'fit-content',
                    textTransform: 'uppercase'
                  }}>
                    {order.platform}
                  </span>
                )}
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-1)' }}>
                  {order.name}
                </h3>
                <span className="order-date" style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500 }}>{order.date}</span>
              </div>
              <button className="btn-delete-order" onClick={(e) => {
                e.stopPropagation()
                setDeleteOrderTarget(order.id)
              }} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            
            <div className="order-summary" style={{ position: 'relative', zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "16px" }}>
                <div className="summary-stat" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>Artículos</span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-1)' }}>{totalItems}</strong>
                </div>
                <div className="summary-stat" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>Beneficio</span>
                  <strong style={{ fontSize: '0.9rem', color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {formatPrice(profit, user?.currency)}
                  </strong>
                </div>
              </div>
              <div style={{ 
                width: "28px", 
                height: "28px", 
                borderRadius: "50%", 
                background: isActive && isDesktop ? "var(--accent)" : "var(--accent-soft)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: isActive && isDesktop ? "#fff" : "var(--accent)",
                fontSize: "1rem",
                transition: "all 0.2s"
              }}>
                →
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderUnitSales = (item: OrderItem, _orderId: number) => {
    return (
      <div className="unit-sales-expanded" style={{
        marginTop: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        {item.sales.map((sale: any) => {
          const isSold = sale.sell_price !== null;
          return (
            <div key={sale.id} style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "#141414",
              padding: "12px",
              borderRadius: "12px",
              transition: "all 0.2s ease"
            }}>
              <div style={{ 
                width: "8px", 
                height: "8px", 
                borderRadius: "50%", 
                background: isSold ? "var(--success)" : "rgba(255,255,255,0.2)",
                boxShadow: isSold ? "0 0 8px var(--success-soft)" : "none",
                flexShrink: 0
              }} />
              <div style={{ flex: 1 }}>
                <UnitSaleInput sale={sale} buyPrice={item.buy_price} orderId={_orderId} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderOrderDetailContent = (order: Order) => {
    const profit = order.items.reduce((acc, item) => {
      const itemRealizedProfit = item.sales.reduce((sAcc, sale) => {
        if (sale.sell_price) return sAcc + (sale.sell_price - item.buy_price)
        return sAcc
      }, 0)
      return acc + itemRealizedProfit
    }, 0)
    const soldUnits = order.items.reduce((acc, item) => acc + item.sales.filter(s => s.sell_price !== null).length, 0)
    const totalUnits = order.items.reduce((acc, item) => acc + item.quantity, 0)

    return (
      <div className="order-detail-view" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Sticky Header Section */}
        <div style={{ flexShrink: 0, zIndex: 10, background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="detail-header" style={{
            padding: "24px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", marginBottom: "4px" }}>{order.name}</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-3)" }}>{order.date}</p>
            </div>
            <div style={{ display: "flex", gap: "24px", textAlign: "right" }}>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-3)", textTransform: "uppercase", marginBottom: "4px" }}>Artículos</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{soldUnits}/{totalUnits}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-3)", textTransform: "uppercase", marginBottom: "4px" }}>Beneficio</div>
                <div style={{ 
                  fontSize: "1.1rem", 
                  fontWeight: 700, 
                  color: profit >= 0 ? "var(--success)" : "var(--danger)" 
                }}>
                  {formatPrice(profit, user?.currency)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ 
            padding: "0 20px 16px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center" 
          }}>
            <h3 style={{ fontSize: "0.9rem", color: "var(--text-2)", textTransform: "uppercase" }}>Artículos</h3>
            <button className="btn-add-item-small" onClick={() => openAddItem(order.id)}>+ Añadir</button>
          </div>
        </div>

        {/* Scrollable List Section */}
        <div className="order-items-list" style={{ flex: 1, overflowY: "auto", padding: "16px 20px 100px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {order.items.length === 0 && <p className="empty-state" style={{padding: "40px", fontSize: "0.95rem", textAlign: "center"}}>No hay artículos todavía.</p>}
            {[...order.items].sort((a, b) => a.id - b.id).map(item => {
              const isExpanded = expandedItems[item.id]
              const soldCount = item.sales.filter(s => s.sell_price !== null).length
              const totalRevenue = item.sales.reduce((acc, s) => acc + (s.sell_price || 0), 0)
              const itemProfit = item.sales.reduce((sAcc, sale) => sale.sell_price ? sAcc + (sale.sell_price - item.buy_price) : sAcc, 0)
              
              return (
                <div key={item.id} className="order-item-group" style={{ marginBottom: "16px" }}>
                  <div className="order-item-row" style={{
                    background: "#0D0D0D", 
                    border: "1px solid rgba(255,255,255,0.03)", 
                    borderLeft: `3px solid ${soldCount > 0 ? '#10b981' : '#f59e0b'}`,
                    padding: "16px", 
                    borderRadius: "16px", 
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    transition: "transform 0.1s ease"
                    }} 
                    onPointerDown={(e) => { if (!isDesktop) e.currentTarget.style.transform = "scale(0.98)"; }}
                    onPointerUp={(e) => { if (!isDesktop) e.currentTarget.style.transform = "scale(1)"; }}
                    >
                    
                    <div 
                      onClick={() => {
                        if (item.article) {
                          setSelectedArticle(item.article)
                          setSelectedItemSales(totalRevenue > 0 ? totalRevenue : null)
                        }
                      }}
                      style={{ display: "flex", width: "100%", gap: "12px", alignItems: "center" }}
                    >
                      <div style={{ flexShrink: 0 }}>
                        {item.article?.image_url ? (
                          <img 
                            src={item.article.image_url.startsWith('http') ? item.article.image_url : `${API}${item.article.image_url}`} 
                            alt={item.name} 
                            style={{ width: "56px", height: "56px", borderRadius: "12px", objectFit: "cover", border: "1px solid var(--border-strong)" }} 
                          />
                        ) : (
                          <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", border: "1px solid var(--border)" }}>
                            📦
                          </div>
                        )}
                      </div>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-1)", lineHeight: 1.2, wordBreak: "break-word" }}>{item.name}</span>
                          {item.quantity > 1 && (
                            <span style={{ marginLeft: "8px", padding: "2px 8px", background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 800 }}>x{item.quantity}</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button 
                          className="btn-delete-item" 
                          onClick={(e) => { e.stopPropagation(); setDeleteItemTarget(item.id); }}
                          style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--danger-soft)", border: "1px solid var(--danger-soft)", borderRadius: "10px", color: "var(--danger)", fontSize: "1.2rem", cursor: "pointer" }}
                        >×</button>
                      </div>
                    </div>

                    <div 
                      onClick={(e) => {
                        if (item.quantity > 1) {
                          e.stopPropagation();
                          toggleItemExpansion(item.id);
                        }
                      }}
                      style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px", alignItems: "center" }}
                    >
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 1, alignItems: "center" }}>
                        {renderPriceBadge("Compra", item.buy_price * item.quantity, "red")}
                        {renderPriceBadge("Rec.", (item.article?.recommended_price || 0) * item.quantity, "yellow")}
                        {item.quantity === 1 ? (
                          <div style={{ marginLeft: "8px", flex: 1, maxWidth: "150px" }}>
                            <UnitSaleInput sale={item.sales[0]} buyPrice={item.buy_price} orderId={order.id} isInline />
                          </div>
                        ) : (
                          renderPriceBadge("Venta", totalRevenue, "green")
                        )}
                      </div>
                      
                      {item.quantity > 1 && renderProfitBadge(itemProfit)}
                      
                      {item.quantity > 1 && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItemExpansion(item.id);
                          }}
                          style={{ 
                            marginLeft: "auto", 
                            color: "var(--accent)", 
                            background: "var(--accent-soft)",
                            width: "32px",
                            height: "32px",
                            borderRadius: "10px",
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            fontSize: "1.1rem",
                            transition: "transform 0.3s ease",
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)"
                          }}
                        >
                          ↓
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded && item.quantity > 1 && renderUnitSales(item, order.id)}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderModals = () => (
    <>
      {/* Create Order Modal */}
      {orderModalOpen && (
        <div className="modal-overlay" onClick={() => setOrderModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Nuevo Pedido</h3>
            <form onSubmit={handleCreateOrder}>
              <div className="form-group">
                <input 
                  autoFocus
                  placeholder="Nombre del pedido (ej. Pedido Mayo)"
                  value={newOrderName}
                  onChange={e => setNewOrderName(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setOrderModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-submit">Crear Pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {addItemModalOpen && (
        <div className="modal-overlay" onClick={() => setAddItemModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "1.4rem", marginBottom: "8px" }}>📦 Añadir Artículo</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-3)" }}>Introduce los detalles del nuevo producto para este pedido.</p>
            </div>
            
            <form onSubmit={handleAddItemSubmit}>
              <div className="form-group">
                <label>Nombre del Artículo</label>
                <input 
                  autoFocus
                  placeholder="Ej. Sudadera Nike"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "8px" }}>
                <div className="form-group">
                  <label style={{ color: "var(--danger)" }}>💰 Compra</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={newItemBuyPrice}
                    onChange={e => setNewItemBuyPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: "var(--warning)" }}>🏷️ Rec.</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    placeholder="Opt."
                    value={newItemRecPrice}
                    onChange={e => setNewItemRecPrice(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>🔢 Cantidad</label>
                  <input 
                    type="number"
                    min="1"
                    value={newItemQuantity}
                    onChange={e => setNewItemQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ padding: "16px", background: "var(--success-soft)", borderRadius: "12px", border: "1px dashed var(--success)", marginBottom: "16px" }}>
                <label style={{ color: "var(--success)" }}>🤝 Venta Inmediata (Opcional)</label>
                <input 
                  type="text"
                  inputMode="decimal"
                  placeholder="¿Ya se ha vendido?"
                  value={newItemSellPrice}
                  onChange={e => setNewItemSellPrice(e.target.value)}
                  style={{ border: "1px solid var(--success-soft)" }}
                />
              </div>

              <div className="form-group">
                <label>🖼️ Foto del Producto (Opcional)</label>
                <div 
                  onClick={() => document.getElementById('fileInput')?.click()}
                  style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    padding: "32px 20px",
                    background: newItemFile ? "var(--accent-soft)" : "var(--bg-elevated)",
                    borderRadius: "16px",
                    border: newItemFile ? "2px solid var(--accent)" : "2px dashed var(--border)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    position: "relative",
                    overflow: "hidden"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = newItemFile ? "var(--accent)" : "var(--border)"}
                >
                  <input 
                    id="fileInput"
                    type="file" 
                    accept="image/*"
                    onChange={e => setNewItemFile(e.target.files?.[0] || null)}
                    style={{ display: "none" }}
                  />
                  
                  {newItemFile ? (
                    <div style={{ textAlign: "center", width: "100%" }}>
                      <img 
                        src={URL.createObjectURL(newItemFile)} 
                        style={{ width: "80px", height: "80px", borderRadius: "12px", objectFit: "cover", marginBottom: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }} 
                        alt="Preview"
                      />
                      <p style={{ fontSize: "0.85rem", color: "var(--text-1)", fontWeight: 600, margin: 0 }}>
                        {newItemFile.name}
                      </p>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewItemFile(null);
                        }}
                        style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: "8px", fontWeight: 700, textDecoration: "underline" }}
                      >
                        Quitar imagen
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: "2.5rem" }}>📷</span>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ fontSize: "0.9rem", color: "var(--text-2)", fontWeight: 700, margin: "0 0 4px 0" }}>Haz clic para subir foto</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-3)", margin: 0 }}>Compatible con iPhone (HEIC)</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" style={{ padding: "12px 24px", borderRadius: "12px" }} onClick={() => setAddItemModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-submit">Añadir al pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Buy Price Modal */}
      {editBuyPriceModalOpen && (
        <div className="modal-overlay" onClick={() => setEditBuyPriceModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "1.4rem", marginBottom: "8px" }}>✏️ Editar Precio Compra</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-3)" }}>Actualiza el coste de adquisición para este artículo.</p>
            </div>
            <form onSubmit={handleUpdateBuyPriceSubmit}>
              <div className="form-group">
                <label>{t('buy_price')} ({user?.currency === 'EUR' ? '€' : '$'})</label>
                <input 
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editBuyPrice}
                  onChange={e => setEditBuyPrice(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditBuyPriceModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-submit">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation */}
      {deleteOrderTarget && (
        <div className="modal-overlay" onClick={() => setDeleteOrderTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <span style={{ fontSize: "3rem" }}>⚠️</span>
              <h3 style={{ fontSize: "1.4rem", color: "var(--danger)", marginTop: "16px" }}>¿Borrar pedido completo?</h3>
              <p style={{ color: "var(--text-3)", marginTop: "8px" }}>Se eliminarán todos los artículos asociados permanentemente. Esta acción no se puede deshacer.</p>
            </div>
            <div className="modal-actions" style={{ justifyContent: "center", gap: "16px" }}>
              <button className="btn-cancel" style={{ padding: "12px 32px", borderRadius: "12px" }} onClick={() => setDeleteOrderTarget(null)}>Cancelar</button>
              <button className="btn-submit btn-danger-action" style={{ padding: "12px 32px" }} onClick={handleDeleteOrder}>Confirmar Borrado</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation */}
      {deleteItemTarget && (
        <div className="modal-overlay" onClick={() => setDeleteItemTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <span style={{ fontSize: "3rem" }}>🗑️</span>
              <h3 style={{ fontSize: "1.4rem", color: "var(--danger)", marginTop: "16px" }}>¿Borrar artículo?</h3>
              <p style={{ color: "var(--text-3)", marginTop: "8px" }}>Se eliminará este artículo del pedido permanentemente.</p>
            </div>
            <div className="modal-actions" style={{ justifyContent: "center", gap: "16px" }}>
              <button className="btn-cancel" style={{ padding: "12px 32px", borderRadius: "12px" }} onClick={() => setDeleteItemTarget(null)}>Cancelar</button>
              <button className="btn-submit btn-danger-action" style={{ padding: "12px 32px" }} onClick={handleDeleteItem}>Borrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div className="modal-overlay" onClick={() => setSelectedArticle(null)}>
          <div className="modal-content" style={{ maxWidth: "550px" }} onClick={e => e.stopPropagation()}>
            {!isDesktop && <div className="detail-handle" onClick={() => setSelectedArticle(null)} style={{ cursor: "pointer" }} />}
            <div style={{ position: "relative", marginBottom: "24px" }}>
              {selectedArticle.image_url ? (
                <div style={{ 
                  width: "100%", 
                  aspectRatio: "4 / 3", 
                  borderRadius: "16px", 
                  overflow: "hidden", 
                  marginBottom: "20px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                  border: "1px solid var(--border)"
                }}>
                  <img 
                    src={selectedArticle.image_url.startsWith('http') ? selectedArticle.image_url : `${API}${selectedArticle.image_url}`} 
                    alt={selectedArticle.name} 
                    style={{ 
                      width: "100%", 
                      height: "100%", 
                      objectFit: "cover"
                    }} 
                  />
                </div>
              ) : (
                <div style={{ width: "100%", height: "150px", background: "var(--bg-elevated)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem", marginBottom: "20px" }}>
                  📦
                </div>
              )}
              <h3 style={{ fontSize: "1.8rem", fontWeight: 800 }}>{selectedArticle.name}</h3>
              <p style={{ color: "var(--text-3)" }}>Añadido el {selectedArticle.date}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: selectedItemSales ? "1fr 1fr 1fr" : "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
              <div style={{ padding: "12px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "16px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                <div style={{ fontSize: "0.6rem", color: "#ef4444", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Compra</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ef4444" }}>{formatPrice(selectedArticle.purchase_price, user?.currency)}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(245, 158, 11, 0.15)", borderRadius: "16px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                <div style={{ fontSize: "0.6rem", color: "#f59e0b", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Recomendado</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f59e0b" }}>{formatPrice(selectedArticle.recommended_price, user?.currency)}</div>
              </div>
              {selectedItemSales && (
                <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.15)", borderRadius: "16px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                  <div style={{ fontSize: "0.6rem", color: "#10b981", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Venta Total</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10b981" }}>{formatPrice(selectedItemSales, user?.currency)}</div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-submit" onClick={() => setSelectedArticle(null)}>Cerrar Detalle</button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  const selectedOrder = orders.find(o => o.id === detailOrderId)

  if (!isDesktop && selectedOrder) {
    return (
      <div className="orders-screen mobile-nav-active animate-slide-in-right" style={{ 
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: "var(--bg-base)",
        display: "flex", 
        flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* Fixed Top Section (Volver + Detail Header) */}
        <div style={{ flexShrink: 0, background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", zIndex: 10 }}>
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center",
              padding: "20px 20px 10px",
              gap: "8px",
              cursor: "pointer"
            }}
            onClick={() => setDetailOrderId(null)}
          >
            <span style={{ color: "var(--accent)", fontWeight: 900, fontSize: "1.2rem" }}>←</span>
            <span style={{ color: "var(--text-2)", fontWeight: 700, fontSize: "0.9rem" }}>Pedidos</span>
          </div>
          
          {/* Header Sticky con Blur */}
          <div style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            padding: "24px 32px",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            marginBottom: "24px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "1.8rem", fontWeight: 800, margin: 0, color: "var(--text-1)", letterSpacing: "-0.02em" }}>{selectedOrder.name}</h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-3)", margin: "4px 0 0", fontWeight: 500 }}>{selectedOrder.date}</p>
              </div>
              <div style={{ textAlign: "right", background: "#111", padding: "12px 16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.03)" }}>
                <div style={{ fontSize: "0.65rem", color: "var(--text-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Beneficio Neto</div>
                <div style={{ 
                  fontSize: "1.4rem", 
                  fontWeight: 900, 
                  color: selectedOrder.items.reduce((acc, item) => {
                    return acc + item.sales.reduce((sAcc, sale) => sale.sell_price ? sAcc + (sale.sell_price - item.buy_price) : sAcc, 0)
                  }, 0) >= 0 ? "var(--success)" : "var(--danger)" 
                }}>
                  {formatPrice(
                    selectedOrder.items.reduce((acc, item) => {
                      return acc + item.sales.reduce((sAcc, sale) => sale.sell_price ? sAcc + (sale.sell_price - item.buy_price) : sAcc, 0)
                    }, 0),
                    user?.currency
                  )}
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-2)", fontWeight: 600 }}>
                <span style={{ color: "var(--text-1)" }}>{selectedOrder.items.reduce((acc, item) => acc + item.sales.filter(s => s.sell_price !== null).length, 0)}</span> / {selectedOrder.items.reduce((acc, item) => acc + item.quantity, 0)} Artículos vendidos
              </div>
              <button 
                className="btn-add-item-small glow-hover" 
                onClick={() => openAddItem(selectedOrder.id)}
                style={{ 
                  padding: "10px 20px", 
                  borderRadius: "12px", 
                  fontSize: "0.85rem", 
                  fontWeight: 700,
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                + Añadir Producto
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Section */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 32px 120px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {selectedOrder.items.length === 0 && <p style={{padding: "60px 20px", color: "var(--text-3)", textAlign: "center"}}>No hay artículos todavía.</p>}
            {[...selectedOrder.items].sort((a, b) => a.id - b.id).map(item => {
              const isExpanded = expandedItems[item.id]
              const soldCount = item.sales.filter(s => s.sell_price !== null).length
              const totalRevenue = item.sales.reduce((acc, s) => acc + (s.sell_price || 0), 0)
              const itemProfit = item.sales.reduce((sAcc, sale) => sale.sell_price ? sAcc + (sale.sell_price - item.buy_price) : sAcc, 0)
              const isAnimatingExit = animatingDeleteId === item.id
              
              return (
                <div key={item.id} className={`order-item-group ${isAnimatingExit ? 'animate-exit-left' : 'animate-item'}`} style={{ marginBottom: "16px" }}>
                  <div className="order-item-row" style={{
                    background: "#0D0D0D", 
                    border: "1px solid rgba(255,255,255,0.03)", 
                    borderLeft: `3px solid ${soldCount > 0 ? '#10b981' : '#f59e0b'}`,
                    padding: "20px", 
                    borderRadius: "16px", 
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                    }} 
                  >
                    {/* Item Top: Info/Detail trigger */}
                    <div 
                      onClick={() => {
                        if (item.article) {
                          setSelectedArticle(item.article)
                          setSelectedItemSales(totalRevenue > 0 ? totalRevenue : null)
                        }
                      }}
                      style={{ display: "flex", width: "100%", gap: "12px", alignItems: "center" }}
                    >
                      <div style={{ flexShrink: 0 }}>
                        {item.article?.image_url ? (
                          <img 
                            src={item.article.image_url.startsWith('http') ? item.article.image_url : `${API}${item.article.image_url}`} 
                            alt={item.name} 
                            style={{ width: "56px", height: "56px", borderRadius: "12px", objectFit: "cover", border: "1px solid var(--border-strong)" }} 
                          />
                        ) : (
                          <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", border: "1px solid var(--border)" }}>
                            📦
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-1)", lineHeight: 1.2, wordBreak: "break-word" }}>{item.name}</span>
                          {item.quantity > 1 && (
                            <span style={{ marginLeft: "8px", padding: "2px 8px", background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 800 }}>x{item.quantity}</span>
                          )}
                        </div>
                      </div>
                      <button 
                        className="btn-delete-item" 
                        onClick={(e) => { e.stopPropagation(); setDeleteItemTarget(item.id); }}
                        style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--danger-soft)", border: "1px solid var(--danger-soft)", borderRadius: "10px", color: "var(--danger)", fontSize: "1.2rem" }}
                      >×</button>
                    </div>

                    {/* Item Bottom: Prices/Expansion trigger */}
                    <div 
                      onClick={(e) => {
                        if (item.quantity > 1) {
                          e.stopPropagation();
                          toggleItemExpansion(item.id);
                        }
                      }}
                      style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px", alignItems: "center" }}
                    >
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 1, alignItems: "center" }}>
                        {renderPriceBadge("Compra", item.buy_price * item.quantity, "red")}
                        {renderPriceBadge("Rec.", (item.article?.recommended_price || 0) * item.quantity, "yellow")}
                        
                        {item.quantity === 1 ? (
                          <div style={{ marginLeft: "4px", flex: 1, maxWidth: "130px" }}>
                            <UnitSaleInput sale={item.sales[0]} buyPrice={item.buy_price} orderId={selectedOrder.id} isInline />
                          </div>
                        ) : (
                          renderPriceBadge("Venta", item.sales.reduce((acc, s) => acc + (s.sell_price || 0), 0), "green")
                        )}
                      </div>
                      
                      {item.quantity > 1 && renderProfitBadge(itemProfit)}
                      {item.quantity > 1 && (
                        <div 
                          style={{ 
                            marginLeft: "4px", 
                            color: "var(--accent)", 
                            background: "var(--accent-soft)",
                            width: "28px",
                            height: "28px",
                            borderRadius: "8px",
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            fontSize: "1rem",
                            transition: "transform 0.3s ease",
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)"
                          }}
                        >
                          ↓
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded && item.quantity > 1 && renderUnitSales(item, selectedOrder.id)}
                </div>
              )
            })}
          </div>
        </div>
        {renderModals()}
      </div>
    )
  }

  return (
    <div className="orders-screen" style={{ height: "100%", display: "flex", flexDirection: isDesktop ? "row" : "column", overflow: "hidden" }}>
      {/* Left Panel: List */}
      <div className="orders-sidebar" style={{ 
        width: isDesktop ? "400px" : "100%", 
        borderRight: isDesktop ? "1px solid var(--border)" : "none",
        background: "var(--bg-surface)",
        display: "flex",
        flexDirection: "column",
        height: "100%"
      }}>
        <div style={{ 
          padding: isDesktop ? "24px 20px" : "32px 20px 16px", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center" 
        }}>
          <h2 style={{ 
            fontSize: isDesktop ? "1.2rem" : "22px", 
            fontWeight: 800,
            letterSpacing: isDesktop ? "normal" : "-0.3px"
          }}>Mis Pedidos</h2>
          <button className="btn-new-order" onClick={() => setOrderModalOpen(true)}>+ Nuevo</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 24px" }}>
          {renderOrderList()}
        </div>
      </div>

      {/* Right Panel: Detail (Desktop only now) */}
      {isDesktop && (
        <div className="order-detail-panel" style={{ 
          flex: 1, 
          background: "var(--bg-base)",
          height: "100%",
          position: "relative",
          zIndex: 5,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}>
          {selectedOrder ? (
            renderOrderDetailContent(selectedOrder)
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>
              <span style={{ fontSize: "3rem", marginBottom: "16px" }}>🛒</span>
              <p>Selecciona un pedido para ver los detalles</p>
            </div>
          )}
        </div>
      )}
      {renderModals()}
    </div>
  )
}
