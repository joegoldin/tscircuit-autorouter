import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

test("terminal-preserving selection retains separate incomplete tagged sections", () => {
  const hdRoutes: HighDensityIntraNodeRoute[] = [[0, 2], [8, 10]].map(
    (xs, index) => ({
      connectionName: "pair",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      ...(index === 0 ? { startPcbPortId: "a" } : { endPcbPortId: "b" }),
      route: xs.map((x) => ({ x, y: 0, z: 0 })),
      vias: [],
    }),
  )
  const original = structuredClone(hdRoutes)
  const solver = new MultipleHighDensityRouteStitchSolver3({
    connections: [{ name: "pair", pointsToConnect: [
      { x: 0, y: 0, layer: "top", pcb_port_id: "a" },
      { x: 10, y: 0, layer: "top", pcb_port_id: "b" },
    ] }],
    hdRoutes,
    layerCount: 2,
    preserveTerminalPcbPortIds: true,
  })
  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.mergedHdRoutes).toHaveLength(2)
  expect(solver.mergedHdRoutes.flatMap((route) => route.route))
    .toEqual(expect.arrayContaining(hdRoutes.flatMap((route) => route.route)))
  expect(solver.mergedHdRoutes.every((route) =>
    Math.abs(route.route[0].x - route.route.at(-1)!.x) === 2,
  )).toBe(true)
  expect(solver.mergedHdRoutes.flatMap((route) =>
    [route.startPcbPortId, route.endPcbPortId].filter(Boolean),
  ).sort()).toEqual(["a", "b"])
  expect(hdRoutes).toEqual(original)
})
