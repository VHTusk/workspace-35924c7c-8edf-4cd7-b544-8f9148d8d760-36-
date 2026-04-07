# V1 Mobile API Documentation

This directory contains versioned API endpoints specifically designed for mobile applications. All v1 endpoints are **IMMUTABLE** - their behavior and response structure will never change. For improvements or changes, create new v2 endpoints.

## Versioning Policy

### Immutability Guarantee
- All v1 endpoints are frozen and will maintain backward compatibility
- Response schemas are locked and will not be modified
- New fields may be added but existing fields will never be removed or changed
- Error codes and messages remain consistent

### Response Headers
All v1 responses include:
- `X-API-Version: v1` - API version identifier
- `X-API-Immutable: true` - Indicates immutability guarantee

### Version Lifecycle
1. **Active** - Current stable version
2. **Deprecated** - Still functional, migration recommended
3. **Sunset** - Limited availability, migration required
4. **Retired** - No longer available

---

## Authentication

All authenticated endpoints support two auth methods:

### Bearer Token (Mobile Apps)
```
Authorization: Bearer <session_token>
```

### Session Cookie (Web)
```
Cookie: session_token=<session_token>
```

---

## API Endpoints

### Authentication

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/auth/login` | POST | Login with email/phone and password | No |
| `/api/v1/auth/register` | POST | Create new account | No |
| `/api/v1/auth/logout` | POST | End session | Yes |
| `/api/v1/auth/refresh` | POST | Refresh session token | Yes |
| `/api/v1/auth/check` | GET | Check authentication status | Yes |
| `/api/v1/auth/csrf-token` | GET | Get CSRF token for state-changing requests | Yes |
| `/api/v1/auth/forgot-password` | POST | Request password reset or reset with token | No |

#### POST /api/v1/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "phone": "+919876543210",
  "password": "password123",
  "sport": "CORNHOLE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "session_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "sport": "CORNHOLE"
    },
    "expiresAt": "2025-01-15T00:00:00.000Z"
  },
  "meta": {
    "version": "v1",
    "timestamp": "2025-01-08T12:00:00.000Z"
  }
}
```

#### POST /api/v1/auth/refresh

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new_session_token",
    "expiresAt": "2025-01-22T00:00:00.000Z",
    "refreshed": true
  }
}
```

#### POST /api/v1/auth/forgot-password

**Step 1: Request Reset Token**

**Request:**
```json
{
  "email": "user@example.com",
  "phone": "+919876543210",
  "sport": "CORNHOLE",
  "action": "request"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email/phone, a reset token has been sent."
  }
}
```

**Step 2: Reset Password with Token**

**Request:**
```json
{
  "email": "user@example.com",
  "sport": "CORNHOLE",
  "action": "reset",
  "token": "reset_token_from_email",
  "newPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully. Please login with your new password."
  }
}
```

---

### Users

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/users/me` | GET | Current user profile (full details) | Yes |
| `/api/v1/users/me/profile` | PATCH | Update user profile | Yes |
| `/api/v1/users/me/notification-settings` | GET | Get notification settings | Yes |
| `/api/v1/users/me/notification-settings` | PUT | Update notification settings | Yes |
| `/api/v1/users/[id]` | GET | Public user profile | No |

#### GET /api/v1/users/me

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "phone": "+919876543210",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "sport": "CORNHOLE",
    "role": "PLAYER",
    "accountTier": "PRO",
    "location": {
      "city": "Mumbai",
      "district": "Mumbai City",
      "state": "Maharashtra",
      "address": "123 Main St",
      "pinCode": "400001"
    },
    "photoUrl": "https://...",
    "bio": "Competitive player",
    "gender": "MALE",
    "dateOfBirth": "1990-01-15T00:00:00.000Z",
    "verification": {
      "email": true,
      "phone": true,
      "overall": true
    },
    "preferences": {
      "language": "en",
      "profileVisibility": "PUBLIC",
      "showRealName": true,
      "showLocation": true,
      "showOnLeaderboard": true,
      "hideElo": false,
      "showPhone": false,
      "showEmail": false,
      "showTournamentHistory": true,
      "allowFriendRequestsFrom": "EVERYONE",
      "allowMessagesFrom": "EVERYONE"
    },
    "profession": {
      "type": "STUDENT",
      "showPublicly": true,
      "verified": false,
      "membershipNumber": null
    },
    "organization": null,
    "stats": {
      "matchesPlayed": 48,
      "tournaments": 12,
      "followers": 25,
      "following": 10
    },
    "rating": {
      "sport": "CORNHOLE",
      "points": 1250,
      "elo": 1650,
      "tier": "GOLD",
      "wins": 32,
      "losses": 16,
      "winRate": 67,
      "currentStreak": 4,
      "bestStreak": 8
    },
    "subscription": null,
    "session": {
      "sport": "CORNHOLE",
      "accountType": "PLAYER",
      "expiresAt": "2025-01-15T00:00:00.000Z"
    },
    "memberSince": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PATCH /api/v1/users/me/profile

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Updated bio",
  "city": "Mumbai",
  "state": "Maharashtra",
  "showOnLeaderboard": true,
  "hideElo": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "bio": "Updated bio",
    "location": {
      "city": "Mumbai",
      "state": "Maharashtra"
    },
    "preferences": {
      "showOnLeaderboard": true,
      "hideElo": false
    },
    "updatedAt": "2025-01-08T12:00:00.000Z"
  }
}
```

#### GET /api/v1/users/me/notification-settings

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": {
      "matchResults": true,
      "tournamentUpdates": true,
      "rankChanges": true,
      "milestones": true,
      "weeklyDigest": true,
      "announcements": true,
      "promotional": true,
      "quietHours": null,
      "digestMode": false,
      "digestFrequency": "daily"
    },
    "push": {
      "matchResults": true,
      "tournamentUpdates": true,
      "rankChanges": true,
      "milestones": true,
      "announcements": true,
      "quietHours": {
        "start": 22,
        "end": 8,
        "timezone": "Asia/Kolkata"
      }
    },
    "sport": "CORNHOLE"
  }
}
```

#### PUT /api/v1/users/me/notification-settings

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request:**
```json
{
  "type": "email",
  "settings": {
    "matchResults": true,
    "tournamentUpdates": true,
    "quietHoursStart": 22,
    "quietHoursEnd": 8
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "email",
    "updated": true,
    "settings": {
      "matchResults": true,
      "tournamentUpdates": true,
      "rankChanges": true,
      "milestones": true,
      "announcements": true
    }
  }
}
```

#### GET /api/v1/users/[id]

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "name": "John Doe",
    "photoUrl": "https://...",
    "bio": "Player bio",
    "location": {
      "city": "Mumbai",
      "state": "Maharashtra"
    },
    "sport": "CORNHOLE",
    "verified": true,
    "profession": {
      "type": "STUDENT",
      "verified": false
    },
    "stats": {
      "matchesPlayed": 48,
      "tournaments": 12,
      "followers": 25,
      "following": 10
    },
    "rating": {
      "points": 1250,
      "elo": 1650,
      "tier": "GOLD",
      "wins": 32,
      "losses": 16,
      "winRate": 67
    },
    "memberSince": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### Notifications

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/notifications` | GET | List notifications with cursor pagination | Yes |
| `/api/v1/notifications/[id]/read` | POST | Mark notification as read | Yes |

#### GET /api/v1/notifications

**Headers:**
```
Authorization: Bearer <session_token>
```

**Query Parameters:**
- `cursor` (string, optional) - Last notification ID from previous page
- `limit` (number, optional) - Results per page (default: 20, max: 50)
- `unreadOnly` (boolean, optional) - Only return unread notifications

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "notification_id",
      "type": "TOURNAMENT_REMINDER",
      "title": "Tournament Starting Soon",
      "message": "City Championship starts in 1 hour",
      "isRead": false,
      "readAt": null,
      "data": {
        "tournamentId": "tournament_id"
      },
      "createdAt": "2025-01-08T11:00:00.000Z"
    }
  ],
  "meta": {
    "nextCursor": "next_notification_id",
    "hasMore": false,
    "unreadCount": 5,
    "limit": 20
  }
}
```

#### POST /api/v1/notifications/[id]/read

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "notification_id",
    "isRead": true,
    "readAt": "2025-01-08T12:00:00.000Z"
  }
}
```

---

### Conversations

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/conversations` | GET | List conversations with cursor pagination | Yes |
| `/api/v1/conversations` | POST | Create new conversation | Yes |
| `/api/v1/conversations/[id]/messages` | GET | Get messages for a conversation | Yes |
| `/api/v1/conversations/[id]/messages` | POST | Send a message in a conversation | Yes |

#### GET /api/v1/conversations

**Headers:**
```
Authorization: Bearer <session_token>
```

**Query Parameters:**
- `cursor` (string, optional) - Last conversation ID from previous page
- `limit` (number, optional) - Results per page (default: 20, max: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conversation_id",
      "type": "direct",
      "name": null,
      "participants": [
        {
          "id": "user_id_1",
          "name": "John Doe",
          "photoUrl": "https://..."
        },
        {
          "id": "user_id_2",
          "name": "Jane Smith",
          "photoUrl": "https://..."
        }
      ],
      "lastMessage": {
        "id": "message_id",
        "content": "Hello!",
        "sender": {
          "id": "user_id_1",
          "name": "John Doe"
        },
        "createdAt": "2025-01-08T12:00:00.000Z"
      },
      "unreadCount": 2,
      "updatedAt": "2025-01-08T12:00:00.000Z"
    }
  ],
  "meta": {
    "nextCursor": null,
    "hasMore": false,
    "limit": 20
  }
}
```

#### POST /api/v1/conversations

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request:**
```json
{
  "participantIds": ["user_id_2"],
  "type": "direct",
  "initialMessage": "Hello! I'd like to connect."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conversation_id",
    "type": "direct",
    "participants": [
      {
        "id": "user_id_1",
        "name": "John Doe",
        "photoUrl": "https://..."
      },
      {
        "id": "user_id_2",
        "name": "Jane Smith",
        "photoUrl": "https://..."
      }
    ],
    "isNew": true
  }
}
```

#### GET /api/v1/conversations/[id]/messages

**Headers:**
```
Authorization: Bearer <session_token>
```

**Query Parameters:**
- `cursor` (string, optional) - Last message ID from previous page
- `limit` (number, optional) - Results per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "message_id",
      "content": "Hello!",
      "sender": {
        "id": "user_id_1",
        "name": "John Doe",
        "photoUrl": "https://..."
      },
      "createdAt": "2025-01-08T12:00:00.000Z",
      "isOwn": true
    }
  ],
  "meta": {
    "nextCursor": null,
    "hasMore": false,
    "limit": 50
  }
}
```

#### POST /api/v1/conversations/[id]/messages

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request:**
```json
{
  "content": "Hello! How are you?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "message_id",
    "content": "Hello! How are you?",
    "sender": {
      "id": "user_id",
      "name": "John Doe",
      "photoUrl": "https://..."
    },
    "createdAt": "2025-01-08T12:00:00.000Z",
    "isOwn": true
  }
}
```

---

### Players

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/players/me` | GET | Current player profile | Yes |
| `/api/v1/players/me/stats` | GET | Player statistics | Yes |
| `/api/v1/players/me/matches` | GET | Player match history | Yes |
| `/api/v1/players/me/tournaments` | GET | Player tournament history | Yes |
| `/api/v1/players/[id]` | GET | Public player profile | No |

#### GET /api/v1/players/me/stats

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "points": {
      "current": 1250,
      "elo": 1650,
      "tier": "GOLD",
      "tierProgress": 75
    },
    "rank": {
      "current": 42,
      "total": 1500,
      "percentile": 97
    },
    "matches": {
      "played": 48,
      "wins": 32,
      "losses": 16,
      "winRate": 67,
      "total": 50
    },
    "tournaments": {
      "played": 12,
      "wins": 3,
      "podiums": 5
    },
    "streaks": {
      "current": 4,
      "best": 8
    },
    "form": ["W", "W", "L", "W", "W"]
  },
  "meta": {
    "version": "v1",
    "timestamp": "2025-01-08T12:00:00.000Z"
  }
}
```

#### GET /api/v1/players/me/matches

**Query Parameters:**
- `cursor` (string, optional) - Last match ID from previous page
- `limit` (number, optional) - Results per page (default: 20, max: 50)
- `result` (string, optional) - Filter: "WIN" or "LOSS"
- `status` (string, optional) - Filter: "COMPLETED", "IN_PROGRESS", "PENDING"

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "match_id",
      "tournament": {
        "id": "tournament_id",
        "name": "City Championship",
        "scope": "DISTRICT"
      },
      "opponent": {
        "id": "opponent_id",
        "name": "Jane Smith",
        "photoUrl": "https://..."
      },
      "result": "WIN",
      "score": {
        "player": 21,
        "opponent": 15,
        "display": "21-15"
      },
      "pointsEarned": 4,
      "eloChange": 12,
      "status": "COMPLETED",
      "playedAt": "2025-01-05T14:30:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "next_match_id",
    "hasMore": true,
    "limit": 20
  }
}
```

#### GET /api/v1/players/me/tournaments

**Query Parameters:**
- `cursor` (string, optional) - Last tournament ID from previous page
- `limit` (number, optional) - Results per page (default: 20, max: 50)
- `status` (string, optional) - Filter: "UPCOMING", "IN_PROGRESS", "COMPLETED"

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tournament_id",
      "registrationId": "reg_id",
      "name": "City Championship",
      "type": "INDIVIDUAL",
      "scope": "DISTRICT",
      "location": {
        "city": "Mumbai",
        "state": "Maharashtra"
      },
      "dates": {
        "start": "2025-01-15T00:00:00.000Z",
        "end": "2025-01-17T00:00:00.000Z"
      },
      "status": "IN_PROGRESS",
      "registrationStatus": "CONFIRMED",
      "bannerImage": "https://...",
      "prize": {
        "pool": 10000,
        "won": null
      },
      "entryFee": 500,
      "participants": {
        "current": 48,
        "max": 64
      },
      "result": null,
      "registeredAt": "2025-01-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "next_tournament_id",
    "hasMore": false,
    "limit": 20
  }
}
```

#### GET /api/v1/matches/[id]

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "match_id",
    "sport": "CORNHOLE",
    "status": "COMPLETED",
    "tournament": {
      "id": "tournament_id",
      "name": "City Championship",
      "scope": "DISTRICT",
      "status": "IN_PROGRESS",
      "location": {
        "city": "Mumbai",
        "state": "Maharashtra",
        "venue": "Sports Complex"
      }
    },
    "players": {
      "playerA": {
        "id": "player_a_id",
        "name": "John Doe",
        "photoUrl": "https://...",
        "elo": 1650,
        "points": 1250
      },
      "playerB": {
        "id": "player_b_id",
        "name": "Jane Smith",
        "photoUrl": "https://...",
        "elo": 1580,
        "points": 1100
      }
    },
    "score": {
      "playerA": 21,
      "playerB": 15,
      "display": "21-15"
    },
    "result": {
      "winnerId": "player_a_id",
      "winner": {
        "id": "player_a_id",
        "name": "John Doe"
      },
      "outcome": "PLAYED"
    },
    "rating": {
      "eloChangeA": 12,
      "eloChangeB": -12,
      "pointsA": 4,
      "pointsB": 1
    },
    "schedule": {
      "scheduledTime": "2025-01-15T14:00:00.000Z",
      "playedAt": "2025-01-15T14:05:00.000Z"
    },
    "venue": {
      "court": "Court 1"
    },
    "bracket": {
      "roundNumber": 2,
      "matchNumber": 5,
      "status": "COMPLETED"
    },
    "verificationStatus": "VERIFIED",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T14:30:00.000Z"
  }
}
```

#### GET /api/v1/matches/[id]/checkin

**Response:**
```json
{
  "success": true,
  "data": {
    "match": {
      "id": "match_id",
      "tournament": {
        "id": "tournament_id",
        "name": "City Championship"
      },
      "playerA": {
        "id": "player_a_id",
        "name": "John Doe"
      },
      "playerB": {
        "id": "player_b_id",
        "name": "Jane Smith"
      },
      "scheduledTime": "2025-01-15T14:00:00.000Z"
    },
    "checkIns": [
      {
        "id": "checkin_id",
        "player": {
          "id": "player_a_id",
          "name": "John Doe"
        },
        "status": "CHECKED_IN",
        "checkedInAt": "2025-01-15T13:50:00.000Z",
        "gracePeriodEnds": null,
        "extensionCount": 0
      }
    ],
    "readiness": {
      "playerA": true,
      "playerB": false,
      "bothReady": false
    },
    "courtAssignment": {
      "courtId": "court_1",
      "courtName": "Court 1",
      "assignedAt": "2025-01-15T13:55:00.000Z"
    }
  }
}
```

#### POST /api/v1/matches/[id]/checkin

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request (optional):**
```json
{
  "courtId": "court_1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "checkIn": {
      "id": "checkin_id",
      "status": "CHECKED_IN",
      "checkedInAt": "2025-01-15T13:50:00.000Z"
    },
    "matchReadiness": {
      "playerA": true,
      "playerB": false,
      "bothReady": false
    },
    "message": "Checked in successfully"
  }
}
```

---

### Tournaments

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/tournaments` | GET | List tournaments | No |
| `/api/v1/tournaments/[id]` | GET | Tournament details | No |
| `/api/v1/tournaments/[id]/register` | POST | Register for tournament | Yes |
| `/api/v1/tournaments/[id]/unregister` | POST | Cancel tournament registration | Yes |
| `/api/v1/tournaments/[id]/checkin` | GET | Get check-in status | No |
| `/api/v1/tournaments/[id]/checkin` | POST | Check-in to tournament | Yes |
| `/api/v1/tournaments/[id]/checkin` | DELETE | Cancel check-in | Yes |

#### GET /api/v1/tournaments

**Query Parameters:**
- `sport` (string, required) - "CORNHOLE" or "DARTS"
- `status` (string, optional) - Tournament status filter
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Results per page (default: 20, max: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tournament_id",
      "name": "City Championship",
      "type": "INDIVIDUAL",
      "scope": "DISTRICT",
      "location": {
        "city": "Mumbai",
        "state": "Maharashtra"
      },
      "dates": {
        "start": "2025-01-15T00:00:00.000Z",
        "end": "2025-01-17T00:00:00.000Z",
        "registrationDeadline": "2025-01-12T00:00:00.000Z"
      },
      "prizePool": 10000,
      "maxPlayers": 64,
      "entryFee": 500,
      "status": "REGISTRATION_OPEN",
      "bannerImage": "https://...",
      "registrations": 32
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasMore": true
  }
}
```

#### POST /api/v1/tournaments/[id]/register

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request (optional):**
```json
{
  "idempotencyKey": "client-generated-key"
}
```

**Response (Free Tournament):**
```json
{
  "success": true,
  "data": {
    "registrationId": "reg_id",
    "status": "CONFIRMED",
    "tournamentName": "Free Tournament",
    "amount": 0
  }
}
```

**Response (Paid Tournament):**
```json
{
  "success": true,
  "data": {
    "requiresPayment": true,
    "registrationId": "reg_id",
    "order": {
      "id": "order_xyz",
      "amount": 50000,
      "currency": "INR"
    },
    "payer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210"
    },
    "keyId": "rzp_key",
    "amount": 500,
    "amountDisplay": "₹500"
  }
}
```

#### POST /api/v1/tournaments/[id]/unregister

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "registrationId": "reg_id",
    "status": "CANCELLED",
    "tournamentName": "City Championship",
    "refunded": false,
    "refundAmount": null,
    "refundStatus": null,
    "cancelledAt": "2025-01-08T12:00:00.000Z"
  }
}
```

**Response (Paid Tournament with Refund Pending):**
```json
{
  "success": true,
  "data": {
    "registrationId": "reg_id",
    "status": "CANCELLED",
    "tournamentName": "City Championship",
    "refunded": false,
    "refundAmount": 500,
    "refundStatus": "PENDING",
    "cancelledAt": "2025-01-08T12:00:00.000Z"
  }
}
```

---

### Matches

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/matches/live` | GET | Live, upcoming, and recent matches | No |
| `/api/v1/matches/[id]` | GET | Match details by ID | No |
| `/api/v1/matches/[id]/checkin` | GET | Get check-in status for match | No |
| `/api/v1/matches/[id]/checkin` | POST | Player self check-in | Yes |

#### GET /api/v1/matches/live

**Query Parameters:**
- `sport` (string, required) - "CORNHOLE" or "DARTS"
- `tournamentId` (string, optional) - Filter by tournament

**Response:**
```json
{
  "success": true,
  "data": {
    "live": [
      {
        "id": "match_id",
        "tournamentId": "tournament_id",
        "tournamentName": "City Championship",
        "roundNumber": 2,
        "matchNumber": 5,
        "playerA": {
          "id": "player_a_id",
          "name": "John Doe",
          "tier": "GOLD",
          "score": 15
        },
        "playerB": {
          "id": "player_b_id",
          "name": "Jane Smith",
          "tier": "SILVER",
          "score": 12
        },
        "court": "Court 1",
        "status": "IN_PROGRESS",
        "sport": "CORNHOLE",
        "updatedAt": "2025-01-08T14:30:00.000Z"
      }
    ],
    "upcoming": [],
    "recent": [],
    "tournaments": [
      {
        "id": "tournament_id",
        "name": "City Championship",
        "status": "IN_PROGRESS",
        "liveMatches": 3,
        "completedMatches": 12,
        "totalMatches": 32
      }
    ],
    "timestamp": "2025-01-08T14:30:00.000Z"
  }
}
```

---

### Payments

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/payments/create-order` | POST | Create payment order | Yes |
| `/api/v1/payments/verify` | POST | Verify payment | Yes |

#### POST /api/v1/payments/create-order

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request:**
```json
{
  "paymentType": "TOURNAMENT_ENTRY",
  "sport": "CORNHOLE",
  "tournamentId": "tournament_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order_xyz",
      "amount": 50000,
      "currency": "INR",
      "receipt": "RCPT_TOURNAMENT_ENTRY_1234567890_abc123"
    },
    "payer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210"
    },
    "keyId": "rzp_key",
    "amountDisplay": "₹500"
  }
}
```

#### POST /api/v1/payments/verify

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request:**
```json
{
  "razorpayOrderId": "order_xyz",
  "razorpayPaymentId": "pay_xyz",
  "razorpaySignature": "signature_hash",
  "paymentType": "TOURNAMENT_ENTRY",
  "sport": "CORNHOLE",
  "tournamentId": "tournament_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "pay_xyz",
      "amount": 50000,
      "status": "captured"
    },
    "message": "Tournament registration confirmed! You are now registered."
  }
}
```

---

### Leaderboard

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/leaderboard` | GET | Global leaderboard | No |

#### GET /api/v1/leaderboard

**Query Parameters:**
- `sport` (string, required) - "CORNHOLE" or "DARTS"
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Results per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "player": {
        "id": "player_id",
        "name": "Top Player",
        "city": "Mumbai",
        "state": "Maharashtra"
      },
      "stats": {
        "points": 2500,
        "elo": 2100,
        "tier": "DIAMOND",
        "wins": 150,
        "losses": 30,
        "winRate": 83,
        "matchesPlayed": 180
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1500,
    "totalPages": 30,
    "hasMore": true
  }
}
```

---

### Health

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/health` | GET | API health check | No |
| `/api/v1/health/ready` | GET | Readiness check | No |

#### GET /api/v1/health

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "v1"
  }
}
```

---

### API Info

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/info` | GET | API version information | No |

#### GET /api/v1/info

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "apiVersion": "v1",
    "supportedSports": ["CORNHOLE", "DARTS"],
    "features": {
      "cursorPagination": true,
      "idempotency": true,
      "bearerAuth": true
    }
  }
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "meta": {
    "version": "v1",
    "timestamp": "2025-01-08T12:00:00.000Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `INVALID_TOKEN` | 401 | Invalid or expired token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `NOT_FOUND` | 404 | Resource not found |
| `PLAYER_NOT_FOUND` | 404 | Player not found |
| `TOURNAMENT_NOT_FOUND` | 404 | Tournament not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Pagination

### Offset Pagination (List Endpoints)
Used for `/tournaments` and `/leaderboard`:
- `page` - Page number (1-indexed)
- `limit` - Items per page
- Response includes `pagination` object with `totalPages` and `hasMore`

### Cursor Pagination (Player Data)
Used for `/players/me/matches` and `/players/me/tournaments`:
- `cursor` - Last item ID from previous page
- `limit` - Items per page
- Response includes `nextCursor` and `hasMore`

**Advantages of Cursor Pagination:**
- Consistent results even with data changes
- Better performance for large datasets
- No "missing items" issue on concurrent requests

---

## Idempotency

For state-changing operations (like tournament registration), include an idempotency key:

```
X-Idempotency-Key: client-generated-unique-key
```

This ensures that retrying the same request returns the same result without creating duplicates.

---

## Rate Limiting

All endpoints are rate-limited. Rate limit information is returned in response headers:

- `X-RateLimit-Limit` - Maximum requests per window
- `X-RateLimit-Remaining` - Remaining requests in window
- `X-RateLimit-Reset` - Unix timestamp when limit resets

Default limits:
- General API: 100 requests/minute
- Auth endpoints: 5 requests/minute
- Registration: 10 requests/minute

---

## Mobile SDK Integration

### Swift (iOS)
```swift
let api = V1APIClient(baseURL: "https://api.example.com")
api.setBearerToken("session_token")
let profile = try await api.getProfile()
```

### Kotlin (Android)
```kotlin
val api = V1ApiClient(baseUrl = "https://api.example.com")
api.setBearerToken("session_token")
val profile = api.getProfile()
```

---

## Changelog

### v1.2.0 (2025-01-20)
- **New Endpoints:**
  - `GET /api/v1/matches/[id]` - Match details by ID
  - `GET /api/v1/matches/[id]/checkin` - Match check-in status
  - `POST /api/v1/matches/[id]/checkin` - Player self check-in
  - `GET /api/v1/tournaments/[id]/checkin` - Tournament check-in status
  - `POST /api/v1/tournaments/[id]/checkin` - Check-in to tournament
  - `DELETE /api/v1/tournaments/[id]/checkin` - Cancel tournament check-in
  - `GET /api/v1/users/me/notification-settings` - Get notification preferences
  - `PUT /api/v1/users/me/notification-settings` - Update notification preferences
  - `POST /api/v1/payments/create-order` - Create Razorpay payment order
  - `POST /api/v1/payments/verify` - Verify and complete payment
- **Improvements:**
  - Complete mobile-facing API coverage for tournaments, matches, and payments
  - Added check-in support for both matches and tournaments
  - Full notification settings management for mobile apps

### v1.1.0 (2025-01-09)
- **New Endpoints:**
  - `POST /api/v1/auth/forgot-password` - Password reset flow
  - `GET /api/v1/users/me` - Current user profile
  - `PATCH /api/v1/users/me/profile` - Update profile
  - `GET /api/v1/users/[id]` - Public user profile
  - `GET /api/v1/notifications` - List notifications (cursor pagination)
  - `POST /api/v1/notifications/[id]/read` - Mark notification as read
  - `GET /api/v1/conversations` - List conversations
  - `POST /api/v1/conversations` - Create conversation
  - `GET /api/v1/conversations/[id]/messages` - Get messages
  - `POST /api/v1/conversations/[id]/messages` - Send message
  - `POST /api/v1/tournaments/[id]/unregister` - Cancel registration

### v1.0.0 (2025-01-08)
- Initial v1 API release
- Authentication endpoints
- Player profile and stats
- Tournament listing and registration
- Live matches
- Leaderboard
