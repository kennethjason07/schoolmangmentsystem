import React from 'react';
import { Platform } from 'react-native';

// For mobile
let BarChartMobile = null;
if (Platform.OS !== 'web') {
  BarChartMobile = require('react-native-chart-kit').BarChart;
}

// For web
let BarChartWeb = null;
if (Platform.OS === 'web') {
  // Register required elements for Chart.js v3+
  const { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } = require('chart.js');
  Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);
  const { Bar } = require('react-chartjs-2');
  BarChartWeb = Bar;
}

function flattenStyle(style) {
  if (Array.isArray(style)) {
    return style.filter(Boolean).reduce((acc, item) => ({ ...acc, ...item }), {});
  }
  return style || {};
}

function filterWebStyle(style) {
  // Only allow valid CSS keys for web
  const allowed = ['width', 'height', 'background', 'backgroundColor', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderRadius', 'display', 'alignItems', 'justifyContent', 'alignSelf', 'textAlign'];
  const out = {};
  for (const key in style) {
    if (allowed.includes(key)) out[key] = style[key];
  }
  return out;
}

function isPercentOrMarksChart(data) {
  // Heuristic: if all values are <= 100 and at least one is >= 90, treat as percent/marks
  if (!data || !data.datasets || !data.datasets[0] || !data.datasets[0].data) return false;
  const arr = data.datasets[0].data;
  return arr.length > 0 && arr.every(v => v <= 100) && arr.some(v => v >= 90);
}

export default function CrossPlatformBarChart({ data, style, chartConfig, width, height, horizontal, ...props }) {
  // If percent/marks chart, ensure axis goes to 100
  let patchedData = data;
  if (isPercentOrMarksChart(data)) {
    const arr = data.datasets[0].data;
    if (!arr.includes(100)) {
      // For mobile, add a dummy 100 to force axis
      if (Platform.OS !== 'web') {
        patchedData = {
          ...data,
          datasets: [
            { ...data.datasets[0], data: [...arr, 100] }
          ]
        };
      }
    }
  }
  if (Platform.OS === 'web') {
    // Convert data to Chart.js format
    const chartData = {
      labels: patchedData.labels,
      datasets: [
        {
          label: '',
          data: patchedData.datasets[0].data,
          backgroundColor: chartConfig?.color ? chartConfig.color(1) : '#2196F3',
        },
      ],
    };
    const options = {
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true },
        y: { beginAtZero: true },
      },
    };
    // If percent/marks chart, set max to 100
    if (isPercentOrMarksChart(data)) {
      if (horizontal) {
        options.scales.x.max = 100;
      } else {
        options.scales.y.max = 100;
      }
    }
    // Flatten and filter style for web
    const webStyle = filterWebStyle(flattenStyle(style));
    webStyle.width = width || 400;
    webStyle.height = height || 220;
    return (
      <div style={webStyle}>
        <BarChartWeb data={chartData} options={options} />
      </div>
    );
  } else {
    // Mobile
    return (
      <BarChartMobile data={patchedData} style={style} chartConfig={chartConfig} width={width} height={height} horizontal={horizontal} {...props} />
    );
  }
} 