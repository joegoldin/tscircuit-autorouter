import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"

test("initial candidate enumeration exhausts the existing solver step budget truthfully", () => {
  const solver = new MultiHeadPolyLineIntraNodeSolver({
    nodeWithPortPoints: {
      capacityMeshNodeId: "setup-budget",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      portPoints: [
        { x: -2, y: -1, z: 0, connectionName: "a" },
        { x: 2, y: 1, z: 0, connectionName: "a" },
        { x: -2, y: 1, z: 0, connectionName: "b" },
        { x: 2, y: -1, z: 0, connectionName: "b" },
      ],
    },
    enforceConfiguredClearance: true,
    hyperParameters: { SEGMENTS_PER_POLYLINE: 4 },
  })
  solver.INITIAL_CANDIDATE_ATTEMPTS_PER_STEP = 1
  solver.MAX_ITERATIONS = 1
  solver.checkIfSolved = () => false

  solver.solve()

  expect(solver.failed).toBe(true)
  expect(solver.solved).toBe(false)
  expect(solver.phase).toBe("setup")
  expect(solver.initialCandidateAttempts).toBe(2)
  expect(solver.error).toContain("ran out of iterations")
  expect(solver.error).not.toContain("Not possible")
})
