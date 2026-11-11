const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { ethers } = require("ethers");

const fromList = (process.env.INITIAL_APPROVERS || "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("your_"));

let approvers = fromList;
if (approvers.length === 0) {
  const rawKey = (process.env.PRIVATE_KEY || "").trim().replace(/^["']|["']$/g, "");
  const deployerAddress = rawKey ? new ethers.Wallet(rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`).address : null;
  const secondary = (process.env.SECONDARY_APPROVER_ADDRESS || "").trim();
  approvers = [deployerAddress, secondary].filter((addr) => addr && ethers.isAddress(addr));
}

const requiredApprovals = Number(process.env.REQUIRED_APPROVALS || (approvers.length >= 2 ? 2 : 1));

module.exports = [approvers, requiredApprovals];
