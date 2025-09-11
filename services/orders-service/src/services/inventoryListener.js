const { getChannel } = require('../config/rabbitmq');
const inventoryCriticalHandler = require('../handlers/inventoryCriticalHandler');

class InventoryListener {
  constructor() {
    this.channel = null;
    this.queueName = 'inventory.critical.orders';
  }

  async start() {
    try {
      this.channel = getChannel();
      console.log('Starting inventory critical listener...');

      await this.channel.consume(this.queueName, async (message) => {
        if (message) {
          try {
            console.log('📥 Received inventory critical event in orders service');
            
            await inventoryCriticalHandler.handle(message);
            
            this.channel.ack(message);
            console.log('✅ Inventory critical event processed by orders service');
            
          } catch (error) {
            console.error('❌ Error processing inventory critical event in orders service:', error);
            
            if (this.shouldRetry(error)) {
              this.channel.nack(message, false, true);
              console.log('🔄 Message requeued for retry');
            } else {
              this.channel.nack(message, false, false);
              console.log('❌ Message rejected permanently');
            }
          }
        }
      }, {
        noAck: false
      });

      console.log('✅ Inventory critical listener started successfully');

    } catch (error) {
      console.error('❌ Failed to start inventory critical listener:', error);
      throw error;
    }
  }

  shouldRetry(error) {
    const transientErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN'
    ];
    
    return transientErrors.some(errCode => 
      error.code === errCode || error.message.includes(errCode)
    );
  }

  async stop() {
    try {
      if (this.channel) {
        await this.channel.cancel();
        console.log('Inventory critical listener stopped');
      }
    } catch (error) {
      console.error('Error stopping inventory critical listener:', error);
    }
  }
}

module.exports = new InventoryListener();