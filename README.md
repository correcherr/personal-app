## 🎯 El Problema que Resuelve

Llevar el control del inventario y los márgenes de beneficio suele requerir complejas hojas de cálculo de Excel o herramientas de gestión genéricas que carecen de atractivo visual. FlipManager soluciona esto ofreciendo:

1. **Claridad Visual:** Interfaz ultra-premium enfocada en lo visual, donde la fotografía de cada artículo es la protagonista.
2. **Cálculos Automáticos:** No hay que meter fórmulas. Añades el precio de compra, luego el de venta, y el sistema calcula la rentabilidad al vuelo.
3. **Control Centralizado:** Un solo lugar seguro desde tu navegador para auditar tu catálogo completo y el estado de tus envíos o pedidos masivos.

---

## 🚀 Características Principales

### 1. WishList e Inventario (Catálogo Principal)
- **Vista en Cuadrícula (Grid) o Lista:** Adaptable instantáneamente según el dispositivo o preferencias del usuario.
- **Galería de Imágenes Completa:** Permite subir y gestionar una foto principal y múltiples fotos secundarias para cada artículo de forma rápida y sencilla.
- **Detalle Rico en Información:** Descripciones enriquecidas, enlaces externos (URLs de producto), precios, fechas automáticas y estado del producto.
- **Diseño Premium "Dark AMOLED":** Transiciones suaves de estado, efectos *glassmorphism* integrados, esquemas de color eléctricos y un dark-mode absoluto optimizado para la legibilidad nocturna.

### 2. Gestión Avanzada de Pedidos y Beneficios
- **Agrupación Modular:** Permite crear y agrupar múltiples artículos dentro de un mismo pedido, manteniendo el historial limpio.
- **Métricas en Tiempo Real:** Calcula instantáneamente el coste total invertido (Artículos comprados), los ingresos brutos (Artículos vendidos), y el margen de beneficio/pérdida neto.
- **Badge Dinámico Global:** La cabecera superior muestra un contador de rentabilidad (Profit) global calculado sobre el historial completo. Se marca en verde si la cuenta global es rentable, y en rojo si está en pérdidas.
- **Smart Sorting:** Dentro de un pedido, los artículos pendientes de venta ("Stock") flotan automáticamente en la parte superior. Una vez que se marca un precio de venta, el artículo pasa ordenadamente a la zona inferior de "vendidos".

### 3. Seguridad y Adaptabilidad
- **Lockout Inteligente:** El acceso incluye bloqueos automáticos progresivos tras múltiples intentos fallidos, protegidos con animaciones visuales que avisan del error.
- **Mobile-First Responsive:** Se escala y se ajusta a la perfección. Menús de hamburguesa, hojas inferiores desliza-bles (bottom-sheets) tipo iOS y componentes interactivos diseñados para tocar en móviles.

---

## 🛠 Arquitectura Tecnológica

El sistema fue diseñado apostando por un "stack" altamente desacoplado, sin frameworks o dependencias excesivas que entorpezcan la carga.

- **Frontend (UI/UX):** React.js + TypeScript construido y servido con Vite. Diseño sin librerías externas pesadas como TailwindCSS o Bootstrap; uso exclusivo de Vanilla CSS robusto (variables nativas CSS, calc(), flex/grid, transitions de hardware) para un rendimiento extremo de los frames y animaciones.
- **Backend (API):** FastAPI (Python) proporciona endpoints RESTful de extrema velocidad, además de la gestión interna para archivos pesados e imágenes locales.
- **Base de Datos:** Motor SQLite incrustado mediante SQLAlchemy ORM (Object-Relational Mapping). Este enfoque permite usar bases de datos ligeras sin configuraciones de Docker ni dependencias externas, asegurando que la herramienta sea fácil de desplegar y auditar.

---

*Desarrollado y pulido para ser la máxima expresión de estética en una aplicación de gestión interna.*
