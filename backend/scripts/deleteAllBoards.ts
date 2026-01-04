// Script to delete all boards from the database
// Usage: npx tsx scripts/deleteAllBoards.ts

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Board } from '../src/models/Board.js';
import { BoardElement } from '../src/models/BoardElement.js';
import { BoardCollaborator } from '../src/models/BoardCollaborator.js';

// Get current directory (ES modules compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const deleteAllBoards = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaboard';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Count existing boards
    const boardCount = await Board.countDocuments();
    const elementCount = await BoardElement.countDocuments();
    const collaboratorCount = await BoardCollaborator.countDocuments();

    console.log('\n📊 Current database state:');
    console.log(`   Boards: ${boardCount}`);
    console.log(`   Elements: ${elementCount}`);
    console.log(`   Collaborators: ${collaboratorCount}`);

    if (boardCount === 0) {
      console.log('\n✅ No boards to delete. Database is already empty.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will delete ALL boards, elements, and collaborators!');
    console.log('   This action cannot be undone.\n');

    // In a real script, you might want to add a confirmation prompt here
    // For now, we'll proceed with deletion

    console.log('Deleting all boards, elements, and collaborators...');

    // Delete all boards, elements, and collaborators in parallel
    const [deletedBoards, deletedElements, deletedCollaborators] = await Promise.all([
      Board.deleteMany({}),
      BoardElement.deleteMany({}),
      BoardCollaborator.deleteMany({}),
    ]);

    console.log('\n✅ Deletion complete!');
    console.log(`   Deleted ${deletedBoards.deletedCount} boards`);
    console.log(`   Deleted ${deletedElements.deletedCount} elements`);
    console.log(`   Deleted ${deletedCollaborators.deletedCount} collaborators`);

    // Verify deletion
    const remainingBoards = await Board.countDocuments();
    const remainingElements = await BoardElement.countDocuments();
    const remainingCollaborators = await BoardCollaborator.countDocuments();

    console.log('\n📊 Database state after deletion:');
    console.log(`   Boards: ${remainingBoards}`);
    console.log(`   Elements: ${remainingElements}`);
    console.log(`   Collaborators: ${remainingCollaborators}`);

    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error deleting boards:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
deleteAllBoards();




