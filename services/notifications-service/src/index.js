const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'notifications-service' });
});

// Placeholder for event listener setup
console.log('📩 Notifications service initialized - Event listeners TODO');

app.listen(PORT, () => {
  console.log(`Notifications service running on port ${PORT}`);
});