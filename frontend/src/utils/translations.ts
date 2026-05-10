export const translations = {
  ES: {
    // Nav
    inventory: "Stock",
    orders: "Ventas",
    profile: "Ajustes",
    logout: "Cerrar Sesión",
    
    // Orders Screen
    new_order: "Nuevo Pedido",
    total_profit: "Beneficio Total",
    active_orders: "Pedidos Activos",
    add_item: "Añadir Producto",
    buy_price: "Compra",
    sell_price: "Venta",
    profit: "Beneficio",
    units: "Unidades",
    sold: "Vendido",
    pending: "Pendiente",
    delete_confirm: "¿Estás seguro de eliminar este pedido?",
    
    // Profile
    my_profile: "Mi Perfil",
    stats: "Estadísticas",
    appearance: "Apariencia",
    security: "Seguridad",
    data: "Datos",
    help: "Ayuda",
    save_changes: "Guardar Cambios",
    currency: "Moneda",
    language: "Idioma",
    total_profit_stat: "Profit Total",
    month_profit_stat: "Profit Mes",
    roi_avg: "ROI Medio",
    active_products: "Productos Activos",
    
    // Appearance
    neon_glow: "Glow Neón",
    animations: "Intensidad Animaciones",
    anim_high: "Alta",
    anim_low: "Baja",
    anim_off: "Off",
    
    // Data
    export_csv: "Exportar CSV",
    export_json: "Backup JSON",
    import_data: "Importar Datos",
    
    // Common
    cancel: "Cancelar",
    confirm: "Confirmar",
    loading: "Cargando...",
    error: "Error",
    success: "Éxito"
  },
  EN: {
    // Nav
    inventory: "Stock",
    orders: "Sales",
    profile: "Settings",
    logout: "Log Out",
    
    // Orders Screen
    new_order: "New Order",
    total_profit: "Total Profit",
    active_orders: "Active Orders",
    add_item: "Add Product",
    buy_price: "Cost",
    sell_price: "Sale",
    profit: "Profit",
    units: "Units",
    sold: "Sold",
    pending: "Pending",
    delete_confirm: "Are you sure you want to delete this order?",
    
    // Profile
    my_profile: "My Profile",
    stats: "Statistics",
    appearance: "Appearance",
    security: "Security",
    data: "Data",
    help: "Help",
    save_changes: "Save Changes",
    currency: "Currency",
    language: "Language",
    total_profit_stat: "Total Profit",
    month_profit_stat: "Month Profit",
    roi_avg: "Avg ROI",
    active_products: "Active Products",
    
    // Appearance
    neon_glow: "Neon Glow",
    animations: "Animation Intensity",
    anim_high: "High",
    anim_low: "Low",
    anim_off: "Off",
    
    // Data
    export_csv: "Export CSV",
    export_json: "JSON Backup",
    import_data: "Import Data",
    
    // Common
    cancel: "Cancel",
    confirm: "Confirm",
    loading: "Loading...",
    error: "Error",
    success: "Success"
  }
};

export type TranslationKey = keyof typeof translations.ES;
