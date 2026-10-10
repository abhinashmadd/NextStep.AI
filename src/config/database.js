const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { DATA_DIR, DATA_FILE, UPLOADS_DIR, MONGODB_URI, MONGODB_DB_NAME } = require("./environment");

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
    return mongoDb;
  } catch (err) {
    console.warn(`[Database] MongoDB connection error: ${err.message}. Using local file storage fallback.`);
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
        return { ...emptyState(), ...safeState };
      }
      // If MongoDB is connected but not yet initialized, seed from local data file if it exists
      try {
        const raw = await fs.readFile(DATA_FILE, "utf8");
        const parsed = JSON.parse(raw);
        const seeded = { ...emptyState(), ...parsed };
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
      console.warn(`[Database] Error reading from MongoDB: ${err.message}. Falling back to file.`);
    }
  }

  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
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
  // Always write local file as fast fallback & local cache
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = path.join(DATA_DIR, `nextstep-data.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), "utf8");
  try {
    await fs.rename(tempFile, DATA_FILE);
  } catch (error) {
    // Windows file lock / rename fallback
    await fs.copyFile(tempFile, DATA_FILE);
    await fs.unlink(tempFile).catch(() => {});
  }

  // Persist to MongoDB if attached
  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection("app_state").updateOne(
        { id: "current_state" },
        { $set: { ...state, updatedAt: new Date() } },
        { upsert: true }
      );
      // Synchronize users and profiles into structured collections for query capability
      if (Array.isArray(state.users) && state.users.length > 0) {
        for (const user of state.users) {
          await db.collection("users").updateOne(
            { id: user.id },
            { $set: { ...user, updatedAt: new Date() } },
            { upsert: true }
          );
        }
      }
      if (state.profile) {
        await db.collection("profiles").updateOne(
          { userId: state.currentUser?.id || "default" },
          { $set: { ...state.profile, updatedAt: new Date() } },
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
  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection("app_state").deleteMany({});
      await db.collection("users").deleteMany({});
      await db.collection("profiles").deleteMany({});
      await db.collection("evidence").deleteMany({});
    } catch (err) {
      console.warn(`[Database] Error clearing MongoDB collections: ${err.message}`);
    }
  }
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
};
