// 跨境发货管理系统 - 库存锁定机制
// 防止并发超卖的关键实现

const { pool } = require('./auth'); // 使用相同的数据库连接池

/**
 * 锁定库存（防止并发超卖的核心方法）
 * @param {string} productId - 产品ID
 * @param {string} warehouseCode - 仓库代码
 * @param {number} quantity - 需要锁定的数量
 * @param {string} shipmentId - 发货任务ID
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 是否成功锁定
 */
const lockInventory = async (productId, warehouseCode, quantity, shipmentId, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 查询当前库存和可用数量
    const inventoryResult = await client.query(
      `SELECT id, quantity, reserved_quantity, available_quantity 
       FROM inventory 
       WHERE product_id = $1 AND warehouse_code = $2 FOR UPDATE`,
      [productId, warehouseCode]
    );
    
    if (inventoryResult.rows.length === 0) {
      throw new Error('库存记录不存在');
    }
    
    const inventory = inventoryResult.rows[0];
    const availableQuantity = inventory.available_quantity;
    
    // 检查是否有足够可用库存
    if (availableQuantity < quantity) {
      throw new Error(`库存不足，当前可用: ${availableQuantity}, 需要: ${quantity}`);
    }
    
    // 更新预留数量
    const newReservedQuantity = inventory.reserved_quantity + quantity;
    const updateResult = await client.query(
      `UPDATE inventory 
       SET reserved_quantity = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2
       RETURNING quantity, reserved_quantity, (quantity - reserved_quantity) as available_quantity`,
      [newReservedQuantity, inventory.id]
    );
    
    const updatedInventory = updateResult.rows[0];
    const newAvailableQuantity = updatedInventory.available_quantity;
    
    if (newAvailableQuantity < 0) {
      throw new Error('库存更新后可用数量为负数，可能存在并发问题');
    }
    
    // 创建库存锁定记录
    await client.query(
      `INSERT INTO inventory_locks 
       (product_id, inventory_id, shipment_id, quantity, lock_type, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, inventory.id, shipmentId, quantity, 'reservation', 
       new Date(Date.now() + 30 * 60 * 1000)] // 30分钟后过期
    );
    
    // 记录库存变更
    await client.query(
      `INSERT INTO inventory_transactions 
       (inventory_id, product_id, transaction_type, quantity_change, previous_quantity, 
        new_quantity, reference_type, reference_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        inventory.id, 
        productId, 
        'reservation', 
        -quantity, 
        inventory.quantity, 
        inventory.quantity,
        'shipment', 
        shipmentId, 
        `为发货任务${shipmentId}锁定库存`, 
        userId
      ]
    );
    
    await client.query('COMMIT');
    return true;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('库存锁定失败:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 释放库存锁定（当订单取消或失败时）
 * @param {string} shipmentId - 发货任务ID
 * @param {string} userId - 用户ID
 */
const releaseInventoryLock = async (shipmentId, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 查询锁定记录
    const locksResult = await client.query(
      `SELECT il.*, i.quantity, i.reserved_quantity
       FROM inventory_locks il
       JOIN inventory i ON il.inventory_id = i.id
       WHERE il.shipment_id = $1 AND il.expires_at > CURRENT_TIMESTAMP`,
      [shipmentId]
    );
    
    if (locksResult.rows.length === 0) {
      // 没有找到需要释放的锁定，可能已经过期或已处理
      await client.query('COMMIT');
      return;
    }
    
    for (const lock of locksResult.rows) {
      // 更新库存预留数量
      const newReservedQuantity = Math.max(0, lock.reserved_quantity - lock.quantity);
      
      await client.query(
        `UPDATE inventory 
         SET reserved_quantity = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [newReservedQuantity, lock.inventory_id]
      );
      
      // 记录库存变更
      await client.query(
        `INSERT INTO inventory_transactions 
         (inventory_id, product_id, transaction_type, quantity_change, previous_quantity, 
          new_quantity, reference_type, reference_id, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          lock.inventory_id,
          lock.product_id,
          'release',
          lock.quantity,
          lock.quantity,
          lock.quantity,
          'shipment',
          shipmentId,
          `释放发货任务${shipmentId}的库存锁定`,
          userId
        ]
      );
    }
    
    // 删除锁定记录
    await client.query(
      'DELETE FROM inventory_locks WHERE shipment_id = $1',
      [shipmentId]
    );
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('释放库存锁定失败:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 确认库存锁定（当订单成功创建后，从预留转为实际扣减）
 * @param {string} shipmentId - 发货任务ID
 * @param {string} userId - 用户ID
 */
const confirmInventoryLock = async (shipmentId, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 查询锁定记录
    const locksResult = await client.query(
      `SELECT il.*, i.quantity, i.reserved_quantity
       FROM inventory_locks il
       JOIN inventory i ON il.inventory_id = i.id
       WHERE il.shipment_id = $1 AND il.expires_at > CURRENT_TIMESTAMP`,
      [shipmentId]
    );
    
    if (locksResult.rows.length === 0) {
      throw new Error('没有找到对应的库存锁定记录');
    }
    
    for (const lock of locksResult.rows) {
      // 更新库存总量
      const newQuantity = lock.quantity - lock.quantity;
      const newReservedQuantity = lock.reserved_quantity - lock.quantity;
      
      await client.query(
        `UPDATE inventory 
         SET quantity = $1, reserved_quantity = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [newQuantity, newReservedQuantity, lock.inventory_id]
      );
      
      // 记录库存变更
      await client.query(
        `INSERT INTO inventory_transactions 
         (inventory_id, product_id, transaction_type, quantity_change, previous_quantity, 
          new_quantity, reference_type, reference_id, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          lock.inventory_id,
          lock.product_id,
          'stock_out',
          -lock.quantity,
          lock.quantity,
          newQuantity,
          'shipment',
          shipmentId,
          `确认发货任务${shipmentId}的库存扣减`,
          userId
        ]
      );
    }
    
    // 删除锁定记录
    await client.query(
      'DELETE FROM inventory_locks WHERE shipment_id = $1',
      [shipmentId]
    );
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('确认库存锁定失败:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 批量锁定库存（用于创建发货任务时）
 * @param {Array} items - 发货项数组，每项包含productId, warehouseCode, quantity
 * @param {string} shipmentId - 发货任务ID
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 是否全部锁定成功
 */
const lockInventoryBatch = async (items, shipmentId, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 检查所有库存是否充足
    for (const item of items) {
      const inventoryResult = await client.query(
        `SELECT available_quantity 
         FROM inventory 
         WHERE product_id = $1 AND warehouse_code = $2 FOR UPDATE`,
        [item.productId, item.warehouseCode]
      );
      
      if (inventoryResult.rows.length === 0) {
        throw new Error(`产品 ${item.productId} 在仓库 ${item.warehouseCode} 中没有库存记录`);
      }
      
      if (inventoryResult.rows[0].available_quantity < item.quantity) {
        throw new Error(`产品 ${item.productId} 在仓库 ${item.warehouseCode} 中库存不足，可用: ${inventoryResult.rows[0].available_quantity}, 需要: ${item.quantity}`);
      }
    }
    
    // 锁定所有库存
    for (const item of items) {
      // 更新预留数量
      await client.query(
        `UPDATE inventory 
         SET reserved_quantity = reserved_quantity + $1, updated_at = CURRENT_TIMESTAMP 
         WHERE product_id = $2 AND warehouse_code = $3`,
        [item.quantity, item.productId, item.warehouseCode]
      );
      
      // 创建库存锁定记录
      await client.query(
        `INSERT INTO inventory_locks 
         (product_id, inventory_id, shipment_id, quantity, lock_type, expires_at)
         VALUES (
           $1, 
           (SELECT id FROM inventory WHERE product_id = $1 AND warehouse_code = $2), 
           $3, $4, $5, $6)`,
        [item.productId, item.warehouseCode, shipmentId, item.quantity, 'reservation', 
         new Date(Date.now() + 30 * 60 * 1000)]
      );
      
      // 记录库存变更
      await client.query(
        `INSERT INTO inventory_transactions 
         (inventory_id, product_id, transaction_type, quantity_change, previous_quantity, 
          new_quantity, reference_type, reference_id, notes, created_by)
         VALUES (
           (SELECT id FROM inventory WHERE product_id = $1 AND warehouse_code = $2), 
           $1, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.productId,
          item.warehouseCode,
          'reservation',
          -item.quantity,
          0, // 这里需要查询原始数量
          0, // 这里需要查询原始数量
          'shipment',
          shipmentId,
          `批量锁定发货任务${shipmentId}的库存`,
          userId
        ]
      );
    }
    
    await client.query('COMMIT');
    return true;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('批量库存锁定失败:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 清理过期的库存锁定（定期清理任务）
 */
const cleanupExpiredLocks = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 查找所有过期的锁定记录
    const expiredLocks = await client.query(
      `SELECT il.*, i.reserved_quantity
       FROM inventory_locks il
       JOIN inventory i ON il.inventory_id = i.id
       WHERE il.expires_at < CURRENT_TIMESTAMP`,
      []
    );
    
    if (expiredLocks.rows.length > 0) {
      // 释放过期锁定对应的库存
      for (const lock of expiredLocks.rows) {
        await client.query(
          `UPDATE inventory 
           SET reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [lock.quantity, lock.inventory_id]
        );
        
        // 记录库存变更
        await client.query(
          `INSERT INTO inventory_transactions 
           (inventory_id, product_id, transaction_type, quantity_change, previous_quantity, 
            new_quantity, reference_type, reference_id, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            lock.inventory_id,
            lock.product_id,
            'release',
            lock.quantity,
            lock.reserved_quantity,
            lock.reserved_quantity - lock.quantity,
            'inventory_lock',
            lock.id,
            `自动释放过期的库存锁定`,
            null // 系统自动操作，无用户ID
          ]
        );
      }
      
      // 删除过期的锁定记录
      await client.query(
        'DELETE FROM inventory_locks WHERE expires_at < CURRENT_TIMESTAMP',
        []
      );
    }
    
    await client.query('COMMIT');
    
    console.log(`清理了 ${expiredLocks.rows.length} 个过期的库存锁定`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('清理过期库存锁定失败:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 启动定期清理任务
 */
const startCleanupScheduler = () => {
  // 每5分钟运行一次清理任务
  setInterval(async () => {
    try {
      await cleanupExpiredLocks();
    } catch (error) {
      console.error('清理过期库存锁定时发生错误:', error);
    }
  }, 5 * 60 * 1000); // 5分钟
  
  console.log('库存锁定清理调度器已启动，每5分钟运行一次');
};

module.exports = {
  lockInventory,
  releaseInventoryLock,
  confirmInventoryLock,
  lockInventoryBatch,
  cleanupExpiredLocks,
  startCleanupScheduler
};