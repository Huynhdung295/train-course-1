# 🏎️ Performance Testing (k6 & JMeter)

> **Category**: Testing & QA | **Complexity**: Intermediate | **DevOps**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Why Performance Testing?
Functional tests (JUnit/Testcontainers) prove that your code *works*. 
Performance tests prove that your code *survives*.
Without them, you won't know that your DB connection pool is too small, or your heap size causes massive GC pauses, until Black Friday when your site goes down.

### Types of Performance Tests
1. **Load Testing**: Assess behavior under expected normal peak load (e.g., 500 requests/sec).
2. **Stress Testing**: Push the system beyond its limits to find the breaking point and observe how it fails (does it degrade gracefully or crash?).
3. **Soak Testing**: Run a normal load for an extended period (12-24 hours) to find memory leaks and resource exhaustion.
4. **Spike Testing**: Sudden, massive surges in traffic (e.g., concert ticket sales).

### JMeter vs k6
- **Apache JMeter**: Java-based, mature, UI-driven (GUI), uses XML config files. Hard to version control and review.
- **k6 (by Grafana)**: Modern, written in Go, tests are written in pure JavaScript, incredibly lightweight, designed specifically for CI/CD pipelines and developer experience. **(Industry Recommended)**.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[grafana/k6](https://github.com/grafana/k6)** — The k6 core repository.
- **[apache/jmeter](https://github.com/apache/jmeter)** — The JMeter core repository.

---

## 📐 System Design Blueprint

### Complete k6 Load Testing Implementation

#### `tests/load/order-api-test.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ═══════════════════════════════════════════════════
// 1. CUSTOM METRICS
// ═══════════════════════════════════════════════════
const errorRate = new Rate('errors');
const orderCreationTrend = new Trend('order_creation_time');

// ═══════════════════════════════════════════════════
// 2. LOAD CONFIGURATION (Stages)
// ═══════════════════════════════════════════════════
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 Virtual Users (VUs) over 30 seconds
    { duration: '1m', target: 50 },   // Stay at 50 VUs for 1 minute (Steady State)
    { duration: '10s', target: 0 },   // Ramp down to 0 VUs (Cooldown)
  ],
  thresholds: {
    // Assertions for CI/CD Pipeline (If these fail, k6 returns a non-zero exit code)
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.01'],            // Error rate must be less than 1%
  },
};

// ═══════════════════════════════════════════════════
// 3. THE TEST SCENARIO
// ═══════════════════════════════════════════════════
export default function () {
  
  const url = 'http://localhost:8080/api/v1/orders';
  const payload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: (Math.random() * 100).toFixed(2), // Random amount
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'perf-test-key-123',
    },
  };

  // 1. Send the Request
  const res = http.post(url, payload, params);

  // 2. Track Custom Metrics
  orderCreationTrend.add(res.timings.duration);
  errorRate.add(res.status >= 400);

  // 3. Verify Response (Like Assertions)
  check(res, {
    'is status 201': (r) => r.status === 201,
    'transaction time OK': (r) => r.timings.duration < 500,
  });

  // 4. Think Time (Simulate real user pause before next action)
  sleep(1); 
}
```

---

## 🧪 Verification Commands

```powershell
# 1. Install k6 (Windows via Chocolatey, or use Docker)
# choco install k6

# 2. Run the Load Test
k6 run tests/load/order-api-test.js

# Expected k6 Output Summary:
#
#     ✓ is status 201
#     ✓ transaction time OK
#
#     errors.........................: 0.00%  ✓ 0        ✗ 2450
#     http_req_duration..............: avg=42ms   min=12ms   med=38ms   max=210ms  p(90)=85ms   p(95)=102ms
#     iterations.....................: 2450   32.5/s
#     vus............................: 50     min=1      max=50
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always use parameterized data**. If 50 VUs all request `user_id=1`, your database cache will hit 100% and you'll get incredibly fast, entirely false performance metrics. Randomize data to bypass caches.
2. **Include "Think Time" (`sleep()`)**. Real users don't fire 10 requests per second non-stop. If you omit `sleep()`, 50 VUs will act like a brutal DDoS attack rather than 50 real humans.
3. **Run tests from outside your network**. If k6 runs on the same machine/VPC as the API, you are bypassing Load Balancers, WAFs, and network latency, giving false confidence.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Testing against `localhost` | A MacBook M3 Max can handle 10,000 req/sec. Your 0.5 CPU Kubernetes pod in PROD cannot. | Run load tests against a staging environment that perfectly mirrors production infrastructure. |
| Relying on Averages (`avg`) | If 9 requests take 1ms, and 1 request takes 10,000ms, the average is ~1000ms. Averages hide outliers. | Always use Percentiles (`p(95)`, `p(99)`). "95% of users experienced load times under 200ms." |
| Running Load Tests against PROD during business hours | You will take down your own company. | Run in Staging. If running in Prod (Chaos Engineering), do it at 3 AM with on-call engineers actively monitoring. |
