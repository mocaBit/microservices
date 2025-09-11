const Joi = require('joi');

const createOrderSchema = Joi.object({
  user_id: Joi.number().integer().positive().required().messages({
    'number.base': 'User ID must be a number',
    'number.positive': 'User ID must be positive',
    'any.required': 'User ID is required'
  }),

  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Product ID must be a number',
        'number.positive': 'Product ID must be positive',
        'any.required': 'Product ID is required'
      }),
      
      product_name: Joi.string().max(255).required().messages({
        'string.max': 'Product name must not exceed 255 characters',
        'any.required': 'Product name is required'
      }),
      
      price: Joi.number().positive().precision(2).required().messages({
        'number.base': 'Price must be a number',
        'number.positive': 'Price must be positive',
        'any.required': 'Price is required'
      }),
      
      quantity: Joi.number().integer().min(1).max(100).required().messages({
        'number.base': 'Quantity must be a number',
        'number.integer': 'Quantity must be an integer',
        'number.min': 'Quantity must be at least 1',
        'number.max': 'Quantity cannot exceed 100',
        'any.required': 'Quantity is required'
      })
    })
  ).min(1).max(50).required().messages({
    'array.min': 'At least one item is required',
    'array.max': 'Cannot exceed 50 items per order',
    'any.required': 'Items are required'
  }),

  delivery_address: Joi.object({
    street: Joi.string().max(255).required().messages({
      'string.max': 'Street address must not exceed 255 characters',
      'any.required': 'Street address is required'
    }),
    
    city: Joi.string().max(100).required().messages({
      'string.max': 'City must not exceed 100 characters',
      'any.required': 'City is required'
    }),
    
    state: Joi.string().max(100).messages({
      'string.max': 'State must not exceed 100 characters'
    }),
    
    postal_code: Joi.string().max(20).required().messages({
      'string.max': 'Postal code must not exceed 20 characters',
      'any.required': 'Postal code is required'
    }),
    
    country: Joi.string().max(100).default('Mexico').messages({
      'string.max': 'Country must not exceed 100 characters'
    }),
    
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20).messages({
      'string.pattern.base': 'Phone number format is invalid',
      'string.max': 'Phone number must not exceed 20 characters'
    }),
    
    notes: Joi.string().max(500).messages({
      'string.max': 'Address notes must not exceed 500 characters'
    })
  }).required().messages({
    'any.required': 'Delivery address is required'
  }),

  payment_method: Joi.string().valid('cash', 'card', 'digital_wallet').default('cash').messages({
    'any.only': 'Payment method must be one of: cash, card, digital_wallet'
  }),

  notes: Joi.string().max(1000).messages({
    'string.max': 'Order notes must not exceed 1000 characters'
  })
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid(
    'pending', 
    'confirmed', 
    'preparing', 
    'out_for_delivery', 
    'delivered', 
    'cancelled'
  ).required().messages({
    'any.only': 'Status must be one of: pending, confirmed, preparing, out_for_delivery, delivered, cancelled',
    'any.required': 'Status is required'
  }),

  notes: Joi.string().max(1000).messages({
    'string.max': 'Notes must not exceed 1000 characters'
  })
});

const queryOrdersSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100'
  }),
  
  offset: Joi.number().integer().min(0).default(0).messages({
    'number.min': 'Offset must be at least 0'
  }),
  
  status: Joi.string().valid(
    'pending', 
    'confirmed', 
    'preparing', 
    'out_for_delivery', 
    'delivered', 
    'cancelled'
  ).messages({
    'any.only': 'Status must be one of: pending, confirmed, preparing, out_for_delivery, delivered, cancelled'
  })
});

const orderIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.uuid': 'Order ID must be a valid UUID',
    'any.required': 'Order ID is required'
  })
});

const userIdSchema = Joi.object({
  userId: Joi.number().integer().positive().required().messages({
    'number.base': 'User ID must be a number',
    'number.positive': 'User ID must be positive',
    'any.required': 'User ID is required'
  })
});

const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'params' ? req.params : 
                  source === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorMessages
      });
    }

    // Replace the original data with validated and sanitized data
    if (source === 'params') {
      req.params = value;
    } else if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
};

module.exports = {
  validateCreateOrder: validateRequest(createOrderSchema),
  validateUpdateOrderStatus: validateRequest(updateOrderStatusSchema),
  validateQueryOrders: validateRequest(queryOrdersSchema, 'query'),
  validateOrderId: validateRequest(orderIdSchema, 'params'),
  validateUserId: validateRequest(userIdSchema, 'params')
};