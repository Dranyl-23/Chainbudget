const { ethers } = require("ethers");

async function testAuth() {
  try {
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;

    console.log("1. Requesting nonce for", address);
    const nonceRes = await fetch(`http://localhost:5000/api/auth/nonce/${address}`);
    if (!nonceRes.ok) throw new Error(`HTTP ${nonceRes.status} ${await nonceRes.text()}`);
    const { nonce } = await nonceRes.json();
    console.log("Nonce received:", nonce);

    console.log("2. Signing nonce...");
    const signature = await wallet.signMessage(nonce);
    console.log("Signature generated:", signature);

    console.log("3. Verifying signature...");
    const verifyRes = await fetch(`http://localhost:5000/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address, signature })
    });
    
    if (!verifyRes.ok) throw new Error(`HTTP ${verifyRes.status} ${await verifyRes.text()}`);
    const data = await verifyRes.json();

    console.log("✅ Success! Token:", data.token.substring(0, 20) + "...");
    console.log("User object:", data.user);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

testAuth();
