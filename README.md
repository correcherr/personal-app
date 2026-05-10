# FlipManager (WishList & Order System)

![FlipManager Banner](https://placehold.co/1200x400/08080a/3b82f6?text=FlipManager+%7C+Order+%26+Arbitrage+System)

FlipManager es una aplicación web de diseño premium, altamente interactiva y responsiva, diseñada para gestionar de forma eficiente una WishList (o inventario de productos) y agrupar artículos en "Pedidos" calculando costes, ingresos y beneficios netos en tiempo real.

Ideal para proyectos de arbitraje (comprar barato y vender caro), reventa, o simplemente para llevar un registro elegante y seguro del inventario personal.

---

## 🚀 Características Principales

### 1. WishList e Inventario (Catálogo Principal)
- **Vista en Cuadrícula (Grid) o Lista:** Adaptable según preferencias del usuario.
- **Galería de Imágenes Completa:** Permite la subida de una foto principal y múltiples fotos secundarias para cada artículo (almacenadas localmente).
- **Detalle Rico en Información:** Descripciones, links externos (URLs de producto), precios, fechas automáticas de creación y navegación elegante por las galerías.
- **Diseño Premium:** Transiciones suaves, efectos glassmorphism, esquemas de color eléctricos y dark-mode nativo.

### 2. Gestión Avanzada de Pedidos y Beneficios (Orders Module)
- **Agrupación de Artículos:** Permite crear y agrupar múltiples artículos bajo un mismo pedido.
- **Métricas en Tiempo Real:** Calcula el coste total de los artículos comprados, los ingresos de los artículos vendidos, y el beneficio/pérdida neto.
- **Badge de Beneficios Global:** Rastreo dinámico del beneficio (Profit) total de todos los pedidos directamente en la cabecera, marcándose en verde si es positivo y en rojo si es negativo.
- **Organización Automática:** Dentro de cada pedido, los artículos sin vender ("Stock") se fijan en la parte superior, mientras que los artículos vendidos se agrupan debajo de forma automática.

### 3. Seguridad y Diseño Adaptativo
- **Pantalla de Acceso Inteligente:** Bloqueo automático (Lockout) tras múltiples intentos fallidos de inicio de sesión con animaciones de error integradas ("shake effect").
- **Responsive Web Design:** Funciona a la perfección tanto en monitores 4K (Grid System expansivo) como en pantallas de smartphones con menús hamburguesa optimizados y botones tipo "pill" modernos.

---

## 🛠 Arquitectura Tecnológica

- **Frontend (UI/UX):** React.js + TypeScript + Vite. Uso avanzado de CSS puro (variables, calc, flex/grid, transitions, animaciones keyframe) sin dependencias excesivas, lo cual garantiza una carga ultra rápida y una personalización exhaustiva.
- **Backend (API):** FastAPI (Python) proporciona un enrutamiento RESTful a alta velocidad y gestión de archivos (Uploads) de forma muy fluida.
- **Base de Datos:** SQLite automatizado a través de SQLAlchemy ORM, que facilita las migraciones y no requiere servidores pesados en local.

---

## 💻 Instalación y Despliegue en Servidor

### Requisitos Previos
- Node.js y npm (para el Frontend)
- Python 3.9 o superior (para el Backend)

### 1. Clonar el Repositorio
```bash
git clone https://github.com/TU_USUARIO/FlipManager.git
cd FlipManager
```

### 2. Configurar el Backend (FastAPI)
```bash
cd backend

# Crear un entorno virtual e instalar dependencias
python -m venv venv
source venv/bin/activate  # En Windows usa: venv\Scripts\activate
pip install -r requirements.txt # (Asegúrate de instalar fastapi, uvicorn, sqlalchemy, python-multipart, etc.)

# CONFIGURAR VARIABLES DE ENTORNO
# Duplica el archivo .env.example como .env y establece una contraseña segura
cp .env.example .env

# Ejecutar el servidor
uvicorn main:app --reload --port 8000
```
> **Nota de Seguridad:** Nunca expongas tu archivo `.env` en repositorios públicos. Este proyecto incluye un estricto `.gitignore` para protegerte.

### 3. Configurar el Frontend (React + Vite)
```bash
cd ../frontend

# Instalar los paquetes
npm install

# Iniciar el servidor en modo desarrollo
npm run dev
```

### 4. Producción
Para desplegar la aplicación en producción (Ej: Vercel para React y Render/VPS para FastAPI):
1. **Frontend:** Ejecuta `npm run build` en la carpeta `frontend`. Cambia el constante `API` en `App.tsx` para que apunte a la URL de producción de tu servidor backend.
2. **Backend:** Configura un proxy inverso con NGINX para que apunte al servicio uvicorn que estará corriendo internamente.
3. El archivo SQLite y las imágenes dentro de `backend/uploads` deberán persistir de alguna manera en el servidor (Ej: Volúmenes persistentes en Docker).

---

## 🔒 Contribuciones y Seguridad
Este proyecto fue diseñado con la seguridad en mente. Todos los archivos generados en tiempo de ejecución (cachés de Python, dependencias de Node, base de datos SQLite y carpetas de subida de imágenes) están listados en el `.gitignore` por defecto. 

**NO ALMACENES INFORMACIÓN CONFIDENCIAL O CREDENCIALES EN EL REPOSITORIO.** Utiliza siempre el archivo `.env`.

---

*Desarrollado y pulido para ser la máxima expresión de estética "Dark AMOLED" en una aplicación de gestión interna.*
