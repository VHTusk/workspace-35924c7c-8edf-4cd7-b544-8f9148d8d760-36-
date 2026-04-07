# Performance SLI/SLO Definitions

**Document Version:** 2.0  
**Last Updated:** February 2025  
**Owner:** Platform Engineering Team

---

## Table of Contents

1. [Overview](#overview)
2. [SLI/SLO Summary](#slislo-summary)
3. [API Latency SLIs](#api-latency-slis)
4. [Error Rate SLIs](#error-rate-slis)
5. [Database Performance SLIs](#database-performance-slis)
6. [Web Vitals SLIs](#web-vitals-slis)
7. [Availability SLIs](#availability-slis)
8. [Measurement Methodology](#measurement-methodology)
9. [Alerting Thresholds](#alerting-thresholds)
10. [Escalation Procedures](#escalation-procedures)
11. [Reporting](#reporting)
12. [Implementation Guide](#implementation-guide)

---

## Overview

This document defines the Service Level Indicators (SLIs) and Service Level Objectives (SLOs) for VALORHIVE. These metrics guide performance optimization, incident response, and capacity planning.

### Key Concepts

- **SLI (Service Level Indicator):** A quantifiable measure of service behavior
- **SLO (Service Level Objective):** A target value for an SLI
- **SLA (Service Level Agreement):** A contractual commitment with consequences

### Scope

This document covers:
- API endpoints (`/api/*`)
- Database queries (Prisma operations)
- Client-side performance (Web Vitals)
- Overall service availability

---

## SLI/SLO Summary

| Category | SLI | SLO Target | Warning | Critical |
|----------|-----|------------|---------|----------|
| **Availability** | API Availability | 99.9% | < 99.5% | < 99% |
| **Latency** | API p50 Latency | < 100ms | > 150ms | > 300ms |
| **Latency** | API p95 Latency | < 500ms | > 600ms | > 1000ms |
| **Latency** | API p99 Latency | < 1000ms | > 1200ms | > 2000ms |
| **Errors** | Error Rate | < 0.1% | > 0.5% | > 1% |
| **Database** | Query p95 Latency | < 100ms | > 150ms | > 300ms |
| **Database** | Slow Query Rate | < 1% | > 2% | > 5% |
| **Web Vitals** | LCP | < 2.5s | > 3s | > 4s |
| **Web Vitals** | FID | < 100ms | > 150ms | > 300ms |
| **Web Vitals** | CLS | < 0.1 | > 0.15 | > 0.25 |

---

## API Latency SLIs

### Definition

**SLI:** Time from request received to response sent, measured at the application layer.

**Unit:** Milliseconds (ms)

### SLO Targets

| Percentile | Target | Warning | Critical |
|------------|--------|---------|----------|
| p50 | < 100ms | > 150ms | > 300ms |
| p95 | < 500ms | > 600ms | > 1000ms |
| p99 | < 1000ms | > 1200ms | > 2000ms |

### Critical Endpoints (Stricter SLOs)

The following endpoints have stricter latency requirements due to their user-facing importance:

| Endpoint | p95 Target | p99 Target |
|----------|------------|------------|
| `/api/auth/login` | < 200ms | < 400ms |
| `/api/auth/register` | < 250ms | < 500ms |
| `/api/payments/webhook` | < 500ms | < 1000ms |
| `/api/tournaments/[id]/register` | < 300ms | < 600ms |

### Measurement

```typescript
import { recordApiLatency } from '@/lib/performance-slis';

// In API route or middleware
const startTime = performance.now();
// ... handler execution
const duration = performance.now() - startTime;
recordApiLatency('/api/endpoint', 'GET', duration, 200);
```

### Per-Endpoint Tracking

Latency is tracked per endpoint to identify bottlenecks:

```typescript
const stats = getEndpointLatencyStats('/api/tournaments');
// Returns: { count, p50, p95, p99, avg, min, max, errorCount, errorRate }
```

---

## Error Rate SLIs

### Definition

**SLI:** Percentage of requests that result in errors (4xx and 5xx status codes).

**Unit:** Percentage (%)

### SLO Targets

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Overall Error Rate | < 0.1% | > 0.5% | > 1% |
| 5xx Error Rate | < 0.05% | > 0.1% | > 0.5% |
| Per-Endpoint Error Rate | < 1% | > 2% | > 5% |

### Error Classification

| Category | Status Codes | Counted In SLO |
|----------|-------------|----------------|
| Client Errors | 400, 401, 403, 404, 422 | No (client responsibility) |
| Server Errors | 500, 502, 503, 504 | Yes |
| Rate Limit | 429 | Partially (configurable) |

### Exclusions

- Health check endpoints (`/api/health/*`)
- Webhook retry attempts (count original only)
- Scheduled maintenance windows

### Measurement

```typescript
import { recordError } from '@/lib/performance-slis';

// On error occurrence
recordError('/api/tournaments', 'POST', 'VALIDATION_ERROR', 400);
recordError('/api/payments', 'POST', 'DATABASE_ERROR', 500);
```

### Error Types

Common error types tracked:
- `VALIDATION_ERROR` - Input validation failures
- `AUTHENTICATION_ERROR` - Auth token issues
- `AUTHORIZATION_ERROR` - Permission denied
- `DATABASE_ERROR` - Prisma/query failures
- `EXTERNAL_SERVICE_ERROR` - Third-party API failures
- `RATE_LIMIT_ERROR` - Throttling
- `TIMEOUT_ERROR` - Request timeouts

---

## Database Performance SLIs

### Definition

**SLI:** Time to execute a database query from start to completion.

**Unit:** Milliseconds (ms)

### SLO Targets

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Query p95 Latency | < 100ms | > 150ms | > 300ms |
| Average Query Time | < 50ms | > 75ms | > 150ms |
| Slow Query Rate | < 1% | > 2% | > 5% |
| Query Failure Rate | < 0.01% | > 0.1% | > 1% |

### Slow Query Definition

A query is considered **slow** if it exceeds 100ms. All slow queries are logged with:

- Query text (truncated)
- Execution duration
- Timestamp
- Success/failure status

### Measurement

```typescript
import { recordDbQuery } from '@/lib/performance-slis';

const startTime = performance.now();
try {
  const result = await prisma.tournament.findMany({...});
  recordDbQuery('tournament.findMany', performance.now() - startTime, true);
} catch (error) {
  recordDbQuery('tournament.findMany', performance.now() - startTime, false);
}
```

### Common Query Patterns to Monitor

1. **Leaderboard Queries** - Complex aggregations, may need optimization
2. **Bracket Generation** - Graph traversal, high complexity
3. **Search Queries** - Full-text search performance
4. **Stats Calculations** - Window functions, aggregations

---

## Web Vitals SLIs

### Definition

Core Web Vitals are user-centric performance metrics that measure real-world user experience.

### Largest Contentful Paint (LCP)

**Definition:** Time until the largest content element is visible in the viewport.

**Target:** < 2.5 seconds (75th percentile)

| Status | Threshold |
|--------|-----------|
| Good | < 2.5s |
| Needs Improvement | 2.5s - 4s |
| Poor | > 4s |

**Optimization Strategies:**
- Optimize server response time (TTFB)
- Use CDN for static assets
- Implement image optimization (Next.js Image component)
- Preload critical resources
- Use responsive images

### First Input Delay (FID)

**Definition:** Time from user's first interaction to browser response.

**Target:** < 100 milliseconds

| Status | Threshold |
|--------|-----------|
| Good | < 100ms |
| Needs Improvement | 100ms - 300ms |
| Poor | > 300ms |

**Optimization Strategies:**
- Minimize JavaScript execution time
- Break up long tasks (> 50ms)
- Use web workers for heavy computation
- Optimize third-party scripts
- Defer non-critical JavaScript

### Cumulative Layout Shift (CLS)

**Definition:** Measure of visual stability during page load.

**Target:** < 0.1

| Status | Threshold |
|--------|-----------|
| Good | < 0.1 |
| Needs Improvement | 0.1 - 0.25 |
| Poor | > 0.25 |

**Optimization Strategies:**
- Set explicit dimensions for images
- Reserve space for dynamic content
- Avoid inserting content above existing content
- Use CSS aspect-ratio property
- Predefine font sizes

### Measurement (Client-Side)

```typescript
// In client component
import { onLCP, onFID, onCLS } from 'web-vitals';
import { reportWebVitalToServer } from '@/lib/performance-slis';

onLCP(metric => reportWebVitalToServer(metric, window.location.pathname));
onFID(metric => reportWebVitalToServer(metric, window.location.pathname));
onCLS(metric => reportWebVitalToServer(metric, window.location.pathname));
```

---

## Availability SLIs

### Definition

**SLI:** Percentage of time the service is operational and responding to requests.

**Unit:** Percentage (%)

### SLO Targets

| Period | SLO | Allowed Downtime |
|--------|-----|------------------|
| Monthly | 99.9% | 43.8 minutes |
| Weekly | 99.9% | 10.1 minutes |
| Daily | 99.9% | 1.44 minutes |

### Calculation

```
Availability % = (Total Time - Downtime) / Total Time × 100
```

### Measurement Criteria

A service is considered **available** when:
- HTTP responses return within timeout
- Response status code is not 5xx
- Database queries complete successfully

### Exclusions from Downtime

1. **Scheduled Maintenance**
   - Announced 48 hours in advance
   - Duration limited to 4 hours per month
   - Performed during low-traffic windows (2-6 AM IST)

2. **Force Majeure Events**
   - Natural disasters
   - Government actions
   - Infrastructure failures beyond control

3. **Third-Party Outages**
   - Razorpay payment gateway
   - AWS regional outages
   - DNS provider issues

---

## Measurement Methodology

### Data Collection Points

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUEST FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client ───> Middleware ───> API Route ───> Database        │
│     │            │               │              │            │
│     │            ▼               ▼              ▼            │
│     │      [Latency        [Latency       [Query           │
│     │       Start]          End]           Duration]        │
│     │                                                       │
│     ▼                                                       │
│  [Web Vitals]                                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Measurement Intervals

| Metric Type | Collection | Aggregation |
|-------------|------------|-------------|
| API Latency | Per request | Per minute |
| Error Rate | Per request | Per minute |
| DB Query | Per query | Per minute |
| Web Vitals | Per page view | Per 5 minutes |
| Availability | Heartbeat | Per minute |

### Data Retention

| Resolution | Retention Period |
|------------|------------------|
| Raw data | 24 hours |
| Minute aggregates | 7 days |
| Hourly aggregates | 30 days |
| Daily aggregates | 1 year |

### Percentile Calculation

Percentiles are calculated using the nearest-rank method:

```typescript
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
```

---

## Alerting Thresholds

### Alert Levels

| Level | Severity | Response Time | Notification Channel |
|-------|----------|---------------|---------------------|
| P1 - Critical | Service down | 15 minutes | PagerDuty + Slack + SMS |
| P2 - Warning | Degraded | 1 hour | Slack |
| P3 - Info | Anomaly | 4 hours | Email |

### Alert Rules

#### API Latency Alerts

```yaml
- alert: HighApiLatencyP95
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "API p95 latency exceeds 500ms"
    
- alert: CriticalApiLatencyP95
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1.0
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "API p95 latency exceeds 1000ms"
```

#### Error Rate Alerts

```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Error rate exceeds 1%"
    
- alert: CriticalErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Error rate exceeds 5%"
```

#### Database Alerts

```yaml
- alert: SlowDbQueries
  expr: rate(db_query_duration_seconds_count{duration > 0.1}[5m]) > 0.01
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High rate of slow database queries"
    
- alert: DbQueryFailures
  expr: rate(db_query_failures_total[5m]) > 0.01
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Database query failure rate elevated"
```

#### Web Vitals Alerts

```yaml
- alert: PoorLCP
  expr: avg(web_vital_lcp_seconds) > 4.0
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "LCP exceeds 4 seconds threshold"
```

### Alert Summary Table

| Category | Condition | Duration | Severity | Auto-Resolve |
|----------|-----------|----------|----------|--------------|
| API Latency | p95 > 500ms | 5 min | Warning | Yes |
| API Latency | p95 > 1000ms | 2 min | Critical | Yes |
| API Latency | p99 > 2000ms | 1 min | Critical | Yes |
| Error Rate | > 0.5% | 5 min | Warning | Yes |
| Error Rate | > 1% | 2 min | Critical | Yes |
| Error Rate | > 5% | 1 min | Critical | No |
| DB Query | p95 > 150ms | 5 min | Warning | Yes |
| DB Query | failures > 0.1% | 2 min | Critical | No |
| Web Vitals | LCP > 4s | 15 min | Warning | Yes |
| Availability | < 99% | 1 min | Critical | No |

---

## Escalation Procedures

### Incident Severity Matrix

| Severity | User Impact | Response Time | Update Frequency |
|----------|-------------|---------------|------------------|
| SEV-1 | Complete outage | 15 min | Every 15 min |
| SEV-2 | Partial degradation | 30 min | Every 30 min |
| SEV-3 | Minor impact | 2 hours | Every 2 hours |
| SEV-4 | Low impact | 4 hours | Daily |

### Escalation Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    ESCALATION FLOW                              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Detection                                                      │
│     │                                                           │
│     ▼                                                           │
│  ┌───────────────┐                                              │
│  │ Auto-Alert    │──────> PagerDuty                             │
│  │ Triggered     │                                              │
│  └───────────────┘                                              │
│     │                                                           │
│     ▼ (5 min no response)                                       │
│  ┌───────────────┐                                              │
│  │ On-Call       │──────> Slack #incidents                      │
│  │ Engineer      │                                              │
│  └───────────────┘                                              │
│     │                                                           │
│     ▼ (15 min no resolution)                                    │
│  ┌───────────────┐                                              │
│  │ Team Lead     │──────> Escalate to manager                   │
│  └───────────────┘                                              │
│     │                                                           │
│     ▼ (30 min no resolution)                                    │
│  ┌───────────────┐                                              │
│  │ Engineering   │──────> All hands, war room                   │
│  │ Manager       │                                              │
│  └───────────────┘                                              │
│     │                                                           │
│     ▼ (1 hour no resolution)                                    │
│  ┌───────────────┐                                              │
│  │ VP/CTO       │──────> Executive notification                 │
│  └───────────────┘                                              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Contact Information

| Role | Primary Contact | Backup Contact |
|------|-----------------|----------------|
| On-Call Engineer | PagerDuty Rotation | Backup Rotation |
| Team Lead | @team-lead | @team-lead-backup |
| Engineering Manager | @eng-manager | @eng-manager-backup |
| VP Engineering | @vp-eng | @cto |

### Incident Response Checklist

1. **Acknowledge** - Acknowledge the alert within SLA
2. **Assess** - Determine severity and impact
3. **Communicate** - Post to #incidents with status
4. **Mitigate** - Implement immediate fix if possible
5. **Monitor** - Watch metrics for improvement
6. **Resolve** - Confirm service restoration
7. **Document** - Create post-incident report

### Post-Incident Review

Required for all SEV-1 and SEV-2 incidents:

1. **Timeline** - Detailed sequence of events
2. **Root Cause** - Technical explanation
3. **Impact** - User minutes affected
4. **Action Items** - Preventive measures
5. **Lessons Learned** - Process improvements

---

## Reporting

### Daily Report

Generated at 00:00 UTC, distributed via email.

**Contents:**
- p50/p95/p99 latency for previous 24 hours
- Error rate trends
- Top slow endpoints
- Alert summary
- Web Vitals summary

### Weekly Report

Generated Monday 00:00 UTC, distributed to stakeholders.

**Contents:**
- SLO compliance percentage
- Incident summary
- Performance trend analysis
- Capacity utilization
- Action items for improvement

### Monthly Report

Generated 1st of each month, distributed to leadership.

**Contents:**
- Executive summary
- SLO breach analysis
- Cost optimization recommendations
- Capacity planning
- Roadmap recommendations

### Report Access

```typescript
// Get SLI report for specific period
import { getSliReport } from '@/lib/performance-slis';

// Last hour
const hourlyReport = getSliReport(60);

// Last 24 hours
const dailyReport = getSliReport(1440);

// Last week
const weeklyReport = getSliReport(10080);
```

### Dashboard Metrics

Key metrics displayed on monitoring dashboard:

| Metric | Refresh Rate | Visualization |
|--------|--------------|---------------|
| Request Rate | 10s | Line chart |
| Error Rate | 10s | Gauge + Line |
| p95 Latency | 10s | Line chart |
| Active Connections | 10s | Counter |
| Cache Hit Rate | 30s | Pie chart |
| Web Vitals | 1m | Histogram |

---

## Implementation Guide

### Quick Start

```typescript
import {
  recordApiLatency,
  recordError,
  recordDbQuery,
  recordWebVital,
  getSliReport,
  checkSloCompliance,
} from '@/lib/performance-slis';

// 1. Track API latency
app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    recordApiLatency(req.path, req.method, performance.now() - start, res.statusCode);
  });
  next();
});

// 2. Track database queries
const startTime = performance.now();
const result = await prisma.user.findMany();
recordDbQuery('user.findMany', performance.now() - startTime, true);

// 3. Track errors
try {
  // ... operation
} catch (error) {
  recordError('/api/endpoint', 'POST', error.name, 500);
}

// 4. Check compliance
const compliance = checkSloCompliance();
if (!compliance.overall) {
  console.log('SLO breaches:', compliance.alerts);
}
```

### Integration Points

| Location | Integration | Purpose |
|----------|-------------|---------|
| Middleware | `recordApiLatency` | All API requests |
| API Routes | `recordError` | Error handling |
| Prisma Client | `recordDbQuery` | Query performance |
| Client Components | `recordWebVital` | User experience |
| Background Jobs | `recordDbQuery` | Async operations |

### Best Practices

1. **Always record duration** - Use `performance.now()` for accuracy
2. **Classify errors** - Use meaningful error types
3. **Track all queries** - Don't skip "simple" queries
4. **Monitor trends** - Look for gradual degradation
5. **Set realistic targets** - Based on historical data

---

## Appendix

### Performance Budgets

| Page | JS Bundle | CSS | Images | Total |
|------|-----------|-----|--------|-------|
| Landing | 100KB | 30KB | 200KB | 330KB |
| Dashboard | 150KB | 40KB | 100KB | 290KB |
| Tournament | 200KB | 50KB | 150KB | 400KB |
| Leaderboard | 120KB | 35KB | 50KB | 205KB |

### Response Size Limits

| Limit Type | Maximum |
|------------|---------|
| Response body | 5MB |
| JSON payload | 1MB |
| Paginated items | 100 per page |
| Request body | 10MB |

### Glossary

| Term | Definition |
|------|------------|
| SLI | Service Level Indicator - a measurable metric |
| SLO | Service Level Objective - a target for an SLI |
| SLA | Service Level Agreement - a contract with penalties |
| p50 | Median value (50th percentile) |
| p95 | 95th percentile (95% of requests faster) |
| p99 | 99th percentile (99% of requests faster) |
| LCP | Largest Contentful Paint |
| FID | First Input Delay |
| CLS | Cumulative Layout Shift |
| TTFB | Time to First Byte |
| FCP | First Contentful Paint |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2025 | Platform Team | Initial version |
| 2.0 | Feb 2025 | Platform Team | Enhanced with full SLI tracking, escalation procedures |

---

**End of Performance SLI/SLO Definitions**
