import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver3 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver3_ViaPossibilitiesSolverIntegration"

test("unavailable alternate layer is a named seed rejection and aggregate exhaustion", (): void => {
  const solver = new MultiHeadPolyLineIntraNodeSolver3({
    nodeWithPortPoints: { capacityMeshNodeId: "single-layer-crossing", center: { x: 0, y: 0 }, width: 4, height: 4,
      availableZ: [0], portPoints: [
        { connectionName: "horizontal", x: -2, y: 0, z: 0 },
        { connectionName: "horizontal", x: 2, y: 0, z: 0 },
        { connectionName: "vertical", x: 0, y: -2, z: 0 },
        { connectionName: "vertical", x: 0, y: 2, z: 0 },
      ] },
    enforceConfiguredClearance: true, viaDiameter: 0.5, traceWidth: 0.15, obstacleMargin: 0.127,
  })
  expect(solver.createInitialCandidateFromSeed(0)).toBeNull()
  expect(solver.failed).toBe(false)
  expect(solver.seedRejectionCounts).toEqual({ "no-alternate-layer": 1 })
  solver.setupInitialPolyLines()
  expect(solver.failed).toBe(true)
  expect(solver.solved).toBe(false)
  expect(solver.seedRejectionCounts).toEqual({ "no-alternate-layer": 2 })
  expect(solver.error).toMatch(/All 2 ViaPossibilities seeds rejected/)
  expect(solver.solvedRoutes).toHaveLength(0)
})
