// API接口配置
const API_BASE_URL = 'https://your-render-app-url.onrender.com'; // 替换为您的Render部署URL

// 通用API请求函数
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...options
    };

    if (options.body && typeof options.body !== 'string') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        // 如果响应不是JSON格式，则返回文本
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } else {
            const text = await response.text();
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return text;
        }
    } catch (error) {
        console.error('API请求错误:', error);
        throw error;
    }
}

// 用户认证相关API
const authAPI = {
    // 用户登录
    async login(email, password) {
        return apiRequest('/api/auth/login', {
            method: 'POST',
            body: { email, password }
        });
    },

    // 用户注册
    async register(userData) {
        return apiRequest('/api/auth/register', {
            method: 'POST',
            body: userData
        });
    },

    // 获取当前用户信息
    async getCurrentUser() {
        return apiRequest('/api/auth/me');
    },

    // 更新用户信息
    async updateProfile(profileData) {
        return apiRequest('/api/auth/profile', {
            method: 'PUT',
            body: profileData
        });
    },

    // 更改密码
    async changePassword(passwordData) {
        return apiRequest('/api/auth/change-password', {
            method: 'PUT',
            body: passwordData
        });
    }
};

// 产品相关API
const productAPI = {
    // 获取产品列表
    async getProducts(filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/products?${params}`);
    },

    // 获取单个产品
    async getProduct(productId) {
        return apiRequest(`/api/products/${productId}`);
    },

    // 创建产品
    async createProduct(productData) {
        return apiRequest('/api/products', {
            method: 'POST',
            body: productData
        });
    },

    // 更新产品
    async updateProduct(productId, productData) {
        return apiRequest(`/api/products/${productId}`, {
            method: 'PUT',
            body: productData
        });
    },

    // 删除产品
    async deleteProduct(productId) {
        return apiRequest(`/api/products/${productId}`, {
            method: 'DELETE'
        });
    },

    // 上传产品图片
    async uploadProductImage(file) {
        const formData = new FormData();
        formData.append('image', file);

        const token = localStorage.getItem('token');
        return fetch(`${API_BASE_URL}/api/products/upload-image`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(response => response.json());
    }
};

// 库存相关API
const inventoryAPI = {
    // 获取库存列表
    async getInventory(filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/inventory?${params}`);
    },

    // 获取单个库存记录
    async getInventoryById(inventoryId) {
        return apiRequest(`/api/inventory/${inventoryId}`);
    },

    // 更新库存
    async updateInventory(inventoryId, quantityChange) {
        return apiRequest(`/api/inventory/${inventoryId}/adjust`, {
            method: 'PUT',
            body: { quantityChange }
        });
    },

    // 锁定库存
    async lockInventory(productId, quantity) {
        return apiRequest('/api/inventory/lock', {
            method: 'POST',
            body: { productId, quantity }
        });
    },

    // 释放库存锁定
    async releaseInventoryLock(lockId) {
        return apiRequest(`/api/inventory/lock/${lockId}/release`, {
            method: 'POST'
        });
    },

    // 确认库存锁定（扣减库存）
    async confirmInventoryLock(lockId) {
        return apiRequest(`/api/inventory/lock/${lockId}/confirm`, {
            method: 'POST'
        });
    }
};

// 发货任务相关API
const shipmentAPI = {
    // 获取发货任务列表
    async getShipments(filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/shipments?${params}`);
    },

    // 获取单个发货任务
    async getShipment(shipmentId) {
        return apiRequest(`/api/shipments/${shipmentId}`);
    },

    // 创建发货任务
    async createShipment(shipmentData) {
        return apiRequest('/api/shipments', {
            method: 'POST',
            body: shipmentData
        });
    },

    // 更新发货任务
    async updateShipment(shipmentId, shipmentData) {
        return apiRequest(`/api/shipments/${shipmentId}`, {
            method: 'PUT',
            body: shipmentData
        });
    },

    // 删除发货任务
    async deleteShipment(shipmentId) {
        return apiRequest(`/api/shipments/${shipmentId}`, {
            method: 'DELETE'
        });
    },

    // 更新发货任务状态
    async updateShipmentStatus(shipmentId, status) {
        return apiRequest(`/api/shipments/${shipmentId}/status`, {
            method: 'PUT',
            body: { status }
        });
    },

    // 上传发货任务文件
    async uploadShipmentFile(shipmentId, file, fileType) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', fileType);

        const token = localStorage.getItem('token');
        return fetch(`${API_BASE_URL}/api/shipments/${shipmentId}/upload-file`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(response => response.json());
    }
};

// 统计分析相关API
const analyticsAPI = {
    // 获取统计摘要
    async getAnalyticsSummary(filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/analytics/summary?${params}`);
    },

    // 获取月度趋势
    async getMonthlyTrends(filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/analytics/monthly-trends?${params}`);
    },

    // 获取产品表现
    async getProductPerformance(filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/analytics/product-performance?${params}`);
    },

    // 获取用户表现
    async getUserPerformance(filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/analytics/user-performance?${params}`);
    },

    // 获取CSV报表
    async getReportCSV(filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/analytics/report.csv?${params}`);
    }
};

// 文件上传相关API
const fileAPI = {
    // 上传文件到R2
    async uploadFile(file, folder = 'general') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const token = localStorage.getItem('token');
        return fetch(`${API_BASE_URL}/api/files/upload`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(response => response.json());
    },

    // 删除文件
    async deleteFile(fileId) {
        return apiRequest(`/api/files/${fileId}`, {
            method: 'DELETE'
        });
    },

    // 获取用户文件列表
    async getUserFiles(userId, filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/files/user/${userId}?${params}`);
    }
};

// 用户相关API
const userAPI = {
    // 获取用户列表
    async getUsers(filters = {}) {
        const params = new URLSearchParams(filters);
        return apiRequest(`/api/users?${params}`);
    },

    // 获取单个用户
    async getUser(userId) {
        return apiRequest(`/api/users/${userId}`);
    },

    // 创建用户
    async createUser(userData) {
        return apiRequest('/api/users', {
            method: 'POST',
            body: userData
        });
    },

    // 更新用户
    async updateUser(userId, userData) {
        return apiRequest(`/api/users/${userId}`, {
            method: 'PUT',
            body: userData
        });
    },

    // 删除用户
    async deleteUser(userId) {
        return apiRequest(`/api/users/${userId}`, {
            method: 'DELETE'
        });
    }
};

// 封装所有API
const API = {
    auth: authAPI,
    product: productAPI,
    inventory: inventoryAPI,
    shipment: shipmentAPI,
    analytics: analyticsAPI,
    file: fileAPI,
    user: userAPI
};

// 导出API对象
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.API = API;
}