# 🔗 Khatma - Lambda Communication

> إزاي الـ Lambdas بتتواصل مع بعض (من غير ما تكلم بعض مباشرة)

## Communication Map

```mermaid
graph TB
    subgraph Client["📱 Mobile App"]
        App["Flutter App"]
    end

    subgraph APIGW["🌐 API Gateway"]
        GW["REST API Endpoint"]
    end

    subgraph APILambdas["⚡ API Lambdas - HTTP Triggered"]
        AuthFn["🔐 AuthorizerFn<br/>Verify Firebase Token"]
        UserFn["👤 UserFn<br/>POST /auth/sync<br/>GET /auth/me<br/>PUT /auth/me"]
        KhatmaFn["📖 KhatmaFn<br/>POST /khatmas<br/>GET /khatmas<br/>GET /khatmas/:id<br/>POST /parts/reserve<br/>POST /parts/complete<br/>POST /invite"]
        HomeFn["🏠 HomeFn<br/>GET /home<br/>POST /home/mark-all-done"]
        NotifFn["🔔 NotifFn<br/>GET /notifications<br/>POST /notifications/:id/read<br/>PUT /settings/reminder"]
        AdminFn["👑 AdminFn<br/>CRUD /admin/banners<br/>CRUD /admin/khatma-types<br/>CRUD /admin/notif-types"]
    end

    subgraph Queues["📬 SQS Queues - Message Broker"]
        NQ["📨 NotificationsQueue<br/>Push Notifications"]
        IQ["✉️ InvitationsQueue<br/>Email Invitations"]
        DLQ["☠️ Dead Letter Queue<br/>Failed Messages (retry 3x)"]
    end

    subgraph BGLambdas["⚡ Background Lambdas"]
        WorkerFn["📨 WorkerFn<br/>Process Notifications<br/>Process Invitations<br/>Send FCM + Email"]
        SchedulerFn["⏰ SchedulerFn<br/>Daily Reminders<br/>Weekly Inactivity Check"]
    end

    subgraph SharedDB["🗄️ DynamoDB - Shared Database"]
        DB[("📊 All 9 Tables<br/>Shared between all Lambdas")]
    end

    subgraph External["🌐 External Services"]
        FCM["🔔 Firebase FCM<br/>Push Notifications"]
        SES["📧 AWS SES<br/>Email Service"]
    end

    EB["⏰ EventBridge<br/>Cron: Every 15 min<br/>Cron: Weekly"]

    S3["📦 S3 + CloudFront<br/>Admin Dashboard<br/>Banner Images"]

    App --> GW
    GW --> AuthFn
    AuthFn -.->|"✅ Authorized"| UserFn
    AuthFn -.->|"✅ Authorized"| KhatmaFn
    AuthFn -.->|"✅ Authorized"| HomeFn
    AuthFn -.->|"✅ Authorized"| NotifFn
    AuthFn -.->|"✅ Authorized (Admin)"| AdminFn

    UserFn <-->|"read/write"| DB
    KhatmaFn <-->|"read/write"| DB
    HomeFn <-->|"read"| DB
    NotifFn <-->|"read/write"| DB
    AdminFn <-->|"read/write"| DB

    KhatmaFn -->|"📨 async message"| NQ
    KhatmaFn -->|"✉️ async message"| IQ
    AdminFn -->|"📨 async message"| NQ

    NQ -->|"⚡ trigger"| WorkerFn
    IQ -->|"⚡ trigger"| WorkerFn
    NQ -.->|"❌ failed 3x"| DLQ
    IQ -.->|"❌ failed 3x"| DLQ

    WorkerFn -->|"🔔 send push"| FCM
    WorkerFn -->|"📧 send email"| SES
    WorkerFn -->|"💾 save"| DB

    EB -->|"⏰ cron trigger"| SchedulerFn
    SchedulerFn -->|"📖 read"| DB
    SchedulerFn -->|"📨 queue"| NQ

    S3 -.->|"Admin Dashboard calls"| GW

    style Client fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style APIGW fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style APILambdas fill:#FFF9C4,stroke:#F57F17,stroke-width:2px
    style Queues fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px
    style BGLambdas fill:#E0F7FA,stroke:#00838F,stroke-width:2px
    style SharedDB fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style External fill:#FBE9E7,stroke:#BF360C,stroke-width:2px
```

## 🔗 3 Communication Patterns

### Pattern 1: Via SQS Queue (Async - الأساسي)

```mermaid
graph LR
    A["⚡ KhatmaFn<br/>(fast response)"] -->|"1. put message"| Q["📨 SQS Queue<br/>(holds message)"]
    Q -->|"2. auto-trigger"| B["📨 WorkerFn<br/>(process later)"]
    B -->|"3. send"| C["🔔 FCM / 📧 SES"]

    A -->|"instant response"| App["📱 App gets<br/>response immediately!"]

    style A fill:#FFF9C4,stroke:#F57F17
    style Q fill:#F3E5F5,stroke:#6A1B9A
    style B fill:#E0F7FA,stroke:#00838F
    style C fill:#FBE9E7,stroke:#BF360C
    style App fill:#E3F2FD,stroke:#1565C0
```

### Pattern 2: Via DynamoDB (Shared Data)

```mermaid
graph TB
    A["⚡ KhatmaFn<br/>writes khatma data"] -->|"write"| DB[("🗄️ DynamoDB<br/>Shared Database")]
    B["⚡ HomeFn<br/>reads khatma data"] -->|"read"| DB

    Note["💡 Lambdas share data through<br/>the database - NOT direct calls"]

    style A fill:#FFF9C4,stroke:#F57F17
    style B fill:#FFF9C4,stroke:#F57F17
    style DB fill:#E8F5E9,stroke:#2E7D32
```

### Pattern 3: Via EventBridge (Scheduled)

```mermaid
graph LR
    EB["⏰ EventBridge<br/>Cron Schedule"] -->|"trigger every 15 min"| S["⏰ SchedulerFn"]
    S -->|"read users with reminders"| DB[("🗄️ DynamoDB")]
    S -->|"queue notifications"| Q["📨 SQS Queue"]
    Q -->|"trigger"| W["📨 WorkerFn"]
    W -->|"send"| FCM["🔔 FCM"]

    style EB fill:#FCE4EC,stroke:#C62828
    style S fill:#E0F7FA,stroke:#00838F
    style DB fill:#E8F5E9,stroke:#2E7D32
    style Q fill:#F3E5F5,stroke:#6A1B9A
    style W fill:#E0F7FA,stroke:#00838F
    style FCM fill:#FBE9E7,stroke:#BF360C
```

## 🚫 القاعدة الذهبية

```mermaid
graph LR
    subgraph Wrong["❌ WRONG - Direct Lambda Call"]
        A1["⚡ Lambda A"] -->|"direct invoke"| B1["⚡ Lambda B"]
    end

    subgraph Right["✅ RIGHT - Via Queue"]
        A2["⚡ Lambda A"] -->|"message"| Q2["📨 SQS"] -->|"trigger"| B2["⚡ Lambda B"]
    end

    style Wrong fill:#FFCDD2,stroke:#C62828,stroke-width:2px
    style Right fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

### ليه؟
- ❌ Direct Call = لو Lambda B وقعت، Lambda A تقع معاها + بتدفع double
- ✅ Via Queue = لو Worker وقع، الرسالة محفوظة في Queue وتتعاد تلقائياً

