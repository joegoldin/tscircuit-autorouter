import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { MultiHeadPolyLineIntraNodeSolver3 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver3_ViaPossibilitiesSolverIntegration"
import { cmn113Node } from "../features/never-fail-growth-high-density/cmn113-node"

test("configured cmn113 seed vias use the accepted domain without changing seven terminal pairs", (): void => {
  const original = structuredClone(cmn113Node)
  const solver = new MultiHeadPolyLineIntraNodeSolver3({
    nodeWithPortPoints: cmn113Node,
    connMap: new ConnectivityMap({
      source_net_1: ["source_net_1_mst2", "source_net_1_mst5"],
      source_net_3: ["source_net_3_mst0", "source_net_3_mst1"],
      source_net_4: ["source_net_4_mst0", "source_net_4_mst1"],
    }),
    viaDiameter: 0.5, traceWidth: 0.15, obstacleMargin: 0.127,
    enforceConfiguredClearance: true,
    hyperParameters: { SEGMENTS_PER_POLYLINE: 6, BOUNDARY_PADDING: 0.05 },
  })
  const candidate = solver.createInitialCandidateFromSeed(0)
  expect(candidate).not.toBeNull()
  expect(solver.failed).toBe(false)
  expect(candidate!.polyLines).toHaveLength(7)
  const padding = 0.25 + 0.0635
  for (const line of candidate!.polyLines) {
    const endpoints = cmn113Node.portPoints.filter((point) => point.connectionName === line.connectionName)
    expect(line.start).toMatchObject({ ...endpoints[0]!, z1: endpoints[0]!.z, z2: endpoints[0]!.z })
    expect(line.end).toMatchObject({ ...endpoints[1]!, z1: endpoints[1]!.z, z2: endpoints[1]!.z })
    const full = [line.start, ...line.mPoints, line.end]
    expect(full.slice(1).every((point, i) => point.z1 === full[i]!.z2)).toBe(true)
    for (const via of line.mPoints.filter((point) => point.z1 !== point.z2)) {
      expect(via.x).toBeGreaterThanOrEqual(solver.bounds.minX + padding)
      expect(via.x).toBeLessThanOrEqual(solver.bounds.maxX - padding)
      expect(via.y).toBeGreaterThanOrEqual(solver.bounds.minY + padding)
      expect(via.y).toBeLessThanOrEqual(solver.bounds.maxY - padding)
    }
  }
  expect(cmn113Node).toEqual(original)
})
