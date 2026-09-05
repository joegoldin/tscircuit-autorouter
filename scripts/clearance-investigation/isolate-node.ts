import { HighDensitySolverB01 } from "@tscircuit/high-density-b01"
const hd = await Bun.file("/tmp/esp-router-hd.json").json()
const node = hd.nodes.find((n: any) => n.capacityMeshNodeId === "cmn_7")
const names = [...new Set(node.portPoints.map((p: any) => p.connectionName))]
for (const omitted of [null, ...names]) {
  const input = { ...node,
    portPoints: node.portPoints.filter((p: any) => p.connectionName !== omitted),
    portPointsInPairs: node.portPointsInPairs.filter((pair: any) => pair[0].connectionName !== omitted),
  }
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: input, obstacles: [], traceThickness: 0.15,
    traceMargin: 0.15, viaDiameter: 0.5, viaMinDistFromBorder: 0.325,
    highResolutionCellSize: 0.025, lowResolutionCellSize: 0.025,
  })
  solver.MAX_RIPS = 40
  solver.solve()
  console.log({ omitted, solved: solver.solved, error: solver.error, iterations: solver.iterations })
  if (solver.solved) await Bun.write(`/tmp/esp-node-omit-${omitted}.json`, JSON.stringify(solver.getOutput()))
}
