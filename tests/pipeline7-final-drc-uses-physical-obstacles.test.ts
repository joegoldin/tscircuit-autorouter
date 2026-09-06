import { expect, test } from "bun:test"
import type { AutoroutingDrcError } from "high-density-repair03/lib"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { PreprocessSimpleRouteJsonSolver } from "lib/autorouter-pipelines/AutoroutingPipeline4_TinyHypergraph/PreprocessSimpleRouteJsonSolver"
import type {
  SimpleRouteJson,
  SimplifiedPcbTrace,
  SimplifiedPcbTraces,
} from "lib/types"
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

const getCandidateTrace = (shift = 0): SimplifiedPcbTrace => ({
  type: "pcb_trace" as const,
  pcb_trace_id: "candidate_trace",
  connection_name: "candidate_net",
  connectsTo: ["candidate_start", "candidate_end"],
  route: [
    {
      route_type: "wire" as const,
      x: -26 + shift,
      y: -2.459 + shift,
      layer: "top" as const,
      width: 0.1,
    },
    {
      route_type: "wire" as const,
      x: -25.675 + shift,
      y: -2.134 + shift,
      layer: "top" as const,
      width: 0.1,
    },
  ],
})

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

class FinalDrcHarness extends AutoroutingPipelineSolver7_MultiGraph {
  usePreprocessedSrj(srj: SimpleRouteJson): void {
    this.srjWithPointPairs = srj
    this.connMap = getConnectivityMapFromSimpleRouteJson(srj)
  }

  evaluateFinalDrc(traces: SimplifiedPcbTraces): AutoroutingDrcError[] {
    return this.getFinalDrcErrors(traces)
  }
}

test("Pipeline7 final DRC checks physical copper without coarse trace obstacles", () => {
  const preprocessSolver = new PreprocessSimpleRouteJsonSolver(originalSrj)
  preprocessSolver.solve()
  const preprocessedSrj = preprocessSolver.getOutputSimpleRouteJson()
  expect(
    preprocessedSrj.obstacles.some((obstacle) =>
      obstacle.obstacleId?.startsWith("trace_obstacle_fixed_trace_"),
    ),
  ).toBe(true)

  const solver = new FinalDrcHarness(originalSrj, { cacheProvider: null })
  solver.usePreprocessedSrj(preprocessedSrj)

  expect(solver.evaluateFinalDrc([fixedTrace, getCandidateTrace()])).toEqual([])

  const crossingErrors = solver.evaluateFinalDrc([
    fixedTrace,
    getCandidateTrace(0.25),
  ])
  expect(
    crossingErrors.some(
      (error) =>
        error.pcb_trace_error_id === "overlap_fixed_trace_candidate_trace",
    ),
  ).toBe(true)

  expect(
    solver.evaluateFinalDrc([
      {
        type: "pcb_trace",
        pcb_trace_id: "clear_of_rotated_pad_trace",
        connection_name: "clear_of_rotated_pad_net",
        route: [
          {
            route_type: "wire",
            x: -1.5,
            y: -0.8,
            layer: "top",
            width: 0.1,
          },
          {
            route_type: "wire",
            x: 1.5,
            y: -0.8,
            layer: "top",
            width: 0.1,
          },
        ],
      },
    ]),
  ).toEqual([])

  const realPadErrors = solver.evaluateFinalDrc([
    {
      type: "pcb_trace",
      pcb_trace_id: "foreign_pad_trace",
      connection_name: "foreign_pad_net",
      route: [
        {
          route_type: "wire",
          x: -0.5,
          y: 0,
          layer: "top",
          width: 0.1,
        },
        {
          route_type: "wire",
          x: 0.5,
          y: 0,
          layer: "top",
          width: 0.1,
        },
      ],
    },
  ])
  expect(
    realPadErrors.some((error) =>
      String(error.pcb_trace_error_id).includes("pcb_plated_hole_real"),
    ),
  ).toBe(true)
})
