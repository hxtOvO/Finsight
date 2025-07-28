const mysql = require('mysql2/promise');
require('dotenv').config();

async function quickCheck() {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('✅ 数据库连接成功');

    // 检查数据数量
    const [countResult] = await db.execute('SELECT COUNT(*) as count FROM performance_history');
    console.log(`📊 总数据条数: ${countResult[0].count}`);

    // 检查各类型数据
    const [typeResult] = await db.execute('SELECT range_type, COUNT(*) as count FROM performance_history GROUP BY range_type');
    console.log('📈 按类型分组:');
    typeResult.forEach(row => {
      console.log(`  ${row.range_type}: ${row.count} 条`);
    });

    // 检查最新数据
    const [latestResult] = await db.execute('SELECT date, value, range_type FROM performance_history ORDER BY date DESC, created_at DESC LIMIT 10');
    console.log('🕒 最新10条数据:');
    latestResult.forEach(row => {
      console.log(`  ${row.date} | ${row.value} | ${row.range_type}`);
    });

    await db.end();
  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

quickCheck();
