import {discover, rankOpportunities} from './pipeline.js';
import {addExperiment, startExperiment, recordReadout, recordDecision, recordOutcomeReview, learningLedger} from './lifecycle.js';
import {RunStore, Conflict} from './store.js';
import auditor from './worker.js';
import {buildLearningMemory, searchLearningMemory} from '../../product_learning_memory/src/memory.js';
import {calibrateRuns} from '../../decision_calibration_engine/src/calibration.js';
import {assessEvidenceIntegrity} from '../../evidence_integrity_monitor/src/integrity.js';
import {planFromIntegrity} from '../../research_portfolio_optimizer/src/optimizer.js';
import {auditStrategyAlignment} from '../../strategy_alignment_auditor/src/alignment.js';
import {rebalancePortfolio} from '../../portfolio_rebalancing_simulator/src/rebalance.js';
import {stressPortfolio} from '../../portfolio_resilience_stress_tester/src/stress.js';
import {trackBenefits} from '../../benefits_realization_tracker/src/benefits.js';
import {reviewInvestments} from '../../investment_assurance_review/src/assurance.js';
import {assessAssumptions} from '../../assumption_risk_register/src/assumptions.js';
import {assessReleaseReadiness} from '../../release_readiness_controller/src/readiness.js';
import {analyzeAdoption} from '../../feature_adoption_analyzer/src/adoption.js';
import {planLifecycle} from '../../product_lifecycle_planner/src/lifecycle.js';
import {monitorSunsets} from '../../sunset_migration_monitor/src/monitor.js';
import {reviewSunsetOutcomes} from '../../sunset_outcome_monitor/src/outcomes.js';
import {buildDecisionProvenancePacks} from '../../decision_provenance_pack/src/provenance.js';

const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const json = (value, status = 200) => Response.json(value, {status, headers});

async function body(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') throw new Error('Use application/json');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Request body required');
  const chunks = []; let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_000_000) {await reader.cancel(); throw new RangeError('Request exceeds 2 MB');}
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('JSON object required');
  return parsed;
}

async function authorized(request, token) {
  const provided = request.headers.get('Authorization') ?? '';
  const hash = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([hash(provided), hash(`Bearer ${token}`)]);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({service: 'prodmind-connected-workflow', configured: Boolean(env.DB && env.API_TOKEN)});
    if (!url.pathname.startsWith('/api/')) {
      if (!env.ASSETS) return json({error: 'Static assets unavailable'}, 503);
      const response = await env.ASSETS.fetch(request);
      return new Response(response.body, {status: response.status, headers: {...Object.fromEntries(response.headers), ...headers}});
    }
    if (!env.API_TOKEN) return json({error: 'Set API_TOKEN before using the workspace'}, 503);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({error: 'Cross-origin requests are not allowed'}, 403);
    if (!await authorized(request, env.API_TOKEN)) return json({error: 'Unauthorized'}, 401);
    if (url.pathname === '/api/audit') return auditor.fetch(request, env);
    if (!env.DB) return json({error: 'Persistent D1 storage is required; no ephemeral success is returned'}, 503);
    const store = new RunStore(env.DB);
    try {
      if (url.pathname === '/api/runs' && request.method === 'GET') return json({runs: await store.list()});
      if (url.pathname === '/api/runs' && request.method === 'POST') return json(await store.create(await discover(await body(request))), 201);
      if (url.pathname === '/api/memory' && request.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const memory = buildLearningMemory(await store.recent(limit));
        const query = url.searchParams.get('q');
        if (!query) return json(memory);
        const filters = Object.fromEntries(['outcome','status'].flatMap(key => url.searchParams.get(key) ? [[key,url.searchParams.get(key)]] : []));
        return json({...searchLearningMemory(memory, query, filters), summary: memory.summary});
      }
      if (url.pathname === '/api/calibration' && request.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        return json(calibrateRuns(await store.recent(limit)));
      }
      if (url.pathname === '/api/evidence-integrity' && request.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        return json(assessEvidenceIntegrity(await store.recent(limit)));
      }
      if (url.pathname === '/api/research-plan' && request.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const capacity = Number(url.searchParams.get('capacity') ?? 8);
        return json(planFromIntegrity(assessEvidenceIntegrity(await store.recent(limit)), capacity));
      }
      if (url.pathname === '/api/strategy-audit' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        return json(auditStrategyAlignment(await store.recent(limit), await body(request)));
      }
      if (url.pathname === '/api/portfolio-rebalance' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const input = await body(request);
        return json(rebalancePortfolio(await store.recent(limit), input.strategy, {capacity: input.capacity, lockedOpportunityIds: input.lockedOpportunityIds, lockedPortfolioItemIds: input.lockedPortfolioItemIds}));
      }
      if (url.pathname === '/api/portfolio-stress' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const input = await body(request);
        return json(stressPortfolio(await store.recent(limit), input.strategy, {capacity:input.capacity, portfolioItemIds:input.portfolioItemIds, scenarios:input.scenarios}));
      }
      if (url.pathname === '/api/benefits-realization' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        return json(trackBenefits(await store.recent(limit), await body(request)));
      }
      if (url.pathname === '/api/investment-assurance' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const input = await body(request);
        const runs = await store.recent(limit);
        const benefitReport = trackBenefits(runs, {benefits:input.benefits, asOf:input.asOf});
        return json(reviewInvestments(runs, benefitReport, {reviews:input.reviews}));
      }
      if (url.pathname === '/api/assumption-risk' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        return json(assessAssumptions(await store.recent(limit), await body(request)));
      }
      if (url.pathname === '/api/release-readiness' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const input = await body(request); const runs = await store.recent(limit);
        const assumptions = assessAssumptions(runs, {assumptions:input.assumptions, asOf:input.asOf});
        return json(assessReleaseReadiness(runs, assumptions, {releases:input.releases}));
      }
      if (url.pathname === '/api/feature-adoption' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const input = await body(request); const runs = await store.recent(limit);
        const assumptions = assessAssumptions(runs, {assumptions: input.assumptions, asOf: input.asOf});
        const readiness = assessReleaseReadiness(runs, assumptions, {releases: input.releases});
        return json(analyzeAdoption(runs, readiness, {journeys: input.journeys}));
      }
      if (url.pathname === '/api/product-lifecycle' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const input = await body(request); const runs = await store.recent(limit);
        const assumptions = assessAssumptions(runs, {assumptions: input.assumptions, asOf: input.asOf});
        const readiness = assessReleaseReadiness(runs, assumptions, {releases: input.releases});
        const adoption = analyzeAdoption(runs, readiness, {journeys: input.journeys});
        return json(planLifecycle(runs, adoption, {plans: input.plans}));
      }
      if (url.pathname === '/api/sunset-migration' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const input = await body(request); const runs = await store.recent(limit);
        const assumptions = assessAssumptions(runs, {assumptions: input.assumptions, asOf: input.asOf});
        const readiness = assessReleaseReadiness(runs, assumptions, {releases: input.releases});
        const adoption = analyzeAdoption(runs, readiness, {journeys: input.journeys});
        const lifecycle = planLifecycle(runs, adoption, {plans: input.plans});
        return json(monitorSunsets(runs, lifecycle, {snapshots: input.snapshots}));
      }
      if (url.pathname === '/api/sunset-outcomes' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const input = await body(request); const runs = await store.recent(limit);
        const assumptions = assessAssumptions(runs, {assumptions: input.assumptions, asOf: input.asOf});
        const readiness = assessReleaseReadiness(runs, assumptions, {releases: input.releases});
        const adoption = analyzeAdoption(runs, readiness, {journeys: input.journeys});
        const lifecycle = planLifecycle(runs, adoption, {plans: input.plans});
        const sunset = monitorSunsets(runs, lifecycle, {snapshots: input.snapshots});
        return json(reviewSunsetOutcomes(runs, sunset, {reviews: input.reviews}));
      }
      if (url.pathname === '/api/governance-pack' && request.method === 'POST') {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const input = await body(request); const runs = await store.recent(limit);
        const assumptions = assessAssumptions(runs, {assumptions: input.assumptions, asOf: input.asOf});
        const readiness = assessReleaseReadiness(runs, assumptions, {releases: input.releases});
        const adoption = analyzeAdoption(runs, readiness, {journeys: input.journeys});
        const lifecycle = planLifecycle(runs, adoption, {plans: input.plans});
        const sunset = monitorSunsets(runs, lifecycle, {snapshots: input.snapshots});
        const outcomes = reviewSunsetOutcomes(runs, sunset, {reviews: input.reviews});
        return json(await buildDecisionProvenancePacks(runs, {assumptions, readiness, adoption, lifecycle, sunset, outcomes}, {packs: input.packs}));
      }
      const match = /^\/api\/runs\/([\w-]+)(?:\/(rank|experiments|learning)(?:\/([\w-]+)\/(start|readout|decision|monitor))?)?$/.exec(url.pathname);
      if (!match) return json({error: 'Not found'}, 404);
      const [, runId, action, experimentId, transition] = match;
      const run = await store.get(runId);
      if (!run) return json({error: 'Run not found'}, 404);
      if (request.method === 'GET' && !action) return json(run);
      if (request.method === 'GET' && action === 'learning') return json({runId, learning: learningLedger(run)});
      if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405);
      const input = await body(request);
      if (!Number.isInteger(input.version) || input.version !== run.version) throw new Conflict('Version changed; reload the run');
      let next;
      if (action === 'rank') next = rankOpportunities(run, input);
      else if (action === 'experiments' && !experimentId) next = addExperiment(run, input);
      else if (action === 'experiments' && transition === 'start') next = startExperiment(run, experimentId);
      else if (action === 'experiments' && transition === 'readout') next = recordReadout(run, experimentId, input);
      else if (action === 'experiments' && transition === 'decision') next = recordDecision(run, experimentId, input);
      else if (action === 'learning' && transition === 'monitor') next = recordOutcomeReview(run, experimentId, input);
      else return json({error: 'Not found'}, 404);
      return json(await store.save(next, input.version));
    } catch (error) {
      if (error instanceof Conflict) return json({error: error.message}, 409);
      if (/D1_|SQLITE|database|storage/i.test(error.message)) return json({error: 'Storage operation failed; no success was recorded'}, 503);
      return json({error: error.message}, error instanceof RangeError ? 413 : 422);
    }
  },
};
