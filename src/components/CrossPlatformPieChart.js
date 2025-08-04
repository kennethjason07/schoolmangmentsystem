import React from 'react';
import { Platform } from 'react-native';

// For mobile
let PieChartMobile = null;
if (Platform.OS !== 'web') {
  PieChartMobile = require('react-native-chart-kit').PieChart;
}

// For web
let PieChartWeb = null;
if (Platform.OS === 'web') {
  // Register required elements for Chart.js v3+
  const { Chart, ArcElement, Tooltip, Legend } = require('chart.js');
  Chart.register(ArcElement, Tooltip, Legend);
  const { Pie } = require('react-chartjs-2');
  PieChartWeb = Pie;
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

export default function CrossPlatformPieChart({ data, style, chartConfig, width, height, ...props }) {
  if (Platform.OS === 'web') {
    // Convert data to Chart.js format
    const chartData = {
      labels: data.map(d => d.name),
      datasets: [
        {
          data: data.map(d => d.population),
          backgroundColor: data.map(d => d.color),
        },
      ],
    };
    const options = {
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false,
    };
    // Flatten and filter style for web
    const webStyle = filterWebStyle(flattenStyle(style));
    webStyle.width = width || 350;
    webStyle.height = height || 200;
    return (
      <div style={webStyle}>
        <PieChartWeb data={chartData} options={options} />
      </div>
    );
  } else {
    // Mobile
    return (
      <PieChartMobile data={data} style={style} chartConfig={chartConfig} width={width} height={height} {...props} />
    );
  }
} 