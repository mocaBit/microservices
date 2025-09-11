const notificationService = require('../services/notificationService');
require('colors');

class OrderStatusUpdatedHandler {
  async handle(event) {
    try {
      console.log(`🎯 Processing OrderStatusUpdated event: ${event.eventId}`.cyan);
      
      // Validate event structure
      if (!this.validateEvent(event)) {
        throw new Error('Invalid OrderStatusUpdated event structure');
      }

      const { data } = event;
      
      // Check if we should send notification for this status change
      if (!this.shouldNotifyStatusChange(data.previousStatus, data.currentStatus)) {
        console.log(`ℹ️ Skipping notification for status change: ${data.previousStatus} -> ${data.currentStatus}`.gray);
        return { success: true, skipped: true };
      }

      // Extract notification data
      const orderData = {
        orderId: data.orderId,
        userId: data.userId,
        currentStatus: data.currentStatus,
        previousStatus: data.previousStatus,
        totalAmount: data.totalAmount,
        notes: data.notes,
        updatedAt: data.updatedAt
      };

      // Send notification
      const result = await notificationService.sendOrderStatusUpdatedNotification(orderData);
      
      if (result.success) {
        console.log(`✅ OrderStatusUpdated notification sent successfully for order ${data.orderId}`.green);
        this.logEventMetrics(event, 'success');
      } else {
        console.log(`⚠️ OrderStatusUpdated notification partially failed for order ${data.orderId}`.yellow);
        console.log('Results:', result.results);
        this.logEventMetrics(event, 'partial_failure');
      }

      return result;

    } catch (error) {
      console.error(`❌ Error handling OrderStatusUpdated event ${event.eventId}:`.red, error);
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
    if (event.eventType !== 'OrderStatusUpdated') {
      console.error(`❌ Invalid event type: ${event.eventType}, expected: OrderStatusUpdated`.red);
      return false;
    }

    // Validate event data
    if (!event.data) {
      console.error('❌ Event missing data property'.red);
      return false;
    }

    const { data } = event;

    // Validate required order data
    const requiredFields = ['orderId', 'userId', 'currentStatus', 'previousStatus'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      console.error(`❌ Event data missing required fields: ${missingFields.join(', ')}`.red);
      return false;
    }

    // Validate status values
    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(data.currentStatus)) {
      console.error(`❌ Invalid current status: ${data.currentStatus}`.red);
      return false;
    }

    if (!validStatuses.includes(data.previousStatus)) {
      console.error(`❌ Invalid previous status: ${data.previousStatus}`.red);
      return false;
    }

    return true;
  }

  shouldNotifyStatusChange(previousStatus, currentStatus) {
    // Define status changes that should trigger notifications
    const notifiableChanges = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['out_for_delivery', 'cancelled'],
      'out_for_delivery': ['delivered', 'cancelled']
    };

    // Always notify if order is delivered or cancelled
    if (currentStatus === 'delivered' || currentStatus === 'cancelled') {
      return true;
    }

    // Check if this is a notifiable status change
    const allowedNextStatuses = notifiableChanges[previousStatus] || [];
    return allowedNextStatuses.includes(currentStatus);
  }

  logEventMetrics(event, status, error = null) {
    const logData = {
      eventId: event.eventId,
      eventType: event.eventType,
      orderId: event.data?.orderId,
      userId: event.data?.userId,
      statusChange: event.data ? `${event.data.previousStatus} -> ${event.data.currentStatus}` : 'unknown',
      status,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - new Date(event.timestamp).getTime()
    };

    if (error) {
      logData.error = error;
    }

    console.log(`📊 Event Metrics:`.gray, JSON.stringify(logData, null, 2));
  }

  // Get notification rules for status changes
  getNotificationRules() {
    return {
      'pending -> confirmed': 'Always notify - Order confirmed',
      'confirmed -> preparing': 'Always notify - Preparation started',
      'preparing -> out_for_delivery': 'Always notify - Order shipped',
      'out_for_delivery -> delivered': 'Always notify - Order delivered',
      '* -> cancelled': 'Always notify - Order cancelled',
      'other changes': 'Skip notification - Internal status changes'
    };
  }

  // Get handler statistics
  getStats() {
    return {
      handlerType: 'OrderStatusUpdated',
      description: 'Handles order status change events and sends notifications',
      supportedEventTypes: ['OrderStatusUpdated'],
      notificationRules: this.getNotificationRules(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new OrderStatusUpdatedHandler();