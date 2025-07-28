const mysql = require('mysql2/promise');
require('dotenv').config();

async function generateRealisticData() {
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

    // 生成更真实的180天数据
    const today = new Date();
    const portfolioTotal = 12540.00;
    const baseValue = 10000;
    
    console.log('📊 开始生成更真实的180天数据...');
    
    let currentValue = baseValue;
    const targetGrowthRate = Math.pow(portfolioTotal / baseValue, 1/179) - 1; // 目标日增长率
    
    for (let i = 179; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let value;
      if (i === 0) {
        // 今天的值就是实际总额
        value = portfolioTotal;
      } else {
        // 更真实的波动模型
        // 1. 基础趋势增长
        const trendGrowth = targetGrowthRate;
        
        // 2. 随机日波动 (-3% 到 +5%)
        const dailyVolatility = (Math.random() - 0.4) * 0.08; // 偏向正增长
        
        // 3. 周期性波动 (模拟市场周期)
        const cyclePosition = (179 - i) / 30; // 30天一个周期
        const cyclicFactor = Math.sin(cyclePosition * Math.PI) * 0.015; // ±1.5%的周期波动
        
        // 4. 趋势修正 (确保最终到达目标值)
        const progressToTarget = (179 - i) / 179;
        const expectedValue = baseValue * Math.pow(1 + targetGrowthRate, 179 - i);
        const correctionFactor = (expectedValue / currentValue - 1) * 0.1; // 10%的修正力度
        
        // 综合所有因素
        const totalChange = trendGrowth + dailyVolatility + cyclicFactor + correctionFactor;
        currentValue = currentValue * (1 + totalChange);
        
        // 添加一些突发性事件 (小概率大波动)
        if (Math.random() < 0.02) { // 2%概率
          const eventImpact = (Math.random() - 0.3) * 0.15; // -4.5%到+10.5%
          currentValue = currentValue * (1 + eventImpact);
          console.log(`  📈 Day ${179-i}: 市场事件影响 ${(eventImpact*100).toFixed(1)}%`);
        }
        
        value = Math.round(currentValue * 100) / 100;
      }
      
      // 插入数据
      await db.execute(
        'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, value, 'all']
      );
      
      if ((179 - i) % 30 === 0) {
        console.log(`  已生成 ${179 - i} 天数据... 当前值: $${value}`);
      }
    }

    // 验证数据
    const [count] = await db.execute('SELECT COUNT(*) as count FROM performance_history');
    console.log(`✅ 生成完成！总共 ${count[0].count} 条数据`);

    // 计算实际波动率
    const [stats] = await db.execute(`
      SELECT 
        MIN(value) as min_value,
        MAX(value) as max_value,
        AVG(value) as avg_value,
        STDDEV(value) as std_dev
      FROM performance_history
    `);
    
    const volatility = (stats[0].std_dev / stats[0].avg_value * 100).toFixed(2);
    const maxDrawdown = ((stats[0].max_value - stats[0].min_value) / stats[0].max_value * 100).toFixed(2);
    
    console.log('📊 数据统计:');
    console.log(`   价值范围: $${stats[0].min_value} - $${stats[0].max_value}`);
    console.log(`   平均值: $${Math.round(stats[0].avg_value)}`);
    console.log(`   波动率: ${volatility}%`);
    console.log(`   最大回撤: ${maxDrawdown}%`);

    // 显示最新几条
    const [recent] = await db.execute('SELECT date, value FROM performance_history ORDER BY date DESC LIMIT 7');
    console.log('📅 最新7天数据:');
    recent.forEach((row, index) => {
      const change = index < recent.length - 1 ? 
        ((row.value - recent[index + 1].value) / recent[index + 1].value * 100).toFixed(2) : '0.00';
      console.log(`  ${row.date}: $${row.value} (${change > 0 ? '+' : ''}${change}%)`);
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

generateRealisticData();
