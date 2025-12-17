const cron = require('node-cron');
const { SensorHistory, HourlyData, DailySummary } = require('../models/SensorHistory');

// Run every hour at :05 minutes (e.g., 10:05, 11:05, 12:05)
// Aggregates the previous hour's data
const scheduleHourlyAggregation = () => {
  cron.schedule('5 * * * *', async () => {
    try {
      console.log('⏰ Running hourly aggregation...');
      
      const userId = 'farmer_001'; // Default user
      const result = await SensorHistory.aggregateLastHour(userId);
      
      if (result) {
        console.log(`✅ Hourly data aggregated: ${result.hour}`);
      } else {
        console.log('ℹ️  No data to aggregate for last hour');
      }
    } catch (error) {
      console.error('❌ Hourly aggregation error:', error);
    }
  });
  
  console.log('📅 Hourly aggregation scheduled (runs at :05 of every hour)');
};

// Run daily at 00:30 AM
// Generates summary for the previous day
const scheduleDailyAggregation = () => {
  cron.schedule('30 0 * * *', async () => {
    try {
      console.log('⏰ Running daily summary generation...');
      
      const userId = 'farmer_001';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const result = await SensorHistory.generateDailySummary(userId, yesterday);
      
      if (result) {
        console.log(`✅ Daily summary created for: ${result.date.toDateString()}`);
      } else {
        console.log('ℹ️  No hourly data available for daily summary');
      }
    } catch (error) {
      console.error('❌ Daily summary error:', error);
    }
  });
  
  console.log('📅 Daily summary scheduled (runs at 00:30 AM)');
};

// Initialize all schedulers
const initializeSchedulers = () => {
  scheduleHourlyAggregation();
  scheduleDailyAggregation();
  
  console.log('✅ All data aggregation schedulers initialized\n');
};

module.exports = initializeSchedulers;