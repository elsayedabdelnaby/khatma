# ⚡ Khatma - Peak Traffic & Auto-Scaling

> إزاي النظام بيتعامل مع أوقات الذروة (رمضان مثلاً)

## Auto-Scaling Overview

```mermaid
graph TB
    subgraph Normal["📊 يوم عادي<br/>100 request/sec"]
        direction TB
        N_GW["🌐 API Gateway<br/>Normal Load"]
        N_L["⚡ Lambda: 5 instances"]
        N_DB["🗄️ DynamoDB<br/>Low throughput"]
        N_SQS["📨 SQS: 10 msg/sec"]
        N_Cost["💰 Cost: ~$5/month"]

        N_GW --> N_L --> N_DB
        N_L --> N_SQS
    end

    subgraph Ramadan["🌙 رمضان - الذروة<br/>10,000 request/sec"]
        direction TB
        R_GW["🌐 API Gateway<br/>Auto-Scale ✅"]
        R_L["⚡ Lambda: 500 instances<br/>Auto-Scale ✅"]
        R_DB["🗄️ DynamoDB<br/>Auto-Scale ✅"]
        R_SQS["📨 SQS: 10,000 msg/sec<br/>No limit ✅"]
        R_Cost["💰 Cost: ~$50-100/month"]

        R_GW --> R_L --> R_DB
        R_L --> R_SQS
    end

    subgraph After["📊 بعد رمضان<br/>100 request/sec"]
        direction TB
        A_GW["🌐 API Gateway<br/>Scale Down ✅"]
        A_L["⚡ Lambda: 5 instances<br/>Scale Down ✅"]
        A_DB["🗄️ DynamoDB<br/>Scale Down ✅"]
        A_SQS["📨 SQS: 10 msg/sec"]
        A_Cost["💰 Cost: ~$5/month 🎉"]

        A_GW --> A_L --> A_DB
        A_L --> A_SQS
    end

    Normal -->|"🌙 رمضان جاء"| Ramadan
    Ramadan -->|"رمضان خلص"| After

    style Normal fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style Ramadan fill:#FFF3E0,stroke:#E65100,stroke-width:3px
    style After fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
```

## ⚡ Peak Scenario: 1000 User Reserve Parts at Same Time

```mermaid
sequenceDiagram
    participant Users as 📱 1000 Users<br/>(Same Second!)
    participant GW as 🌐 API Gateway
    participant Lambda as ⚡ KhatmaFn<br/>(Auto-scales to 1000 instances)
    participant DB as 🗄️ DynamoDB<br/>(Handles all writes)
    participant SQS as 📨 SQS Queue
    participant Worker as 📨 WorkerFn

    Note over Users,Worker: 🔥 PEAK: 1000 reserve requests in 1 second!

    Users->>GW: 1000 simultaneous requests
    Note over GW: ✅ API Gateway handles<br/>millions of requests

    GW->>Lambda: 1000 parallel invocations
    Note over Lambda: ✅ Lambda auto-scales<br/>to 1000 instances instantly

    Lambda->>DB: 1000 conditional writes
    Note over DB: ✅ DynamoDB handles<br/>millions of writes/sec<br/>Conditional writes prevent<br/>double booking

    DB-->>Lambda: ✅ ~970 success + ~30 conflicts
    Note over Lambda: 30 users tried same parts<br/>→ Get "Part already taken"

    Lambda->>SQS: 970 notification messages
    Note over SQS: ✅ SQS: unlimited throughput<br/>Messages queued safely

    Lambda-->>Users: ✅ 970 users: "Part Reserved!"<br/>❌ 30 users: "Choose another part"

    Note over SQS,Worker: 📨 Background Processing (not blocking users)
    SQS->>Worker: Process 970 messages<br/>(batch of 10)
    Worker->>Worker: Send 970 push notifications<br/>(takes ~2 minutes)

    Note over Users,Worker: 💰 Total cost for 1000 requests: ~$0.01 (less than 1 cent!)
```

## ❄️ Cold Start Handling

```mermaid
graph TB
    subgraph ColdStart["❄️ Cold Start Problem"]
        direction TB
        CS1["Lambda is NOT running<br/>(idle for 15+ minutes)"]
        CS2["First request arrives"]
        CS3["Lambda needs to:<br/>1. Start container (~300ms)<br/>2. Load code (~200ms)<br/>3. Initialize (~500ms)"]
        CS4["⏱️ Total: 1-3 seconds delay"]
        CS5["Next requests: ~50-200ms ⚡"]

        CS1 --> CS2 --> CS3 --> CS4 --> CS5
    end

    subgraph Solutions["✅ Solutions"]
        direction TB
        S1["🔥 Keep Warm (FREE) ✅<br/>EventBridge pings Lambda<br/>every 5 minutes<br/>Lambda stays 'warm'"]
        S2["📦 Small Code Size ✅<br/>8 small Lambdas<br/>instead of 1 big Lambda<br/>= faster cold start"]
        S3["💰 Provisioned Concurrency<br/>(~$15/month per instance)<br/>Reserved warm instances<br/>Only if needed later"]
    end

    ColdStart --> Solutions

    style ColdStart fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    style Solutions fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
```

## 💰 Cost Comparison

```mermaid
graph LR
    subgraph Serverless["☁️ Serverless (Our Choice) ✅"]
        direction TB
        SC1["📊 Low Traffic: ~$5/month"]
        SC2["📊 Medium Traffic: ~$20/month"]
        SC3["📊 High Traffic (Ramadan): ~$100/month"]
        SC4["📊 No Traffic: ~$1/month"]
        SC5["🎯 Pay only for what you use!"]
    end

    subgraph Traditional["🖥️ Traditional Server (EC2)"]
        direction TB
        TC1["📊 Low Traffic: ~$30/month"]
        TC2["📊 Medium Traffic: ~$60/month"]
        TC3["📊 High Traffic: ~$200+/month"]
        TC4["📊 No Traffic: ~$30/month 💸"]
        TC5["❌ Pay 24/7 even when idle"]
    end

    style Serverless fill:#E8F5E9,stroke:#2E7D32,stroke-width:3px
    style Traditional fill:#FFCDD2,stroke:#C62828,stroke-width:2px
```

## 📊 Auto-Scaling Timeline (Ramadan Example)

```mermaid
gantt
    title 📊 Khatma App - Traffic & Cost Over 12 Months
    dateFormat  YYYY-MM
    axisFormat  %b

    section Traffic Level
    Low Traffic (~$5/mo)      :a1, 2026-01, 2026-02
    Ramadan Ramp-up (~$30/mo) :a2, 2026-03, 2026-03
    Ramadan Peak (~$100/mo)   :crit, a3, 2026-03, 2026-04
    Post-Ramadan (~$10/mo)    :a4, 2026-04, 2026-05
    Normal (~$5/mo)           :a5, 2026-05, 2026-09
    Hajj Season (~$30/mo)     :a6, 2026-06, 2026-06
    Normal (~$5/mo)           :a7, 2026-07, 2026-12

    section Server Scaling
    5 Lambda instances        :b1, 2026-01, 2026-02
    50 Lambda instances       :b2, 2026-03, 2026-03
    500 Lambda instances      :crit, b3, 2026-03, 2026-04
    20 Lambda instances       :b4, 2026-04, 2026-05
    5 Lambda instances        :b5, 2026-05, 2026-12
```

