// fix-database.js - 修复数据库表结构
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDatabase() {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('✅ 数据库连接成功');

    // 清空现有数据
    await db.execute('DELETE FROM performance_history');
    console.log('🗑️ 清空旧数据');

    // 确保表结构正确
    try {
      await db.execute('ALTER TABLE performance_history MODIFY range_type ENUM("7d", "1m", "6m", "all") NOT NULL');
      console.log('✅ 更新表结构');
    } catch (error) {
      console.log('ℹ️ 表结构已是最新');
    }

    // 生成完整的180天历史数据
    const baseValue = 10000;
    const portfolioTotal = 12540.00;
    const dailyGrowthRate = Math.pow(portfolioTotal / baseValue, 1/179) - 1;
    
    console.log('📊 生成180天完整历史数据...');
    
    for (let i = 179; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let value;
      if (i === 0) {
        value = portfolioTotal;
      } else {
        const baseGrowth = baseValue * Math.pow(1 + dailyGrowthRate, 179 - i);
        const randomFactor = 1 + (Math.random() - 0.5) * 0.02;
        value = baseGrowth * randomFactor;
        value = Math.round(value * 100) / 100;
      }
      
      await db.execute(
        'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, value, 'all']
      );
    }

    // 检查数据
    const [count] = await db.execute('SELECT COUNT(*) as count FROM performance_history WHERE range_type = "all"');
    console.log(`✅ 生成了 ${count[0].count} 条数据`);

    await db.end();
    console.log('🎉 数据库修复完成！');
  } catch (error) {
    console.error('❌ 修复失败:', error);
  }
}

fixDatabase();
