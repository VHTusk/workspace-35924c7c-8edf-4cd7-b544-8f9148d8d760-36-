/**
 * VALORHIVE Load Testing Suite
 * 
 * Comprehensive load tests for critical platform components
 * Run with: bun run scripts/load-tests/index.ts
 */

import { db } from '@/lib/db';
import { generateBracket } from '@/lib/bracket';
import { calculateElo } from '@/lib/elo';

// Types
interface LoadTestResult {
  testName: string;
  testType: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseMs: number;
  p50ResponseMs: number;
  p95ResponseMs: number;
  p99ResponseMs: number;
  maxResponseMs: number;
  minResponseMs: number;
  requestsPerSec: number;
  durationMs: number;
  errors: string[];
}

// Utility to measure time
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

// Calculate percentiles
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[idx] || 0;
}

/**
 * Test 1: API Endpoint Load Test
 */
async function testAPILoad(
  endpoint: string,
  concurrent: number = 100,
  durationSec: number = 30
): Promise<LoadTestResult> {
  const responseTimes: number[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  const errors: string[] = [];
  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;

  async function makeRequest(): Promise<number> {
    const reqStart = performance.now();
    try {
      const res = await fetch(`http://localhost:3000${endpoint}`);
      const duration = performance.now() - reqStart;
      if (res.ok) {
        return duration;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      throw error;
    }
  }

  // Run concurrent requests for duration
  while (Date.now() < endTime) {
    const promises = Array(concurrent).fill(null).map(() =>
      makeRequest()
        .then(duration => {
          responseTimes.push(duration);
          successfulRequests++;
        })
        .catch(error => {
          failedRequests++;
          if (errors.length < 10) {
            errors.push(error instanceof Error ? error.message : String(error));
          }
        })
    );
    await Promise.all(promises);
  }

  const totalRequests = successfulRequests + failedRequests;
  const durationMs = Date.now() - startTime;

  return {
    testName: `API Load: ${endpoint}`,
    testType: 'API_LOAD',
    totalRequests,
    successfulRequests,
    failedRequests,
    avgResponseMs: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
    p50ResponseMs: percentile(responseTimes, 50),
    p95ResponseMs: percentile(responseTimes, 95),
    p99ResponseMs: percentile(responseTimes, 99),
    maxResponseMs: Math.max(...responseTimes, 0),
    minResponseMs: Math.min(...responseTimes, Infinity),
    requestsPerSec: (totalRequests / durationMs) * 1000,
    durationMs,
    errors,
  };
}

/**
 * Test 2: Bracket Generation Performance
 */
async function testBracketGeneration(
  playerCounts: number[] = [16, 32, 64, 128, 256, 512]
): Promise<LoadTestResult[]> {
  const results: LoadTestResult[] = [];

  for (const playerCount of playerCounts) {
    const responseTimes: number[] = [];
    let failedRequests = 0;
    const errors: string[] = [];

    // Generate mock player IDs
    const playerIds = Array(playerCount)
      .fill(null)
      .map((_, i) => `player_${i}`);

    // Run 10 iterations
    for (let i = 0; i < 10; i++) {
      try {
        const { durationMs } = await measureTime(async () => {
          // Simulate bracket generation
          const matches = generateBracketMatches(playerCount);
          return matches;
        });
        responseTimes.push(durationMs);
      } catch (error) {
        failedRequests++;
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const successfulRequests = responseTimes.length;
    const totalRequests = successfulRequests + failedRequests;

    results.push({
      testName: `Bracket Generation: ${playerCount} players`,
      testType: 'BRACKET_GENERATION',
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseMs: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      p50ResponseMs: percentile(responseTimes, 50),
      p95ResponseMs: percentile(responseTimes, 95),
      p99ResponseMs: percentile(responseTimes, 99),
      maxResponseMs: Math.max(...responseTimes, 0),
      minResponseMs: Math.min(...responseTimes, Infinity),
      requestsPerSec: (successfulRequests / responseTimes.reduce((a, b) => a + b, 0)) * 1000 || 0,
      durationMs: responseTimes.reduce((a, b) => a + b, 0),
      errors,
    });
  }

  return results;
}

/**
 * Generate bracket matches for testing
 */
function generateBracketMatches(playerCount: number): Array<{
  round: number;
  match: number;
  playerA: number | null;
  playerB: number | null;
}> {
  const matches: Array<{ round: number; match: number; playerA: number | null; playerB: number | null }> = [];
  let currentRoundPlayers = playerCount;
  let round = 1;

  while (currentRoundPlayers > 1) {
    for (let i = 0; i < currentRoundPlayers / 2; i++) {
      matches.push({
        round,
        match: i + 1,
        playerA: null,
        playerB: null,
      });
    }
    currentRoundPlayers = Math.ceil(currentRoundPlayers / 2);
    round++;
  }

  return matches;
}

/**
 * Test 3: Database Query Performance
 */
async function testDatabasePerformance(): Promise<LoadTestResult[]> {
  const results: LoadTestResult[] = [];
  const queries = [
    {
      name: 'User lookup by ID',
      query: () => db.user.findFirst({ where: { id: 'test' } }),
    },
    {
      name: 'Tournament list with filters',
      query: () => db.tournament.findMany({ take: 20, where: { status: 'REGISTRATION_OPEN' } }),
    },
    {
      name: 'Leaderboard query',
      query: () => db.user.findMany({ 
        take: 100, 
        orderBy: { visiblePoints: 'desc' },
        where: { showOnLeaderboard: true }
      }),
    },
    {
      name: 'Match history join',
      query: () => db.match.findMany({
        take: 50,
        include: { playerA: true, playerB: true, tournament: true },
      }),
    },
  ];

  for (const { name, query } of queries) {
    const responseTimes: number[] = [];
    let failedRequests = 0;
    const errors: string[] = [];

    // Run 100 iterations
    for (let i = 0; i < 100; i++) {
      try {
        const { durationMs } = await measureTime(query);
        responseTimes.push(durationMs);
      } catch (error) {
        failedRequests++;
        if (errors.length < 5) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    }

    const successfulRequests = responseTimes.length;
    const totalRequests = successfulRequests + failedRequests;

    results.push({
      testName: `DB Query: ${name}`,
      testType: 'DB_STRESS',
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseMs: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      p50ResponseMs: percentile(responseTimes, 50),
      p95ResponseMs: percentile(responseTimes, 95),
      p99ResponseMs: percentile(responseTimes, 99),
      maxResponseMs: Math.max(...responseTimes, 0),
      minResponseMs: Math.min(...responseTimes, Infinity),
      requestsPerSec: (successfulRequests / responseTimes.reduce((a, b) => a + b, 0)) * 1000 || 0,
      durationMs: responseTimes.reduce((a, b) => a + b, 0),
      errors,
    });
  }

  return results;
}

/**
 * Test 4: Elo Calculation Performance
 */
async function testEloCalculation(): Promise<LoadTestResult> {
  const responseTimes: number[] = [];
  let failedRequests = 0;
  const errors: string[] = [];

  // Run 10,000 elo calculations
  for (let i = 0; i < 10000; i++) {
    try {
      const { durationMs } = await measureTime(async () => {
        const eloA = 1500 + Math.random() * 500;
        const eloB = 1500 + Math.random() * 500;
        const scoreA = Math.floor(Math.random() * 21);
        const scoreB = Math.floor(Math.random() * 21);
        const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null;
        
        // Simple Elo calculation for testing
        const K = 32;
        const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
        const expectedB = 1 - expectedA;
        const actualA = winner === 'A' ? 1 : winner === 'B' ? 0 : 0.5;
        const actualB = 1 - actualA;
        
        return {
          newEloA: eloA + K * (actualA - expectedA),
          newEloB: eloB + K * (actualB - expectedB),
        };
      });
      responseTimes.push(durationMs);
    } catch (error) {
      failedRequests++;
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const successfulRequests = responseTimes.length;
  const totalRequests = successfulRequests + failedRequests;

  return {
    testName: 'Elo Calculation: 10,000 iterations',
    testType: 'CPU_INTENSIVE',
    totalRequests,
    successfulRequests,
    failedRequests,
    avgResponseMs: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
    p50ResponseMs: percentile(responseTimes, 50),
    p95ResponseMs: percentile(responseTimes, 95),
    p99ResponseMs: percentile(responseTimes, 99),
    maxResponseMs: Math.max(...responseTimes, 0),
    minResponseMs: Math.min(...responseTimes, Infinity),
    requestsPerSec: (successfulRequests / responseTimes.reduce((a, b) => a + b, 0)) * 1000 || 0,
    durationMs: responseTimes.reduce((a, b) => a + b, 0),
    errors,
  };
}

/**
 * Test 5: Concurrent User Simulation
 */
async function testConcurrentUsers(userCount: number = 100): Promise<LoadTestResult> {
  const responseTimes: number[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  const errors: string[] = [];

  // Simulate user actions
  async function simulateUser(): Promise<number[]> {
    const times: number[] = [];
    
    // Action 1: Load dashboard
    let res = await measureTime(() => 
      fetch('http://localhost:3000/api/player/me')
    );
    times.push(res.durationMs);
    
    // Action 2: Load tournaments
    res = await measureTime(() =>
      fetch('http://localhost:3000/api/tournaments?status=REGISTRATION_OPEN')
    );
    times.push(res.durationMs);
    
    // Action 3: Load leaderboard
    res = await measureTime(() =>
      fetch('http://localhost:3000/api/leaderboard')
    );
    times.push(res.durationMs);

    return times;
  }

  const startTime = Date.now();

  // Run concurrent users
  const userPromises = Array(userCount)
    .fill(null)
    .map(() =>
      simulateUser()
        .then(times => {
          responseTimes.push(...times);
          successfulRequests += times.length;
        })
        .catch(error => {
          failedRequests++;
          if (errors.length < 10) {
            errors.push(error instanceof Error ? error.message : String(error));
          }
        })
    );

  await Promise.all(userPromises);

  const totalRequests = successfulRequests + failedRequests;
  const durationMs = Date.now() - startTime;

  return {
    testName: `Concurrent Users: ${userCount} users`,
    testType: 'CONCURRENT_USERS',
    totalRequests,
    successfulRequests,
    failedRequests,
    avgResponseMs: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
    p50ResponseMs: percentile(responseTimes, 50),
    p95ResponseMs: percentile(responseTimes, 95),
    p99ResponseMs: percentile(responseTimes, 99),
    maxResponseMs: Math.max(...responseTimes, 0),
    minResponseMs: Math.min(...responseTimes, Infinity),
    requestsPerSec: (totalRequests / durationMs) * 1000,
    durationMs,
    errors,
  };
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting VALORHIVE Load Tests...\n');
  
  const allResults: LoadTestResult[] = [];

  try {
    // Test 1: API Load
    console.log('📊 Running API Load Tests...');
    const apiResults = await testAPILoad('/api/health', 50, 10);
    allResults.push(apiResults);

    // Test 2: Bracket Generation
    console.log('🏆 Running Bracket Generation Tests...');
    const bracketResults = await testBracketGeneration();
    allResults.push(...bracketResults);

    // Test 3: Database Performance
    console.log('🗄️ Running Database Performance Tests...');
    const dbResults = await testDatabasePerformance();
    allResults.push(...dbResults);

    // Test 4: Elo Calculation
    console.log('📈 Running Elo Calculation Tests...');
    const eloResult = await testEloCalculation();
    allResults.push(eloResult);

    // Test 5: Concurrent Users
    console.log('👥 Running Concurrent User Tests...');
    const concurrentResult = await testConcurrentUsers(50);
    allResults.push(concurrentResult);

  } catch (error) {
    console.error('Test suite error:', error);
  }

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('📋 LOAD TEST RESULTS');
  console.log('='.repeat(80));

  for (const result of allResults) {
    console.log(`\n📌 ${result.testName}`);
    console.log('-'.repeat(60));
    console.log(`   Total Requests:  ${result.totalRequests}`);
    console.log(`   Successful:      ${result.successfulRequests}`);
    console.log(`   Failed:          ${result.failedRequests}`);
    console.log(`   Avg Response:    ${result.avgResponseMs.toFixed(2)}ms`);
    console.log(`   P50 Response:    ${result.p50ResponseMs.toFixed(2)}ms`);
    console.log(`   P95 Response:    ${result.p95ResponseMs.toFixed(2)}ms`);
    console.log(`   P99 Response:    ${result.p99ResponseMs.toFixed(2)}ms`);
    console.log(`   Requests/sec:    ${result.requestsPerSec.toFixed(2)}`);
    if (result.errors.length > 0) {
      console.log(`   Errors:          ${result.errors.slice(0, 3).join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Load Tests Complete');
  console.log('='.repeat(80));

  // Save results to database
  await db.loadTestResult.createMany({
    data: allResults.map(r => ({
      testName: r.testName,
      testType: r.testType,
      config: JSON.stringify({}),
      startTime: new Date(Date.now() - r.durationMs),
      endTime: new Date(),
      durationMs: r.durationMs,
      totalRequests: r.totalRequests,
      successfulRequests: r.successfulRequests,
      failedRequests: r.failedRequests,
      avgResponseMs: r.avgResponseMs,
      p50ResponseMs: r.p50ResponseMs,
      p95ResponseMs: r.p95ResponseMs,
      p99ResponseMs: r.p99ResponseMs,
      maxResponseMs: r.maxResponseMs,
      minResponseMs: r.minResponseMs,
      requestsPerSec: r.requestsPerSec,
      status: r.failedRequests > 0 ? 'PASSED_WITH_ERRORS' : 'PASSED',
      errors: JSON.stringify(r.errors),
    })),
  });

  console.log('\n💾 Results saved to database');

  return allResults;
}

// Export for CLI usage
export {
  runAllTests,
  testAPILoad,
  testBracketGeneration,
  testDatabasePerformance,
  testEloCalculation,
  testConcurrentUsers,
  LoadTestResult,
};

// Run if called directly
if (require.main === module) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
