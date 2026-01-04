import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaboard';
    
    await mongoose.connect(mongoUri);
  } catch (error) {
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {});
mongoose.connection.on('error', () => {});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

