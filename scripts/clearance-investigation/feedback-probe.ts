import { readFileSync, writeFileSync } from "node:fs"
import { AutoroutingPipelineSolver7_MultiGraph } from "../../lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { TinyHyperGraphSolver } from "tiny-hypergraph/lib/index"

const srj = JSON.parse(readFileSync(process.argv[2]!, "utf8"))
const penalties = new Map<string, number>()
if (process.argv[4]) {
  const previous = JSON.parse(readFileSync(process.argv[4], "utf8"))
  for (const [id, penalty] of previous.penalties) penalties.set(id, penalty)
}
const costMode = process.argv[3] === "via-cost"
if (costMode) {
  const prototype: any = TinyHyperGraphSolver.prototype
  const original = prototype.computeRegionCostForRegion
  prototype.computeRegionCostForRegion = function (region: number, same: number, cross: number, changes: number, count: number) {
    const penalty = penalties.get(this.topology.regionMetadata[region]?.capacityMeshNodeId) ?? 0
    return original.call(this, region, same, cross, changes, count) + penalty * (2 * same + cross + changes)
  }
}
for (let attempt = 0; attempt < 12; attempt++) {
  const solver: any = new AutoroutingPipelineSolver7_MultiGraph(srj, {})
  const stage = solver.pipelineDef.find((stage: any) => stage.solverName === "portPointPathingSolver")
  const getParams = stage.getConstructorParams
  stage.getConstructorParams = (pipeline: any) => {
    const [params] = getParams(pipeline)
    for (const port of params.graph.ports) {
      const penalty = port.d.regions.reduce((sum: number, region: any) => sum + (penalties.get(region.d.capacityMeshNodeId) ?? 0), 0)
      if (!costMode) port.d.tinyHypergraphPortPenalty = (port.d.tinyHypergraphPortPenalty ?? 0) + penalty
    }
    return [params]
  }
  let reportAt = Date.now()
  while (!solver.solved && !solver.failed) {
    solver.step()
    if (Date.now() >= reportAt) {
      console.log("progress", attempt, solver.currentPipelineStepIndex, solver.iterations)
      reportAt = Date.now() + 20000
    }
  }
  const errors = solver.finalDrcErrors
  console.log("result", attempt, solver.solved, solver.error, errors.length)
  writeFileSync(`/tmp/esp-feedback-${costMode ? "via-" : ""}${attempt}.json`, JSON.stringify({
    srj: { ...solver.originalSrj, traces: solver.powerTraceExpansionSolver?.getOutput() ?? [] },
    routes: solver._getOutputHdRoutes(), errors, penalties: [...penalties],
    nodes: solver.highDensityNodePortPoints,
  }))
  if (solver.solved || !errors.length) break
  const congested = new Set<string>()
  for (const error of errors) {
    const point = error.center
    if (!point) continue
    for (const node of solver.capacityNodes) {
      if (Math.abs(point.x - node.center.x) <= node.width / 2 && Math.abs(point.y - node.center.y) <= node.height / 2) {
        congested.add(node.capacityMeshNodeId)
      }
    }
  }
  if (!congested.size) throw new Error("No congested regions located")
  for (const id of congested) penalties.set(id, (penalties.get(id) ?? 0) + 0.5)
  console.log("penalties", [...penalties])
}
