import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

test("terminal preservation does not reorder routes when destination IDs are absent", () => {
  const hdRoutes: HighDensityIntraNodeRoute[] = [
    {
      connectionName: "pair",
      route: [{ x: 0, y: 0, z: 0 }, { x: 0.2, y: 0, z: 0 }],
      vias: [],
      traceThickness: 0.1,
      viaDiameter: 0.3,
    },
    {
      connectionName: "pair",
      route: [{ x: 0.2, y: 0, z: 0 }, { x: 0.4, y: 0, z: 0 }],
      vias: [],
      traceThickness: 0.1,
      viaDiameter: 0.3,
    },
  ]
  const connections = [{
    name: "pair",
    pointsToConnect: [
      { x: 0, y: 0, layer: "top" },
      { x: 0.4, y: 0, layer: "top" },
    ],
  }]
  const solve = (preserveTerminalPcbPortIds: boolean) => {
    const solver = new MultipleHighDensityRouteStitchSolver3({
      connections,
      hdRoutes: structuredClone(hdRoutes),
      layerCount: 2,
      preserveTerminalPcbPortIds,
    })
    solver.solve()
    return solver.mergedHdRoutes
  }

  expect(solve(true)).toEqual(solve(false))
})
