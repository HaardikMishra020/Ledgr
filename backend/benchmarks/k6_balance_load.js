/**
 * k6 load test — GET /groups/{id}/balances
 *
 * Measures throughput and latency of the balance endpoint under load.
 * Requires a seeded group with >500 events for meaningful results.
 *
 * Usage:
 *   BASE_URL=https://your-api.up.railway.app \
 *   GROUP_ID=<uuid> \
 *   TOKEN=<jwt> \
 *   k6 run benchmarks/k6_balance_load.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const latency = new Trend('balance_latency', true)
const errors = new Rate('balance_errors')

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up
    { duration: '1m',  target: 50 },   // sustained load
    { duration: '30s', target: 100 },  // peak
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    balance_latency: ['p(50)<20', 'p(95)<100', 'p(99)<300'],
    balance_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
}

const BASE  = __ENV.BASE_URL  || 'http://localhost:8000'
const GID   = __ENV.GROUP_ID  || ''
const TOKEN = __ENV.TOKEN     || ''

export default function () {
  const res = http.get(`${BASE}/groups/${GID}/balances`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })

  const ok = check(res, { 'status 200': r => r.status === 200 })
  latency.add(res.timings.duration)
  errors.add(!ok)

  sleep(1)
}
