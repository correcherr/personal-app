import { useEffect, useState } from "react"
import './index.css'

const API = "http://127.0.0.1:8000"

interface ArticleImage {
  id: number
  image_url: string
}

interface Article {
  id: number
  name: string
  price: number
  date: string
  link: string | null
  image_url: string
  description: string | null
  images: ArticleImage[]
}

interface OrderItem {
  id: number
  order_id: number
  name: string
  buy_price: number
  sell_price: number | null
}

interface Order {
  id: number
  name: string
  date: string
  items: OrderItem[]
}

type Toast = {
  message: string
  type: "success" | "error"
}

const today = () => new Date().toISOString().split("T")[0]

const capitalizeFirst = (str: string) => {
  if (!str) return ""
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [loading, setLoading] = useState(false)

  // Lockout state
  const [attempts, setAttempts] = useState(() => parseInt(localStorage.getItem("loginAttempts") || "0"))
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => {
    const lock = localStorage.getItem("loginLockUntil")
    return lock ? parseInt(lock) : null
  })
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!lockedUntil) return
    const checkLock = () => {
      const now = Date.now()
      if (now >= lockedUntil) {
        setLockedUntil(null)
        setAttempts(0)
        localStorage.removeItem("loginLockUntil")
        localStorage.setItem("loginAttempts", "0")
      } else {
        setTimeLeft(Math.ceil((lockedUntil - now) / 1000))
      }
    }
    checkLock()
    const interval = setInterval(checkLock, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lockedUntil) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      })
      if (res.ok) {
        setAttempts(0)
        localStorage.removeItem("loginAttempts")
        onLoginSuccess()
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        localStorage.setItem("loginAttempts", newAttempts.toString())
        
        if (newAttempts >= 3) {
          const unlockTime = Date.now() + 30000
          setLockedUntil(unlockTime)
          localStorage.setItem("loginLockUntil", unlockTime.toString())
        } else {
          setError(true)
          setIsShaking(true)
          setTimeout(() => setIsShaking(false), 500)
          setTimeout(() => setError(false), 3000)
        }
      }
    } catch {
      setError(true)
      setIsShaking(true)
      setTimeout(() => setIsShaking(false), 500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-overlay">
      <div className="login-background"></div>
      <form className={`login-box ${isShaking ? "shake" : ""}`} onSubmit={handleSubmit}>
        <h1 className="login-title">ACCESS</h1>
        <p className="login-subtitle">SYSTEM RESTRICTED</p>
        
        {lockedUntil ? (
          <div className="login-lockout" style={{textAlign: "center", animation: "fadeIn 0.3s"}}>
            <h2 style={{color: "var(--danger)", fontSize: "2rem", marginBottom: "8px", letterSpacing: "0.1em"}}>LOCKED</h2>
            <p style={{color: "var(--text-3)", fontSize: "0.85rem"}}>TOO MANY FAILED ATTEMPTS</p>
            <p style={{color: "var(--danger)", fontSize: "1.8rem", marginTop: "24px", fontFamily: "monospace"}}>{timeLeft}s</p>
          </div>
        ) : (
          <>
            <div className="login-input-wrap">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter passcode..."
                autoFocus
                className={`login-input ${error ? "error" : ""}`}
                disabled={loading}
              />
            </div>
            {error && <p className="login-error-text">Access Denied ({3 - attempts} attempts left)</p>}
            <button type="submit" className="login-btn" disabled={loading || password.length === 0}>
              {loading ? "VERIFYING..." : "ENTER"}
            </button>
          </>
        )}
      </form>
    </div>
  )
}

function OrdersScreen({ onProfitChange }: { onProfitChange: (profit: number) => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  
  // Detail view state
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null)

  // Modal states
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [newOrderName, setNewOrderName] = useState("")

  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [newItemName, setNewItemName] = useState("")
  const [newItemBuyPrice, setNewItemBuyPrice] = useState("")
  const [newItemSellPrice, setNewItemSellPrice] = useState("")

  const [editItemModalOpen, setEditItemModalOpen] = useState(false)
  const [activeItemId, setActiveItemId] = useState<number | null>(null)
  const [editSellPrice, setEditSellPrice] = useState("")

  const [editBuyPriceModalOpen, setEditBuyPriceModalOpen] = useState(false)
  const [editBuyPrice, setEditBuyPrice] = useState("")
  
  // Delete confirm states
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<number | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<number | null>(null)

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API}/api/orders`)
      const data = await res.json()
      setOrders(data)
    } catch {}
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  useEffect(() => {
    const totalProfit = orders.reduce((acc, order) => {
      const cost = order.items.reduce((s, i) => s + i.buy_price, 0)
      const revenue = order.items.reduce((s, i) => s + (i.sell_price || 0), 0)
      return acc + (revenue - cost)
    }, 0)
    onProfitChange(totalProfit)
  }, [orders])

  const handleCreateOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      await fetch(`${API}/api/orders`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrderName.trim() ? capitalizeFirst(newOrderName.trim()) : undefined }) 
      })
      fetchOrders()
      setOrderModalOpen(false)
      setNewOrderName("")
    } catch {}
  }

  const handleDeleteOrder = async () => {
    if (!deleteOrderTarget) return
    try {
      await fetch(`${API}/api/orders/${deleteOrderTarget}`, { method: "DELETE" })
      if (detailOrderId === deleteOrderTarget) setDetailOrderId(null)
      setDeleteOrderTarget(null)
      fetchOrders()
    } catch {}
  }

  const openAddItem = (orderId: number) => {
    setActiveOrderId(orderId)
    setNewItemName("")
    setNewItemBuyPrice("")
    setNewItemSellPrice("")
    setAddItemModalOpen(true)
  }

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrderId) return
    const buy_price = parseFloat(newItemBuyPrice.replace(',','.'))
    if (isNaN(buy_price)) return

    try {
      const res = await fetch(`${API}/api/orders/${activeOrderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: capitalizeFirst(newItemName.trim()), buy_price })
      })
      if (res.ok && newItemSellPrice.trim() !== "") {
        const item = await res.json()
        const sell_price = parseFloat(newItemSellPrice.replace(',','.'))
        if (!isNaN(sell_price)) {
          await fetch(`${API}/api/orders/items/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sell_price })
          })
        }
      }
      fetchOrders()
      setDetailOrderId(activeOrderId) // Auto-open detail view if closed (though it should already be open)
      setAddItemModalOpen(false)
    } catch {}
  }

  const openEditSellPrice = (itemId: number, currentPrice: number | null) => {
    setActiveItemId(itemId)
    setEditSellPrice(currentPrice ? currentPrice.toString() : "")
    setEditItemModalOpen(true)
  }

  const openEditBuyPrice = (itemId: number, currentPrice: number) => {
    setActiveItemId(itemId)
    setEditBuyPrice(currentPrice.toString())
    setEditBuyPriceModalOpen(true)
  }

  const handleUpdateSellPriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeItemId) return
    
    const sell_price = editSellPrice.trim() === "" ? null : parseFloat(editSellPrice.replace(',','.'))
    if (editSellPrice.trim() !== "" && isNaN(sell_price as number)) return

    try {
      await fetch(`${API}/api/orders/items/${activeItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sell_price })
      })
      fetchOrders()
      setEditItemModalOpen(false)
    } catch {}
  }

  const handleUpdateBuyPriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeItemId) return
    const buy_price = parseFloat(editBuyPrice.replace(',','.'))
    if (isNaN(buy_price) || buy_price <= 0) return
    try {
      await fetch(`${API}/api/orders/items/${activeItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buy_price })
      })
      fetchOrders()
      setEditBuyPriceModalOpen(false)
    } catch {}
  }

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return
    try {
      await fetch(`${API}/api/orders/items/${deleteItemTarget}`, { method: "DELETE" })
      setDeleteItemTarget(null)
      fetchOrders()
    } catch {}
  }

  return (
    <div className="orders-screen">
      {/* Toggle button matching the Wishlist's btn-toggle-form style */}
      <div className="form-section">
        <button
          className={`btn-toggle-form${orderModalOpen ? " is-open" : ""}`}
          onClick={() => {
            setNewOrderName("")
            setOrderModalOpen(o => !o)
          }}
          aria-expanded={orderModalOpen}
        >
          <span className={`toggle-icon ${orderModalOpen ? "open" : ""}`}>＋</span>
          {orderModalOpen ? "Cancelar" : "Nuevo Pedido"}
        </button>
      </div>

      {orders.length === 0 && !orderModalOpen && (
        <div className="empty-state">
          <span className="empty-state-icon">📦</span>
          No hay pedidos todavía.<br />¡Pulsa "Nuevo Pedido" para empezar!
        </div>
      )}

      <div className="card-list">
        {orders.map(order => {
          const cost = order.items.reduce((acc, item) => acc + item.buy_price, 0)
          const revenue = order.items.reduce((acc, item) => acc + (item.sell_price || 0), 0)
          const profit = revenue - cost
          
          return (
            <div key={order.id} className="order-card" onClick={() => setDetailOrderId(order.id)} style={{ cursor: "pointer", userSelect: "none" }}>
              <div className="order-card-header">
                <h3>
                  {order.name} <span className="order-date">{order.date}</span>
                </h3>
                <button className="btn-delete-order" onClick={(e) => {
                  e.stopPropagation()
                  setDeleteOrderTarget(order.id)
                }}>×</button>
              </div>
              
              <div className="order-summary">
                <div className="summary-stat">
                  <span>Artículos</span>
                  <strong>{order.items.length}</strong>
                </div>
                <div className="summary-stat">
                  <span>Coste</span>
                  <strong>{cost.toFixed(2)}€</strong>
                </div>
                <div className="summary-stat">
                  <span>Beneficio</span>
                  <strong className={profit >= 0 ? "profit-positive" : "profit-negative"}>
                    {profit > 0 ? "+" : ""}{profit.toFixed(2)}€
                  </strong>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Inline collapsible form — identical pattern to Wishlist */}
      <div className={`collapsible-form ${orderModalOpen ? "expanded" : ""}`}>
        <form className="add-form" onSubmit={handleCreateOrder}>
          <input
            type="text"
            placeholder="Nombre del pedido (opcional)"
            value={newOrderName}
            onChange={e => setNewOrderName(e.target.value)}
            autoFocus={orderModalOpen}
          />
          <button type="submit" className="btn btn-primary">Crear pedido</button>
        </form>
      </div>

      {addItemModalOpen && (
        <div className="modal-overlay" onClick={() => setAddItemModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Añadir Artículo</h2>
            <form className="add-form" onSubmit={handleAddItemSubmit}>
              <input
                type="text"
                placeholder="Nombre del artículo"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                required
                autoFocus
              />
              <input
                type="number"
                placeholder="Precio de compra (€)"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={newItemBuyPrice}
                onChange={e => setNewItemBuyPrice(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder="Precio de venta (€) (opcional)"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={newItemSellPrice}
                onChange={e => setNewItemSellPrice(e.target.value)}
              />
              <div className="modal-actions">
                <button type="button" className="btn btn-cancel" onClick={() => setAddItemModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Añadir</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editItemModalOpen && (
        <div className="modal-overlay" onClick={() => setEditItemModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Vender Artículo</h2>
            <form className="add-form" onSubmit={handleUpdateSellPriceSubmit}>
              <input
                type="number"
                placeholder="Precio de venta (€)"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={editSellPrice}
                onChange={e => setEditSellPrice(e.target.value)}
                autoFocus
              />
              <p style={{fontSize: "0.8rem", color: "var(--text-3)", marginTop: "-4px"}}>
                * Déjalo vacío si quieres marcarlo como no vendido.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn btn-cancel" onClick={() => setEditItemModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailOrderId && (
        <div className="detail-overlay" onClick={() => setDetailOrderId(null)}>
          <div className="detail-sheet" onClick={e => e.stopPropagation()} style={{ overflowY: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="detail-handle" style={{flexShrink: 0}}></div>
            {(() => {
              const order = orders.find(o => o.id === detailOrderId)
              if (!order) return null
              const cost = order.items.reduce((acc, item) => acc + item.buy_price, 0)
              const revenue = order.items.reduce((acc, item) => acc + (item.sell_price || 0), 0)
              const profit = revenue - cost
              return (
                <div style={{padding: "0 24px 24px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0}}>
                    <h2 style={{fontSize: "1.2rem", margin: "10px 0"}}>{order.name} <span className="order-date" style={{fontSize: "0.85rem", color: "var(--text-3)", marginLeft: "8px", fontWeight: "normal"}}>{order.date}</span></h2>
                    <button 
                      onClick={() => setDetailOrderId(null)} 
                      style={{
                        background: "none", border: "none", color: "var(--danger)", 
                        fontSize: "1.8rem", cursor: "pointer", padding: "0 8px", lineHeight: 1
                      }}
                    >×</button>
                  </div>
                  
                  <div className="order-summary" style={{margin: "16px 0", padding: "16px", borderRadius: "var(--r-lg)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", flexShrink: 0}}>
                    <div className="summary-stat">
                      <span>Artículos</span>
                      <strong>{order.items.length}</strong>
                    </div>
                    <div className="summary-stat">
                      <span>Coste</span>
                      <strong>{cost.toFixed(2)}€</strong>
                    </div>
                    <div className="summary-stat">
                      <span>Beneficio</span>
                      <strong className={profit >= 0 ? "profit-positive" : "profit-negative"}>
                        {profit > 0 ? "+" : ""}{profit.toFixed(2)}€
                      </strong>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
                    {order.items.length === 0 && <p className="empty-state" style={{padding: "20px", fontSize: "0.9rem"}}>No hay artículos en este pedido.</p>}
                    {[...order.items].sort((a, b) => {
                      const aUnsold = a.sell_price === null;
                      const bUnsold = b.sell_price === null;
                      if (aUnsold && !bUnsold) return -1;
                      if (!aUnsold && bUnsold) return 1;
                      return a.id - b.id;
                    }).map(item => (
                      <div key={item.id} className="order-item-row" style={{
                        background: "var(--bg-elevated)", 
                        border: "1px solid var(--border)", 
                        padding: "12px 16px", 
                        borderRadius: "var(--r-md)", 
                        marginBottom: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        transition: "all 0.2s ease"
                      }}>
                        <div style={{
                          flex: 1, 
                          minWidth: 0, 
                          display: "flex",
                          alignItems: "center"
                        }}>
                          <div style={{
                            width: "8px", 
                            height: "8px", 
                            borderRadius: "50%", 
                            background: item.sell_price !== null ? "#10b981" : "var(--accent)", 
                            marginRight: "12px",
                            flexShrink: 0
                          }} />
                          <span className="item-name" style={{
                            fontWeight: 500, 
                            fontSize: "0.95rem", 
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            color: "var(--text-1)",
                            lineHeight: 1.3
                          }}>{item.name}</span>
                        </div>
                        
                        <div className="item-prices" style={{display: "flex", alignItems: "center", gap: "8px", flexShrink: 0}}>
                          <button
                            onClick={() => openEditBuyPrice(item.id, item.buy_price)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid rgba(239,68,68,0.2)",
                              background: "rgba(239,68,68,0.05)",
                              color: "var(--danger)",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                          >-{item.buy_price.toFixed(2)}€</button>
                          
                          <button 
                            className={`sell-price-btn ${item.sell_price !== null ? "sold" : ""}`}
                            onClick={() => openEditSellPrice(item.id, item.sell_price)}
                            style={{
                              padding: "4px 8px", 
                              borderRadius: "6px", 
                              border: item.sell_price !== null ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid var(--border)",
                              background: item.sell_price !== null ? "rgba(16, 185, 129, 0.05)" : "var(--bg-card)",
                              color: item.sell_price !== null ? "#10b981" : "var(--text-2)",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                          >
                            {item.sell_price !== null ? `+${item.sell_price.toFixed(2)}€` : "Vender"}
                          </button>
                          
                          <button 
                            className="btn-delete-item" 
                            onClick={() => setDeleteItemTarget(item.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--text-3)",
                              fontSize: "1.2rem",
                              cursor: "pointer",
                              padding: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "color 0.2s ease"
                            }}
                            title="Borrar artículo"
                          >×</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ flexShrink: 0, marginTop: "12px" }}>
                    <button className="btn-add-item" style={{
                      width: "100%", 
                      padding: "16px",
                      background: "transparent",
                      border: "1px dashed var(--border)",
                      color: "var(--text-2)",
                      borderRadius: "var(--r-md)",
                      cursor: "pointer",
                      fontSize: "0.95rem",
                      marginTop: 0
                    }} onClick={() => openAddItem(order.id)}>
                      + Añadir artículo
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* MODALS DE BORRADO */}
      {deleteOrderTarget && (() => {
        const order = orders.find(o => o.id === deleteOrderTarget)
        return (
          <div className="modal-overlay" onClick={() => setDeleteOrderTarget(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <h2>¿Borrar pedido?</h2>
              <p>
                ¿Seguro que quieres borrar el pedido <strong style={{ color: "var(--text-1)" }}>{order?.name}</strong>?
                Se eliminará junto con todos sus artículos. Esta acción no se puede deshacer.
              </p>
              <div className="modal-actions" style={{marginTop: "16px"}}>
                <button className="btn btn-cancel" onClick={() => setDeleteOrderTarget(null)}>Cancelar</button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1, background: "var(--danger)" }}
                  onClick={handleDeleteOrder}
                >
                  Sí, borrar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {deleteItemTarget && (() => {
        let itemName = ""
        orders.forEach(o => {
          const item = o.items.find(i => i.id === deleteItemTarget)
          if (item) itemName = item.name
        })
        return (
          <div className="modal-overlay" onClick={() => setDeleteItemTarget(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <h2>¿Borrar artículo?</h2>
              <p>
                ¿Seguro que quieres borrar <strong style={{ color: "var(--text-1)" }}>{itemName}</strong> del pedido?
                Esta acción no se puede deshacer.
              </p>
              <div className="modal-actions" style={{marginTop: "16px"}}>
                <button className="btn btn-cancel" onClick={() => setDeleteItemTarget(null)}>Cancelar</button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1, background: "var(--danger)" }}
                  onClick={handleDeleteItem}
                >
                  Sí, borrar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {editBuyPriceModalOpen && (
        <div className="modal-overlay" onClick={() => setEditBuyPriceModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Editar precio de compra</h2>
            <form className="add-form" onSubmit={handleUpdateBuyPriceSubmit}>
              <input
                type="number"
                placeholder="Precio de compra (€)"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={editBuyPrice}
                onChange={e => setEditBuyPrice(e.target.value)}
                required
                autoFocus
              />
              <div className="modal-actions">
                <button type="button" className="btn btn-cancel" onClick={() => setEditBuyPriceModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("auth") === "ok"
  })

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  
  const [currentView, setCurrentView] = useState<"wishlist" | "orders">("wishlist")
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalOrderProfit, setTotalOrderProfit] = useState<number | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [isGridView, setIsGridView] = useState(() => {
    const saved = localStorage.getItem("viewMode")
    return saved !== null ? saved === "grid" : true
  })

  useEffect(() => {
    localStorage.setItem("viewMode", isGridView ? "grid" : "list")
  }, [isGridView])

  // Add form
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [link, setLink] = useState("")
  const [image, setImage] = useState<File | null>(null)

  // Detail view
  const [detailArticle, setDetailArticle] = useState<Article | null>(null)
  const [activeImage, setActiveImage] = useState<string | null>(null)
  
  // Description edit state
  const [editingDescription, setEditingDescription] = useState(false)
  const [editDescText, setEditDescText] = useState("")
  const [savingDesc, setSavingDesc] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Edit modal
  const [editArticle, setEditArticle] = useState<Article | null>(null)
  const [editName, setEditName] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editLink, setEditLink] = useState("")
  const [editImage, setEditImage] = useState<File | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/articles`)
      const data = await res.json()
      setArticles(data)
    } catch {
      showToast("Error al cargar los artículos", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchArticles() }, [])

  // ─── CREATE ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!image) return
    setSubmitting(true)
    const formData = new FormData()
    formData.append("name", capitalizeFirst(name.trim()))
    formData.append("price", price)
    formData.append("image", image)
    if (link.trim()) formData.append("link", link.trim())
    try {
      const res = await fetch(`${API}/api/articles`, { method: "POST", body: formData })
      if (!res.ok) throw new Error()
      setName(""); setPrice(""); setLink(""); setImage(null)
      const input = document.getElementById("file-input") as HTMLInputElement
      if (input) input.value = ""
      setFormOpen(false)
      showToast("Artículo añadido ✓", "success")
      await fetchArticles()
    } catch {
      showToast("Error al crear el artículo", "error")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── EDIT ───
  const openEdit = (a: Article, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditArticle(a)
    setEditName(a.name)
    setEditPrice(String(a.price))
    setEditLink(a.link || "")
    setEditImage(null)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editArticle) return
    setEditSubmitting(true)
    const formData = new FormData()
    formData.append("name", capitalizeFirst(editName.trim()))
    formData.append("price", editPrice)
    if (editLink.trim()) formData.append("link", editLink.trim())
    if (editImage) formData.append("image", editImage)
    try {
      const res = await fetch(`${API}/api/articles/${editArticle.id}`, { method: "PUT", body: formData })
      if (!res.ok) throw new Error()
      setEditArticle(null)
      showToast("Artículo actualizado ✓", "success")
      await fetchArticles()
    } catch {
      showToast("Error al editar", "error")
    } finally {
      setEditSubmitting(false)
    }
  }

  // ─── DELETE ───
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`${API}/api/articles/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      // Close detail if open
      if (detailArticle?.id === deleteTarget.id) setDetailArticle(null)
      setDeleteTarget(null)
      showToast("Artículo eliminado", "success")
      await fetchArticles()
    } catch {
      showToast("Error al eliminar", "error")
    }
  }

  // ─── DESCRIPTION & GALLERY ───
  const handleSaveDescription = async () => {
    if (!detailArticle) return
    setSavingDesc(true)
    try {
      const res = await fetch(`${API}/api/articles/${detailArticle.id}/description`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescText })
      })
      if (!res.ok) throw new Error()
      const updatedArticle = await res.json()
      setDetailArticle(updatedArticle)
      setEditingDescription(false)
      showToast("Descripción actualizada", "success")
      await fetchArticles()
    } catch {
      showToast("Error al actualizar la descripción", "error")
    } finally {
      setSavingDesc(false)
    }
  }

  const handleUploadGalleryImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !editArticle) return
    const file = e.target.files[0]
    setUploadingImage(true)
    const formData = new FormData()
    formData.append("image", file)
    try {
      const res = await fetch(`${API}/api/articles/${editArticle.id}/images`, {
        method: "POST",
        body: formData
      })
      if (!res.ok) throw new Error()
      const updatedArticle = await res.json()
      setEditArticle(updatedArticle)
      showToast("Imagen añadida", "success")
      await fetchArticles()
    } catch {
      showToast("Error al subir la imagen", "error")
    } finally {
      setUploadingImage(false)
      e.target.value = "" // clear input
    }
  }

  const handleDeleteGalleryImage = async (imageId: number) => {
    if (!editArticle) return
    try {
      const res = await fetch(`${API}/api/articles/images/${imageId}`, {
        method: "DELETE"
      })
      if (!res.ok) throw new Error()
      // Optimistically update the edit view
      const updatedImages = editArticle.images?.filter(img => img.id !== imageId)
      setEditArticle({ ...editArticle, images: updatedImages })
      showToast("Imagen eliminada", "success")
      await fetchArticles()
    } catch {
      showToast("Error al eliminar la imagen", "error")
    }
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen onLoginSuccess={() => {
        setIsAuthenticated(true)
        localStorage.setItem("auth", "ok")
      }} />
    )
  }

  return (
    <>
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      <header className="header">
        <div className="header-left">
          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            <div className={`hamburger ${menuOpen ? 'open' : ''}`}>
              <span></span><span></span><span></span>
            </div>
          </button>
          <div 
            onClick={() => { setCurrentView(v => v === "wishlist" ? "orders" : "wishlist"); setMenuOpen(false); }}
            style={{ cursor: "pointer", userSelect: "none" }}
            title="Cambiar pantalla"
          >
            <h1>{currentView === "wishlist" ? "Work" : "Pedidos"}</h1>
            <p>{currentView === "wishlist" ? `${articles.length} artículo${articles.length !== 1 ? "s" : ""}` : "Gestión de beneficios"}</p>
          </div>
          
          {menuOpen && (
            <div className="dropdown-menu">
              <button onClick={() => { setCurrentView("wishlist"); setMenuOpen(false); }}>
                Lista principal
              </button>
              <button onClick={() => { setCurrentView("orders"); setMenuOpen(false); }}>
                Gestión de pedidos
              </button>
            </div>
          )}
        </div>
        <div className="header-right-actions">
          {currentView === "wishlist" && (
            <button 
              className="btn-view-toggle" 
              onClick={() => setIsGridView(!isGridView)}
              title={isGridView ? "Cambiar a vista de lista" : "Cambiar a vista de cuadrícula"}
            >
              {isGridView ? "🔲" : "🔳"}
            </button>
          )}
          {currentView === "wishlist" && <div className="header-badge">{articles.length}</div>}
          {currentView === "orders" && totalOrderProfit !== null && (
            <div className={`header-badge ${totalOrderProfit >= 0 ? "" : "header-badge-danger"}`}>
              {totalOrderProfit > 0 ? "+" : ""}{totalOrderProfit.toFixed(0)}€
            </div>
          )}
        </div>
      </header>

      <div className="container">
        {currentView === "orders" ? (
          <div key="orders" className="view-enter">
            <OrdersScreen onProfitChange={setTotalOrderProfit} />
          </div>
        ) : (
          <div key="wishlist" className="view-enter">
            {/* Wishlist View */}
            <div className="form-section">
              <button
                className={`btn-toggle-form${formOpen ? " is-open" : ""}`}
                onClick={() => setFormOpen(v => !v)}
                aria-expanded={formOpen}
              >
                <span className={`toggle-icon ${formOpen ? "open" : ""}`}>＋</span>
                {formOpen ? "Cerrar formulario" : "Añadir artículo"}
              </button>

              <div className={`collapsible-form ${formOpen ? "expanded" : ""}`}>
                <form className="add-form" onSubmit={handleSubmit}>
                  <input
                    type="text"
                    placeholder="Nombre del artículo"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Precio (€)"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    required
                  />
                  <input
                    type="url"
                    placeholder="Link del producto (opcional)"
                    value={link}
                    onChange={e => setLink(e.target.value)}
                  />
                  <label className="file-label">
                    <span className="file-label-text">
                      {image ? `📎 ${image.name}` : "📷 Seleccionar imagen"}
                    </span>
                    <input
                      id="file-input"
                      type="file"
                      accept="image/*,.heic,.heif"
                      onChange={e => setImage(e.target.files ? e.target.files[0] : null)}
                      required
                    />
                  </label>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? <><span className="spinner" />Guardando...</> : "Guardar artículo"}
                  </button>
                </form>
              </div>
            </div>

            {loading ? (
              <div className="loading-wrap">
                <span className="spinner" />
                Cargando...
              </div>
            ) : articles.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📋</span>
                No hay artículos todavía.<br />¡Pulsa "Añadir artículo" para empezar!
              </div>
            ) : (
              <div className={`card-list ${isGridView ? 'grid-view' : ''}`}>
                {articles.map(a => (
                  <div key={a.id} className="card" onClick={() => {
                    setDetailArticle(a)
                    setActiveImage(`${API}/${a.image_url}`)
                    setEditingDescription(false)
                    setEditDescText(a.description || "")
                  }}>
                    <div className="card-image-wrap">
                      <img
                        src={`${API}/${a.image_url}`}
                        alt={a.name}
                        onError={e => {
                          (e.target as HTMLImageElement).src =
                            "https://placehold.co/600x400/141416/3f3f46?text=Sin+imagen"
                        }}
                      />
                      {a.link && (
                        <div className="card-link-badge">🔗</div>
                      )}
                    </div>
                    <div className="card-info">
                      <div className="card-row">
                        <p className="card-name">{a.name}</p>
                        <p className="card-price">{a.price.toFixed(2)} €</p>
                      </div>
                      <p className="card-date">📅 {a.date}</p>
                      <div className="card-actions">
                        <button className="btn btn-edit" onClick={e => openEdit(a, e)}>Editar</button>
                        <button className="btn btn-delete" onClick={e => { e.stopPropagation(); setDeleteTarget(a) }}>Borrar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {detailArticle && (
        <div className="detail-overlay" onClick={() => setDetailArticle(null)}>
          <div className="detail-sheet" onClick={e => e.stopPropagation()}>
            <div className="detail-handle" />
            <div className="detail-image-wrap">
              <img
                src={activeImage || `${API}/${detailArticle.image_url}`}
                alt={detailArticle.name}
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    "https://placehold.co/600x400/141416/3f3f46?text=Sin+imagen"
                }}
              />
              <div className="detail-price-overlay">{detailArticle.price.toFixed(2)} €</div>
            </div>
            
            {/* Gallery Section - Only viewing */}
            <div className="detail-gallery">
              <div
                className={`gallery-item ${activeImage === `${API}/${detailArticle.image_url}` ? 'active' : ''}`}
                onClick={() => setActiveImage(`${API}/${detailArticle.image_url}`)}
              >
                <img src={`${API}/${detailArticle.image_url}`} alt="Principal" />
              </div>
              {detailArticle.images?.map(img => (
                <div
                  key={img.id}
                  className={`gallery-item ${activeImage === `${API}/${img.image_url}` ? 'active' : ''}`}
                  onClick={() => setActiveImage(`${API}/${img.image_url}`)}
                >
                  <img src={`${API}/${img.image_url}`} alt="Galería" />
                </div>
              ))}
            </div>

            <div className="detail-body">
              <h2 className="detail-name">{detailArticle.name}</h2>
              <div className="detail-meta">
                <span className="detail-date">📅 {detailArticle.date}</span>
              </div>
              <div className="detail-divider" />
              
              {/* Description Section */}
              <div className="detail-description-section">
                {editingDescription ? (
                  <div className="description-edit">
                    <textarea
                      value={editDescText}
                      onChange={e => setEditDescText(e.target.value)}
                      placeholder="Añade una descripción, notas o detalles..."
                      rows={4}
                    />
                    <div className="description-actions">
                      <button className="btn btn-cancel" onClick={() => setEditingDescription(false)}>Cancelar</button>
                      <button className="btn btn-primary" onClick={handleSaveDescription} disabled={savingDesc}>
                        {savingDesc ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="description-view">
                    {detailArticle.description ? (
                      <>
                        <p className="description-text">{detailArticle.description}</p>
                        <button className="btn-text" onClick={() => setEditingDescription(true)}>✎</button>
                      </>
                    ) : (
                      <button className="btn-text empty" onClick={() => setEditingDescription(true)}>
                        ＋ Añadir descripción
                      </button>
                    )}
                  </div>
                )}
              </div>

              {detailArticle.link && (
                <a
                  href={detailArticle.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="detail-link-btn"
                >
                  🔗 Ver producto
                </a>
              )}
              <div className="detail-actions">
                <button className="btn btn-edit" style={{ flex: 1 }} onClick={e => {
                  setDetailArticle(null)
                  openEdit(detailArticle, e)
                }}>
                  Editar
                </button>
                <button className="btn btn-delete" style={{ flex: 1 }} onClick={() => {
                  setDetailArticle(null)
                  setDeleteTarget(detailArticle)
                }}>
                  Borrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit bottom sheet */}
      {editArticle && (
        <div className="modal-overlay" onClick={() => setEditArticle(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2>Editar artículo</h2>
            <form className="add-form" onSubmit={handleEdit}>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
              <input type="number" step="0.01" min="0" inputMode="decimal" value={editPrice} onChange={e => setEditPrice(e.target.value)} required />
              <input
                type="url"
                placeholder="Link del producto (opcional)"
                value={editLink}
                onChange={e => setEditLink(e.target.value)}
              />
              <label className="file-label">
                <span className="file-label-text">
                  {editImage ? `📎 ${editImage.name}` : "📷 Cambiar imagen principal (opcional)"}
                </span>
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={e => setEditImage(e.target.files ? e.target.files[0] : null)}
                />
              </label>

              {/* Edit Gallery Section */}
              <div style={{marginTop: "8px", padding: "12px", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", border: "1px solid var(--border)"}}>
                <h3 style={{fontSize: "0.9rem", color: "var(--text-2)", marginBottom: "12px", fontWeight: "600"}}>Fotos secundarias</h3>
                <div style={{display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "4px"}}>
                  {editArticle.images?.map(img => (
                    <div key={img.id} style={{position: "relative", flexShrink: 0}}>
                      <img src={`${API}/${img.image_url}`} alt="Galería" style={{width: "60px", height: "60px", objectFit: "cover", borderRadius: "var(--r-sm)", border: "1px solid var(--border)"}} />
                      <button
                        type="button"
                        onClick={() => handleDeleteGalleryImage(img.id)}
                        title="Borrar imagen secundaria"
                        style={{position: "absolute", top: "-6px", right: "-6px", background: "var(--danger)", color: "white", border: "none", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.9rem", boxShadow: "var(--shadow-sm)", transition: "transform 0.15s ease"}}
                      >×</button>
                    </div>
                  ))}
                  <label style={{flexShrink: 0, width: "60px", height: "60px", border: "1px dashed var(--border-focus)", borderRadius: "var(--r-sm)", background: "rgba(59,130,246,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--accent)", transition: "background 0.2s ease"}}>
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      onChange={handleUploadGalleryImage}
                      disabled={uploadingImage}
                      style={{display: "none"}}
                    />
                    {uploadingImage ? <span className="spinner" style={{margin: 0, width: "18px", height: "18px"}} /> : <span style={{fontSize: "1.4rem"}}>＋</span>}
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-cancel" onClick={() => setEditArticle(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? <><span className="spinner" />Guardando...</> : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2>Eliminar artículo</h2>
            <p>
              ¿Seguro que quieres borrar <strong style={{ color: "var(--text-1)" }}>{deleteTarget.name}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, background: "var(--danger)" }}
                onClick={handleDelete}
              >
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
