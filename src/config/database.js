const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { DATA_DIR, DATA_FILE, SHARDS_DIR, UPLOADS_DIR, MONGODB_URI, MONGODB_DB_NAME, SHARDING_ENABLED } = require("./environment");
const sharding = require("./sharding");

let MongoClient = null;
try {
  const mongodb = require("mongodb");
  MongoClient = mongodb.MongoClient;
} catch {
  MongoClient = null;
}

let mongoClient = null;
let mongoDb = null;
let isMongoConnecting = false;

async function getMongoDb() {
  if (!MONGODB_URI || !MongoClient) {
    return null;
  }
  if (mongoDb) {
    return mongoDb;
  }
  if (isMongoConnecting) {
    for (let i = 0; i < 25; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (mongoDb) return mongoDb;
    }
  }
  isMongoConnecting = true;
  try {
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGODB_DB_NAME);
    if (process.env.DEBUG === "true") {
      console.log(`[Database] Successfully connected to MongoDB: ${MONGODB_DB_NAME}`);
    }

    // Initialize MongoDB Sharding indexes and cluster commands
    if (SHARDING_ENABLED) {
      await sharding.setupMongoSharding(mongoDb, mongoClient);
    }

    return mongoDb;
  } catch (err) {
    console.warn(`[Database] MongoDB connection error: ${err.message}. Using local sharded file storage fallback.`);
    mongoClient = null;
    mongoDb = null;
    return null;
  } finally {
    isMongoConnecting = false;
  }
}

function emptyUserState() {
  return {
    privacy: {
      consent: null,
      externalAiProcessing: false,
      modelTraining: false,
      retention: "Stored locally on this device until you delete it.",
    },
    currentUser: null,
    profile: null,
    assessment: [],
    evidence: [],
    skillReport: null,
    recommendedAction: null,
    activity: [],
    changeLog: [],
  };
}

function emptyState() {
  return {
    privacy: {
      consent: null,
      externalAiProcessing: false,
      modelTraining: false,
      retention: "Stored locally on this device until you delete it.",
    },
    currentUser: null,
    users: [],
    sessions: {},
    userWorkspaces: {},
    profile: null,
    assessment: [],
    evidence: [],
    skillReport: null,
    recommendedAction: null,
    activity: [],
    changeLog: [],
  };
}

function sanitizeState(state) {
  if (!state) return state;
  return {
    ...state,
    users: (state.users || []).map(({ passwordHash, salt, ...safe }) => safe),
  };
}

async function readState() {
  const db = await getMongoDb();
  if (db) {
    try {
      const doc = await db.collection("app_state").findOne({ id: "current_state" });
      if (doc) {
        const { _id, ...safeState } = doc;
        const resState = { ...emptyState(), ...safeState };

        // Read users across sharded collections
        try {
          const mongoUsers = await db.collection("users").find({}).toArray();
          if (Array.isArray(mongoUsers) && mongoUsers.length > 0) {
            const userMap = new Map();
            (resState.users || []).forEach(u => userMap.set(u.id || u.email, u));
            mongoUsers.forEach(({ _id, ...u }) => userMap.set(u.id || u.email, u));
            resState.users = Array.from(userMap.values());
          }
        } catch {}

        // Read sharded user workspaces
        try {
          const shardedWsDocs = await db.collection("user_workspaces").find({}).toArray();
          if (Array.isArray(shardedWsDocs) && shardedWsDocs.length > 0) {
            resState.userWorkspaces = resState.userWorkspaces || {};
            for (const doc of shardedWsDocs) {
              if (doc.userId && doc.workspace) {
                resState.userWorkspaces[doc.userId] = doc.workspace;
              }
            }
          }
        } catch {}

        return resState;
      }

      // If MongoDB is connected but not yet initialized, seed from local sharded storage
      try {
        const seeded = await sharding.readShardedState();
        await db.collection("app_state").updateOne(
          { id: "current_state" },
          { $set: { ...seeded, updatedAt: new Date() } },
          { upsert: true }
        );
        return seeded;
      } catch {
        return emptyState();
      }
    } catch (err) {
      console.warn(`[Database] Error reading from MongoDB: ${err.message}. Falling back to sharded files.`);
    }
  }

  // File Storage Sharded Reader
  try {
    return await sharding.readShardedState();
  } catch (error) {
    if (error.code === "ENOENT") return emptyState();
    if (error instanceof SyntaxError) {
      console.warn("Corrupted JSON data encountered, falling back to empty state.");
      return emptyState();
    }
    throw error;
  }
}

async function writeState(state) {
  // 1. Write partitioned state across shards (and unified backup)
  await sharding.writeShardedState(state);

  // 2. Persist to MongoDB with sharded keys & partitions if connected
  const db = await getMongoDb();
  if (db) {
    try {
      await sharding.writeShardedStateToMongo(db, state);
      // Synchronize structured profiles
      if (state.profile) {
        await db.collection("profiles").updateOne(
          { userId: state.currentUser?.id || "default" },
          { $set: { ...state.profile, shardId: sharding.getShardId(state.currentUser?.id || "default"), updatedAt: new Date() } },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn(`[Database] Error writing to MongoDB: ${err.message}`);
    }
  }
}

function addActivity(state, message) {
  state.activity = state.activity || [];
  state.activity.unshift({ id: crypto.randomUUID(), message, createdAt: new Date().toISOString() });
  state.activity = state.activity.slice(0, 15);
}

async function deleteEvidenceFile(id) {
  try {
    await fs.unlink(path.join(UPLOADS_DIR, `${id}.upload`));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function deleteAllStoredData() {
  const state = await readState();
  if (state.evidence) {
    for (const evidence of state.evidence) {
      if (evidence.fileStored) await deleteEvidenceFile(evidence.id);
    }
  }

  // Clear MongoDB collections including sharded collections
  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection("app_state").deleteMany({});
      await db.collection("users").deleteMany({});
      await db.collection("profiles").deleteMany({});
      await db.collection("evidence").deleteMany({});
      await db.collection("user_workspaces").deleteMany({});
    } catch (err) {
      console.warn(`[Database] Error clearing MongoDB collections: ${err.message}`);
    }
  }

  // Clear sharded files
  try {
    const shardEntries = await fs.readdir(SHARDS_DIR);
    for (const entry of shardEntries) {
      if (entry.startsWith("shard_") && entry.endsWith(".json")) {
        await fs.unlink(path.join(SHARDS_DIR, entry)).catch(() => {});
      }
    }
  } catch {}

  try {
    await fs.unlink(DATA_FILE);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

module.exports = {
  getMongoDb,
  emptyUserState,
  emptyState,
  sanitizeState,
  readState,
  writeState,
  addActivity,
  deleteEvidenceFile,
  deleteAllStoredData,
  sharding,
  getShardId: sharding.getShardId,
  getShardIndex: sharding.getShardIndex,
  readUserWorkspace: sharding.readUserWorkspace,
  writeUserWorkspace: sharding.writeUserWorkspace,
  getShardingStats: sharding.getShardingStats,
};
