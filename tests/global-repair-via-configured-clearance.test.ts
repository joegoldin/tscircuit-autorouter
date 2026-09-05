import { expect, test } from "bun:test"
import { GlobalDrcForceImproveSolver } from "high-density-repair03/lib"
import { applyBroadRepulsionForces } from "high-density-repair03/lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"

test("global force repair uses the board clearance for via-to-trace pushes", () => {
  const routes = [
    { connectionName: "a", traceThickness: 0.15, viaDiameter: 0.5, vias: [], route: [{ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }] },
    { connectionName: "b", traceThickness: 0.15, viaDiameter: 0.5, vias: [{ x: 0, y: 0.44 }], route: [{ x: -1, y: 1, z: 0 }, { x: 0, y: 0.44, z: 0 }, { x: 0, y: 0.44, z: 1 }, { x: 1, y: 1, z: 1 }] },
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
        pointsToConnect: [route.route[0]!, route.route.at(-1)!].map((point) => ({ ...point, layer: point.z === 0 ? "top" : "bottom" })),
      })),
    },
    hdRoutes: routes,
    maxIterations: 32,
    enablePostSolveClearanceRelaxation: false,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.stats.finalDrcIssueCount).toBe(0)
  const repaired = applyBroadRepulsionForces(solver.srj, routes, 1)
  expect(repaired).not.toBe(routes)
})
