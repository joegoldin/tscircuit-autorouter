# Router Clearance Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development when subagents are available; otherwise use executing-plans in a separate execution session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a complete declarative ESP LED Controller route that honors its copper dimensions and passes the 0.15 mm router fixture, KiCad DRC, and tscircuit shorts checks.

**Architecture:** Add one nonnegative regional-cost callback to Tiny and feed it a fixed per-attempt penalty map from Pipeline 7. Add an explicit coupled broad-repair portfolio phase that operates on actual copper dimensions. Pipeline 7 reruns from the untouched SRJ at most 12 times, increments implicated regions by 0.5, and fails loudly if valid copper cannot be produced.

**Tech Stack:** TypeScript, Bun test runner, Tiny Hypergraph, tscircuit capacity autorouter Pipeline 7, high-density-repair03, tsci 0.0.2463/core 0.0.1837, KiCad 10.

**Execution priority, updated by Joe on 2026-09-05:** Finish the in-flight
shared-edge discovery, bounded via/pad movement and Tiny timeout-feasibility
corrections, then publish/pin matching fork source and regenerate the actual ESP
board. Remaining generic fixture failures are diagnostic backlog unless their
mechanism is shown to block this design. Record measured before/after board
results and fix actual board blockers through completion. Keep all acceptance
requirements below; do not defer the first actual-board rerun until every
unrelated fixture is repaired.

## Global Constraints

- Start every routing attempt from the untouched SimpleRouteJson.
- Require 0.15 mm clearance on the router fixture and the board's declared 0.127 mm manufacturing clearance.
- Preserve the board's 18 power traces at 0.5 mm and 16 RF traces at 0.3 mm where legal.
- Preserve 0.5/0.2 mm via pad/hole dimensions, endpoint layers, terminal identities, explicit transitions, merged-net aliases, and original route completeness.
- Do not use Bun patches, install-time edits, production monkey-patching, manual KiCad copper repair, geometry inflation, reduced validation, or success on empty or invalid output.
- Keep `GlobalDrcForceImproveSolver`'s existing best-effort completion contract. Pipeline 7 remains responsible for rejecting residual errors.
- Keep each new test in its own file.
- Do not format or lint the router repository.
- Do not update the repair repository's four known SVG snapshots merely to obtain a green suite.
- Do not merge unfinished work into the board repository's `main` branch.

---

### Task 1: Add and propagate Tiny's regional-cost adjustment

**Files:**
- Modify: `/private/tmp/esp-clearance-implementation/tiny-hypergraph/lib/core.ts`
- Modify: `/private/tmp/esp-clearance-implementation/tiny-hypergraph/lib/section-solver/TinyHyperGraphSectionPipelineSolver.ts`
- Test: `/private/tmp/esp-clearance-implementation/tiny-hypergraph/tests/solver/region-cost-adjustment.test.ts`
- Test: `/private/tmp/esp-clearance-implementation/tiny-hypergraph/tests/solver/section-region-cost-adjustment.test.ts`

**Interfaces:**
- Produces: `TinyHyperGraphRegionCostContext` and `TinyHyperGraphRegionCostAdjustment` exported from `lib/core.ts` through the existing `lib/index.ts` exports.
- Produces: `regionCostAdjustment?: TinyHyperGraphRegionCostAdjustment` on `TinyHyperGraphSolverOptions` and `TinyHyperGraphSectionPipelineInput`.
- Contract: adjustment results are finite and nonnegative; invalid results throw `Invalid regional cost adjustment for region ${regionId}: ${adjustment}`.

- [ ] **Step 1: Write the direct-cost failing test**

Create a minimal two-region topology with `regionMetadata[0].capacityMeshNodeId === "dense"`. Construct a solver with this option and assert that both the cached cost and candidate delta include the same adjustment:

```ts
regionCostAdjustment: ({
  regionMetadata,
  sameLayerCrossings,
  crossLayerCrossings,
  entryExitLayerChanges,
}) => {
  if (regionMetadata?.capacityMeshNodeId !== "dense") return 0
  return 0.5 * (
    2 * sameLayerCrossings +
    crossLayerCrossings +
    entryExitLayerChanges
  )
}
```

After appending one segment, assert its `existingRegionCost` is the unadjusted cost plus the callback result. Then compute a second candidate through the region and assert its `g` delta reflects the new callback result rather than only the cached baseline.

- [ ] **Step 2: Verify the direct-cost test is red**

Run:

```sh
bun test tests/solver/region-cost-adjustment.test.ts --timeout 9999999
```

Expected: TypeScript/runtime failure because `regionCostAdjustment` is not supported.

- [ ] **Step 3: Add the callback types and shared cost calculation**

Add near `TinyHyperGraphSolverOptions`:

```ts
export interface TinyHyperGraphRegionCostContext {
  regionId: RegionId
  regionMetadata: Record<string, unknown> | undefined
  sameLayerCrossings: number
  crossLayerCrossings: number
  entryExitLayerChanges: number
  traceCount: number
}

export type TinyHyperGraphRegionCostAdjustment = (
  context: TinyHyperGraphRegionCostContext,
) => number
```

Add `regionCostAdjustment` to `TinyHyperGraphSolverOptions`, `TinyHyperGraphSolverOptionTarget`, `applyTinyHyperGraphSolverOptions`, `getTinyHyperGraphSolverOptions`, and `TinyHyperGraphSolver`. Change `computeRegionCostForRegion` to:

```ts
const baseCost = computeRegionCost(
  this.topology.regionWidth[regionId],
  this.topology.regionHeight[regionId],
  numSameLayerIntersections,
  numCrossLayerIntersections,
  numEntryExitChanges,
  traceCount,
  this.topology.regionAvailableZMask?.[regionId] ?? 0,
  this.minViaPadDiameter,
  this.TRACE_DENSITY_COST_FACTOR,
)
const adjustment = this.regionCostAdjustment?.({
  regionId,
  regionMetadata: this.topology.regionMetadata?.[regionId],
  sameLayerCrossings: numSameLayerIntersections,
  crossLayerCrossings: numCrossLayerIntersections,
  entryExitLayerChanges: numEntryExitChanges,
  traceCount,
}) ?? 0
if (!Number.isFinite(adjustment) || adjustment < 0) {
  throw new Error(
    `Invalid regional cost adjustment for region ${regionId}: ${adjustment}`,
  )
}
return baseCost + adjustment
```

- [ ] **Step 4: Verify the direct-cost test is green**

Run the command from Step 2. Expected: one passing test.

- [ ] **Step 5: Write the section-propagation failing test**

Use `sectionSolverFixtureGraph` with `TinyHyperGraphSectionPipelineSolver`. Pass one callback instance at the top level, solve, then assert strict identity on all available solvers:

```ts
expect(solveGraphSolver?.regionCostAdjustment).toBe(regionCostAdjustment)
expect(sectionSolver?.regionCostAdjustment).toBe(regionCostAdjustment)
expect(sectionSolver?.baselineSolver.regionCostAdjustment).toBe(
  regionCostAdjustment,
)
expect(sectionSolver?.optimizedSolver?.regionCostAdjustment).toBe(
  regionCostAdjustment,
)
```

- [ ] **Step 6: Verify the section-propagation test is red**

Run:

```sh
bun test tests/solver/section-region-cost-adjustment.test.ts --timeout 9999999
```

Expected: failure because the section-pipeline input does not forward the callback.

- [ ] **Step 7: Forward the callback through both section stages**

Add `regionCostAdjustment?: TinyHyperGraphRegionCostAdjustment` to `TinyHyperGraphSectionPipelineInput`. In both `getSolveGraphOptions()` and `getSectionSolverOptions()`, insert the top-level callback before the stage-specific options so an explicitly stage-specific value can still override it:

```ts
...(this.inputProblem.regionCostAdjustment === undefined
  ? {}
  : { regionCostAdjustment: this.inputProblem.regionCostAdjustment }),
```

Because the existing option-copy helpers are used for baseline replay, section search, candidate replay, and greedy final routing, do not add a second regional-cost implementation.

- [ ] **Step 8: Add invalid-result coverage and run Tiny verification**

Extend the direct-cost test with finite/nonnegative cases using `-1`, `NaN`, and `Infinity`. Run:

```sh
bun test tests/solver/region-cost-adjustment.test.ts tests/solver/section-region-cost-adjustment.test.ts tests/solver/single-layer-region-cost.test.ts tests/solver/trace-density-region-cost.test.ts --timeout 9999999
bun run typecheck
```

Expected: all focused tests and typecheck pass.

- [ ] **Step 9: Commit and push Tiny**

```sh
git add lib/core.ts lib/section-solver/TinyHyperGraphSectionPipelineSolver.ts tests/solver/region-cost-adjustment.test.ts tests/solver/section-region-cost-adjustment.test.ts
git commit -m "feat: add regional routing cost adjustment"
git push origin jlcpcb-clearance
```

---

### Task 2: Make repair forces use actual copper dimensions

**Files:**
- Modify: `/private/tmp/esp-clearance-implementation/high-density-repair03/lib/solvers/GlobalDrcForceImproveSolver/solverHelpers.ts`
- Test: `/private/tmp/esp-clearance-implementation/high-density-repair03/tests/broad-repulsion-actual-copper.test.ts`

**Interfaces:**
- Consumes: existing `HighDensityRoute.traceThickness`, point-level `traceThickness`, and `HighDensityRoute.viaDiameter`.
- Produces: segment and via radii that match the copper evaluated by Pipeline 7.

- [ ] **Step 1: Write the failing actual-copper test**

Create two independent cases in one test: a 0.5 mm tapered segment beside a foreign pad, and a 0.5 mm via beside a foreign pad. Give the SRJ a smaller `minTraceWidth` and `minViaDiameter`. Run one `applyBroadRepulsionForces` candidate and assert the final exact snapshot improves under the declared 0.15 mm clearance while input routes remain unchanged.

The segment points must include:

```ts
{ x: 0, y: 0, z: 0, traceThickness: 0.5 }
{ x: 1, y: 0, z: 0, traceThickness: 0.3 }
```

and the route must use `viaDiameter: 0.5` while the SRJ deliberately uses `minViaDiameter: 0.3`.

- [ ] **Step 2: Verify the actual-copper test is red**

Run:

```sh
bun test tests/broad-repulsion-actual-copper.test.ts --timeout 9999999
```

Expected: the broad candidate under-repels because obstacle thresholds use global minimum copper sizes.

- [ ] **Step 3: Compute per-object radii**

Change `collectSegmentsForRoute` so `Segment.radius` is conservative for the actual segment:

```ts
radius:
  Math.max(
    route.traceThickness ?? 0.1,
    start.traceThickness ?? 0,
    end.traceThickness ?? 0,
  ) / 2,
```

Use each `ViaNode.radius` and `Segment.radius` when computing obstacle search expansion and repulsion distance. Replace the two global thresholds with object-local values:

```ts
const requiredDistance =
  via.radius + getViaEdgeToPadEdgeClearance(srj)! + CLEARANCE_SLACK
```

and:

```ts
const requiredDistance =
  segment.radius + getTraceToPadEdgeClearance(srj) + CLEARANCE_SLACK
```

The broad-phase query may use the maximum collected radius plus clearance, but the exact repulsion call must use the individual object's required distance.

- [ ] **Step 4: Verify repair copper behavior**

Run:

```sh
bun test tests/broad-repulsion-actual-copper.test.ts tests/configured-broad-repulsion-clearance.test.ts tests/broad-repulsion-via-trace-clearance.test.ts --timeout 9999999
bun run typecheck
```

Expected: all focused tests and typecheck pass.

- [ ] **Step 5: Commit repair copper dimensions**

```sh
git add lib/solvers/GlobalDrcForceImproveSolver/solverHelpers.ts tests/broad-repulsion-actual-copper.test.ts
git commit -m "fix: use actual copper in broad repair"
```

---

### Task 3: Add an explicit coupled broad-repair portfolio operation

**Files:**
- Modify: `/private/tmp/esp-clearance-implementation/high-density-repair03/lib/solvers/GlobalDrcForceImproveSolver/types.ts`
- Modify: `/private/tmp/esp-clearance-implementation/high-density-repair03/lib/solvers/GlobalDrcForceImproveSolver/GlobalDrcBranchPortfolioSolver.ts`
- Test: `/private/tmp/esp-clearance-implementation/high-density-repair03/tests/coupled-broad-portfolio.test.ts`
- Test: `/private/tmp/esp-clearance-implementation/high-density-repair03/tests/coupled-broad-portfolio-exhaustion.test.ts`

**Interfaces:**
- Produces: `coupledBroadPassMultipliers?: readonly number[]` on `GlobalDrcBranchPortfolioSolverParams`.
- Contract: omitted means current behavior; `[1, 2]` evaluates at most two explicit candidates from the current accepted geometry with cleanup disabled.

- [ ] **Step 1: Promote the archived coupled reproduction into a failing portfolio test**

Copy the two-route geometry from `scratch/trace-pad-local-contact-repair.test.ts` into `tests/coupled-broad-portfolio.test.ts`. Instantiate `GlobalDrcBranchPortfolioSolver` with the exact `AutoroutingDrcEngine`, targeted repair enabled, and:

```ts
coupledBroadPassMultipliers: [1, 2],
```

Assert initial count is one, output count is zero, input is unchanged, route identities remain `signal` and `rail`, and endpoint coordinates/layers plus trace/via dimensions match the input.

- [ ] **Step 2: Verify the coupled portfolio test is red**

Run:

```sh
bun test tests/coupled-broad-portfolio.test.ts --timeout 9999999
```

Expected: type/runtime failure because the explicit operation does not exist.

- [ ] **Step 3: Add the bounded candidate schedule**

Validate each configured multiplier as finite and greater than zero. After baseline/targeted/safe-layer selection and before the via-in-pad phase, evaluate candidates from the currently accepted routes:

```ts
const candidateRoutes = applyBroadRepulsionForces(
  this.params.srj,
  acceptedRoutes,
  this.params.effort ?? 1,
  passMultiplier,
  this.params.connMap,
  false,
  false,
)
```

Evaluate with the same exact `drcEvaluator`. Select only when `isBetterDrcSnapshot` improves the current count/severity/via ordering. Stop early on zero errors. Record attempted multipliers, candidate counts/scores, accepted multiplier, and whether the coupled phase was accepted in `stats`.

Do not enable `GlobalDrcForceImproveSolver`'s large-board fallback and do not change its best-effort completion behavior.

- [ ] **Step 4: Verify the coupled portfolio test is green**

Run the command from Step 2. Expected: one passing test with zero final exact errors.

- [ ] **Step 5: Write and verify the exhaustion test**

Create an immovable terminal-pad conflict and configure `[1, 2]`. Assert the solver terminates, returns the best unchanged geometry with residual errors, reports both attempted multipliers, and does not claim the coupled phase was accepted.

Run:

```sh
bun test tests/coupled-broad-portfolio-exhaustion.test.ts --timeout 9999999
```

Expected after implementation: one passing test.

- [ ] **Step 6: Run focused and normal repair verification**

```sh
bun test tests/coupled-broad-portfolio.test.ts tests/coupled-broad-portfolio-exhaustion.test.ts tests/drc-branch-portfolio.test.ts tests/drc-branch-portfolio-regression.test.ts tests/force-improvement-best-effort.test.ts --timeout 9999999
bun test ./tests --timeout 9999999
bun run typecheck
```

Expected: focused tests and typecheck pass. The normal suite may retain only the four documented SVG `stroke-linejoin` snapshot failures reproduced on the baseline.

- [ ] **Step 7: Commit and push repair**

```sh
git add lib/solvers/GlobalDrcForceImproveSolver/types.ts lib/solvers/GlobalDrcForceImproveSolver/GlobalDrcBranchPortfolioSolver.ts tests/coupled-broad-portfolio.test.ts tests/coupled-broad-portfolio-exhaustion.test.ts
git commit -m "feat: add explicit coupled broad repair"
git push origin jlcpcb-clearance
```

---

### Task 4: Feed fixed regional penalties through the router's Tiny adapter

**Files:**
- Modify: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/package.json`
- Modify: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/lib/solvers/PortPointPathingSolver/hgportpointpathingsolver/types.ts`
- Modify: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver.ts`
- Test: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/tests/solvers/tinyhypergraph-regional-penalty.test.ts`
- Test: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/tests/solvers/tinyhypergraph-feedback-portfolio.test.ts`

**Interfaces:**
- Consumes: Tiny's `regionCostAdjustment` option from Task 1.
- Produces: `regionalCongestionPenaltyByNodeId?: ReadonlyMap<CapacityMeshNodeId, number>` on `HgPortPointPathingSolverParams`.
- Produces: `feedbackRegionCost` on `DownstreamCandidateSummary`.

- [ ] **Step 1: Pin Tiny and install router dependencies**

Replace only the `tiny-hypergraph` commit with the exact Task 1 commit:

```sh
tiny_commit=$(git -C /private/tmp/esp-clearance-implementation/tiny-hypergraph rev-parse HEAD)
bun pm pkg set "devDependencies.tiny-hypergraph=git+https://github.com/joegoldin/tiny-hypergraph.git#$tiny_commit"
```

Keep `tiny-hypergraph-poly` unchanged. Install with:

```sh
BUN_INSTALL_CACHE_DIR=/tmp/esp-clearance-bun-cache TMPDIR=/tmp bun install
```

- [ ] **Step 2: Write the adapter propagation failing test**

Build the smallest adapter graph containing metadata IDs `preferred` and `penalized`. Supply:

```ts
regionalCongestionPenaltyByNodeId: new Map([["penalized", 0.5]])
```

Assert the created primary pipeline, duplicate-port prepass solver when present, and section replay solvers expose the same nonzero adjustment for `penalized` and zero for `preferred`.

- [ ] **Step 3: Verify the adapter propagation test is red**

```sh
bun test tests/solvers/tinyhypergraph-regional-penalty.test.ts --timeout 9999999
```

Expected: failure because the adapter parameter and callback do not exist.

- [ ] **Step 4: Add the adapter callback**

Add the read-only map to the parameter type. In `getTinyHyperGraphPipelineInput`, create one callback closed over the map:

```ts
const regionCostAdjustment: TinyHyperGraphRegionCostAdjustment = ({
  regionMetadata,
  sameLayerCrossings,
  crossLayerCrossings,
  entryExitLayerChanges,
}) => {
  const capacityMeshNodeId = regionMetadata?.capacityMeshNodeId
  if (typeof capacityMeshNodeId !== "string") return 0
  const penalty = regionalCongestionPenaltyByNodeId?.get(capacityMeshNodeId) ?? 0
  return penalty * (
    2 * sameLayerCrossings +
    crossLayerCrossings +
    entryExitLayerChanges
  )
}
```

Pass the callback through the top-level section pipeline input and duplicate-port `routeSolveOptions`. Reject negative or non-finite map entries at the adapter boundary.

- [ ] **Step 5: Write the portfolio-scoring failing test**

Add `feedbackRegionCost` to the local candidate factory. Assert an alternative with otherwise acceptable density metrics is rejected when its feedback score is higher, and accepted when its feedback score is lower without violating the existing Pf/density constraints.

- [ ] **Step 6: Verify the portfolio-scoring test is red**

```sh
bun test tests/solvers/tinyhypergraph-feedback-portfolio.test.ts --timeout 9999999
```

Expected: failure because summaries do not contain or compare `feedbackRegionCost`.

- [ ] **Step 7: Add comparable feedback scoring**

In `summarizePipelineCandidate`, compute the callback contribution from each region's cached intersection counts using the stable metadata ID. Sum it into `feedbackRegionCost`. In `shouldSelectTraceDensityAlternative`, reject an alternative when:

```ts
alternative.feedbackRegionCost > primary.feedbackRegionCost
```

Do not compare total Tiny costs because primary and alternative candidates intentionally use different trace-density factors.

- [ ] **Step 8: Verify adapter behavior and commit**

```sh
bun test tests/solvers/tinyhypergraph-regional-penalty.test.ts tests/solvers/tinyhypergraph-feedback-portfolio.test.ts tests/solvers/tinyhypergraph-candidate-portfolio.test.ts tests/tinyhypergraph-pipeline-error-propagation.test.ts --timeout 9999999
bun run build
git add package.json lib/solvers/PortPointPathingSolver/hgportpointpathingsolver/types.ts lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver.ts tests/solvers/tinyhypergraph-regional-penalty.test.ts tests/solvers/tinyhypergraph-feedback-portfolio.test.ts
git commit -m "feat: route with regional congestion penalties"
```

---

### Task 5: Add bounded Pipeline 7 feedback and coupled repair

**Files:**
- Modify: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/package.json`
- Modify: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph.ts`
- Create: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/get-clearance-feedback-node-ids.ts`
- Test: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/tests/pipeline7-clearance-feedback-node-mapping.test.ts`
- Test: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/tests/pipeline7-clearance-feedback-retry.test.ts`
- Test: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/tests/pipeline7-clearance-feedback-exhaustion.test.ts`
- Test: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/tests/pipeline7-one-gap-coupled-repair.test.ts`

**Interfaces:**
- Consumes: repair Task 3 and router Task 4.
- Produces: `clearanceFeedbackMaxAttempts?: number` in Pipeline 7 options, default 12.
- Produces stats: `clearanceFeedbackAttemptCount`, `clearanceFeedbackPenalties`, and `clearanceFeedbackRetryCount`.

- [ ] **Step 1: Pin repair and install the router dependency**

Replace only the `high-density-repair03` commit with the Task 3 commit, then rerun the restricted-cache `bun install` command from Task 4.

- [ ] **Step 2: Write the node-mapping failing test**

Export `getClearanceFeedbackNodeIds(errors, capacityNodes)`. Test inclusive rectangular bounds, duplicate errors in one node, errors spanning different nodes, missing centers, and centers outside every node. The function returns a `Set<CapacityMeshNodeId>` only when every error maps; otherwise it throws:

```text
Pipeline7 cannot map clearance error to a capacity node
```

- [ ] **Step 3: Verify node mapping is red, then implement it**

```sh
bun test tests/pipeline7-clearance-feedback-node-mapping.test.ts --timeout 9999999
```

Implement a direct scan using each node's center/width/height and inclusive half extents. Rerun; expected: one passing test.

- [ ] **Step 4: Write the retry-state failing test**

Use a small injectable pipeline fixture or subclass that emits one centered final error on attempt one and no errors on attempt two. Assert:

```ts
expect(solver.stats.clearanceFeedbackAttemptCount).toBe(2)
expect(solver.stats.clearanceFeedbackRetryCount).toBe(1)
expect(solver.stats.clearanceFeedbackPenalties).toEqual([["node-a", 0.5]])
expect(originalSrj).toEqual(inputBeforeSolve)
```

Also assert the second attempt's Tiny adapter receives a fixed map and the first attempt's derived traces are absent from its SRJ.

- [ ] **Step 5: Verify retry state is red**

```sh
bun test tests/pipeline7-clearance-feedback-retry.test.ts --timeout 9999999
```

Expected: failure because final validation immediately fails.

- [ ] **Step 6: Implement bounded retry state**

Add constants:

```ts
const DEFAULT_CLEARANCE_FEEDBACK_MAX_ATTEMPTS = 12
const CLEARANCE_FEEDBACK_PENALTY_INCREMENT = 0.5
```

Keep `originalSrj` immutable after construction. At final exact validation, succeed on zero errors. Otherwise map errors, fail when the configured attempt limit is exhausted, increment each mapped node once, reset every derived stage reference and routing datum, restore `structuredClone(this.originalSrj)`, call `setSimpleRouteJson`, set `currentPipelineStepIndex = 0`, and continue. Do not retry stage failures.

Pass a snapshot of the current map into the `portPointPathingSolver` constructor:

```ts
regionalCongestionPenaltyByNodeId: new Map(
  cms.clearanceFeedbackPenaltyByNodeId,
),
```

Scale the outer `MAX_ITERATIONS` for the configured attempt count without weakening any inner solver limit.

- [ ] **Step 7: Write and implement exhaustion behavior**

Use the existing terminal-clearance fixture with `clearanceFeedbackMaxAttempts: 2`. Assert failure, exactly two attempts, residual error text, and no readable output. Run:

```sh
bun test tests/pipeline7-clearance-feedback-exhaustion.test.ts tests/pipeline7-rejects-final-clearance-errors.test.ts --timeout 9999999
```

Expected: both pass.

- [ ] **Step 8: Write the saved one-gap coupled-repair test**

Load `docs/clearance-evidence/one-gap-fixture.json`, reconstruct the production Pipeline 7 evaluator exactly as `scripts/clearance-investigation/gap-probe.ts` does, and run `GlobalDrcBranchPortfolioSolver` with:

```ts
coupledBroadPassMultipliers: [1, 2],
enableBroadFallback: false,
enableLargeBoardBroadFallback: false,
enablePostSolveClearanceRelaxation: false,
```

Require 148 nonempty routes, zero exact errors, unchanged source artifact, preserved names/root aliases, endpoint coordinates/layers/terminal IDs, point and route widths, and valid coincident layer transitions. Do not load `coupled-repair-hd-routes.json` as output.

- [ ] **Step 9: Verify one-gap repair and wire it into Pipeline 7**

```sh
bun test tests/pipeline7-one-gap-coupled-repair.test.ts --timeout 9999999
```

In the Pipeline 7 exact portfolio parameters, add `coupledBroadPassMultipliers: [1, 2]` while retaining the exact evaluator, terminal locking, disabled implicit broad fallback, and final post-expansion gate. Rerun the test; expected: pass.

- [ ] **Step 10: Run focused router verification and commit**

```sh
bun test tests/pipeline7-clearance-feedback-node-mapping.test.ts tests/pipeline7-clearance-feedback-retry.test.ts tests/pipeline7-clearance-feedback-exhaustion.test.ts tests/pipeline7-one-gap-coupled-repair.test.ts tests/pipeline7-rejects-final-clearance-errors.test.ts tests/pipeline7-and-pipeline9-progress.test.ts --timeout 9999999
bun run build
git add package.json lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph.ts lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/get-clearance-feedback-node-ids.ts tests/pipeline7-clearance-feedback-node-mapping.test.ts tests/pipeline7-clearance-feedback-retry.test.ts tests/pipeline7-clearance-feedback-exhaustion.test.ts tests/pipeline7-one-gap-coupled-repair.test.ts
git commit -m "feat: retry Pipeline 7 with clearance feedback"
```

---

### Task 6: Prove the fixture, vendor the router, and validate the board

**Files:**
- Modify: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/docs/CONTINUE_ROUTER_CLEARANCE.md`
- Modify: `/private/tmp/esp-clearance-implementation/tscircuit-autorouter/docs/JLCPCB_CLEARANCE_HANDOFF.md`
- Modify: `/Users/joe/Development/esp32-arduino-led-dimmer-homekit/tscircuit/vendor/capacity-autorouter/index.js`
- Modify: `/Users/joe/Development/esp32-arduino-led-dimmer-homekit/tscircuit/vendor/capacity-autorouter/index.d.ts`
- Modify: `/Users/joe/Development/esp32-arduino-led-dimmer-homekit/tscircuit/vendor/capacity-autorouter/SOURCE.md`
- Generated verification outputs: `/Users/joe/Development/esp32-arduino-led-dimmer-homekit/tscircuit/jlcpcb/board.kicad_pcb` and `drc.json`

**Interfaces:**
- Consumes: committed Tiny, repair, and router branches.
- Produces: board-vendored router build with exact three-repository provenance.

- [ ] **Step 1: Run complete Tiny and repair suites**

```sh
cd /private/tmp/esp-clearance-implementation/tiny-hypergraph
bun test --timeout 9999999
bun run typecheck
cd /private/tmp/esp-clearance-implementation/high-density-repair03
bun test ./tests --timeout 9999999
bun run typecheck
```

Expected: Tiny passes. Repair passes except, at most, the same four documented baseline SVG `stroke-linejoin` snapshot differences.

- [ ] **Step 2: Run router suite, build, and untouched fixture gate**

```sh
cd /private/tmp/esp-clearance-implementation/tscircuit-autorouter
bun test --timeout 9999999
bun run build
bun run scripts/clearance-investigation/stagecheck.ts tests/fixtures/esp-led-controller-v3.1.srj.json 0.15
```

Expected: router tests pass; build succeeds; final stagecheck reports minimum gap at least 0.15 mm and zero samples below 0.15 mm. Confirm output is nonempty and complete before accepting the clearance numbers.

- [ ] **Step 3: Commit and push router source**

Update the two handoff documents with exact commits and measured results. Then:

```sh
git add docs/CONTINUE_ROUTER_CLEARANCE.md docs/JLCPCB_CLEARANCE_HANDOFF.md docs/plans/2026-09-04-router-clearance-feedback-design.md docs/plans/2026-09-04-router-clearance-feedback-implementation.md
git commit -m "docs: record clearance feedback verification"
git push origin jlcpcb-clearance
```

- [ ] **Step 4: Rebuild and vendor exact router artifacts**

After `bun run build`, copy only `dist/index.js` and `dist/index.d.ts` into the board vendor directory. Update `SOURCE.md` with the exact Tiny, repair, and router commits and state that the artifacts came from the passing fixture build.

- [ ] **Step 5: Restore the pinned board CLI**

Build or activate the adjacent dotfiles package that pins `tscircuit: 0.0.2463` and core `0.0.1837`. Repoint the tracked `tscircuit/node_modules` symlink to that realized package's `lib/tscircuit/node_modules`. Do not replace the symlink with a text file and do not run an unpinned `latest` install.

- [ ] **Step 6: Build and inspect the board**

From the board's `tscircuit/` directory:

```sh
tsci check netlist
tsci check schematic-placement
tsci check placement
tsci build
```

Expected: no actionable netlist, schematic-placement, placement, routing, or logged build failures. Verify the circuit JSON contains the requested 18 power widths at 0.5 mm and 16 RF widths at 0.3 mm where legal, 0.5/0.2 mm vias, nonempty complete routes, and valid transitions.

- [ ] **Step 7: Export and run independent acceptance**

```sh
tsci export dist/index/circuit.json -f kicad_pcb -o /Users/joe/Development/esp32-arduino-led-dimmer-homekit/tscircuit/jlcpcb/board.kicad_pcb
kicad-cli pcb drc --severity-error --format json -o jlcpcb/drc.json jlcpcb/board.kicad_pcb
tsci check shorts dist/index/circuit.json
```

Expected: KiCad reports zero error-level violations and zero unconnected items; shorts check exits zero with no shorts. Inspect the generated JSON rather than relying only on exit status.

- [ ] **Step 8: Commit the board integration without unrelated CRLF changes**

Stage only the two vendored files, `SOURCE.md`, and matching newly validated board evidence requested by the repository's existing convention. Do not stage `README.md`, `include/DimmableLight.h`, or `src/DimmableLight.cpp`.

```sh
git commit -m "feat: integrate clearance-aware autorouter"
git push origin router-fork-integration
```

- [ ] **Step 9: Final cross-repository review**

Review the complete Tiny, repair, router, and board diffs against the Global Constraints. Confirm every claimed pass has fresh command output and that production files were generated only from the validated source.
