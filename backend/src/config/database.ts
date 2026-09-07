import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collaboard';

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
  } catch (error) {
    const err = error as Error;
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

export const isMongoReady = (): boolean => mongoose.connection.readyState === 1;

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB error:', error.message);
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});
