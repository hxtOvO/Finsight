// script-api.js - Portfolio dashboard logic with backend integration

// API configuration
const API_BASE = 'http://localhost:3000/api';

// Range configurations
const ranges = {
  '7d': { label: '7 Days', days: 7 },
  '1m': { label: '1 Month', days: 30 },
  '6m': { label: '6 Months', days: 180 }
};

// Global variables
let chart;
let allocationChart;
let currentRange = '7d';
let allocationDataCache = null;
let performanceDataCache = {}; // 缓存性能数据

// 清除缓存函数
function clearPerformanceCache() {
  performanceDataCache = {};
  console.log('🗑️ 性能数据缓存已清除');
}

// API functions
async function fetchPortfolioData() {
  try {
    const response = await fetch(`${API_BASE}/portfolio`);
    if (!response.ok) throw new Error('Failed to fetch portfolio data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    // Fallback to mock data
    return {
      total_value: 12540.00,
      gain_loss: 230.00,
      gain_loss_percent: 1.87
    };
  }
}

async function fetchAssetData() {
  try {
    const response = await fetch(`${API_BASE}/assets`);
    if (!response.ok) throw new Error('Failed to fetch asset data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching asset data:', error);
    // Fallback to mock data
    return [
      { asset_type: 'Cash', value: 3000 },
      { asset_type: 'Stock', value: 5500 },
      { asset_type: 'Bond', value: 3200 },
      { asset_type: 'Other', value: 840 }
    ];
  }
}

async function fetchPerformanceData(range) {
  // 如果已有缓存数据，直接返回
  if (performanceDataCache[range]) {
    console.log(`📦 使用缓存数据 ${range}:`, performanceDataCache[range].length, '个数据点');
    // 更新最后一个数据点为当前总值，但保持历史数据不变
    const portfolioData = await fetchPortfolioData();
    const currentTotal = portfolioData.total_value;
    const cachedData = [...performanceDataCache[range]]; // 复制数组避免修改原缓存
    if (cachedData.length > 0) {
      cachedData[cachedData.length - 1].value = currentTotal;
    }
    return cachedData;
  }

  try {
    console.log(`🌐 API请求 ${range} 数据...`);
    const response = await fetch(`${API_BASE}/performance/${range}`);
    if (!response.ok) throw new Error('Failed to fetch performance data');
    const data = await response.json();
    
    console.log(`📊 API返回 ${range} 数据:`, data.length, '个数据点');
    
    if (data.length === 0) {
      console.log(`🔄 生成fallback数据 ${range}...`);
      // Generate fallback data if no historical data exists
      const fallbackData = await generateFallbackPerformanceData(range);
      performanceDataCache[range] = fallbackData; // 缓存fallback数据
      return fallbackData;
    }
    
    // Ensure the last data point uses current portfolio value
    const portfolioData = await fetchPortfolioData();
    const currentTotal = portfolioData.total_value;
    
    // Update the last data point to current total
    if (data.length > 0) {
      data[data.length - 1].value = currentTotal;
    }
    
    performanceDataCache[range] = data; // 缓存真实数据
    return data;
  } catch (error) {
    console.error('Error fetching performance data:', error);
    console.log(`🔄 API失败，生成fallback数据 ${range}...`);
    const fallbackData = await generateFallbackPerformanceData(range);
    performanceDataCache[range] = fallbackData; // 缓存fallback数据
    return fallbackData;
  }
}

async function updateAssetValue(assetType, change) {
  try {
    const response = await fetch(`${API_BASE}/assets/${assetType}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ change: parseFloat(change) })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update asset');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating asset:', error);
    throw error;
  }
}

// Fallback data generation - 使用固定逻辑而非随机数
async function generateFallbackPerformanceData(range) {
  const days = ranges[range].days;
  const data = [];
  
  // 获取当前投资组合总值作为最后一个数据点
  const portfolioData = await fetchPortfolioData();
  const currentTotal = portfolioData.total_value;
  
  // 使用固定的基准值作为起始点
  const baseValues = {
    '7d': 12000,   // 7天前的固定起始值
    '1m': 11500,   // 1个月前的固定起始值  
    '6m': 10000    // 6个月前的固定起始值
  };
  
  const baseValue = baseValues[range] || 12000;
  
  // 计算从起始值到当前值的增长
  const totalGrowth = (currentTotal - baseValue) / baseValue;
  const dailyGrowthRate = Math.pow(1 + totalGrowth, 1 / (days - 1)) - 1;
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    if (i === 0) {
      // 最后一个数据点使用当前总值
      data.push({
        date: date.toISOString().split('T')[0],
        value: currentTotal
      });
    } else {
      // 使用指数增长模式生成历史数据
      const value = baseValue * Math.pow(1 + dailyGrowthRate, days - 1 - i);
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100
      });
    }
  }
  
  return data;
}

function getLabelsFromData(data, range) {
  if (range === '6m') {
    // 6个月显示年月格式
    return data.map(item => new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  } else {
    // 7天和1个月都显示月日格式
    return data.map(item => new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
}

function getValuesFromData(data, range) {
  // 直接返回所有数据，后端已经做了抽样
  return data.map(item => item.value);
}

function formatMoney(val) {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Chart creation functions
async function updateChart(range = '7d') {
  currentRange = range;
  const performanceData = await fetchPerformanceData(range);
  const labels = getLabelsFromData(performanceData, range);
  const values = getValuesFromData(performanceData, range);
  
  if (!chart) {
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(219,0,17,0.32)');
    gradient.addColorStop(0.5, 'rgba(219,0,17,0.12)');
    gradient.addColorStop(1, 'rgba(219,0,17,0.01)');

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Portfolio Value',
          data: values,
          borderColor: '#db0011',
          backgroundColor: gradient,
          pointRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#db0011',
          borderWidth: 3,
          fill: true,
          tension: 0.38
        }]
      },
      options: {
        responsive: true,
        animation: {
          duration: 1600,
          easing: 'easeOutQuart',
          animateScale: true,
          animateRotate: true,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#fff',
            titleColor: '#db0011',
            bodyColor: '#222',
            borderColor: '#db0011',
            borderWidth: 1,
            padding: 12,
            titleFont: { weight: 'bold', size: 16 },
            bodyFont: { size: 15 },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#222', font: { size: 14 } },
          },
          y: {
            grid: { color: '#f3f4f6' },
            ticks: { color: '#222', font: { size: 14 } },
          },
        },
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update();
  }
}

async function updatePortfolioHeader(range = '7d') {
  const portfolioData = await fetchPortfolioData();
  const performanceData = await fetchPerformanceData(range);
  
  document.getElementById('portfolioValue').textContent = `Total: ${formatMoney(portfolioData.total_value)}`;
  
  // 计算基于时间范围的涨跌幅
  let gainLoss = 0;
  let gainLossPercent = 0;
  
  if (performanceData && performanceData.length >= 2) {
    const currentValue = performanceData[performanceData.length - 1].value; // 最新值
    const startValue = performanceData[0].value; // 开始值
    
    gainLoss = currentValue - startValue;
    gainLossPercent = ((gainLoss / startValue) * 100);
  }
  
  const gainElement = document.getElementById('portfolioGain');
  const isPositive = gainLoss >= 0;
  gainElement.textContent = `${isPositive ? '+' : '-'} ${formatMoney(Math.abs(gainLoss))} (${isPositive ? '+' : '-'}${Math.abs(gainLossPercent).toFixed(2)}%)`;
  gainElement.className = `portfolio-gain ${isPositive ? 'positive' : 'negative'}`;
}

async function createAllocationChart() {
  if (allocationDataCache) {
    const assetData = allocationDataCache;
    const ctx = document.getElementById('allocationChart').getContext('2d');
    
    if (allocationChart) {
      allocationChart.destroy();
    }
    
    const labels = assetData.map(item => item.asset_type);
    const values = assetData.map(item => item.value);
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];
    
    allocationChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        layout: {
          padding: {
            top: 40,
            bottom: 40,
            left: 40,
            right: 40
          }
        },
        plugins: {
          legend: {
            display: false // 隐藏默认图例
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${formatMoney(value)} (${percentage}%)`;
              }
            }
          },
          // 自定义标签插件
          datalabels: false // 如果使用了 chartjs-plugin-datalabels，先禁用
        },
        elements: {
          arc: {
            // 添加引线样式配置
            borderAlign: 'center'
          }
        }
      },
      plugins: [{
        id: 'customLabels',
        afterDraw: function(chart) {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;
          
          chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            const total = dataset.data.reduce((a, b) => a + b, 0);
            
            meta.data.forEach((arc, index) => {
              const angle = (arc.startAngle + arc.endAngle) / 2;
              const radius = arc.outerRadius;
              const labelRadius = radius + 25; // 减少标签距离
              
              // 计算百分比
              const value = dataset.data[index];
              const percentage = Math.round((value / total) * 100);
              
              // 在饼图扇形上显示百分比（如果扇形足够大）
              if (percentage >= 25) { // 只有大于等于25%才显示
                const percentageRadius = radius * 0.7; // 百分比显示在扇形的70%位置
                const percentageX = centerX + Math.cos(angle) * percentageRadius;
                const percentageY = centerY + Math.sin(angle) * percentageRadius;
                
                ctx.save();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${percentage}%`, percentageX, percentageY);
                ctx.restore();
              }
              
              // 计算标签位置
              const labelX = centerX + Math.cos(angle) * labelRadius;
              const labelY = centerY + Math.sin(angle) * labelRadius;
              
              // 绘制标签（不绘制引线）
              const label = chart.data.labels[index];
              
              ctx.save();
              ctx.fillStyle = '#222';
              ctx.font = 'bold 12px Arial';
              ctx.textAlign = 'center'; // 居中对齐，更简洁
              ctx.textBaseline = 'middle';
              
              // 绘制资产类型标签
              ctx.fillText(label, labelX, labelY - 6);
              
              // 绘制金额
              ctx.font = '11px Arial';
              ctx.fillStyle = '#666';
              ctx.fillText(`${formatMoney(value)}`, labelX, labelY + 6);
              
              ctx.restore();
            });
          });
        }
      }]
    });
  }
}

// Navigation functions
function showPerformanceSection() {
  document.getElementById('allocationSection').style.display = 'none';
  document.getElementById('portfolioChart').style.display = 'block';
  
  // Show/hide range toggle and gain/loss
  document.querySelector('.range-toggle').style.visibility = 'visible';
  document.getElementById('portfolioGain').style.visibility = 'visible';
  
  // Update nav buttons
  document.querySelector('.nav-performance').classList.add('active');
  document.querySelector('.nav-allocation').classList.remove('active');
  
  updateChart(currentRange);
}

async function showAllocationSection() {
  document.getElementById('portfolioChart').style.display = 'none';
  document.getElementById('allocationSection').style.display = 'block';
  
  // Hide range toggle and gain/loss
  document.querySelector('.range-toggle').style.visibility = 'hidden';
  document.getElementById('portfolioGain').style.visibility = 'hidden';
  
  // Update nav buttons
  document.querySelector('.nav-allocation').classList.add('active');
  document.querySelector('.nav-performance').classList.remove('active');
  
  // Load allocation data if not cached
  if (!allocationDataCache) {
    allocationDataCache = await fetchAssetData();
  }
  
  createAllocationChart();
}

// Event listeners
document.addEventListener('DOMContentLoaded', async function() {
  // 清除缓存确保获取新数据
  clearPerformanceCache();
  
  // Initialize portfolio header with 7d range
  await updatePortfolioHeader('7d');
  
  // Initialize chart with 7d data
  await updateChart('7d');
  
  // Range toggle buttons
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const range = this.getAttribute('data-range');
      await updateChart(range);
      await updatePortfolioHeader(range); // 同时更新头部信息
    });
  });
  
  // Navigation buttons
  document.querySelector('.nav-performance').addEventListener('click', showPerformanceSection);
  document.querySelector('.nav-allocation').addEventListener('click', showAllocationSection);
  
  // Asset allocation form
  document.getElementById('allocationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const selectedAsset = document.querySelector('input[name="assetType"]:checked').value;
    const changeValue = document.getElementById('assetChange').value;
    
    if (!changeValue) {
      alert('Please enter a change amount');
      return;
    }
    
    try {
      const result = await updateAssetValue(selectedAsset, changeValue);
      
      // Update cached allocation data
      allocationDataCache = await fetchAssetData();
      
      // Update portfolio header
      await updatePortfolioHeader();
      
      // Recreate allocation chart
      await createAllocationChart();
      
      // Update performance chart with new data point
      await updateChart(currentRange);
      
      // Clear form
      document.getElementById('assetChange').value = '';
      
      alert(`${selectedAsset} updated successfully! New total: ${formatMoney(result.totalPortfolio)}`);
    } catch (error) {
      alert(`Error updating ${selectedAsset}: ${error.message}`);
    }
  });
});
