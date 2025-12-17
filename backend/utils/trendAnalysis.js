/**
 * Utility functions for sensor trend analysis
 */

/**
 * Calculate linear regression slope
 */
function calculateSlope(data, field) {
  const values = data.map((d, i) => ({ x: i, y: d[field] }));
  const n = values.length;
  
  if (n < 2) return 0;
  
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, v) => sum + v.y, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (values[i].x - xMean) * (values[i].y - yMean);
    denominator += Math.pow(values[i].x - xMean, 2);
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Determine trend direction
 */
function getTrendDirection(slope, threshold = 0.01) {
  if (slope > threshold) return 'increasing';
  if (slope < -threshold) return 'decreasing';
  return 'stable';
}

/**
 * Calculate percentage change
 */
function calculatePercentageChange(start, end) {
  if (start === 0) return 0;
  return ((end - start) / start * 100).toFixed(2);
}

/**
 * Detect outliers using IQR method
 */
function detectOutliers(data, field) {
  const values = data.map(d => d[field]).sort((a, b) => a - b);
  const n = values.length;
  
  if (n < 4) return [];
  
  const q1 = values[Math.floor(n * 0.25)];
  const q3 = values[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return data.filter(d => d[field] < lowerBound || d[field] > upperBound);
}

/**
 * Calculate moving average
 */
function calculateMovingAverage(data, field, window = 5) {
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const windowData = data.slice(start, i + 1);
    const avg = windowData.reduce((sum, d) => sum + d[field], 0) / windowData.length;
    result.push(avg);
  }
  
  return result;
}

/**
 * Predict next value using simple linear regression
 */
function predictNextValue(data, field, stepsAhead = 1) {
  const slope = calculateSlope(data, field);
  const lastValue = data[data.length - 1][field];
  
  return lastValue + (slope * stepsAhead);
}

/**
 * Get trend severity (how fast is the change)
 */
function getTrendSeverity(changeRate, thresholds = { low: 1, medium: 3, high: 5 }) {
  const absRate = Math.abs(changeRate);
  
  if (absRate < thresholds.low) return 'mild';
  if (absRate < thresholds.medium) return 'moderate';
  if (absRate < thresholds.high) return 'significant';
  return 'severe';
}

/**
 * Analyze moisture trend specifically
 */
function analyzeMoistureTrend(currentMoisture, trend, optimalRange = { min: 40, max: 70 }) {
  const analysis = {
    status: 'normal',
    urgency: 'none',
    recommendation: '',
    daysToAction: null
  };
  
  // Current status
  if (currentMoisture < optimalRange.min) {
    analysis.status = 'low';
    analysis.urgency = 'high';
  } else if (currentMoisture > optimalRange.max) {
    analysis.status = 'high';
    analysis.urgency = 'medium';
  }
  
  // Trend analysis
  if (trend && trend.direction === 'decreasing') {
    const rate = parseFloat(trend.ratePerDay) || 0;
    
    if (rate < 0) {
      // Calculate days until moisture reaches critical level (30%)
      const daysTo30 = (currentMoisture - 30) / Math.abs(rate);
      analysis.daysToAction = Math.ceil(daysTo30);
      
      if (daysTo30 < 1) {
        analysis.urgency = 'critical';
        analysis.recommendation = 'Water immediately';
      } else if (daysTo30 < 2) {
        analysis.urgency = 'high';
        analysis.recommendation = `Water within ${Math.ceil(daysTo30)} day(s)`;
      } else {
        analysis.urgency = 'medium';
        analysis.recommendation = `Monitor closely, water in ${Math.ceil(daysTo30)} days`;
      }
    }
  }
  
  return analysis;
}

/**
 * Analyze pH trend specifically
 */
function analyzePhTrend(currentPh, trend, optimalRange = { min: 6.0, max: 7.0 }) {
  const analysis = {
    status: 'normal',
    urgency: 'none',
    recommendation: '',
    issue: null
  };
  
  // Current status
  if (currentPh < optimalRange.min) {
    analysis.status = 'acidic';
    analysis.issue = 'soil_acidity';
    analysis.urgency = currentPh < 5.5 ? 'high' : 'medium';
    analysis.recommendation = 'Add lime to increase pH';
  } else if (currentPh > optimalRange.max) {
    analysis.status = 'alkaline';
    analysis.issue = 'soil_alkalinity';
    analysis.urgency = currentPh > 7.5 ? 'high' : 'medium';
    analysis.recommendation = 'Add sulfur or organic matter to decrease pH';
  }
  
  // Trend analysis
  if (trend && Math.abs(trend.change) > 0.3) {
    analysis.urgency = analysis.urgency === 'none' ? 'medium' : analysis.urgency;
    analysis.recommendation += ` (pH changing rapidly: ${trend.direction})`;
  }
  
  return analysis;
}

/**
 * Compare current values to historical averages
 */
function compareToAverages(current, averages) {
  const comparison = {};
  
  for (const key in current) {
    if (averages[`avg${key.charAt(0).toUpperCase() + key.slice(1)}`]) {
      const avgKey = `avg${key.charAt(0).toUpperCase() + key.slice(1)}`;
      const diff = current[key] - averages[avgKey];
      const percentDiff = ((diff / averages[avgKey]) * 100).toFixed(1);
      
      comparison[key] = {
        current: current[key],
        average: averages[avgKey].toFixed(1),
        difference: diff.toFixed(1),
        percentDifference: percentDiff,
        status: Math.abs(parseFloat(percentDiff)) > 10 ? 'abnormal' : 'normal'
      };
    }
  }
  
  return comparison;
}

module.exports = {
  calculateSlope,
  getTrendDirection,
  calculatePercentageChange,
  detectOutliers,
  calculateMovingAverage,
  predictNextValue,
  getTrendSeverity,
  analyzeMoistureTrend,
  analyzePhTrend,
  compareToAverages
};