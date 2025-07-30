// script.js - Portfolio dashboard logic

const ranges = {
  '7d': { label: '7 Days', days: 7 },
  '1m': { label: '1 Month', days: 30 },
  '6m': { label: '6 Months', days: 180 }
};

// Generate a single 180-day portfolio history
let fullHistory = [];
let base = 10000 + Math.random() * 2000;
for (let i = 0; i < 180; i++) {
  base += (Math.random() - 0.4) * 40; // smaller daily change
  fullHistory.push(Math.round(base * 100) / 100);
}

function getLabels(days) {
  const today = new Date();
  let labels = [];
  if (days === 7) {
    // Show every day
    for (let i = days - 1; i >= 0; i--) {
      let d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  } else if (days === 30) {
    // Show 8 evenly spaced sample points
    let sampleCount = 8;
    for (let i = 0; i < sampleCount; i++) {
      let idx = Math.round(i * (days - 1) / (sampleCount - 1));
      let d = new Date(today);
      d.setDate(today.getDate() - (days - 1 - idx));
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  } else if (days === 180) {
    // Show 6 monthly sample points
    let sampleCount = 6;
    for (let i = 0; i < sampleCount; i++) {
      let d = new Date(today);
      d.setMonth(today.getMonth() - (sampleCount - 1 - i));
      d.setDate(today.getDate());
      labels.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    }
  }
  return labels;
}

function formatMoney(val) {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatGain(val, percent) {
  const sign = val >= 0 ? '+' : '-';
  return `${sign} ${formatMoney(Math.abs(val))} (${sign}${Math.abs(percent).toFixed(2)}%)`;
}

function updatePortfolio(rangeKey) {
  const days = ranges[rangeKey].days;
  let data, labels;
  if (days === 7) {
    data = fullHistory.slice(-days);
    labels = getLabels(days);
  } else if (days === 30) {
    // 8 sample points from last 30 days
    let sampleCount = 8;
    let raw = fullHistory.slice(-days);
    data = [];
    for (let i = 0; i < sampleCount; i++) {
      let idx = Math.round(i * (days - 1) / (sampleCount - 1));
      data.push(raw[idx]);
    }
    labels = getLabels(days);
  } else if (days === 180) {
    // 6 monthly sample points from last 180 days
    let sampleCount = 6;
    let raw = fullHistory.slice(-days);
    data = [];
    for (let i = 0; i < sampleCount; i++) {
      let idx = Math.round(i * (days - 1) / (sampleCount - 1));
      data.push(raw[idx]);
    }
    labels = getLabels(days);
  }
  const total = data[data.length - 1];
  const prev = data[0];
  const gain = total - prev; 
  const percent = (gain / prev) * 100; 

  document.getElementById('portfolioValue').textContent = `Total: ${formatMoney(total)}`;
  const gainElem = document.getElementById('portfolioGain');
  gainElem.textContent = formatGain(gain, percent);
  gainElem.className = 'portfolio-gain ' + (gain >= 0 ? 'positive' : 'negative');

  updateChart(labels, data);
}

let chart;
function updateChart(labels, data) {
  if (!chart) {
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Portfolio Value',
          data: data,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.08)',
          pointRadius: 3,
          pointBackgroundColor: '#2563eb',
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        animation: {
          // duration: 1500,
          // easing: 'easeOutQuart'
        },
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 20, family: 'consolas' }, color: '#222' }
          },
          y: {
            grid: { color: '#e5e7eb' }, beginAtZero: false,
            ticks: { font: { size: 20, family: 'consolas' }, color: '#222' }
          }
        }
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update({
      // duration: 900, /* 增加更新动画持续时间 */
      // easing: 'easeOutQuart'
    });
  }
}

// Pie chart asset allocation data (randomized for demo)
function getRandomAllocation() {
  let total = 10000 + Math.floor(Math.random() * 5000);
  let cash = Math.floor(Math.random() * total * 0.4);
  let stock = Math.floor(Math.random() * (total - cash) * 0.6);
  let bond = Math.floor(Math.random() * (total - cash - stock) * 0.7);
  let other = total - cash - stock - bond;
  return {
    labels: ['Cash', 'Stock', 'Bond', 'Other'],
    values: [cash, stock, bond, other],
    colors: ['#db0011', '#222', '#e5e7eb', '#f3f4f6']
  };
}

let allocationChart;
let allocationDataCache = null;

function showAllocationSection() {
  document.getElementById('portfolioChart').style.display = 'none';
  document.getElementById('allocationSection').style.display = 'block';
  document.querySelector('.range-toggle').style.visibility = 'hidden';
  document.getElementById('portfolioGain').style.visibility = 'hidden';
  // Only generate allocation data once per page load
  if (!allocationDataCache) {
    allocationDataCache = getRandomAllocation();
  }
  const allocationData = allocationDataCache;
  if (!allocationChart) {
    const ctx = document.getElementById('allocationChart').getContext('2d');
    allocationChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: allocationData.labels,
        datasets: [{
          data: allocationData.values,
          backgroundColor: allocationData.colors,
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font: { family: 'Montserrat, Roboto, Arial, sans-serif', size: 16, weight: '600' },
              color: '#222'
            }
          }
        }
      }
    });
  } else {
    allocationChart.data.datasets[0].data = allocationData.values;
    allocationChart.update();
  }
}

function showPerformanceSection() {
  document.getElementById('portfolioChart').style.display = 'block';
  document.getElementById('allocationSection').style.display = 'none';
  document.querySelector('.range-toggle').style.visibility = 'visible';
  document.getElementById('portfolioGain').style.visibility = 'visible';
}

// Handle allocation update
if (!window.allocationFormHandlerAdded) {
  window.allocationFormHandlerAdded = true;
  document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('allocationForm');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        const type = form.assetType.value;
        const change = parseFloat(document.getElementById('assetChange').value);
        if (isNaN(change) || change === 0) return;
        // Update allocation cache
        const idx = allocationDataCache.labels.indexOf(type);
        allocationDataCache.values[idx] += change;
        // Update total
        const newTotal = allocationDataCache.values.reduce((a,b)=>a+b,0);
        document.getElementById('portfolioValue').textContent = `Total: ${formatMoney(newTotal)}`;
        // Update pie chart
        allocationChart.data.datasets[0].data = allocationDataCache.values;
        allocationChart.update();
        // Update performance last data point
        fullHistory[fullHistory.length-1] = newTotal;
        updatePortfolio(document.querySelector('.toggle-btn.active').dataset.range);
        document.getElementById('assetChange').value = '';
      });
    }
  });
}

// Navigation logic
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    updatePortfolio(this.dataset.range);
  });
});

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    if (this.classList.contains('nav-performance')) {
      showPerformanceSection();
    } else if (this.classList.contains('nav-allocation')) {
      showAllocationSection();
    }
  });
});

// Initial load
showPerformanceSection();
updatePortfolio('7d');
