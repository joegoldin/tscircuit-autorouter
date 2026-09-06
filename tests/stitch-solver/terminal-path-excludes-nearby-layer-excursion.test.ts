import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

test("nearby layer excursions cannot extend a complete PCB terminal path", () => {
  const hdRoutes: HighDensityIntraNodeRoute[] = [
    {
      connectionName: "pair",
      rootConnectionName: "net",
      traceThickness: 0.1,
      viaDiameter: 0.3,
      startPcbPortId: "a",
      endPcbPortId: "b",
      route: [{ x: 0, y: 0, z: 1 }, { x: 10, y: 0, z: 1 }],
      vias: [],
    },
    {
      connectionName: "pair",
      rootConnectionName: "net",
      traceThickness: 0.1,
      viaDiameter: 0.3,
      route: [
        { x: 10.5, y: 0, z: 1 },
        { x: 11, y: 0, z: 1 },
        { x: 11, y: 0, z: 0 },
        { x: 10.5, y: 0, z: 0 },
      ],
      vias: [{ x: 11, y: 0 }],
    },
  ]
  const original = structuredClone(hdRoutes)
  const solver = new MultipleHighDensityRouteStitchSolver3({
    connections: [{ name: "pair", pointsToConnect: [
      { x: 0, y: 0, layer: "bottom", pcb_port_id: "a" },
      { x: 10, y: 0, layer: "bottom", pcb_port_id: "b" },
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
    route: hdRoutes[0].route,
    vias: [],
  })
  expect(hdRoutes).toEqual(original)
})
