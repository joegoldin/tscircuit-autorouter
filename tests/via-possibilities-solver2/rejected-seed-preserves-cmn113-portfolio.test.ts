import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { MultiHeadPolyLineIntraNodeSolver3 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver3_ViaPossibilitiesSolverIntegration"
import { cmn113Node } from "../features/never-fail-growth-high-density/cmn113-node"

test("ordinary rejected seeds do not fail a cmn113 portfolio containing complete candidates", (): void => {
  const solver = new MultiHeadPolyLineIntraNodeSolver3({
    nodeWithPortPoints: cmn113Node,
    connMap: new ConnectivityMap({
      source_net_1: ["source_net_1_mst2", "source_net_1_mst5"],
      source_net_3: ["source_net_3_mst0", "source_net_3_mst1"],
      source_net_4: ["source_net_4_mst0", "source_net_4_mst1"],
    }),
    viaDiameter: 0.5, traceWidth: 0.15, obstacleMargin: 0.127,
    enforceConfiguredClearance: true, hyperParameters: { SEGMENTS_PER_POLYLINE: 6 },
  })
  solver.setupInitialPolyLines()
  expect(solver.candidates.length).toBeGreaterThan(0)
  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(false)
  expect(solver.error).toBeNull()
  expect(solver.seedRejectionCounts["via-count-exhausted"]).toBeGreaterThan(0)
  const expectedNames = [...new Set(cmn113Node.portPoints.map((point) => point.connectionName))].sort()
  for (const candidate of solver.candidates) {
    expect(candidate.polyLines.map((line) => line.connectionName).sort()).toEqual(expectedNames)
  }
  solver.phase = "solving"
  solver.step()
  expect(solver.lastCandidate).not.toBeNull()
})
