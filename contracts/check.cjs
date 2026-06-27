const { ethers } = require("ethers");
require("dotenv").config();

async function check() {
    const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
    const admin = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const backend = "0x526392861832E7b52689f6fb12E75876DC1a07cD";
    
    try {
        const a = await provider.getBalance(admin);
        const b = await provider.getBalance(backend);
        
        console.log("Admin MATIC:", ethers.formatEther(a));
        console.log("Backend MATIC:", ethers.formatEther(b));
    } catch(e) {
        console.log("RPC Error:", e.message);
    }
}
check();
