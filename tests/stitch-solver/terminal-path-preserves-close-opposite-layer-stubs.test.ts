import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { recomputeViasFromRoute } from "lib/utils/recomputeViasFromRoute"

test("close opposite-layer terminals retain their physical stubs and transition", () => {
  const paths = [
    [{ x: -0.995, y: 6.059, z: 0 }, { x: -0.995, y: 6.496, z: 0 }],
    [{ x: -0.995, y: 6.496, z: 0 }, { x: -1.295, y: 6.908, z: 0 }],
    [{ x: -1.295, y: 6.908, z: 3 }, { x: -0.985, y: 6.496, z: 3 }],
    [{ x: -0.985, y: 6.496, z: 3 }, { x: -0.985, y: 6.206, z: 3 }],
    [{ x: -0.985, y: 6.206, z: 3 }, { x: -0.995, y: 5.911, z: 3 }],
    [
      { x: -1.295, y: 6.908, z: 0 }, { x: -1.6, y: 7, z: 0 },
      { x: -1.6, y: 7, z: 3 }, { x: -1.295, y: 6.908, z: 3 },
    ],
  ]
  const hdRoutes: HighDensityIntraNodeRoute[] = paths.map((route, index) => ({
    connectionName: "pair",
    rootConnectionName: "net",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    ...(index === 0 ? { startPcbPortId: "a" } : {}),
    ...(index === 4 ? { endPcbPortId: "b" } : {}),
    route,
    vias: recomputeViasFromRoute(route, "input stub"),
  }))
  const original = structuredClone(hdRoutes)
  const solver = new MultipleHighDensityRouteStitchSolver3({
    connections: [{ name: "pair", pointsToConnect: [
      { x: -0.995, y: 6.059, layer: "top", pcb_port_id: "a" },
      { x: -0.995, y: 5.911, layer: "bottom", pcb_port_id: "b" },
    ] }],
    hdRoutes,
    layerCount: 4,
    preserveTerminalPcbPortIds: true,
  })
  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  expect(solver.mergedHdRoutes).toHaveLength(1)
  const merged = solver.mergedHdRoutes[0]!
  const endpoints = [
    { ...merged.route[0], id: merged.startPcbPortId },
    { ...merged.route.at(-1), id: merged.endPcbPortId },
  ]
  expect(endpoints).toContainEqual({ x: -0.995, y: 6.059, z: 0, id: "a" })
  expect(endpoints).toContainEqual({ x: -0.995, y: 5.911, z: 3, id: "b" })
  expect(merged.vias).toEqual([{ x: -1.6, y: 7 }])
  expect(merged.vias).toEqual(recomputeViasFromRoute(merged.route, "stitched route"))
  expect(hdRoutes).toEqual(original)
})
