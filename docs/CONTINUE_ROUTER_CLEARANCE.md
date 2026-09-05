# Continue the ESP board router fix

Checkpoint: 2026-09-04. **Not finished; no board in this checkpoint is approved for manufacture.**

## Repositories and authority

- `https://github.com/joegoldin/tscircuit-autorouter`, branch `jlcpcb-clearance`:
  production fixes, original SRJ fixture, all investigation scripts, this handoff,
  and `docs/clearance-evidence/one-gap-fixture.json`.
- `https://github.com/joegoldin/high-density-repair03`, branch `jlcpcb-clearance`:
  repair source fixes, pinned at `51c14dc1f0b79c1d39213797c79f4297b58264f2` by the router.
  `scratch/trace-pad-local-contact-repair.test.ts` is an intentionally failing
  two-route reproduction, not a completed fix or normal suite test.
- `https://github.com/joegoldin/esp32-arduino-led-dimmer-homekit`, branch
  `router-fork-integration`: declarative board source, footprint JSONs, custom router
  registration, vendored build, manufacturing rules, and failed-board evidence.
  `main` stays at `4dcc678`, the last historically DRC-clean setup. It uses
  compensation and is not the requested final solution. Do not merge WIP into it.

The user requires solver source fixes plus the complete declarative tscircuit
board. No Bun patches, node_modules edits, runtime monkey-patching in production,
manual KiCad copper repair, geometry inflation, or reduced checks. Preserve
0.5 mm power and 0.3 mm RF widths where they fit. Autoplacement is not the diagnosed
cause. Freerouting was discussed as a last resort, not adopted.

The repair dependency fork was explicitly authorized. Permission to create a
**third fork, `tiny-hypergraph`, was asked but has not been granted**. The user's
latest request was to capture this handoff and push branches, not permission for
that additional fork. Resolve this before creating an external repository.

## Proven changes

See `JLCPCB_CLEARANCE_HANDOFF.md` for the original diagnosis and commit history.
Recent production commits:

- `a8b20c84`: declared-clearance DRC evaluation and repair fork pin.
- `6215f13c`: actual A03 trace width and single-transition copper/clearance props.
- `b7b3f015`: direct repair candidates retain endpoint layers and explicit vias.
- `a217e761`: same-net branch crossings are not impossible single-layer geometry.
- `7f5081b3`: final post-expansion copper clearance gate; invalid output now fails.
- `db7a49b7`: repair severity dependency pin and investigation findings.

Repair commits `ee5b9c23` and `51c14dc1` replace hard-coded broad-force clearances
and score numeric clearance deficits against the declared rule, respectively.
The old scoring considered a 0.125 mm gap to have zero severity under its assumed
0.1 mm threshold even though the board requires 0.15 mm.

The final gate checks clearance only. It is not a full physical connectivity,
raw layer-transition, or board-edge validator. KiCad DRC and shorts checks remain
mandatory. Empty/missing routes must never be interpreted as success.

## Exact unfinished work

1. Without scratch instrumentation, the original fixture still has eight true
   crossings, mostly near the MCU. Correct grow/shrink scaling exposes these;
   Pipeline 7's existing invalid direct-candidate path does not repair them.
2. The detailed solver does not feed infeasible geometry back to coarse planning.
   The successful scratch experiment penalizes estimated via demand in regions
   containing final DRC errors, then reruns the pipeline from the original SRJ.
   Demand is `2 * sameLayerCrossings + crossLayerCrossings + entryExitLayerChanges`.
   Penalty increments are 0.5. One feedback pass removes all eight crossings.
3. That leaves one trace/pad error: net 24 versus pad 79, gap 0.124945426 mm,
   near `(3.943969, 1.098252)`. `one-gap-fixture.json` preserves this exact result,
   original SRJ, HD routes, nodes, errors, and penalty map. It is NOT a passing board.
4. A separate GlobalDrcForceImprove run with coupled broad forces clears that one
   error. Normal Pipeline 7 settings still leave it. Increasing targeted-only
   iterations from 16 to 192 does not resolve it. Targeted pad repulsion replaces
   the pad error with a worse net-8 trace error (gap about 0.094 mm). Localized
   single-segment distribution was tried and reverted: it still worsened the
   combined geometry. Repair must account for neighboring copper together.
5. Implement the congestion hook in source and integrate bounded feedback with
   consistent candidate scoring and explicit failure on exhaustion. Integrate
   coupled repair as a deliberate validated solver operation, not a silent fallback
   or success-on-invalid-output path. Re-test from untouched SRJ, then the board.

### Where the congestion hook belongs

`tiny-hypergraph/lib/core.ts`, protected `computeRegionCostForRegion`, is used both
for candidate search and cached region costs. Changing `computeG` alone leaves
section/best-state ranking inconsistent. The section optimizer creates base Tiny
solvers internally, so subclassing only the initial solver does not cover it.
The scratch script patches the base prototype before creating solvers; **do not
ship that instrumentation**. A proper regional cost hook must propagate through
initial solving, section search, replay, and candidate comparison.

The router adapter is
`lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver.ts`.
The pipeline wiring is
`lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph.ts`.
Tiny's current region cost uses area, not aspect ratio or legal via packing.

Per-port penalties were tested first: they persist into section routing but
reduced MCU region route count 9→8 while increasing required layer transitions
2→4, leaving 10 violations. Same-net crossings are already skipped in Tiny's
intersection counter. Do not repeat the hypothesis that these penalties vanished.

## Reproduce on another machine

Clone each repository and check out the branch above. Bun is required.
In the router checkout:

```sh
bun install
bun run build
bun run scripts/clearance-investigation/stagecheck.ts tests/fixtures/esp-led-controller-v3.1.srj.json 0.15
bun run scripts/clearance-investigation/feedback-probe.ts tests/fixtures/esp-led-controller-v3.1.srj.json via-cost
```

The feedback probe runs up to 12 attempts and writes `/tmp/esp-feedback-via-N.json`.
It is experimental and may stall at the one-pad error; stop once that is reproduced.
For a faster run, initialize from the preserved penalty map:

```sh
bun run scripts/clearance-investigation/feedback-probe.ts tests/fixtures/esp-led-controller-v3.1.srj.json via-cost docs/clearance-evidence/one-gap-fixture.json
bun run scripts/clearance-investigation/gap-probe.ts 16 no-broad
bun run scripts/clearance-investigation/gap-probe.ts 192
```

The gap probe now reads the committed artifact and imports the pinned repair
dependency, so it does not require the previous machine's checkout paths. Its
last two commands distinguish targeted-only repair from coupled broad repair.
It uses the actual Pipeline 7 conversion/evaluator to preserve merged-net aliases;
naively reconstructing the evaluator produced false pad collisions in earlier probes.

Other preserved scripts are scratch diagnostics. Several intentionally read/write
named `/tmp` files; inspect their headers and inputs before running. `monitor.ts`
produces HD node metadata, `pairs-probe.ts` produces paired SRJ. Old maze experiments
report zero DRC on incomplete subsets; that is NOT success. B01/region-only
experiments did not solve the original topology. Smaller mesh nodes made it worse.

### Environment traps

- On this Nix machine Bun's default cache was outside writable roots. Installation
  worked with `BUN_INSTALL_CACHE_DIR=/tmp/esp-clearance-bun-cache TMPDIR=/tmp bun install`.
- Router `bunfig.toml` deliberately disables lockfile saving. No install hooks or
  dependency patch mechanism remain. Do not reintroduce them.
- Tests needing Sharp required `LD_LIBRARY_PATH` containing the GCC runtime's
  `libstdc++.so.6`. The prior path was
  `/nix/store/0iv8glcslgfcgn371lbjr5jjw5a6cqir-gcc-15.3.0-lib/lib`; discover the local
  equivalent instead of assuming that store path exists on the new machine.
- Board CLI was tsci 0.0.2463, bundled core 0.0.1837; KiCad CLI was version 10.
  `tscircuit/node_modules` is a tracked symlink to a machine-specific CLI tree.
  Repoint it locally to the installed CLI dependency tree; do not replace it with
  a literal text file. The board package says `tscircuit: latest`, so a fresh install
  without version control is not the previously tested environment.
- Use `--config=/path` where needed; Bun treated a separated config path as a package.
- Board export must use an absolute output path. Relative paths resolve beside
  the input circuit JSON, not necessarily in the working directory.

## Board artifacts and acceptance

The integration branch contains 34 explicit width props: 18 power traces at
0.5 mm and 16 RF traces at 0.3 mm. Earlier source did not actually include them.
Preserve footprint copper groups, unconnected-pad keepouts, antenna keepout and
pour cutout, and the deliberate placement-check exemption. No placement changes
were made during this investigation.

The original fixture uses **0.5 mm via pads**, not 0.45 as the old handoff says.
Its clearance is 0.15 mm. The board's declared pad clearance is 0.127 mm.

`docs/clearance-evidence/` in the board branch contains the last failed board's
Circuit JSON, KiCad PCB, exact SRJ input and build/shorts/DRC logs. That build used
router `b7b3f015`, before the final refusal gate. It had 17 error-level violations
(7 clearance, 8 crossing, 2 shorting), zero unconnected items, and 10 reported
shorts. Existing U2.VDDA6 ambiguous-pad and supplier/footprint warnings were also
logged. tsci can exit zero while logging failures: inspect output and artifacts.
The newly checkpointed vendor build is newer; see its SOURCE.md. Old generated
artifacts are preserved as evidence, not regenerated or relabeled passing.

From the board's `tscircuit/` directory, after the source fix:

```sh
tsci build
tsci export dist/index/circuit.json -f kicad_pcb -o /absolute/board-checkout/tscircuit/jlcpcb/board.kicad_pcb
kicad-cli pcb drc --severity-error --format json -o jlcpcb/drc.json jlcpcb/board.kicad_pcb
tsci check shorts dist/index/circuit.json
```

Require stagecheck final gap ≥0.15 and zero below-rule samples on the original
fixture; KiCad zero errors and zero unconnected against the committed matching
`.kicad_pro`/`.kicad_dru`; clean shorts; actual requested widths where legal; proper
vias and board-edge clearance. Then export production files from that validated
source. Existing ZIPs are not evidence for the new router.

## Test state at handoff

Earlier focused router runs passed 20 tests across 18 files (86 assertions total).
After the latest repair pin, four focused tests passed again, and the router built.
The repair suite reported 82 passes / 4 failures / 572 assertions. Those same four
snapshot failures were reproduced on the unmodified repair baseline (80 passes /
4 failures); SVG stroke-linejoin attributes differ with the installed graphics
dependency. Do not weaken checks or update those snapshots to manufacture a pass.

The two-route test under repair `scratch/` intentionally remains red. Run the
normal suite with `bun test ./tests --timeout 9999999`; run that reproduction
explicitly when implementing coupled repair. No end-to-end board acceptance was
achieved. Review the preserved command logs rather than interpreting this checkpoint
as completed engineering work.
