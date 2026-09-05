import { expect, test } from "bun:test"
import { createPipeline7AutoroutingDrcEvaluator } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/create-pipeline7-autorouting-drc-evaluator"
import type { SimpleRouteJson } from "lib/types"
import type { HighDensityRoute } from "lib/types/high-density-types"
import { getConnectivityMapFromSimpleRouteJson } from "lib/utils/getConnectivityMapFromSimpleRouteJson"

test("Pipeline7 repair evaluator enforces the requested copper clearance", () => {
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.15,
    bounds: { minX: -2, minY: -2, maxX: 2, maxY: 2 },
    obstacles: [],
    connections: [0, 1].map((index) => ({
      name: `net${index}`,
      pointsToConnect: [
        { x: -1, y: index * 0.275, layer: "top" },
        { x: 1, y: index * 0.275, layer: "top" },
      ],
    })),
  }
  const routes: HighDensityRoute[] = srj.connections.map((connection) => ({
    connectionName: connection.name,
    route: connection.pointsToConnect.map((point) => ({ ...point, z: 0 })),
    traceThickness: 0.15,
    viaDiameter: 0.45,
    vias: [],
  }))
  const evaluate = createPipeline7AutoroutingDrcEvaluator({
    connections: srj.connections,
    originalConnections: srj.connections,
    layerCount: 2,
    obstacles: [],
    defaultViaHoleDiameter: 0.2,
    connMap: getConnectivityMapFromSimpleRouteJson(srj),
    srjWithPointPairs: srj,
    originalSrj: srj,
  })
  const result = evaluate({ traces: [], routes })
  expect(Array.isArray(result) ? result.length : result.errors.length).toBeGreaterThan(0)
})
