// 测试 /api/piechart 接口，打印后端返回的饼图数据
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/piechart');
    if (!res.ok) throw new Error('API请求失败');
    const data = await res.json();
    console.log('后端 /api/piechart 返回数据:');
    console.log(data);
  } catch (err) {
    console.error('测试失败:', err.message);
  }
})();
