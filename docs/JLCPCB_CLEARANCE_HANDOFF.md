# Handoff: make the local autorouter honour clearance and trace width

## Current status (2026-09-04)

The board is **not ready for manufacture**. The remaining sections describe the
original investigation; they are not a statement that the current branch passes.
The fixture actually specifies a 0.5 mm via pad, not the 0.45 mm stated below.

Verified source fixes since the initial handoff:

- `a8b20c84`: evaluate at the declared clearance and pin the repair-library fork
  at `joegoldin/high-density-repair03@ee5b9c23`. That fork fixes the three
  hard-coded broad-repulsion margins. No Bun patches or install-time source edits.
- `6215f13c`: pass the actual trace width to A03 and copper dimensions/clearance
  to the single-transition solver.
- `b7b3f015`: preserve both endpoint layers and explicit vias in direct repair
  candidates. These remain invalid candidates, not accepted final routes.
- `a217e761`: do not reject same-net branch crossings as impossible single-layer
  geometry.
- `7f5081b3`: evaluate final, post-expansion copper and fail Pipeline 7 if any
  clearance violations remain. This is a clearance gate, not a complete
  connectivity/board-edge validator.

Before the last two commits, the original fixture produced 148 routes with eight
remaining exact clearance errors, predominantly true crossings near the MCU.
The width-enabled board build exported to KiCad with 17 error-level violations
(7 clearance, 8 crossing, 2 shorting), zero unconnected items, and a failing
`tsci check shorts`. Zero unconnected items does not make that board valid.

Seven focused regressions (54 assertions) and `bun run build` passed after the
last two commits. The repair library's full suite has four snapshot failures,
also reproduced on its unmodified baseline; do not silently update snapshots.

Current investigation: feed detailed routing violations back into coarse
planning. Per-port congestion penalties persist, but can reduce route count
while increasing required vias. Scratch probes are intentionally uncommitted;
no retry or congestion policy has been adopted into production. Preserve true
copper sizes and clearance throughout. Do not replace this with autoplacement,
manual copper repairs, or geometry inflation.

Further measured progress:

- Penalizing each congested region's estimated via demand
  (`2 * sameLayerCrossings + crossLayerCrossings + entryExitLayerChanges`)
  removes the eight crossings. The resulting fixture has one 0.124945 mm
  trace-to-pad clearance at `(3.943969, 1.098252)`, net 24 versus pad 79.
  The experiment intercepts Tiny's cost calculation before solver construction;
  it is not a production implementation. Permission to create a source fork of
  `tiny-hypergraph` for the required cost hook has been requested.
- Repair commit `51c14dc1` scores errors using their numeric declared and actual
  clearance. Previously the 0.125 mm gap had zero severity because message-based
  scoring assumed a 0.1 mm rule. Its regression passes; the full repair suite
  reports 82 passes and the same four baseline snapshot failures.
- A separate GlobalDrcForceImprove solve with coupled broad forces clears that
  remaining error. The normal Pipeline 7 configuration still leaves it: targeted
  pad repair alone replaces the pad error with a worse neighbor-trace error.
  A small two-route reproduction exists only in scratch. Localized single-route
  movement was tested and reverted because it did not solve the coupled problem.
- Neither the congestion loop nor coupled repair has yet been integrated and
  verified end to end. The routed board and independent KiCad/shorts checks must
  still be regenerated; do not deliver the scratch result as the finished board.

Branch: `jlcpcb-clearance` on https://github.com/joegoldin/tscircuit-autorouter (fork of
tscircuit/tscircuit-autorouter, npm `@tscircuit/capacity-autorouter`, forked at v0.0.875).

## Goal

`tsci build` on the ESP LED Controller v3.1 board (repo
`esp32-arduino-led-dimmer-homekit`, directory `tscircuit/`) must produce routing that passes
KiCad DRC against JLCPCB's rules with **no compensation tricks**:

- copper-to-copper clearance ≥ the board's `minTraceToPadEdgeClearance` (0.127 mm for JLCPCB;
  the board also has to work at 0.15 mm), between traces, vias and pads of different nets;
- vias at the board's `minViaPadDiameter` / `minViaHoleDiameter` (0.45 / 0.2 mm);
- per-trace widths (`<trace width="0.5mm">`, 5 V path and sign return; 0.3 mm RF path)
  honoured where they fit, without violating clearance;
- traces ≥ `minBoardEdgeClearance` (0.5 mm) from the board edge;
- pads without a net treated as obstacles (today they are ignored — that one is in
  `@tscircuit/core`'s SimpleRouteJson builder, not here; note it upstream, see below).

Acceptance test: the KiCad DRC of the exported board reports 0 errors and 0 unconnected items
(procedure below), and `tsci check shorts` is clean.

## What is known (measured, not guessed)

Measured with `scripts/clearance-investigation/stagecheck.ts` on the fixture
`tests/fixtures/esp-led-controller-v3.1.srj.json` (the exact SimpleRouteJson core hands the
router for this board; `minTraceToPadEdgeClearance` 0.15, `minTraceWidth` 0.15,
`minViaPadDiameter` 0.45):

    bun run scripts/clearance-investigation/stagecheck.ts tests/fixtures/esp-led-controller-v3.1.srj.json 0.15

It prints, per pipeline stage, the minimum copper gap between different nets and how many
sampled points sit below the rule. Numbers at v0.0.875 unpatched:

| stage | min gap | samples < 0.15 |
| --- | --- | --- |
| highDensityRouteSolver (first routing) | −0.075 (trace over a pad) | ~2200 |
| traceSimplificationSolver | −0.075 | ~1300 |
| final output | 0.097 | ~960 |

KiCad DRC on the exported board: ~70 clearance errors, median gap 0.114 mm.

Root causes found, in order of importance:

1. **GrowShrinkHighDensityIntraNodeSolver** (`lib/solvers/HyperHighDensitySolver/GrowShrink…`)
   scales a capacity-mesh node up ×2, ×4, ×8 when the node cannot be routed, routes it with
   the *unscaled* `traceWidth`, `viaDiameter`, `obstacleMargin` and *unscaled, unmoved*
   obstacles, then scales the solution back by 1/s. Every clearance in the result is 1/s of
   the requested margin. This is the source of the ~0.1 mm gaps. Pipeline 7 also sets
   `growShrinkFallbackToInvalidGeometryOnFailure: true`, so when growth is exhausted the node
   is filled with straight invalid connections and left to later repair stages, which do not
   recover them.
   The WIP commit scales copper, margin and obstacles with the node (correct) — and the
   measurement then shows the real state: many nodes are infeasible at the true margin, the
   fallback kicks in, and the output has −0.15 mm overlaps. So the fix is not local to this
   class: node sizing (mesh), growth policy and the fallback need to agree.
2. **Node-edge rule** in `SingleHighDensityRouteSolver.isNodeTooCloseToEdge` used
   `obstacleMargin / 2` for traces without the trace's own half-width, and mesh nodes are
   built flush against obstacles (`MultiGraphTopologyPlannerSolver` → `@tscircuit/rectdiff`
   without any margin). Two traces on either side of a node edge, or a trace beside a pad,
   ended at zero gap. Patched: edge rule = `traceThickness/2 + obstacleMargin/2`; mesh
   obstacles grown by `obstacleMargin/2`. Not yet validated end-to-end because of (1).
3. **Hard-coded margins**: `PortfolioSingleIntraNodeSolver` passed `traceMargin: 0.1` to the
   A01/A03 solvers and `viaMinDistFromBorder: viaDiameter/2` (no margin);
   `MultiHeadPolyLineIntraNodeSolver` had `obstacleMargin = 0.1`, `traceWidth = 0.15` with no
   constructor parameter; `TraceSimplificationSolver` passed `traceMargin: 0.1`;
   Pipeline 7 used `srj.defaultObstacleMargin ?? 0.15` everywhere although core never sets
   `defaultObstacleMargin` (it sets `minTraceToPadEdgeClearance`). All patched on the branch.
4. **Per-trace widths**: `TraceWidthSolver` widens routes only where clearance allows, but it
   measured clearance to other routes as `distance − otherTraceHalfWidth` even when the nearest
   copper was a via (0.225 mm radius vs 0.075). Patched: `HighDensityRouteSpatialIndex`
   returns `copperRadius` per conflict and the width solver uses it. Also note the A03 solver
   hard-codes `traceThickness: 0.1` with a comment that the real width "causes issues".
5. **Not in this repo — @tscircuit/core**: pads without a net are not emitted as SRJ
   obstacles, so the router routes over unconnected pins (the board works around it with
   `<keepout>` elements). Worth an upstream issue/PR in core.

Things that were tried and are *not* the answer: `autorouter={{ traceClearance }}` (stored on
the board group, never read), `autorouterEffortLevel`, `<autoroutingphase>` per width (spacing
is still global), `pcbPath` pre-routes (the router routes the pins again), the cloud preset
(`auto` resolves to the same local solver without an account).

## State of the branch

Commits on `jlcpcb-clearance` (on top of v0.0.875):

- `8765875` pipeline margins from the board rule; hard-coded 0.1 margins; width solver via radius
- `1bd830a` MultiHeadPolyLineIntraNodeSolver takes `obstacleMargin`/`traceWidth`
- `1c7277d` WIP: grow/shrink scaling, node-edge rule, mesh obstacle growth, A01/A03 via
  border margin, node post-route check at the configured margin, probe scripts and fixture

`bun run build` (tsup) succeeds; `dist/index.js` + `dist/index.d.ts` are what the board
project vendors. The existing test suite has not been run against the patches — run
`bun test` and fix regressions.

## Suggested plan

1. Reproduce: `bun install && bun run build`, then the stagecheck command above. Keep the
   stage table as the yardstick; the final line must reach min gap ≥ 0.15 with 0 samples
   below before touching the board.
2. Grow/shrink: decide the policy. Options: (a) keep scaling correct and raise the growth
   budget / allow the node to grow into neighbouring free space with neighbour routes as
   obstacles; (b) route the failing nodes with a fallback solver that respects margins instead
   of `createInvalidDirectConnectionRoutes`; (c) make the mesh produce larger nodes near dense
   packages (the QFN-48 at 0.4 mm pitch is the stress case). The
   `GlobalDrcForceImproveSolver` / `exactGeometryDrcForceImproveSolver` stages exist to repair;
   check why they leave −0.15 overlaps untouched (their DRC evaluator is
   `create-pipeline7-autorouting-drc-evaluator.ts`).
3. Re-check the A* rule changes (item 2) once nodes are feasible; the intent is: half the
   margin on each side of a shared node edge, full margin against grown obstacles.
4. Width: after clearance is right, verify `TraceWidthSolver` output on the fixture with
   `nominalTraceWidth` 0.5 on the VBUS/V5V_IN/V5V_MCU/SIGN_N connections and 0.3 on the RF
   connections (the board project sets these through `<trace width>`; core forwards them as
   `connection.nominalTraceWidth`).
5. Run the board: see "Board project integration". Then open PRs upstream
   (tscircuit/tscircuit-autorouter) per root cause; the numbers above are the evidence.

## Board project integration

Repo `esp32-arduino-led-dimmer-homekit`, directory `tscircuit/` (branch `main` is the last
DRC-clean state, using an inflation wrapper as compensation; branch `router-fork-integration`
is the in-progress switch to this fork with the wrapper removed):

- `vendor/capacity-autorouter/{index.js,index.d.ts,package.json,SOURCE.md}` — a build of this
  branch; copy `dist/index.js` and `dist/index.d.ts` there after each router change.
- `tools/jlcpcb-router.ts` — `createAutorouter` wrapper around
  `AutoroutingPipelineSolver7_MultiGraph` (on/start/stop/progress), registered as `jlcpcb` in
  `tscircuit.config.ts` (`platformConfig.autorouterMap`); the board uses `autorouter="jlcpcb"`.
- `tools/from_kicad.py` regenerates `index.circuit.tsx`; `--clearance`, `--via`, `--no-widths`,
  `--rf-shift 1.2` are the knobs used so far (inputs live in the session scratch dir; the
  generated file is committed, so edit it directly when the generator is not needed).
- Verify: `tsci build`, then
  `tsci export index.circuit.tsx -f kicad_pcb -o jlcpcb/board.kicad_pcb` and
  `kicad-cli pcb drc --severity-error --format json -o jlcpcb/drc.json jlcpcb/board.kicad_pcb`
  (rules in `jlcpcb/board.kicad_pro` + `board.kicad_dru`: Default netclass clearance 0.127,
  0.45/0.2 vias, 0.25 hole clearance, 0.5 edge; a rule allows 0.127 between the ESP32's own
  pads). `tsci check shorts` for copper shorts. `tsci export -f gerbers` for the JLCPCB zip.
- Environment notes: `tsci` (0.0.2463, bundled core 0.0.1837) runs under bun from a nix
  store tree; the project links `node_modules` to
  `$(dirname $(readlink -f $(which tsci)))/../lib/tscircuit/node_modules` so the vendored
  router's external `object-hash` resolves. KiCad 10 `kicad-cli` is on PATH. The shell is
  fish: run loops under `bash -c`.
- Board-side design decisions already made (keep them): ESP32 3.3 V pins 1/3/6/8 and GND pins
  43/47 are copper groups inside the QFN footprint (rail between pad tips and exposed pad;
  stubs into the exposed pad) — `tools/footprint-merges.json`; RF placeholders 1.2 mm off the
  chip; `<keepout>` over every unconnected pad; antenna keepout + pour cutout;
  `placementDrcChecksDisabled` because tscircuit's placement check objects to the deliberate
  same-net pad overlaps.
