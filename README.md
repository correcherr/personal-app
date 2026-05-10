# 🚀 HUSTLE Financial Analytics Platform

HUSTLE es una plataforma premium diseñada para gestionar inventarios, ventas y beneficios con una precisión absoluta y un diseño visual de élite. Olvídate de las hojas de cálculo aburridas; HUSTLE transforma la gestión de tu negocio (Vinted, Wallapop, eBay) en una experiencia fluida, rápida y estéticamente insuperable.

---

## ✨ Características Principales

### 1. Motor Visual Dinámico (Camaleón)
- **Temas Adaptables:** Elige entre **Dark AMOLED** (negros puros para máximo contraste y ahorro de batería) o el nuevo **Modo Claro (Light)** para entornos diurnos.
- **Inyección de Color Personalizada:** No estás atado a un solo color. Selecciona tu color de acento (Morado, Azul, Verde, Rojo, Amarillo, Rosa) y la aplicación entera adaptará sus botones, gráficas, sombras y efectos de neón al instante.
- **Efectos Premium (Glow & Glassmorphism):** Resplandores dinámicos en tiempo real que reaccionan a tus interacciones y fondos translúcidos estilo iOS.
- **Modo Compacto:** Ajusta la densidad de la interfaz con un solo clic para visualizar más información en la misma pantalla.

### 2. Gestión Financiera de Alta Precisión
- **Cálculo de Beneficio Realizado:** El sistema separa inteligentemente tu "Inversión Activa" (artículos no vendidos) de tu "Beneficio Neto" (ingresos de ventas reales menos el coste de esos artículos específicos).
- **Gráfica de Crecimiento Real:** Visualiza tu beneficio acumulado día a día con una gráfica de nodos reales que traza la historia de tus ingresos.
- **ROI Automático:** Calcula el Retorno de Inversión promedio al instante.

### 3. Ecosistema de Sincronización en Tiempo Real
- **Arquitectura Event-Driven:** Todos los componentes de la app están conectados. Si añades una venta en la pantalla de pedidos, tu perfil, tus estadísticas globales y la gráfica de crecimiento se actualizan instantáneamente sin necesidad de recargar la página.

### 4. Experiencia "Mobile-First" Extrema
- **Haptic Feedback:** Vibraciones sutiles (respuestas táctiles) en dispositivos compatibles al interactuar con interruptores, botones de guardado o eliminar artículos, dando una sensación física a la interfaz digital.
- **Control de Animaciones:** ¿Prefieres velocidad extrema o suavidad absoluta? Configura las animaciones entre *Full*, *Reduced* o *Off* según tus preferencias.
- **Diseño Ergonómico:** Menús "Bottom-Sheet" que se deslizan desde abajo, diseñados específicamente para ser utilizados con una sola mano en pantallas móviles grandes.

### 5. Control de Datos y Privacidad
- **Exportación Total:** Descarga todo el historial de tu negocio en formatos CSV (para Excel) o JSON.
- **Importación/Backups:** Restaura el estado completo de tu negocio subiendo tu archivo JSON de seguridad.

---

## 🛠 Arquitectura Tecnológica

El sistema fue diseñado apostando por un "stack" altamente desacoplado, sin frameworks o dependencias excesivas que entorpezcan la carga.

- **Frontend (React.js + TypeScript):** Construido y servido con Vite. Diseño sin librerías externas pesadas (como TailwindCSS o Bootstrap); uso exclusivo de Vanilla CSS robusto (variables CSS inyectadas en tiempo real, calc(), flex/grid) para un rendimiento extremo.
- **Backend (FastAPI - Python):** Proporciona endpoints RESTful de velocidad relámpago, gestión JWT para sesiones seguras y manipulación interna de archivos/imágenes.
- **Base de Datos (SQLite + SQLAlchemy):** Motor embebido que permite una configuración "Zero-Config" garantizando que tus datos financieros sean portables y fáciles de respaldar.

---

*Desarrollado y pulido para ser la máxima expresión de estética en una aplicación de gestión empresarial.*
