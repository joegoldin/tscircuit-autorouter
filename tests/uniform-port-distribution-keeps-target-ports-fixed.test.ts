import { expect, test } from "bun:test"
import { UniformPortDistributionSolver } from "lib/solvers/UniformPortDistributionSolver/UniformPortDistributionSolver"
import { getBug99OffEdgeUniformInput } from "./fixtures/bug99-off-edge-uniform-input"

test("uniform port distribution keeps target-node ports fixed on a recovered edge", (): void => {
  const input = getBug99OffEdgeUniformInput({ containsTarget: true })
  const originalNodes = structuredClone(input.nodeWithPortPoints)
  const solver = new UniformPortDistributionSolver(input)

  solver.solve()

  expect(solver.mapOfOwnerPairToSharedEdge.size).toBe(1)
  expect(solver.getOutput()).toEqual(originalNodes)
})
