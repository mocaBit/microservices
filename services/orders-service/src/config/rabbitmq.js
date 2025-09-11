const amqp = require('amqplib');

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
    console.log('Connecting to RabbitMQ...');
    connection = await amqp.connect(RABBITMQ_URL);
    
    // Handle connection events
    connection.on('error', (error) => {
      console.error('RabbitMQ connection error:', error);
    });

    connection.on('close', () => {
      console.log('RabbitMQ connection closed');
      connection = null;
      channel = null;
    });

    // Create channel
    channel = await connection.createChannel();
    
    // Handle channel events
    channel.on('error', (error) => {
      console.error('RabbitMQ channel error:', error);
    });

    // Declare exchanges
    await channel.assertExchange(EXCHANGES.ORDERS, 'topic', {
      durable: true
    });

    // Declare queues (for completeness, though consumers will typically do this)
    await channel.assertQueue(QUEUES.ORDER_CREATED, {
      durable: true
    });

    await channel.assertQueue(QUEUES.ORDER_STATUS_UPDATED, {
      durable: true
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

    console.log('RabbitMQ connection and setup completed');
    return { connection, channel };

  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
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
    
    console.log('RabbitMQ disconnected');
  } catch (error) {
    console.error('Error disconnecting from RabbitMQ:', error);
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing RabbitMQ connection...');
  await disconnectRabbitMQ();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing RabbitMQ connection...');
  await disconnectRabbitMQ();
  process.exit(0);
});

module.exports = {
  connectRabbitMQ,
  disconnectRabbitMQ,
  getChannel,
  isConnected,
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS
};