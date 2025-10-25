#!/bin/bash

# Script para validar que todos los servicios están corriendo y funcionando correctamente
# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
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

# Contador de errores
ERRORS=0

# Validar que Docker Compose está instalado
print_header "Verificando Docker Compose"
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose no está instalado"
    exit 1
fi
print_success "Docker Compose está instalado"

# Verificar que los contenedores están corriendo
print_header "Verificando contenedores Docker"

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
    # Buscar el contenedor por nombre (puede tener prefijo del directorio)
    CONTAINER_STATUS=$(docker-compose ps -q $container 2>/dev/null | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null)

    if [ "$CONTAINER_STATUS" = "running" ]; then
        print_success "Contenedor $container está corriendo"
    else
        print_error "Contenedor $container NO está corriendo (Estado: ${CONTAINER_STATUS:-no encontrado})"
        ((ERRORS++))
    fi
done

# Verificar healthchecks de infraestructura
print_header "Verificando health checks de infraestructura"

# PostgreSQL
print_info "Verificando PostgreSQL..."
if docker-compose exec -T postgres pg_isready -U postgres -d ecommerce &> /dev/null; then
    print_success "PostgreSQL está listo y aceptando conexiones"
else
    print_error "PostgreSQL no está respondiendo"
    ((ERRORS++))
fi

# Redis
print_info "Verificando Redis..."
if docker-compose exec -T redis redis-cli ping &> /dev/null; then
    print_success "Redis está respondiendo"
else
    print_error "Redis no está respondiendo"
    ((ERRORS++))
fi

# RabbitMQ
print_info "Verificando RabbitMQ..."
if docker-compose exec -T rabbitmq rabbitmq-diagnostics ping &> /dev/null; then
    print_success "RabbitMQ está respondiendo"
else
    print_error "RabbitMQ no está respondiendo"
    ((ERRORS++))
fi

# Verificar servicios HTTP
print_header "Verificando endpoints HTTP de servicios"

# Esperar un poco para que los servicios inicien
sleep 2

# Users Service
print_info "Verificando Users Service..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
    print_success "Users Service está respondiendo en puerto 3001"
else
    print_warning "Users Service puede no estar listo (HTTP $RESPONSE) - probando endpoint alternativo..."
    # Intentar con otro endpoint
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null || echo "000")
    if [ "$RESPONSE" != "000" ]; then
        print_success "Users Service está respondiendo"
    else
        print_error "Users Service no está respondiendo"
        ((ERRORS++))
    fi
fi

# Products Service
print_info "Verificando Products Service..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/products 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ]; then
    print_success "Products Service está respondiendo en puerto 3002"
    # Verificar que tiene productos
    PRODUCTS=$(curl -s http://localhost:3002/products 2>/dev/null)
    if [ ! -z "$PRODUCTS" ]; then
        print_success "Products Service tiene datos disponibles"
    fi
elif [ "$RESPONSE" = "404" ]; then
    print_warning "Products Service responde pero endpoint /products retorna 404"
else
    print_error "Products Service no está respondiendo correctamente (HTTP $RESPONSE)"
    ((ERRORS++))
fi

# Orders Service
print_info "Verificando Orders Service..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/health 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
    print_success "Orders Service está respondiendo en puerto 3003"
else
    print_warning "Orders Service puede no estar listo (HTTP $RESPONSE) - probando endpoint alternativo..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/ 2>/dev/null || echo "000")
    if [ "$RESPONSE" != "000" ]; then
        print_success "Orders Service está respondiendo"
    else
        print_error "Orders Service no está respondiendo"
        ((ERRORS++))
    fi
fi

# Notifications Service
print_info "Verificando Notifications Service..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/health 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
    print_success "Notifications Service está respondiendo en puerto 3004"
else
    print_warning "Notifications Service puede no estar listo (HTTP $RESPONSE) - probando endpoint alternativo..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/ 2>/dev/null || echo "000")
    if [ "$RESPONSE" != "000" ]; then
        print_success "Notifications Service está respondiendo"
    else
        print_error "Notifications Service no está respondiendo"
        ((ERRORS++))
    fi
fi

# Verificar RabbitMQ Management UI
print_info "Verificando RabbitMQ Management UI..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:15672/ 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ]; then
    print_success "RabbitMQ Management UI está accesible en http://localhost:15672"
else
    print_warning "RabbitMQ Management UI no está respondiendo (esto es normal si aún está iniciando)"
fi

# Verificar conexiones entre servicios
print_header "Verificando conectividad entre servicios"

# Verificar que los servicios pueden conectarse a PostgreSQL
print_info "Verificando conexión de servicios a PostgreSQL..."
SERVICES_WITH_DB=("users-service" "products-service" "orders-service")
for service in "${SERVICES_WITH_DB[@]}"; do
    # Intentar ejecutar un comando psql dentro del contenedor del servicio
    # Esto verificará que el servicio puede resolver y conectarse a postgres
    if docker-compose exec -T $service sh -c "command -v nc" &> /dev/null; then
        if docker-compose exec -T $service nc -zv postgres 5432 &> /dev/null; then
            print_success "$service puede conectarse a PostgreSQL"
        else
            print_warning "$service puede tener problemas conectándose a PostgreSQL"
        fi
    else
        print_info "$service: nc no disponible, saltando verificación de red"
    fi
done

# Resumen final
print_header "Resumen de validación"

if [ $ERRORS -eq 0 ]; then
    print_success "Todos los servicios están funcionando correctamente"
    echo ""
    print_info "URLs de acceso:"
    echo "  - Users Service: http://localhost:3001"
    echo "  - Products Service: http://localhost:3002"
    echo "  - Orders Service: http://localhost:3003"
    echo "  - Notifications Service: http://localhost:3004"
    echo "  - RabbitMQ Management: http://localhost:15672 (admin/password)"
    echo ""
    print_info "Puedes probar el flujo completo ejecutando:"
    echo "  ./test-flow.sh"
    echo ""
    exit 0
else
    print_error "Se encontraron $ERRORS error(es)"
    echo ""
    print_info "Comandos útiles para debug:"
    echo "  - Ver estado de contenedores: docker-compose ps"
    echo "  - Ver logs de todos los servicios: docker-compose logs"
    echo "  - Ver logs de un servicio: docker-compose logs -f [nombre-servicio]"
    echo "  - Reiniciar servicios: docker-compose restart"
    echo ""
    exit 1
fi
