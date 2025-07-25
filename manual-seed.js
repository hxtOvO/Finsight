// manual-seed.js - 手动生成数据库数据
const mysql = require('mysql2/promise');
require('dotenv').config();

async function manualSeed() {
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
    await db.execute('DELETE FROM portfolio');
    await db.execute('DELETE FROM assets');
    console.log('🗑️ 清空现有数据');

    // 插入基础数据
    await db.execute(
      'INSERT INTO portfolio (total_value, gain_loss, gain_loss_percent) VALUES (?, ?, ?)',
      [8340.00, 0.00, 0.00]
    );

    const initialAssets = [
      ['Cash', 2000.00],
      ['Stock', 3340.00],
      ['Bond', 2000.00],
      ['Other', 1000.00]
    ];
    
    for (const [type, value] of initialAssets) {
      await db.execute(
        'INSERT INTO assets (asset_type, value) VALUES (?, ?)',
        [type, value]
      );
    }
    console.log('💰 插入基础数据');

    const currentTotal = 8340.00;

    // 生成7天数据
    console.log('📊 生成7天数据...');
    const baseValue7d = 8000;
    const dailyGrowthRate7d = Math.pow(currentTotal / baseValue7d, 1/6) - 1;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let value;
      if (i === 0) {
        value = currentTotal;
      } else {
        value = baseValue7d * Math.pow(1 + dailyGrowthRate7d, 6 - i);
        value = Math.round(value * 100) / 100;
      }
      
      await db.execute(
        'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, value, '7d']
      );
    }

    // 生成30天数据（1个月）
    console.log('📊 生成30天数据...');
    const baseValue1m = 7500;
    const dailyGrowthRate1m = Math.pow(currentTotal / baseValue1m, 1/29) - 1;
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let value;
      if (i === 0) {
        value = currentTotal;
      } else {
        value = baseValue1m * Math.pow(1 + dailyGrowthRate1m, 29 - i);
        value = Math.round(value * 100) / 100;
      }
      
      await db.execute(
        'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, value, '1m']
      );
    }

    // 生成180天数据（6个月）
    console.log('📊 生成180天数据...');
    const baseValue6m = 6000;
    const dailyGrowthRate6m = Math.pow(currentTotal / baseValue6m, 1/179) - 1;
    
    for (let i = 179; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let value;
      if (i === 0) {
        value = currentTotal;
      } else {
        value = baseValue6m * Math.pow(1 + dailyGrowthRate6m, 179 - i);
        value = Math.round(value * 100) / 100;
      }
      
      await db.execute(
        'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, value, '6m']
      );
    }

    // 验证数据
    const [count7d] = await db.execute('SELECT COUNT(*) as count FROM performance_history WHERE range_type = "7d"');
    const [count1m] = await db.execute('SELECT COUNT(*) as count FROM performance_history WHERE range_type = "1m"');
    const [count6m] = await db.execute('SELECT COUNT(*) as count FROM performance_history WHERE range_type = "6m"');
    
    console.log('✅ 数据生成完成:');
    console.log(`   7天数据: ${count7d[0].count} 条`);
    console.log(`   1月数据: ${count1m[0].count} 条`);
    console.log(`   6月数据: ${count6m[0].count} 条`);

    await db.end();
  } catch (error) {
    console.error('❌ 数据生成失败:', error);
  }
}

manualSeed();
