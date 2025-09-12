# 📦 Inventory Critical Fanout Exchange - Testing Guide

Este documento describe cómo probar la funcionalidad del **exchange fanout** implementado para el sistema de inventario crítico en nuestro e-commerce con microservicios.

## 🏗️ Arquitectura del Sistema

### Exchange Fanout: `inventory.critical`
Cuando el inventario de un producto cae por debajo del nivel crítico (≤ 5 unidades), se activa un evento que se envía simultáneamente a todos los servicios conectados.

### Servicios que Reaccionan:
- **Products Service** (Publisher): Publica el evento cuando se actualiza stock
- **Notifications Service**: Envía alertas por email/SMS 
- **Orders Service**: Implementa restricciones de pedidos

---

## 🚀 Setup Inicial

### 1. Iniciar los Servicios con Docker Compose

```bash
# Opción 1: Iniciar todos los servicios de una vez
docker-compose up -d

# Opción 2: Iniciar servicios paso a paso para debugging
# Terminal 1 - Infraestructura (PostgreSQL, Redis, RabbitMQ)
docker-compose up -d postgres redis rabbitmq

# Terminal 2 - Users Service (Puerto 3001)
docker-compose up users-service

# Terminal 3 - Products Service (Puerto 3002)  
docker-compose up products-service

# Terminal 4 - Orders Service (Puerto 3003)
docker-compose up orders-service

# Terminal 5 - Notifications Service (Puerto 3004)
docker-compose up notifications-service
```

### 1.1 Desarrollo Local (Alternativa)

```bash
# Si prefieres ejecutar los servicios localmente para desarrollo:

# Terminal 1 - Solo infraestructura con Docker
docker-compose up -d postgres redis rabbitmq

# Terminal 2 - Products Service
cd services/products-service
npm install
npm run dev  # Usa puerto 3002

# Terminal 3 - Notifications Service  
cd services/notifications-service
npm install
npm run dev  # Usa puerto 3004

# Terminal 4 - Orders Service
cd services/orders-service
npm install
npm run dev  # Usa puerto 3003

# Terminal 5 - Users Service
cd services/users-service
npm install
npm run dev  # Usa puerto 3001
```

### 2. Verificar Estado de los Servicios

#### 2.1 Mapeo de Puertos
```bash
# Servicios y sus puertos:
# - Users Service:         localhost:3001
# - Products Service:      localhost:3002  (Principal para inventory)
# - Orders Service:        localhost:3003
# - Notifications Service: localhost:3004
# - RabbitMQ Management:   localhost:15672 (admin/password)
# - PostgreSQL:            localhost:5432
# - Redis:                 localhost:6379
```

#### 2.2 Health Checks
```bash
# Verificar que todos los servicios estén funcionando
curl http://localhost:3001/health  # Users Service
curl http://localhost:3002/health  # Products Service  
curl http://localhost:3003/health  # Orders Service
curl http://localhost:3004/health  # Notifications Service

# Verificar acceso a RabbitMQ Management
open http://localhost:15672
# User: admin, Password: password
```

#### 2.3 Verificar Conectividad RabbitMQ
```bash
# Verificar que los servicios se conecten correctamente
# Deberías ver en los logs:
# ✅ RabbitMQ connected successfully
# ✅ Event listeners started successfully
# ✅ Inventory critical listener started

# Ver logs de Docker Compose
docker-compose logs -f products-service | grep "RabbitMQ"
docker-compose logs -f notifications-service | grep "RabbitMQ"
docker-compose logs -f orders-service | grep "RabbitMQ"
```

#### 2.4 Inicializar Base de Datos (Primera vez)
```bash
# 1. Si ya tienes datos en PostgreSQL, ejecutar migración primero
docker-compose exec postgres psql -U postgres -d ecommerce -f /docker-entrypoint-initdb.d/../migrations/001-update-products-schema.sql

# 2. Ejecutar seed script para crear productos de prueba
docker-compose exec products-service npm run seed

# O si ejecutas localmente:
cd services/products-service
npm run seed

# 3. Verificar que los productos se crearon con la estructura correcta
curl http://localhost:3002/api/products | jq '.products[] | {id, name, stock_quantity, available}'
```

#### 2.5 Solucionar Error "stock_quantity does not exist"
```bash
# Si ves el error: column "stock_quantity" of relation "products" does not exist

# Opción 1: Recrear completamente la base de datos
docker-compose down -v
docker-compose up -d postgres redis rabbitmq
# Esperar que PostgreSQL inicie completamente
docker-compose up -d products-service

# Opción 2: Ejecutar migración manual
docker-compose exec postgres psql -U postgres -d ecommerce -c "
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;

UPDATE products SET stock_quantity = COALESCE(stock, 0) WHERE stock_quantity IS NULL;
UPDATE products SET available = (stock_quantity > 0);

CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(available);
"
```

---

## 📋 Endpoints Disponibles

### Products Service API (Puerto 3002)
```bash
# Obtener todos los productos
GET http://localhost:3002/api/products

# Obtener un producto específico
GET http://localhost:3002/api/products/:id

# Actualizar stock de un producto (para testing inventory)
PUT http://localhost:3002/api/products/:id/stock
Content-Type: application/json
{
  "stock_quantity": number
}

# Health checks
GET http://localhost:3002/health
GET http://localhost:3002/api/products/health/db
GET http://localhost:3002/api/products/health/cache
```

### Ejemplo Rápido de Prueba
```bash
# 1. Verificar que hay productos en la BD
curl http://localhost:3002/api/products

# 2. Si no hay productos, ejecutar seed:
docker-compose exec products-service npm run seed

# 3. Probar actualización de stock (usar ID real de producto)
curl -X PUT http://localhost:3002/api/products/1/stock \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 3}'
```

---

## 🧪 Escenarios de Prueba

### **Escenario 1: Stock Crítico (2-5 unidades)**

**Objetivo**: Verificar que se envían alertas cuando el stock está bajo pero aún disponible.

```bash
# Actualizar stock a 3 unidades (nivel crítico)
curl -X PUT http://localhost:3002/api/products/1/stock \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 3}'
```

**Comportamiento Esperado**:
- **Products Service**: Publica evento `inventory.critical`
- **Notifications Service**: Envía emails a admin@ecommerce.com e inventory@ecommerce.com + SMS
- **Orders Service**: Limita pedidos a máximo 3 unidades por orden

**Logs a Verificar**:
```
[Products] Published critical inventory event for product 1
[Notifications] 📥 Received InventoryCritical event
[Notifications] ✅ Critical inventory notifications sent for product 1
[Orders] 📥 Received inventory critical event in orders service
[Orders] ⚠️ Limiting orders for product 1 to maximum 3 units per order
```

---

### **Escenario 2: Stock Muy Bajo (1-2 unidades)**

**Objetivo**: Verificar restricciones más severas cuando el stock es extremadamente bajo.

```bash
# Actualizar stock a 2 unidades
curl -X PUT http://localhost:3002/api/products/2/stock \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 2}'
```

**Comportamiento Esperado**:
- **Products Service**: Publica evento `inventory.critical`
- **Notifications Service**: Envía alertas de stock crítico
- **Orders Service**: Limita pedidos a máximo 2 unidades + implementa restricciones adicionales

**Logs a Verificar**:
```
[Orders] Product 2 has critically low stock (2 units). Limiting orders...
[Orders] ⚠️ Limiting orders for product 2 to maximum 2 units per order
```

---

### **Escenario 3: Stock Agotado (0 unidades)**

**Objetivo**: Verificar que se suspenden completamente las ventas cuando no hay stock.

```bash
# Actualizar stock a 0 unidades
curl -X PUT http://localhost:3002/api/products/3/stock \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 0}'
```

**Comportamiento Esperado**:
- **Products Service**: Publica evento `inventory.critical`
- **Notifications Service**: Envía alertas urgentes de stock agotado
- **Orders Service**: Suspende completamente los pedidos + cancela pedidos pendientes

**Logs a Verificar**:
```
[Orders] Product 3 is out of stock. Implementing order restrictions...
[Orders] 🚫 Suspending all new orders for product 3
[Orders] ❌ Canceling pending orders for out-of-stock product 3
```

---

### **Escenario 4: Stock Normal (> 5 unidades)**

**Objetivo**: Verificar que NO se activan alertas cuando el stock es normal.

```bash
# Actualizar stock a 10 unidades (por encima del nivel crítico)
curl -X PUT http://localhost:3002/api/products/4/stock \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 10}'
```

**Comportamiento Esperado**:
- **Products Service**: NO publica evento (stock normal)
- **Notifications Service**: NO recibe eventos
- **Orders Service**: NO recibe eventos

**Logs a Verificar**:
```
[Products] Stock updated successfully (NO inventory critical event)
```

---

### **Escenario 5: Múltiples Productos Simultáneos**

**Objetivo**: Verificar que el sistema maneja múltiples productos críticos simultáneamente.

```bash
# Producto 1 - Stock crítico
curl -X PUT http://localhost:3002/api/products/1/stock \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 4}' &

# Producto 2 - Stock agotado  
curl -X PUT http://localhost:3002/api/products/2/stock \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 0}' &

# Producto 3 - Stock muy bajo
curl -X PUT http://localhost:3002/api/products/3/stock \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 1}' &

wait
```

**Comportamiento Esperado**:
- Todos los servicios procesan múltiples eventos simultáneamente
- Cada producto tiene su propio tratamiento según su nivel de stock
- Los eventos se procesan de manera independiente

---

## 🔍 Verificación de Logs

### **Monitoreo en Tiempo Real**

```bash
# Terminal 1 - Products Service Logs
docker-compose logs -f products-service

# Terminal 2 - Notifications Service Logs  
docker-compose logs -f notifications-service

# Terminal 3 - Orders Service Logs
docker-compose logs -f orders-service

# Terminal 4 - RabbitMQ Logs
docker-compose logs -f rabbitmq
```

### **Verificar Estado de RabbitMQ**

```bash
# Acceder a RabbitMQ Management
open http://localhost:15672
# User: admin, Password: password

# Verificar exchanges:
# - inventory.critical (tipo: fanout)
# - ecommerce.events (tipo: topic)

# Verificar queues:
# - inventory.critical.notifications
# - inventory.critical.orders  
# - inventory.critical.products
```

---

## 🐛 Troubleshooting

### **Problema**: Eventos no se publican

**Solución**:
```bash
# Verificar que el products-service esté corriendo
curl http://localhost:3002/health

# Verificar logs del publisher
grep "inventoryPublisher" services/products-service/logs/*
```

### **Problema**: Servicios no reciben eventos

**Solución**:
```bash
# Verificar conexiones RabbitMQ
curl http://localhost:3004/health  # notifications
curl http://localhost:3003/health  # orders

# Verificar bindings en RabbitMQ Management
# Todas las queues deben estar bound al exchange inventory.critical
```

### **Problema**: Mensajes se quedan en cola

**Solución**:
```bash
# Verificar que los handlers no tengan errores
# Buscar logs de errores en cada servicio

# Purgar queues si es necesario (SOLO EN DESARROLLO)
# Via RabbitMQ Management -> Queues -> Purge Messages
```

---

## 📊 Métricas de Éxito

### **Latencia Esperada**
- Publicación del evento: < 10ms
- Procesamiento por servicio: < 50ms  
- Total end-to-end: < 100ms

### **Throughput**
- El sistema debe manejar 100+ eventos por segundo sin pérdida de mensajes

### **Reliability**
- 100% de entrega a todos los servicios suscritos
- Reintentos automáticos en caso de fallas temporales
- Dead letter queue para mensajes que fallan permanentemente

---

## 🎯 Casos de Uso Adicionales

### **Integración con Frontend**
```javascript
// WebSocket para notificar al frontend en tiempo real
// cuando un producto tiene stock crítico

socket.on('inventory.critical', (data) => {
  // Mostrar banner de "Quedan pocas unidades"
  // Deshabilitar botón de compra si stock = 0
  // Limitar selector de cantidad
});
```

### **Analytics y Reporting**
```bash
# Agregar listener adicional para métricas
# Queue: inventory.critical.analytics

# Trackear:
# - Frecuencia de productos con stock crítico
# - Tiempo promedio para restock
# - Impacto en ventas por falta de inventario
```

---

## 🔄 Automatización de Pruebas

### **Script de Pruebas Completo**

```bash
#!/bin/bash
# test-inventory-fanout.sh

echo "🧪 Iniciando pruebas del Fanout Exchange..."

# Escenario 1: Stock crítico
echo "Escenario 1: Stock crítico (3 unidades)"
curl -s -X PUT http://localhost:3002/api/products/1/stock -H "Content-Type: application/json" -d '{"stock_quantity": 3}'
sleep 2

# Escenario 2: Stock muy bajo  
echo "Escenario 2: Stock muy bajo (1 unidad)"
curl -s -X PUT http://localhost:3002/api/products/2/stock -H "Content-Type: application/json" -d '{"stock_quantity": 1}'
sleep 2

# Escenario 3: Stock agotado
echo "Escenario 3: Stock agotado (0 unidades)"
curl -s -X PUT http://localhost:3002/api/products/3/stock -H "Content-Type: application/json" -d '{"stock_quantity": 0}'
sleep 2

# Escenario 4: Stock normal (no debe activar eventos)
echo "Escenario 4: Stock normal (10 unidades)"
curl -s -X PUT http://localhost:3002/api/products/4/stock -H "Content-Type: application/json" -d '{"stock_quantity": 10}'

echo "✅ Pruebas completadas. Revisar logs de cada servicio."
```

```bash
# Ejecutar las pruebas
chmod +x test-inventory-fanout.sh
./test-inventory-fanout.sh
```

---

Este sistema de inventario crítico con **fanout exchange** garantiza que todos los servicios reaccionen instantáneamente a los cambios de inventario, mejorando la experiencia del usuario y optimizando la gestión del stock.