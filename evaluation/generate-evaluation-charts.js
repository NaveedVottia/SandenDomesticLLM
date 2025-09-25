/**
 * Generate SVG Charts from GENIAC Evaluation Metrics
 * Creates visual representations of evaluation scores
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const EVALUATION_DIR = './session-evaluations';

// Colors for charts
const COLORS = {
  toolCorrectness: '#FF6B6B',
  taskCompletion: '#4ECDC4',
  communication: '#45B7D1',
  safety: '#96CEB4',
  retrievalFit: '#FFEAA7',
  weightedScore: '#DDA0DD'
};

// Metric labels in Japanese
const METRIC_LABELS = {
  toolCorrectness: 'ツール正確性',
  taskCompletion: 'タスク完了度',
  communication: 'コミュニケーション',
  safety: '安全性',
  retrievalFit: '検索適合性',
  weightedScore: '総合スコア'
};

// Weights for visualization
const WEIGHTS = {
  toolCorrectness: 0.40,
  taskCompletion: 0.30,
  communication: 0.15,
  safety: 0.10,
  retrievalFit: 0.05
};

function generateBarChart(data, filename) {
  const width = 800;
  const height = 400;
  const margin = { top: 40, right: 40, bottom: 80, left: 80 };

  const metrics = Object.keys(data.averageScores);
  const values = Object.values(data.averageScores);

  const barWidth = (width - margin.left - margin.right) / metrics.length;
  const maxValue = 5;

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        .bar { fill-opacity: 0.8; stroke: #333; stroke-width: 1; }
        .bar:hover { fill-opacity: 1; }
        .axis { stroke: #333; stroke-width: 1; }
        .grid { stroke: #ddd; stroke-width: 0.5; }
        .label { font-family: Arial, sans-serif; font-size: 12px; text-anchor: middle; }
        .title { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-anchor: middle; }
        .value-label { font-family: Arial, sans-serif; font-size: 11px; text-anchor: middle; fill: #333; }
      </style>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="#f9f9f9"/>

    <!-- Title -->
    <text x="${width/2}" y="25" class="title">GENIAC 評価指標 - セッション ${data.sessionId.substring(-12)}</text>

    <!-- Y-axis -->
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="axis"/>
    <!-- Y-axis labels -->
    ${[0, 1, 2, 3, 4, 5].map(val => {
      const y = height - margin.bottom - (val / maxValue) * (height - margin.top - margin.bottom);
      return `<text x="${margin.left - 10}" y="${y + 5}" class="label">${val}</text>
              <line x1="${margin.left - 5}" y1="${y}" x2="${margin.left}" y2="${y}" class="grid"/>`;
    }).join('')}

    <!-- Bars -->
    ${metrics.map((metric, i) => {
      const x = margin.left + i * barWidth + 10;
      const barHeight = (data.averageScores[metric] / maxValue) * (height - margin.top - margin.bottom);
      const y = height - margin.bottom - barHeight;

      return `<rect x="${x}" y="${y}" width="${barWidth - 20}" height="${barHeight}"
             fill="${COLORS[metric]}" class="bar"/>
             <text x="${x + (barWidth - 20)/2}" y="${y - 5}" class="value-label">${data.averageScores[metric]}</text>`;
    }).join('')}

    <!-- X-axis labels -->
    ${metrics.map((metric, i) => {
      const x = margin.left + i * barWidth + barWidth/2;
      return `<text x="${x}" y="${height - margin.bottom + 20}" class="label" transform="rotate(-45 ${x} ${height - margin.bottom + 20})">${METRIC_LABELS[metric]}</text>`;
    }).join('')}

    <!-- Weighted Score -->
    <text x="${width - 100}" y="60" class="title" fill="${COLORS.weightedScore}">総合スコア: ${data.weightedSessionScore}/5.0</text>
  </svg>`;

  return svg;
}

function generateRadarChart(data, filename) {
  const width = 400;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 150;

  const metrics = Object.keys(data.averageScores);
  const angles = metrics.map((_, i) => (i * 2 * Math.PI) / metrics.length - Math.PI / 2);

  function polarToCartesian(angle, distance) {
    return {
      x: centerX + distance * Math.cos(angle),
      y: centerY + distance * Math.sin(angle)
    };
  }

  const points = angles.map((angle, i) => {
    const distance = (data.averageScores[metrics[i]] / 5) * radius;
    return polarToCartesian(angle, distance);
  });

  const pathData = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ') + ' Z';

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        .radar-line { fill: ${COLORS.toolCorrectness}; fill-opacity: 0.3; stroke: ${COLORS.toolCorrectness}; stroke-width: 2; }
        .radar-grid { stroke: #ddd; stroke-width: 1; fill: none; }
        .radar-axis { stroke: #999; stroke-width: 1; }
        .label { font-family: Arial, sans-serif; font-size: 11px; text-anchor: middle; }
        .title { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; text-anchor: middle; }
        .score-label { font-family: Arial, sans-serif; font-size: 12px; text-anchor: middle; fill: #333; }
      </style>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="#f9f9f9"/>

    <!-- Title -->
    <text x="${centerX}" y="25" class="title">レーダーチャート</text>

    <!-- Grid circles -->
    ${[1, 2, 3, 4, 5].map(level => {
      const r = (level / 5) * radius;
      return `<circle cx="${centerX}" cy="${centerY}" r="${r}" class="radar-grid"/>`;
    }).join('')}

    <!-- Axes -->
    ${angles.map(angle => {
      const end = polarToCartesian(angle, radius);
      return `<line x1="${centerX}" y1="${centerY}" x2="${end.x}" y2="${end.y}" class="radar-axis"/>`;
    }).join('')}

    <!-- Radar polygon -->
    <path d="${pathData}" class="radar-line"/>

    <!-- Data points -->
    ${points.map((point, i) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${COLORS[metrics[i]]}"/>`).join('')}

    <!-- Labels -->
    ${angles.map((angle, i) => {
      const labelPos = polarToCartesian(angle, radius + 25);
      const score = data.averageScores[metrics[i]];
      const scorePos = polarToCartesian(angle, (score / 5) * radius + 15);
      return `<text x="${labelPos.x}" y="${labelPos.y + 5}" class="label">${METRIC_LABELS[metrics[i]]}</text>
              <text x="${scorePos.x}" y="${scorePos.y - 5}" class="score-label">${score}</text>`;
    }).join('')}

    <!-- Center score -->
    <text x="${centerX}" y="${centerY + 5}" class="title" fill="${COLORS.weightedScore}">${data.weightedSessionScore}</text>
  </svg>`;

  return svg;
}

function generateWeightDistributionChart() {
  const width = 600;
  const height = 300;
  const margin = { top: 40, right: 40, bottom: 60, left: 80 };

  const metrics = Object.keys(WEIGHTS);
  const values = Object.values(WEIGHTS);

  const barWidth = (width - margin.left - margin.right) / metrics.length;

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        .bar { fill-opacity: 0.8; stroke: #333; stroke-width: 1; }
        .axis { stroke: #333; stroke-width: 1; }
        .grid { stroke: #ddd; stroke-width: 0.5; }
        .label { font-family: Arial, sans-serif; font-size: 12px; text-anchor: middle; }
        .title { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-anchor: middle; }
        .value-label { font-family: Arial, sans-serif; font-size: 11px; text-anchor: middle; fill: #333; }
      </style>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="#f9f9f9"/>

    <!-- Title -->
    <text x="${width/2}" y="25" class="title">GENIAC 評価重み分布</text>

    <!-- Y-axis -->
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="axis"/>
    <!-- Y-axis labels -->
    ${[0, 0.1, 0.2, 0.3, 0.4, 0.5].map(val => {
      const y = height - margin.bottom - (val / 0.5) * (height - margin.top - margin.bottom);
      return `<text x="${margin.left - 10}" y="${y + 5}" class="label">${(val * 100).toFixed(0)}%</text>
              <line x1="${margin.left - 5}" y1="${y}" x2="${margin.left}" y2="${y}" class="grid"/>`;
    }).join('')}

    <!-- Bars -->
    ${metrics.map((metric, i) => {
      const x = margin.left + i * barWidth + 10;
      const barHeight = (WEIGHTS[metric] / 0.5) * (height - margin.top - margin.bottom);
      const y = height - margin.bottom - barHeight;

      return `<rect x="${x}" y="${y}" width="${barWidth - 20}" height="${barHeight}"
             fill="${COLORS[metric]}" class="bar"/>
             <text x="${x + (barWidth - 20)/2}" y="${y - 5}" class="value-label">${(WEIGHTS[metric] * 100).toFixed(0)}%</text>`;
    }).join('')}

    <!-- X-axis labels -->
    ${metrics.map((metric, i) => {
      const x = margin.left + i * barWidth + barWidth/2;
      return `<text x="${x}" y="${height - margin.bottom + 20}" class="label" transform="rotate(-45 ${x} ${height - margin.bottom + 20})">${METRIC_LABELS[metric]}</text>`;
    }).join('')}

    <!-- GENIAC Formula -->
    <text x="${width - 200}" y="50" class="title" font-size="12">スコア = </text>
    <text x="${width - 200}" y="65" class="label" font-size="10">ツール×0.40 + タスク×0.30 + </text>
    <text x="${width - 200}" y="80" class="label" font-size="10">コミュ×0.15 + 安全×0.10 + 検索×0.05</text>
  </svg>`;

  return svg;
}

// Main execution
async function generateCharts() {
  console.log('🎨 Generating evaluation metric charts...\n');

  // Load all evaluation files
  const files = readdirSync(EVALUATION_DIR).filter(f => f.endsWith('.json'));
  const evaluations = [];

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(EVALUATION_DIR, file), 'utf8'));
    evaluations.push(data);
  }

  console.log(`📊 Found ${evaluations.length} evaluation sessions\n`);

  // Generate individual session charts
  for (const evalData of evaluations) {
    const sessionId = evalData.sessionId.substring(-12);

    // Bar chart
    const barChart = generateBarChart(evalData, `session-${sessionId}-bar.svg`);
    const fs = await import('fs');
    fs.writeFileSync(`evaluation-chart-bar-${sessionId}.svg`, barChart);
    console.log(`✅ Generated bar chart: evaluation-chart-bar-${sessionId}.svg`);

    // Radar chart
    const radarChart = generateRadarChart(evalData, `session-${sessionId}-radar.svg`);
    fs.writeFileSync(`evaluation-chart-radar-${sessionId}.svg`, radarChart);
    console.log(`✅ Generated radar chart: evaluation-chart-radar-${sessionId}.svg`);
  }

  // Generate weight distribution chart
  const weightChart = generateWeightDistributionChart();
  const fs = await import('fs');
  fs.writeFileSync('evaluation-weights-distribution.svg', weightChart);
  console.log(`✅ Generated weight distribution: evaluation-weights-distribution.svg`);

  // Generate summary comparison chart
  const summaryChart = generateSummaryComparisonChart(evaluations);
  fs.writeFileSync('evaluation-summary-comparison.svg', summaryChart);
  console.log(`✅ Generated summary comparison: evaluation-summary-comparison.svg`);

  console.log('\n🎯 All charts generated! Open the SVG files to view the evaluation metrics visualizations.');
}

function generateSummaryComparisonChart(evaluations) {
  const width = 800;
  const height = 500;
  const margin = { top: 60, right: 40, bottom: 100, left: 80 };

  const sessions = evaluations.map((e, i) => `Session ${i + 1}`);
  const metrics = ['toolCorrectness', 'taskCompletion', 'communication', 'safety', 'retrievalFit'];

  const barWidth = (width - margin.left - margin.right) / sessions.length / metrics.length;

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        .bar { stroke: #333; stroke-width: 0.5; }
        .axis { stroke: #333; stroke-width: 1; }
        .grid { stroke: #ddd; stroke-width: 0.5; }
        .label { font-family: Arial, sans-serif; font-size: 11px; text-anchor: middle; }
        .title { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-anchor: middle; }
        .legend { font-family: Arial, sans-serif; font-size: 10px; }
      </style>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="#f9f9f9"/>

    <!-- Title -->
    <text x="${width/2}" y="30" class="title">GENIAC 評価セッション比較</text>

    <!-- Y-axis -->
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="axis"/>
    <!-- Y-axis labels -->
    ${[0, 1, 2, 3, 4, 5].map(val => {
      const y = height - margin.bottom - (val / 5) * (height - margin.top - margin.bottom);
      return `<text x="${margin.left - 10}" y="${y + 5}" class="label">${val}</text>
              <line x1="${margin.left - 5}" y1="${y}" x2="${margin.left}" y2="${y}" class="grid"/>`;
    }).join('')}

    <!-- Bars -->
    ${sessions.map((session, sessionIndex) => {
      return metrics.map((metric, metricIndex) => {
        const x = margin.left + sessionIndex * (metrics.length * barWidth) + metricIndex * barWidth + 5;
        const value = evaluations[sessionIndex].averageScores[metric];
        const barHeight = (value / 5) * (height - margin.top - margin.bottom);
        const y = height - margin.bottom - barHeight;

        return `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barHeight}"
               fill="${COLORS[metric]}" class="bar"/>`;
      }).join('');
    }).join('')}

    <!-- X-axis labels -->
    ${sessions.map((session, i) => {
      const x = margin.left + i * (metrics.length * barWidth) + (metrics.length * barWidth) / 2;
      return `<text x="${x}" y="${height - margin.bottom + 20}" class="label">${session}</text>`;
    }).join('')}

    <!-- Legend -->
    <text x="${width - 150}" y="${margin.top + 20}" class="legend" font-weight="bold">指標凡例:</text>
    ${metrics.map((metric, i) => {
      const y = margin.top + 40 + i * 15;
      return `<rect x="${width - 140}" y="${y - 10}" width="12" height="12" fill="${COLORS[metric]}"/>
              <text x="${width - 120}" y="${y}" class="legend">${METRIC_LABELS[metric]}</text>`;
    }).join('')}

    <!-- Average Scores -->
    ${evaluations.map((evalData, i) => {
      const x = margin.left + i * (metrics.length * barWidth) + (metrics.length * barWidth) / 2;
      const y = margin.top - 10;
      return `<text x="${x}" y="${y}" class="label" font-weight="bold">${evalData.weightedSessionScore.toFixed(2)}</text>`;
    }).join('')}
  </svg>`;

  return svg;
}

// Run the chart generation
generateCharts().catch(console.error);
