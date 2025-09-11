const { getRedisClient } = require('../config/redis');

class CacheService {
  constructor() {
    this.defaultTTL = 300; // 5 minutes in seconds
    this.longTTL = 1800; // 30 minutes for less frequently changing data
  }

  generateKey(prefix, ...args) {
    const cleanArgs = args
      .filter(arg => arg !== undefined && arg !== null)
      .map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg));
    return `${prefix}:${cleanArgs.join(':')}`;
  }

  async get(key) {
    try {
      const client = getRedisClient();
      const data = await client.get(key);
      
      if (data) {
        console.log(`Cache HIT for key: ${key}`);
        return JSON.parse(data);
      }
      
      console.log(`Cache MISS for key: ${key}`);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      // Don't throw error, just return null to fallback to DB
      return null;
    }
  }

  async set(key, data, ttl = this.defaultTTL) {
    try {
      const client = getRedisClient();
      await client.setEx(key, ttl, JSON.stringify(data));
      console.log(`Cache SET for key: ${key}, TTL: ${ttl}s`);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      // Don't throw error, just log it
      return false;
    }
  }

  async del(key) {
    try {
      const client = getRedisClient();
      await client.del(key);
      console.log(`Cache DELETE for key: ${key}`);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async deletePattern(pattern) {
    try {
      const client = getRedisClient();
      const keys = await client.keys(pattern);
      
      if (keys.length > 0) {
        await client.del(keys);
        console.log(`Cache DELETE pattern: ${pattern}, deleted ${keys.length} keys`);
      }
      
      return keys.length;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  // Product-specific cache methods
  async getProducts(options = {}) {
    const key = this.generateKey('products', options);
    return await this.get(key);
  }

  async setProducts(products, options = {}, ttl = this.defaultTTL) {
    const key = this.generateKey('products', options);
    return await this.set(key, products, ttl);
  }

  async getProduct(id) {
    const key = this.generateKey('product', id);
    return await this.get(key);
  }

  async setProduct(id, product, ttl = this.longTTL) {
    const key = this.generateKey('product', id);
    return await this.set(key, product, ttl);
  }

  async deleteProduct(id) {
    const key = this.generateKey('product', id);
    return await this.del(key);
  }

  async getCategories() {
    const key = this.generateKey('categories');
    return await this.get(key);
  }

  async setCategories(categories, ttl = this.longTTL) {
    const key = this.generateKey('categories');
    return await this.set(key, categories, ttl);
  }

  async invalidateProductCaches() {
    // Clear all product-related caches
    await this.deletePattern('products:*');
    await this.deletePattern('categories:*');
    console.log('All product caches invalidated');
  }

  async invalidateProductCache(id) {
    // Clear specific product cache and related lists
    await this.deleteProduct(id);
    await this.deletePattern('products:*'); // Clear all product lists as they might contain this product
    console.log(`Product cache invalidated for ID: ${id}`);
  }

  async healthCheck() {
    try {
      const client = getRedisClient();
      const start = Date.now();
      await client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'connected',
        latency: `${latency}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new CacheService();