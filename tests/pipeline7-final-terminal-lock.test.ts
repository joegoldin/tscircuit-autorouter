import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import type { SimpleRouteConnection, SimpleRouteJson } from "lib/types"
import type { HighDensityRoute } from "lib/types/high-density-types"

test("Pipeline7 relocks repaired output to authoritative PCB terminals", () => {
  const connection: SimpleRouteConnection = {
    name: "net",
    pointsToConnect: [
      { x: 0, y: 0, layer: "top", pcb_port_id: "pcb_port_a" },
      { x: 2, y: 0, layer: "top", pcb_port_id: "pcb_port_b" },
    ],
  }
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minViaDiameter: 0.5,
    minViaHoleDiameter: 0.2,
    minViaPadDiameter: 0.5,
    bounds: { minX: -1, minY: -1, maxX: 3, maxY: 1 },
    obstacles: [],
    connections: [connection],
  }
  const stitchedRoute: HighDensityRoute = {
    connectionName: "net",
    startPcbPortId: "pcb_port_a",
    endPcbPortId: "pcb_port_b",
    traceThickness: 0.15,
    viaDiameter: 0.5,
    route: [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ],
    vias: [],
  }
  const repairedRoute: HighDensityRoute = {
    connectionName: "net",
    traceThickness: 0.15,
    viaDiameter: 0.5,
    route: [
      { x: 0.1, y: 0, z: 1 },
      { x: 1.9, y: 0, z: 1 },
    ],
    vias: [],
  }
  const solver = new AutoroutingPipelineSolver7_MultiGraph(srj)
  solver.netToPointPairsSolver = {
    newConnections: [connection],
  } as unknown as NonNullable<typeof solver.netToPointPairsSolver>
  solver.highDensityStitchSolver = {
    mergedHdRoutes: [stitchedRoute],
  } as unknown as NonNullable<typeof solver.highDensityStitchSolver>
  solver.exactGeometryDrcForceImproveSolver = {
    getOutput: () => [repairedRoute],
  } as unknown as NonNullable<typeof solver.exactGeometryDrcForceImproveSolver>

  expect(() => solver._getOutputHdRoutes()).toThrow(
    'Cannot lock PCB terminals for "net": start terminal layer changed',
  )

  repairedRoute.route[0]!.z = 0
  repairedRoute.route[1]!.z = 0

  expect(solver._getOutputHdRoutes()).toEqual([
    {
      ...repairedRoute,
      startPcbPortId: "pcb_port_a",
      endPcbPortId: "pcb_port_b",
      route: [
        { x: 0, y: 0, z: 0, pcb_port_id: "pcb_port_a" },
        { x: 2, y: 0, z: 0, pcb_port_id: "pcb_port_b" },
      ],
    },
  ])
})
