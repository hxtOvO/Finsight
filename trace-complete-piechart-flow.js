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

console.log('🎯 完整的 Performance Piechart 数据流追踪');
console.log('📊 使用 current_assets 和 featured_stocks 的正确逻辑');
console.log('='.repeat(80));

async function traceCompleteDataFlow() {
  let db;
  
  try {
    // 连接数据库
    console.log('\n🔌 连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 连接成功');

    // 1. 获取所有当前资产数据
    console.log('\n📊 第一步：获取 current_assets 表数据');
    console.log('='.repeat(60));

    const [currentAssets] = await db.execute('SELECT * FROM current_assets ORDER BY type, symbol');
    console.log(`找到 ${currentAssets.length} 条资产记录:`);
    
    currentAssets.forEach(asset => {
      console.log(`  ${asset.type.padEnd(8)} | ${(asset.symbol || 'N/A').padEnd(8)} | ${asset.amount}`);
    });

    // 2. 获取股票价格数据
    console.log('\n📈 第二步：获取 featured_stocks 表数据');
    console.log('='.repeat(60));

    const [featuredStocks] = await db.execute('SELECT * FROM featured_stocks ORDER BY symbol');
    console.log(`找到 ${featuredStocks.length} 条股价记录:`);
    
    featuredStocks.forEach(stock => {
      const price = parseFloat(stock.price || 0);
      console.log(`  ${stock.symbol.padEnd(8)} | $${price.toFixed(4)}`);
    });

    // 3. 按资产类型分组计算
    console.log('\n🧮 第三步：按资产类型计算总价值');
    console.log('='.repeat(60));

    const performanceData = {};

    // 按类型分组处理
    const assetsByType = {};
    currentAssets.forEach(asset => {
      const type = asset.type;
      if (!assetsByType[type]) {
        assetsByType[type] = [];
      }
      assetsByType[type].push(asset);
    });

    // 计算每种资产类型的总价值
    for (const [assetType, assets] of Object.entries(assetsByType)) {
      console.log(`\n💰 计算 ${assetType.toUpperCase()} 类型资产:`);
      
      let totalValue = 0;
      const calculations = [];

      for (const asset of assets) {
        if (assetType === 'stock') {
          // 股票：数量 × 股价
          const symbol = asset.symbol;
          const quantity = parseFloat(asset.amount);
          const stockData = featuredStocks.find(stock => stock.symbol === symbol);
          
          if (stockData) {
            const price = parseFloat(stockData.price);
            const value = quantity * price;
            totalValue += value;
            
            console.log(`  ${symbol}: ${quantity} 股 × $${price.toFixed(2)} = $${value.toFixed(2)}`);
            calculations.push({ symbol, quantity, price, value });
          } else {
            console.log(`  ${symbol}: ❌ 未找到股价数据`);
            calculations.push({ symbol, quantity, price: 0, value: 0, error: 'Price not found' });
          }
        } else {
          // 其他类型：直接使用 amount 作为价值
          const value = parseFloat(asset.amount);
          totalValue += value;
          
          console.log(`  ${asset.symbol || assetType}: $${value.toFixed(2)}`);
          calculations.push({ symbol: asset.symbol || assetType, value });
        }
      }

      performanceData[assetType] = {
        totalValue,
        calculations,
        count: calculations.length
      };

      console.log(`  📊 ${assetType.toUpperCase()} 总价值: $${totalValue.toFixed(2)}`);
    }

    // 4. 计算总投资组合价值和百分比
    console.log('\n📈 第四步：计算投资组合总价值和占比');
    console.log('='.repeat(60));

    const totalPortfolioValue = Object.values(performanceData).reduce((sum, data) => sum + data.totalValue, 0);
    console.log(`💰 投资组合总价值: $${totalPortfolioValue.toFixed(2)}\n`);

    // 显示各类型占比
    Object.entries(performanceData).forEach(([type, data]) => {
      const percentage = ((data.totalValue / totalPortfolioValue) * 100).toFixed(2);
      console.log(`📊 ${type.toUpperCase().padEnd(8)}: $${data.totalValue.toFixed(2).padStart(12)} (${percentage.padStart(6)}%)`);
    });

    // 5. 生成前端饼图数据格式
    console.log('\n🥧 第五步：生成饼图数据格式');
    console.log('='.repeat(60));

    const piechartData = Object.entries(performanceData).map(([type, data]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1), // 首字母大写
      value: parseFloat(data.totalValue.toFixed(2)),
      percentage: parseFloat(((data.totalValue / totalPortfolioValue) * 100).toFixed(2)),
      count: data.count
    }));

    console.log('\n📊 最终饼图数据 (发送到前端):');
    console.log(JSON.stringify(piechartData, null, 2));

    // 6. 数据验证
    console.log('\n✅ 第六步：数据一致性验证');
    console.log('='.repeat(60));

    const calculatedTotal = piechartData.reduce((sum, item) => sum + item.value, 0);
    const percentageTotal = piechartData.reduce((sum, item) => sum + item.percentage, 0);
    
    console.log(`计算的总价值: $${calculatedTotal.toFixed(2)}`);
    console.log(`投资组合总价值: $${totalPortfolioValue.toFixed(2)}`);
    console.log(`百分比总和: ${percentageTotal.toFixed(2)}%`);
    console.log(`数据一致性: ${Math.abs(calculatedTotal - totalPortfolioValue) < 0.01 ? '✅ 通过' : '❌ 失败'}`);
    console.log(`百分比验证: ${Math.abs(percentageTotal - 100) < 0.01 ? '✅ 通过' : '❌ 失败'}`);

    // 7. 重点关注股票计算详情
    console.log('\n🎯 第七步：股票计算详情回顾');
    console.log('='.repeat(60));

    const stockData = performanceData.stock;
    if (stockData) {
      console.log(`Stock 总价值: $${stockData.totalValue.toFixed(2)}`);
      console.log(`Stock 占比: ${((stockData.totalValue / totalPortfolioValue) * 100).toFixed(2)}%`);
      console.log(`Stock 详细计算:`);
      stockData.calculations.forEach(calc => {
        if (calc.error) {
          console.log(`  ${calc.symbol}: ❌ ${calc.error}`);
        } else {
          console.log(`  ${calc.symbol}: ${calc.quantity} × $${calc.price.toFixed(2)} = $${calc.value.toFixed(2)}`);
        }
      });
    }

    // 8. 前端使用建议
    console.log('\n🖥️  第八步：前端使用建议');
    console.log('='.repeat(60));

    console.log('前端可以使用这些数据来:');
    console.log('1. 渲染饼图展示资产分布');
    console.log('2. 显示总投资组合价值');
    console.log('3. 显示各类型资产的详细信息');
    console.log('4. 提供下钻功能查看具体持仓');
    
    console.log('\n建议的颜色映射:');
    const colors = {
      'Stock': '#36A2EB',
      'Cash': '#4BC0C0', 
      'Bond': '#FFCE56',
      'Other': '#FF6384'
    };
    
    piechartData.forEach(item => {
      const color = colors[item.name] || '#9966FF';
      console.log(`  ${item.name}: ${color}`);
    });

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('详细错误:', error);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行追踪
traceCompleteDataFlow().then(() => {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 完整的 Performance Piechart 数据流追踪完成');
  console.log('📊 基于 current_assets 和 featured_stocks 的正确计算');
  console.log('='.repeat(80));
}).catch(error => {
  console.error('追踪过程中发生错误:', error);
});
