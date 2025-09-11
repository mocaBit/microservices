const express = require('express');
const Order = require('../models/Order');
const userService = require('../services/userService');
const eventPublisher = require('../services/eventPublisher');
const {
  validateCreateOrder,
  validateUpdateOrderStatus,
  validateQueryOrders,
  validateOrderId,
  validateUserId
} = require('../middleware/validation');

const router = express.Router();

// POST /api/orders - Create new order
router.post('/', validateCreateOrder, async (req, res) => {
  try {
    const { user_id, items, delivery_address, payment_method, notes } = req.body;

    // Validate user exists
    const userValidation = await userService.validateUser(user_id);
    
    if (!userValidation.valid) {
      if (userValidation.serviceDown) {
        return res.status(503).json({
          error: 'User validation service unavailable',
          message: 'Please try again later'
        });
      }
      
      return res.status(400).json({
        error: 'Invalid user',
        message: userValidation.error
      });
    }

    // Create order
    const orderData = {
      user_id,
      items,
      delivery_address,
      payment_method,
      notes
    };

    const newOrder = await Order.create(orderData);

    // Publish OrderCreated event
    await eventPublisher.publishOrderCreated(newOrder);

    res.status(201).json({
      message: 'Order created successfully',
      order: newOrder
    });

  } catch (error) {
    console.error('Error creating order:', error);
    
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(400).json({
        error: 'Invalid reference data',
        message: 'One or more referenced items do not exist'
      });
    }

    res.status(500).json({
      error: 'Internal server error while creating order'
    });
  }
});

// GET /api/orders/:id - Get order by ID
router.get('/:id', validateOrderId, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    res.status(200).json({
      order
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      error: 'Internal server error while fetching order'
    });
  }
});

// GET /api/orders/user/:userId - Get orders by user ID
router.get('/user/:userId', validateUserId, validateQueryOrders, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, offset, status } = req.query;

    // Validate user exists
    const userValidation = await userService.validateUser(parseInt(userId));
    
    if (!userValidation.valid && !userValidation.serviceDown) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const [orders, totalCount] = await Promise.all([
      Order.findByUserId(parseInt(userId), { limit, offset, status }),
      Order.getTotalCount(parseInt(userId), status)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    res.status(200).json({
      orders,
      pagination: {
        total: totalCount,
        limit,
        offset,
        currentPage,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    });

  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      error: 'Internal server error while fetching user orders'
    });
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', validateOrderId, validateUpdateOrderStatus, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Get current order to check if it exists and get previous status
    const currentOrder = await Order.findById(id);
    
    if (!currentOrder) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    const previousStatus = currentOrder.status;
    
    // Validate status transition (basic validation)
    if (previousStatus === status) {
      return res.status(400).json({
        error: 'Order already has this status'
      });
    }

    if (previousStatus === 'cancelled' || previousStatus === 'delivered') {
      return res.status(400).json({
        error: 'Cannot update status of cancelled or delivered orders'
      });
    }

    // Update order status
    const updatedOrder = await Order.updateStatus(id, status, notes);

    if (!updatedOrder) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    // Publish OrderStatusUpdated event
    await eventPublisher.publishOrderStatusUpdated(updatedOrder, previousStatus, notes);

    res.status(200).json({
      message: 'Order status updated successfully',
      order: updatedOrder,
      previousStatus
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      error: 'Internal server error while updating order status'
    });
  }
});

// GET /api/orders/stats/overview - Get order statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [stats, recentOrders] = await Promise.all([
      Order.getOrderStats(),
      Order.getRecentOrders(5)
    ]);

    res.status(200).json({
      statistics: stats,
      recentOrders
    });

  } catch (error) {
    console.error('Error fetching order statistics:', error);
    res.status(500).json({
      error: 'Internal server error while fetching order statistics'
    });
  }
});

// Health check endpoints
router.get('/health/db', async (req, res) => {
  try {
    const dbStatus = await Order.checkConnection();
    
    if (dbStatus.connected) {
      res.status(200).json({
        status: 'OK',
        database: 'connected',
        timestamp: dbStatus.timestamp
      });
    } else {
      res.status(503).json({
        status: 'ERROR',
        database: 'disconnected',
        error: dbStatus.error
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      database: 'error',
      error: error.message
    });
  }
});

router.get('/health/users-service', async (req, res) => {
  try {
    const serviceStatus = await userService.healthCheck();
    
    if (serviceStatus.status === 'connected') {
      res.status(200).json(serviceStatus);
    } else {
      res.status(503).json(serviceStatus);
    }
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      service: 'users-service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/health/events', async (req, res) => {
  try {
    const eventStatus = await eventPublisher.healthCheck();
    
    if (eventStatus.status === 'connected') {
      res.status(200).json(eventStatus);
    } else {
      res.status(503).json(eventStatus);
    }
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      events: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;