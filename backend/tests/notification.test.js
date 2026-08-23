const { test, describe } = require("node:test");
const assert = require("node:assert");

const NotificationService = require("../src/services/notificationService");
const notificationQueue = require("../src/services/notificationQueue");
const User = require("../src/models/User");

describe("NotificationService & User Preferences Suite", () => {
  test("NotificationService defines expected static methods", () => {
    assert.strictEqual(typeof NotificationService.sendPush, "function");
    assert.strictEqual(typeof NotificationService.createInAppNotification, "function");
    assert.strictEqual(typeof NotificationService.notifyTransactionCreated, "function");
    assert.strictEqual(typeof NotificationService.notifyApprovalAction, "function");
    assert.strictEqual(typeof NotificationService.notifyDaoProposalCreated, "function");
    assert.strictEqual(typeof NotificationService.removeInvalidPushToken, "function");
  });

  test("User model initializes with default notificationPreferences", () => {
    const user = new User({
      walletAddress: "0x3333333333333333333333333333333333333333",
      displayName: "Charlie",
    });

    const prefs = user.notificationPreferences;
    assert.ok(prefs, "Preferences object should exist");
    assert.strictEqual(prefs.email, true);
    assert.strictEqual(prefs.push, true);
    assert.strictEqual(prefs.daoProposals, true);
    assert.strictEqual(prefs.approvals, true);
    assert.strictEqual(prefs.transactions, true);
    assert.strictEqual(prefs.chatMentions, true);
    assert.strictEqual(prefs.securityAlerts, true);
  });

  test("NotificationQueue enqueues and processes asynchronous tasks with concurrency control", async () => {
    let taskExecuted = false;

    const jobId = notificationQueue.enqueue("test_job", async () => {
      taskExecuted = true;
    });

    assert.ok(typeof jobId === "string" && jobId.length > 5, "Job ID should be generated");

    // Wait a brief moment for worker event loop
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(taskExecuted, true, "Worker should execute enqueued handler");
  });

  test("NotificationQueue returns healthy diagnostic metrics", () => {
    const metrics = notificationQueue.getMetrics();
    assert.strictEqual(typeof metrics.pending, "number");
    assert.strictEqual(typeof metrics.running, "number");
    assert.strictEqual(typeof metrics.concurrency, "number");
    assert.strictEqual(metrics.concurrency, 5);
  });
});

