const mongoose = require('mongoose');

const connectDB = async () => {
  const maxRetries = 5;
  let retries = 0;

  const connect = async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        retryWrites: true,
        w: 'majority',
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
        maxPoolSize: 10,
        minPoolSize: 5
      });

      console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
      
      // Connection event handlers
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected - attempting to reconnect...');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected');
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🔌 Closing MongoDB connection...');
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed through app termination');
        process.exit(0);
      });

      retries = 0; // Reset retries on successful connection
    } catch (error) {
      retries++;
      console.error(`❌ MongoDB connection failed (Attempt ${retries}/${maxRetries}):`, error.message);
      
      if (retries < maxRetries) {
        const delay = Math.pow(2, retries) * 1000; // Exponential backoff
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        setTimeout(connect, delay);
      } else {
        console.error('❌ Max retries reached. Exiting...');
        process.exit(1);
      }
    }
  };

  await connect();
};

module.exports = connectDB;