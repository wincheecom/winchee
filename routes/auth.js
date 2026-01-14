// 跨境发货管理系统 - 认证路由

const express = require('express');
const { 
  registerUser, 
  loginUser, 
  getCurrentUser,
  authenticateToken
} = require('../utils/auth');

const { body } = require('express-validator');

const router = express.Router();

// 用户注册
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty(),
  body('role').isIn(['sales', 'warehouse'])
], registerUser);

// 用户登录
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], loginUser);

// 获取当前用户信息
router.get('/me', authenticateToken, getCurrentUser);

module.exports = router;