import { HighDensitySolverB01 } from "@tscircuit/high-density-b01"
const hd = await Bun.file("/tmp/esp-router-hd.json").json()
for (const [id, metadata] of hd.metadata) {
  if (!metadata.solverType.includes("GrowShrink")) continue
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: metadata.node,
    obstacles: [],
    traceThickness: 0.15,
    traceMargin: 0.15,
    viaDiameter: 0.45,
    viaMinDistFromBorder: 0.3,
    highResolutionCellSize: 0.05,
    lowResolutionCellSize: 0.05,
  })
  solver.solve()
  console.log(id, solver.solved, solver.failed, solver.error, solver.iterations)
  if (solver.solved) await Bun.write(`/tmp/esp-node-${id}.json`, JSON.stringify(solver.getOutput()))
}
