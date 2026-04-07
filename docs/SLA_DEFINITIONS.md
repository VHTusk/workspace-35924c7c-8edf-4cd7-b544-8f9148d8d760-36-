# VALORHIVE Service Level Agreement (SLA)

**Version:** 1.0  
**Effective Date:** February 2025  
**Applicable To:** Enterprise (Corporate) Tier Organizations

---

## 1. Overview

This Service Level Agreement ("SLA") defines the performance commitments and service standards for VALORHIVE's Enterprise (Corporate) tier subscribers. Organizations paying ₹1,00,000/year are entitled to the following service guarantees.

---

## 2. Service Availability

### 2.1 Uptime Commitment

| Service | Uptime Target | Measurement Period |
|---------|---------------|-------------------|
| Platform Availability | **99.9%** | Monthly |
| API Endpoints | **99.9%** | Monthly |
| Tournament Operations | **99.95%** | During active tournaments |
| Payment Processing | **99.9%** | Monthly |

### 2.2 Scheduled Maintenance

- **Advance Notice:** 72 hours for planned maintenance
- **Maintenance Windows:** Sundays 2:00 AM - 6:00 AM IST
- **Emergency Maintenance:** Best effort notification
- **Exclusions:** Scheduled maintenance does not count toward uptime calculation

### 2.3 Uptime Calculation

```
Monthly Uptime % = [(Total Minutes - Downtime Minutes) / Total Minutes] × 100

Exclusions from Downtime:
- Scheduled maintenance windows
- Force majeure events
- Third-party service failures (Razorpay, AWS)
- Customer-caused issues
```

---

## 3. Response Time Commitments

### 3.1 Support Response Times

| Priority | Description | Initial Response | Resolution Target |
|----------|-------------|------------------|-------------------|
| **P0 - Critical** | Platform down, payment failure | 15 minutes | 4 hours |
| **P1 - High** | Tournament in progress affected | 1 hour | 8 hours |
| **P2 - Medium** | Feature not working, degraded performance | 4 hours | 24 hours |
| **P3 - Low** | General inquiries, feature requests | 24 hours | Best effort |

### 3.2 Support Channels

| Channel | Availability | Response Time |
|---------|--------------|---------------|
| Phone (Dedicated Line) | 24/7 for P0/P1 | Immediate |
| Email (enterprise@valorhive.com) | 24/7 | Per SLA above |
| Dedicated Slack Channel | Business Hours | 1 hour |
| In-App Support | 24/7 | Per SLA above |

---

## 4. Performance Standards

### 4.1 API Response Times

| Endpoint Category | Target Response Time | Maximum Acceptable |
|-------------------|---------------------|-------------------|
| Authentication | < 200ms | 500ms |
| Tournament List | < 300ms | 800ms |
| Bracket Operations | < 500ms | 1500ms |
| Leaderboard Queries | < 200ms | 500ms |
| Payment Processing | < 1000ms | 3000ms |

### 4.2 Page Load Times

| Page Type | Target | Maximum |
|-----------|--------|---------|
| Landing/Home | < 2s | 3s |
| Tournament Detail | < 2s | 4s |
| Bracket View | < 3s | 5s |
| Dashboard | < 2s | 4s |

### 4.3 Concurrent User Capacity

- **Standard Load:** Up to 10,000 concurrent users
- **Peak Load (Tournaments):** Up to 25,000 concurrent users
- **Enterprise Guarantee:** Dedicated capacity for up to 5,000 org members simultaneously

---

## 5. Data Protection & Security

### 5.1 Data Backup

| Data Type | Backup Frequency | Retention |
|-----------|-----------------|-----------|
| User Data | Daily | 7 years |
| Tournament Data | Every 4 hours | 7 years |
| Financial Records | Continuous | 8 years (GST requirement) |
| Media Files | Daily | 1 year after deletion |

### 5.2 Security Standards

- **Encryption:** AES-256 at rest, TLS 1.3 in transit
- **Authentication:** MFA support, session management
- **Compliance:** DPDPA (India) compliant
- **Audit:** Complete audit trail for all operations
- **Penetration Testing:** Quarterly third-party assessment

### 5.3 Data Recovery

| Scenario | Recovery Time Objective | Recovery Point Objective |
|----------|------------------------|-------------------------|
| Database Failure | 1 hour | 1 hour |
| Data Corruption | 4 hours | 24 hours |
| Complete System Failure | 4 hours | 1 hour |

---

## 6. Tournament-Specific SLA

### 6.1 Tournament Operations

| Commitment | Target |
|------------|--------|
| Bracket Generation | < 30 seconds for up to 512 players |
| Real-time Score Updates | < 1 second propagation |
| Push Notifications | < 5 seconds delivery |
| WebSocket Connection Stability | 99.99% during tournament |

### 6.2 Tournament Support

- **Dedicated TD Support:** 1 hour before until 1 hour after tournament
- **Emergency Hotline:** Available during tournament hours
- **On-site Support:** Available for national-level tournaments (additional cost)

---

## 7. Service Credits

### 7.1 Credit Calculation

If VALORHIVE fails to meet the uptime commitment, Enterprise customers are eligible for service credits:

| Monthly Uptime | Credit |
|----------------|--------|
| 99.0% - 99.9% | 5% of monthly fee |
| 98.0% - 99.0% | 10% of monthly fee |
| 95.0% - 98.0% | 25% of monthly fee |
| Below 95.0% | 50% of monthly fee |

### 7.2 Credit Request Process

1. Customer must request credit within 30 days of incident
2. VALORHIVE will verify the claim within 10 business days
3. Credit applied to next billing cycle
4. Maximum credit: 50% of annual subscription fee

### 7.3 Exclusions

No credits for:
- Scheduled maintenance
- Force majeure events
- Third-party service failures
- Customer network/equipment issues
- Actions by customer's users

---

## 8. Incident Management

### 8.1 Incident Classification

| Severity | Impact | Example |
|----------|--------|---------|
| **SEV-1** | Complete service outage | Platform inaccessible |
| **SEV-2** | Major feature unavailable | Cannot register for tournaments |
| **SEV-3** | Degraded performance | Slow page loads |
| **SEV-4** | Minor issue | Cosmetic bug |

### 8.2 Communication During Incidents

| Time Since Detection | Communication |
|---------------------|---------------|
| 0-15 minutes | Initial acknowledgment |
| Every 30 minutes | Status update |
| Resolution | Root cause summary within 24 hours |

### 8.3 Post-Incident Review

For SEV-1 and SEV-2 incidents:
- Written incident report within 48 hours
- Root cause analysis
- Preventive measures implemented
- Follow-up review with customer (optional)

---

## 9. Exclusions & Limitations

### 9.1 Not Covered by SLA

- Free tier and Basic tier users
- Beta features explicitly marked
- Custom integrations not provided by VALORHIVE
- Customer's internet connectivity
- Mobile carrier issues for SMS/WhatsApp
- Third-party payment gateway issues

### 9.2 Force Majeure

VALORHIVE is not liable for failures caused by:
- Natural disasters
- Government actions
- War or terrorism
- Pandemic
- Cyber attacks (DDoS, etc.)
- Infrastructure provider outages (AWS, etc.)

---

## 10. Reporting & Monitoring

### 10.1 Real-time Status

- **Status Page:** https://status.valorhive.com
- **API Health:** https://api.valorhive.com/health

### 10.2 Monthly Reports

Enterprise customers receive:
- Monthly uptime report
- API performance metrics
- Support ticket summary
- Incident summary (if any)

### 10.3 Quarterly Reviews

- Dedicated account manager meeting
- Platform usage analysis
- Feature roadmap preview
- SLA compliance review

---

## 11. Support Escalation

### 11.1 Escalation Path

| Level | Contact | Response Time |
|-------|---------|---------------|
| L1 | Support Team | Per priority SLA |
| L2 | Technical Lead | 30 minutes |
| L3 | Engineering Manager | 1 hour |
| L4 | CTO/Founder | 2 hours (SEV-1 only) |

### 11.2 Customer Success Manager

Enterprise customers are assigned a dedicated Customer Success Manager:
- Regular check-ins (monthly)
- Training and onboarding support
- Feature requests prioritization
- Renewal and expansion discussions

---

## 12. SLA Modifications

### 12.1 Change Process

- 30 days written notice for SLA changes
- Changes do not apply mid-contract without consent
- Material negative changes allow contract termination

### 12.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2025 | Initial SLA |

---

## 13. Contact Information

### Enterprise Support

- **Email:** enterprise@valorhive.com
- **Phone:** +91-XXXX-XXXX (24/7 for P0/P1)
- **Slack:** valrohive-enterprise.slack.com

### Account Team

- **Customer Success:** csm@valorhive.com
- **Billing:** billing@valorhive.com
- **Legal:** legal@valorhive.com

---

## 14. Agreement

By subscribing to VALORHIVE's Enterprise tier, organizations agree to the terms outlined in this SLA. This SLA is part of the Master Services Agreement.

---

**VALORHIVE Private Limited**  
*Multi-Sport Tournament Platform*

*Last Updated: February 2025*
