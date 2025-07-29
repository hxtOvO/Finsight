const axios = require('axios');

console.log('🌐 测试实际API端点的数据流');
console.log('='.repeat(60));

async function testAPIEndpoints() {
  const baseURL = 'http://localhost:3000';
  
  try {
    console.log('📊 测试 Performance API 端点...\n');
    
    // 测试 performance API
    const performanceResponse = await axios.get(`${baseURL}/api/performance`);
    
    console.log('✅ Performance API 响应成功:');
    console.log('状态码:', performanceResponse.status);
    console.log('响应数据:');
    console.log(JSON.stringify(performanceResponse.data, null, 2));
    
    console.log('\n' + '-'.repeat(60));
    console.log('📈 数据分析:');
    
    if (Array.isArray(performanceResponse.data)) {
      const totalValue = performanceResponse.data.reduce((sum, item) => sum + item.value, 0);
      const totalPercentage = performanceResponse.data.reduce((sum, item) => sum + item.percentage, 0);
      
      console.log(`总价值: $${totalValue.toLocaleString()}`);
      console.log(`百分比总和: ${totalPercentage.toFixed(2)}%`);
      
      console.log('\n各类型详情:');
      performanceResponse.data.forEach(item => {
        console.log(`  ${item.name.padEnd(8)}: $${item.value.toLocaleString().padStart(12)} (${item.percentage}%)`);
      });
      
      // 检查前端如何处理这些数据
      console.log('\n🎨 前端饼图配置建议:');
      console.log('```javascript');
      console.log('const chartData = {');
      console.log('  labels: [' + performanceResponse.data.map(item => `'${item.name}'`).join(', ') + '],');
      console.log('  datasets: [{');
      console.log('    data: [' + performanceResponse.data.map(item => item.value).join(', ') + '],');
      console.log('    backgroundColor: [');
      const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
      performanceResponse.data.forEach((item, index) => {
        console.log(`      '${colors[index % colors.length]}'${index < performanceResponse.data.length - 1 ? ',' : ''}`);
      });
      console.log('    ]');
      console.log('  }]');
      console.log('};');
      console.log('```');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ 服务器未运行。请先启动后端服务器:');
      console.log('   cd backend && node server.js');
    } else {
      console.log('❌ API 请求失败:', error.message);
      if (error.response) {
        console.log('响应状态:', error.response.status);
        console.log('响应数据:', error.response.data);
      }
    }
  }
}

// 如果服务器未运行，提供启动说明
console.log('💡 确保后端服务器正在运行:');
console.log('   1. 打开新终端');
console.log('   2. cd backend');
console.log('   3. node server.js');
console.log('   4. 然后重新运行此脚本');
console.log('');

testAPIEndpoints();
