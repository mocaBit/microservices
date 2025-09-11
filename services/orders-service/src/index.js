require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const orderRoutes = require('./routes/orders');
const { connectRabbitMQ } = require('./config/rabbitmq');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    service: 'orders-service',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/orders', orderRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize RabbitMQ connection and start server
const startServer = async () => {
  try {
    await connectRabbitMQ();
    console.log('RabbitMQ connected successfully');
    
    app.listen(PORT, () => {
      console.log(`Orders service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    console.log('Starting server without RabbitMQ connection...');
    
    app.listen(PORT, () => {
      console.log(`Orders service running on port ${PORT} (RabbitMQ connection failed)`);
    });
  }
};

startServer();

module.exports = app;