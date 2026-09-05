# Router Clearance Feedback Design

## Status

Approved on 2026-09-04 for implementation across these branches:

- `joegoldin/tiny-hypergraph:jlcpcb-clearance`, based on `c1043b3043ddf0c4d841fe5a6d9a515165960911`
- `joegoldin/high-density-repair03:jlcpcb-clearance`, based on `51c14dc1f0b79c1d39213797c79f4297b58264f2`
- `joegoldin/tscircuit-autorouter:jlcpcb-clearance`, based on `db7a49b7`
- `joegoldin/esp32-arduino-led-dimmer-homekit:router-fork-integration`, based on `a10d2f5497840e2aa53c4be8f49b5eabc3538211`

The board remains unapproved for manufacture until every acceptance check in this document passes.

## Goal

Make Pipeline 7 route the complete declarative ESP LED Controller board at its declared copper dimensions and clearance, using source-level solver fixes rather than geometry compensation or manual copper edits.

## Constraints

- Start every routing attempt from the untouched SimpleRouteJson.
- Require 0.15 mm clearance on the router fixture and the board's declared 0.127 mm manufacturing clearance.
- Preserve the board's 18 power traces at 0.5 mm and 16 RF traces at 0.3 mm where legal.
- Preserve 0.5/0.2 mm via pad/hole dimensions, endpoint layers, terminal identities, explicit transitions, merged-net aliases, and original route completeness.
- Do not use Bun patches, install-time edits, production monkey-patching, manual KiCad copper repair, geometry inflation, reduced validation, or success on empty or invalid output.
- Keep `GlobalDrcForceImproveSolver`'s existing best-effort completion contract. Pipeline 7 remains responsible for rejecting residual errors.
- Do not merge unfinished work into the board repository's `main` branch.

## Considered Approaches

### 1. Add a typed Tiny regional-cost hook and use bounded Pipeline 7 feedback

This is the selected approach. It changes the shared cost calculation once, propagates the hook through Tiny's existing option-copy paths, and makes Pipeline 7 retry only after exact final copper evaluation identifies congested regions. It reproduces the successful investigation without shipping prototype instrumentation.

### 2. Vendor Tiny inside the router

This avoids a third dependency repository but duplicates an active solver and obscures provenance. It would also make upstreaming and future dependency updates harder. It is rejected now that the source fork is authorized.

### 3. Wait for an upstream Tiny merge

This minimizes long-term fork maintenance but blocks the board on external review. The fork can still be upstreamed after the behavior is proven. It is not the execution path for this checkpoint.

## Architecture

### Additive regional cost in Tiny

`TinyHyperGraphSolverOptions` gains an optional additive regional-cost callback. Its input contains stable region metadata plus the same-layer crossing count, cross-layer crossing count, entry/exit layer-change count, and trace count. Its output must be finite and nonnegative so Tiny's lower-bound pruning remains valid.

`computeRegionCostForRegion` adds the callback result to the existing geometric cost. This keeps candidate deltas and cached region costs consistent. The callback is copied by `applyTinyHyperGraphSolverOptions` and `getTinyHyperGraphSolverOptions`, and the section-pipeline input forwards it into both whole-graph and section options. That covers initial routing, greedy final routing, baseline replay, section search, final candidate replay, and candidate comparison.

The router supplies a callback keyed by `capacityMeshNodeId`, never by Tiny's transient numeric region index. For a region penalty `p`, the added cost is:

```text
p * (2 * sameLayerCrossings + crossLayerCrossings + entryExitLayerChanges)
```

The penalty map is immutable during one complete attempt.

### Bounded Pipeline 7 feedback

Pipeline 7 owns a regional penalty map and an attempt counter. The initial attempt has no penalties. After post-expansion exact clearance evaluation:

1. If there are no clearance errors, the pipeline succeeds.
2. If a non-clearance stage failed, the pipeline fails immediately.
3. If a clearance error has no center or cannot be mapped to a capacity node, the pipeline fails explicitly.
4. Otherwise, each implicated `capacityMeshNodeId` is incremented once by 0.5 for the next attempt.
5. The pipeline resets derived stage state, restores a structured clone of the untouched original SRJ, and reruns with the new fixed penalty map.
6. After 12 total attempts, residual clearance errors fail the pipeline with the attempt count and first exact error.

Candidate portfolio scoring inside the Tiny adapter includes a feedback score derived from the same fixed map. This prevents a trace-density alternative from replacing a candidate that better satisfies the current congestion feedback. Total Tiny costs are not compared across candidates configured with different trace-density factors.

### Deliberate coupled repair

The repair library exposes coupled broad-force candidates as an explicit, bounded branch-portfolio operation rather than a fallback. It evaluates pass multipliers 1 and 2 from the current accepted geometry, without final via-segment cleanup, using the same exact DRC evaluator as Pipeline 7. A candidate is accepted only when the existing count-and-severity ordering improves.

Targeted repair, safe layer moves, and coupled broad candidates remain independently observable in solver statistics. Exhausting repair candidates returns the best route under the repair library's existing contract; Pipeline 7 then either applies congestion feedback or rejects the final result.

Broad-force geometry uses the actual copper it moves. Segment repulsion uses the maximum declared width on that segment, including point-level taper widths, and via repulsion uses the route's actual via diameter. Exact DRC remains authoritative after every candidate.

### Dependency flow

The router pins the new Tiny fork commit and the new repair fork commit. After router verification, `bun run build` produces `dist/index.js` and `dist/index.d.ts`; both replace the board repository's vendored router artifacts. `SOURCE.md` records all three exact commits.

No scratch probe or local path dependency is part of the committed production dependency graph.

## Error Handling

- Reject negative, non-finite, or otherwise invalid additive regional costs at the Tiny boundary.
- Preserve solver-internal invariant failures; do not convert them into another routing attempt.
- Reject feedback attempts when exact errors cannot be mapped to a stable capacity node.
- Reject exhausted feedback with residual error details.
- Treat repair completion with residual DRC as best effort, not board validity.
- Reject missing routes, broken terminal mappings, invalid transitions, shorts, board-edge violations, or post-expansion clearance errors in the appropriate acceptance check.

## Test Strategy

### Tiny fork

- A failing unit test proves the callback changes both cached region cost and candidate delta consistently.
- A section-pipeline test proves the same callback reaches whole-graph solving, section search, baseline replay, and candidate replay.
- Invalid callback results fail loudly.
- Existing single-layer impossibility and trace-density behavior remain unchanged without a callback.

### Repair fork

- Promote the archived two-route coupled reproduction into a normal regression for the explicit coupled operation; require zero exact errors, unchanged input, preserved route identities, endpoints, layers, widths, and vias.
- Verify candidate ordering, bounded pass schedule, statistics, and best-effort exhaustion.
- Verify broad-force radii honor per-point trace widths and actual route via diameters.
- Keep the four known dependency-driven SVG snapshot failures visible; do not update snapshots to manufacture a pass.

### Router fork

- Prove the penalty map reaches every Tiny solve path and candidate portfolio scoring.
- Prove an unmappable error and an exhausted attempt budget fail explicitly.
- Prove retries restart from untouched SRJ and increment each implicated node once per attempt.
- Run the saved one-gap fixture through the production evaluator and explicit coupled repair without loading the preserved solved output.
- Run the untouched ESP fixture through stagecheck; require final minimum gap at least 0.15 mm and zero below-rule samples.
- Assert nonempty complete routes, terminal identities, endpoint layers, valid transitions, merged-net aliases, 0.5/0.3 mm requested widths, actual via dimensions, and final post-expansion clearance.

### Board repository

- Build with tsci 0.0.2463 and core 0.0.1837.
- Export the matching circuit JSON to KiCad with an absolute output path.
- Require KiCad DRC to report zero error-level violations and zero unconnected items against the committed project and rules.
- Require `tsci check shorts` to pass.
- Inspect build output for logged failures even if the CLI exits zero.
- Export production artifacts only after all prior checks pass.

## Completion

The work is complete only when the dependency branches are committed and pinned, the focused and normal test suites have the documented results, the router fixture passes at 0.15 mm, and the newly generated board passes KiCad DRC and shorts checks. Existing ZIPs and preserved failed-board artifacts are never acceptance evidence.
