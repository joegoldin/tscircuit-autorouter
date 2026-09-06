import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import { TraceSimplificationSolver } from "lib/solvers/TraceSimplificationSolver/TraceSimplificationSolver"
import type { SimpleRouteJson } from "lib/types"
import type { HighDensityRoute } from "lib/types/high-density-types"

test("Pipeline7 simplification keeps PCB terminals on their physical layers", () => {
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minViaDiameter: 0.3,
    bounds: { minX: -2, maxX: 4, minY: -2, maxY: 2 },
    connections: [{
      name: "net",
      pointsToConnect: [
        { x: 0, y: 0, layer: "top", pcb_port_id: "pcb_port_top" },
        { x: 2, y: 0, layer: "bottom", pcb_port_id: "pcb_port_bottom" },
      ],
    }],
    obstacles: [
      { type: "rect", layers: ["top"], center: { x: 0, y: 0 }, width: 0.4, height: 0.4, connectedTo: ["net", "pcb_port_top"] },
      { type: "rect", layers: ["bottom"], center: { x: 0.15, y: 0 }, width: 0.4, height: 0.4, connectedTo: ["net", "pcb_port_bottom"] },
    ],
  }
  const route: HighDensityRoute = {
    connectionName: "net",
    rootConnectionName: "net",
    startPcbPortId: "pcb_port_top",
    endPcbPortId: "pcb_port_bottom",
    traceThickness: 0.15,
    viaDiameter: 0.3,
    route: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
      { x: 2, y: 0, z: 1 },
    ],
    vias: [{ x: 1, y: 0 }],
  }
  for (const reversed of [false, true]) {
    const inputRoute = structuredClone(route)
    if (reversed) {
      inputRoute.route.reverse()
      inputRoute.startPcbPortId = route.endPcbPortId
      inputRoute.endPcbPortId = route.startPcbPortId
    }
    const pipeline = new AutoroutingPipelineSolver7_MultiGraph(srj)
    pipeline.highDensityStitchSolver = new MultipleHighDensityRouteStitchSolver3({
      connections: srj.connections,
      hdRoutes: [inputRoute],
      colorMap: {},
      layerCount: 2,
      defaultViaDiameter: 0.3,
      preserveTerminalPcbPortIds: true,
    })
    pipeline.highDensityStitchSolver.solve()
    const stitched = structuredClone(pipeline.highDensityStitchSolver.mergedHdRoutes)
    const step = pipeline.pipelineDef.find((step) => step.solverName === "traceSimplificationSolver")!
    const [params] = step.getConstructorParams(pipeline) as ConstructorParameters<typeof TraceSimplificationSolver>
    const simplifier = new TraceSimplificationSolver(params)
    simplifier.solve()
    expect(simplifier.failed).toBe(false)
    expect(simplifier.solved).toBe(true)
    expect(simplifier.simplifiedHdRoutes).toHaveLength(1)
    const output = simplifier.simplifiedHdRoutes[0]!
    expect(output.route[0]).toMatchObject(stitched[0]!.route[0]!)
    expect(output.route.at(-1)).toMatchObject(stitched[0]!.route.at(-1)!)
    expect(output.startPcbPortId).toBe(stitched[0]!.startPcbPortId)
    expect(output.endPcbPortId).toBe(stitched[0]!.endPcbPortId)
    expect(output.vias).toHaveLength(1)
    expect(pipeline.highDensityStitchSolver.mergedHdRoutes).toEqual(stitched)
  }
})
