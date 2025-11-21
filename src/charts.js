// src/charts.js
// Простые SVG графики для визуализации данных

// График XP по дням (последние 7 дней)
export function renderXpChart(eventLog) {
  const days = 7;
  const now = new Date();
  const xpByDay = {};
  
  // Инициализируем последние 7 дней
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    xpByDay[key] = 0;
  }
  
  // Собираем XP из событий
  eventLog.forEach(event => {
    if (event.type === "xp_gain") {
      const eventDate = event.timestamp.slice(0, 10);
      if (xpByDay.hasOwnProperty(eventDate)) {
        xpByDay[eventDate] += event.value;
      }
    }
  });
  
  const data = Object.values(xpByDay);
  const labels = Object.keys(xpByDay).map(d => d.slice(5)); // MM-DD
  const maxValue = Math.max(...data, 1);
  
  return createBarChart(data, labels, maxValue, "XP за последние 7 дней");
}

// График дохода по месяцам (последние 6 месяцев)
export function renderRevenueChart(eventLog) {
  const months = 6;
  const now = new Date();
  const revenueByMonth = {};
  
  // Инициализируем последние 6 месяцев
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = date.toISOString().slice(0, 7); // YYYY-MM
    revenueByMonth[key] = 0;
  }
  
  // Собираем доход из событий
  eventLog.forEach(event => {
    if (event.type === "xp_gain" && event.source === "revenue") {
      const eventMonth = event.timestamp.slice(0, 7);
      if (revenueByMonth.hasOwnProperty(eventMonth)) {
        // XP = revenue / 10, значит revenue = XP * 10
        revenueByMonth[eventMonth] += event.metadata?.originalAmount || 0;
      }
    }
  });
  
  const data = Object.values(revenueByMonth);
  const labels = Object.keys(revenueByMonth).map(m => {
    const [year, month] = m.split("-");
    return `${month}/${year.slice(2)}`; // MM/YY
  });
  const maxValue = Math.max(...data, 1);
  
  return createBarChart(data, labels, maxValue, "Доход по месяцам, $");
}

// Создание простого bar chart
function createBarChart(data, labels, maxValue, title) {
  const width = 400;
  const height = 200;
  const padding = { top: 30, right: 20, bottom: 40, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = chartWidth / data.length;
  
  let svg = `<svg width="${width}" height="${height}" class="chart">`;
  
  // Заголовок
  svg += `<text x="${width / 2}" y="15" text-anchor="middle" class="chart-title">${title}</text>`;
  
  // Оси
  svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#374151" stroke-width="2"/>`;
  svg += `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#374151" stroke-width="2"/>`;
  
  // Бары
  data.forEach((value, index) => {
    const barHeight = (value / maxValue) * chartHeight;
    const x = padding.left + index * barWidth + barWidth * 0.1;
    const y = height - padding.bottom - barHeight;
    const w = barWidth * 0.8;
    
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${barHeight}" fill="#22c55e" rx="2"/>`;
    svg += `<text x="${x + w / 2}" y="${y - 5}" text-anchor="middle" class="chart-value">${value}</text>`;
  });
  
  // Подписи оси X
  labels.forEach((label, index) => {
    const x = padding.left + index * barWidth + barWidth / 2;
    const y = height - padding.bottom + 20;
    svg += `<text x="${x}" y="${y}" text-anchor="middle" class="chart-label">${label}</text>`;
  });
  
  svg += `</svg>`;
  return svg;
}

// Прогресс-бар для квестов
export function renderProgressBar(current, total, width = 200) {
  const percentage = Math.min((current / total) * 100, 100);
  
  return `
    <div class="progress-bar" style="width: ${width}px">
      <div class="progress-fill" style="width: ${percentage}%"></div>
      <span class="progress-text">${current} / ${total}</span>
    </div>
  `;
}
