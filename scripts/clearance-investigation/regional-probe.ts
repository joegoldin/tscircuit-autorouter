import { createPipeline7AutoroutingDrcEvaluator } from "../../lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/create-pipeline7-autorouting-drc-evaluator"
import { applyPipeline9RegionalB01Repairs } from "../../lib/autorouter-pipelines/AutoroutingPipeline9_PreloadedTraceGraph/applyPipeline9RegionalB01Repairs"
import { getConnectivityMapFromSimpleRouteJson } from "../../lib/utils/getConnectivityMapFromSimpleRouteJson"
const input = await Bun.file("/tmp/esp-router-result.json").json()
const srj = input.srj
let routes = input.routes
const connections = routes.map((route: any) => ({
  name: route.connectionName,
  __netConnectionName: route.rootConnectionName,
  pointsToConnect: [route.route[0], route.route.at(-1)].map((point: any) => ({
    ...point, layer: point.z === 0 ? "top" : "bottom",
  })),
}))
const pairedSrj = { ...srj, traces: [], connections }
const connMap = getConnectivityMapFromSimpleRouteJson(pairedSrj)
const evaluator = createPipeline7AutoroutingDrcEvaluator({
  connections, originalConnections: srj.connections, layerCount: 2,
  obstacles: srj.obstacles, defaultViaHoleDiameter: srj.minViaHoleDiameter,
  connMap, srjWithPointPairs: pairedSrj, originalSrj: { ...srj, traces: [] },
})
for (let pass = 0; pass < 8; pass++) {
  const before: any = evaluator({ traces: [], routes })
  console.log("before", pass, before.errors.length)
  await Bun.write("/tmp/esp-regional-errors.json", JSON.stringify(before))
  const result = applyPipeline9RegionalB01Repairs({
    srj: pairedSrj, routes, fixedObstacleRoutes: [], newConnections: connections,
    syntheticConnectionNames: new Set(), drcEvaluator: evaluator,
    preloadRepairTraceIds: new Set(routes.map((r: any) => `${r.connectionName}_0`)),
    connMap, colorMap: {}, viaDiameter: srj.minViaPadDiameter,
    traceWidth: srj.minTraceWidth, obstacleMargin: 0.15, effort: 1,
  })
  routes = result.routes
  console.log("after", pass, { ...result, routes: routes.length })
  await Bun.write("/tmp/esp-regional-routes.json", JSON.stringify(routes))
  if (result.remainingDrcIssueCount === 0 || result.acceptedCandidateCount === 0) break
}
