#!/usr/bin/env node
/**
 * NextStep Database Sharding Initialization Script
 * Configures MongoDB Sharded Cluster for horizontal scaling.
 * 
 * Usage:
 *   MONGODB_URI="mongodb://mongos-router:27017" node scripts/init-mongo-sharding.js
 */

const { MongoClient } = require("mongodb");
const { MONGODB_URI, MONGODB_DB_NAME } = require("../src/config/environment");

async function main() {
  const uri = process.env.MONGODB_URI || MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || MONGODB_DB_NAME;

  if (!uri) {
    console.error("Error: MONGODB_URI is not set. Please specify a connection string to your MongoDB cluster router (mongos).");
    process.exit(1);
  }

  console.log(`Connecting to MongoDB cluster: ${uri}`);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected successfully to MongoDB.");

    const admin = client.db("admin");
    const db = client.db(dbName);

    // 1. Enable sharding on database
    console.log(`Enabling sharding on database: '${dbName}'...`);
    try {
      await admin.command({ enableSharding: dbName });
      console.log(`✓ Sharding enabled on database '${dbName}'.`);
    } catch (err) {
      if (err.message.includes("already enabled")) {
        console.log(`✓ Database '${dbName}' is already sharded.`);
      } else {
        console.warn(`! Note on enableSharding: ${err.message}`);
      }
    }

    // 2. Collections to shard and their shard keys
    const collectionsToShard = [
      { name: "user_workspaces", key: { userId: "hashed" }, unique: false },
      { name: "users", key: { id: "hashed" }, unique: false },
      { name: "evidence", key: { userId: "hashed" }, unique: false },
      { name: "profiles", key: { userId: "hashed" }, unique: false },
      { name: "activities", key: { userId: "hashed" }, unique: false }
    ];

    for (const col of collectionsToShard) {
      console.log(`Creating hashed shard index on '${dbName}.${col.name}'...`);
      await db.collection(col.name).createIndex(col.key);

      console.log(`Sharding collection '${dbName}.${col.name}' with key ${JSON.stringify(col.key)}...`);
      try {
        await admin.command({
          shardCollection: `${dbName}.${col.name}`,
          key: col.key,
          unique: col.unique,
        });
        console.log(`✓ Collection '${col.name}' sharded successfully.`);
      } catch (err) {
        if (err.message.includes("already sharded")) {
          console.log(`✓ Collection '${col.name}' is already sharded.`);
        } else {
          console.warn(`! Note on sharding '${col.name}': ${err.message}`);
        }
      }
    }

    console.log("\n==========================================");
    console.log(" NextStep Database Sharding Setup Complete");
    console.log("==========================================");
  } catch (error) {
    console.error("Failed to configure MongoDB sharding:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
