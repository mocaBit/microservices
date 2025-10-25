# Mini Food Ordering E-commerce

A basic system where a user places an order, it gets processed and notified, with multiple microservices involved.

## Proposed Microservices

### Users Service (users-service)

- Handles registration/login (JWT)
- Exposes endpoints like `/register`, `/login`, `/profile`

### Products Service (products-service)

- Lists products (burgers, pizzas, etc.) from a simple database (PostgreSQL)
- Endpoint: `/products`
- Uses Redis as cache to make frequent product queries faster

### Orders Service (orders-service)

- Receives an order from a user (`/orders`)
- Emits an event to the Event Bus when an order is created

### Notifications Service (notifications-service)

- Listens to events from the Event Bus (e.g., `OrderCreated`)
- Sends a mock notification (e.g., prints to console "📩 Order confirmed for user X")

## Communication Between Microservices

- **HTTP/REST** for direct communication (e.g., orders-service queries users-service to validate user)
- **Event Bus** (asynchronous) for coordination between services (e.g., order created → notification sent)

## Open Source Tools to Use

- **Node.js + Express** → build the microservices
- **Docker Compose** → run all services together
- **Redis** → cache in products-service
- **RabbitMQ** → Event Bus to communicate events
- **PostgreSQL** → persistence for users, products and orders
- **JWT (jsonwebtoken)** → simple authentication between services

## Example Flow

1. User registers in users-service
2. Queries the catalog in products-service (with Redis cache)
3. Places an order in orders-service
4. orders-service saves the order and emits an `OrderCreated` event on the event bus
5. notifications-service listens to the event and generates the notification

## How to Run the Project Locally

### Prerequisites

- [Docker](https://www.docker.com/get-started) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

### Start All Services

1. Clone the repository:
```bash
git clone <repository-url>
cd e-commerce
```

2. Build and start all services with Docker Compose:
```bash
docker-compose up --build
```

Or to run in the background:
```bash
docker-compose up -d --build
```

3. Wait for all services to be ready. You can check the status with:
```bash
docker-compose ps
```

### Available Services

Once all services are running, they will be available at:

- **Users Service**: http://localhost:3001
  - `POST /register` - Register user
  - `POST /login` - Login
  - `GET /profile` - Get profile (requires JWT)

- **Products Service**: http://localhost:3002
  - `GET /products` - List products (with Redis cache)

- **Orders Service**: http://localhost:3003
  - `POST /orders` - Create order (requires JWT)
  - `GET /orders/:id` - Get order
  - `GET /orders/user/:userId` - List user's orders

- **Notifications Service**: http://localhost:3004
  - `GET /notifications/:userId` - Get notifications (SSE)

- **RabbitMQ Management UI**: http://localhost:15672
  - Username: `admin`
  - Password: `password`

- **PostgreSQL**: `localhost:5432`
  - Database: `ecommerce`
  - Username: `postgres`
  - Password: `password`

- **Redis**: `localhost:6379`

### Validate All Services Are Working

Run the validation script:

```bash
./validate-services.sh
```

This script will automatically verify:
- That all containers are running
- That services respond on their ports
- That databases are accessible
- That RabbitMQ is ready to receive messages

### Useful Commands

View logs for all services:
```bash
docker-compose logs -f
```

View logs for a specific service:
```bash
docker-compose logs -f users-service
docker-compose logs -f products-service
docker-compose logs -f orders-service
docker-compose logs -f notifications-service
```

Stop all services:
```bash
docker-compose down
```

Stop and remove volumes (cleans databases):
```bash
docker-compose down -v
```

Rebuild a specific service:
```bash
docker-compose up -d --build users-service
```

### Test the Complete Flow

You can use the included test script:

```bash
./test-flow.sh
```

This script will execute a complete flow:
1. Register a user
2. Login
3. Query products
4. Create an order
5. Verify that the notification was received

### Troubleshooting

If you encounter issues starting the services:

1. Make sure the ports are not in use:
```bash
lsof -i :3001,3002,3003,3004,5432,6379,5672,15672
```

2. Clean up previous containers and volumes:
```bash
docker-compose down -v
docker system prune -a
```

3. Check error logs:
```bash
docker-compose logs
```

4. Review healthcheck status:
```bash
docker-compose ps
```