# single-feature-onboarding-v1 — PostHog readout spec

Experiment ID: `single-feature-onboarding-v1`
Variants: `control`, `treatment_singlefeature`
Split: 50 / 50
Audience: new users (fresh install ∧ first signup); cohort sticky per `partyId`.

## Events emitted by the app

| Event | Fired when | Key properties |
| --- | --- | --- |
| `experiment_assigned` | Once, on first variant assignment | `experimentId`, `variant`, `source=client_local` |
| `experiment_viewed` | Once per session when the gate engages a treatment user | `experimentId`, `variant`, `surface=gate_landing` (if present) |
| `experiment_converted` | Once per session, first reaction posted on a moment inside the gate | `experimentId`, `variant`, `value=1`, `surface=gate_moment_reaction` |

All events carry `$distinct_id` (PostHog default) and inherit user/group props from `AnalyticsProvider` (party id, app version, platform).

## Insights to create in PostHog

### 1. Exposure counter (sanity)
- Type: **Trends**
- Series:
  - `experiment_assigned` — breakdown by `properties.variant`
  - `experiment_viewed` — breakdown by `properties.variant`
- Date range: rolling 14 days
- Display: number + line
- Purpose: confirm 50/50 split and that treatment users actually see the gate.

### 2. Primary metric — D1 activation (conversion within 24h of view)
- Type: **Funnel**
- Steps:
  1. `experiment_viewed` where `properties.experimentId = 'single-feature-onboarding-v1'`
  2. `experiment_converted` where `properties.experimentId = 'single-feature-onboarding-v1'`
- Conversion window: **1 day**
- Breakdown: `properties.variant`
- Date range: rolling since launch
- Purpose: this is the primary success metric.

### 3. Time-to-first-action
- Type: **Trends** (or **Paths** → time histogram)
- Event: `experiment_converted`
- Filter: `properties.experimentId = 'single-feature-onboarding-v1'`
- Aggregation: median time since `experiment_viewed` (use PostHog "time to convert" on the funnel above)
- Breakdown: `properties.variant`

### 4. D7 retention (secondary)
- Type: **Retention**
- Cohortizing event: `experiment_viewed` filtered to this experiment
- Returning event: any `$pageview` / `$screen` / `app_opened` (whichever you treat as DAU signal — check `AnalyticsProvider.tsx`)
- Period: Day
- Breakdown: `properties.variant`
- Look at days 1, 3, 7.

### 5. Assignment vs view sanity (drop-off guard)
- Type: **Funnel**
- Steps:
  1. `experiment_assigned`
  2. `experiment_viewed`
- Breakdown: `properties.variant`
- If treatment-arm view rate is materially lower than control's `experiment_assigned` count, the gate is failing to engage for some users (e.g. anchor event lookup returning empty) — investigate.

## Cohort (optional, for downstream analysis)

Create a **dynamic behavioral cohort** in PostHog:
- Name: `exp:single-feature-onboarding-v1:treatment`
- Condition: performed `experiment_assigned` where `properties.experimentId = 'single-feature-onboarding-v1'` AND `properties.variant = 'treatment_singlefeature'`
- Use to filter any downstream insight (retention, feature adoption, etc.) by arm without re-filtering each chart.

## Stop conditions

- **Min sample:** 500 exposures per arm OR 14 days, whichever first.
- **Guardrail:** if D1 activation in treatment drops >5pp below control with ≥200 exposures per arm and p < 0.05, kill the experiment by setting `weights: [1.0, 0.0]` in `ExperimentProvider.tsx` and shipping.
- **Win condition:** treatment D1 activation ≥ control + 3pp at p < 0.05 → ramp to 100% treatment in a follow-up PR.

## Notes

- Conversion uses a direct `onReactionPosted` callback from `EventMomentCard` (not polling). Each session can convert at most once via a ref guard in the gate.
- Anchor event = most recent past event with ≥1 moment; empty-state fallback otherwise. Empty-state exposures still count as `experiment_viewed`.
