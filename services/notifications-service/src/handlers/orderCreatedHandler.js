const notificationService = require('../services/notificationService');
require('colors');

class OrderCreatedHandler {
  async handle(event) {
    try {
      console.log(`🎯 Processing OrderCreated event: ${event.eventId}`.cyan);
      
      // Validate event structure
      if (!this.validateEvent(event)) {
        throw new Error('Invalid OrderCreated event structure');
      }

      const { data } = event;
      
      // Extract notification data
      const orderData = {
        orderId: data.orderId,
        userId: data.userId,
        totalAmount: data.totalAmount,
        items: data.items,
        deliveryAddress: data.deliveryAddress,
        paymentMethod: data.paymentMethod,
        createdAt: data.createdAt
      };

      // Send notification
      const result = await notificationService.sendOrderCreatedNotification(orderData);
      
      if (result.success) {
        console.log(`✅ OrderCreated notification sent successfully for order ${data.orderId}`.green);
        this.logEventMetrics(event, 'success');
      } else {
        console.log(`⚠️ OrderCreated notification partially failed for order ${data.orderId}`.yellow);
        console.log('Results:', result.results);
        this.logEventMetrics(event, 'partial_failure');
      }

      return result;

    } catch (error) {
      console.error(`❌ Error handling OrderCreated event ${event.eventId}:`.red, error);
      this.logEventMetrics(event, 'error', error.message);
      throw error;
    }
  }

  validateEvent(event) {
    // Validate basic event structure
    if (!event || typeof event !== 'object') {
      console.error('❌ Event is not a valid object'.red);
      return false;
    }

    // Validate event metadata
    if (!event.eventId || !event.eventType || !event.timestamp) {
      console.error('❌ Event missing required metadata (eventId, eventType, timestamp)'.red);
      return false;
    }

    // Validate event type
    if (event.eventType !== 'OrderCreated') {
      console.error(`❌ Invalid event type: ${event.eventType}, expected: OrderCreated`.red);
      return false;
    }

    // Validate event data
    if (!event.data) {
      console.error('❌ Event missing data property'.red);
      return false;
    }

    const { data } = event;

    // Validate required order data
    const requiredFields = ['orderId', 'userId', 'totalAmount', 'items', 'deliveryAddress'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      console.error(`❌ Event data missing required fields: ${missingFields.join(', ')}`.red);
      return false;
    }

    // Validate items array
    if (!Array.isArray(data.items) || data.items.length === 0) {
      console.error('❌ Event data items must be a non-empty array'.red);
      return false;
    }

    // Validate delivery address
    if (!data.deliveryAddress.street || !data.deliveryAddress.city) {
      console.error('❌ Event data delivery address missing required fields (street, city)'.red);
      return false;
    }

    return true;
  }

  logEventMetrics(event, status, error = null) {
    const logData = {
      eventId: event.eventId,
      eventType: event.eventType,
      orderId: event.data?.orderId,
      userId: event.data?.userId,
      status,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - new Date(event.timestamp).getTime()
    };

    if (error) {
      logData.error = error;
    }

    console.log(`📊 Event Metrics:`.gray, JSON.stringify(logData, null, 2));
  }

  // Get handler statistics
  getStats() {
    return {
      handlerType: 'OrderCreated',
      description: 'Handles order creation events and sends notifications',
      supportedEventTypes: ['OrderCreated'],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new OrderCreatedHandler();