import mongoose from 'mongoose';

export type ClusterPing = {
  uri: string;
  connect: (uri: string) => Promise<void>;
  ping: () => Promise<{ ok?: number }>;
  disconnect: () => Promise<void>;
};

export async function keepClusterAwake(client: ClusterPing): Promise<void> {
  if (!client.uri.trim()) {
    throw new Error('MONGODB_URI is not set');
  }

  await client.connect(client.uri);
  try {
    const result = await client.ping();
    if (result.ok !== 1) {
      throw new Error('MongoDB ping did not succeed');
    }
  } finally {
    await client.disconnect();
  }
}

export function mongoClusterClient(uri = process.env.MONGODB_URI ?? ''): ClusterPing {
  return {
    uri,
    connect: async (value) => {
      await mongoose.connect(value, { serverSelectionTimeoutMS: 8000 });
    },
    ping: async () => {
      const db = mongoose.connection.db;
      if (!db) throw new Error('MongoDB is not connected');
      return db.admin().command({ ping: 1 });
    },
    disconnect: async () => {
      await mongoose.disconnect();
    },
  };
}
