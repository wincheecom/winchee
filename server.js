// 跨境发货管理系统 - 服务器入口文件

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const rateLimit = require('rate-limiter-flexible');
require('dotenv').config();

// 导入路由
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const shipmentRoutes = require('./routes/shipments');
const analyticsRoutes = require('./routes/analytics');
const fileRoutes = require('./routes/files');

// 导入辅助功能
const { startCleanupScheduler } = require('./utils/inventory');

// 数据库连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 速率限制器
const limiter = new rateLimit.RateLimiterMemory({
  points: 100, // 每个IP在duration时间内允许的请求数
  duration: 60 // 60秒
});

// 创建Express应用
const app = express();

// 中间件
app.use(helmet()); // 安全头部
app.use(cors()); // 跨域支持
app.use(express.json({ limit: '10mb' })); // 解析JSON请求体
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // 解析URL编码请求体

// 应用速率限制
app.use((req, res, next) => {
  limiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).send('请求过于频繁，请稍后再试');
    });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/files', fileRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({ 
    message: '跨境发货管理系统 API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: '请求实体过大' });
  }
  
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误' 
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 服务器启动
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
  
  // 启动库存锁定清理调度器
  startCleanupScheduler();
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

module.exports = { app, pool };