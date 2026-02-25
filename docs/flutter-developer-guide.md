# 📱 Khatma App - Flutter Developer Guide

> This file contains everything the Flutter Developer needs to build the app

---

## 📋 Project Overview

The **Khatma** app allows users to create Quran completion groups (Khatmas) and share them with others.
The Quran consists of 30 parts (Juz); each user selects a part and reads it.

---

## 🔧 Tech Stack (Mobile Side)

| Technology | Usage |
|-----------|-------|
| Flutter | Mobile Framework |
| Firebase Auth | Authentication (Google, Facebook, Apple, Phone) |
| Firebase Cloud Messaging | Push Notifications |
| Firebase Dynamic Links | Deep Linking / Share Links |
| Dio / http | HTTP Client for API calls |

---

## 🌍 Languages (i18n)

The app must support 4 languages:
- 🇸🇦 Arabic (ar) - RTL
- 🇬🇧 English (en) - LTR
- 🇵🇰 Urdu (ur) - RTL
- 🇮🇳 Hindi (hi) - LTR

---

## 🔐 Authentication Setup

### Firebase Auth Providers to Enable:
1. **Google Sign-In**
2. **Facebook Login**
3. **Apple Sign-In** (iOS required)
4. **Phone Number** (OTP verification)

### Auth Flow:
```
1. User logs in via Firebase Auth (any provider)
2. Firebase returns a JWT Token (idToken)
3. Every API call must include this token in the header:
   Authorization: Bearer <firebase_id_token>
4. After login, call POST /auth/sync to sync user data with backend
```

### Getting Firebase Token in Flutter:
```dart
import 'package:firebase_auth/firebase_auth.dart';

Future<String?> getToken() async {
  final user = FirebaseAuth.instance.currentUser;
  if (user != null) {
    return await user.getIdToken();
  }
  return null;
}
```

### API Header Setup:
```dart
// Every API call must include this header
final headers = {
  'Authorization': 'Bearer ${await getToken()}',
  'Content-Type': 'application/json',
  'Accept-Language': 'ar', // or 'en', 'ur', 'hi'
};
```

---

## 🌐 API Base URL

```
Development: https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev
Production:  https://api.khatma.com  (will be set up later)
```

> ⚠️ Base URL will be provided once backend is deployed

---

## 📱 Screens & Their APIs

### Screen 1: Login
```
📱 Screen: Login Page
├── Button: Facebook Login  → Firebase Auth
├── Button: Google Login    → Firebase Auth
├── Button: Apple Login     → Firebase Auth
├── Button: Phone Number    → Navigate to Phone Registration
└── Button: Register Now    → Navigate to Phone Registration
```

### Screen 2: Phone Registration
```
📱 Screen: Phone Registration
├── Input: Country Code (dropdown)
├── Input: Mobile Number
├── Input: Password
└── Button: Send OTP → Firebase Phone Auth
    └── Screen: OTP Verification
        ├── Input: 6-digit OTP
        ├── Button: Verify OTP → Firebase verifyOTP
        └── Button: Resend OTP (with 60 sec timer)
```

### Screen 3: Home Page
```
📱 Screen: Home Page
│
│  API: GET /home
│  Response: { banners, mySummary }
│
├── 🖼️ Banners Slider (horizontal scroll)
│
├── 📊 Summary of My Chapters
│     ├── "Chapter One (Shared in 3 Khatmas) ✅ Done"
│     ├── "Chapter Two (Shared in 2 Khatmas) 📖 Reading"
│     └── ...
│
├── Button: "Done All Chapters"
│     API: POST /home/mark-all-done
│
├── Button: "Show Khatmas"
│     → Navigate to Public Khatmas List
│
├── Button: "Khatmas"
│     → Navigate to Khatmas Page (3 tabs)
│
├── Button: "New Khatma" (+)
│     → Navigate to Create Khatma
│
├── Icon: Notifications (🔔)
│     → Navigate to Notifications Page
│
└── Icon: Settings (⚙️)
      → Navigate to Settings Page
```

### Screen 4: Public Khatmas List
```
📱 Screen: Public Khatmas
│
│  API: GET /khatmas?type=public&status=active
│
├── Card: Khatma 1
│     ├── Name
│     ├── Intention
│     └── Button: "Remaining Chapters"
│           → Navigate to Select Chapters
│
├── Card: Khatma 2
│     └── ...
```

### Screen 5: Khatmas Page (3 Tabs)
```
📱 Screen: Khatmas Page
│
├── Tab 1: "Invited To"
│     API: GET /khatmas?type=invited
│     └── Card:
│           ├── Name
│           ├── Intention
│           ├── Banner/Image
│           ├── Selected Chapters (my chapters in this khatma)
│           └── Button: "Add Extra Chapter"
│
├── Tab 2: "My Khatmas" (created by me)
│     API: GET /khatmas?type=mine
│     └── Card:
│           ├── Name
│           ├── Intention
│           ├── Banner/Image
│           ├── Selected Chapters
│           └── Button: "Add Extra Chapter"
│
└── Tab 3: "Public Khatmas" (not invited to)
      API: GET /khatmas?type=public
      └── Card:
            ├── Available Chapters count
            └── Button: "Join" → Select Chapters
```

### Screen 6: Select Chapters
```
📱 Screen: Select Chapters
│
│  API: GET /khatmas/{khatmaId}
│  → Returns all 30 parts with their status
│
├── Grid/List of 30 Chapters
│     ├── 🟢 Green = Available (can select)
│     ├── ⬜ Gray = Reserved (someone else took it)
│     └── 🟡 Gold = Completed (done reading)
│
├── User taps to select available chapters
│
└── Button: "Select Chapters"
      API: POST /khatmas/{khatmaId}/parts/reserve
      Body: { "partNumbers": [3, 7, 15] }
```

### Screen 7: Single Khatma Page
```
📱 Screen: Single Khatma Details
│
│  API: GET /khatmas/{khatmaId}
│
├── 📝 Khatma Name
├── 💭 Intention
├── 🔗 Share Link
├── 📤 Share Button (native share sheet)
│
├── 👥 All Participants List
│     ├── 👤 Ahmed - Chapter 1 ✅ Done
│     ├── 👤 Mohamed - Chapter 2 📖 Reading
│     └── 👤 Sara - Chapter 5 ✅ Done
│
└── Progress Bar (12/30 completed)
```

### Screen 8: Create New Khatma
```
📱 Screen: New Khatma
│
├── Input: Intention (text)
├── Input: Name (text)
├── Dropdown: Khatma Type
│     API: GET /config → returns khatmaTypes
│
├── Radio: Type
│     ├── 🔒 Private (show only for me)
│     ├── ✉️ By Invitation (me + invited only)
│     └── 🌍 Public (anyone can join)
│
├── IF "By Invitation" selected:
│     └── Input: Add friend emails (chips/tags input)
│
├── Button: "Create Khatma"
│     API: POST /khatmas
│     Body: {
│       "name": "...",
│       "intention": "...",
│       "type": "public|private|by_invitation",
│       "khatmaTypeId": "type_xxx",
│       "invitedEmails": ["friend@email.com"]  // only for by_invitation
│     }
│
└── After creation: Show share button
      → Native share with deep link
```

### Screen 9: Notifications
```
📱 Screen: Notifications
│
│  API: GET /notifications
│
├── Notification Card:
│     ├── 👤 Icon/Avatar
│     ├── 📝 Text/Body
│     │     Examples:
│     │     - "You have been invited to join the Khatma dedicated to the soul of her father"
│     │     - "You have been invited to complete her Khatma"
│     │     - "Dear ones, your reading portion is still waiting for you..."
│     │     - "A week has passed without reading in the Mercy Khatma..."
│     │     - "Your portion is still waiting for you, you can resume where you left off"
│     │
│     ├── IF invitation type:
│     │     ├── Button: "Join Now" → Accept invitation
│     │     └── Button: "Skip" → Decline invitation
│     │
│     └── Tap → Navigate to related Khatma
│
│  Mark as read:
│  API: POST /notifications/{id}/read
```

### Screen 10: Settings
```
📱 Screen: Settings
│
├── 🌍 Language Selection
│     ├── 🇸🇦 Arabic
│     ├── 🇬🇧 English
│     ├── 🇵🇰 Urdu
│     └── 🇮🇳 Hindi
│     → Save locally + API: PUT /auth/me { "language": "ar" }
│
├── ⏰ Daily Reminder
│     ├── Toggle: Enable/Disable
│     └── Time Picker: Select reminder time
│     → API: PUT /settings/reminder
│     → Body: { "reminderTime": "08:00", "isEnabled": true }
│
├── 👤 Edit Profile
│     → API: PUT /auth/me
│
└── 🚪 Logout
      → Firebase Auth signOut
```

---

## 🌐 API Reference

### Base Headers (for ALL requests):
```
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
Accept-Language: ar  (or en, ur, hi)
```

---

### 🔐 Auth APIs

#### POST /auth/sync
Call this after every login to sync user data with backend.
```json
// Request Body:
{
  "fcmToken": "firebase_cloud_messaging_token",
  "language": "ar",
  "displayName": "Ahmed Mohamed",
  "photoUrl": "https://..."
}

// Response 200:
{
  "success": true,
  "data": {
    "userId": "firebase_uid",
    "email": "user@email.com",
    "displayName": "Ahmed Mohamed",
    "language": "ar",
    "role": "user",
    "createdAt": "2026-02-18T10:00:00Z"
  }
}
```

#### GET /auth/me
```json
// Response 200:
{
  "success": true,
  "data": {
    "userId": "firebase_uid",
    "email": "user@email.com",
    "displayName": "Ahmed Mohamed",
    "photoUrl": "https://...",
    "language": "ar",
    "role": "user"
  }
}
```

#### PUT /auth/me
```json
// Request Body:
{
  "displayName": "New Name",
  "language": "en"
}

// Response 200:
{
  "success": true,
  "data": { ...updated user }
}
```

---

### 🏠 Home APIs

#### GET /home
```json
// Response 200:
{
  "success": true,
  "data": {
    "banners": [
      {
        "bannerId": "b1",
        "title": "Ramadan Kareem",
        "imageUrl": "https://cdn.khatma.com/banners/ramadan.jpg",
        "linkUrl": "https://..."
      }
    ],
    "mySummary": {
      "chapters": [
        {
          "partNumber": 1,
          "partName": "Part One",
          "sharedInCount": 3,
          "khatmaNames": ["Al-Rahma", "Al-Farah", "Al-Shifa"],
          "status": "completed"
        },
        {
          "partNumber": 2,
          "partName": "Part Two",
          "sharedInCount": 2,
          "khatmaNames": ["Al-Rahma", "Al-Farah"],
          "status": "reading"
        }
      ],
      "totalReading": 5,
      "totalCompleted": 3
    }
  }
}
```

#### POST /home/mark-all-done
```json
// Request Body: (empty)

// Response 200:
{
  "success": true,
  "message": "All chapters marked as done",
  "data": {
    "markedCount": 5
  }
}
```

---

### 📖 Khatma APIs

#### POST /khatmas
```json
// Request Body:
{
  "name": "Mercy Khatma",
  "intention": "For the soul of her father",
  "type": "by_invitation",
  "khatmaTypeId": "type_ramadan",
  "invitedEmails": ["friend1@email.com", "friend2@email.com"]
}

// Response 201:
{
  "success": true,
  "data": {
    "khatmaId": "kh_abc123",
    "name": "Mercy Khatma",
    "intention": "For the soul of her father",
    "type": "by_invitation",
    "status": "active",
    "totalParts": 30,
    "completedParts": 0,
    "shareLink": "https://app.khatma.com/join/kh_abc123",
    "createdAt": "2026-02-18T10:00:00Z"
  }
}
```

#### GET /khatmas?type={type}&status={status}
```
Query Parameters:
- type: "public" | "mine" | "invited"
- status: "active" | "completed" (optional, default: "active")
- page: 1 (optional, for pagination)
- limit: 20 (optional)
```
```json
// Response 200:
{
  "success": true,
  "data": {
    "khatmas": [
      {
        "khatmaId": "kh_abc123",
        "name": "Mercy Khatma",
        "intention": "For the soul of her father",
        "type": "public",
        "khatmaTypeName": "Ramadan",
        "status": "active",
        "totalParts": 30,
        "completedParts": 12,
        "availableParts": 10,
        "myParts": [
          { "partNumber": 1, "status": "completed" },
          { "partNumber": 5, "status": "reading" }
        ],
        "createdBy": "Ahmed Mohamed",
        "createdAt": "2026-02-18T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "hasMore": true
    }
  }
}
```

#### GET /khatmas/{khatmaId}
```json
// Response 200:
{
  "success": true,
  "data": {
    "khatmaId": "kh_abc123",
    "name": "Mercy Khatma",
    "intention": "For the soul of her father",
    "type": "public",
    "khatmaTypeName": "Ramadan",
    "status": "active",
    "totalParts": 30,
    "completedParts": 12,
    "shareLink": "https://app.khatma.com/join/kh_abc123",
    "createdBy": {
      "userId": "u1",
      "displayName": "Ahmed Mohamed"
    },
    "parts": [
      { "partNumber": 1, "status": "completed", "userName": "Ahmed", "userId": "u1" },
      { "partNumber": 2, "status": "reserved", "userName": "Mohamed", "userId": "u2" },
      { "partNumber": 3, "status": "available", "userName": null, "userId": null },
      { "partNumber": 4, "status": "available", "userName": null, "userId": null }
    ],
    "participants": [
      {
        "userId": "u1",
        "displayName": "Ahmed",
        "photoUrl": "https://...",
        "parts": [
          { "partNumber": 1, "status": "completed" },
          { "partNumber": 5, "status": "reserved" }
        ]
      }
    ],
    "createdAt": "2026-02-18T10:00:00Z"
  }
}
```

#### POST /khatmas/{khatmaId}/parts/reserve
```json
// Request Body:
{
  "partNumbers": [3, 7, 15]
}

// Response 200:
{
  "success": true,
  "data": {
    "reserved": [3, 7, 15],
    "failed": []
  }
}

// Response 409 (some parts already taken):
{
  "success": false,
  "error": "Some parts are no longer available",
  "data": {
    "reserved": [3, 15],
    "failed": [7]
  }
}
```

#### POST /khatmas/{khatmaId}/parts/complete
```json
// Request Body:
{
  "partNumbers": [3]
}

// Response 200:
{
  "success": true,
  "message": "Parts marked as completed",
  "data": {
    "completed": [3],
    "khatmaCompleted": false
  }
}

// If all 30 parts are now done:
{
  "success": true,
  "message": "Khatma completed! 🎉",
  "data": {
    "completed": [3],
    "khatmaCompleted": true
  }
}
```

#### POST /khatmas/{khatmaId}/parts/add-extra
```json
// Request Body:
{
  "partNumbers": [20]
}

// Response 200:
{
  "success": true,
  "data": {
    "reserved": [20]
  }
}
```

---

### ✉️ Invitation APIs

#### POST /khatmas/{khatmaId}/invite
```json
// Request Body:
{
  "emails": ["friend@email.com"]
}

// Response 200:
{
  "success": true,
  "data": {
    "sent": 1
  }
}
```

#### GET /invitations
```json
// Response 200:
{
  "success": true,
  "data": {
    "invitations": [
      {
        "invitationId": "inv_123",
        "khatmaId": "kh_abc123",
        "khatmaName": "Mercy Khatma",
        "intention": "For the soul of her father",
        "invitedBy": "Ahmed Mohamed",
        "status": "pending",
        "sentAt": "2026-02-18T10:00:00Z"
      }
    ]
  }
}
```

#### POST /invitations/{invitationId}/accept
```json
// Response 200:
{
  "success": true,
  "data": {
    "khatmaId": "kh_abc123",
    "message": "You have joined the Khatma!"
  }
}
```

#### POST /invitations/{invitationId}/decline
```json
// Response 200:
{
  "success": true,
  "message": "Invitation declined"
}
```

---

### 🔔 Notification APIs

#### GET /notifications
```json
// Response 200:
{
  "success": true,
  "data": {
    "notifications": [
      {
        "notificationId": "n1",
        "type": "invitation",
        "subType": "ramadan",
        "title": "New Invitation",
        "body": "You have been invited to join the Khatma dedicated to the soul of her father",
        "isRead": false,
        "actionType": "join_now",
        "actionId": "kh_abc123",
        "createdAt": "2026-02-18T10:00:00Z"
      },
      {
        "notificationId": "n2",
        "type": "motivational",
        "title": "Reminder",
        "body": "Your reading portion is still waiting for you, you can resume where you left off",
        "isRead": false,
        "actionType": "open_khatma",
        "actionId": "kh_abc123",
        "createdAt": "2026-02-18T08:00:00Z"
      }
    ],
    "unreadCount": 5
  }
}
```

#### POST /notifications/{notificationId}/read
```json
// Response 200:
{
  "success": true
}
```

#### POST /notifications/read-all
```json
// Response 200:
{
  "success": true,
  "data": {
    "markedCount": 5
  }
}
```

---

### ⚙️ Settings APIs

#### PUT /settings/reminder
```json
// Request Body:
{
  "reminderTime": "08:00",
  "isEnabled": true
}

// Response 200:
{
  "success": true,
  "data": {
    "reminderTime": "08:00",
    "isEnabled": true
  }
}
```

---

### 📱 App Config API

#### GET /config
```json
// Call this on app startup to get banners, khatma types, etc.

// Response 200:
{
  "success": true,
  "data": {
    "khatmaTypes": [
      {
        "typeId": "type_ramadan",
        "name": "Ramadan Khatma",
        "icon": "ramadan_icon",
        "isActive": true
      },
      {
        "typeId": "type_shifa",
        "name": "Healing Khatma",
        "icon": "shifa_icon",
        "isActive": true
      }
    ],
    "banners": [
      {
        "bannerId": "b1",
        "title": "Ramadan Kareem",
        "imageUrl": "https://cdn.khatma.com/banners/ramadan.jpg",
        "linkUrl": "https://..."
      }
    ]
  }
}
```

---

## 🔔 Push Notification Handling

### FCM Setup in Flutter:
```dart
// Handle notifications when app is in foreground
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // Show local notification or in-app banner
});

// Handle notification tap (app in background)
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  // Navigate to the relevant screen
  final type = message.data['type'];
  final khatmaId = message.data['khatmaId'];
  
  if (type == 'invitation') {
    // Navigate to invitation screen
  } else if (type == 'khatma_completed') {
    // Navigate to khatma details
  }
});
```

### Notification Data Structure:
```json
{
  "notification": {
    "title": "New Invitation",
    "body": "You have been invited to join the Mercy Khatma"
  },
  "data": {
    "type": "invitation",
    "khatmaId": "kh_abc123",
    "actionType": "join_now"
  }
}
```

---

## ❌ Error Response Format

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "PART_NOT_AVAILABLE",
    "message": "This part is no longer available"
  }
}
```

### Common Error Codes:
| Code | HTTP Status | Meaning |
|------|-------------|---------|
| UNAUTHORIZED | 401 | Invalid or expired token |
| FORBIDDEN | 403 | No permission |
| NOT_FOUND | 404 | Resource not found |
| PART_NOT_AVAILABLE | 409 | Part already reserved |
| VALIDATION_ERROR | 400 | Invalid input data |
| KHATMA_COMPLETED | 400 | Khatma already completed |
| ALREADY_JOINED | 400 | Already in this khatma |
| INTERNAL_ERROR | 500 | Server error |

---

## 🔗 Deep Linking

Share links format: `https://app.khatma.com/join/{khatmaId}`

When user opens this link:
1. If app installed → Open app directly to khatma page
2. If app NOT installed → Open App Store/Play Store

Use **Firebase Dynamic Links** for this.
