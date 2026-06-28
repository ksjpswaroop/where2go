# Where2Go API Endpoints

## API Principles

1. All provider and AI calls happen server-side.
2. Every request and response is validated with shared schemas.
3. Plan generation is deterministic except for AI parsing/explanation.
4. Anonymous users can generate limited plans; signed-in users can save profiles and history.
5. Every generated plan has a canonical share URL.
6. Error responses use a consistent envelope.

## Base URL

| Environment | URL |
|---|---|
| Local | `http://localhost:3000/api` |
| Preview | Vercel preview URL |
| Production | `https://where2go.app/api` |

## Auth

| Endpoint Class | Auth |
|---|---|
| Generate plan | Anonymous allowed with rate limits; authenticated preferred |
| Read shared plan | Public if share token is public |
| Save profile | Auth required |
| Save feedback | Anonymous allowed for current session; auth required for persistent history |
| Admin/provider health | Admin auth required |

## Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Budget must be a positive number.",
    "requestId": "req_123",
    "details": {}
  }
}
```

## MVP Endpoint Summary

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/plans/generate` | Generate Today's Best Plan and backups | Optional |
| `GET` | `/api/plans/{planId}` | Fetch a saved or shared plan | Depends on visibility |
| `POST` | `/api/plans/{planId}/feedback` | Capture accept/reject/save/attended feedback | Optional |
| `POST` | `/api/plans/{planId}/share` | Create or refresh share token | Optional/auth preferred |
| `GET` | `/api/share/{shareToken}` | Resolve public share link | Public |
| `GET` | `/api/profiles/me` | Fetch current user's family profile | Auth |
| `PUT` | `/api/profiles/me` | Upsert current user's family profile | Auth |
| `POST` | `/api/ai/parse-request` | Parse natural-language request into constraints | Internal/server only |
| `GET` | `/api/provider-health` | Provider status for admin/debug | Admin |

## `POST /api/plans/generate`

Generates a plan response for the given constraints.

### Request

```json
{
  "queryText": "Family outing today under $120, outdoors, home by 7 PM",
  "location": {
    "lat": 32.7767,
    "lng": -96.7970,
    "label": "Dallas, TX"
  },
  "date": "2026-07-04",
  "startTime": "2026-07-04T14:00:00-05:00",
  "homeByTime": "2026-07-04T19:00:00-05:00",
  "party": {
    "adults": 2,
    "kidsAges": [8, 11]
  },
  "budgetMax": 120,
  "driveTimeMaxMinutes": 30,
  "indoorOutdoorPreference": "outdoor",
  "mealNeeded": "dinner",
  "accessibilityNeeds": [],
  "interests": ["animals", "parks", "festivals"],
  "avoid": ["crowded bars"]
}
```

### Response

```json
{
  "requestId": "req_abc123",
  "planId": "plan_abc123",
  "generatedAt": "2026-07-04T14:02:12-05:00",
  "status": "ready",
  "bestPlan": {
    "title": "Afternoon at the Arboretum with dinner nearby",
    "planType": "place_plus_food",
    "summary": "Outdoor, kid-friendly, within budget, and home before 7 PM.",
    "estimatedTotalCost": {
      "min": 78,
      "max": 104,
      "currency": "USD"
    },
    "travel": {
      "totalDriveMinutes": 46,
      "driveLimitSatisfied": true
    },
    "timeline": [
      {
        "time": "2:20 PM",
        "label": "Leave home",
        "kind": "travel"
      },
      {
        "time": "2:50 PM",
        "label": "Arrive at Dallas Arboretum",
        "kind": "activity"
      }
    ],
    "stops": [],
    "actions": [
      {
        "type": "directions",
        "label": "Open directions",
        "url": "https://maps.google.com/..."
      }
    ],
    "whyThisPlan": {
      "headline": "Best fit for your family today",
      "reasons": [
        "Fits the 30-minute drive limit.",
        "Outdoor weather is favorable until early evening.",
        "Estimated total stays under $120."
      ],
      "caveats": []
    }
  },
  "alternatives": [
    {
      "kind": "cheaper",
      "title": "Neighborhood park and tacos",
      "estimatedTotalCost": {
        "min": 32,
        "max": 55,
        "currency": "USD"
      }
    },
    {
      "kind": "rain_or_low_effort",
      "title": "Science museum plus coffee stop",
      "estimatedTotalCost": {
        "min": 88,
        "max": 118,
        "currency": "USD"
      }
    }
  ],
  "debug": {
    "candidateCount": 42,
    "filteredCount": 19,
    "providerStatus": "partial"
  }
}
```

## `GET /api/plans/{planId}`

Fetches a stored plan.

### Response

Returns the same `PlanResponse` shape as generation, plus:

```json
{
  "visibility": "private",
  "ownerUserId": "user_123",
  "createdAt": "2026-07-04T14:02:12-05:00"
}
```

## `POST /api/plans/{planId}/feedback`

Captures learning signals.

### Request

```json
{
  "action": "rejected",
  "target": "bestPlan",
  "reason": "too_expensive",
  "freeText": "Looks fun but too much for today.",
  "attended": false
}
```

### Response

```json
{
  "feedbackId": "fb_123",
  "stored": true,
  "updatedPreferenceSignals": ["budget_sensitivity"]
}
```

## `POST /api/plans/{planId}/share`

Creates a public share token for the plan.

### Request

```json
{
  "expiresInDays": 14,
  "includeCost": true,
  "includeHomeLocation": false
}
```

### Response

```json
{
  "shareToken": "shr_abc123",
  "url": "https://where2go.app/share/shr_abc123",
  "expiresAt": "2026-07-18T00:00:00-05:00"
}
```

## `GET /api/share/{shareToken}`

Returns public-safe plan details.

Must never expose:

1. exact home address
2. user email
3. private profile details
4. provider raw payloads
5. children names, if ever added later

## `GET /api/profiles/me`

Returns the signed-in user's family profile.

### Response

```json
{
  "profileId": "profile_123",
  "adults": 2,
  "kidsAges": [8, 11],
  "defaultBudget": 120,
  "defaultDriveTimeMinutes": 30,
  "homeArea": {
    "label": "North Dallas",
    "coarseLat": 32.93,
    "coarseLng": -96.82
  },
  "preferences": {
    "likes": ["parks", "museums", "animals"],
    "avoids": ["late nights", "very loud venues"],
    "mealPreferences": ["casual", "kid-friendly"]
  }
}
```

## `PUT /api/profiles/me`

Upserts the family profile. Same body shape as profile response, excluding `profileId`.

## `POST /api/ai/parse-request`

Internal endpoint used only by server workflows during early development.
In production this may become a plain internal function instead of a public route.

### Request

```json
{
  "queryText": "Something outside today, family of four, under $100",
  "profileDefaults": {
    "adults": 2,
    "kidsAges": [8, 11],
    "defaultBudget": 120
  }
}
```

### Response

```json
{
  "constraints": {
    "budgetMax": 100,
    "indoorOutdoorPreference": "outdoor",
    "party": {
      "adults": 2,
      "kidsAges": [8, 11]
    }
  },
  "needsFollowUp": false
}
```

## `GET /api/provider-health`

Admin endpoint.

### Response

```json
{
  "providers": [
    {
      "name": "google_routes",
      "status": "ok",
      "latencyP95Ms": 420,
      "errorRate24h": 0.01,
      "lastSuccessAt": "2026-07-04T14:00:00-05:00"
    }
  ]
}
```

## Future Endpoints

| Phase | Method | Path | Purpose |
|---|---|---|---|
| Phase 2 | `POST` | `/api/weekend/optimize` | Generate Weekend Optimizer plan |
| Phase 2 | `POST` | `/api/plans/{planId}/calendar` | Create calendar event |
| Phase 2 | `POST` | `/api/plans/{planId}/alerts` | Enable leave-now alerts |
| Phase 2 | `GET` | `/api/favorites` | List favorites and avoid list |
| Phase 2 | `PUT` | `/api/favorites` | Update favorites and avoid list |
| Phase 3 | `POST` | `/api/groups` | Create group planning session |
| Phase 3 | `POST` | `/api/groups/{groupId}/preferences` | Submit group member preferences |
| Phase 3 | `GET` | `/api/deals` | Fetch relevant deals/coupons |

