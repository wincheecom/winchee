# 跨境发货管理系统前端

这是一个用于跨境发货管理系统的前端界面，与后端API进行交互，提供用户友好的操作体验。

## 功能特性

- **用户认证**：支持多用户登录，不同角色权限管理
- **产品管理**：产品信息的增删改查，图片上传
- **发货任务**：创建和管理发货任务，状态跟踪
- **统计分析**：多维度数据分析和报表导出
- **响应式设计**：适配桌面和移动设备

## 技术栈

- HTML5
- CSS3
- JavaScript (ES6+)
- Font Awesome 图标库

## 文件结构

```
frontend/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── api.js          # API接口封装
│   └── app.js          # 应用主逻辑
└── README.md
```

## 使用说明

1. **部署后端服务**：确保后端API服务已部署并运行
2. **修改API地址**：在 `js/api.js` 中将 `API_BASE_URL` 替换为您的后端服务地址
3. **部署前端**：将前端文件部署到静态服务器或CDN

## 配置说明

在 `js/api.js` 文件中，需要将 `API_BASE_URL` 替换为您的后端服务地址：

```javascript
const API_BASE_URL = 'https://your-render-app-url.onrender.com'; // 替换为您的Render部署URL
```

## 支持的浏览器

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 注意事项

- 前端依赖后端API服务，确保后端服务正常运行
- 需要正确配置CORS策略以允许前端访问API
- 生产环境中建议使用HTTPS协议