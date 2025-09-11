const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ecommerce',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

class Product {
  static async findAll(options = {}) {
    const { 
      limit = 50, 
      offset = 0, 
      category, 
      available_only = false,
      search 
    } = options;

    let query = `
      SELECT 
        id, name, description, price, category, 
        image_url, available, stock_quantity,
        created_at, updated_at
      FROM products
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (available_only) {
      query += ` AND available = true AND stock_quantity > 0`;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    try {
      const result = await pool.query(query, queryParams);
      return result.rows;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  static async findById(id) {
    const query = `
      SELECT 
        id, name, description, price, category, 
        image_url, available, stock_quantity,
        created_at, updated_at
      FROM products
      WHERE id = $1
    `;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw error;
    }
  }

  static async findByCategory(category, options = {}) {
    const { limit = 50, offset = 0, available_only = false } = options;

    let query = `
      SELECT 
        id, name, description, price, category, 
        image_url, available, stock_quantity,
        created_at, updated_at
      FROM products
      WHERE category = $1
    `;

    const queryParams = [category];

    if (available_only) {
      query += ` AND available = true AND stock_quantity > 0`;
    }

    query += ` ORDER BY name ASC LIMIT $2 OFFSET $3`;
    queryParams.push(limit, offset);

    try {
      const result = await pool.query(query, queryParams);
      return result.rows;
    } catch (error) {
      console.error('Error fetching products by category:', error);
      throw error;
    }
  }

  static async getCategories() {
    const query = `
      SELECT category, COUNT(*) as product_count
      FROM products 
      WHERE available = true
      GROUP BY category
      ORDER BY category ASC
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  static async create(productData) {
    const {
      name,
      description,
      price,
      category,
      image_url,
      stock_quantity = 0
    } = productData;

    const query = `
      INSERT INTO products (
        name, description, price, category, image_url, 
        stock_quantity, available, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const available = stock_quantity > 0;
    const values = [name, description, price, category, image_url, stock_quantity, available];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  static async updateStock(id, newStock) {
    const query = `
      UPDATE products 
      SET stock_quantity = $1, 
          available = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const available = newStock > 0;
    const values = [newStock, available, id];

    try {
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  static async getTotalCount(options = {}) {
    const { category, available_only = false, search } = options;

    let query = `SELECT COUNT(*) as total FROM products WHERE 1=1`;
    const queryParams = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (available_only) {
      query += ` AND available = true AND stock_quantity > 0`;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    try {
      const result = await pool.query(query, queryParams);
      return parseInt(result.rows[0].total);
    } catch (error) {
      console.error('Error getting total count:', error);
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
}

module.exports = Product;