import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

test("another requested terminal on a secondary island remains covered", () => {
  const makeRoute = (
    connectionName: string,
    start: number,
    end: number,
  ): HighDensityIntraNodeRoute => ({
    connectionName,
    rootConnectionName: "net",
    route: [{ x: start, y: 0, z: 0 }, { x: end, y: 0, z: 0 }],
    traceThickness: 0.15,
    viaDiameter: 0.5,
    vias: [],
  })
  const hdRoutes = [
    makeRoute("pair", 0, 10),
    { ...makeRoute("pair", 20, 30), startPcbPortId: "c" },
    makeRoute("other", 20, 20),
    makeRoute("other", 30, 35),
  ]
  const solver = new MultipleHighDensityRouteStitchSolver3({
    connections: [
      { name: "pair", pointsToConnect: [
        { x: 0, y: 0, layer: "top", pcb_port_id: "a" },
        { x: 10, y: 0, layer: "top", pcb_port_id: "b" },
      ] },
      { name: "other", pointsToConnect: [
        { x: 20, y: 0, layer: "top", pcb_port_id: "c" },
        { x: 35, y: 0, layer: "top", pcb_port_id: "d" },
      ] },
    ],
    hdRoutes,
    layerCount: 2,
    preserveTerminalPcbPortIds: true,
  })
  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.mergedHdRoutes).toHaveLength(2)
  expect(solver.mergedHdRoutes.find((route) => route.connectionName === "other"))
    .toMatchObject({
      startPcbPortId: "d",
      endPcbPortId: "c",
      route: [35, 30, 20].map((x) => ({ x, y: 0, z: 0 })),
    })
})
