Proyecto: Mini e-commerce de pedidos de comida

Un sistema básico donde un usuario hace un pedido, se procesa y se notifica, con varios microservicios involucrados.

Microservicios propuestos

Servicio de Usuarios (users-service)

Maneja registro/login (JWT).

Expone endpoints como /register, /login, /profile.

Servicio de Productos (products-service)

Lista productos (hamburguesas, pizzas, etc.) desde una base de datos simple (MongoDB o PostgreSQL).

Endpoint: /products.

Usa Redis como caché para que las consultas frecuentes de productos sean más rápidas.

Servicio de Pedidos (orders-service)

Recibe un pedido de un usuario (/orders).

Emite un evento al Event Bus cuando se crea un pedido.

Servicio de Notificaciones (notifications-service)

Escucha los eventos del Event Bus (ej: OrderCreated).

Envía una notificación ficticia (ej. imprime en consola “📩 Pedido confirmado para el usuario X”).

Comunicación entre microservicios

HTTP/REST para comunicación directa (ej. orders-service consulta users-service para validar usuario).

Event Bus (asincronía) para coordinación entre servicios (ej. pedido creado → notificación enviada).

Herramientas open source a usar

Node.js + Express → construir los microservicios.

Docker Compose → levantar todos los servicios juntos.

Redis → caché en products-service.

RabbitMQ o NATS → Event Bus para comunicar eventos.

PostgreSQL/MongoDB → persistencia de usuarios, productos y pedidos.

JWT (jsonwebtoken) → autenticación simple entre servicios.

Flujo de ejemplo

El usuario se registra en users-service.

Consulta el catálogo en products-service (con caché en Redis).

Hace un pedido en orders-service.

orders-service guarda el pedido y emite un evento OrderCreated en el event bus.

notifications-service escucha el evento y genera la notificación.


 Plan de Acción - Mini E-commerce con Microservicios

  1. Configurar infraestructura base con Docker Compose

  - Crear docker-compose.yml con los servicios base
  - Definir redes Docker para comunicación entre servicios
  - Configurar variables de entorno compartidas

  2. Configurar bases de datos (PostgreSQL/MongoDB y Redis)

  - Agregar contenedores de PostgreSQL/MongoDB al docker-compose
  - Configurar Redis para caché
  - Crear scripts de inicialización de base de datos
  - Definir esquemas/colecciones iniciales

  3. Configurar Event Bus (RabbitMQ o NATS)

  - Agregar RabbitMQ o NATS al docker-compose
  - Configurar colas/topics necesarios
  - Definir estrategias de retry y dead letter queues

  4. Crear servicio de usuarios (users-service)

  - Estructura básica con Node.js + Express
  - Endpoints: /register, /login, /profile
  - Implementar JWT para autenticación
  - Conexión a base de datos para usuarios

  5. Crear servicio de productos (products-service)

  - Estructura básica con Node.js + Express
  - Endpoint: /products
  - Integración con Redis para caché
  - Seed de productos iniciales (hamburguesas, pizzas)

  6. Crear servicio de pedidos (orders-service)

  - Estructura básica con Node.js + Express
  - Endpoint: /orders (POST para crear pedidos)
  - Validación de usuarios via HTTP a users-service
  - Emisión de eventos OrderCreated al Event Bus

  7. Crear servicio de notificaciones (notifications-service)

  - Estructura básica con Node.js + Express
  - Listener para eventos OrderCreated del Event Bus
  - Implementar notificaciones ficticias (console.log)

  8. Implementar comunicación HTTP entre servicios

  - Configurar axios/fetch para llamadas entre servicios
  - Implementar validación de JWT entre servicios
  - Manejo de errores y timeouts

  9. Implementar comunicación asíncrona con eventos

  - Publisher en orders-service para eventos
  - Subscriber en notifications-service
  - Definir esquemas de eventos

  10. Probar el flujo completo del sistema

  - Registro de usuario → Login → Consulta productos → Crear pedido → Recibir notificación
  - Crear scripts de prueba o colección Postman
  - Verificar logs en cada servicio