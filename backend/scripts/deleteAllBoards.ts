

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import mongoose from 'mongoose';
import { Board } from '../src/models/Board.js';
import { BoardElement } from '../src/models/BoardElement.js';
import { BoardCollaborator } from '../src/models/BoardCollaborator.js';
import { User } from '../src/models/User.js';

// Get current directory (ES modules compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');
const isForce = args.includes('--force') || args.includes('-f');

interface DatabaseStats {
  boards: number;
  elements: number;
  collaborators: number;
  users: number;
}

/**
 * Check if environment is production
 */
const isProduction = (): boolean => {
  const env = process.env.NODE_ENV?.toLowerCase();
  const mongoUri = process.env.MONGODB_URI || '';
  return (
    env === 'production' ||
    env === 'prod' ||
    mongoUri.includes('mongodb.net') || // MongoDB Atlas
    mongoUri.includes('production') ||
    mongoUri.includes('prod')
  );
};

/**
 * Get confirmation from user via readline
 */
const getConfirmation = (question: string): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'yes' || normalized === 'y');
    });
  });
};

/**
 * Get database statistics
 */
const getDatabaseStats = async (): Promise<DatabaseStats> => {
  try {
    const [boards, elements, collaborators, users] = await Promise.all([
      Board.countDocuments(),
      BoardElement.countDocuments(),
      BoardCollaborator.countDocuments(),
      User.countDocuments(),
    ]);

    return { boards, elements, collaborators, users };
  } catch (error) {
    console.error('[ERROR] Failed to get database statistics:', error);
    throw error;
  }
};

/**
 * Display database statistics
 */
const displayStats = (stats: DatabaseStats, label: string): void => {
  console.log(`\n${label}:`);
  console.log(`   Boards: ${stats.boards.toLocaleString()}`);
  console.log(`   Elements: ${stats.elements.toLocaleString()}`);
  console.log(`   Collaborators: ${stats.collaborators.toLocaleString()}`);
  console.log(`   Users: ${stats.users.toLocaleString()}`);
};

/**
 * Validate environment before proceeding
 */
const validateEnvironment = (): void => {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('[ERROR] MONGODB_URI environment variable is not set');
    console.error('   Please set MONGODB_URI in your .env file');
    process.exit(1);
  }

  if (isProduction() && !isDryRun) {
    console.warn('[WARNING] This appears to be a PRODUCTION environment!');
    console.warn(`   MongoDB URI: ${mongoUri.replace(/:[^:@]+@/, ':****@')}`);
    console.warn('   Proceeding with extra caution...\n');
  }
};

/**
 * Delete all data from database
 */
const deleteAllData = async (): Promise<{ boards: number; elements: number; collaborators: number }> => {
  try {
    // Use transactions if supported (MongoDB 4.0+)
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const [deletedBoards, deletedElements, deletedCollaborators] = await Promise.all([
        Board.deleteMany({}).session(session),
        BoardElement.deleteMany({}).session(session),
        BoardCollaborator.deleteMany({}).session(session),
      ]);

      await session.commitTransaction();
      
      return {
        boards: deletedBoards.deletedCount,
        elements: deletedElements.deletedCount,
        collaborators: deletedCollaborators.deletedCount,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    // If transactions are not supported, fall back to regular deletion
    if (error instanceof Error && error.message.includes('transaction')) {
      console.warn('[WARNING] Transactions not supported, proceeding without transaction support');
      
      const [deletedBoards, deletedElements, deletedCollaborators] = await Promise.all([
        Board.deleteMany({}),
        BoardElement.deleteMany({}),
        BoardCollaborator.deleteMany({}),
      ]);

      return {
        boards: deletedBoards.deletedCount,
        elements: deletedElements.deletedCount,
        collaborators: deletedCollaborators.deletedCount,
      };
    }
    throw error;
  }
};

/**
 * Main function
 */
const deleteAllBoards = async (): Promise<void> => {
  let mongooseConnection: typeof mongoose | null = null;

  try {
    // Validate environment
    validateEnvironment();

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaboard';
    console.log('Connecting to MongoDB...');
    console.log(`   Database: ${mongoUri.split('/').pop()?.split('?')[0] || 'unknown'}`);
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    mongooseConnection = mongoose;
    console.log('[SUCCESS] Connected to MongoDB');

    // Get initial statistics
    const initialStats = await getDatabaseStats();
    displayStats(initialStats, 'Current database state');

    // Check if database is already empty
    if (initialStats.boards === 0 && initialStats.elements === 0 && initialStats.collaborators === 0) {
      console.log('\n[INFO] Database is already empty. Nothing to delete.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Dry-run mode
    if (isDryRun) {
      console.log('\n[DRY-RUN] Preview mode - no data will be deleted');
      console.log('   This script would delete:');
      console.log(`   - ${initialStats.boards.toLocaleString()} boards`);
      console.log(`   - ${initialStats.elements.toLocaleString()} elements`);
      console.log(`   - ${initialStats.collaborators.toLocaleString()} collaborators`);
      console.log(`   (Users will NOT be deleted: ${initialStats.users.toLocaleString()} users remain)`);
      console.log('\n[DRY-RUN] To actually delete, run without --dry-run flag');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Safety confirmation
    if (!isForce) {
      console.log('\n[WARNING] This will PERMANENTLY delete ALL:');
      console.log(`   - ${initialStats.boards.toLocaleString()} boards`);
      console.log(`   - ${initialStats.elements.toLocaleString()} elements`);
      console.log(`   - ${initialStats.collaborators.toLocaleString()} collaborators`);
      console.log(`   (Users will NOT be deleted: ${initialStats.users.toLocaleString()} users remain)`);
      console.log('\n   This action CANNOT be undone!');
      
      if (isProduction()) {
        console.log('\n[CRITICAL] You are about to delete data from PRODUCTION!');
        const confirm1 = await getConfirmation('Type "yes" to confirm: ');
        if (!confirm1) {
          console.log('\n[CANCELLED] Deletion aborted by user');
          await mongoose.connection.close();
          process.exit(0);
        }
        
        const confirm2 = await getConfirmation('Are you absolutely sure? Type "yes" again: ');
        if (!confirm2) {
          console.log('\n[CANCELLED] Deletion aborted by user');
          await mongoose.connection.close();
          process.exit(0);
        }
      } else {
        const confirm = await getConfirmation('\nType "yes" to proceed with deletion: ');
        if (!confirm) {
          console.log('\n[CANCELLED] Deletion aborted by user');
          await mongoose.connection.close();
          process.exit(0);
        }
      }
    } else {
      console.warn('\n[WARNING] --force flag detected. Skipping confirmation prompt.');
    }

    // Perform deletion
    console.log('\n[INFO] Starting deletion process...');
    const startTime = Date.now();
    
    const deletionResults = await deleteAllData();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n[SUCCESS] Deletion complete!');
    console.log(`   Deleted ${deletionResults.boards.toLocaleString()} boards`);
    console.log(`   Deleted ${deletionResults.elements.toLocaleString()} elements`);
    console.log(`   Deleted ${deletionResults.collaborators.toLocaleString()} collaborators`);
    console.log(`   Duration: ${duration}s`);

    // Verify deletion
    const finalStats = await getDatabaseStats();
    displayStats(finalStats, 'Database state after deletion');

    // Final verification
    if (finalStats.boards === 0 && finalStats.elements === 0 && finalStats.collaborators === 0) {
      console.log('\n[SUCCESS] Verification passed - all data deleted successfully');
    } else {
      console.warn('\n[WARNING] Some data may still remain. Please verify manually.');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\n[SUCCESS] Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('\n[ERROR] Fatal error during deletion:');
    
    if (error instanceof Error) {
      console.error(`   ${error.name}: ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('   Unknown error:', error);
    }

    // Ensure cleanup
    if (mongooseConnection) {
      try {
        await mongooseConnection.connection.close();
      } catch (closeError) {
        console.error('[ERROR] Failed to close MongoDB connection:', closeError);
      }
    }

    console.error('\n[ERROR] Script terminated with errors');
    process.exit(1);
  }
};

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n[INFO] Received SIGINT. Gracefully shutting down...');
  try {
    await mongoose.connection.close();
  } catch (error) {
    // Ignore errors during shutdown
  }
  process.exit(130); // Exit code 130 for SIGINT
});

process.on('SIGTERM', async () => {
  console.log('\n\n[INFO] Received SIGTERM. Gracefully shutting down...');
  try {
    await mongoose.connection.close();
  } catch (error) {
    // Ignore errors during shutdown
  }
  process.exit(143); // Exit code 143 for SIGTERM
});

// Run the script
deleteAllBoards();




