const express = require('express');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');

const router = express.Router();

// Register endpoint
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    // Check if user already exists
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(409).json({ 
        error: 'User already exists with this email' 
      });
    }

    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(409).json({ 
        error: 'User already exists with this username' 
      });
    }

    // Create new user
    const newUser = await User.create({
      username,
      email,
      password,
      full_name
    });

    // Generate JWT token
    const token = generateToken(newUser.id);

    // Return user data without password
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        full_name: newUser.full_name,
        created_at: newUser.created_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.message === 'Username already exists' || error.message === 'Email already exists') {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ 
      error: 'Internal server error during registration' 
    });
  }
});

// Login endpoint
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Validate password
    const isPasswordValid = await User.validatePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Return user data without password
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error during login' 
    });
  }
});

module.exports = router;