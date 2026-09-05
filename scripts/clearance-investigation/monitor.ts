import { readFileSync, writeFileSync } from "node:fs"
import { AutoroutingPipelineSolver7_MultiGraph } from "../../lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"

const srj = JSON.parse(readFileSync(process.argv[2]!, "utf8"))
const solver: any = new AutoroutingPipelineSolver7_MultiGraph(srj, process.argv[3] === "small-nodes" ? { maxNodeDimension: 2 } : {})
if (process.argv[3] === "no-uniform") {
  const stage = solver.pipelineDef.find((stage: any) => stage.solverName === "highDensityRouteSolver")
  const getParams = stage.getConstructorParams
  stage.getConstructorParams = (pipeline: any) => {
    pipeline.uniformPortDistributionSolver.getOutput = () => pipeline.portPointPathingSolver.getOutput().nodesWithPortPoints
    return getParams(pipeline)
  }
}
if (process.argv[3] === "capacity") {
  const stage = solver.pipelineDef.find((stage: any) => stage.solverName === "portPointPathingSolver")
  const getParams = stage.getConstructorParams
  stage.getConstructorParams = (pipeline: any) => {
    const [params] = getParams(pipeline)
    params.weights.NODE_PF_FACTOR = 1
    params.weights.RIPPING_PF_COST = 1
    return [params]
  }
}
let last = -1
if (process.argv[3] === "port-penalize") {
  const stage = solver.pipelineDef.find((stage: any) => stage.solverName === "portPointPathingSolver")
  const getParams = stage.getConstructorParams
  stage.getConstructorParams = (pipeline: any) => {
    const [params] = getParams(pipeline)
    for (const port of params.graph.ports) {
      if (port.d.regions.some((region: any) => region.d.capacityMeshNodeId === "cmn_7")) {
        port.d.tinyHypergraphPortPenalty = Number(process.argv[4] ?? 1)
      }
    }
    return [params]
  }
}
let reportAt = Date.now()
let savedHd = false
const penalizedTinySolvers = new WeakSet<object>()
while (!solver.solved && !solver.failed) {
  solver.step()
  if (process.argv[3] === "penalize") {
    const tiny = solver.portPointPathingSolver?.tinyPipelineSolver?.getSolver("solveGraph")
    if (tiny && !penalizedTinySolvers.has(tiny)) {
      if (tiny.iterations !== 0) throw new Error(`Missed initialization ${tiny.iterations}`)
      const region = tiny.topology.regionMetadata.findIndex((m:any)=>m.capacityMeshNodeId === "cmn_7")
      if (region < 0) throw new Error("Missing cmn_7")
      tiny.state.regionCongestionCost[region] += 1
      penalizedTinySolvers.add(tiny)
      console.log("penalized",region)
    }
  }
  if (!savedHd && solver.highDensityRouteSolver?.solved) {
    savedHd = true
    writeFileSync("/tmp/esp-router-hd.json", JSON.stringify({
      nodes: solver.highDensityNodePortPoints,
      routes: solver.highDensityRouteSolver.routes,
      metadata: [...solver.highDensityRouteSolver.nodeSolveMetadataById],
      stats: solver.highDensityRouteSolver.stats,
    }))
  }
  if (last !== solver.currentPipelineStepIndex || Date.now() > reportAt) {
    last = solver.currentPipelineStepIndex
    reportAt = Date.now() + 20000
    console.log(last, solver.activeSubSolver?.getSolverName(), solver.iterations,
      solver.activeSubSolver?.progress, solver.activeSubSolver?.iterations)
  }
}
console.log("result", solver.solved, solver.failed, solver.error)
writeFileSync("/tmp/esp-router-result.json", JSON.stringify({
  srj: { ...solver.originalSrj, traces: solver.powerTraceExpansionSolver?.getOutput() ?? [] },
  routes: solver._getOutputHdRoutes(),
  stats: solver.exactGeometryDrcForceImproveSolver?.stats,
  finalDrcErrors: solver.finalDrcErrors,
}))
