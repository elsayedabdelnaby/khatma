# 🏗️ Khatma - System Architecture

> الصورة الكاملة لبنية المشروع

```mermaid
graph TB
    subgraph Mobile["📱 Mobile App - Flutter"]
        UI["UI Screens"]
        FSDK["Firebase SDK"]
    end

    subgraph Firebase["🔥 Firebase"]
        FAuth["🔐 Firebase Auth<br/>(Google / Facebook / Apple / Phone OTP)"]
        FCM["🔔 FCM<br/>(Push Notifications)"]
    end

    subgraph AWS["☁️ AWS Cloud"]
        subgraph Gateway["🌐 API Gateway + WAF"]
            APIGW["REST API<br/>https://api.khatma.com"]
        end

        subgraph Auth["🔐 Security Layer"]
            AuthFn["⚡ AuthorizerFn<br/>(Firebase Token Verify)"]
        end

        subgraph Lambdas["⚡ Lambda Functions - 8 Total"]
            UserFn["👤 UserFn<br/>sync / profile"]
            KhatmaFn["📖 KhatmaFn<br/>CRUD / parts / invite"]
            HomeFn["🏠 HomeFn<br/>home data / mark done"]
            NotifFn["🔔 NotifFn<br/>list / read"]
            AdminFn["👑 AdminFn<br/>banners / types"]
        end

        subgraph Workers["📨 Background Workers"]
            WorkerFn["📨 WorkerFn<br/>(Notifications + Email)"]
            SchedulerFn["⏰ SchedulerFn<br/>(Daily Reminders)"]
        end

        subgraph Queue["📬 Message Queues - SQS"]
            SQS1["📨 NotificationsQueue"]
            SQS2["✉️ InvitationsQueue"]
            DLQ1["☠️ DLQ - Dead Letter Queue<br/>(Failed Messages)"]
        end

        subgraph Database["🗄️ DynamoDB Tables - 9 Tables"]
            UsersDB[("👤 Users")]
            KhatmasDB[("📖 Khatmas")]
            PartsDB[("📑 Parts")]
            InvitesDB[("✉️ Invitations")]
            TypesDB[("📋 Khatma Types")]
            BannersDB[("🖼️ Banners")]
            NotifsDB[("🔔 Notifications")]
            RemindersDB[("⏰ User Reminders")]
            NotifTypesDB[("📋 Notification Types")]
        end

        subgraph Storage["📦 S3 + CloudFront CDN"]
            S3Admin["🖥️ Admin Dashboard<br/>(Static Site ~$0.50/month)"]
            S3Images["🖼️ Banner Images"]
        end

        EventBridge["⏰ EventBridge<br/>(Cron Scheduler)"]
        SES["📧 AWS SES<br/>(Invitation Emails)"]
    end

    UI --> FSDK
    FSDK --> FAuth
    FSDK --> FCM
    UI --> APIGW

    APIGW --> AuthFn
    AuthFn --> UserFn
    AuthFn --> KhatmaFn
    AuthFn --> HomeFn
    AuthFn --> NotifFn
    AuthFn --> AdminFn

    UserFn --> UsersDB
    KhatmaFn --> KhatmasDB
    KhatmaFn --> PartsDB
    KhatmaFn --> InvitesDB
    HomeFn --> KhatmasDB
    HomeFn --> PartsDB
    HomeFn --> BannersDB
    NotifFn --> NotifsDB
    NotifFn --> RemindersDB
    AdminFn --> TypesDB
    AdminFn --> BannersDB
    AdminFn --> NotifTypesDB
    AdminFn --> S3Images

    KhatmaFn --> SQS1
    KhatmaFn --> SQS2
    SQS1 --> WorkerFn
    SQS2 --> WorkerFn
    SQS1 -.-> DLQ1
    SQS2 -.-> DLQ1

    WorkerFn --> FCM
    WorkerFn --> SES
    WorkerFn --> NotifsDB

    EventBridge --> SchedulerFn
    SchedulerFn --> RemindersDB
    SchedulerFn --> SQS1

    S3Admin --> APIGW

    style Mobile fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style Firebase fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    style AWS fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px
    style Gateway fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style Auth fill:#FCE4EC,stroke:#C62828,stroke-width:2px
    style Lambdas fill:#FFF9C4,stroke:#F57F17,stroke-width:2px
    style Workers fill:#E0F7FA,stroke:#00838F,stroke-width:2px
    style Queue fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px
    style Database fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style Storage fill:#FBE9E7,stroke:#BF360C,stroke-width:2px
```

## 📋 ملخص المكونات

| المكون | العدد | الوصف |
|--------|-------|-------|
| Lambda Functions | 8 | API + Workers + Scheduler |
| DynamoDB Tables | 9 | NoSQL Database |
| SQS Queues | 2 + 2 DLQ | Message Queues |
| S3 Buckets | 2 | Admin Dashboard + Images |
| Firebase | Auth + FCM | Login + Notifications |

