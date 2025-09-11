const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'users-service' });
});

// Placeholder routes
app.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint - TODO' });
});

app.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint - TODO' });
});

app.get('/profile', (req, res) => {
  res.json({ message: 'Profile endpoint - TODO' });
});

app.listen(PORT, () => {
  console.log(`Users service running on port ${PORT}`);
});