import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

test("disconnected terminal sections remain when no complete path is proven", () => {
  const hdRoutes: HighDensityIntraNodeRoute[] = [[0, 2], [8, 10]].map(
    (xs) => ({
      connectionName: "pair",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      route: xs.map((x) => ({ x, y: 0, z: 0 })),
      vias: [],
    }),
  )
  const solver = new MultipleHighDensityRouteStitchSolver3({
    connections: [{ name: "pair", pointsToConnect: [
      { x: 0, y: 0, layer: "top" },
      { x: 10, y: 0, layer: "top" },
    ] }],
    hdRoutes,
    layerCount: 2,
  })
  solver.solve()

  expect(solver.mergedHdRoutes).toHaveLength(2)
  expect(solver.mergedHdRoutes.flatMap((route) => route.route))
    .toEqual(expect.arrayContaining(hdRoutes.flatMap((route) => route.route)))
  expect(solver.mergedHdRoutes.every((route) =>
    Math.abs(route.route[0].x - route.route.at(-1)!.x) === 2,
  )).toBe(true)
})
