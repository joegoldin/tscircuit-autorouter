import { GlobalDrcForceImproveSolver, AutoroutingDrcEngine } from "high-density-repair03/lib"
import { getDrcSnapshot, applyDrcErrorForces, cloneRoutes, materializeRoutes } from "high-density-repair03/lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { getConnectivityMapFromSimpleRouteJson } from "../../lib/utils/getConnectivityMapFromSimpleRouteJson"
import { AutoroutingPipelineSolver7_MultiGraph } from "../../lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { createPipeline7AutoroutingDrcEvaluator } from "../../lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/create-pipeline7-autorouting-drc-evaluator"
const input = await Bun.file(new URL("../../docs/clearance-evidence/one-gap-fixture.json", import.meta.url)).json()
const connections = input.routes.map((route: any) => ({
  name: route.connectionName,
  __netConnectionName: route.rootConnectionName,
  pointsToConnect: [route.route[0], route.route.at(-1)].map((point: any) => ({
    ...point, layer: point.z === 0 ? "top" : "bottom",
  })),
}))
const pipeline = new AutoroutingPipelineSolver7_MultiGraph({ ...input.srj, traces: [] })
while (pipeline.currentPipelineStepIndex < 4 && !pipeline.failed) pipeline.step()
if (pipeline.failed) throw new Error(pipeline.error!)
const srj = pipeline.srjWithPointPairs!
const connMap = pipeline.connMap
const engine = new AutoroutingDrcEngine(srj, { connMap, traceClearance: 0.15, viaClearance: 0.15 })
const drcEvaluator = createPipeline7AutoroutingDrcEvaluator({
  connections: pipeline.netToPointPairsSolver!.newConnections,
  originalConnections: pipeline.originalSrj.connections,
  layerCount: srj.layerCount, obstacles: pipeline.srj.obstacles,
  defaultViaHoleDiameter: pipeline.viaHoleDiameter,
  connMap, srjWithPointPairs: srj, originalSrj: pipeline.originalSrj,
})
console.log("before", getDrcSnapshot(srj, input.routes, drcEvaluator, connMap))
const before = getDrcSnapshot(srj, input.routes, drcEvaluator, connMap)
const targeted = cloneRoutes(input.routes)
console.log("target", before.traceRouteIndexById.get("source_net_24_mst1_0"), input.routes.findIndex((r:any)=>r.connectionName === "source_net_24_mst1"))
applyDrcErrorForces(srj, targeted, before.errors, before.traceRouteIndexById, 1, connMap)
const afterTargeted = getDrcSnapshot(srj, materializeRoutes(targeted), drcEvaluator, connMap)
console.log("targeted", afterTargeted.count, afterTargeted.issueScore, afterTargeted.errors)
const solver = new GlobalDrcForceImproveSolver({
  srj, hdRoutes: input.routes, connMap, drcEvaluator,
  maxIterations: Number(process.argv[2] ?? 192), enableTargetedErrorSweep: true,
  enableLargeBoardBroadFallback: process.argv[3] !== "no-broad",
  enablePostSolveClearanceRelaxation: false,
})
solver.solve()
console.log("after", solver.solved, solver.error, solver.stats)
await Bun.write("/tmp/esp-gap-repaired.json", JSON.stringify(solver.getOutput()))
