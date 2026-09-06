import { expect, test } from "bun:test"
import { UniformPortDistributionSolver } from "lib/solvers/UniformPortDistributionSolver/UniformPortDistributionSolver"
import { getBug99OffEdgeUniformInput } from "./fixtures/bug99-off-edge-uniform-input"

test("uniform port distribution keeps ports fixed on a blocked recovered edge", (): void => {
  const input = getBug99OffEdgeUniformInput({
    obstacles: [
      {
        obstacleId: "blocking_obstacle",
        type: "rect",
        layers: ["top"],
        center: { x: -1.737495, y: 6.3 },
        width: 0.2,
        height: 1,
        connectedTo: [],
      },
    ],
  })
  const originalNodes = structuredClone(input.nodeWithPortPoints)
  const solver = new UniformPortDistributionSolver(input)

  solver.solve()

  expect(solver.mapOfOwnerPairToSharedEdge.size).toBe(1)
  expect(solver.getOutput()).toEqual(originalNodes)
})
