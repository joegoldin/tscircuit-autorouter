import { expect, test } from "bun:test"
import { GlobalDrcForceImproveSolver } from "high-density-repair03/lib"

test("global force repair separates traces to the configured clearance", () => {
  const routes = [
    { connectionName: "a", traceThickness: 0.15, viaDiameter: 0.5, vias: [], route: [{ x: -2, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 2, y: -1, z: 0 }] },
    { connectionName: "b", traceThickness: 0.15, viaDiameter: 0.5, vias: [], route: [{ x: -2, y: 1, z: 0 }, { x: 0, y: 0.27, z: 0 }, { x: 2, y: 1, z: 0 }] },
  ]
  const solver = new GlobalDrcForceImproveSolver({
    srj: {
      layerCount: 2,
      minTraceWidth: 0.15,
      minTraceToPadEdgeClearance: 0.15,
      bounds: { minX: -3, maxX: 3, minY: -2, maxY: 2 },
      obstacles: [],
      connections: routes.map((route) => ({
        name: route.connectionName,
        pointsToConnect: [route.route[0]!, route.route.at(-1)!].map((point) => ({ ...point, layer: "top" })),
      })),
    },
    hdRoutes: routes,
    maxIterations: 32,
    enablePostSolveClearanceRelaxation: false,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.stats.finalDrcIssueCount).toBe(0)
})
