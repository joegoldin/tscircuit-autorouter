import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

test("XY terminal coincidence on the wrong layer cannot justify island pruning", () => {
  const hdRoutes: HighDensityIntraNodeRoute[] = [
    {
      connectionName: "pair",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      route: [{ x: 0, y: 0, z: 1 }, { x: 10, y: 0, z: 1 }],
      vias: [],
    },
    {
      connectionName: "pair",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      route: [{ x: 5, y: 5, z: 0 }, { x: 6, y: 5, z: 0 }],
      vias: [],
    },
  ]
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
  expect(solver.mergedHdRoutes.some((route) =>
    route.route[0].z === 0 && route.route.at(-1)!.z === 0 &&
    route.route[0].x === 0 && route.route.at(-1)!.x === 10,
  )).toBe(false)
})
