const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ecommerce',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

class Order {
  static async create(orderData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        user_id,
        items,
        delivery_address,
        payment_method = 'cash',
        notes
      } = orderData;

      // Calculate total amount
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.1; // 10% tax
      const delivery_fee = subtotal > 50 ? 0 : 5.99; // Free delivery over $50
      const total_amount = subtotal + tax + delivery_fee;

      // Create order
      const orderQuery = `
        INSERT INTO orders (
          id, user_id, status, subtotal, tax, delivery_fee, total_amount,
          delivery_address, payment_method, notes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `;

      const orderId = uuidv4();
      const orderValues = [
        orderId, user_id, 'pending', subtotal, tax, delivery_fee, total_amount,
        JSON.stringify(delivery_address), payment_method, notes
      ];

      const orderResult = await client.query(orderQuery, orderValues);
      const order = orderResult.rows[0];

      // Create order items
      for (const item of items) {
        const itemQuery = `
          INSERT INTO order_items (
            order_id, product_id, product_name, price, quantity, subtotal
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        const itemValues = [
          orderId, item.product_id, item.product_name, 
          item.price, item.quantity, item.price * item.quantity
        ];

        await client.query(itemQuery, itemValues);
      }

      await client.query('COMMIT');

      // Fetch complete order with items
      const completeOrder = await this.findById(orderId);
      return completeOrder;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id) {
    try {
      // Get order details
      const orderQuery = `
        SELECT 
          id, user_id, status, subtotal, tax, delivery_fee, total_amount,
          delivery_address, payment_method, notes, created_at, updated_at
        FROM orders
        WHERE id = $1
      `;

      const orderResult = await pool.query(orderQuery, [id]);
      
      if (orderResult.rows.length === 0) {
        return null;
      }

      const order = orderResult.rows[0];

      // Get order items
      const itemsQuery = `
        SELECT 
          product_id, product_name, price, quantity, subtotal
        FROM order_items
        WHERE order_id = $1
        ORDER BY product_name
      `;

      const itemsResult = await pool.query(itemsQuery, [id]);

      return {
        ...order,
        delivery_address: JSON.parse(order.delivery_address),
        items: itemsResult.rows
      };

    } catch (error) {
      console.error('Error fetching order by ID:', error);
      throw error;
    }
  }

  static async findByUserId(userId, options = {}) {
    const { limit = 20, offset = 0, status } = options;

    try {
      let query = `
        SELECT 
          id, user_id, status, subtotal, tax, delivery_fee, total_amount,
          delivery_address, payment_method, notes, created_at, updated_at
        FROM orders
        WHERE user_id = $1
      `;

      const queryParams = [userId];
      let paramIndex = 2;

      if (status) {
        query += ` AND status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, offset);

      const result = await pool.query(query, queryParams);

      // Parse delivery_address for each order
      const orders = result.rows.map(order => ({
        ...order,
        delivery_address: JSON.parse(order.delivery_address)
      }));

      return orders;

    } catch (error) {
      console.error('Error fetching orders by user ID:', error);
      throw error;
    }
  }

  static async updateStatus(orderId, newStatus, notes = null) {
    try {
      const query = `
        UPDATE orders 
        SET status = $1, updated_at = NOW()
        ${notes ? ', notes = $3' : ''}
        WHERE id = $2
        RETURNING *
      `;

      const values = notes ? [newStatus, orderId, notes] : [newStatus, orderId];
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const updatedOrder = result.rows[0];
      return {
        ...updatedOrder,
        delivery_address: JSON.parse(updatedOrder.delivery_address)
      };

    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  static async getOrderStats(userId = null) {
    try {
      let query = `
        SELECT 
          status,
          COUNT(*) as count,
          SUM(total_amount) as total_revenue
        FROM orders
      `;

      const queryParams = [];

      if (userId) {
        query += ` WHERE user_id = $1`;
        queryParams.push(userId);
      }

      query += ` GROUP BY status ORDER BY status`;

      const result = await pool.query(query, queryParams);
      return result.rows;

    } catch (error) {
      console.error('Error fetching order stats:', error);
      throw error;
    }
  }

  static async getTotalCount(userId = null, status = null) {
    try {
      let query = `SELECT COUNT(*) as total FROM orders WHERE 1=1`;
      const queryParams = [];
      let paramIndex = 1;

      if (userId) {
        query += ` AND user_id = $${paramIndex}`;
        queryParams.push(userId);
        paramIndex++;
      }

      if (status) {
        query += ` AND status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      const result = await pool.query(query, queryParams);
      return parseInt(result.rows[0].total);

    } catch (error) {
      console.error('Error getting total order count:', error);
      throw error;
    }
  }

  static async getRecentOrders(limit = 10) {
    try {
      const query = `
        SELECT 
          id, user_id, status, total_amount, created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);
      return result.rows;

    } catch (error) {
      console.error('Error fetching recent orders:', error);
      throw error;
    }
  }

  static async checkConnection() {
    try {
      const result = await pool.query('SELECT NOW()');
      return { connected: true, timestamp: result.rows[0].now };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  // Order status constants
  static get STATUS() {
    return {
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
      PREPARING: 'preparing',
      OUT_FOR_DELIVERY: 'out_for_delivery',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled'
    };
  }

  static get PAYMENT_METHODS() {
    return {
      CASH: 'cash',
      CARD: 'card',
      DIGITAL_WALLET: 'digital_wallet'
    };
  }
}

module.exports = Order;