// 跨境发货管理系统 - 统计分析路由

const express = require('express');
const { authenticateToken } = require('../utils/auth');
const {
  getAnalyticsSummary,
  getMonthlyTrends,
  getShipmentTrends,
  getProductPerformance,
  getInventoryAnalysis,
  getCachedStatistics
} = require('../utils/analytics');

const router = express.Router();

// 获取统计摘要
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '必须提供开始日期和结束日期' });
    }
    
    // 检查是否已有缓存
    const cachedData = await getCachedStatistics(req.user.id, 'summary', `${startDate}-${endDate}`);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    const summary = await getAnalyticsSummary(req.user.id, new Date(startDate), new Date(endDate));
    
    // 缓存结果
    // await cacheStatistics(req.user.id, 'summary', `${startDate}-${endDate}`, summary);
    
    res.json(summary);
  } catch (error) {
    console.error('获取统计摘要失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取月度趋势
router.get('/monthly-trends', authenticateToken, async (req, res) => {
  try {
    const { monthsBack = 12 } = req.query;
    
    const trends = await getMonthlyTrends(req.user.id, parseInt(monthsBack));
    
    res.json(trends);
  } catch (error) {
    console.error('获取月度趋势失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取发货趋势
router.get('/shipment-trends', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '必须提供开始日期和结束日期' });
    }
    
    const trends = await getShipmentTrends(req.user.id, new Date(startDate), new Date(endDate), groupBy);
    
    res.json(trends);
  } catch (error) {
    console.error('获取发货趋势失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取产品表现分析
router.get('/product-performance', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '必须提供开始日期和结束日期' });
    }
    
    const performance = await getProductPerformance(req.user.id, new Date(startDate), new Date(endDate));
    
    res.json(performance);
  } catch (error) {
    console.error('获取产品表现分析失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取库存分析
router.get('/inventory-analysis', authenticateToken, async (req, res) => {
  try {
    const analysis = await getInventoryAnalysis(req.user.id);
    
    res.json(analysis);
  } catch (error) {
    console.error('获取库存分析失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;