// 跨境发货管理系统 - 认证和权限控制系统

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');

// 数据库连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// JWT验证中间件
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 验证用户是否存在且活跃
    const result = await pool.query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户不存在或已被停用' });
    }

    req.user = result.rows[0]; // 将用户信息附加到请求对象
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '令牌已过期，请重新登录' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的令牌' });
    }
    return res.status(500).json({ error: '认证失败' });
  }
};

// 角色权限中间件
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证用户' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足，无法执行此操作' });
    }

    next();
  };
};

// 数据行级权限控制中间件
const authorizeResourceAccess = async (resourceType, resourceIdField = 'id') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证用户' });
    }

    // 检查资源是否属于当前用户或用户是管理员
    let tableName, idColumn, userIdColumn;

    switch (resourceType) {
      case 'shipment':
        tableName = 'shipment_tasks';
        idColumn = 'id';
        userIdColumn = 'user_id';
        break;
      case 'product':
        tableName = 'products';
        idColumn = 'id';
        userIdColumn = 'created_by';
        break;
      case 'inventory':
        tableName = 'inventory';
        idColumn = 'product_id';
        userIdColumn = 'created_by'; // 通过产品关联到创建者
        break;
      case 'file':
        tableName = 'files';
        idColumn = 'id';
        userIdColumn = 'user_id';
        break;
      default:
        return res.status(400).json({ error: '未知资源类型' });
    }

    const resourceId = req.params[resourceIdField] || req.body[resourceIdField];

    if (!resourceId) {
      return res.status(400).json({ error: `缺少${resourceType} ID参数` });
    }

    // 如果是管理员，则允许访问
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      let query;
      let params;

      if (resourceType === 'inventory') {
        // 对于库存，需要先找到对应的产品，再检查产品创建者
        const productQuery = await pool.query(
          'SELECT created_by FROM products WHERE id = $1',
          [resourceId]
        );
        
        if (productQuery.rows.length === 0 || productQuery.rows[0].created_by !== req.user.id) {
          return res.status(403).json({ error: '无权访问该资源' });
        }
      } else {
        query = `SELECT ${userIdColumn} FROM ${tableName} WHERE ${idColumn} = $1`;
        params = [resourceId];

        const result = await pool.query(query, params);

        if (result.rows.length === 0 || result.rows[0][userIdColumn] !== req.user.id) {
          return res.status(403).json({ error: '无权访问该资源' });
        }
      }

      next();
    } catch (error) {
      console.error('权限检查错误:', error);
      return res.status(500).json({ error: '权限检查失败' });
    }
  };
};

// 用户注册路由
const registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, role, company_name } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 检查邮箱是否已存在
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: '邮箱已被注册' });
      }

      // 哈希密码
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // 创建用户
      const result = await client.query(
        `INSERT INTO users 
         (email, password_hash, name, role, company_name) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, email, name, role, company_name, created_at`,
        [email, passwordHash, name, role, company_name]
      );

      const user = result.rows[0];

      // 记录活动
      await client.query(
        'INSERT INTO activity_logs (user_id, activity_type, details) VALUES ($1, $2, $3)',
        [user.id, 'user_registered', JSON.stringify({ email, role })]
      );

      await client.query('COMMIT');

      res.status(201).json({
        message: '用户注册成功',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company_name: user.company_name
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
};

// 用户登录路由
const loginUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    const result = await pool.query(
      `SELECT id, email, password_hash, name, role, 
              company_name, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      // 记录失败尝试
      await pool.query(
        `INSERT INTO activity_logs 
         (activity_type, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        ['login_failed', JSON.stringify({ email }), ip, userAgent]
      );

      return res.status(401).json({ error: '邮箱或密码不正确' });
    }

    const user = result.rows[0];

    // 检查用户是否激活
    if (!user.is_active) {
      return res.status(403).json({ error: '账户已被停用，请联系管理员' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // 记录失败尝试
      await pool.query(
        `INSERT INTO activity_logs 
         (user_id, activity_type, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, 'login_failed', JSON.stringify({ email }), ip, userAgent]
      );

      return res.status(401).json({ error: '邮箱或密码不正确' });
    }

    // 更新最后登录时间
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // 生成JWT令牌
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 记录登录成功
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, activity_type, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'login_success', JSON.stringify({}), ip, userAgent]
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_name: user.company_name
      }
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
};

// 获取当前用户信息
const getCurrentUser = async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
};

// 导出认证相关函数和中间件
module.exports = {
  authenticateToken,
  authorizeRoles,
  authorizeResourceAccess,
  registerUser,
  loginUser,
  getCurrentUser,
  pool
};