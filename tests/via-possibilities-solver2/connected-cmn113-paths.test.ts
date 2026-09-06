import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { MultiHeadPolyLineIntraNodeSolver3 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver3_ViaPossibilitiesSolverIntegration"
import { cmn113Node } from "../features/never-fail-growth-high-density/cmn113-node"

test("ViaPossibilitiesSolver2 preserves connected coincident cmn113 paths", (): void => {
  const solver = new MultiHeadPolyLineIntraNodeSolver3({
    nodeWithPortPoints: cmn113Node,
    connMap: new ConnectivityMap({
      source_net_1: ["source_net_1_mst2", "source_net_1_mst5"],
      source_net_3: ["source_net_3_mst0", "source_net_3_mst1"],
      source_net_4: ["source_net_4_mst0", "source_net_4_mst1"],
    }),
    viaDiameter: 0.5,
    traceWidth: 0.15,
    obstacleMargin: 0.127,
    enforceConfiguredClearance: true,
    hyperParameters: {
      MULTI_HEAD_POLYLINE_SOLVER: true,
      SEGMENTS_PER_POLYLINE: 6,
      BOUNDARY_PADDING: 0.05,
    },
  })

  const candidate = solver.createInitialCandidateFromSeed(0)

  expect(candidate).not.toBeNull()
  expect(solver.failed).toBe(false)
  expect(candidate!.polyLines).toHaveLength(7)
  expect(
    candidate!.polyLines.map(({ connectionName }) => connectionName).sort(),
  ).toEqual(
    Array.from(
      new Set(cmn113Node.portPoints.map((point) => point.connectionName)),
    ).sort(),
  )
  expect(
    candidate!.polyLines.filter(({ connectionName }) =>
      ["source_net_1_mst2", "source_net_1_mst5"].includes(connectionName),
    ),
  ).toHaveLength(2)
})
