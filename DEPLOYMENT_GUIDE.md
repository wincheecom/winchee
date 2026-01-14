# 跨境发货管理系统 - 部署指南

## 项目概述

跨境发货管理系统是一个多用户并发操作的Web应用程序，支持库存管理、发货任务跟踪、统计分析等功能。系统采用前后端分离架构，后端使用Node.js + Express + PostgreSQL，前端使用原生HTML/CSS/JS。

## 技术栈

- **前端**: HTML/CSS/JS (适配API调用)
- **后端**: Node.js + Express
- **数据库**: PostgreSQL (Render托管)
- **文件存储**: Cloudflare R2
- **部署平台**: Render.com

## 核心功能

1. **多用户并发登录和操作**
2. **并发创建发货任务（带库存锁定）**
3. **按用户隔离的统计分析**
4. **角色权限控制（管理员、销售、仓库）**

## 项目结构

```
cross-border-shipping-system/
├── .env.example                 # 环境变量示例文件
├── .gitignore                   # Git忽略文件配置
├── README.md                   # 项目说明文档
├── DEPLOYMENT_GUIDE.md         # 部署指南
├── render.yaml                 # Render部署配置
├── package.json                # Node.js包配置
├── server.js                   # 服务器入口文件
├── openapi.yaml                # API接口文档
├──
├── routes/                     # API路由文件夹
│   ├── auth.js                 # 认证相关路由
│   ├── products.js             # 产品相关路由
│   ├── inventory.js            # 库存相关路由
│   ├── shipments.js            # 发货任务相关路由
│   ├── analytics.js            # 统计分析相关路由
│   └── files.js                # 文件上传相关路由
├──
├── utils/                      # 工具函数文件夹
│   ├── auth.js                 # 认证和权限系统
│   ├── inventory.js            # 库存锁定机制
│   ├── file.js                 # 文件上传功能
│   └── analytics.js            # 统计分析功能
├──
├── scripts/                    # 脚本文件夹
│   └── migrate.js              # 数据库迁移脚本
└──
└── frontend_api_integration.js # 前端API集成指南
```

## 系统架构

### 数据库设计
- 用户表 (users): 存储用户信息和权限
- 产品表 (products): 存储产品信息
- 库存表 (inventory): 存储库存信息，含可用数量计算字段
- 发货任务表 (shipment_tasks): 存储发货任务信息
- 发货任务详情表 (shipment_items): 存储发货任务中的产品详情
- 库存锁定表 (inventory_locks): 防止并发超卖的关键表
- 库存变更记录表 (inventory_transactions): 记录库存变动历史
- 文件表 (files): 存储文件元数据
- 活动日志表 (activity_logs): 记录用户操作日志
- 统计缓存表 (statistics_cache): 缓存统计数据

### API设计
- 认证相关 (/auth/*): 登录、注册、获取用户信息
- 产品管理 (/products/*): CRUD操作
- 库存管理 (/inventory/*): 库存查询、锁定
- 发货任务 (/shipments/*): 发货任务管理
- 统计分析 (/analytics/*): 数据统计
- 文件上传 (/files/*): 文件上传管理

### 并发控制机制
- 库存锁定机制：防止并发超卖
- 乐观锁/悲观锁：确保数据一致性
- 定时清理：自动清理过期的库存锁定

## 部署步骤

### 1. 环境准备

在Render上部署前，需要准备以下环境变量：

#### 必需的环境变量
```
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
JWT_EXPIRES_IN=7d
CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your-r2-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=your-bucket-name
CLOUDFLARE_R2_PUBLIC_URL=https://your-public-url
```

### 2. 部署到Render

1. 创建一个新的Web服务
2. 连接GitHub仓库
3. 选择Node.js环境
4. 设置构建命令: `npm install`
5. 设置启动命令: `npm start`
6. 配置环境变量
7. 部署数据库（Render Postgres）

### 3. 初始化数据库

首次部署后，需要运行数据库迁移脚本来创建表结构：

```bash
npm run migrate
```

或者直接运行迁移脚本：
```bash
node scripts/migrate.js
```

### 4. 前端配置

将前端页面中的API_BASE_URL配置为Render部署后的URL：

```javascript
window.API_BASE_URL = 'https://your-app-name.onrender.com/api';
```

## 系统特性详解

### 1. 认证和权限系统

系统实现了完整的JWT认证和RBAC权限控制：

- **JWT Token**: 用于用户身份验证，有效期7天
- **角色控制**: admin, sales, warehouse三种角色
- **数据隔离**: 每个用户只能访问自己的数据
- **活动日志**: 记录用户登录和操作行为

### 2. 并发控制和库存锁定

防止超卖的关键机制：

- **锁定库存**: 创建发货任务时先锁定库存
- **事务处理**: 使用数据库事务确保数据一致性
- **过期清理**: 定时清理过期的库存锁定
- **原子操作**: 所有库存变更都是原子操作

### 3. 文件上传系统

支持多种文件类型的上传：

- **存储位置**: Cloudflare R2
- **文件类型**: 图片、PDF、文档等
- **安全控制**: 基于用户权限的文件访问控制
- **元数据管理**: 记录文件信息到数据库

### 4. 统计分析功能

提供丰富的统计报表：

- **实时统计**: 今日发货量、收入、利润
- **趋势分析**: 月度、周度趋势
- **产品表现**: 热门产品分析
- **库存分析**: 低库存预警

## API使用示例

### 用户登录
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});
```

### 创建发货任务
```javascript
const response = await fetch('/api/shipments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    user_id: userId,
    destination_country: 'US',
    customer_name: 'John Doe',
    // ... 其他字段
  })
});
```

## 性能优化

- **数据库索引**: 为常用查询字段创建索引
- **统计缓存**: 缓存计算密集型统计结果
- **API限流**: 防止API滥用
- **CDN加速**: 通过Cloudflare优化静态资源加载

## 安全措施

- **输入验证**: 所有API端点都有输入验证
- **SQL注入防护**: 使用参数化查询
- **XSS防护**: 使用Helmet中间件
- **速率限制**: 防止暴力攻击
- **权限验证**: 每个敏感操作都需要权限验证

## 维护和监控

- **日志记录**: 记录重要操作和错误
- **健康检查**: 提供健康检查端点
- **错误处理**: 全局错误处理中间件
- **优雅关闭**: 支持优雅的服务重启

## 故障排除

常见问题及解决方案：

1. **数据库连接失败**:
   - 检查DATABASE_URL环境变量
   - 确认数据库服务是否正常运行

2. **JWT验证失败**:
   - 检查JWT_SECRET环境变量
   - 确认令牌未过期

3. **文件上传失败**:
   - 检查Cloudflare R2配置
   - 确认文件大小未超过限制

4. **库存锁定冲突**:
   - 检查库存锁定清理任务
   - 确认并发处理逻辑正确

## 扩展建议

系统设计考虑了未来的扩展需求：

1. **多语言支持**: 通过用户设置表扩展
2. **多币种支持**: 通过用户设置表扩展
3. **通知系统**: 可集成邮件/SMS通知
4. **报表导出**: 可扩展为PDF/Excel导出
5. **第三方集成**: 如物流API、支付网关等