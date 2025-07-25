const mysql = require('mysql2/promise');
require('dotenv').config();

async function generateData() {
  let db;
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('✅ 连接成功');

    // 删除所有旧数据
    await db.execute('DELETE FROM performance_history');
    console.log('🗑️ 清空数据');

    // 生成180天数据
    const today = new Date();
    const portfolioTotal = 12540.00;
    const baseValue = 10000;
    
    console.log('📊 开始生成180天数据...');
    
    for (let i = 179; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // 计算渐进式增长
      let value;
      if (i === 0) {
        // 今天的值就是实际总额
        value = portfolioTotal;
      } else {
        // 计算历史值，确保平滑增长
        const progress = (179 - i) / 179; // 0到1的进度
        const targetGrowth = portfolioTotal / baseValue - 1; // 总增长率
        const currentGrowth = targetGrowth * progress; // 当前应有的增长率
        
        // 添加随机波动
        const randomFactor = 1 + (Math.random() - 0.5) * 0.03; // ±1.5%随机波动
        value = (baseValue + baseValue * currentGrowth) * randomFactor;
        value = Math.round(value * 100) / 100;
      }
      
      // 插入数据
      await db.execute(
        'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, value, 'all']
      );
      
      if ((179 - i) % 30 === 0) {
        console.log(`  已生成 ${179 - i} 天数据...`);
      }
    }

    // 验证数据
    const [count] = await db.execute('SELECT COUNT(*) as count FROM performance_history');
    console.log(`✅ 生成完成！总共 ${count[0].count} 条数据`);

    // 显示最新几条
    const [recent] = await db.execute('SELECT date, value FROM performance_history ORDER BY date DESC LIMIT 5');
    console.log('📅 最新5天数据:');
    recent.forEach(row => {
      console.log(`  ${row.date}: $${row.value}`);
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

generateData();
