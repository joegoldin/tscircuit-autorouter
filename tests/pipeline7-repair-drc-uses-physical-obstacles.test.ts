import { expect, test } from "bun:test"
import type { DrcError } from "high-density-repair03/lib"
import { PreprocessSimpleRouteJsonSolver } from "lib/autorouter-pipelines/AutoroutingPipeline4_TinyHypergraph/PreprocessSimpleRouteJsonSolver"
import { createPipeline7AutoroutingDrcEvaluator } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/create-pipeline7-autorouting-drc-evaluator"
import type { SimpleRouteConnection, SimpleRouteJson } from "lib/types"
import type { HighDensityRoute } from "lib/types/high-density-types"
import { getConnectivityMapFromSimpleRouteJson } from "lib/utils/getConnectivityMapFromSimpleRouteJson"

const fixedTrace = {
  type: "pcb_trace" as const,
  pcb_trace_id: "fixed_trace",
  connection_name: "fixed_net",
  connectsTo: ["pcb_port_fixed_start", "pcb_port_fixed_end"],
  route: [
    {
      route_type: "wire" as const,
      x: -24.79995,
      y: -2.4835198438833164,
      layer: "top" as const,
      width: 0.1,
    },
    {
      route_type: "wire" as const,
      x: -25.5477389863419,
      y: -1.735730857541414,
      layer: "top" as const,
      width: 0.1,
    },
  ],
}

const originalSrj: SimpleRouteJson = {
  bounds: { minX: -30, minY: -5, maxX: 2, maxY: 2 },
  layerCount: 2,
  minTraceWidth: 0.1,
  minTraceToPadEdgeClearance: 0.1,
  connections: [],
  obstacles: [
    {
      type: "rect",
      layers: ["top", "bottom"],
      center: { x: 0, y: 0 },
      width: 1.2,
      height: 2,
      ccwRotationDegrees: 90,
      connectedTo: ["pcb_plated_hole_real", "pcb_port_real"],
    },
  ],
  traces: [fixedTrace],
}

const evaluateCandidate = ({
  preprocessedSrj,
  start,
  end,
}: {
  preprocessedSrj: SimpleRouteJson
  start: { x: number; y: number }
  end: { x: number; y: number }
}): DrcError[] => {
  const candidateConnection: SimpleRouteConnection = {
    name: "candidate",
    pointsToConnect: [
      { ...start, layer: "top", pointId: "candidate_start" },
      { ...end, layer: "top", pointId: "candidate_end" },
    ],
  }
  const candidateRoute: HighDensityRoute = {
    connectionName: candidateConnection.name,
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      { ...start, z: 0 },
      { ...end, z: 0 },
    ],
    vias: [],
  }
  const connMap = getConnectivityMapFromSimpleRouteJson({
    ...preprocessedSrj,
    connections: [candidateConnection],
  })
  const result = createPipeline7AutoroutingDrcEvaluator({
    connections: [candidateConnection],
    originalConnections: [candidateConnection],
    layerCount: originalSrj.layerCount,
    obstacles: preprocessedSrj.obstacles,
    defaultViaHoleDiameter: 0.2,
    connMap,
    srjWithPointPairs: {
      ...preprocessedSrj,
      connections: [candidateConnection],
    },
    originalSrj: { ...originalSrj, connections: [candidateConnection] },
  })({ hdRoutes: [candidateRoute], traces: [] })

  if (Array.isArray(result)) return result
  return result.errors
}

test("Pipeline7 repair DRC checks preloaded copper exactly and retains real obstacles", () => {
  const preprocessSolver = new PreprocessSimpleRouteJsonSolver(originalSrj)
  preprocessSolver.solve()
  const preprocessedSrj = preprocessSolver.getOutputSimpleRouteJson()

  const separatedErrors = evaluateCandidate({
    preprocessedSrj,
    start: { x: -26, y: -2.459 },
    end: { x: -25.675, y: -2.134 },
  })
  expect(separatedErrors).toEqual([])

  const crossingErrors = evaluateCandidate({
    preprocessedSrj,
    start: { x: -25.75, y: -2.209 },
    end: { x: -25.425, y: -1.884 },
  })
  expect(
    crossingErrors.some(
      (error) => error.pcb_trace_error_id === "overlap_fixed_trace_candidate_0",
    ),
  ).toBe(true)

  const clearOfRotatedPadErrors = evaluateCandidate({
    preprocessedSrj,
    start: { x: -1.5, y: -0.8 },
    end: { x: 1.5, y: -0.8 },
  })
  expect(clearOfRotatedPadErrors).toEqual([])

  const realPadErrors = evaluateCandidate({
    preprocessedSrj,
    start: { x: -0.5, y: 0 },
    end: { x: 0.5, y: 0 },
  })
  expect(
    realPadErrors.some((error) =>
      String(error.pcb_trace_error_id).includes("pcb_plated_hole_real"),
    ),
  ).toBe(true)
})
