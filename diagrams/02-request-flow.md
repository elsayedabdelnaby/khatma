# 🔄 Khatma - Request Flow

> مسار الطلب من الموبايل للسيرفر والرد

## 1. Login + Create Khatma + Reserve Part

```mermaid
sequenceDiagram
    participant App as 📱 Flutter App
    participant FAuth as 🔥 Firebase Auth
    participant APIGW as 🌐 API Gateway
    participant Auth as 🔐 AuthorizerFn
    participant Lambda as ⚡ KhatmaFn
    participant DB as 🗄️ DynamoDB
    participant SQS as 📨 SQS Queue
    participant Worker as 📨 WorkerFn
    participant FCM as 🔔 FCM

    Note over App,FCM: 🔐 Login Flow
    App->>FAuth: 1. Login (Google/Facebook/Apple/Phone)
    FAuth-->>App: 2. Firebase Token (JWT)

    Note over App,FCM: 📖 Create Khatma Flow
    App->>APIGW: 3. POST /khatmas + Token
    APIGW->>Auth: 4. Verify Token
    Auth->>FAuth: 5. Validate JWT
    FAuth-->>Auth: 6. ✅ Valid (userId)
    Auth-->>APIGW: 7. ✅ Authorized
    APIGW->>Lambda: 8. Forward Request
    Lambda->>DB: 9. Create Khatma Record
    Lambda->>DB: 10. Create 30 Parts (available)
    Lambda->>SQS: 11. Queue Invitation Emails
    Lambda-->>App: 12. ✅ 201 Created

    Note over App,FCM: 📨 Background Processing
    SQS->>Worker: 13. Trigger (batch)
    Worker->>DB: 14. Get User FCM Token
    Worker->>FCM: 15. Send Push Notification
    FCM-->>App: 16. 🔔 Push Notification Received!
```

## 2. Reserve Part Flow (مع حماية Race Condition)

```mermaid
sequenceDiagram
    participant App as 📱 Flutter App
    participant APIGW as 🌐 API Gateway
    participant Auth as 🔐 AuthorizerFn
    participant Lambda as ⚡ KhatmaFn
    participant DB as 🗄️ DynamoDB
    participant SQS as 📨 SQS Queue

    Note over App,SQS: 📑 Reserve Part Flow
    App->>APIGW: POST /khatmas/{id}/parts/reserve
    APIGW->>Auth: Verify Token
    Auth-->>APIGW: ✅ OK
    APIGW->>Lambda: Forward Request

    Lambda->>DB: Conditional Write<br/>(IF status = available)

    alt ✅ Part Available
        DB-->>Lambda: ✅ Reserved Successfully
        Lambda->>SQS: Queue "Part Reserved" Notification
        Lambda-->>App: ✅ 200 Part Reserved!
    else ❌ Part Already Taken
        DB-->>Lambda: ❌ Condition Failed
        Lambda-->>App: ❌ 409 Part Not Available<br/>Choose Another Part
    end
```

## 3. Home Page Data Flow

```mermaid
sequenceDiagram
    participant App as 📱 Flutter App
    participant APIGW as 🌐 API Gateway
    participant Auth as 🔐 AuthorizerFn
    participant Lambda as ⚡ HomeFn
    participant DB as 🗄️ DynamoDB

    App->>APIGW: GET /home
    APIGW->>Auth: Verify Token
    Auth-->>APIGW: ✅ userId: user_abc123
    APIGW->>Lambda: Forward Request

    par Parallel Database Reads
        Lambda->>DB: 1. Get Active Banners
        Lambda->>DB: 2. Get My Khatma Parts
        Lambda->>DB: 3. Get My Khatmas
    end

    DB-->>Lambda: Banners Data
    DB-->>Lambda: My Parts Data
    DB-->>Lambda: My Khatmas Data

    Lambda-->>App: ✅ 200 Home Page Data<br/>{ banners, mySummary, ... }
```

## 4. Invitation Flow

```mermaid
sequenceDiagram
    participant Owner as 📱 Khatma Owner
    participant APIGW as 🌐 API Gateway
    participant Lambda as ⚡ KhatmaFn
    participant DB as 🗄️ DynamoDB
    participant SQS as 📨 SQS Queue
    participant Worker as 📨 WorkerFn
    participant SES as 📧 AWS SES
    participant FCM as 🔔 FCM
    participant Friend as 📱 Invited Friend

    Owner->>APIGW: POST /khatmas/{id}/invite<br/>{ emails: ["friend@email.com"] }
    APIGW->>Lambda: Forward
    Lambda->>DB: Save Invitation Record
    Lambda->>SQS: Queue Invitation
    Lambda-->>Owner: ✅ Invitation Sent!

    SQS->>Worker: Process Invitation
    Worker->>DB: Check if friend is registered

    alt Friend is Registered
        Worker->>DB: Get friend's FCM Token
        Worker->>FCM: Send Push Notification
        FCM-->>Friend: 🔔 "تمت دعوتك للمشاركة في ختمة الرحمة"
    else Friend Not Registered
        Worker->>SES: Send Email Invitation
        Note over SES,Friend: 📧 Email with App Download Link
    end

    Friend->>APIGW: POST /invitations/{id}/accept
    APIGW->>Lambda: Forward
    Lambda->>DB: Update Invitation Status = accepted
    Lambda->>SQS: Notify Owner
    Lambda-->>Friend: ✅ Joined Khatma!
```

