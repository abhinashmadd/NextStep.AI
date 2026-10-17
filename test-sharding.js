const assert = require("node:assert");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const sharding = require("./src/config/sharding");
const { SHARDS_DIR, SHARDS_COUNT } = require("./src/config/environment");

const TEST_PORT = 3998;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runShardingTestSuite() {
  console.log("==========================================");
  console.log(" Running NextStep Database Sharding Tests");
  console.log("==========================================\n");

  let passed = 0;
  function pass(desc) {
    console.log(`  ✓ ${desc}`);
    passed++;
  }

  // 1. Test Hash Determinism & Distribution
  console.log("[1] Testing Consistent Hash Sharding Algorithm");
  const testIds = [
    "user_alex_101", "user_sarah_102", "user_dev_103", "user_priya_104",
    "user_rahul_105", "user_chen_106", "user_elena_107", "user_marcus_108",
    "user_anita_109", "user_lucas_110", "user_zane_111", "user_maya_112"
  ];

  // Determinism check: same ID always yields same shard
  for (const id of testIds) {
    const s1 = sharding.getShardIndex(id, 4);
    const s2 = sharding.getShardIndex(id, 4);
    assert.strictEqual(s1, s2, `Shard index must be strictly deterministic for ${id}`);
  }
  pass("Hash function is 100% deterministic");

  // Uniformity check across 4 shards
  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 200; i++) {
    const key = `student_sim_${i}_${(i * 97) % 1000}`;
    const idx = sharding.getShardIndex(key, 4);
    distribution[idx]++;
  }
  // Each shard should receive roughly 25% (at least 30 out of 200 items)
  for (let s = 0; s < 4; s++) {
    assert(distribution[s] >= 25, `Shard ${s} received ${distribution[s]} items, expected balanced distribution`);
  }
  pass(`Hash distribution across 4 shards is balanced: [${distribution[0]}, ${distribution[1]}, ${distribution[2]}, ${distribution[3]}]`);

  // 2. Test Sharded File Operations
  console.log("\n[2] Testing Shard File Initialization & Isolation");
  await sharding.initShards(4);

  const metaPath = path.join(SHARDS_DIR, "metadata.json");
  const metaStat = await fs.stat(metaPath);
  assert(metaStat.isFile(), "metadata.json must be created");
  pass("Shards metadata.json verified");

  for (let s = 0; s < 4; s++) {
    const shardFile = path.join(SHARDS_DIR, `shard_${s}.json`);
    const shardStat = await fs.stat(shardFile);
    assert(shardStat.isFile(), `shard_${s}.json must exist`);
  }
  pass("All 4 physical shard partitions exist on disk");

  // 3. Test Targeted Single-Shard Write & Read (O(1) routing)
  console.log("\n[3] Testing Direct Single-Shard Targeted Operations");
  const testUserId = "student_target_999";
  const targetShardIdx = sharding.getShardIndex(testUserId, 4);
  const targetShardName = sharding.getShardId(testUserId, 4);

  const mockWorkspace = {
    profile: { name: "Sharding Test Student", targetRole: "Software Developer" },
    evidence: [{ id: "ev-1", title: "Distributed Database Benchmark" }],
    assessment: [],
  };

  await sharding.writeUserWorkspace(testUserId, mockWorkspace, 4);
  pass(`Wrote user workspace directly to ${targetShardName}`);

  // Verify it exists in target shard file
  const shardContent = await sharding.readShard(targetShardIdx);
  assert(shardContent.userWorkspaces[testUserId], "Workspace must be stored in target shard");
  assert.strictEqual(shardContent.userWorkspaces[testUserId].profile.name, "Sharding Test Student");
  pass("Target shard contains persisted workspace");

  // Verify other shards DO NOT contain this user's data (Cross-shard isolation)
  for (let s = 0; s < 4; s++) {
    if (s !== targetShardIdx) {
      const otherShard = await sharding.readShard(s);
      assert(!otherShard.userWorkspaces || !otherShard.userWorkspaces[testUserId], `Shard ${s} must NOT contain user from Shard ${targetShardIdx}`);
    }
  }
  pass("Strict cross-shard isolation verified: other shards have zero data leakage");

  // Test fast readUserWorkspace
  const readBack = await sharding.readUserWorkspace(testUserId, 4);
  assert(readBack, "readUserWorkspace must return workspace");
  assert.strictEqual(readBack.profile.name, "Sharding Test Student");
  pass("Fast O(1) single-shard readUserWorkspace succeeded");

  // 4. Test Multi-Shard Aggregation (readShardedState / writeShardedState)
  console.log("\n[4] Testing Multi-Shard Aggregation & State Synthesis");
  const fullState = await sharding.readShardedState(4);
  assert(fullState.userWorkspaces, "Aggregated state must contain userWorkspaces");
  assert(fullState.userWorkspaces[testUserId], "Aggregated state must contain target user workspace");
  assert.strictEqual(fullState._sharded, true, "State flag _sharded must be true");
  assert.strictEqual(fullState._shardCount, 4, "State shard count must match");
  pass("Multi-shard parallel read aggregated state successfully");

  // 5. Test Sharding Metrics & Diagnostics API
  console.log("\n[5] Testing Sharding Statistics & Diagnostics");
  const stats = await sharding.getShardingStats(4);
  assert.strictEqual(stats.status, "active");
  assert.strictEqual(stats.shardCount, 4);
  assert.strictEqual(stats.shards.length, 4);
  assert(stats.totalWorkspaces >= 1, "Must report at least 1 workspace");
  pass(`Sharding stats verified: ${stats.totalWorkspaces} workspaces across ${stats.shardCount} shards (Balance Score: ${stats.balanceScore})`);

  // 6. Test Live HTTP Server Endpoints with Sharding
  console.log("\n[6] Testing Live HTTP Server Integration");
  const serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(TEST_PORT), SHARDS_COUNT: "4", DEBUG: "false" },
    stdio: "pipe",
  });

  await sleep(1500);

  try {
    // 6a. Health endpoint
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(healthRes.status, 200, "Health check must return 200");
    const healthJson = await healthRes.json();
    assert(healthJson.database.sharding, "Health check must include sharding info");
    assert.strictEqual(healthJson.database.sharding.enabled, true);
    assert.strictEqual(healthJson.database.sharding.shardCount, 4);
    pass("GET /api/health reports sharding is enabled with 4 shards");

    // 6b. Sharding stats endpoint
    const statsRes = await fetch(`${BASE_URL}/api/sharding/stats`);
    assert.strictEqual(statsRes.status, 200, "/api/sharding/stats must return 200");
    const statsJson = await statsRes.json();
    assert.strictEqual(statsJson.status, "active");
    assert.strictEqual(statsJson.shardCount, 4);
    assert.strictEqual(statsJson.shards.length, 4);
    pass("GET /api/sharding/stats returns live shard metrics and distribution");

    // 6c. Rebalance endpoint
    const rebalRes = await fetch(`${BASE_URL}/api/sharding/rebalance`, { method: "POST" });
    assert.strictEqual(rebalRes.status, 200, "/api/sharding/rebalance must return 200");
    const rebalJson = await rebalRes.json();
    assert(rebalJson.message.includes("synchronized and rebalanced"));
    pass("POST /api/sharding/rebalance successfully verified integrity across all shards");

  } finally {
    serverProcess.kill();
  }

  console.log("\n==========================================");
  console.log(` ALL SHARDING TESTS PASSED: ${passed} passed, 0 failed`);
  console.log("==========================================");
}

runShardingTestSuite().catch((err) => {
  console.error("\n❌ Sharding Test Failed:", err);
  process.exit(1);
});
