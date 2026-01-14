# 跨境发货管理系统

一个完整的多用户跨境发货管理系统，支持库存管理、发货任务跟踪、统计分析等功能。

## 功能特性

- ✅ **多用户支持** - 支持管理员、销售、仓库三种角色
- ✅ **库存管理** - 实时库存跟踪，防超卖机制
- ✅ **发货任务** - 完整的发货流程管理
- ✅ **统计分析** - 实时数据统计和趋势分析
- ✅ **文件管理** - 支持文件上传到Cloudflare R2
- ✅ **权限控制** - 基于角色的访问控制(RBAC)
- ✅ **并发安全** - 防止并发操作导致的数据不一致

## 技术栈

- **前端**: HTML/CSS/JavaScript (原生实现)
- **后端**: Node.js + Express.js
- **数据库**: PostgreSQL (Render托管)
- **文件存储**: Cloudflare R2
- **部署**: Render.com

## 系统架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │────│   Backend        │────│   PostgreSQL    │
│                 │    │                  │    │                 │
│  HTML/CSS/JS    │    │  Node.js         │    │  • Users        │
│                 │    │  Express.js       │    │  • Products     │
│                 │    │                  │    │  • Inventory    │
└─────────────────┘    │                  │    │  • Shipments    │
                       │  • Auth System   │    │  • Transactions │
                       │  • API Routes    │    │  • Files        │
┌─────────────────┐    │  • Middleware    │    │  • Logs         │
│   File Storage  │────│                  │    └─────────────────┘
│                 │    │                  │
│  Cloudflare R2  │    │                  │
│                 │    │                  │
└─────────────────┘    └──────────────────┘
```

## 核心功能模块

### 1. 用户认证系统
- JWT令牌认证
- 多角色权限控制
- 用户注册/登录
- 密码加密存储

### 2. 库存管理系统
- 实时库存跟踪
- 并发安全的库存锁定
- 库存变更历史记录
- 低库存预警

### 3. 发货任务管理
- 发货任务创建/更新
- 多状态流转（待处理→处理中→已打包→已发货→已送达）
- 客户信息管理
- 跟踪号码管理

### 4. 统计分析系统
- 实时数据统计
- 趋势分析
- 产品表现分析
- 库存分析

### 5. 文件管理系统
- 支持多种文件类型
- Cloudflare R2存储
- 文件权限控制
- 文件元数据管理

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

## 部署指南

### 环境要求
- Node.js 18+
- PostgreSQL 12+
- Cloudflare R2账户

### 部署到Render

1. 克隆或Fork此仓库
2. 在Render创建Web Service
3. 连接GitHub仓库
4. 配置环境变量:

```bash
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
CLOUDFLARE_R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your-r2-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-r2-secret-key
CLOUDFLARE_R2_BUCKET_NAME=your-bucket-name
CLOUDFLARE_R2_PUBLIC_URL=https://your-public-url
```

5. 部署数据库服务
6. 首次部署后运行迁移脚本

### 本地开发

```bash
# 安装依赖
npm install

# 设置环境变量
cp .env.example .env
# 编辑 .env 文件并填入正确的值

# 运行数据库迁移
npm run migrate

# 启动开发服务器
npm run dev
```

## API接口

系统提供完整的RESTful API:

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户
- `GET /api/products` - 获取产品列表
- `POST /api/products` - 创建产品
- `GET /api/inventory` - 获取库存信息
- `POST /api/shipments` - 创建发货任务
- `GET /api/analytics/summary` - 获取统计摘要
- `POST /api/files/upload` - 上传文件

详细API文档请参考 `openapi.yaml`。

## 安全措施

- 输入验证和净化
- SQL注入防护
- XSS攻击防护
- CSRF保护
- API速率限制
- JWT令牌安全
- 权限验证中间件

## 性能优化

- 数据库索引优化
- API响应缓存
- 静态资源压缩
- 数据库查询优化
- 并发处理优化

## 扩展性

系统设计充分考虑了未来扩展需求：
- 插件架构支持
- 微服务友好
- 第三方集成接口
- 多语言支持
- 多币种支持

## 贡献

欢迎提交Issue和Pull Request来改进系统。

## 许可证

MIT License# winchee
# winchee
