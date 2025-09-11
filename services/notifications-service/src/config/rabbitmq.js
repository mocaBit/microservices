const amqp = require('amqplib');
require('colors');

const orderCreatedHandler = require('../handlers/orderCreatedHandler');
const orderStatusUpdatedHandler = require('../handlers/orderStatusUpdatedHandler');

let connection = null;
let channel = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';

// Exchange and queue configurations
const EXCHANGES = {
  ORDERS: 'orders.events'
};

const QUEUES = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_UPDATED: 'order.status.updated'
};

const ROUTING_KEYS = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_UPDATED: 'order.status.updated'
};

const connectRabbitMQ = async () => {
  try {
    console.log('🔌 Connecting to RabbitMQ...'.yellow);
    connection = await amqp.connect(RABBITMQ_URL);
    
    // Handle connection events
    connection.on('error', (error) => {
      console.error('❌ RabbitMQ connection error:'.red, error);
    });

    connection.on('close', () => {
      console.log('🔌 RabbitMQ connection closed'.yellow);
      connection = null;
      channel = null;
    });

    // Create channel
    channel = await connection.createChannel();
    
    // Handle channel events
    channel.on('error', (error) => {
      console.error('❌ RabbitMQ channel error:'.red, error);
    });

    // Set prefetch count for fair dispatching
    await channel.prefetch(1);

    // Declare exchanges (idempotent operation)
    await channel.assertExchange(EXCHANGES.ORDERS, 'topic', {
      durable: true
    });

    // Declare queues for this service
    await channel.assertQueue(QUEUES.ORDER_CREATED, {
      durable: true,
      arguments: {
        'x-message-ttl': 300000, // 5 minutes TTL for messages
        'x-max-retries': 3
      }
    });

    await channel.assertQueue(QUEUES.ORDER_STATUS_UPDATED, {
      durable: true,
      arguments: {
        'x-message-ttl': 300000, // 5 minutes TTL for messages
        'x-max-retries': 3
      }
    });

    // Bind queues to exchanges
    await channel.bindQueue(
      QUEUES.ORDER_CREATED,
      EXCHANGES.ORDERS,
      ROUTING_KEYS.ORDER_CREATED
    );

    await channel.bindQueue(
      QUEUES.ORDER_STATUS_UPDATED,
      EXCHANGES.ORDERS,
      ROUTING_KEYS.ORDER_STATUS_UPDATED
    );

    console.log('✅ RabbitMQ connection and setup completed'.green);
    return { connection, channel };

  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:'.red, error);
    throw error;
  }
};

const startEventListeners = async () => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    console.log('🎧 Starting event listeners...'.cyan);

    // Set up OrderCreated event listener
    await channel.consume(QUEUES.ORDER_CREATED, async (message) => {
      if (message) {
        try {
          const content = message.content.toString();
          const event = JSON.parse(content);
          
          console.log(`📥 Received OrderCreated event: ${event.eventId}`.cyan);
          
          // Process the event
          await orderCreatedHandler.handle(event);
          
          // Acknowledge the message
          channel.ack(message);
          console.log(`✅ OrderCreated event processed: ${event.eventId}`.green);
          
        } catch (error) {
          console.error('❌ Error processing OrderCreated event:'.red, error);
          
          // Check if this is a transient error or permanent failure
          if (shouldRetry(error)) {
            // Reject and requeue the message for retry
            channel.nack(message, false, true);
            console.log('🔄 Message requeued for retry'.yellow);
          } else {
            // Permanent failure, reject without requeue
            channel.nack(message, false, false);
            console.log('❌ Message rejected permanently'.red);
          }
        }
      }
    }, {
      noAck: false // Enable manual acknowledgment
    });

    // Set up OrderStatusUpdated event listener
    await channel.consume(QUEUES.ORDER_STATUS_UPDATED, async (message) => {
      if (message) {
        try {
          const content = message.content.toString();
          const event = JSON.parse(content);
          
          console.log(`📥 Received OrderStatusUpdated event: ${event.eventId}`.cyan);
          
          // Process the event
          await orderStatusUpdatedHandler.handle(event);
          
          // Acknowledge the message
          channel.ack(message);
          console.log(`✅ OrderStatusUpdated event processed: ${event.eventId}`.green);
          
        } catch (error) {
          console.error('❌ Error processing OrderStatusUpdated event:'.red, error);
          
          if (shouldRetry(error)) {
            channel.nack(message, false, true);
            console.log('🔄 Message requeued for retry'.yellow);
          } else {
            channel.nack(message, false, false);
            console.log('❌ Message rejected permanently'.red);
          }
        }
      }
    }, {
      noAck: false
    });

    console.log('🎧 All event listeners started successfully'.green);

  } catch (error) {
    console.error('❌ Failed to start event listeners:'.red, error);
    throw error;
  }
};

const shouldRetry = (error) => {
  // Define transient errors that should be retried
  const transientErrors = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN'
  ];
  
  return transientErrors.some(errCode => 
    error.code === errCode || error.message.includes(errCode)
  );
};

const disconnectRabbitMQ = async () => {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    
    if (connection) {
      await connection.close();
      connection = null;
    }
    
    console.log('🔌 RabbitMQ disconnected'.yellow);
  } catch (error) {
    console.error('❌ Error disconnecting from RabbitMQ:'.red, error);
  }
};

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized. Call connectRabbitMQ() first.');
  }
  return channel;
};

const isConnected = () => {
  return connection !== null && channel !== null;
};

const getConnectionStats = () => {
  return {
    connected: isConnected(),
    url: RABBITMQ_URL.replace(/\/\/.*:.*@/, '//***:***@'), // Hide credentials
    exchanges: Object.values(EXCHANGES),
    queues: Object.values(QUEUES),
    timestamp: new Date().toISOString()
  };
};

// Graceful shutdown handlers
const gracefulShutdown = async () => {
  console.log('\n⚠️  Gracefully shutting down RabbitMQ connection...'.yellow);
  await disconnectRabbitMQ();
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = {
  connectRabbitMQ,
  startEventListeners,
  disconnectRabbitMQ,
  getChannel,
  isConnected,
  getConnectionStats,
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS
};