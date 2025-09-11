#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

RABBITMQ_HOST="localhost:15672"
RABBITMQ_USER="admin"
RABBITMQ_PASS="password"

print_header() {
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

# Function to check RabbitMQ connection
check_rabbitmq() {
    print_header "RabbitMQ Connection Status"
    
    local response=$(curl -s -w "%{http_code}" -u $RABBITMQ_USER:$RABBITMQ_PASS -o /tmp/rabbitmq_overview "http://$RABBITMQ_HOST/api/overview")
    
    if [ "$response" = "200" ]; then
        print_success "RabbitMQ is accessible"
        local version=$(cat /tmp/rabbitmq_overview | jq -r '.rabbitmq_version')
        local erlang_version=$(cat /tmp/rabbitmq_overview | jq -r '.erlang_version')
        print_info "RabbitMQ Version: $version"
        print_info "Erlang Version: $erlang_version"
        return 0
    else
        print_error "Cannot connect to RabbitMQ Management API (HTTP $response)"
        return 1
    fi
}

# Function to list exchanges
list_exchanges() {
    print_header "RabbitMQ Exchanges"
    
    local response=$(curl -s -w "%{http_code}" -u $RABBITMQ_USER:$RABBITMQ_PASS -o /tmp/exchanges "http://$RABBITMQ_HOST/api/exchanges")
    
    if [ "$response" = "200" ]; then
        echo "Exchange Name | Type | Durable | Messages In | Messages Out"
        echo "--------------|------|---------|-------------|-------------"
        cat /tmp/exchanges | jq -r '.[] | select(.name != "") | "\(.name) | \(.type) | \(.durable) | \(.message_stats.publish_in // 0) | \(.message_stats.publish_out // 0)"'
    else
        print_error "Failed to get exchanges (HTTP $response)"
    fi
}

# Function to list queues
list_queues() {
    print_header "RabbitMQ Queues"
    
    local response=$(curl -s -w "%{http_code}" -u $RABBITMQ_USER:$RABBITMQ_PASS -o /tmp/queues "http://$RABBITMQ_HOST/api/queues")
    
    if [ "$response" = "200" ]; then
        echo "Queue Name | Messages | Consumers | State"
        echo "-----------|----------|-----------|------"
        cat /tmp/queues | jq -r '.[] | "\(.name) | \(.messages) | \(.consumers) | \(.state)"'
        
        # Show detailed stats for our specific queues
        echo ""
        print_info "Detailed stats for e-commerce queues:"
        cat /tmp/queues | jq '.[] | select(.name | contains("order")) | {name: .name, messages: .messages, consumers: .consumers, message_stats: .message_stats}'
    else
        print_error "Failed to get queues (HTTP $response)"
    fi
}

# Function to show connections
list_connections() {
    print_header "RabbitMQ Connections"
    
    local response=$(curl -s -w "%{http_code}" -u $RABBITMQ_USER:$RABBITMQ_PASS -o /tmp/connections "http://$RABBITMQ_HOST/api/connections")
    
    if [ "$response" = "200" ]; then
        local connection_count=$(cat /tmp/connections | jq '. | length')
        print_info "Total connections: $connection_count"
        
        if [ "$connection_count" -gt 0 ]; then
            echo ""
            echo "Connection Name | State | Client Properties"
            echo "----------------|-------|------------------"
            cat /tmp/connections | jq -r '.[] | "\(.name) | \(.state) | \(.client_properties.connection_name // "N/A")"'
        fi
    else
        print_error "Failed to get connections (HTTP $response)"
    fi
}

# Function to show channels
list_channels() {
    print_header "RabbitMQ Channels"
    
    local response=$(curl -s -w "%{http_code}" -u $RABBITMQ_USER:$RABBITMQ_PASS -o /tmp/channels "http://$RABBITMQ_HOST/api/channels")
    
    if [ "$response" = "200" ]; then
        local channel_count=$(cat /tmp/channels | jq '. | length')
        print_info "Total channels: $channel_count"
        
        if [ "$channel_count" -gt 0 ]; then
            echo ""
            echo "Channel | Connection | State | Messages"
            echo "--------|------------|-------|----------"
            cat /tmp/channels | jq -r '.[] | "\(.name) | \(.connection_details.name) | \(.state) | \(.message_stats.publish // 0)"'
        fi
    else
        print_error "Failed to get channels (HTTP $response)"
    fi
}

# Function to monitor queue activity in real-time
monitor_queues() {
    print_header "Real-time Queue Monitoring"
    print_info "Press Ctrl+C to stop monitoring"
    
    while true; do
        clear
        echo -e "${YELLOW}🐰 RabbitMQ Queue Activity - $(date)${NC}"
        echo ""
        
        local response=$(curl -s -u $RABBITMQ_USER:$RABBITMQ_PASS "http://$RABBITMQ_HOST/api/queues")
        
        if [ $? -eq 0 ]; then
            echo "Queue Name | Messages | Rate In/s | Rate Out/s | Consumers"
            echo "-----------|----------|-----------|------------|----------"
            echo "$response" | jq -r '.[] | "\(.name) | \(.messages) | \(.message_stats.publish_details.rate // 0) | \(.message_stats.deliver_get_details.rate // 0) | \(.consumers)"'
        else
            print_error "Failed to fetch queue data"
        fi
        
        sleep 2
    done
}

# Function to test message publishing
test_publish() {
    print_header "Testing Message Publishing"
    
    print_info "This will publish a test message to the orders.events exchange"
    
    local test_message='{
        "eventType": "TestEvent",
        "eventId": "test-'$(date +%s)'",
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "version": "1.0",
        "data": {
            "test": true,
            "message": "This is a test message from monitor script"
        }
    }'
    
    local response=$(curl -s -w "%{http_code}" \
        -u $RABBITMQ_USER:$RABBITMQ_PASS \
        -H "Content-Type: application/json" \
        -d '{
            "properties": {},
            "routing_key": "test.event",
            "payload": "'"$(echo $test_message | sed 's/"/\\"/g')"'",
            "payload_encoding": "string"
        }' \
        -o /tmp/publish_response \
        "http://$RABBITMQ_HOST/api/exchanges/%2F/orders.events/publish")
    
    if [ "$response" = "200" ]; then
        local result=$(cat /tmp/publish_response | jq -r '.routed')
        if [ "$result" = "true" ]; then
            print_success "Test message published successfully"
        else
            print_error "Message was published but not routed to any queue"
        fi
    else
        print_error "Failed to publish test message (HTTP $response)"
        cat /tmp/publish_response
    fi
}

# Function to show complete RabbitMQ overview
show_overview() {
    print_header "🐰 RabbitMQ Complete Overview"
    
    check_rabbitmq
    echo ""
    list_exchanges
    echo ""
    list_queues
    echo ""
    list_connections
    echo ""
    list_channels
    
    echo ""
    print_info "RabbitMQ Management UI: http://localhost:15672"
    print_info "Username: $RABBITMQ_USER"
    print_info "Password: $RABBITMQ_PASS"
}

# Function to show help
show_help() {
    echo -e "${CYAN}RabbitMQ Monitor Script${NC}"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  overview    - Show complete RabbitMQ overview (default)"
    echo "  exchanges   - List all exchanges"
    echo "  queues      - List all queues with stats"
    echo "  connections - Show active connections"
    echo "  channels    - Show active channels"
    echo "  monitor     - Real-time queue monitoring"
    echo "  test        - Publish a test message"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Show complete overview"
    echo "  $0 monitor            # Start real-time monitoring"
    echo "  $0 queues             # Show queue statistics"
    echo "  $0 test               # Publish test message"
}

# Handle command line arguments
case ${1:-overview} in
    "exchanges")
        check_rabbitmq && list_exchanges
        ;;
    "queues")
        check_rabbitmq && list_queues
        ;;
    "connections")
        check_rabbitmq && list_connections
        ;;
    "channels")
        check_rabbitmq && list_channels
        ;;
    "monitor")
        monitor_queues
        ;;
    "test")
        check_rabbitmq && test_publish
        ;;
    "help")
        show_help
        ;;
    "overview"|*)
        show_overview
        ;;
esac