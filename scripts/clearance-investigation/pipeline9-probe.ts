import { AutoroutingPipelineSolver9_PreloadedTraceGraph } from "../../lib/autorouter-pipelines/AutoroutingPipeline9_PreloadedTraceGraph/AutoroutingPipelineSolver9_PreloadedTraceGraph"

const srj = await Bun.file("tests/fixtures/esp-led-controller-v3.1.srj.json").json()
srj.defaultObstacleMargin = srj.minTraceToPadEdgeClearance
const solver = new AutoroutingPipelineSolver9_PreloadedTraceGraph(srj, {})
let previous = ""
let deadline = 0
while (!solver.solved && !solver.failed) {
  solver.step()
  const phase = solver.getCurrentPhase()
  if (phase !== previous || Date.now() > deadline) {
    console.log(phase, solver.iterations, solver.activeSubSolver?.iterations)
    previous = phase
    deadline = Date.now() + 20000
  }
}
console.log("result", solver.solved, solver.failed, solver.error)
if (solver.solved) await Bun.write("/tmp/esp-pipeline9-result.json", JSON.stringify(solver.getOutputSimpleRouteJson()))
