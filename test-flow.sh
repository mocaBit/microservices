#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

BASE_URL="http://localhost"
USERS_PORT="3001"
PRODUCTS_PORT="3002"
ORDERS_PORT="3003"
NOTIFICATIONS_PORT="3004"

# Function to print colored output
print_step() {
    echo -e "${CYAN}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to check service health
check_service() {
    local service_name=$1
    local port=$2
    local endpoint=${3:-"/health"}
    
    echo -e "${YELLOW}Checking $service_name...${NC}"
    
    response=$(curl -s -w "%{http_code}" -o /tmp/health_check "$BASE_URL:$port$endpoint")
    
    if [ "$response" = "200" ]; then
        print_success "$service_name is healthy"
        return 0
    else
        print_error "$service_name is not responding (HTTP $response)"
        return 1
    fi
}

# Function to wait for services
wait_for_services() {
    print_step "Waiting for all services to be ready"
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        echo "Attempt $((attempt + 1))/$max_attempts"
        
        if check_service "Users Service" $USERS_PORT && \
           check_service "Products Service" $PRODUCTS_PORT && \
           check_service "Orders Service" $ORDERS_PORT && \
           check_service "Notifications Service" $NOTIFICATIONS_PORT; then
            print_success "All services are ready!"
            return 0
        fi
        
        echo "Waiting 5 seconds before next check..."
        sleep 5
        ((attempt++))
    done
    
    print_error "Services did not become ready within expected time"
    return 1
}

# Function to test user registration
test_user_registration() {
    print_step "Testing User Registration"
    
    local response=$(curl -s -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "testuser",
            "email": "test@example.com",
            "password": "TestPass123!",
            "full_name": "Test User"
        }' \
        -o /tmp/register_response \
        "$BASE_URL:$USERS_PORT/api/auth/register")
    
    if [ "$response" = "201" ]; then
        print_success "User registration successful"
        cat /tmp/register_response | jq '.'
        return 0
    else
        print_error "User registration failed (HTTP $response)"
        cat /tmp/register_response
        return 1
    fi
}

# Function to test user login
test_user_login() {
    print_step "Testing User Login"
    
    local response=$(curl -s -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test@example.com",
            "password": "TestPass123!"
        }' \
        -o /tmp/login_response \
        "$BASE_URL:$USERS_PORT/api/auth/login")
    
    if [ "$response" = "200" ]; then
        print_success "User login successful"
        cat /tmp/login_response | jq '.'
        
        # Extract token for future requests
        JWT_TOKEN=$(cat /tmp/login_response | jq -r '.token')
        USER_ID=$(cat /tmp/login_response | jq -r '.user.id')
        echo "JWT_TOKEN=$JWT_TOKEN" > /tmp/test_vars
        echo "USER_ID=$USER_ID" >> /tmp/test_vars
        print_info "JWT token and User ID saved for subsequent requests"
        return 0
    else
        print_error "User login failed (HTTP $response)"
        cat /tmp/login_response
        return 1
    fi
}

# Function to test products catalog
test_products_catalog() {
    print_step "Testing Products Catalog"
    
    local response=$(curl -s -w "%{http_code}" \
        -o /tmp/products_response \
        "$BASE_URL:$PRODUCTS_PORT/api/products?limit=5")
    
    if [ "$response" = "200" ]; then
        print_success "Products catalog retrieved successfully"
        cat /tmp/products_response | jq '.'
        return 0
    else
        print_error "Products catalog failed (HTTP $response)"
        cat /tmp/products_response
        return 1
    fi
}

# Function to seed products database
seed_products() {
    print_step "Seeding Products Database"
    
    print_info "Running products seed script..."
    docker exec e-commerce-products-service-1 npm run seed 2>/dev/null || \
    docker exec e-commerce_products-service_1 npm run seed 2>/dev/null || \
    print_warning "Could not run seed script via docker. Database might already be seeded."
    
    sleep 2
    print_success "Products seeding completed"
}

# Function to test order creation
test_order_creation() {
    print_step "Testing Order Creation"
    
    # Load test variables
    if [ -f /tmp/test_vars ]; then
        source /tmp/test_vars
    else
        print_error "No test variables found. Run user login first."
        return 1
    fi
    
    local response=$(curl -s -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -d '{
            "user_id": '$USER_ID',
            "items": [
                {
                    "product_id": 1,
                    "product_name": "Hamburguesa Clásica",
                    "price": 12.99,
                    "quantity": 2
                },
                {
                    "product_id": 14,
                    "product_name": "Coca Cola",
                    "price": 2.99,
                    "quantity": 1
                }
            ],
            "delivery_address": {
                "street": "123 Test Street",
                "city": "Test City", 
                "postal_code": "12345",
                "phone": "+1234567890"
            },
            "payment_method": "card",
            "notes": "Test order for flow validation"
        }' \
        -o /tmp/order_response \
        "$BASE_URL:$ORDERS_PORT/api/orders")
    
    if [ "$response" = "201" ]; then
        print_success "Order creation successful"
        cat /tmp/order_response | jq '.'
        
        # Save order ID for status updates
        ORDER_ID=$(cat /tmp/order_response | jq -r '.order.id')
        echo "ORDER_ID=$ORDER_ID" >> /tmp/test_vars
        return 0
    else
        print_error "Order creation failed (HTTP $response)"
        cat /tmp/order_response
        return 1
    fi
}

# Function to test order status update
test_order_status_update() {
    print_step "Testing Order Status Update"
    
    # Load test variables
    if [ -f /tmp/test_vars ]; then
        source /tmp/test_vars
    else
        print_error "No test variables found. Run order creation first."
        return 1
    fi
    
    local new_status=$1
    local notes=${2:-"Status updated via test script"}
    
    local response=$(curl -s -w "%{http_code}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -d '{
            "status": "'$new_status'",
            "notes": "'$notes'"
        }' \
        -o /tmp/status_response \
        "$BASE_URL:$ORDERS_PORT/api/orders/$ORDER_ID/status")
    
    if [ "$response" = "200" ]; then
        print_success "Order status updated to $new_status"
        cat /tmp/status_response | jq '.'
        return 0
    else
        print_error "Order status update failed (HTTP $response)"
        cat /tmp/status_response
        return 1
    fi
}

# Function to check notifications stats
check_notifications_stats() {
    print_step "Checking Notifications Service Stats"
    
    local response=$(curl -s -w "%{http_code}" \
        -o /tmp/notifications_stats \
        "$BASE_URL:$NOTIFICATIONS_PORT/api/notifications/stats")
    
    if [ "$response" = "200" ]; then
        print_success "Notifications stats retrieved"
        cat /tmp/notifications_stats | jq '.'
        return 0
    else
        print_error "Failed to get notifications stats (HTTP $response)"
        cat /tmp/notifications_stats
        return 1
    fi
}

# Function to check RabbitMQ management
check_rabbitmq_management() {
    print_step "Checking RabbitMQ Management Interface"
    
    print_info "RabbitMQ Management UI: http://localhost:15672"
    print_info "Username: admin, Password: password"
    
    # Check if RabbitMQ management is accessible
    local response=$(curl -s -w "%{http_code}" -u admin:password -o /tmp/rabbitmq_response "http://localhost:15672/api/overview")
    
    if [ "$response" = "200" ]; then
        print_success "RabbitMQ Management API is accessible"
        return 0
    else
        print_warning "RabbitMQ Management API not accessible (HTTP $response)"
        return 1
    fi
}

# Main test flow
run_complete_flow() {
    print_step "🚀 Starting Complete E-commerce Flow Test"
    
    echo -e "${PURPLE}"
    echo "This script will test the complete flow:"
    echo "1. User Registration"
    echo "2. User Login" 
    echo "3. Products Catalog"
    echo "4. Order Creation"
    echo "5. Order Status Updates"
    echo "6. Notifications Verification"
    echo "7. RabbitMQ Event Monitoring"
    echo -e "${NC}"
    
    # Wait for services
    if ! wait_for_services; then
        print_error "Services are not ready. Please check docker-compose logs."
        exit 1
    fi
    
    # Seed products
    seed_products
    
    # Test user registration
    if ! test_user_registration; then
        print_warning "Registration failed, but this might be expected if user already exists"
    fi
    
    # Test user login
    if ! test_user_login; then
        print_error "Login failed. Cannot continue with flow."
        exit 1
    fi
    
    # Test products catalog
    if ! test_products_catalog; then
        print_error "Products catalog failed. Cannot continue with flow."
        exit 1
    fi
    
    # Test order creation (this should trigger RabbitMQ events)
    print_step "🛒 Creating Order (This will trigger RabbitMQ events!)"
    if ! test_order_creation; then
        print_error "Order creation failed. Cannot continue with flow."
        exit 1
    fi
    
    print_info "⏱️  Waiting 5 seconds for RabbitMQ events to be processed..."
    sleep 5
    
    # Test order status updates (more RabbitMQ events)
    print_step "📈 Testing Order Status Updates (More RabbitMQ events!)"
    test_order_status_update "confirmed" "Order confirmed and payment processed"
    sleep 3
    
    test_order_status_update "preparing" "Kitchen started preparing your order"
    sleep 3
    
    test_order_status_update "out_for_delivery" "Order is on the way!"
    sleep 3
    
    test_order_status_update "delivered" "Order delivered successfully!"
    sleep 3
    
    # Check notifications stats
    check_notifications_stats
    
    # Check RabbitMQ
    check_rabbitmq_management
    
    print_step "🎉 Complete Flow Test Finished!"
    print_success "Check the docker logs to see RabbitMQ events and notifications:"
    echo ""
    print_info "To see notifications service logs:"
    echo "docker logs -f e-commerce-notifications-service-1"
    echo ""
    print_info "To see orders service logs:" 
    echo "docker logs -f e-commerce-orders-service-1"
    echo ""
    print_info "To see RabbitMQ Management UI:"
    echo "http://localhost:15672 (admin/password)"
}

# Handle command line arguments
case ${1:-full} in
    "services")
        wait_for_services
        ;;
    "register")
        test_user_registration
        ;;
    "login")
        test_user_login
        ;;
    "products")
        test_products_catalog
        ;;
    "order")
        test_order_creation
        ;;
    "status")
        test_order_status_update ${2:-confirmed} ${3:-"Status update test"}
        ;;
    "notifications")
        check_notifications_stats
        ;;
    "rabbitmq")
        check_rabbitmq_management
        ;;
    "full"|*)
        run_complete_flow
        ;;
esac