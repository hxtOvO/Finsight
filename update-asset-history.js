const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '20001003',
  database: process.env.DB_NAME || 'finsight_db',
  port: process.env.DB_PORT || 3306
};

// 生成随机数的辅助函数
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// 检查是否为月底（最后3天）
function isEndOfMonth(date) {
  const nextDay = new Date(date);
  nextDay.setDate(date.getDate() + 1);
  return nextDay.getMonth() !== date.getMonth();
}

// 检查是否为周末（周五到周日作为grocery购买时间）
function isWeekend(date) {
  const day = date.getDay();
  return day === 5 || day === 6 || day === 0; // 周五、周六、周日
}

// 检查是否为投资日（随机10%的概率）
function isInvestmentDay() {
  return Math.random() < 0.1;
}

// 检查是否为股票交易日（随机15%的概率）
function isStockTradingDay() {
  return Math.random() < 0.15;
}

async function generateAssetHistoryData() {
  let db;
  
  try {
    console.log('🔗 连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 清空现有数据
    console.log('🗑️ 清空现有 asset_history 数据...');
    await db.execute('DELETE FROM asset_history');
    console.log('✅ 现有数据已清空');

    // 初始值设定
    let currentCash = 8000;  // 调整初始现金，便于过渡到最终15400
    let currentStock = 25000; // 调整初始股票价值，便于过渡到最终34915
    const baseBond = 35000;
    const baseOther = 350000;

        console.log('⚡ 开始生成181天历史数据 (2024-12-02 到 2025-07-31)...');
    console.log(`💰 初始值: Cash=${currentCash}, Stock=${currentStock}, Bond=${baseBond}, Other=${baseOther}`);

    const endDate = new Date('2025-07-31'); // 改为7-31作为最新日期
    const dataToInsert = [];

    // 生成181天数据（从180天前到2025-07-31，共181天）
    for (let i = 180; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(endDate.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // === 现金逻辑 ===
      let cashChange = 0;

      // 月底工资 (+7000)
      if (isEndOfMonth(date)) {
        cashChange += 7000;
        console.log(`💼 ${dateStr}: 月底工资 +7000`);
      }

      // 周末购物 (-500左右)
      if (isWeekend(date)) {
        const groceryExpense = randomBetween(400, 600);
        cashChange -= groceryExpense;
        console.log(`🛒 ${dateStr}: 购物支出 -${groceryExpense.toFixed(0)}`);
      }

      // 随机日常消费 (-50到-200)
      const dailyExpense = randomBetween(50, 200);
      cashChange -= dailyExpense;

      // 投资活动（现金转入/转出）
      if (isInvestmentDay()) {
        const investmentAmount = randomBetween(1000, 5000);
        if (Math.random() > 0.5) {
          // 投资转出现金
          cashChange -= investmentAmount;
          console.log(`📈 ${dateStr}: 投资转出 -${investmentAmount.toFixed(0)}`);
        } else {
          // 投资收益转入现金
          cashChange += investmentAmount;
          console.log(`💰 ${dateStr}: 投资收益 +${investmentAmount.toFixed(0)}`);
        }
      }

      currentCash += cashChange;
      // 确保现金在合理范围内（以15400为中值上下波动）
      if (currentCash < 5000) {
        currentCash = randomBetween(8000, 12000);
      } else if (currentCash > 25000) {
        currentCash = randomBetween(12000, 18000);
      }

      // === 股票逻辑 ===
      let stockChange = 0;
      
      // 股票交易日
      if (isStockTradingDay()) {
        const tradeAmount = randomBetween(2000, 8000);
        if (Math.random() > 0.5) {
          // 买入股票
          stockChange += tradeAmount;
          console.log(`📊 ${dateStr}: 买入股票 +${tradeAmount.toFixed(0)}`);
        } else {
          // 卖出股票
          stockChange -= tradeAmount;
          console.log(`📉 ${dateStr}: 卖出股票 -${tradeAmount.toFixed(0)}`);
        }
      }

      // 股票市场波动 (±2%)
      const marketVolatility = currentStock * randomBetween(-0.02, 0.02);
      stockChange += marketVolatility;

      currentStock += stockChange;
      // 确保股票价值在合理范围内（调整上限以适应最终34915的目标）
      if (currentStock < 10000) {
        currentStock = randomBetween(10000, 15000);
      } else if (currentStock > 40000) {
        currentStock = randomBetween(32000, 38000);
      }

      // === 债券和其他资产（基本不变，小幅波动） ===
      let bondValue = baseBond + randomBetween(-500, 500);
      let otherValue = baseOther + randomBetween(-2000, 2000);

      // 特殊处理：如果是2025-07-31，设置指定的资产值
      if (dateStr === '2025-07-31') {
        console.log('🎯 设置2025-07-31的指定资产值');
        currentCash = 15400;  // 修改为15400
        currentStock = 34915;  // 修改为34915
        bondValue = 35000;
        otherValue = 350000;
      }

      // 四舍五入到2位小数
      const finalCash = Math.round(currentCash * 100) / 100;
      const finalStock = Math.round(currentStock * 100) / 100;
      const finalBond = Math.round(bondValue * 100) / 100;
      const finalOther = Math.round(otherValue * 100) / 100;

      dataToInsert.push([dateStr, finalCash, finalStock, finalBond, finalOther]);

      // 每30天显示一次进度
      if (i % 30 === 0 || dateStr === '2025-07-31') {
        const totalValue = finalCash + finalStock + finalBond + finalOther;
        console.log(`📅 ${dateStr}: 总价值=${totalValue.toFixed(0)} (Cash=${finalCash}, Stock=${finalStock}, Bond=${finalBond}, Other=${finalOther})`);
      }
    }

    // 批量插入数据
    console.log('💾 批量插入数据到数据库...');
    for (const record of dataToInsert) {
      await db.execute(
        'INSERT INTO asset_history (date, cash_value, stock_value, bond_value, other_value) VALUES (?, ?, ?, ?, ?)',
        record
      );
    }

    console.log('✅ 数据生成完成！');
    console.log(`📊 总共生成了 ${dataToInsert.length} 条记录 (181天数据)`);

    // 显示最终统计
    const lastRecord = dataToInsert[dataToInsert.length - 1];
    const [lastDate, lastCash, lastStock, lastBond, lastOther] = lastRecord;
    const totalValue = lastCash + lastStock + lastBond + lastOther;
    
    console.log('\n📈 最终数据统计:');
    console.log(`📅 最新日期: ${lastDate}`);
    console.log(`💰 现金: $${lastCash.toLocaleString()}`);
    console.log(`📊 股票: $${lastStock.toLocaleString()}`);
    console.log(`🏦 债券: $${lastBond.toLocaleString()}`);
    console.log(`🏠 其他: $${lastOther.toLocaleString()}`);
    console.log(`💎 总价值: $${totalValue.toLocaleString()}`);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    if (db) {
      await db.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行脚本
console.log('🚀 开始生成 asset_history 表数据...');
console.log('📋 数据规则:');
console.log('  💰 现金: 基础8000, 最终15400, 月底+7000工资, 周末-500购物, 日常消费, 投资进出');
console.log('  📊 股票: 基础25000, 最终34915, 随机交易, 市场波动');
console.log('  🏦 债券: 35000基础, 小幅波动');
console.log('  🏠 其他: 350000基础, 小幅波动');
console.log('');

generateAssetHistoryData().then(() => {
  console.log('🎉 脚本执行完成！');
  process.exit(0);
}).catch(error => {
  console.error('💥 脚本执行失败:', error);
  process.exit(1);
});
