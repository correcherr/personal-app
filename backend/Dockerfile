FROM python:3.11-slim

# Evitar que Python genere archivos .pyc
ENV PYTHONDONTWRITEBYTECODE 1
# Asegurar que el output llegue a la consola inmediatamente
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Instalar dependencias del sistema necesarias para psycopg2-binary y Pillow
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar requerimientos
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 8000

# Comando para arrancar la app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
