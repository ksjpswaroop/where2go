# Where2Go High-Fidelity Web Design Spec

## Product Surface

The first web app is an operational planning surface, not a marketing site.
The first screen should let the user generate a plan immediately.

Primary route:

```text
/
```

Primary job:

```text
Ask for a plan -> review best plan and backups -> act/share/feedback
```

## Visual Direction

Where2Go should feel calm, practical, and trustworthy. The product is helping a family make a decision, so the interface should avoid noisy discovery-feed patterns.

### Visual Principles

1. Dense enough to compare time, cost, and logistics.
2. Clear enough to use on a phone in a busy household moment.
3. Warm but not playful.
4. Maps and plan cards should carry the visual weight.
5. Recommendation reasons should be short, factual, and grounded.
6. No full-screen marketing hero in the MVP app.

## Design Tokens

| Token | Value | Use |
|---|---|---|
| Font family | Geist Sans / system sans | UI and body |
| Mono font | Geist Mono / system mono | times, costs, ids, debug |
| Background | `#F3F6F8` | App background |
| Surface | `#FFFFFF` | Panels and cards |
| Surface muted | `#EEF3F8` | Secondary panels |
| Text primary | `#191919` | Primary text |
| Text secondary | `#666666` | Supporting text |
| Border | `#D0D7DE` | Panel separators |
| Primary | `#0A66C2` | Primary actions |
| Primary hover | `#004182` | Hover/pressed |
| Accent | `#378FE9` | Highlight, price/value badges |
| Positive | `#057642` | Good fit |
| Warning | `#915907` | Caveats |
| Danger | `#CC1016` | Errors |
| Radius | `8px` | Cards, inputs, menus |
| Shadow | subtle only | Floating overlays, dialogs |

Use semantic CSS variables in implementation. Do not hardcode raw colors across components.

## Responsive Breakpoints

| Name | Width | Layout |
|---|---:|---|
| Mobile | 360-767 | Single column, sticky bottom action bar |
| Tablet | 768-1023 | Two columns where map/result can stack |
| Desktop | 1024-1439 | Left input/result column, right map/detail column |
| Wide | 1440+ | Centered max-width shell with persistent context rail |

## Global Navigation

### Desktop

Top bar height: 64px.

Left:

1. Where2Go wordmark.
2. Current city/location selector.

Center:

1. Today
2. Saved
3. Profile

Right:

1. Weather mini-chip.
2. Budget default chip.
3. Account menu.

### Mobile

Bottom navigation:

1. Plan
2. Saved
3. Profile

Use top compact header for location and date.

## Page 1: Plan Request

Route:

```text
/
```

Purpose:

Let the user enter a natural request or use quick controls to generate the first plan.

### Desktop Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Top nav                                                      │
├──────────────────────────────┬───────────────────────────────┤
│ Plan request panel           │ Context panel                 │
│                              │                               │
│ "What should we do today?"   │ Today in Dallas               │
│ Textarea                     │ Weather: 82, clear            │
│                              │ Drive default: 30 min         │
│ Constraint chips             │ Budget default: $120          │
│ - Family of 4                │                               │
│ - Kids 8, 11                 │ Recent preferences            │
│ - Under $120                 │ - outdoor                     │
│ - Home by 7 PM               │ - casual food                 │
│                              │ - avoid very crowded          │
│ Primary button               │                               │
│ Generate plan                │                               │
└──────────────────────────────┴───────────────────────────────┘
```

### Mobile Layout

Single column:

1. Location/date row.
2. Main prompt textarea.
3. Constraint chips in horizontal scroll.
4. Quick controls collapsed into accordion.
5. Sticky bottom button: `Generate plan`.

### Components

| Component | Behavior |
|---|---|
| Natural-language textarea | 2-4 lines, accepts spoken-style request |
| Constraint chips | Editable chips for budget, time, drive, party, indoor/outdoor |
| Family profile preview | Shows party and ages, links to edit |
| Quick presets | "This afternoon", "Under $100", "Outdoor", "Low effort" |
| Generate button | Disabled until location and party exist |

### Empty State Copy

Primary prompt:

```text
What should we do today?
```

Textarea placeholder:

```text
Family outing today, under $120, outdoors if possible, drive under 30 minutes, home by 7 PM.
```

## Page 2: Generating State

Route:

```text
/plans/new?status=generating
```

Purpose:

Communicate that the system is checking real constraints, not just asking AI to guess.

### Layout

Show a progress stack:

1. Understanding request.
2. Finding places and events.
3. Checking weather and travel time.
4. Estimating cost.
5. Building best plan and backups.

Each row has:

1. status icon
2. label
3. optional provider note

### Rules

If generation exceeds 8 seconds, show partial progress and keep the user oriented.
If one provider fails, continue with partial results.

## Page 3: Plan Results

Route:

```text
/plans/{planId}
```

Purpose:

Show Today's Best Plan first, with two backups and clear next actions.

### Desktop Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Top nav                                                      │
├──────────────────────────────┬───────────────────────────────┤
│ Results column               │ Map / timeline column         │
│                              │                               │
│ Best plan card               │ Map with route pins           │
│ - title                      │                               │
│ - why it fits                │ Timeline card                 │
│ - cost / drive / weather     │ 2:20 Leave                    │
│ - primary actions            │ 2:50 Arrive                   │
│                              │ 5:10 Dinner                   │
│ Backup cards                 │ 6:25 Drive home               │
│ - cheaper                    │                               │
│ - rain / low effort          │                               │
│                              │                               │
│ Feedback row                 │                               │
└──────────────────────────────┴───────────────────────────────┘
```

### Best Plan Card

Visible fields:

1. Plan title.
2. Category badge.
3. Short fit summary.
4. Cost range.
5. Total drive time.
6. Weather fit.
7. Kid-age fit.
8. Meal included indicator.
9. Top three reasons.
10. Caveat row if needed.
11. Primary actions.

Primary action order:

1. Directions.
2. Tickets / reservation / website.
3. Share.

### Backup Cards

Cheaper Alternative:

1. Emphasize lower estimated total.
2. Show tradeoff, e.g. "less novel", "longer drive", "shorter outing".

Rain / Low-Effort Backup:

1. Emphasize indoor, easier parking, shorter drive, or less planning friction.

### Mobile Layout

1. Best plan card at top.
2. Sticky action row with Directions, Book, Share.
3. Collapsible Why This Plan.
4. Timeline.
5. Backups.
6. Feedback.

## Page 4: Plan Detail

Route:

```text
/plans/{planId}/detail
```

Purpose:

Let the user inspect the plan before committing.

### Sections

1. Summary header.
2. Timeline.
3. Cost breakdown.
4. Stops.
5. Food nearby.
6. Weather and travel notes.
7. Why this plan.
8. Source notes.
9. Actions.

### Timeline Detail

Timeline rows:

| Row Type | Fields |
|---|---|
| Travel | leave time, from, to, drive minutes, route action |
| Activity | arrival time, place/event, duration, ticket/action |
| Food | time, restaurant, price level, distance from activity |
| Return | leave time, estimated home arrival |

### Cost Breakdown

Use a compact table:

| Category | Estimate | Confidence |
|---|---:|---|
| Tickets/admission | $40-$60 | Medium |
| Food | $35-$50 | Medium |
| Parking/transport | $0-$15 | Low |
| Extras | $0-$10 | Low |

MVP can show confidence labels for individual cost estimates without shipping the Phase 2 overall Confidence Score.

## Page 5: Compare Alternatives

Route:

```text
/plans/{planId}/compare
```

Purpose:

Let a user compare the best plan with backups without falling back into endless browsing.

### Layout

Three columns on desktop:

1. Best Plan.
2. Cheaper Alternative.
3. Rain / Low-Effort Backup.

Rows:

1. Cost.
2. Drive.
3. Weather fit.
4. Kid fit.
5. Food nearby.
6. Timing.
7. Main tradeoff.
8. Primary action.

Mobile:

Use segmented control:

1. Best.
2. Cheaper.
3. Easy.

## Page 6: Family Profile

Route:

```text
/profile
```

Purpose:

Reduce repeated setup without making onboarding heavy.

### Sections

1. Household.
2. Defaults.
3. Preferences.
4. Avoid list.
5. Privacy.

### Fields

| Field | Control |
|---|---|
| Adults | stepper |
| Kids' ages | chips + add age |
| Default budget | numeric input / slider |
| Default drive limit | segmented control: 15, 30, 45, custom |
| Indoor/outdoor default | segmented control |
| Likes | multi-select chips |
| Avoids | multi-select chips |
| Meal preferences | chips |
| Home area | coarse location selector |

### Privacy Notes

Do not ask for children's names in MVP.
Store ages only.
Let the user store a neighborhood or city area instead of exact home address.

## Page 7: Saved Plans

Route:

```text
/saved
```

Purpose:

Let users find previously generated or accepted plans.

### States

1. No saved plans.
2. Saved but expired/outdated plan.
3. Saved plan with refreshed route/weather available.

### Card Fields

1. title
2. date generated
3. cost range
4. drive time
5. tags
6. last action
7. regenerate button

## Page 8: Share Page

Route:

```text
/share/{shareToken}
```

Purpose:

Show a public-safe version of the plan.

### Must Include

1. Plan title.
2. Timeline.
3. Cost range if sharer enabled it.
4. Public destination addresses.
5. Directions and booking links.
6. "Open in Where2Go" action.

### Must Not Include

1. exact home address
2. private family profile details
3. user email
4. private feedback
5. raw provider debug data

## Page 9: Settings

Route:

```text
/settings
```

Purpose:

Account, privacy, provider preferences, and notification defaults.

MVP settings:

1. Account.
2. Privacy.
3. Location preference.
4. AI provider preference if exposed to power users.
5. Delete account/data request.

Do not expose raw model settings to normal users in MVP. Keep provider routing server-side.

## Page 10: Provider Health Admin

Route:

```text
/admin/provider-health
```

Purpose:

Internal ops view for API reliability.

### Layout

Table columns:

1. Provider.
2. Status.
3. P95 latency.
4. Error rate.
5. Last success.
6. Cache hit rate.
7. Notes.

This is not a public route.

## Component Inventory

| Component | Description |
|---|---|
| `PlanRequestBox` | Textarea plus constraint chips |
| `ConstraintChip` | Editable chip for budget, time, drive, party, weather preference |
| `PlanCard` | Best plan or backup plan card |
| `FitBadge` | Budget, weather, kid fit, drive fit badge |
| `Timeline` | Vertical itinerary timeline |
| `CostBreakdown` | Cost range rows |
| `ActionBar` | Directions, tickets/reservation, share |
| `WhyThisPlan` | Reasons and caveats |
| `FeedbackBar` | Accept, reject, save, attended |
| `MapPreview` | Route and stop preview |
| `ProviderStatusPill` | Partial/degraded result indicator |

## Interaction States

| State | Required UI |
|---|---|
| Loading | Step-by-step generation progress |
| Partial data | Non-blocking provider warning and usable plan |
| No results | Ask user to loosen one or two constraints |
| Provider failure | Continue with remaining providers and show caveat |
| Over budget | Show cheaper alternative prominently |
| Weather mismatch | Promote rain / low-effort backup |
| Plan accepted | Save plan and show next action |
| Plan rejected | Ask reason with one tap options |

## Accessibility Requirements

1. All controls keyboard accessible.
2. Buttons have visible focus states.
3. Color is not the only signal for fit/cost/weather.
4. Text contrast meets WCAG AA.
5. Map pins have list equivalents.
6. Timeline is readable without map.
7. Share page is accessible without login.

## Implementation Notes

1. Use server-rendered shells where possible.
2. Keep interactive controls in small client components.
3. Do not block first paint on map rendering.
4. Use skeletons for result cards and timeline.
5. Use optimistic UI only for feedback/save actions, not plan generation.
6. Keep the plan result URL canonical and shareable.
