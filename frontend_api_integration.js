// 跨境发货管理系统 - 前端API集成指南
// 将现有的localStorage调用替换为API调用

// API配置
const API_CONFIG = {
  BASE_URL: window.API_BASE_URL || 'https://cross-border-shipping-api.onrender.com/api',
  TIMEOUT: 30000 // 30秒超时
};

// API客户端类
class APIClient {
  constructor() {
    this.token = localStorage.getItem('token');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  // 设置认证令牌
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  // 清除认证令牌
  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  // 构建请求头
  buildHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // 发送API请求
  async request(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const config = {
      headers: this.buildHeaders(options.includeAuth !== false),
      ...options
    };

    try {
      const response = await fetch(url, config);

      // 检查认证错误
      if (response.status === 401) {
        this.clearTokens();
        window.location.href = 'login.html';
        return null;
      }

      // 检查服务器错误
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API请求失败: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  }

  // 认证相关API
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      includeAuth: false
    });

    if (response && response.token) {
      this.setToken(response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }

    return response;
  }

  async register(userData) {
    return await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
      includeAuth: false
    });
  }

  async getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        console.warn('解析本地用户信息失败:', e);
      }
    }

    const response = await this.request('/auth/me');
    if (response && response.user) {
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response ? response.user : null;
  }

  async logout() {
    this.clearTokens();
    localStorage.removeItem('user');
  }

  // 产品相关API
  async getProducts(params = {}) {
    const queryParams = new URLSearchParams(params);
    return await this.request(`/products?${queryParams}`);
  }

  async getProduct(productId) {
    return await this.request(`/products/${productId}`);
  }

  async createProduct(productData) {
    return await this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  }

  async updateProduct(productId, productData) {
    return await this.request(`/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
  }

  async deleteProduct(productId) {
    return await this.request(`/products/${productId}`, {
      method: 'DELETE'
    });
  }

  // 库存相关API
  async getInventory(params = {}) {
    const queryParams = new URLSearchParams(params);
    return await this.request(`/inventory?${queryParams}`);
  }

  async lockInventory(productId, warehouseCode, quantity, shipmentId) {
    return await this.request(`/inventory/${productId}/${warehouseCode}/lock?quantity=${quantity}&shipmentId=${shipmentId}`, {
      method: 'POST'
    });
  }

  // 发货任务相关API
  async getShipments(params = {}) {
    const queryParams = new URLSearchParams(params);
    return await this.request(`/shipments?${queryParams}`);
  }

  async getShipment(shipmentId) {
    return await this.request(`/shipments/${shipmentId}`);
  }

  async createShipment(shipmentData) {
    return await this.request('/shipments', {
      method: 'POST',
      body: JSON.stringify(shipmentData)
    });
  }

  async updateShipment(shipmentId, shipmentData) {
    return await this.request(`/shipments/${shipmentId}`, {
      method: 'PUT',
      body: JSON.stringify(shipmentData)
    });
  }

  async cancelShipment(shipmentId) {
    return await this.request(`/shipments/${shipmentId}`, {
      method: 'DELETE'
    });
  }

  // 统计分析相关API
  async getAnalyticsSummary(startDate, endDate) {
    const params = new URLSearchParams({
      startDate,
      endDate
    });
    return await this.request(`/analytics/summary?${params}`);
  }

  // 文件上传相关API
  async uploadFile(file, fileType, relatedId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);
    if (relatedId) {
      formData.append('relatedId', relatedId);
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}/files/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `文件上传失败: ${response.status}`);
    }

    return await response.json();
  }
}

// 格式化工具函数
window.api = {
  // 初始化API客户端
  init: function() {
    this.client = new APIClient();
    return this.client;
  },

  // 认证相关
  login: async function(email, password) {
    return await this.client.login(email, password);
  },

  register: async function(userData) {
    return await this.client.register(userData);
  },

  getCurrentUser: async function() {
    return await this.client.getCurrentUser();
  },

  logout: function() {
    this.client.logout();
  },

  // 产品相关
  getProducts: async function(params = {}) {
    return await this.client.getProducts(params);
  },

  getProduct: async function(productId) {
    return await this.client.getProduct(productId);
  },

  createProduct: async function(productData) {
    return await this.client.createProduct(productData);
  },

  updateProduct: async function(productId, productData) {
    return await this.client.updateProduct(productId, productData);
  },

  deleteProduct: async function(productId) {
    return await this.client.deleteProduct(productId);
  },

  // 库存相关
  getInventory: async function(params = {}) {
    return await this.client.getInventory(params);
  },

  // 发货任务相关
  getShipments: async function(params = {}) {
    return await this.client.getShipments(params);
  },

  getShipment: async function(shipmentId) {
    return await this.client.getShipment(shipmentId);
  },

  createShipment: async function(shipmentData) {
    return await this.client.createShipment(shipmentData);
  },

  updateShipment: async function(shipmentId, shipmentData) {
    return await this.client.updateShipment(shipmentId, shipmentData);
  },

  cancelShipment: async function(shipmentId) {
    return await this.client.cancelShipment(shipmentId);
  },

  // 统计相关
  getAnalyticsSummary: async function(startDate, endDate) {
    return await this.client.getAnalyticsSummary(startDate, endDate);
  },

  // 文件上传
  uploadFile: async function(file, fileType, relatedId) {
    return await this.client.uploadFile(file, fileType, relatedId);
  },

  // 工具函数
  formatCurrency: function(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  formatDate: function(dateString) {
    return new Date(dateString).toLocaleDateString('zh-CN');
  },

  validateEmail: function(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  // 替换之前的localStorage操作
  setUser: function(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser: function() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setToken: function(token) {
    localStorage.setItem('token', token);
  },

  getToken: function() {
    return localStorage.getItem('token');
  },

  clearAuthData: function() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// 自动初始化API客户端
document.addEventListener('DOMContentLoaded', function() {
  if (typeof window.api.init === 'function') {
    window.api.init();
  }
});

// 提供兼容性函数，逐步替换旧的localStorage调用
window.localStorageGetUser = function() {
  console.warn('使用已弃用的localStorageGetUser函数，建议使用window.api.getUser()');
  return window.api.getUser();
};

window.localStorageSetUser = function(user) {
  console.warn('使用已弃用的localStorageSetUser函数，建议使用window.api.setUser(user)');
  return window.api.setUser(user);
};