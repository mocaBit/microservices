const axios = require('axios');

class UserService {
  constructor() {
    this.baseURL = process.env.USERS_SERVICE_URL || 'http://localhost:3001';
    this.timeout = 5000; // 5 seconds timeout
    
    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`Making request to users-service: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`Users-service response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('Users-service error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  async validateUser(userId) {
    try {
      const response = await this.client.get(`/api/users/${userId}`);
      
      if (response.status === 200 && response.data.user) {
        return {
          valid: true,
          user: response.data.user
        };
      }

      return { valid: false, error: 'User not found' };

    } catch (error) {
      if (error.response?.status === 404) {
        return { valid: false, error: 'User not found' };
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.error('Users service is not available');
        return { 
          valid: false, 
          error: 'User validation service unavailable',
          serviceDown: true 
        };
      }

      if (error.code === 'ECONNABORTED') {
        console.error('Users service request timeout');
        return { 
          valid: false, 
          error: 'User validation timeout',
          timeout: true 
        };
      }

      console.error('Unexpected error validating user:', error);
      return { 
        valid: false, 
        error: 'User validation failed',
        unexpected: true 
      };
    }
  }

  async getUserProfile(userId) {
    try {
      const response = await this.client.get(`/api/users/${userId}`);
      
      if (response.status === 200 && response.data.user) {
        return {
          success: true,
          user: response.data.user
        };
      }

      return { success: false, error: 'User not found' };

    } catch (error) {
      console.error('Error fetching user profile:', error);
      
      if (error.response?.status === 404) {
        return { success: false, error: 'User not found' };
      }

      return { 
        success: false, 
        error: 'Failed to fetch user profile' 
      };
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      
      return {
        status: 'connected',
        service: response.data?.service || 'users-service',
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

  // Configuration methods
  setTimeout(timeout) {
    this.timeout = timeout;
    this.client.defaults.timeout = timeout;
  }

  setBaseURL(baseURL) {
    this.baseURL = baseURL;
    this.client.defaults.baseURL = baseURL;
  }
}

// Export singleton instance
module.exports = new UserService();