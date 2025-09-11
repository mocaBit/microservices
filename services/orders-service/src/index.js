const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'orders-service' });
});

// Placeholder routes
app.post('/orders', (req, res) => {
  res.json({ 
    message: 'Create order endpoint - TODO',
    order: null
  });
});

app.get('/orders/:userId', (req, res) => {
  res.json({ 
    message: 'Get user orders endpoint - TODO',
    orders: []
  });
});

app.listen(PORT, () => {
  console.log(`Orders service running on port ${PORT}`);
});