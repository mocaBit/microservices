const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { validateUpdateProfile } = require('../middleware/validation');

const router = express.Router();

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // User is already attached to req by authenticateToken middleware
    const user = req.user;

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      error: 'Internal server error while fetching profile' 
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, validateUpdateProfile, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Update user profile
    const updatedUser = await User.updateProfile(userId, updates);

    if (!updatedUser) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);

    if (error.message === 'Username already exists' || error.message === 'Email already exists') {
      return res.status(409).json({ error: error.message });
    }

    if (error.message === 'No valid fields to update') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ 
      error: 'Internal server error while updating profile' 
    });
  }
});

// Get user by ID (for other services)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        error: 'Invalid user ID' 
      });
    }

    const user = await User.findById(parseInt(id));

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    // Return limited user data for other services
    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({ 
      error: 'Internal server error while fetching user' 
    });
  }
});

// Health check for database connection
router.get('/health/db', async (req, res) => {
  try {
    const dbStatus = await User.checkConnection();
    
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

module.exports = router;