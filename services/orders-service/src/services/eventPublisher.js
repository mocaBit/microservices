const { getChannel, EXCHANGES, ROUTING_KEYS, isConnected } = require('../config/rabbitmq');

class EventPublisher {
  async publishOrderCreated(order) {
    try {
      if (!isConnected()) {
        console.warn('RabbitMQ not connected, skipping event publication');
        return false;
      }

      const channel = getChannel();
      
      const event = {
        eventType: 'OrderCreated',
        eventId: `order-created-${order.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
          orderId: order.id,
          userId: order.user_id,
          status: order.status,
          totalAmount: order.total_amount,
          items: order.items,
          deliveryAddress: order.delivery_address,
          paymentMethod: order.payment_method,
          createdAt: order.created_at
        }
      };

      const message = Buffer.from(JSON.stringify(event));
      
      const published = channel.publish(
        EXCHANGES.ORDERS,
        ROUTING_KEYS.ORDER_CREATED,
        message,
        {
          persistent: true,
          messageId: event.eventId,
          timestamp: Date.now(),
          contentType: 'application/json'
        }
      );

      if (published) {
        console.log(`Published OrderCreated event for order ${order.id}`);
        return true;
      } else {
        console.warn(`Failed to publish OrderCreated event for order ${order.id}`);
        return false;
      }

    } catch (error) {
      console.error('Error publishing OrderCreated event:', error);
      return false;
    }
  }

  async publishOrderStatusUpdated(order, previousStatus, notes = null) {
    try {
      if (!isConnected()) {
        console.warn('RabbitMQ not connected, skipping event publication');
        return false;
      }

      const channel = getChannel();
      
      const event = {
        eventType: 'OrderStatusUpdated',
        eventId: `order-status-updated-${order.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
          orderId: order.id,
          userId: order.user_id,
          previousStatus,
          currentStatus: order.status,
          totalAmount: order.total_amount,
          notes,
          updatedAt: order.updated_at
        }
      };

      const message = Buffer.from(JSON.stringify(event));
      
      const published = channel.publish(
        EXCHANGES.ORDERS,
        ROUTING_KEYS.ORDER_STATUS_UPDATED,
        message,
        {
          persistent: true,
          messageId: event.eventId,
          timestamp: Date.now(),
          contentType: 'application/json'
        }
      );

      if (published) {
        console.log(`Published OrderStatusUpdated event for order ${order.id} (${previousStatus} -> ${order.status})`);
        return true;
      } else {
        console.warn(`Failed to publish OrderStatusUpdated event for order ${order.id}`);
        return false;
      }

    } catch (error) {
      console.error('Error publishing OrderStatusUpdated event:', error);
      return false;
    }
  }

  async publishCustomEvent(eventType, routingKey, data) {
    try {
      if (!isConnected()) {
        console.warn('RabbitMQ not connected, skipping event publication');
        return false;
      }

      const channel = getChannel();
      
      const event = {
        eventType,
        eventId: `${eventType.toLowerCase()}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        version: '1.0',
        data
      };

      const message = Buffer.from(JSON.stringify(event));
      
      const published = channel.publish(
        EXCHANGES.ORDERS,
        routingKey,
        message,
        {
          persistent: true,
          messageId: event.eventId,
          timestamp: Date.now(),
          contentType: 'application/json'
        }
      );

      if (published) {
        console.log(`Published ${eventType} event with routing key ${routingKey}`);
        return true;
      } else {
        console.warn(`Failed to publish ${eventType} event`);
        return false;
      }

    } catch (error) {
      console.error(`Error publishing ${eventType} event:`, error);
      return false;
    }
  }

  async healthCheck() {
    try {
      if (!isConnected()) {
        return {
          status: 'disconnected',
          error: 'RabbitMQ not connected',
          timestamp: new Date().toISOString()
        };
      }

      // Try to get channel info (this will throw if channel is closed)
      const channel = getChannel();
      
      return {
        status: 'connected',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
module.exports = new EventPublisher();