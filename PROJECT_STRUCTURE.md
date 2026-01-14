# 跨境发货管理系统 - 项目结构说明

## 项目文件结构

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
├──
└── frontend_api_integration.js # 前端API集成指南
```

## 核心文件说明

### 服务器相关
- **server.js**: 应用程序主入口，配置中间件、路由和错误处理
- **package.json**: 项目依赖和脚本配置
- **render.yaml**: Render部署配置文件

### 数据库相关
- **scripts/migrate.js**: 数据库迁移脚本，用于初始化数据库结构

### API相关
- **openapi.yaml**: OpenAPI 3.0规范的API文档
- **routes/**: 按功能模块划分的API路由文件
  - auth.js: 用户认证路由（登录、注册、获取用户信息）
  - products.js: 产品管理路由（CRUD操作）
  - inventory.js: 库存管理路由（查询、锁定等）
  - shipments.js: 发货任务路由（创建、更新、状态管理）
  - analytics.js: 统计分析路由（各种数据统计）
  - files.js: 文件上传路由（上传、下载、删除）

### 业务逻辑相关
- **utils/auth.js**: 认证和权限控制核心逻辑
- **utils/inventory.js**: 并发控制和库存锁定机制
- **utils/file.js**: 文件上传到Cloudflare R2的实现
- **utils/analytics.js**: 统计分析功能实现

### 前端集成
- **frontend_api_integration.js**: 前端API调用封装，用于替代localStorage

## 设计模式和架构

### 1. 分层架构
```
┌─────────────────┐
│   Presentation  │ ← 前端界面
├─────────────────┤
│   Controller    │ ← API路由处理
├─────────────────┤
│   Business Logic│ ← 业务逻辑处理
├─────────────────┤
│   Data Access   │ ← 数据库操作
├─────────────────┤
│   Database      │ ← PostgreSQL
└─────────────────┘
```

### 2. 安全设计
- JWT Token认证机制
- 基于角色的访问控制(RBAC)
- 数据库行级权限控制
- 输入验证和净化

### 3. 并发控制
- 库存锁定机制防止超卖
- 数据库事务确保一致性
- 定时清理过期锁定

### 4. 可扩展性
- 模块化设计便于扩展
- API优先设计便于集成
- 配置化便于环境切换

## 部署配置

### Render部署
- Web服务配置(render.yaml)
- 数据库服务配置
- 环境变量配置
- 健康检查配置

### 环境变量
- 数据库连接配置
- JWT密钥配置
- Cloudflare R2配置
- 应用运行时配置

## 开发指南

### 本地开发
1. 复制.env.example为.env并填写配置
2. 安装依赖: npm install
3. 运行数据库迁移: npm run migrate
4. 启动开发服务器: npm run dev

### 测试策略
- 单元测试覆盖核心业务逻辑
- 集成测试验证API端点
- 安全测试验证权限控制

### 监控和维护
- API健康检查端点
- 错误日志记录
- 性能指标监控
- 定期数据备份