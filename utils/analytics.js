// 跨境发货管理系统 - 统计分析功能

const { pool } = require('./auth');

/**
 * 获取用户统计摘要
 * @param {string} userId - 用户ID
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @returns {Promise<Object>} 统计摘要
 */
const getAnalyticsSummary = async (userId, startDate, endDate) => {
  try {
    // 转换日期为字符串格式
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    // 获取今天的日期范围
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    
    // 查询今天的数据
    const todayResult = await pool.query(`
      SELECT 
        COUNT(*) as today_shipments,
        COALESCE(SUM(total_amount), 0) as today_revenue,
        COALESCE(SUM(total_amount - (SELECT COALESCE(SUM(pi.cost * si.quantity), 0)
                                    FROM shipment_items si
                                    JOIN products pi ON si.product_id = pi.id
                                    WHERE si.shipment_id = st.id)), 0) as today_profit
      FROM shipment_tasks st
      WHERE user_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND status != 'cancelled'
    `, [userId, todayStart, todayEnd]);
    
    // 查询昨天的数据
    const yesterdayResult = await pool.query(`
      SELECT 
        COUNT(*) as yesterday_shipments,
        COALESCE(SUM(total_amount), 0) as yesterday_revenue,
        COALESCE(SUM(total_amount - (SELECT COALESCE(SUM(pi.cost * si.quantity), 0)
                                    FROM shipment_items si
                                    JOIN products pi ON si.product_id = pi.id
                                    WHERE si.shipment_id = st.id)), 0) as yesterday_profit
      FROM shipment_tasks st
      WHERE user_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND status != 'cancelled'
    `, [userId, yesterdayStart, yesterdayEnd]);
    
    // 查询指定日期范围内的数据
    const rangeResult = await pool.query(`
      SELECT 
        COUNT(*) as period_shipments,
        COALESCE(SUM(total_amount), 0) as period_revenue,
        COALESCE(SUM(total_amount - (SELECT COALESCE(SUM(pi.cost * si.quantity), 0)
                                    FROM shipment_items si
                                    JOIN products pi ON si.product_id = pi.id
                                    WHERE si.shipment_id = st.id)), 0) as period_profit
      FROM shipment_tasks st
      WHERE user_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND status != 'cancelled'
    `, [userId, startDate, endDate]);
    
    // 查询发货状态分布
    const statusDistribution = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM shipment_tasks
      WHERE user_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND status != 'cancelled'
      GROUP BY status
    `, [userId, startDate, endDate]);
    
    // 查询热门产品
    const topProducts = await pool.query(`
      SELECT 
        p.name as product_name,
        SUM(si.quantity) as total_sold,
        SUM(si.total_price) as total_revenue
      FROM shipment_items si
      JOIN shipment_tasks st ON si.shipment_id = st.id
      JOIN products p ON si.product_id = p.id
      WHERE st.user_id = $1 
        AND st.created_at >= $2 
        AND st.created_at <= $3
        AND st.status != 'cancelled'
      GROUP BY p.id, p.name
      ORDER BY total_sold DESC
      LIMIT 10
    `, [userId, startDate, endDate]);
    
    return {
      today_shipments: parseInt(todayResult.rows[0].today_shipments),
      yesterday_shipments: parseInt(yesterdayResult.rows[0].yesterday_shipments),
      today_revenue: parseFloat(todayResult.rows[0].today_revenue),
      yesterday_revenue: parseFloat(yesterdayResult.rows[0].yesterday_revenue),
      today_profit: parseFloat(todayResult.rows[0].today_profit),
      yesterday_profit: parseFloat(yesterdayResult.rows[0].yesterday_profit),
      period_shipments: parseInt(rangeResult.rows[0].period_shipments),
      period_revenue: parseFloat(rangeResult.rows[0].period_revenue),
      period_profit: parseFloat(rangeResult.rows[0].period_profit),
      status_distribution: statusDistribution.rows,
      top_products: topProducts.rows
    };
  } catch (error) {
    console.error('获取统计摘要失败:', error);
    throw error;
  }
};

/**
 * 获取用户的月度趋势分析
 * @param {string} userId - 用户ID
 * @param {number} monthsBack - 月份数（从当前月份往前推）
 * @returns {Promise<Array>} 月度趋势数据
 */
const getMonthlyTrends = async (userId, monthsBack = 12) => {
  try {
    const result = await pool.query(`
      WITH monthly_data AS (
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as shipments,
          COALESCE(SUM(total_amount), 0) as revenue,
          COALESCE(SUM(total_amount - (SELECT COALESCE(SUM(pi.cost * si.quantity), 0)
                                      FROM shipment_items si
                                      JOIN products pi ON si.product_id = pi.id
                                      WHERE si.shipment_id = st.id)), 0) as profit
        FROM shipment_tasks st
        WHERE user_id = $1 
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '$2 months'
          AND status != 'cancelled'
        GROUP BY DATE_TRUNC('month', created_at)
      )
      SELECT 
        TO_CHAR(month, 'YYYY-MM') as month,
        shipments,
        revenue,
        profit
      FROM monthly_data
      ORDER BY month DESC
    `, [userId, monthsBack]);
    
    return result.rows.map(row => ({
      month: row.month,
      shipments: parseInt(row.shipments),
      revenue: parseFloat(row.revenue),
      profit: parseFloat(row.profit)
    }));
  } catch (error) {
    console.error('获取月度趋势失败:', error);
    throw error;
  }
};

/**
 * 获取用户的发货任务趋势
 * @param {string} userId - 用户ID
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @param {string} groupBy - 分组方式 (day, week, month)
 * @returns {Promise<Array>} 趋势数据
 */
const getShipmentTrends = async (userId, startDate, endDate, groupBy = 'day') => {
  try {
    let groupByClause;
    switch(groupBy) {
      case 'week':
        groupByClause = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', created_at)";
        break;
      case 'day':
      default:
        groupByClause = "DATE_TRUNC('day', created_at)";
        break;
    }
    
    const result = await pool.query(`
      SELECT 
        TO_CHAR(${groupByClause}, 'YYYY-MM-DD') as date,
        COUNT(*) as shipments,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing
      FROM shipment_tasks
      WHERE user_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND status != 'cancelled'
      GROUP BY ${groupByClause}
      ORDER BY ${groupByClause}
    `, [userId, startDate, endDate]);
    
    return result.rows.map(row => ({
      date: row.date,
      shipments: parseInt(row.shipments),
      revenue: parseFloat(row.revenue),
      delivered: parseInt(row.delivered),
      shipped: parseInt(row.shipped),
      processing: parseInt(row.processing)
    }));
  } catch (error) {
    console.error('获取发货趋势失败:', error);
    throw error;
  }
};

/**
 * 获取用户的产品表现分析
 * @param {string} userId - 用户ID
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @returns {Promise<Array>} 产品表现数据
 */
const getProductPerformance = async (userId, startDate, endDate) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku,
        SUM(si.quantity) as total_sold,
        SUM(si.total_price) as total_revenue,
        AVG(si.unit_price) as avg_price,
        (SELECT COALESCE(SUM(pi.cost * si2.quantity), 0)
         FROM shipment_items si2
         JOIN products pi ON si2.product_id = pi.id
         WHERE si2.shipment_id = si.shipment_id AND si2.product_id = p.id) as total_cost,
        SUM(si.total_price) - (SELECT COALESCE(SUM(pi.cost * si2.quantity), 0)
                              FROM shipment_items si2
                              JOIN products pi ON si2.product_id = pi.id
                              WHERE si2.shipment_id = si.shipment_id AND si2.product_id = p.id) as total_profit
      FROM shipment_items si
      JOIN shipment_tasks st ON si.shipment_id = st.id
      JOIN products p ON si.product_id = p.id
      WHERE st.user_id = $1 
        AND st.created_at >= $2 
        AND st.created_at <= $3
        AND st.status != 'cancelled'
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_sold DESC
    `, [userId, startDate, endDate]);
    
    return result.rows.map(row => ({
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      totalSold: parseInt(row.total_sold),
      totalRevenue: parseFloat(row.total_revenue),
      avgPrice: parseFloat(row.avg_price),
      totalCost: parseFloat(row.total_cost),
      totalProfit: parseFloat(row.total_profit)
    }));
  } catch (error) {
    console.error('获取产品表现分析失败:', error);
    throw error;
  }
};

/**
 * 获取用户的库存分析
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 库存分析数据
 */
const getInventoryAnalysis = async (userId) => {
  try {
    // 获取产品总数
    const productCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE created_by = $1',
      [userId]
    );
    
    // 获取库存概览
    const inventoryResult = await pool.query(`
      SELECT 
        COUNT(*) as total_inventory_records,
        SUM(quantity) as total_stock,
        SUM(reserved_quantity) as total_reserved,
        SUM(available_quantity) as total_available,
        COUNT(CASE WHEN available_quantity <= 10 THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN available_quantity <= 5 THEN 1 END) as critical_stock_count
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.created_by = $1
    `, [userId]);
    
    // 获取低库存产品
    const lowStockProducts = await pool.query(`
      SELECT 
        p.name as product_name,
        p.sku,
        i.warehouse_code,
        i.available_quantity,
        i.quantity,
        i.reserved_quantity
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.created_by = $1 AND i.available_quantity <= 10
      ORDER BY i.available_quantity ASC
      LIMIT 10
    `, [userId]);
    
    return {
      totalProducts: parseInt(productCountResult.rows[0].count),
      inventorySummary: {
        totalRecords: parseInt(inventoryResult.rows[0].total_inventory_records),
        totalStock: parseInt(inventoryResult.rows[0].total_stock),
        totalReserved: parseInt(inventoryResult.rows[0].total_reserved),
        totalAvailable: parseInt(inventoryResult.rows[0].total_available),
        lowStockCount: parseInt(inventoryResult.rows[0].low_stock_count),
        criticalStockCount: parseInt(inventoryResult.rows[0].critical_stock_count)
      },
      lowStockProducts: lowStockProducts.rows
    };
  } catch (error) {
    console.error('获取库存分析失败:', error);
    throw error;
  }
};

/**
 * 缓存统计结果
 * @param {string} userId - 用户ID
 * @param {string} statisticType - 统计类型
 * @param {string} period - 时间段
 * @param {Object} data - 统计数据
 * @param {number} ttlMinutes - 缓存时间（分钟）
 */
const cacheStatistics = async (userId, statisticType, period, data, ttlMinutes = 30) => {
  try {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);
    
    await pool.query(`
      INSERT INTO statistics_cache 
      (user_id, statistic_type, period, data, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, statistic_type, period) 
      DO UPDATE SET 
        data = $4,
        calculated_at = CURRENT_TIMESTAMP,
        expires_at = $5
    `, [userId, statisticType, period, JSON.stringify(data), expiresAt]);
  } catch (error) {
    console.error('缓存统计结果失败:', error);
    // 不抛出错误，因为这不应该影响主要功能
  }
};

/**
 * 从缓存获取统计结果
 * @param {string} userId - 用户ID
 * @param {string} statisticType - 统计类型
 * @param {string} period - 时间段
 * @returns {Promise<Object|null>} 缓存的统计数据或null
 */
const getCachedStatistics = async (userId, statisticType, period) => {
  try {
    const result = await pool.query(`
      SELECT data 
      FROM statistics_cache
      WHERE user_id = $1 AND statistic_type = $2 AND period = $3 AND expires_at > CURRENT_TIMESTAMP
    `, [userId, statisticType, period]);
    
    if (result.rows.length > 0) {
      return JSON.parse(result.rows[0].data);
    }
    
    return null;
  } catch (error) {
    console.error('获取缓存统计结果失败:', error);
    return null;
  }
};

module.exports = {
  getAnalyticsSummary,
  getMonthlyTrends,
  getShipmentTrends,
  getProductPerformance,
  getInventoryAnalysis,
  cacheStatistics,
  getCachedStatistics
};