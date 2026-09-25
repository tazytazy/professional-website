// Chart.js Visualizations Controller

let chartVolume = null;
let chartMonthly = null;
let chartFlatTypes = null;
let chartPrice = null;

/**
 * Initialize / Update Analytics Dashboard Charts
 */
function renderCharts(data) {
  // 1. Chart 1: Top Towns by Volume (Bar Chart)
  const topTowns = (data.towns || []).slice(0, 10);
  const ctxVolume = document.getElementById('chart-town-volume').getContext('2d');
  
  if (chartVolume) chartVolume.destroy();
  chartVolume = new Chart(ctxVolume, {
    type: 'bar',
    data: {
      labels: topTowns.map(t => t.name),
      datasets: [{
        label: 'Rental Volume',
        data: topTowns.map(t => t.count),
        backgroundColor: '#f59e0b',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#334155' } }
      }
    }
  });

  // 2. Chart 2: 12-Month Rental Volume Trend (Line Chart)
  const trends = data.monthly_trends || [];
  const ctxMonthly = document.getElementById('chart-monthly-trend').getContext('2d');
  
  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctxMonthly, {
    type: 'line',
    data: {
      labels: trends.map(m => m.month),
      datasets: [{
        label: 'Approvals',
        data: trends.map(m => m.count),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#334155' } }
      }
    }
  });

  // 3. Chart 3: Flat Type Breakdown (Doughnut Chart)
  const flatTypes = data.flat_types || [];
  const ctxFlatTypes = document.getElementById('chart-flat-types').getContext('2d');
  
  if (chartFlatTypes) chartFlatTypes.destroy();
  chartFlatTypes = new Chart(ctxFlatTypes, {
    type: 'doughnut',
    data: {
      labels: flatTypes.map(f => f.flat_type),
      datasets: [{
        data: flatTypes.map(f => f.count),
        backgroundColor: ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        borderWidth: 2,
        borderColor: '#0f172a'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 11 } } }
      }
    }
  });

  // 4. Chart 4: Average Rent by Town (Horizontal Bar Chart)
  const topPrices = [...(data.towns || [])].sort((a, b) => b.avg_rent - a.avg_rent).slice(0, 10);
  const ctxPrice = document.getElementById('chart-town-price').getContext('2d');
  
  if (chartPrice) chartPrice.destroy();
  chartPrice = new Chart(ctxPrice, {
    type: 'bar',
    data: {
      labels: topPrices.map(t => t.name),
      datasets: [{
        label: 'Avg Monthly Rent ($)',
        data: topPrices.map(t => t.avg_rent),
        backgroundColor: '#a855f7',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}
