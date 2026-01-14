// 跨境发货管理系统 - 库存路由

const express = require('express');
const { authenticateToken, authorizeRoles, authorizeResourceAccess } = require('../utils/auth');
const { lockInventory, releaseInventoryLock, confirmInventoryLock } = require('../utils/inventory');
const { body } = require('express-validator');

const router = express.Router();

// 获取库存列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, offset = 0, minAvailable } = req.query;
    
    // 这里应该连接到实际的数据库查询
    // 示例响应
    res.json({
      inventory: [],
      total: 0
    });
  } catch (error) {
    console.error('获取库存列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 锁定库存
router.post('/:productId/:warehouseCode/lock', authenticateToken, authorizeRoles('admin', 'warehouse'), [
  body('quantity').isInt({ min: 1 }),
  body('shipmentId').isUUID()
], async (req, res) => {
  try {
    const { productId, warehouseCode } = req.params;
    const { quantity, shipmentId } = req.query;
    
    const result = await lockInventory(productId, warehouseCode, parseInt(quantity), shipmentId, req.user.id);
    
    if (result) {
      res.json({
        locked: true,
        message: '库存锁定成功'
      });
    } else {
      res.status(400).json({
        error: '库存锁定失败'
      });
    }
  } catch (error) {
    console.error('库存锁定失败:', error);
    res.status(400).json({ error: error.message });
  }
});

// 释放库存锁定
router.post('/:shipmentId/unlock', authenticateToken, authorizeRoles('admin', 'warehouse'), async (req, res) => {
  try {
    const { shipmentId } = req.params;
    
    await releaseInventoryLock(shipmentId, req.user.id);
    
    res.json({
      released: true,
      message: '库存解锁成功'
    });
  } catch (error) {
    console.error('库存解锁失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;