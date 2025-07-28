// get-stock-price.js
// 用于获取某只股票当前价格，供前端页面调用

const yahooFinance = require('yahoo-finance2').default;

async function getStockPrice(symbol) {
  try {
    const quote = await yahooFinance.quote(symbol);
    if (!quote || !quote.regularMarketPrice) {
      console.log(`未获取到 ${symbol} 的价格信息。`);
      return;
    }
    console.log(`${symbol} 当前价格: $${quote.regularMarketPrice}`);
    return quote.regularMarketPrice;
  } catch (err) {
    console.error(`获取 ${symbol} 股价失败:`, err);
  }
}

// 示例：获取苹果公司当前股价
getStockPrice('AAPL');

// 可导出为API供前端调用
module.exports = { getStockPrice };
