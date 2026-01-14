// 跨境发货管理系统 - 发货任务路由

const express = require('express');
const { authenticateToken, authorizeRoles, authorizeResourceAccess } = require('../utils/auth');
const { lockInventoryBatch, confirmInventoryLock } = require('../utils/inventory');
const { body } = require('express-validator');

const router = express.Router();

// 获取发货任务列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, offset = 0, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    
    // 这里应该连接到实际的数据库查询
    // 示例响应
    res.json({
      shipments: [],
      total: 0
    });
  } catch (error) {
    console.error('获取发货任务列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取特定发货任务
router.get('/:id', authenticateToken, authorizeResourceAccess('shipment'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // 这里应该连接到实际的数据库查询
    // 示例响应
    res.json({ id, taskNumber: 'TSK-20231201-000001' });
  } catch (error) {
    console.error('获取发货任务失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建发货任务
router.post('/', authenticateToken, authorizeRoles('admin', 'sales'), [
  body('destinationCountry').notEmpty(),
  body('customerName').notEmpty()
], async (req, res) => {
  try {
    const shipmentData = req.body;
    shipmentData.user_id = req.user.id;
    
    // 在创建发货任务时锁定库存
    if (shipmentData.items && shipmentData.items.length > 0) {
      const lockSuccess = await lockInventoryBatch(
        shipmentData.items.map(item => ({
          productId: item.product_id,
          warehouseCode: item.warehouse_code,
          quantity: item.quantity
        })),
        shipmentData.id, // 实际应用中应该是新创建的发货任务ID
        req.user.id
      );
      
      if (!lockSuccess) {
        return res.status(400).json({ error: '库存不足，无法创建发货任务' });
      }
    }
    
    // 这里应该连接到实际的数据库插入
    // 示例响应
    res.status(201).json(shipmentData);
  } catch (error) {
    console.error('创建发货任务失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新发货任务
router.put('/:id', authenticateToken, authorizeRoles('admin', 'sales'), authorizeResourceAccess('shipment'), [
  body('status').optional().isIn(['pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'])
], async (req, res) => {
  try {
    const { id } = req.params;
    const shipmentData = req.body;
    
    // 这里应该连接到实际的数据库更新
    // 示例响应
    res.json({ id, ...shipmentData });
  } catch (error) {
    console.error('更新发货任务失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 取消发货任务
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'sales'), authorizeResourceAccess('shipment'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // 这里应该连接到实际的数据库更新，将状态设为已取消
    // 示例响应
    res.json({ message: '发货任务已取消' });
  } catch (error) {
    console.error('取消发货任务失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;