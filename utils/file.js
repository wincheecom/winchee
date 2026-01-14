// 跨境发货管理系统 - 文件上传到Cloudflare R2

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('./auth');

// 配置Cloudflare R2客户端
const s3Client = new S3Client({
  region: 'auto', // Cloudflare R2 uses 'auto' region
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

/**
 * 上传文件到Cloudflare R2
 * @param {Buffer} fileBuffer - 文件缓冲区
 * @param {string} originalName - 原始文件名
 * @param {string} mimeType - MIME类型
 * @param {string} userId - 用户ID
 * @param {string} fileType - 文件类型 (invoice, shipping_label, product_image, other)
 * @param {string} relatedId - 关联ID
 * @returns {Promise<Object>} 上传结果
 */
const uploadFileToR2 = async (fileBuffer, originalName, mimeType, userId, fileType, relatedId) => {
  try {
    // 验证文件类型
    const allowedFileTypes = ['invoice', 'shipping_label', 'product_image', 'other'];
    if (!allowedFileTypes.includes(fileType)) {
      throw new Error(`不允许的文件类型: ${fileType}`);
    }

    // 生成唯一的存储键
    const fileExtension = originalName.split('.').pop().toLowerCase();
    const storageKey = `${fileType}/${userId}/${uuidv4()}.${fileExtension}`;
    
    // 准备上传参数
    const putObjectParams = {
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: mimeType,
      Metadata: {
        'uploaded-by': userId,
        'file-type': fileType,
        'related-id': relatedId || ''
      }
    };

    // 上传到R2
    const command = new PutObjectCommand(putObjectParams);
    await s3Client.send(command);

    // 生成可访问的URL
    const fileUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${storageKey}`;

    // 在数据库中保存文件记录
    const result = await pool.query(
      `INSERT INTO files 
       (user_id, file_name, file_size, mime_type, storage_key, bucket_name, file_type, related_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, file_name, file_size, mime_type, storage_key, file_type, uploaded_at`,
      [userId, originalName, fileBuffer.length, mimeType, storageKey, 
       process.env.CLOUDFLARE_R2_BUCKET_NAME, fileType, relatedId]
    );

    return {
      fileId: result.rows[0].id,
      fileName: result.rows[0].file_name,
      fileSize: result.rows[0].file_size,
      mimeType: result.rows[0].mime_type,
      storageKey: result.rows[0].storage_key,
      fileUrl: fileUrl,
      fileType: result.rows[0].file_type,
      uploadedAt: result.rows[0].uploaded_at
    };

  } catch (error) {
    console.error('文件上传到R2失败:', error);
    throw error;
  }
};

/**
 * 从Cloudflare R2删除文件
 * @param {string} fileId - 文件ID
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 删除结果
 */
const deleteFileFromR2 = async (fileId, userId) => {
  try {
    // 首先从数据库获取文件信息
    const fileResult = await pool.query(
      'SELECT storage_key, user_id FROM files WHERE id = $1',
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      throw new Error('文件不存在');
    }

    const fileRecord = fileResult.rows[0];

    // 检查权限：只有文件拥有者或管理员才能删除
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('用户不存在');
    }

    const currentUser = userResult.rows[0];
    if (fileRecord.user_id !== userId && currentUser.role !== 'admin') {
      throw new Error('无权删除此文件');
    }

    // 从R2删除文件
    const deleteParams = {
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: fileRecord.storage_key
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);

    // 从数据库删除记录
    await pool.query('DELETE FROM files WHERE id = $1', [fileId]);

    return true;

  } catch (error) {
    console.error('删除文件失败:', error);
    throw error;
  }
};

/**
 * 生成预签名URL（用于前端直接上传）
 * @param {string} fileName - 文件名
 * @param {string} mimeType - MIME类型
 * @param {string} userId - 用户ID
 * @param {string} fileType - 文件类型
 * @param {string} relatedId - 关联ID
 * @returns {Promise<Object>} 预签名URL信息
 */
const generatePresignedUploadUrl = async (fileName, mimeType, userId, fileType, relatedId) => {
  try {
    // 验证文件类型
    const allowedFileTypes = ['invoice', 'shipping_label', 'product_image', 'other'];
    if (!allowedFileTypes.includes(fileType)) {
      throw new Error(`不允许的文件类型: ${fileType}`);
    }

    // 生成唯一的存储键
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const storageKey = `${fileType}/${userId}/${uuidv4()}.${fileExtension}`;

    // 在数据库中创建占位记录
    const fileRecord = await pool.query(
      `INSERT INTO files 
       (user_id, file_name, mime_type, storage_key, bucket_name, file_type, related_id, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [userId, fileName, mimeType, storageKey, 
       process.env.CLOUDFLARE_R2_BUCKET_NAME, fileType, relatedId, false]
    );

    // 这里我们返回存储键和文件ID，前端仍需要通过API上传
    // 因为预签名URL需要更复杂的设置，这里简化为返回上传所需信息
    return {
      fileId: fileRecord.rows[0].id,
      storageKey: storageKey,
      uploadEndpoint: '/api/files/upload',
      maxFileSize: 10 * 1024 * 1024, // 10MB限制
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
    };

  } catch (error) {
    console.error('生成预签名上传URL失败:', error);
    throw error;
  }
};

/**
 * 验证上传的文件
 * @param {Object} file - 文件对象
 * @returns {Promise<Object>} 验证结果
 */
const validateUploadedFile = async (file) => {
  const result = {
    isValid: true,
    errors: []
  };

  // 检查文件大小（最大10MB）
  if (file.size > 10 * 1024 * 1024) {
    result.isValid = false;
    result.errors.push('文件大小不能超过10MB');
  }

  // 检查文件类型
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    result.isValid = false;
    result.errors.push(`不允许的文件类型: ${file.mimetype}. 允许的类型: ${allowedMimeTypes.join(', ')}`);
  }

  // 检查文件名
  if (!file.originalname || file.originalname.length > 255) {
    result.isValid = false;
    result.errors.push('文件名长度不能超过255个字符');
  }

  return result;
};

/**
 * 获取用户文件列表
 * @param {string} userId - 用户ID
 * @param {Object} filters - 过滤条件
 * @returns {Promise<Array>} 文件列表
 */
const getUserFiles = async (userId, filters = {}) => {
  try {
    let query = `SELECT id, file_name, file_size, mime_type, file_type, 
                        related_id, uploaded_at FROM files WHERE user_id = $1`;
    const params = [userId];
    let paramIndex = 2;

    // 添加过滤条件
    if (filters.fileType) {
      query += ` AND file_type = $${paramIndex}`;
      params.push(filters.fileType);
      paramIndex++;
    }

    if (filters.relatedId) {
      query += ` AND related_id = $${paramIndex}`;
      params.push(filters.relatedId);
      paramIndex++;
    }

    query += ` ORDER BY uploaded_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
    }

    const result = await pool.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      fileName: row.file_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      fileType: row.file_type,
      relatedId: row.related_id,
      uploadedAt: row.uploaded_at
    }));

  } catch (error) {
    console.error('获取用户文件列表失败:', error);
    throw error;
  }
};

module.exports = {
  uploadFileToR2,
  deleteFileFromR2,
  generatePresignedUploadUrl,
  validateUploadedFile,
  getUserFiles
};