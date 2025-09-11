const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'products-service' });
});

// Placeholder routes
app.get('/products', (req, res) => {
  res.json({ 
    message: 'Products endpoint - TODO',
    products: []
  });
});

app.listen(PORT, () => {
  console.log(`Products service running on port ${PORT}`);
});