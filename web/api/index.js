// Vercel Serverless Function 入口
// 直接引用 server.ts（Vercel @vercel/node 会自动处理 TypeScript）
const { default: app } = require('../src/web/server');

module.exports = app;