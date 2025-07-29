const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '20001003',
  database: process.env.DB_NAME || 'finsight_db',
  port: process.env.DB_PORT || 3306
};

console.log('🔧 数据库配置:');
console.log(`  Host: ${dbConfig.host}`);
console.log(`  User: ${dbConfig.user}`);
console.log(`  Database: ${dbConfig.database}`);
console.log(`  Port: ${dbConfig.port}`);
console.log(`  Password: ${dbConfig.password ? '***' : 'NOT SET'}`);

console.log('='.repeat(80));
console.log('📊 Performance Piechart 数据流追踪');
console.log('='.repeat(80));

async function tracePiechartDataFlow() {
  let db;
  
  try {
    // 1. 连接数据库
    console.log('\n🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 2. 检查原始数据表结构
    console.log('\n📋 检查数据表结构:');
    console.log('-'.repeat(50));
    
    // 检查 assets 表
    console.log('\n🏦 ASSETS 表结构:');
    const [assetsStructure] = await db.execute('DESCRIBE assets');
    assetsStructure.forEach(column => {
      console.log(`  ${column.Field.padEnd(20)} | ${column.Type.padEnd(15)} | ${column.Null} | ${column.Key} | ${column.Default}`);
    });

    // 检查 asset_history 表
    console.log('\n📈 ASSET_HISTORY 表结构:');
    const [historyStructure] = await db.execute('DESCRIBE asset_history');
    historyStructure.forEach(column => {
      console.log(`  ${column.Field.padEnd(20)} | ${column.Type.padEnd(15)} | ${column.Null} | ${column.Key} | ${column.Default}`);
    });

    // 3. 获取原始数据
    console.log('\n📊 获取原始数据:');
    console.log('-'.repeat(50));
    
    // 获取所有资产
    const [assets] = await db.execute('SELECT * FROM assets ORDER BY id');
    console.log(`\n💰 资产表中共有 ${assets.length} 条记录:`);
    assets.forEach(asset => {
      console.log(`  ID: ${asset.id} | 类型: ${(asset.asset_type || 'N/A').padEnd(10)} | 价值: $${asset.value}`);
    });

    // 获取最新的历史数据
    const [latestHistory] = await db.execute(`
      SELECT * FROM asset_history 
      WHERE date = (SELECT MAX(date) FROM asset_history) 
      ORDER BY id
    `);
    console.log(`\n📈 最新历史数据 (${latestHistory.length} 条记录):`);
    latestHistory.forEach(record => {
      console.log(`  ID: ${record.id} | 日期: ${record.date} | 现金: $${record.cash_value || 0} | 股票: $${record.stock_value || 0} | 债券: $${record.bond_value || 0} | 其他: $${record.other_value || 0}`);
    });

    // 4. 模拟后端API计算逻辑
    console.log('\n🔄 模拟后端 Performance API 计算:');
    console.log('-'.repeat(50));

    // 根据实际数据库结构处理数据
    const performanceData = {};
    
    // 处理 assets 表数据
    for (const asset of assets) {
      const type = asset.asset_type || 'Unknown';
      const currentValue = parseFloat(asset.value) || 0;
      
      if (!performanceData[type]) {
        performanceData[type] = {
          totalValue: 0,
          assets: [],
          count: 0
        };
      }
      
      performanceData[type].totalValue += currentValue;
      performanceData[type].assets.push({
        id: asset.id,
        value: currentValue,
        updated_at: asset.updated_at
      });
      performanceData[type].count++;
    }

    // 如果有历史数据，也处理历史数据
    if (latestHistory.length > 0) {
      const latestRecord = latestHistory[0];
      console.log('\n📊 处理历史数据:');
      
      // 创建基于历史数据的性能数据
      const historyPerformanceData = {
        Cash: { totalValue: parseFloat(latestRecord.cash_value) || 0, count: 1 },
        Stock: { totalValue: parseFloat(latestRecord.stock_value) || 0, count: 1 },
        Bond: { totalValue: parseFloat(latestRecord.bond_value) || 0, count: 1 },
        Other: { totalValue: parseFloat(latestRecord.other_value) || 0, count: 1 }
      };
      
      console.log('历史数据分析:');
      Object.entries(historyPerformanceData).forEach(([type, data]) => {
        if (data.totalValue > 0) {
          console.log(`  ${type}: $${data.totalValue.toFixed(2)}`);
        }
      });
      
      // 使用历史数据覆盖当前数据（如果历史数据更完整）
      const historyTotal = Object.values(historyPerformanceData).reduce((sum, item) => sum + item.totalValue, 0);
      const assetsTotal = Object.values(performanceData).reduce((sum, item) => sum + item.totalValue, 0);
      
      if (historyTotal > assetsTotal) {
        console.log('\n🔄 使用历史数据作为主要数据源');
        Object.entries(historyPerformanceData).forEach(([type, data]) => {
          if (data.totalValue > 0) {
            performanceData[type] = {
              totalValue: data.totalValue,
              assets: [{
                source: 'history',
                value: data.totalValue,
                date: latestRecord.date
              }],
              count: 1
            };
          }
        });
      }
    }

    // 计算总投资组合价值
    const totalPortfolioValue = Object.values(performanceData).reduce((sum, type) => sum + type.totalValue, 0);

    console.log('\n💼 按资产类型分组的数据:');
    Object.entries(performanceData).forEach(([type, data]) => {
      const percentage = totalPortfolioValue > 0 ? ((data.totalValue / totalPortfolioValue) * 100).toFixed(2) : '0.00';
      console.log(`\n  📊 ${type.toUpperCase()}:`);
      console.log(`    总价值: $${data.totalValue.toFixed(2)}`);
      console.log(`    占比: ${percentage}%`);
      console.log(`    资产数量: ${data.count}`);
      console.log(`    详细资产:`);
      data.assets.forEach(asset => {
        if (asset.source === 'history') {
          console.log(`      - 历史数据: $${asset.value.toFixed(2)} (${asset.date})`);
        } else {
          console.log(`      - ID ${asset.id}: $${asset.value.toFixed(2)}`);
        }
      });
    });

    console.log(`\n💰 投资组合总价值: $${totalPortfolioValue.toFixed(2)}`);

    // 5. 生成饼图数据格式
    console.log('\n🥧 生成饼图数据格式:');
    console.log('-'.repeat(50));

    const piechartData = Object.entries(performanceData).map(([type, data]) => ({
      name: type,
      value: parseFloat(data.totalValue.toFixed(2)),
      percentage: parseFloat(((data.totalValue / totalPortfolioValue) * 100).toFixed(2)),
      count: data.count
    }));

    console.log('\n📊 最终饼图数据 (发送到前端):');
    console.log(JSON.stringify(piechartData, null, 2));

    // 6. 验证数据一致性
    console.log('\n✅ 数据一致性验证:');
    console.log('-'.repeat(50));
    
    const calculatedTotal = piechartData.reduce((sum, item) => sum + item.value, 0);
    const percentageTotal = piechartData.reduce((sum, item) => sum + item.percentage, 0);
    
    console.log(`计算的总价值: $${calculatedTotal.toFixed(2)}`);
    console.log(`数据库总价值: $${totalPortfolioValue.toFixed(2)}`);
    console.log(`百分比总和: ${percentageTotal.toFixed(2)}%`);
    console.log(`数据一致性: ${Math.abs(calculatedTotal - totalPortfolioValue) < 0.01 ? '✅ 通过' : '❌ 失败'}`);
    console.log(`百分比验证: ${Math.abs(percentageTotal - 100) < 0.01 ? '✅ 通过' : '❌ 失败'}`);

    // 7. 模拟前端处理
    console.log('\n🖥️  前端接收数据处理:');
    console.log('-'.repeat(50));
    
    console.log('前端会将此数据用于:');
    console.log('1. 渲染饼图 (使用 Chart.js 或类似库)');
    console.log('2. 显示各类型占比');
    console.log('3. 显示总投资组合价值');
    console.log('4. 可能的颜色映射:');
    
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    piechartData.forEach((item, index) => {
      console.log(`   ${item.name}: ${colors[index % colors.length]}`);
    });

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    if (error.code) {
      console.error(`错误代码: ${error.code}`);
    }
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行追踪
tracePiechartDataFlow().then(() => {
  console.log('\n' + '='.repeat(80));
  console.log('📊 数据流追踪完成');
  console.log('='.repeat(80));
}).catch(error => {
  console.error('追踪过程中发生错误:', error);
});
