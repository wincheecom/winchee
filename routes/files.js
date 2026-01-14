// 跨境发货管理系统 - 文件上传路由

const express = require('express');
const multer = require('multer');
const { authenticateToken, authorizeRoles } = require('../utils/auth');
const { uploadFileToR2, deleteFileFromR2, getUserFiles } = require('../utils/file');

const router = express.Router();

// 配置multer用于文件上传
const storage = multer.memoryStorage(); // 将文件存储在内存中，便于上传到R2
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制10MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许某些类型的文件
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});

// 上传文件
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有文件被上传' });
    }
    
    const { fileType, relatedId } = req.body;
    
    // 验证文件类型
    const allowedFileTypes = ['invoice', 'shipping_label', 'product_image', 'other'];
    if (!allowedFileTypes.includes(fileType)) {
      return res.status(400).json({ error: '无效的文件类型' });
    }
    
    const result = await uploadFileToR2(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.user.id,
      fileType,
      relatedId
    );
    
    res.json(result);
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取用户文件列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { fileType, relatedId, limit, offset } = req.query;
    
    const filters = {};
    if (fileType) filters.fileType = fileType;
    if (relatedId) filters.relatedId = relatedId;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);
    
    const files = await getUserFiles(req.user.id, filters);
    
    res.json({ files });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除文件
router.delete('/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const result = await deleteFileFromR2(fileId, req.user.id);
    
    if (result) {
      res.json({ message: '文件删除成功' });
    } else {
      res.status(400).json({ error: '文件删除失败' });
    }
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;