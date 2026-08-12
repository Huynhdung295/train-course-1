/**
 * k6 Load Test — Order API Performance Testing
 * Usage: k6 run load-test.js
 * Peak load: k6 run --vus 100 --duration 60s load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const orderCreated = new Counter('orders_created_total');
const orderLatency = new Trend('order_api_latency_ms');

export const options = {
    stages: [
        { duration: '30s', target: 10  },   // Ramp up
        { duration: '60s', target: 50  },   // Sustained load
        { duration: '30s', target: 100 },   // Peak load
        { duration: '30s', target: 0   },   // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500'],  // 95% requests under 500ms
        'errors': ['rate<0.01'],             // <1% error rate
        'http_req_failed': ['rate<0.01'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_URL = `${BASE_URL}/api/v1`;

export function setup() {
    const loginRes = http.post(`${API_URL}/auth/login`, JSON.stringify({
        username: 'test@example.com',
        password: 'Test@1234'
    }), { headers: { 'Content-Type': 'application/json' } });

    check(loginRes, { 'login successful': (r) => r.status === 200 });
    const body = JSON.parse(loginRes.body);
    return { accessToken: body.accessToken };
}

export default function(data) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.accessToken}`,
    };

    group('List Orders', () => {
        const res = http.get(`${API_URL}/orders`, { headers });
        check(res, { 'list orders 200': (r) => r.status === 200 });
        errorRate.add(res.status !== 200);
        orderLatency.add(res.timings.duration);
    });

    sleep(1);

    group('Place Order', () => {
        const res = http.post(`${API_URL}/orders`, JSON.stringify({
            productId: '00000000-0000-0000-0000-000000000001',
            quantity: 1
        }), { headers });
        check(res, { 'place order 201': (r) => r.status === 201 });
        if (res.status === 201) orderCreated.add(1);
        errorRate.add(res.status !== 201);
        orderLatency.add(res.timings.duration);
    });

    sleep(2);
}
