# 🚀 ChainBudget System Architecture & Engineering Roadmap

> **Author:** Alfie Lynard Polacas & Engineering Team  
> **Domain:** Decentralized Financial Transparency, Web3 DAO Treasury & Real-Time Collaboration  
> **Document Purpose:** Architectural Evolution Blueprint, Scalability Guide, and Backend Engineering Deep Dive.

---

## 📑 Table of Contents
1. [Executive Summary & Architectural Vision](#1-executive-summary--architectural-vision)
2. [Current Architecture: Phase 1 (Modular Monolith)](#2-current-architecture-phase-1-modular-monolith)
3. [Intermediate Architecture: Phase 2 (Hybrid Scale & Redis Integration)](#3-intermediate-architecture-phase-2-hybrid-scale--redis-integration)
4. [Target Architecture: Phase 3 (Distributed Microservices & Rust Web3 Service)](#4-target-architecture-phase-3-distributed-microservices--rust-web3-service)
5. [Backend & Software Engineering Deep-Dive Concepts](#5-backend--software-engineering-deep-dive-concepts)
   - [A. System Design & Architectural Patterns](#a-system-design--architectural-patterns)
   - [B. Database Engineering & Data Consistency](#b-database-engineering--data-consistency)
   - [C. Web3 & High-Performance Blockchain Engineering (Rust + Solidity)](#c-web3--high-performance-blockchain-engineering-rust--solidity)
   - [D. Event-Driven Messaging & Async Task Queues](#d-event-driven-messaging--async-task-queues)
   - [E. Security, Cryptography & High Availability](#e-security-cryptography--high-availability)
6. [Phase-by-Phase Implementation Milestones](#6-phase-by-phase-implementation-milestones)
7. [Career & Engineering Mastery Guide](#7-career--engineering-mastery-guide)

---

## 1. Executive Summary & Architectural Vision

ChainBudget is designed to provide **uncompromising financial transparency, multi-signature treasury approvals, and real-time collaboration for DAOs, Cooperatives, Local Governments (Barangays), and Organizations**.

To balance **speed-to-market**, **operational costs**, and **long-term enterprise scalability**, the system follows an industry-proven evolution pattern:
$$\text{Modular Monolith (V1)} \longrightarrow \text{Hybrid Caching \& Queuing (V2)} \longrightarrow \text{Distributed Microservices (V3)}$$

```
+---------------------------------------------------------------------------------------+
|                                    CHAINBUDGET EVOLUTION                              |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   PHASE 1: (CURRENT)             PHASE 2: (SCALING)             PHASE 3: (ENTERPRISE) |
|   ==================             ==================             ===================== |
|   • Modular Monolith (Node.js)   • Node.js Monolith             • API Gateway Routing |
|   • In-Memory Presence & Sockets • Redis Pub/Sub Clusters       • Rust Web3 Relayer   |
|   • Single MongoDB Instance      • BullMQ Async Queues          • Go / Node Chat Hub  |
|   • Solidity on Polygon          • Read Replicas & Indexes      • Python AI & OCR Hub |
|   • Low cost, fast deployment    • 50k - 100k Concurrent Users  • 1M+ Global Scale    |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

---

## 2. Current Architecture: Phase 1 (Modular Monolith)

### Architecture Diagram
```
                     +---------------------------------------+
                     |         Web App (Next.js 16)          |
                     |         Mobile App (React Native/Expo)|
                     +-------------------+-------------------+
                                         |
                                         | HTTPS / WSS
                                         v
                     +---------------------------------------+
                     |         Fly.io Cloud Container        |
                     |   ChainBudget Node.js Express API     |
                     |                                       |
                     |  [ /auth ]       [ /organizations ]   |
                     |  [ /budget ]     [ /approvals ]       |
                     |  [ /dao ]        [ /chat & presence ] |
                     |  [ /ai ]         [ /upload ]          |
                     +---------+-------------------+---------+
                               |                   |
               MongoDB Queries |                   | JSON-RPC (ethers.js)
                               v                   v
                     +-----------------+   +-----------------------+
                     | MongoDB Atlas   |   | Polygon Blockchain    |
                     | (Primary Store) |   | (Escrow & SBTs)       |
                     +-----------------+   +-----------------------+
```

### Key Technical Characteristics:
1. **Single Deployment Unit:** Deployed cleanly on Fly.io (`chainbudget-api.fly.dev`) using Docker.
2. **Modular Code Separation:** Routes are isolated logically (`routes/chat.js`, `routes/approvals.js`, `routes/dao.js`), ensuring zero cross-domain spaghetti code.
3. **In-Memory Presence Tracking:** `orgOnlineUsers` Map and `userActiveSockets` Map track live active green dots in real time with sub-millisecond execution.
4. **Optimistic UI Engine:** Frontends immediately append user actions locally with temporary UUIDs, reconciling with the backend asynchronously.

---

## 3. Intermediate Architecture: Phase 2 (Hybrid Scale & Redis Integration)

When concurrent user activity grows (10,000 to 100,000 active DAO members), state can no longer remain inside a single Node.js memory process.

```
                           +------------------------+
                           |  Mobile & Web Clients  |
                           +-----------+------------+
                                       |
                                       v
                     +------------------------------------+
                     |    Load Balancer (Fly / Cloudflare)|
                     +--------+------------------+--------+
                              |                  |
                              v                  v
                     +----------------+  +----------------+
                     | Node Node #1   |  | Node Node #2   |
                     +--------+-------+  +-------+--------+
                              |                  |
                              +--------+---------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   v                                       v
         +-------------------+                   +-------------------+
         | Redis Cluster     |                   | MongoDB Atlas     |
         | • Socket.IO PubSub|                   | • Primary (Writes)|
         | • BullMQ Task Que |                   | • Replicas (Reads)|
         | • Token Blacklist |                   +-------------------+
         +-------------------+
```

### Upgrades in Phase 2:
1. **Redis Pub/Sub Socket Adapter (`@socket.io/redis-adapter`):**
   - Allows multiple Node.js server containers to broadcast chat messages and online status to each other seamlessly.
2. **BullMQ Async Job Queue:**
   - Dedicated Redis queues for processing offline push notifications, email reports, and audit hash generations.
3. **Database Read/Write Splitting:**
   - Read-heavy queries (Explorer, Public Ledgers) read from MongoDB Read Replicas, freeing the primary node for transactional writes.

---

## 4. Target Architecture: Phase 3 (Distributed Microservices & Rust Web3 Service)

For high-scale enterprise operations (millions of users, institutional treasury management, multi-chain expansion):

```
                                  +------------------------------------+
                                  |       Mobile & Web Clients         |
                                  +-----------------+------------------+
                                                    |
                                                    v
                                  +------------------------------------+
                                  |    API Gateway (Kong / Cloudflare) |
                                  |    • SSL, Rate Limit, Auth Routing |
                                  +----+--------+--------+--------+----+
                                       |        |        |        |
            /api/v1/core/*             |        |        |        | /api/v1/ai/*
      +--------------------------------+        |        |        +--------------------------------+
      |                                         |        |                                         |
      v                                         |        |                                         v
+-----------------------------+                 |        |                 +-----------------------------+
| 1. Core Financial Service   |                 |        |                 | 4. AI & Analytics Service   |
| • Tech: TypeScript / NestJS |                 |        |                 | • Tech: Python (FastAPI)    |
| • DB: PostgreSQL (ACID)     |                 |        |                 | • Gemini LLM & Anomaly Det. |
| • Orgs, Budgets, Approvals  |                 |        |                 | • Tesseract / Vision OCR    |
+--------------+--------------+                 |        |                 +--------------+--------------+
               |                                |        |                                |
               |              /socket.io /chat  |        | /api/v1/web3/*                 |
               |         +----------------------+        +----------------------+         |
               |         |                                                      |         |
               |         v                                                      v         |
               |   +-----------------------------+                +-----------------------+-----+
               |   | 2. Real-Time Chat Service   |                | 3. Rust Web3 Relayer Service|
               |   | • Tech: Node.js / Go        |                | • Tech: Rust (Axum + Alloy) |
               |   | • DB: Redis + MongoDB       |                | • EVM Cryptography & Nonce  |
               |   | • Presence & Seen Receipts  |                | • Event Indexer & Gas Relayer|
               |   +--------------+--------------+                +-------------+---------------+
               |                  |                                             |
               +------------------+----------------------+----------------------+
                                                         |
                                                         v
                                       +-----------------------------------+
                                       |  Event Bus (RabbitMQ / Kafka)     |
                                       |  • Asynchronous inter-service     |
                                       |    event publishing               |
                                       +-----------------------------------+
```

---

## 5. Backend & Software Engineering Deep-Dive Concepts

### A. System Design & Architectural Patterns

#### 1. Idempotency in Financial & Approval Transactions
In distributed networks, mobile retries or network hiccups can cause duplicate HTTP requests.
- **Implementation Pattern:** Every financial mutation request (budget request, escrow release) includes an `Idempotency-Key` header (or UUID).
- **Backend Behavior:**
  ```
  Request -> Check Redis Key "idemp:<key>"
  If EXISTS -> Return cached result (Do not re-execute).
  If NOT EXISTS -> Acquire lock, execute transaction, cache result for 24h.
  ```

#### 2. CQRS (Command Query Responsibility Segregation)
- **Commands (Writes):** Modifying balances, creating escrow approvals, sending chats. Handled with strict ACID validation.
- **Queries (Reads):** Fetching historical ledger data, public explorer, chat history. Optimized using denormalized read models and cache layers.

---

### B. Database Engineering & Data Consistency

#### 1. MongoDB Compound Indexing Strategy
In ChainBudget chat and ledger queries, compound indexes are required for $O(\log N)$ performance:
```javascript
// Optimized compound index for fast chat pagination
ChatMessageSchema.index({ organization: 1, createdAt: -1 });

// Fast unread message resolution
ChatMessageSchema.index({ organization: 1, sender: 1, seenBy: 1 });
```

#### 2. Transitioning from MongoDB to PostgreSQL for Core Ledger
- **MongoDB:** Ideal for unstructured payloads, dynamic chat messages, user profiles, and organization metadata.
- **PostgreSQL:** The gold standard for financial double-entry bookkeeping ledgers (`debit` and `credit` columns where sum must equal 0) with strict ACID guarantees and foreign key constraints.

---

### C. Web3 & High-Performance Blockchain Engineering (Rust + Solidity)

#### 1. The Division of Labor (Solidity vs. Rust)
- **Solidity (On-Chain Smart Contract):**
  - Holds custody of the escrow treasury.
  - Verifies multi-sig cryptographic signatures on-chain.
  - Mints soulbound non-transferable reputation tokens (SBTs).
- **Rust Backend Service (Off-Chain Relayer & Indexer):**
  - **Zero-cost async concurrency:** Handles high-frequency polling and WebSocket subscription to Polygon RPC nodes.
  - **Gas Sponsorship & Nonce Manager:** Calculates EIP-1559 dynamic base fees, manages sequential transaction nonces, and signs with relayer private keys.
  - **Fast Cryptography:** Uses Rust crates like `k256`, `secp256k1`, and `alloy-primitives` for lightning-fast ECDSA signature verification.

#### 2. Sample Rust Blockchain Event Listener Pattern
```rust
use alloy::providers::{Provider, ProviderBuilder, WsConnect};
use alloy::sol;
use eyre::Result;

// Solidity Smart Contract Interface binding in Rust
sol!(
    #[sol(rpc)]
    contract ChainBudgetEscrow {
        event EscrowDeposited(uint256 indexed proposalId, address depositor, uint256 amount);
        event EscrowReleased(uint256 indexed proposalId, address payee, uint256 amount);
    }
);

pub async fn start_blockchain_indexer(rpc_ws_url: &str) -> Result<()> {
    let ws = WsConnect::new(rpc_ws_url);
    let provider = ProviderBuilder::new().on_ws(ws).await?;
    
    println!("🦀 Rust Indexer connected to Polygon RPC!");
    // Stream live blockchain events with zero garbage-collection overhead
    // ...
    Ok(())
}
```

---

### D. Event-Driven Messaging & Async Task Queues

#### 1. When to Use What?

| Technology | Best Use Case in ChainBudget | Latency Profile | Complexity |
| :--- | :--- | :--- | :--- |
| **In-Memory (Current)** | Single-server event dispatch, rapid prototyping. | $< 1\text{ ms}$ | Very Low |
| **Redis + BullMQ** | Multi-server Socket.IO pub/sub, mobile push notification queues. | $1\text{ ms} - 5\text{ ms}$ | Low - Medium |
| **RabbitMQ** | Inter-service transactional RPC routing (e.g. Core API $\to$ Rust Relayer). | $5\text{ ms} - 15\text{ ms}$ | Medium |
| **Apache Kafka** | Big Data event stream auditing, millions of global txs/sec. | $10\text{ ms} - 30\text{ ms}$ | High (Enterprise) |

---

### E. Security, Cryptography & High Availability

1. **Dual-Layer Token Authentication:**
   - Asgardeo OpenID Connect (OIDC / OAuth 2.0) with RS256 JWKS verification for Web.
   - ChainBudget Secure JWT Engine for Mobile App biometric logins.
2. **Field-Level Envelope Encryption (AES-256-GCM v2):**
   - Off-chain confidential data (e.g. private keys, KYC identities) is encrypted before hitting MongoDB with unique random 96-bit Initialization Vectors (IVs) and AEAD authentication tags.
3. **Strict CSRF & Replay Defense:**
   - Double Submit HMAC-SHA256 tokens and origin whitelisting prevent unauthorized cross-site execution.

---

## 6. Step-by-Step Multi-Backend Implementation Blueprint (The Strangler Fig Pattern)

To transition from the current monolithic repository to a multi-service architecture without breaking live production, follow this exact step-by-step extraction guide:

### A. Target Monorepo Folder Structure
```
chainbudgets/
├── contracts/                  # Solidity smart contracts (Hardhat/Foundry)
├── frontend/                   # Next.js 16 Web Dashboard
├── mobile/                     # React Native / Expo Mobile App
├── gateway/                    # API Gateway & Reverse Proxy (Nginx / Dockerfile)
│   └── nginx.conf
└── services/
    ├── core-api/               # [Service 1] Node.js / TypeScript Core Business API
    │   ├── src/ (routes: auth, orgs, budgets, approvals, reports)
    │   └── package.json
    ├── chat-service/           # [Service 2] Node.js / Go WebSocket & Real-Time Presence
    │   ├── src/ (sockets, presence, redis adapter)
    │   └── package.json
    ├── web3-relayer/           # [Service 3] Rust Web3 Blockchain Relayer & Indexer
    │   ├── Cargo.toml
    │   └── src/ (main.rs, relayer.rs, indexer.rs, crypto.rs)
    └── ai-service/             # [Service 4] Python FastAPI AI & OCR Analysis
        ├── app/ (main.py, ocr.py, gemini.py)
        └── requirements.txt
```

---

### B. Service 1: Rust Web3 Blockchain Relayer & Indexer (`services/web3-relayer/`)

#### 1. `Cargo.toml` Setup:
```toml
[package]
name = "chainbudget-web3-relayer"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"                  # Ultra-fast async web framework
tokio = { version = "1.0", features = ["full"] } # Async runtime
alloy = { version = "0.1", features = ["full"] } # Modern Ethereum/EVM library
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tracing = "0.1"
tracing-subscriber = "0.3"
mongodb = "2.8"
eyre = "0.6"
```

#### 2. Relayer Execution Flow (`src/main.rs`):
```rust
use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

#[derive(Deserialize)]
struct RelayEscrowReleaseRequest {
    proposal_id: String,
    payee_address: String,
    amount_in_wei: String,
    dual_signatures: Vec<String>,
}

#[derive(Serialize)]
struct RelayResponse {
    success: bool,
    tx_hash: String,
    block_number: u64,
}

async fn handle_relay_escrow_release(
    Json(payload): Json<RelayEscrowReleaseRequest>,
) -> Json<RelayResponse> {
    // 1. Verify off-chain dual cryptographic signatures with secp256k1
    // 2. Submit transaction to Polygon via EIP-1559 sponsored relayer
    // 3. Return verified on-chain receipt
    Json(RelayResponse {
        success: true,
        tx_hash: "0x3f8a92b...".to_string(),
        block_number: 64289100,
    })
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/web3/relay/release", post(handle_relay_escrow_release));

    let addr = SocketAddr::from(([0, 0, 0, 0], 5003));
    println!("🦀 Rust Web3 Relayer running on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

---

### C. Service 2: Real-time Chat & WebSocket Gateway (`services/chat-service/`)

#### 1. Setup with Redis Pub/Sub:
```javascript
// services/chat-service/src/index.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Connect Redis Pub/Sub for infinite multi-instance scaling
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));

io.on('connection', (socket) => {
  // Join Organization Room
  socket.on('join_org', (orgId) => {
    socket.join(`org:${orgId}`);
  });

  // Broadcast Message to all nodes
  socket.on('send_message', (data) => {
    io.to(`org:${data.orgId}`).emit('new_org_message', data);
  });
});

httpServer.listen(5002, () => console.log('💬 Chat Service on port 5002'));
```

---

### D. Service 3: AI Intelligence & Receipt OCR Service (`services/ai-service/`)

#### 1. Python FastAPI Implementation (`app/main.py`):
```python
# services/ai-service/app/main.py
from fastapi import FastAPI, UploadFile, File
import google.generativeai as genai
import pytesseract
from PIL import Image
import io

app = FastAPI(title="ChainBudget AI & OCR Service")

@app.post("/api/ai/scan-receipt")
async def scan_receipt(file: UploadFile = File(...)):
    # 1. Read uploaded image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    
    # 2. Extract raw OCR text
    ocr_text = pytesseract.image_to_string(image)
    
    # 3. Use Gemini to structure receipt data (Vendor, Total, Date, Category)
    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = f"Extract merchant, total amount (PHP), date, and line items in JSON from this receipt:\n{ocr_text}"
    response = model.generate_content(prompt)
    
    return {"raw_text": ocr_text, "structured_data": response.text}
```

---

### E. Unified API Gateway & Orchestration (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  # 🌐 Reverse Proxy / API Gateway
  api-gateway:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./gateway/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - core-api
      - chat-service
      - web3-relayer
      - ai-service

  # 🏢 Service 1: Core API
  core-api:
    build: ./services/core-api
    environment:
      - PORT=5001
      - MONGODB_URI=mongodb://mongo:27017/chainbudget
      - REDIS_URL=redis://redis:6379

  # 💬 Service 2: Real-time Chat
  chat-service:
    build: ./services/chat-service
    environment:
      - PORT=5002
      - REDIS_URL=redis://redis:6379

  # 🦀 Service 3: Rust Web3 Relayer
  web3-relayer:
    build: ./services/web3-relayer
    environment:
      - PORT=5003
      - POLYGON_RPC_WS=wss://polygon-amoy.g.alchemy.com/v2/YOUR_KEY

  # 🧠 Service 4: Python AI & OCR
  ai-service:
    build: ./services/ai-service
    environment:
      - PORT=5004
      - GEMINI_API_KEY=${GEMINI_API_KEY}

  # ⚡ Shared Caching & PubSub
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

#### API Gateway Nginx Configuration (`gateway/nginx.conf`):
```nginx
events {}
http {
    upstream core_api    { server core-api:5001; }
    upstream chat_svc    { server chat-service:5002; }
    upstream web3_svc    { server web3-relayer:5003; }
    upstream ai_svc      { server ai-service:5004; }

    server {
        listen 80;

        # 1. Real-Time Chat & WebSockets
        location /socket.io/ {
            proxy_pass http://chat_svc;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
        }
        location /api/chat/ { proxy_pass http://chat_svc; }

        # 2. Rust Web3 Blockchain Relayer
        location /api/web3/ { proxy_pass http://web3_svc; }

        # 3. Python AI & OCR Service
        location /api/ai/ { proxy_pass http://ai_svc; }

        # 4. Core Business API (Default fallback)
        location / { proxy_pass http://core_api; }
    }
}
```

---

## 7. Phase-by-Phase Implementation Milestones

```
Phase 1: Production Launch (Current)
  ├── [x] Complete Modular Monolith API
  ├── [x] Real-time Socket.IO presence & chat
  ├── [x] Messenger-style Chat Selection & Search
  ├── [x] Dual-Release Smart Contract on Polygon
  └── [x] Fly.io Cloud Deployment

Phase 2: Hybrid Scale & Distributed Caching
  ├── [ ] Provision Redis instance (Upstash / Redis Cloud)
  ├── [ ] Add @socket.io/redis-adapter for horizontal scaling
  ├── [ ] Migrate Expo Push Notifications to BullMQ background worker
  └── [ ] Enable MongoDB Read Replicas & query profiling

Phase 3: Microservices & Rust Web3 Service
  ├── [ ] Build Rust Blockchain Indexer & Gas Relayer crate (Axum + Alloy)
  ├── [ ] Extract Node.js / Go Chat & Presence gateway with Redis Pub/Sub
  ├── [ ] Extract Python AI / OCR service for receipt analysis (FastAPI)
  ├── [ ] Setup Kong / Nginx API Gateway with Docker Compose orchestration
  └── [ ] Integrate RabbitMQ for distributed event choreography
```

---

## 8. Career & Engineering Mastery Guide

### Recommended Core Reading for Aspiring Backend & Systems Engineers:
1. **"Designing Data-Intensive Applications" (DDIA)** by *Martin Kleppmann* — The bible of distributed systems, databases, and message brokers.
2. **"Database Internals: A Deep Dive into How Distributed Data Systems Work"** by *Alex Petrov*.
3. **"Programming Rust: Fast, Safe Systems Development"** by *Jim Blandy & Jason Orendorff*.
4. **"System Design Interview – An Insider's Guide"** by *Alex Xu* (Volumes 1 & 2).

### Core Mindset:
> *"The best software engineers do not choose tools because they are trendy; they choose the simplest architecture that solves the current business problem reliably, while structuring code cleanly so it can evolve without friction."*

---

*(c) 2026 ChainBudget Engineering Team. All Rights Reserved.*
