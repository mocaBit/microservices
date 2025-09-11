const express = require('express');
const Product = require('../models/Product');
const cacheService = require('../services/cacheService');
const inventoryPublisher = require('../services/inventoryPublisher');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const querySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  category: Joi.string().max(100),
  available_only: Joi.boolean().default(false),
  search: Joi.string().max(255)
});

const productIdSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// GET /api/products - Get all products with caching
router.get('/', async (req, res) => {
  try {
    // Validate query parameters
    const { error, value: queryParams } = querySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.details.map(detail => detail.message)
      });
    }

    const { limit, offset, category, available_only, search } = queryParams;
    
    // Create options object for caching and DB query
    const options = {
      limit,
      offset,
      category,
      available_only,
      search
    };

    // Try to get from cache first
    let products = await cacheService.getProducts(options);
    let totalCount;
    
    if (!products) {
      // Not in cache, fetch from database
      console.log('Fetching products from database');
      [products, totalCount] = await Promise.all([
        Product.findAll(options),
        Product.getTotalCount(options)
      ]);

      // Cache the results
      await cacheService.setProducts(products, options, 300); // 5 minutes TTL
    } else {
      // If we got products from cache, we still need total count for pagination
      // This could also be cached separately for optimization
      totalCount = await Product.getTotalCount(options);
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    res.status(200).json({
      products,
      pagination: {
        total: totalCount,
        limit,
        offset,
        currentPage,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      cached: !!products // Indicate if data came from cache
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: 'Internal server error while fetching products'
    });
  }
});

// GET /api/products/:id - Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    // Validate product ID
    const { error, value } = productIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json({
        error: 'Invalid product ID',
        details: error.details.map(detail => detail.message)
      });
    }

    const { id } = value;

    // Try to get from cache first
    let product = await cacheService.getProduct(id);
    
    if (!product) {
      // Not in cache, fetch from database
      product = await Product.findById(id);
      
      if (!product) {
        return res.status(404).json({
          error: 'Product not found'
        });
      }

      // Cache the result
      await cacheService.setProduct(id, product, 1800); // 30 minutes TTL
    }

    res.status(200).json({
      product,
      cached: !!product // Indicate if data came from cache
    });

  } catch (error) {
    console.error('Error fetching product by ID:', error);
    res.status(500).json({
      error: 'Internal server error while fetching product'
    });
  }
});

// GET /api/products/category/:category - Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    // Validate query parameters
    const { error, value: queryParams } = Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(50),
      offset: Joi.number().integer().min(0).default(0),
      available_only: Joi.boolean().default(false)
    }).validate(req.query);
    
    if (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.details.map(detail => detail.message)
      });
    }

    const { limit, offset, available_only } = queryParams;
    const options = { limit, offset, available_only, category };

    // Try to get from cache first
    let products = await cacheService.getProducts(options);
    
    if (!products) {
      // Not in cache, fetch from database
      products = await Product.findByCategory(category, { limit, offset, available_only });
      
      // Cache the results
      await cacheService.setProducts(products, options, 600); // 10 minutes TTL for category-specific queries
    }

    // Get total count for this category
    const totalCount = await Product.getTotalCount({ category, available_only });
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    res.status(200).json({
      products,
      category,
      pagination: {
        total: totalCount,
        limit,
        offset,
        currentPage,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      },
      cached: !!products
    });

  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({
      error: 'Internal server error while fetching products by category'
    });
  }
});

// GET /api/products/meta/categories - Get all categories
router.get('/meta/categories', async (req, res) => {
  try {
    // Try to get from cache first
    let categories = await cacheService.getCategories();
    
    if (!categories) {
      // Not in cache, fetch from database
      categories = await Product.getCategories();
      
      // Cache the results for longer since categories don't change frequently
      await cacheService.setCategories(categories, 3600); // 1 hour TTL
    }

    res.status(200).json({
      categories,
      cached: !!categories
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Internal server error while fetching categories'
    });
  }
});

// Health check endpoints
router.get('/health/db', async (req, res) => {
  try {
    const dbStatus = await Product.checkConnection();
    
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

router.get('/health/cache', async (req, res) => {
  try {
    const cacheStatus = await cacheService.healthCheck();
    
    if (cacheStatus.status === 'connected') {
      res.status(200).json(cacheStatus);
    } else {
      res.status(503).json(cacheStatus);
    }
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      cache: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/products/:id/stock - Update product stock (for testing inventory alerts)
router.put('/:id/stock', async (req, res) => {
  try {
    const { error: paramError, value: paramValue } = productIdSchema.validate(req.params);
    if (paramError) {
      return res.status(400).json({
        error: 'Invalid product ID',
        details: paramError.details.map(detail => detail.message)
      });
    }

    const stockSchema = Joi.object({
      stock_quantity: Joi.number().integer().min(0).required()
    });

    const { error: bodyError, value: bodyValue } = stockSchema.validate(req.body);
    if (bodyError) {
      return res.status(400).json({
        error: 'Invalid stock data',
        details: bodyError.details.map(detail => detail.message)
      });
    }

    const { id } = paramValue;
    const { stock_quantity } = bodyValue;

    const updatedProduct = await Product.updateStock(id, stock_quantity);
    
    if (!updatedProduct) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    await cacheService.deleteProduct(id);
    await cacheService.clearProductsCache();

    res.status(200).json({
      message: 'Stock updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      error: 'Internal server error while updating stock'
    });
  }
});

module.exports = router;