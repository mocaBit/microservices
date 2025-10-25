#!/bin/bash

# Script to validate that all services are running and working correctly
# Compatible with Docker Compose and Podman Compose
# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print messages
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Error counter
ERRORS=0

# Detect whether to use Docker Compose or Podman Compose
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif command -v podman-compose &> /dev/null; then
    COMPOSE_CMD="podman-compose"
elif command -v podman &> /dev/null && podman compose version &> /dev/null; then
    COMPOSE_CMD="podman compose"
else
    print_error "Neither Docker Compose nor Podman Compose are installed"
    print_info "Install one of the following:"
    echo "  - Docker Compose: https://docs.docker.com/compose/install/"
    echo "  - Podman Compose: pip install podman-compose"
    echo "  - Podman with compose plugin: https://podman.io/getting-started/installation"
    exit 1
fi

# Validate that Docker Compose or Podman Compose is installed
print_header "Checking container orchestration tool"
print_success "Using: $COMPOSE_CMD"

# Check that containers are running
print_header "Checking Docker containers"

CONTAINERS=(
    "postgres"
    "redis"
    "rabbitmq"
    "users-service"
    "products-service"
    "orders-service"
    "notifications-service"
)

for container in "${CONTAINERS[@]}"; do
    # Search for container by name (may have directory prefix)
    CONTAINER_STATUS=$($COMPOSE_CMD ps -q $container 2>/dev/null | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null)

    # If docker inspect fails, try with podman inspect
    if [ -z "$CONTAINER_STATUS" ] && command -v podman &> /dev/null; then
        CONTAINER_STATUS=$($COMPOSE_CMD ps -q $container 2>/dev/null | xargs podman inspect -f '{{.State.Status}}' 2>/dev/null)
    fi

    if [ "$CONTAINER_STATUS" = "running" ]; then
        print_success "Container $container is running"
    else
        print_error "Container $container is NOT running (Status: ${CONTAINER_STATUS:-not found})"
        ((ERRORS++))
    fi
done

# Check infrastructure health checks
print_header "Checking infrastructure health checks"

# PostgreSQL
print_info "Checking PostgreSQL..."
if $COMPOSE_CMD exec -T postgres pg_isready -U postgres -d ecommerce &> /dev/null; then
    print_success "PostgreSQL is ready and accepting connections"
else
    print_error "PostgreSQL is not responding"
    ((ERRORS++))
fi

# Redis
print_info "Checking Redis..."
if $COMPOSE_CMD exec -T redis redis-cli ping &> /dev/null; then
    print_success "Redis is responding"
else
    print_error "Redis is not responding"
    ((ERRORS++))
fi

# RabbitMQ
print_info "Checking RabbitMQ..."
if $COMPOSE_CMD exec -T rabbitmq rabbitmq-diagnostics ping &> /dev/null; then
    print_success "RabbitMQ is responding"
else
    print_error "RabbitMQ is not responding"
    ((ERRORS++))
fi

# Check HTTP services
print_header "Checking HTTP service endpoints"

# Wait a bit for services to start
sleep 2

# Users Service
print_info "Checking Users Service..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
    print_success "Users Service is responding on port 3001"
else
    print_warning "Users Service may not be ready (HTTP $RESPONSE) - trying alternate endpoint..."
    # Try with another endpoint
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null || echo "000")
    if [ "$RESPONSE" != "000" ]; then
        print_success "Users Service is responding"
    else
        print_error "Users Service is not responding"
        ((ERRORS++))
    fi
fi

# Products Service
print_info "Checking Products Service..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/products 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ]; then
    print_success "Products Service is responding on port 3002"
    # Check that it has products
    PRODUCTS=$(curl -s http://localhost:3002/products 2>/dev/null)
    if [ ! -z "$PRODUCTS" ]; then
        print_success "Products Service has available data"
    fi
elif [ "$RESPONSE" = "404" ]; then
    print_warning "Products Service responds but /products endpoint returns 404"
else
    print_error "Products Service is not responding correctly (HTTP $RESPONSE)"
    ((ERRORS++))
fi

# Orders Service
print_info "Checking Orders Service..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/health 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
    print_success "Orders Service is responding on port 3003"
else
    print_warning "Orders Service may not be ready (HTTP $RESPONSE) - trying alternate endpoint..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/ 2>/dev/null || echo "000")
    if [ "$RESPONSE" != "000" ]; then
        print_success "Orders Service is responding"
    else
        print_error "Orders Service is not responding"
        ((ERRORS++))
    fi
fi

# Notifications Service
print_info "Checking Notifications Service..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/health 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
    print_success "Notifications Service is responding on port 3004"
else
    print_warning "Notifications Service may not be ready (HTTP $RESPONSE) - trying alternate endpoint..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/ 2>/dev/null || echo "000")
    if [ "$RESPONSE" != "000" ]; then
        print_success "Notifications Service is responding"
    else
        print_error "Notifications Service is not responding"
        ((ERRORS++))
    fi
fi

# Check RabbitMQ Management UI
print_info "Checking RabbitMQ Management UI..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:15672/ 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ]; then
    print_success "RabbitMQ Management UI is accessible at http://localhost:15672"
else
    print_warning "RabbitMQ Management UI is not responding (this is normal if still starting)"
fi

# Check connectivity between services
print_header "Checking connectivity between services"

# Check that services can connect to PostgreSQL
print_info "Checking services connection to PostgreSQL..."
SERVICES_WITH_DB=("users-service" "products-service" "orders-service")
for service in "${SERVICES_WITH_DB[@]}"; do
    # Try to execute a psql command inside the service container
    # This will verify that the service can resolve and connect to postgres
    if $COMPOSE_CMD exec -T $service sh -c "command -v nc" &> /dev/null; then
        if $COMPOSE_CMD exec -T $service nc -zv postgres 5432 &> /dev/null; then
            print_success "$service can connect to PostgreSQL"
        else
            print_warning "$service may have problems connecting to PostgreSQL"
        fi
    else
        print_info "$service: nc not available, skipping network check"
    fi
done

# Final summary
print_header "Validation summary"

if [ $ERRORS -eq 0 ]; then
    print_success "All services are working correctly"
    echo ""
    print_info "Access URLs:"
    echo "  - Users Service: http://localhost:3001"
    echo "  - Products Service: http://localhost:3002"
    echo "  - Orders Service: http://localhost:3003"
    echo "  - Notifications Service: http://localhost:3004"
    echo "  - RabbitMQ Management: http://localhost:15672 (admin/password)"
    echo ""
    print_info "You can test the complete flow by running:"
    echo "  ./test-flow.sh"
    echo ""
    exit 0
else
    print_error "Found $ERRORS error(s)"
    echo ""
    print_info "Useful commands for debugging:"
    echo "  - View container status:"
    echo "      docker-compose ps"
    echo "      podman-compose ps  (or podman compose ps)"
    echo "  - View logs of all services:"
    echo "      docker-compose logs"
    echo "      podman-compose logs  (or podman compose logs)"
    echo "  - View logs of a specific service:"
    echo "      docker-compose logs -f [service-name]"
    echo "      podman-compose logs -f [service-name]  (or podman compose logs -f [service-name])"
    echo "  - Restart services:"
    echo "      docker-compose restart"
    echo "      podman-compose restart  (or podman compose restart)"
    echo ""
    exit 1
fi
