import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

test("endpoint clustering cannot discard a short tagged terminal detour", () => {
  const hdRoutes: HighDensityIntraNodeRoute[] = [
    {
      connectionName: "pair",
      traceThickness: 0.01,
      viaDiameter: 0.3,
      startPcbPortId: "a",
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0.08, z: 0 },
        { x: 0.05, y: 0.05, z: 0 },
      ],
      vias: [],
    },
    {
      connectionName: "pair",
      traceThickness: 0.01,
      viaDiameter: 0.3,
      endPcbPortId: "b",
      route: [{ x: 0.05, y: 0.05, z: 0 }, { x: 3, y: 0, z: 0 }],
      vias: [],
    },
  ]
  const original = structuredClone(hdRoutes)
  const solver = new MultipleHighDensityRouteStitchSolver3({
    connections: [{ name: "pair", pointsToConnect: [
      { x: 0, y: 0, layer: "top", pcb_port_id: "a" },
      { x: 3, y: 0, layer: "top", pcb_port_id: "b" },
    ] }],
    hdRoutes,
    layerCount: 2,
    preserveTerminalPcbPortIds: true,
  })
  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  expect(solver.mergedHdRoutes).toHaveLength(1)
  expect(solver.mergedHdRoutes[0]).toMatchObject({
    startPcbPortId: "a",
    endPcbPortId: "b",
    route: [...hdRoutes[0].route, hdRoutes[1].route[1]],
    vias: [],
  })
  expect(hdRoutes).toEqual(original)
})
