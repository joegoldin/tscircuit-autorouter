import { expect, test } from "bun:test"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { recomputeViasFromRoute } from "lib/utils/recomputeViasFromRoute"

test("destination terminal stub is consumed after its explicit layer bridge", () => {
  const connectionName = "source_trace_165"
  const makeRoute = (
    regionId: string,
    route: HighDensityIntraNodeRoute["route"],
    terminalIds: Pick<
      HighDensityIntraNodeRoute,
      "startPcbPortId" | "endPcbPortId"
    > = {},
  ): HighDensityIntraNodeRoute => ({
    connectionName,
    rootConnectionName: connectionName,
    regionId,
    route,
    vias: recomputeViasFromRoute(route, regionId),
    traceThickness: 0.15,
    viaDiameter: 0.3,
    ...terminalIds,
  })
  const destination = { x: -2.7, y: 2.573, z: 1 }
  const source = { x: 2.7, y: 23.073, z: 1 }
  const routes = [
    makeRoute("destination-stub", [
      destination,
      { x: -3.55, y: 2.68, z: 1 },
    ], { startPcbPortId: "pcb_port_248" }),
    makeRoute("bottom-connector", [{ x: -3.55, y: 2.68, z: 1 }]),
    makeRoute("explicit-layer-bridge", [
      { x: -3.645, y: 2.68, z: 1 },
      { x: -3.911, y: 2.7, z: 1 },
      { x: -3.911, y: 2.7, z: 0 },
      { x: -3.645, y: 2.68, z: 0 },
    ]),
    makeRoute("top-connector", [{ x: -3.645, y: 2.68, z: 0 }]),
    makeRoute("top-main", [
      { x: -3.55, y: 2.68, z: 0 },
      { x: -3.325, y: 4.423, z: 0 },
      { x: -1.85, y: 20.291, z: 0 },
    ]),
    makeRoute("source-route", [
      { x: -1.85, y: 20.291, z: 0 },
      { x: 0.351, y: 20.56, z: 0 },
      { x: 0.351, y: 20.56, z: 1 },
      source,
    ], { endPcbPortId: "pcb_port_260" }),
  ]
  const originalRoutes = structuredClone(routes)
  const solver = new MultipleHighDensityRouteStitchSolver3({
    connections: [{
      name: connectionName,
      pointsToConnect: [
        { ...destination, layer: "bottom", pcb_port_id: "pcb_port_248" },
        { ...source, layer: "bottom", pcb_port_id: "pcb_port_260" },
      ],
    }],
    hdRoutes: routes,
    layerCount: 2,
    preserveTerminalPcbPortIds: true,
  })

  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  expect(solver.mergedHdRoutes).toHaveLength(1)
  const merged = solver.mergedHdRoutes[0]!
  expect({ ...merged.route[0], id: merged.startPcbPortId }).toEqual({
    ...source,
    id: "pcb_port_260",
  })
  const destinationIndex = merged.route.findIndex(
    (point) => point.x === destination.x && point.y === destination.y,
  )
  expect(destinationIndex).toBe(merged.route.length - 1)
  expect(merged.route[destinationIndex]).toEqual(destination)
  expect(merged.endPcbPortId).toBe("pcb_port_248")
  expect(merged.vias).toEqual([
    { x: 0.351, y: 20.56 },
    { x: -3.911, y: 2.7 },
  ])
  expect(merged.vias).toEqual(
    recomputeViasFromRoute(merged.route, "stitched route"),
  )
  expect(merged.route.filter(
    (point) => point.x === destination.x && point.y === destination.y,
  )).toHaveLength(1)
  expect(routes).toEqual(originalRoutes)
})
