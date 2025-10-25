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
- **Docker Compose / Podman Compose** → run all services together
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

- [Docker](https://www.docker.com/get-started) or [Podman](https://podman.io/getting-started/installation) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed (or use Podman Compose)

### Start All Services

1. Clone the repository:
```bash
git clone <repository-url>
cd e-commerce
```

2. Build and start all services with Docker Compose:
```bash
# Using Docker Compose
docker-compose up --build

# Using Podman Compose
podman compose up --build
```

Or to run in the background:
```bash
# Using Docker Compose
docker-compose up -d --build

# Using Podman Compose
podman compose up -d --build
```

3. Wait for all services to be ready. You can check the status with:
```bash
# Using Docker Compose
docker-compose ps

# Using Podman Compose
podman compose ps
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

**💡 Pro Tip**: For easier testing, import the `insomnia-collection.json` file into [Insomnia](https://insomnia.rest/) or your preferred REST client. The collection includes all these endpoints with examples, authentication, and proper request formatting.

#### Management Interfaces:

- **RabbitMQ Management UI**: http://localhost:15672
  - Username: `admin`
  - Password: `password`

- **PostgreSQL**: `localhost:5432`
  - Database: `ecommerce`
  - Username: `postgres`
  - Password: `password`

- **Redis**: `localhost:6379`

### Database and Message Broker Access

#### PostgreSQL Database Connection

You can connect to the PostgreSQL database using any PostgreSQL client with these parameters:

- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `ecommerce`
- **Username**: `postgres`
- **Password**: `password`

Connection string format:
```
postgresql://postgres:password@localhost:5432/ecommerce
```

Example using `psql` command line:
```bash
psql -h localhost -p 5432 -U postgres -d ecommerce
```

#### RabbitMQ Management UI

Access the RabbitMQ Management Interface to monitor queues, exchanges, and messages:

- **URL**: http://localhost:15672
- **Username**: `admin`
- **Password**: `password`

From the management UI you can:
- View and manage queues
- Monitor message flow
- Check exchange bindings
- View connection status
- Debug message routing

#### Redis Connection

Connect to Redis using redis-cli or any Redis client:
```bash
redis-cli -h localhost -p 6379
```

Or use the included script:
```bash
./scripts/redis-cli.sh
```

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
# Using Docker Compose
docker-compose logs -f

# Using Podman Compose
podman compose logs -f
```

View logs for a specific service:
```bash
# Using Docker Compose
docker-compose logs -f users-service
docker-compose logs -f products-service
docker-compose logs -f orders-service
docker-compose logs -f notifications-service

# Using Podman Compose
podman compose logs -f users-service
podman compose logs -f products-service
podman compose logs -f orders-service
podman compose logs -f notifications-service
```

Stop all services:
```bash
# Using Docker Compose
docker-compose down

# Using Podman Compose
podman compose down
```

Stop and remove volumes (cleans databases):
```bash
# Using Docker Compose
docker-compose down -v

# Using Podman Compose
podman compose down -v
```

Rebuild a specific service:
```bash
# Using Docker Compose
docker-compose up -d --build users-service

# Using Podman Compose
podman compose up -d --build users-service
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

### Optional: Testing with REST Clients

For manual testing and development, you can use REST clients like [Insomnia](https://insomnia.rest/).

#### Sample API Requests

**1. Register a new user:**
```http
POST http://localhost:3001/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

**2. Login:**
```http
POST http://localhost:3001/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```
*Save the JWT token from the response for authenticated requests*

**3. Get user profile:**
```http
GET http://localhost:3001/profile
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**4. List products:**
```http
GET http://localhost:3002/products
```

**5. Create an order:**
```http
POST http://localhost:3003/orders
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN_HERE

{
  "items": [
    {
      "productId": 1,
      "quantity": 2
    }
  ]
}
```

**6. Get user notifications (Server-Sent Events):**
```http
GET http://localhost:3004/notifications/USER_ID
Accept: text/event-stream
```

#### REST Client Setup Tips:

1. **Environment Variables**: Set up environment variables in your REST client:
   - `base_url`: `http://localhost`
   - `jwt_token`: (update after login)

2. **Collection Organization**: Group requests by service:
   - Users Service (Port 3001)
   - Products Service (Port 3002) 
   - Orders Service (Port 3003)
   - Notifications Service (Port 3004)

3. **Authentication**: Use the JWT token from login response in subsequent requests

#### Insomnia Collection (Optional)

You can create an Insomnia collection with all these endpoints for easier testing. Import the requests above and organize them by service for better workflow.

**Quick Import**: Use the pre-configured Insomnia collection included in this repository:

1. **Download Insomnia**: [https://insomnia.rest/download](https://insomnia.rest/download)
2. **Import Collection**: 
   - Open Insomnia
   - Click "Create" → "Import From" → "File"
   - Select `insomnia-collection.json` from this repository
3. **Set Environment Variables**:
   - Go to "Manage Environments"
   - Update `jwt_token` after logging in
   - `base_url` is already set to `http://localhost`

The collection includes:
- **Users Service**: Register, Login, Get Profile
- **Products Service**: List Products  
- **Orders Service**: Create Order, Get Order, Get User Orders
- **Notifications Service**: Get Notifications (SSE)
- **Pre-configured authentication** with JWT Bearer tokens
- **Environment variables** for easy endpoint management

### Troubleshooting

If you encounter issues starting the services:

1. Make sure the ports are not in use:
```bash
lsof -i :3001,3002,3003,3004,5432,6379,5672,15672
```

2. Clean up previous containers and volumes:
```bash
# Using Docker Compose
docker-compose down -v
docker system prune -a

# Using Podman Compose
podman compose down -v
podman system prune -a
```

3. Check error logs:
```bash
# Using Docker Compose
docker-compose logs

# Using Podman Compose
podman compose logs
```

4. Review healthcheck status:
```bash
# Using Docker Compose
docker-compose ps

# Using Podman Compose
podman compose ps
```