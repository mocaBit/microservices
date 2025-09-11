const amqp = require('amqplib');

class InventoryPublisher {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.exchangeName = 'inventory.critical';
  }

  async connect() {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:password@rabbitmq:5672');
      this.channel = await this.connection.createChannel();
      
      await this.channel.assertExchange(this.exchangeName, 'fanout', {
        durable: true
      });
      
      console.log('Connected to RabbitMQ for inventory publisher');
    } catch (error) {
      console.error('Error connecting to RabbitMQ:', error);
      throw error;
    }
  }

  async publishCriticalInventory(productId, currentStock, criticalLevel) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      const event = {
        eventType: 'inventory.critical',
        productId: productId.toString(),
        currentStock,
        criticalLevel,
        timestamp: new Date().toISOString(),
        source: 'products-service'
      };

      const message = Buffer.from(JSON.stringify(event));
      
      const published = this.channel.publish(
        this.exchangeName,
        '', // routing key is ignored in fanout exchange
        message,
        {
          persistent: true,
          messageId: `inventory-critical-${productId}-${Date.now()}`
        }
      );

      if (published) {
        console.log(`Published critical inventory event for product ${productId}:`, event);
      }

      return published;
    } catch (error) {
      console.error('Error publishing critical inventory event:', error);
      throw error;
    }
  }

  async checkInventoryLevel(productId, currentStock) {
    const criticalLevel = 5; // This could be configurable per product
    
    if (currentStock <= criticalLevel) {
      await this.publishCriticalInventory(productId, currentStock, criticalLevel);
      return true;
    }
    
    return false;
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('Inventory publisher connection closed');
    } catch (error) {
      console.error('Error closing inventory publisher connection:', error);
    }
  }
}

module.exports = new InventoryPublisher();