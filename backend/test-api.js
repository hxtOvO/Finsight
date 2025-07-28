const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('🧪 测试API端点...\n');
    
    // 测试7天数据
    const response7d = await fetch('http://localhost:3000/api/performance/7d');
    const data7d = await response7d.json();
    console.log('📊 7天数据:', data7d.length, '个点');
    
    // 测试1月数据
    const response1m = await fetch('http://localhost:3000/api/performance/1m');
    const data1m = await response1m.json();
    console.log('📊 1月数据:', data1m.length, '个点');
    
    // 测试6月数据
    const response6m = await fetch('http://localhost:3000/api/performance/6m');
    const data6m = await response6m.json();
    console.log('📊 6月数据:', data6m.length, '个点');
    
    console.log('\n✅ API测试完成！');
    
  } catch (error) {
    console.error('❌ API测试失败:', error.message);
  }
}

testAPI();
