const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ecommerce',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class User {
  static async create({ username, email, password, full_name }) {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const query = `
      INSERT INTO users (username, email, password_hash, full_name, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, username, email, full_name, created_at, updated_at
    `;
    
    const values = [username, email, hashedPassword, full_name];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // unique constraint violation
        if (error.constraint === 'users_username_key') {
          throw new Error('Username already exists');
        }
        if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        }
      }
      throw error;
    }
  }

  static async findByEmail(email) {
    const query = `
      SELECT id, username, email, password_hash, full_name, created_at, updated_at
      FROM users
      WHERE email = $1
    `;
    
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  static async findByUsername(username) {
    const query = `
      SELECT id, username, email, password_hash, full_name, created_at, updated_at
      FROM users
      WHERE username = $1
    `;
    
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  static async findById(id) {
    const query = `
      SELECT id, username, email, full_name, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateProfile(id, updates) {
    const allowedFields = ['username', 'email', 'full_name'];
    const fields = Object.keys(updates).filter(field => allowedFields.includes(field));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updates[field])];

    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, full_name, created_at, updated_at
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      if (error.code === '23505') { // unique constraint violation
        if (error.constraint === 'users_username_key') {
          throw new Error('Username already exists');
        }
        if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        }
      }
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

module.exports = User;