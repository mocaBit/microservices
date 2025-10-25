const express = require('express');
const notificationService = require('../services/notificationService');
const { getConnectionStats, isConnected } = require('../config/rabbitmq');
const orderCreatedHandler = require('../handlers/orderCreatedHandler');
const orderStatusUpdatedHandler = require('../handlers/orderStatusUpdatedHandler');

const router = express.Router();

// SSE client connections management
const sseClients = new Map();

// SSE endpoint for real-time notifications
router.get('/stream/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: 'Connected to notifications stream',
    timestamp: new Date().toISOString(),
    userId
  })}\n\n`);

  // Store client connection
  const clientId = `${userId}_${Date.now()}`;
  sseClients.set(clientId, {
    userId,
    response: res,
    connectedAt: new Date().toISOString()
  });

  console.log(`🔗 SSE client connected: ${clientId} for user ${userId}`.green);

  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(clientId);
    console.log(`❌ SSE client disconnected: ${clientId}`.yellow);
  });

  req.on('error', (error) => {
    console.error(`❌ SSE client error for ${clientId}:`.red, error);
    sseClients.delete(clientId);
  });

  // Keep connection alive with periodic ping
  const keepAlive = setInterval(() => {
    if (sseClients.has(clientId)) {
      res.write(`data: ${JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      })}\n\n`);
    } else {
      clearInterval(keepAlive);
    }
  }, 30000); // Send ping every 30 seconds
});

// GET /api/notifications/stream/clients - Get connected SSE clients info
router.get('/stream/clients', (req, res) => {
  try {
    const clients = Array.from(sseClients.entries()).map(([clientId, client]) => ({
      clientId,
      userId: client.userId,
      connectedAt: client.connectedAt
    }));

    res.status(200).json({
      connectedClients: clients.length,
      clients,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching SSE clients info:', error);
    res.status(500).json({
      error: 'Internal server error while fetching SSE clients info'
    });
  }
});

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', (req, res) => {
  try {
    const stats = notificationService.getStats();
    
    res.status(200).json({
      service: 'notifications-service',
      statistics: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      error: 'Internal server error while fetching statistics'
    });
  }
});

// POST /api/notifications/stats/reset - Reset notification statistics
router.post('/stats/reset', (req, res) => {
  try {
    notificationService.resetStats();
    
    res.status(200).json({
      message: 'Statistics reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resetting notification stats:', error);
    res.status(500).json({
      error: 'Internal server error while resetting statistics'
    });
  }
});

// GET /api/notifications/channels - Get notification channel configuration
router.get('/channels', (req, res) => {
  try {
    const stats = notificationService.getStats();
    
    res.status(200).json({
      channels: {
        console: { enabled: notificationService.channels?.console || false },
        email: { enabled: notificationService.channels?.email || false },
        sms: { enabled: notificationService.channels?.sms || false },
        push: { enabled: notificationService.channels?.push || false },
        sse: { enabled: notificationService.channels?.sse || false }
      },
      activeChannels: stats.activeChannels,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching channel configuration:', error);
    res.status(500).json({
      error: 'Internal server error while fetching channel configuration'
    });
  }
});

// PUT /api/notifications/channels/:channel - Toggle notification channel
router.put('/channels/:channel', (req, res) => {
  try {
    const { channel } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request body. "enabled" must be a boolean'
      });
    }

    const validChannels = ['console', 'email', 'sms', 'push', 'sse'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({
        error: `Invalid channel. Must be one of: ${validChannels.join(', ')}`
      });
    }

    notificationService.setChannelEnabled(channel, enabled);

    res.status(200).json({
      message: `Channel ${channel} ${enabled ? 'enabled' : 'disabled'} successfully`,
      channel,
      enabled,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating channel configuration:', error);
    res.status(500).json({
      error: 'Internal server error while updating channel configuration'
    });
  }
});

// GET /api/notifications/handlers - Get event handler information
router.get('/handlers', (req, res) => {
  try {
    const handlers = [
      orderCreatedHandler.getStats(),
      orderStatusUpdatedHandler.getStats()
    ];

    res.status(200).json({
      handlers,
      totalHandlers: handlers.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching handler information:', error);
    res.status(500).json({
      error: 'Internal server error while fetching handler information'
    });
  }
});

// POST /api/notifications/test - Send test notification
router.post('/test', (req, res) => {
  try {
    const { type = 'orderCreated', userId = 1 } = req.body;

    // Create test order data
    const testOrderData = {
      orderId: `test-${Date.now()}`,
      userId,
      totalAmount: 25.99,
      items: [
        { quantity: 2, product_name: 'Hamburguesa Clásica', price: 12.99 },
        { quantity: 1, product_name: 'Coca Cola', price: 2.99 }
      ],
      deliveryAddress: {
        street: '123 Test Street',
        city: 'Test City',
        postal_code: '12345',
        phone: '+1234567890'
      },
      currentStatus: 'confirmed',
      previousStatus: 'pending'
    };

    let notificationPromise;

    if (type === 'orderCreated') {
      notificationPromise = notificationService.sendOrderCreatedNotification(testOrderData);
    } else if (type === 'orderStatusUpdated') {
      notificationPromise = notificationService.sendOrderStatusUpdatedNotification(testOrderData);
    } else {
      return res.status(400).json({
        error: 'Invalid test type. Must be "orderCreated" or "orderStatusUpdated"'
      });
    }

    notificationPromise
      .then(result => {
        res.status(200).json({
          message: 'Test notification sent successfully',
          type,
          result,
          testData: testOrderData,
          timestamp: new Date().toISOString()
        });
      })
      .catch(error => {
        console.error('Error sending test notification:', error);
        res.status(500).json({
          error: 'Failed to send test notification',
          details: error.message
        });
      });

  } catch (error) {
    console.error('Error processing test notification request:', error);
    res.status(500).json({
      error: 'Internal server error while processing test notification'
    });
  }
});

// Health check endpoints
router.get('/health/rabbitmq', (req, res) => {
  try {
    const stats = getConnectionStats();
    
    if (isConnected()) {
      res.status(200).json({
        status: 'OK',
        rabbitmq: 'connected',
        connection: stats,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'ERROR',
        rabbitmq: 'disconnected',
        connection: stats,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      rabbitmq: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/health/notifications', (req, res) => {
  try {
    const stats = notificationService.getStats();
    
    res.status(200).json({
      status: 'OK',
      notifications: {
        totalSent: stats.sent,
        totalFailed: stats.failed,
        successRate: stats.sent + stats.failed > 0 
          ? ((stats.sent / (stats.sent + stats.failed)) * 100).toFixed(2) + '%'
          : '0%',
        activeChannels: stats.activeChannels,
        channelStats: stats.byChannel
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      notifications: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/notifications/health/comprehensive - Comprehensive health check
router.get('/health/comprehensive', async (req, res) => {
  try {
    const [rabbitMQConnected, notificationStats] = await Promise.all([
      Promise.resolve(isConnected()),
      Promise.resolve(notificationService.getStats())
    ]);

    const health = {
      service: 'notifications-service',
      overall: 'OK',
      checks: {
        rabbitmq: {
          status: rabbitMQConnected ? 'OK' : 'ERROR',
          connected: rabbitMQConnected,
          details: getConnectionStats()
        },
        notifications: {
          status: 'OK',
          stats: notificationStats
        },
        handlers: {
          status: 'OK',
          count: 2,
          types: ['OrderCreated', 'OrderStatusUpdated']
        }
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    // Determine overall status
    const hasErrors = Object.values(health.checks).some(check => check.status === 'ERROR');
    if (hasErrors) {
      health.overall = 'DEGRADED';
    }

    const statusCode = health.overall === 'OK' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    console.error('Error performing comprehensive health check:', error);
    res.status(503).json({
      service: 'notifications-service',
      overall: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Function to send SSE notifications to specific users
const sendSSENotification = (userId, notification) => {
  let sent = 0;
  let failed = 0;

  for (const [clientId, client] of sseClients.entries()) {
    if (client.userId == userId || userId === 'all') {  // Use == for loose comparison
      try {
        const sseData = {
          type: 'notification',
          id: Date.now(),
          data: notification,
          timestamp: new Date().toISOString()
        };

        client.response.write(`data: ${JSON.stringify(sseData)}\n\n`);
        sent++;
      } catch (error) {
        console.error(`❌ Error sending SSE to client ${clientId}:`.red, error);
        sseClients.delete(clientId);
        failed++;
      }
    }
  }

  return { sent, failed };
};

// Initialize SSE functionality in notification service
notificationService.initializeSSE(sendSSENotification);

module.exports = router;
module.exports.sendSSENotification = sendSSENotification;