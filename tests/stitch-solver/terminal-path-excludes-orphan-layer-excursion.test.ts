import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

test("a complete terminal path excludes a disconnected layer excursion", () => {
  const hdRoutes: HighDensityIntraNodeRoute[] = [
    {
      connectionName: "pair",
      rootConnectionName: "net",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      startPcbPortId: "a",
      endPcbPortId: "b",
      route: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      vias: [],
    },
    {
      connectionName: "pair",
      rootConnectionName: "net",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      route: [
        { x: 5, y: 5, z: 0 },
        { x: 5, y: 6, z: 0 },
        { x: 5, y: 6, z: 1 },
        { x: 5, y: 5, z: 1 },
      ],
      vias: [{ x: 5, y: 6 }],
    },
  ]
  const original = structuredClone(hdRoutes)
  const solver = new MultipleHighDensityRouteStitchSolver3({
    connections: [{
      name: "pair",
      pointsToConnect: [
        { x: 0, y: 0, layer: "top", pcb_port_id: "a" },
        { x: 10, y: 0, layer: "top", pcb_port_id: "b" },
      ],
    }],
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
    route: hdRoutes[0].route,
    vias: [],
  })
  expect(hdRoutes).toEqual(original)
})
