#!/usr/bin/env node
/*
  Run this script once (or during deployment) to create necessary indexes
  in your Cosmos DB (Mongo API) so queries that use ORDER BY / sort succeed.

  Usage (PowerShell):
    cd server
    node scripts/create_indexes.js

  The script uses the same `.env` used by the app to find the connection string.
*/
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/user.model.js';
import Listing from '../src/models/listing.model.js';

dotenv.config({ path: './.env' });

const run = async () => {
  try {
    const MONGO_URI = process.env.ISPROD === 'true' ? process.env.MONGO_URI_PROD : process.env.MONGO_URI;
    const DB_NAME = process.env.DB_NAME;
    if (!MONGO_URI || !DB_NAME) {
      throw new Error('MONGO_URI or DB_NAME not set in .env');
    }

    const conn = await mongoose.connect(`${MONGO_URI}/${DB_NAME}`);
    console.log('Connected to MongoDB:', conn.connection.host);

    const db = mongoose.connection.db;

    // Users: index createdAt for ORDER BY createdAt
    console.log('Creating index on users.createdAt');
    await db.collection('users').createIndex({ createdAt: -1 });

    // Listings: indexes used by the app
    console.log('Creating indexes on listings');
    await db.collection('listings').createIndex({ createdAt: -1 });
    await db.collection('listings').createIndex({ averageRating: -1, createdAt: -1 });
    await db.collection('listings').createIndex({ likesCount: -1, createdAt: -1 });
    // 2dsphere for location
    try {
      await db.collection('listings').createIndex({ location: '2dsphere' });
    } catch (err) {
      console.warn('Could not create 2dsphere index (maybe collection empty or API restrictions):', err.message);
    }
    await db.collection('listings').createIndex({ categories: 1 });
    await db.collection('listings').createIndex({ tags: 1 });

    console.log('Indexes created successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to create indexes:', err);
    process.exit(1);
  }
};

run();
