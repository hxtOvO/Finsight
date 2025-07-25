// check-data.js - 检查数据库数据
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkData() {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('✅ 数据库连接成功');

    // 检查performance_history表的数据
    const [allData] = await db.execute('SELECT COUNT(*) as count, range_type FROM performance_history GROUP BY range_type');
    console.log('📊 各类型数据统计:', allData);

    // 检查最近几条数据
    const [recentData] = await db.execute('SELECT * FROM performance_history ORDER BY date DESC LIMIT 10');
    console.log('📈 最近10条数据:', recentData);

    await db.end();
  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

checkData();
