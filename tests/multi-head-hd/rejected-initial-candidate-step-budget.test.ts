import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"

test("rejected initial orderings consume the configured per-step batch", () => {
  const solver = new MultiHeadPolyLineIntraNodeSolver({
    nodeWithPortPoints: {
      capacityMeshNodeId: "rejected-setup",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      portPoints: [
        { x: -1, y: 0, z: 0, connectionName: "route" },
        { x: 1, y: 0, z: 0, connectionName: "route" },
      ],
    },
    enforceConfiguredClearance: true,
  })
  solver.initialCandidateGenerator = (function* (): Generator<null> {
    while (true) yield null
  })()

  solver.step()

  expect(solver.initialCandidateAttempts).toBe(100)
  expect(solver.candidates).toEqual([])
  expect(solver.phase).toBe("setup")
  expect(solver.failed).toBe(false)
})
