const express = require('express');
const notificationService = require('../services/notificationService');
const { getConnectionStats, isConnected } = require('../config/rabbitmq');
const orderCreatedHandler = require('../handlers/orderCreatedHandler');
const orderStatusUpdatedHandler = require('../handlers/orderStatusUpdatedHandler');

const router = express.Router();

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
        push: { enabled: notificationService.channels?.push || false }
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

    const validChannels = ['console', 'email', 'sms', 'push'];
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

module.exports = router;