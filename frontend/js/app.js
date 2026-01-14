// 跨境发货管理系统前端应用
class ShippingApp {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        // 登录表单事件
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // 退出登录按钮事件
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
        });

        // 导航菜单事件
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.getAttribute('data-page');
                if (page) {
                    this.showPage(page);
                }
            });
        });

        // 页面元素事件
        document.getElementById('addProductBtn')?.addEventListener('click', () => {
            this.showAddProductModal();
        });

        document.getElementById('createShipmentBtn')?.addEventListener('click', () => {
            this.showCreateShipmentModal();
        });

        document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
            this.exportAnalyticsToCsv();
        });

        // 模态框关闭事件
        document.querySelector('.close')?.addEventListener('click', () => {
            this.hideModal();
        });

        // 点击模态框外部关闭
        document.getElementById('modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.hideModal();
            }
        });

        // 时间筛选器事件
        document.getElementById('timeFilter')?.addEventListener('change', () => {
            this.loadAnalytics();
        });

        // 用户筛选器事件
        document.getElementById('userFilter')?.addEventListener('change', () => {
            this.loadAnalytics();
        });

        // 个人资料表单事件
        document.getElementById('profileForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                this.currentUser = await API.auth.getCurrentUser();
                this.showMainPage();
                this.loadDashboardData();
            } catch (error) {
                console.error('获取用户信息失败:', error);
                localStorage.removeItem('token');
                this.showLoginPage();
            }
        } else {
            this.showLoginPage();
        }
    }

    showLoginPage() {
        document.getElementById('loginPage').style.display = 'block';
        document.getElementById('mainPage').style.display = 'none';
    }

    showMainPage() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainPage').style.display = 'flex';

        // 设置用户信息
        this.updateUserInfoDisplay();

        // 显示默认页面
        this.showPage(this.currentPage);
    }

    updateUserInfoDisplay() {
        if (this.currentUser) {
            // 可以在这里更新侧边栏或其他用户相关信息
            document.title = `${this.currentUser.name} - 跨境发货管理系统`;
        }
    }

    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await API.auth.login(email, password);
            
            if (response.token) {
                localStorage.setItem('token', response.token);
                this.currentUser = response.user;
                this.showMainPage();
                this.loadDashboardData();
                
                // 清除错误消息
                this.showError(null);
            }
        } catch (error) {
            console.error('登录失败:', error);
            this.showError(error.message || '登录失败，请检查邮箱和密码');
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (message) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        } else {
            errorDiv.style.display = 'none';
        }
    }

    logout() {
        localStorage.removeItem('token');
        this.currentUser = null;
        this.showLoginPage();
    }

    showPage(pageName) {
        // 隐藏所有内容部分
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });

        // 显示选定的页面
        document.getElementById(pageName).style.display = 'block';

        // 更新导航菜单激活状态
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

        // 根据页面加载数据
        switch (pageName) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'products':
                this.loadProducts();
                break;
            case 'shipments':
                this.loadShipments();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'profile':
                this.loadProfile();
                break;
        }

        this.currentPage = pageName;
    }

    async loadDashboardData() {
        try {
            // 加载统计信息
            const summary = await API.analytics.getAnalyticsSummary();
            document.getElementById('totalProducts').textContent = summary.totalProducts || 0;
            document.getElementById('totalShipments').textContent = summary.totalShipments || 0;
            document.getElementById('totalRevenue').textContent = `¥${(summary.totalRevenue || 0).toLocaleString()}`;
            document.getElementById('totalProfit').textContent = `¥${(summary.totalProfit || 0).toLocaleString()}`;

            // 加载最近发货任务
            const recentShipments = await API.shipment.getShipments({ limit: 5, sortBy: 'createdAt', order: 'desc' });
            this.displayRecentShipments(recentShipments);

            // 加载库存预警
            const lowStockProducts = await API.inventory.getInventory({ lowStock: true });
            this.displayInventoryAlerts(lowStockProducts);
        } catch (error) {
            console.error('加载仪表盘数据失败:', error);
        }
    }

    displayRecentShipments(shipments) {
        const container = document.getElementById('recentShipmentsList');
        if (!container) return;

        if (shipments.length === 0) {
            container.innerHTML = '<p>暂无最近的发货任务</p>';
            return;
        }

        container.innerHTML = shipments.map(shipment => `
            <div class="list-item">
                <div class="item-header">
                    <strong>${shipment.shipmentId}</strong>
                    <span class="status-badge status-${shipment.status}">${this.getStatusText(shipment.status)}</span>
                </div>
                <div class="item-details">
                    <p>产品: ${shipment.product?.name || 'N/A'}</p>
                    <p>数量: ${shipment.quantity}</p>
                    <p>客户: ${shipment.customer}</p>
                    <p>时间: ${new Date(shipment.createdAt).toLocaleString()}</p>
                </div>
            </div>
        `).join('');
    }

    displayInventoryAlerts(products) {
        const container = document.getElementById('inventoryAlertsList');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<p>暂无库存预警</p>';
            return;
        }

        container.innerHTML = products.map(product => `
            <div class="list-item">
                <div class="item-header">
                    <strong>${product.product?.name || 'N/A'}</strong>
                    <span class="status-badge status-pending">库存低</span>
                </div>
                <div class="item-details">
                    <p>货号: ${product.product?.sku || 'N/A'}</p>
                    <p>当前库存: ${product.currentQuantity}</p>
                    <p>最低库存: ${product.minQuantity}</p>
                </div>
            </div>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            pending: '待处理',
            processing: '处理中',
            shipped: '已发货',
            delivered: '已送达',
            cancelled: '已取消'
        };
        return statusMap[status] || status;
    }

    async loadProducts() {
        try {
            const products = await API.product.getProducts();
            this.displayProducts(products);
        } catch (error) {
            console.error('加载产品失败:', error);
        }
    }

    displayProducts(products) {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9">暂无产品</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(product => `
            <tr>
                <td>${product.sku}</td>
                <td>${product.name}</td>
                <td>${product.supplier}</td>
                <td>${product.inventory?.currentQuantity || 0}</td>
                <td>¥${product.costPrice?.toLocaleString() || 0}</td>
                <td>¥${product.salePrice?.toLocaleString() || 0}</td>
                <td>${product.profitMargin ? (product.profitMargin * 100).toFixed(2) + '%' : '0%'}</td>
                <td>
                    ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover;">` : '无图片'}
                </td>
                <td>
                    <button class="btn btn-secondary" onclick="app.editProduct('${product.id}')">编辑</button>
                    <button class="btn btn-danger" onclick="app.deleteProduct('${product.id}')">删除</button>
                </td>
            </tr>
        `).join('');
    }

    async loadShipments() {
        try {
            const shipments = await API.shipment.getShipments();
            this.displayShipments(shipments);
        } catch (error) {
            console.error('加载发货任务失败:', error);
        }
    }

    displayShipments(shipments) {
        const tbody = document.getElementById('shipmentsTableBody');
        if (!tbody) return;

        if (shipments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">暂无发货任务</td></tr>';
            return;
        }

        tbody.innerHTML = shipments.map(shipment => `
            <tr>
                <td>${shipment.shipmentId}</td>
                <td>${shipment.product?.name || 'N/A'}</td>
                <td>${shipment.quantity}</td>
                <td>${shipment.customer || 'N/A'}</td>
                <td>${shipment.destination || 'N/A'}</td>
                <td><span class="status-badge status-${shipment.status}">${this.getStatusText(shipment.status)}</span></td>
                <td>${new Date(shipment.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-secondary" onclick="app.editShipment('${shipment.id}')">编辑</button>
                    <button class="btn btn-primary" onclick="app.updateShipmentStatus('${shipment.id}', '${shipment.status === 'shipped' ? 'delivered' : 'shipped'}')">
                        ${shipment.status === 'shipped' ? '标记为已送达' : '标记为已发货'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async loadAnalytics() {
        try {
            const timeFilter = document.getElementById('timeFilter').value;
            const userFilter = document.getElementById('userFilter').value;

            const filters = { timeRange: timeFilter };
            if (userFilter) {
                filters.userId = userFilter;
            }

            const analytics = await API.analytics.getAnalyticsSummary(filters);
            this.displayAnalytics(analytics);

            // 加载用户筛选器选项
            this.loadUserFilterOptions();
        } catch (error) {
            console.error('加载统计分析失败:', error);
        }
    }

    displayAnalytics(analytics) {
        document.getElementById('analyticsShipments').textContent = analytics.totalShipments || 0;
        document.getElementById('analyticsRevenue').textContent = `¥${(analytics.totalRevenue || 0).toLocaleString()}`;
        document.getElementById('analyticsProfit').textContent = `¥${(analytics.totalProfit || 0).toLocaleString()}`;
        document.getElementById('analyticsMargin').textContent = `${((analytics.averageProfitMargin || 0) * 100).toFixed(2)}%`;

        // 显示销量排行
        const salesRanking = document.getElementById('salesRanking');
        if (salesRanking && analytics.salesRanking) {
            salesRanking.innerHTML = analytics.salesRanking.slice(0, 5).map((item, index) => `
                <div class="list-item">
                    <div class="item-header">
                        <span class="rank">#${index + 1}</span>
                        <strong>${item.productName}</strong>
                    </div>
                    <div class="item-details">
                        <p>销量: ${item.quantity}</p>
                        <p>销售额: ¥${item.revenue.toLocaleString()}</p>
                    </div>
                </div>
            `).join('');
        }

        // 显示利润排行
        const profitRanking = document.getElementById('profitRanking');
        if (profitRanking && analytics.profitRanking) {
            profitRanking.innerHTML = analytics.profitRanking.slice(0, 5).map((item, index) => `
                <div class="list-item">
                    <div class="item-header">
                        <span class="rank">#${index + 1}</span>
                        <strong>${item.productName}</strong>
                    </div>
                    <div class="item-details">
                        <p>利润: ¥${item.profit.toLocaleString()}</p>
                        <p>利润率: ${(item.profitMargin * 100).toFixed(2)}%</p>
                    </div>
                </div>
            `).join('');
        }
    }

    async loadUserFilterOptions() {
        try {
            const users = await API.user.getUsers();
            const userFilter = document.getElementById('userFilter');
            if (!userFilter) return;

            // 保存当前选中的值
            const currentValue = userFilter.value;

            // 清空选项
            userFilter.innerHTML = '<option value="">全部用户</option>';

            // 添加用户选项
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.name} (${user.email})`;
                userFilter.appendChild(option);
            });

            // 恢复之前的选中值
            userFilter.value = currentValue;
        } catch (error) {
            console.error('加载用户选项失败:', error);
        }
    }

    async loadProfile() {
        if (!this.currentUser) return;

        document.getElementById('profileName').value = this.currentUser.name || '';
        document.getElementById('profileEmail').value = this.currentUser.email || '';
        document.getElementById('profileRole').value = this.currentUser.role || '';
        document.getElementById('profileCompany').value = this.currentUser.company || '';
    }

    async updateProfile() {
        const profileData = {
            name: document.getElementById('profileName').value,
            company: document.getElementById('profileCompany').value
        };

        const newPassword = document.getElementById('profilePassword').value;
        if (newPassword.trim()) {
            profileData.password = newPassword;
        }

        try {
            const response = await API.auth.updateProfile(profileData);
            this.currentUser = response.user;
            alert('资料更新成功！');
        } catch (error) {
            console.error('更新资料失败:', error);
            alert('更新资料失败：' + error.message);
        }
    }

    showAddProductModal() {
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;

        modalBody.innerHTML = `
            <form id="addProductForm">
                <div class="form-group">
                    <label for="productSku">货号 *</label>
                    <input type="text" id="productSku" name="sku" required>
                </div>
                <div class="form-group">
                    <label for="productName">名称 *</label>
                    <input type="text" id="productName" name="name" required>
                </div>
                <div class="form-group">
                    <label for="productSupplier">供应商</label>
                    <input type="text" id="productSupplier" name="supplier">
                </div>
                <div class="form-group">
                    <label for="productCostPrice">进货价</label>
                    <input type="number" id="productCostPrice" name="costPrice" step="0.01">
                </div>
                <div class="form-group">
                    <label for="productSalePrice">销售价</label>
                    <input type="number" id="productSalePrice" name="salePrice" step="0.01">
                </div>
                <div class="form-group">
                    <label for="productDescription">描述</label>
                    <textarea id="productDescription" name="description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label for="productImage">产品图片</label>
                    <input type="file" id="productImage" name="image" accept="image/*">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.hideModal()">取消</button>
                    <button type="submit" class="btn btn-primary">添加产品</button>
                </div>
            </form>
        `;

        // 显示模态框
        this.showModal('添加产品');

        // 添加表单提交事件
        document.getElementById('addProductForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addProduct();
        });
    }

    async addProduct() {
        const formData = new FormData(document.getElementById('addProductForm'));
        
        const productData = {
            sku: formData.get('sku'),
            name: formData.get('name'),
            supplier: formData.get('supplier'),
            costPrice: parseFloat(formData.get('costPrice')),
            salePrice: parseFloat(formData.get('salePrice')),
            description: formData.get('description')
        };

        try {
            // 如果有图片文件，先上传图片
            const imageFile = document.getElementById('productImage').files[0];
            if (imageFile) {
                const imageResponse = await API.product.uploadProductImage(imageFile);
                productData.imageUrl = imageResponse.url;
            }

            await API.product.createProduct(productData);
            this.hideModal();
            this.loadProducts(); // 重新加载产品列表
            alert('产品添加成功！');
        } catch (error) {
            console.error('添加产品失败:', error);
            alert('添加产品失败：' + error.message);
        }
    }

    async editProduct(productId) {
        try {
            const product = await API.product.getProduct(productId);
            
            const modalBody = document.getElementById('modalBody');
            if (!modalBody) return;

            modalBody.innerHTML = `
                <form id="editProductForm">
                    <input type="hidden" id="editProductId" value="${product.id}">
                    <div class="form-group">
                        <label for="editProductSku">货号 *</label>
                        <input type="text" id="editProductSku" name="sku" value="${product.sku}" required>
                    </div>
                    <div class="form-group">
                        <label for="editProductName">名称 *</label>
                        <input type="text" id="editProductName" name="name" value="${product.name}" required>
                    </div>
                    <div class="form-group">
                        <label for="editProductSupplier">供应商</label>
                        <input type="text" id="editProductSupplier" name="supplier" value="${product.supplier || ''}">
                    </div>
                    <div class="form-group">
                        <label for="editProductCostPrice">进货价</label>
                        <input type="number" id="editProductCostPrice" name="costPrice" step="0.01" value="${product.costPrice || ''}">
                    </div>
                    <div class="form-group">
                        <label for="editProductSalePrice">销售价</label>
                        <input type="number" id="editProductSalePrice" name="salePrice" step="0.01" value="${product.salePrice || ''}">
                    </div>
                    <div class="form-group">
                        <label for="editProductDescription">描述</label>
                        <textarea id="editProductDescription" name="description" rows="3">${product.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="editProductImage">产品图片</label>
                        <input type="file" id="editProductImage" name="image" accept="image/*">
                        ${product.imageUrl ? `<img src="${product.imageUrl}" alt="Current Image" style="width: 100px; height: 100px; object-fit: cover; margin-top: 10px;">` : ''}
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="app.hideModal()">取消</button>
                        <button type="submit" class="btn btn-primary">更新产品</button>
                    </div>
                </form>
            `;

            // 显示模态框
            this.showModal('编辑产品');

            // 添加表单提交事件
            document.getElementById('editProductForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.updateProduct();
            });
        } catch (error) {
            console.error('加载产品信息失败:', error);
            alert('加载产品信息失败：' + error.message);
        }
    }

    async updateProduct() {
        const productId = document.getElementById('editProductId').value;
        const formData = new FormData(document.getElementById('editProductForm'));
        
        const productData = {
            sku: formData.get('sku'),
            name: formData.get('name'),
            supplier: formData.get('supplier'),
            costPrice: parseFloat(formData.get('costPrice')),
            salePrice: parseFloat(formData.get('salePrice')),
            description: formData.get('description')
        };

        try {
            // 如果有新图片文件，上传新图片
            const imageFile = document.getElementById('editProductImage').files[0];
            if (imageFile) {
                const imageResponse = await API.product.uploadProductImage(imageFile);
                productData.imageUrl = imageResponse.url;
            }

            await API.product.updateProduct(productId, productData);
            this.hideModal();
            this.loadProducts(); // 重新加载产品列表
            alert('产品更新成功！');
        } catch (error) {
            console.error('更新产品失败:', error);
            alert('更新产品失败：' + error.message);
        }
    }

    async deleteProduct(productId) {
        if (!confirm('确定要删除这个产品吗？此操作不可撤销。')) {
            return;
        }

        try {
            await API.product.deleteProduct(productId);
            this.loadProducts(); // 重新加载产品列表
            alert('产品删除成功！');
        } catch (error) {
            console.error('删除产品失败:', error);
            alert('删除产品失败：' + error.message);
        }
    }

    showCreateShipmentModal() {
        // 首先加载产品列表
        API.product.getProducts().then(products => {
            const modalBody = document.getElementById('modalBody');
            if (!modalBody) return;

            modalBody.innerHTML = `
                <form id="createShipmentForm">
                    <div class="form-group">
                        <label for="shipmentProduct">选择产品 *</label>
                        <select id="shipmentProduct" name="productId" required>
                            <option value="">请选择产品</option>
                            ${products.map(product => `
                                <option value="${product.id}" data-stock="${product.inventory?.currentQuantity || 0}">
                                    ${product.name} (库存: ${product.inventory?.currentQuantity || 0})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="shipmentQuantity">数量 *</label>
                        <input type="number" id="shipmentQuantity" name="quantity" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="shipmentCustomer">客户</label>
                        <input type="text" id="shipmentCustomer" name="customer">
                    </div>
                    <div class="form-group">
                        <label for="shipmentDestination">目的地</label>
                        <input type="text" id="shipmentDestination" name="destination">
                    </div>
                    <div class="form-group">
                        <label for="shipmentNotes">备注</label>
                        <textarea id="shipmentNotes" name="notes" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>上传文件 (最多4个)</label>
                        <div class="file-upload" onclick="document.getElementById('shipmentFiles').click()">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>点击上传文件 (本体码、条码、警示码、箱唛)</p>
                        </div>
                        <input type="file" id="shipmentFiles" class="hidden-file-input" multiple accept=".pdf,.jpg,.jpeg,.png">
                        <div id="selectedFilesList"></div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="app.hideModal()">取消</button>
                        <button type="submit" class="btn btn-primary">创建任务</button>
                    </div>
                </form>
            `;

            // 添加文件选择事件
            document.getElementById('shipmentFiles').addEventListener('change', this.handleFileSelection.bind(this));

            // 添加产品选择事件，更新库存显示
            document.getElementById('shipmentProduct').addEventListener('change', this.handleProductSelection.bind(this));

            // 显示模态框
            this.showModal('创建发货任务');

            // 添加表单提交事件
            document.getElementById('createShipmentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.createShipment();
            });
        }).catch(error => {
            console.error('加载产品列表失败:', error);
            alert('加载产品列表失败：' + error.message);
        });
    }

    handleFileSelection(event) {
        const files = Array.from(event.target.files);
        const fileList = document.getElementById('selectedFilesList');
        
        if (files.length > 0) {
            fileList.innerHTML = `
                <div class="selected-files">
                    <h4>已选择的文件:</h4>
                    <ul>
                        ${files.slice(0, 4).map(file => `
                            <li>
                                <i class="fas fa-file"></i>
                                ${file.name} (${(file.size / 1024).toFixed(2)} KB)
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            fileList.innerHTML = '';
        }
    }

    handleProductSelection(event) {
        const selectedOption = event.target.selectedOptions[0];
        const stock = selectedOption ? parseInt(selectedOption.getAttribute('data-stock')) : 0;
        
        // 更新数量输入框的最大值
        const quantityInput = document.getElementById('shipmentQuantity');
        if (quantityInput) {
            quantityInput.max = stock;
            quantityInput.placeholder = `最大数量: ${stock}`;
        }
    }

    async createShipment() {
        const formData = new FormData(document.getElementById('createShipmentForm'));
        
        const shipmentData = {
            productId: formData.get('productId'),
            quantity: parseInt(formData.get('quantity')),
            customer: formData.get('customer'),
            destination: formData.get('destination'),
            notes: formData.get('notes')
        };

        try {
            // 首先锁定库存
            await API.inventory.lockInventory(shipmentData.productId, shipmentData.quantity);

            // 创建发货任务
            const shipment = await API.shipment.createShipment(shipmentData);

            // 上传文件
            const fileInput = document.getElementById('shipmentFiles');
            if (fileInput && fileInput.files.length > 0) {
                const files = Array.from(fileInput.files).slice(0, 4);
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    // 根据文件类型确定fileType
                    let fileType = 'other';
                    if (file.name.toLowerCase().includes('本体码')) fileType = 'body_code';
                    else if (file.name.toLowerCase().includes('条码')) fileType = 'barcode';
                    else if (file.name.toLowerCase().includes('警示码')) fileType = 'warning_code';
                    else if (file.name.toLowerCase().includes('箱唛')) fileType = 'carton_mark';

                    await API.shipment.uploadShipmentFile(shipment.id, file, fileType);
                }
            }

            this.hideModal();
            this.loadShipments(); // 重新加载发货任务列表
            alert('发货任务创建成功！');
        } catch (error) {
            console.error('创建发货任务失败:', error);
            alert('创建发货任务失败：' + error.message);
        }
    }

    async editShipment(shipmentId) {
        try {
            const shipment = await API.shipment.getShipment(shipmentId);
            const products = await API.product.getProducts();
            
            const modalBody = document.getElementById('modalBody');
            if (!modalBody) return;

            modalBody.innerHTML = `
                <form id="editShipmentForm">
                    <input type="hidden" id="editShipmentId" value="${shipment.id}">
                    <div class="form-group">
                        <label for="editShipmentProduct">产品</label>
                        <select id="editShipmentProduct" name="productId">
                            ${products.map(product => `
                                <option value="${product.id}" ${product.id === shipment.productId ? 'selected' : ''}>
                                    ${product.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editShipmentQuantity">数量</label>
                        <input type="number" id="editShipmentQuantity" name="quantity" value="${shipment.quantity}" min="1">
                    </div>
                    <div class="form-group">
                        <label for="editShipmentCustomer">客户</label>
                        <input type="text" id="editShipmentCustomer" name="customer" value="${shipment.customer || ''}">
                    </div>
                    <div class="form-group">
                        <label for="editShipmentDestination">目的地</label>
                        <input type="text" id="editShipmentDestination" name="destination" value="${shipment.destination || ''}">
                    </div>
                    <div class="form-group">
                        <label for="editShipmentNotes">备注</label>
                        <textarea id="editShipmentNotes" name="notes" rows="3">${shipment.notes || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="app.hideModal()">取消</button>
                        <button type="submit" class="btn btn-primary">更新任务</button>
                    </div>
                </form>
            `;

            // 显示模态框
            this.showModal('编辑发货任务');

            // 添加表单提交事件
            document.getElementById('editShipmentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.updateShipment();
            });
        } catch (error) {
            console.error('加载发货任务信息失败:', error);
            alert('加载发货任务信息失败：' + error.message);
        }
    }

    async updateShipment() {
        const shipmentId = document.getElementById('editShipmentId').value;
        const formData = new FormData(document.getElementById('editShipmentForm'));
        
        const shipmentData = {
            productId: formData.get('productId'),
            quantity: parseInt(formData.get('quantity')),
            customer: formData.get('customer'),
            destination: formData.get('destination'),
            notes: formData.get('notes')
        };

        try {
            await API.shipment.updateShipment(shipmentId, shipmentData);
            this.hideModal();
            this.loadShipments(); // 重新加载发货任务列表
            alert('发货任务更新成功！');
        } catch (error) {
            console.error('更新发货任务失败:', error);
            alert('更新发货任务失败：' + error.message);
        }
    }

    async updateShipmentStatus(shipmentId, newStatus) {
        if (!confirm(`确定要将此任务状态更新为 ${this.getStatusText(newStatus)} 吗？`)) {
            return;
        }

        try {
            await API.shipment.updateShipmentStatus(shipmentId, newStatus);
            this.loadShipments(); // 重新加载发货任务列表
            alert('任务状态更新成功！');
        } catch (error) {
            console.error('更新任务状态失败:', error);
            alert('更新任务状态失败：' + error.message);
        }
    }

    async exportAnalyticsToCsv() {
        try {
            const timeFilter = document.getElementById('timeFilter').value;
            const userFilter = document.getElementById('userFilter').value;

            const filters = { timeRange: timeFilter };
            if (userFilter) {
                filters.userId = userFilter;
            }

            const csvData = await API.analytics.getReportCSV(filters);

            // 创建下载链接
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `analytics_report_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('导出CSV失败:', error);
            alert('导出CSV失败：' + error.message);
        }
    }

    showModal(title) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modal').style.display = 'block';
    }

    hideModal() {
        document.getElementById('modal').style.display = 'none';
    }
}

// 初始化应用
const app = new ShippingApp();

// 在全局作用域暴露方法，以便在HTML中使用
window.app = app;