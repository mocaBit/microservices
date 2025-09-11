const notificationService = require('../services/notificationService');

class InventoryCriticalHandler {
  async handle(message) {
    try {
      const event = JSON.parse(message.content.toString());
      console.log('Received inventory critical event:', event);

      if (event.eventType !== 'inventory.critical') {
        console.warn('Unexpected event type:', event.eventType);
        return;
      }

      const { productId, currentStock, criticalLevel } = event;

      const emailSubject = `⚠️ Critical Inventory Alert - Product ${productId}`;
      const emailBody = `
        CRITICAL INVENTORY ALERT
        
        Product ID: ${productId}
        Current Stock: ${currentStock}
        Critical Level: ${criticalLevel}
        Timestamp: ${event.timestamp}
        
        Immediate action required:
        1. Check product availability
        2. Contact suppliers for restock
        3. Consider suspending sales if stock is zero
        
        This is an automated alert from the e-commerce inventory system.
      `;

      await notificationService.sendEmail({
        to: 'admin@ecommerce.com',
        subject: emailSubject,
        body: emailBody
      });

      await notificationService.sendEmail({
        to: 'inventory@ecommerce.com',
        subject: emailSubject,
        body: emailBody
      });

      const smsMessage = `CRITICAL: Product ${productId} low stock (${currentStock} units). Immediate action required.`;
      
      await notificationService.sendSMS({
        to: '+1234567890',
        message: smsMessage
      });

      console.log(`Critical inventory notifications sent for product ${productId}`);

    } catch (error) {
      console.error('Error handling inventory critical event:', error);
      throw error;
    }
  }
}

module.exports = new InventoryCriticalHandler();