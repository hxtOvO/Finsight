const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

// 配置Swagger基本信息
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '项目API文档',
      version: '1.0.0',
      description: '基于Node.js和H5的项目接口文档'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '开发服务器'
      }
    ]
  },
  // 使用绝对路径确保准确性
  apis: [
    path.join(__dirname, 'backend/server.js') 
  ]
};

const swaggerSpec = swaggerJSDoc(options);

// 调试：打印生成的规范内容
// console.log('生成的 Swagger 规范:', JSON.stringify(swaggerSpec, null, 2));

module.exports = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(swaggerSpec)
};