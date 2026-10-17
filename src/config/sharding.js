const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { DATA_DIR, DATA_FILE, SHARDS_DIR, SHARDS_COUNT, SHARDING_ENABLED, MONGODB_DB_NAME } = require("./environment");

/**
 * Deterministic Shard Hashing
 * Hashes an arbitrary entity key (e.g. userId, email, id) to a 32-bit unsigned int
 * and maps it uniformly to [0 ... shardCount - 1].
 */
function hashKey(key) {
  if (!key) return 0;
  const hash = crypto.createHash("md5").update(String(key).trim().toLowerCase()).digest();
  return hash.readUInt32BE(0);
}

function getShardIndex(key, count = SHARDS_COUNT) {
  if (count <= 1) return 0;
  return hashKey(key) % count;
}

function getShardId(key, count = SHARDS_COUNT) {
  return `shard_${getShardIndex(key, count)}`;
}

function emptyShard(shardIndex) {
  return {
    shardId: `shard_${shardIndex}`,
    shardIndex,
    users: [],
    sessions: {},
    userWorkspaces: {},
    updatedAt: new Date().toISOString(),
  };
}

let isShardsInitialized = false;

/**
 * Initialize shard files and auto-migrate legacy monolithic data if necessary.
 */
async function initShards(count = SHARDS_COUNT) {
  if (isShardsInitialized) return;
  await fs.mkdir(SHARDS_DIR, { recursive: true });

  const metaPath = path.join(SHARDS_DIR, "metadata.json");
  let hasMeta = false;
  try {
    await fs.access(metaPath);
    hasMeta = true;
  } catch {
    hasMeta = false;
  }

  // Create metadata if not exists
  if (!hasMeta) {
    const meta = {
      version: 1,
      strategy: "consistent-hash",
      shardCount: count,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  }

  // Ensure every shard file exists
  for (let i = 0; i < count; i++) {
    const shardFile = path.join(SHARDS_DIR, `shard_${i}.json`);
    try {
      await fs.access(shardFile);
    } catch {
      await fs.writeFile(shardFile, JSON.stringify(emptyShard(i), null, 2), "utf8");
    }
  }

  // Check if we need to auto-migrate legacy data from nextstep-data.json
  try {
    const legacyRaw = await fs.readFile(DATA_FILE, "utf8");
    const legacy = JSON.parse(legacyRaw);

    // Check if shards are empty but legacy has users/workspaces
    const shard0Raw = await fs.readFile(path.join(SHARDS_DIR, "shard_0.json"), "utf8");
    const shard0 = JSON.parse(shard0Raw);
    const shardsEmpty = !shard0.users?.length && Object.keys(shard0.userWorkspaces || {}).length === 0;

    if (shardsEmpty && (legacy.users?.length || Object.keys(legacy.userWorkspaces || {}).length > 0)) {
      if (process.env.DEBUG === "true") {
        console.log(`[Sharding] Migrating legacy monolithic data into ${count} database shards...`);
      }
      await migrateToShards(legacy, count);
    }
  } catch {
    // No legacy file to migrate
  }

  isShardsInitialized = true;
}

/**
 * Migrate a monolithic state into partitioned shards.
 */
async function migrateToShards(monolithicState, count = SHARDS_COUNT) {
  const shards = Array.from({ length: count }, (_, i) => emptyShard(i));

  // Partition users
  if (Array.isArray(monolithicState.users)) {
    for (const user of monolithicState.users) {
      const idx = getShardIndex(user.id || user.email, count);
      shards[idx].users.push(user);
    }
  }

  // Partition userWorkspaces
  if (monolithicState.userWorkspaces) {
    for (const [userId, workspace] of Object.entries(monolithicState.userWorkspaces)) {
      const idx = getShardIndex(userId, count);
      shards[idx].userWorkspaces[userId] = workspace;
    }
  }

  // Partition sessions
  if (monolithicState.sessions) {
    for (const [token, session] of Object.entries(monolithicState.sessions)) {
      const key = session.userId || token;
      const idx = getShardIndex(key, count);
      shards[idx].sessions[token] = session;
    }
  }

  // Write all shards
  for (let i = 0; i < count; i++) {
    await writeShard(i, shards[i]);
  }

  if (process.env.DEBUG === "true") {
    console.log(`[Sharding] Migration complete: successfully distributed data across ${count} shards.`);
  }
}

/**
 * Read a single shard file by index
 */
async function readShard(shardIndex) {
  await initShards();
  const shardPath = path.join(SHARDS_DIR, `shard_${shardIndex}.json`);
  try {
    const raw = await fs.readFile(shardPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      const fresh = emptyShard(shardIndex);
      await writeShard(shardIndex, fresh);
      return fresh;
    }
    throw err;
  }
}

/**
 * Write a single shard file atomically
 */
async function writeShard(shardIndex, shardData) {
  await fs.mkdir(SHARDS_DIR, { recursive: true });
  const shardPath = path.join(SHARDS_DIR, `shard_${shardIndex}.json`);
  const tempPath = path.join(SHARDS_DIR, `shard_${shardIndex}.${Date.now()}.${crypto.randomBytes(3).toString("hex")}.tmp`);

  shardData.updatedAt = new Date().toISOString();
  await fs.writeFile(tempPath, JSON.stringify(shardData, null, 2), "utf8");

  try {
    await fs.rename(tempPath, shardPath);
  } catch {
    await fs.copyFile(tempPath, shardPath);
    await fs.unlink(tempPath).catch(() => {});
  }
}

/**
 * Read a specific user workspace directly from its shard (O(1) shard routing)
 */
async function readUserWorkspace(userId, count = SHARDS_COUNT) {
  const shardIdx = getShardIndex(userId, count);
  const shard = await readShard(shardIdx);
  return shard.userWorkspaces?.[userId] || null;
}

/**
 * Write a specific user workspace directly to its shard (targeted partition write)
 */
async function writeUserWorkspace(userId, workspace, count = SHARDS_COUNT) {
  const shardIdx = getShardIndex(userId, count);
  const shard = await readShard(shardIdx);
  shard.userWorkspaces = shard.userWorkspaces || {};
  shard.userWorkspaces[userId] = workspace;
  await writeShard(shardIdx, shard);
}

/**
 * Read and aggregate all shards into a unified state object.
 * Fully backwards-compatible with monolithic state consumers.
 */
async function readShardedState(count = SHARDS_COUNT) {
  await initShards(count);

  // Read all shards concurrently
  const shardPromises = [];
  for (let i = 0; i < count; i++) {
    shardPromises.push(readShard(i));
  }
  const shards = await Promise.all(shardPromises);

  // Read global/shared state from nextstep-data.json if exists
  let globalBase = {};
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    globalBase = JSON.parse(raw);
  } catch {
    globalBase = {};
  }

  const aggregated = {
    ...globalBase,
    users: [],
    sessions: {},
    userWorkspaces: {},
    _sharded: true,
    _shardCount: count,
  };

  const userMap = new Map();
  for (const shard of shards) {
    if (Array.isArray(shard.users)) {
      for (const u of shard.users) {
        userMap.set(u.id || u.email, u);
      }
    }
    if (shard.sessions) {
      Object.assign(aggregated.sessions, shard.sessions);
    }
    if (shard.userWorkspaces) {
      Object.assign(aggregated.userWorkspaces, shard.userWorkspaces);
    }
  }

  aggregated.users = Array.from(userMap.values());
  return aggregated;
}

/**
 * Write unified state by partitioning it across all shards.
 */
async function writeShardedState(state, count = SHARDS_COUNT) {
  await initShards(count);

  // Partition users, sessions, and workspaces
  const shards = Array.from({ length: count }, (_, i) => emptyShard(i));

  // 1. Partition Users
  if (Array.isArray(state.users)) {
    for (const user of state.users) {
      const idx = getShardIndex(user.id || user.email, count);
      shards[idx].users.push(user);
    }
  }

  // 2. Partition Workspaces
  if (state.userWorkspaces) {
    for (const [userId, ws] of Object.entries(state.userWorkspaces)) {
      const idx = getShardIndex(userId, count);
      shards[idx].userWorkspaces[userId] = ws;
    }
  }

  // 3. Partition Sessions
  if (state.sessions) {
    for (const [token, sess] of Object.entries(state.sessions)) {
      const key = sess.userId || token;
      const idx = getShardIndex(key, count);
      shards[idx].sessions[token] = sess;
    }
  }

  // Write all shards in parallel
  await Promise.all(shards.map((s, idx) => writeShard(idx, s)));

  // Write global metadata / fallback file
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = path.join(DATA_DIR, `nextstep-data.${Date.now()}.${crypto.randomBytes(3).toString("hex")}.tmp`);
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), "utf8");
  try {
    await fs.rename(tempFile, DATA_FILE);
  } catch {
    await fs.copyFile(tempFile, DATA_FILE);
    await fs.unlink(tempFile).catch(() => {});
  }
}

/**
 * MongoDB Native Cluster Sharding & Partition Routing
 */
async function setupMongoSharding(db, client) {
  if (!db || !client) return;

  try {
    // 1. Create hashed shard key indexes for multi-node horizontal scale
    await db.collection("users").createIndex({ id: "hashed" });
    await db.collection("user_workspaces").createIndex({ userId: "hashed" });
    await db.collection("evidence").createIndex({ userId: "hashed" });
    await db.collection("profiles").createIndex({ userId: "hashed" });

    // Compound index with explicit shardId for partition pruning
    await db.collection("user_workspaces").createIndex({ shardId: 1, userId: 1 });
    await db.collection("users").createIndex({ shardId: 1, id: 1 });

    if (process.env.DEBUG === "true") {
      console.log("[MongoDB Sharding] Hashed shard key indexes verified on users and user_workspaces.");
    }

    // 2. Attempt cluster-level sharding commands if connected to a mongos router
    const adminDb = client.db("admin");
    try {
      await adminDb.command({ enableSharding: MONGODB_DB_NAME });
      await adminDb.command({
        shardCollection: `${MONGODB_DB_NAME}.user_workspaces`,
        key: { userId: "hashed" },
      });
      await adminDb.command({
        shardCollection: `${MONGODB_DB_NAME}.users`,
        key: { id: "hashed" },
      });
      if (process.env.DEBUG === "true") {
        console.log(`[MongoDB Sharding] Successfully enabled cluster sharding on ${MONGODB_DB_NAME}.`);
      }
    } catch (cmdErr) {
      // Standalone MongoDB or unprivileged user - local collection partitioning is still active
      if (process.env.DEBUG === "true") {
        console.log(`[MongoDB Sharding] Standalone/Replica mode: ${cmdErr.message}. Logical partition indexing active.`);
      }
    }
  } catch (err) {
    console.warn(`[MongoDB Sharding] Setup notice: ${err.message}`);
  }
}

/**
 * Synchronize state to MongoDB with Sharded partitions
 */
async function writeShardedStateToMongo(db, state, count = SHARDS_COUNT) {
  if (!db) return;

  try {
    // Save current unified app_state
    await db.collection("app_state").updateOne(
      { id: "current_state" },
      { $set: { ...state, updatedAt: new Date() } },
      { upsert: true }
    );

    // Write sharded user_workspaces with explicit shardId and userId
    if (state.userWorkspaces) {
      const ops = [];
      for (const [userId, ws] of Object.entries(state.userWorkspaces)) {
        const shardId = getShardId(userId, count);
        ops.push(
          db.collection("user_workspaces").updateOne(
            { userId },
            { $set: { userId, shardId, workspace: ws, updatedAt: new Date() } },
            { upsert: true }
          )
        );
      }
      if (ops.length > 0) {
        await Promise.all(ops);
      }
    }

    // Write sharded users with explicit shardId
    if (Array.isArray(state.users) && state.users.length > 0) {
      const userOps = state.users.map((user) => {
        const shardId = getShardId(user.id || user.email, count);
        return db.collection("users").updateOne(
          { id: user.id },
          { $set: { ...user, shardId, updatedAt: new Date() } },
          { upsert: true }
        );
      });
      await Promise.all(userOps);
    }
  } catch (err) {
    console.warn(`[MongoDB Sharding] Error writing sharded state to MongoDB: ${err.message}`);
  }
}

/**
 * Real-time Sharding Statistics & Distribution Metrics
 */
async function getShardingStats(count = SHARDS_COUNT) {
  await initShards(count);

  const shardsData = [];
  let totalUsers = 0;
  let totalWorkspaces = 0;
  let totalBytes = 0;

  for (let i = 0; i < count; i++) {
    const shardFile = path.join(SHARDS_DIR, `shard_${i}.json`);
    let stat = { size: 0 };
    let data = emptyShard(i);
    try {
      stat = await fs.stat(shardFile);
      const raw = await fs.readFile(shardFile, "utf8");
      data = JSON.parse(raw);
    } catch {}

    const usersCount = (data.users || []).length;
    const wsCount = Object.keys(data.userWorkspaces || {}).length;

    totalUsers += usersCount;
    totalWorkspaces += wsCount;
    totalBytes += stat.size;

    shardsData.push({
      shardId: `shard_${i}`,
      shardIndex: i,
      usersCount,
      workspacesCount: wsCount,
      sizeBytes: stat.size,
      status: "online",
      updatedAt: data.updatedAt,
    });
  }

  // Calculate hash uniformity / balance metric (0% to 100%)
  const expectedPerShard = (totalUsers + totalWorkspaces) / count;
  let deviationSum = 0;
  for (const s of shardsData) {
    const totalItems = s.usersCount + s.workspacesCount;
    deviationSum += Math.abs(totalItems - expectedPerShard);
  }
  const balanceScore = (totalUsers + totalWorkspaces) === 0
    ? 100
    : Math.max(0, Math.round(100 - (deviationSum / (totalUsers + totalWorkspaces || 1)) * 50));

  return {
    status: "active",
    strategy: "consistent-hashing",
    shardCount: count,
    totalUsers,
    totalWorkspaces,
    totalStorageBytes: totalBytes,
    balanceScore: `${balanceScore}%`,
    shards: shardsData,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  hashKey,
  getShardIndex,
  getShardId,
  initShards,
  readShard,
  writeShard,
  readUserWorkspace,
  writeUserWorkspace,
  readShardedState,
  writeShardedState,
  setupMongoSharding,
  writeShardedStateToMongo,
  getShardingStats,
};
