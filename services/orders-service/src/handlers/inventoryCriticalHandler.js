class InventoryCriticalHandler {
  async handle(message) {
    try {
      const event = JSON.parse(message.content.toString());
      console.log('Received inventory critical event:', event);

      if (event.eventType !== 'inventory.critical') {
        console.warn('Unexpected event type:', event.eventType);
        return;
      }

      const { productId, currentStock } = event;

      if (currentStock === 0) {
        console.log(`Product ${productId} is out of stock. Implementing order restrictions...`);
        
        await this.suspendProductOrders(productId);
        await this.cancelPendingOrders(productId);
        
      } else if (currentStock <= 2) {
        console.log(`Product ${productId} has critically low stock (${currentStock} units). Limiting orders...`);
        
        await this.limitProductOrders(productId, currentStock);
      }

      console.log(`Orders service has processed inventory critical event for product ${productId}`);

    } catch (error) {
      console.error('Error handling inventory critical event:', error);
      throw error;
    }
  }

  async suspendProductOrders(productId) {
    console.log(`🚫 Suspending all new orders for product ${productId}`);
    
    // In a real implementation, this would:
    // 1. Add the product to a "suspended orders" list in Redis/database
    // 2. Update order validation logic to reject new orders for this product
    // 3. Notify the frontend to hide/disable the buy button for this product
  }

  async cancelPendingOrders(productId) {
    console.log(`❌ Canceling pending orders for out-of-stock product ${productId}`);
    
    // In a real implementation, this would:
    // 1. Find all pending orders containing this product
    // 2. Cancel those orders or remove the product from multi-product orders
    // 3. Refund customers for canceled items
    // 4. Send cancellation notifications
  }

  async limitProductOrders(productId, maxAllowed) {
    console.log(`⚠️ Limiting orders for product ${productId} to maximum ${maxAllowed} units per order`);
    
    // In a real implementation, this would:
    // 1. Set quantity limits in Redis/database for this product
    // 2. Update order validation to enforce these limits
    // 3. Notify frontend to show stock warnings and limit quantity selectors
  }
}

module.exports = new InventoryCriticalHandler();