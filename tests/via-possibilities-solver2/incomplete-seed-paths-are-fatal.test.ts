import { expect, spyOn, test } from "bun:test"
import { ViaPossibilitiesSolver2 } from "lib/solvers/ViaPossibilitiesSolver/ViaPossibilitiesSolver2"
import { createViaSeedContractSolver } from "../fixtures/create-via-seed-contract-solver"

test("completed generator output must contain every expected connection exactly once", (): void => {
  for (const mode of ["missing", "foreign", "duplicate", "short", "nonfinite", "endpoint", "discontinuous-layer"] as const) {
    const spy = spyOn(ViaPossibilitiesSolver2.prototype, "solve").mockImplementation(function (this: ViaPossibilitiesSolver2): void {
      this.solved = true
      this.failed = false
      this.completedPaths = new Map([...this.portPairMap].map(([name, pair]) => [name, [pair.start, pair.end]]))
      const path = this.completedPaths.get("a")!
      if (mode === "missing") this.completedPaths.delete("b")
      if (mode === "foreign") { this.completedPaths.delete("b"); this.completedPaths.set("foreign", path) }
      if (mode === "duplicate") this.completedPaths = new Map([["a", path], ["a", path]])
      if (mode === "short") this.completedPaths.set("a", [path[0]!])
      if (mode === "nonfinite") this.completedPaths.set("a", [path[0]!, { x: Number.NaN, y: 0, z: 0 }, path[1]!])
      if (mode === "endpoint") this.completedPaths.set("a", [{ ...path[0]!, x: -1.5 }, path[1]!])
      if (mode === "discontinuous-layer") this.completedPaths.set("a", [path[0]!, { x: 0, y: -1, z: 1 }, path[1]!])
    })
    try {
      const solver = createViaSeedContractSolver()
      expect(() => solver.createInitialCandidateFromSeed(0)).toThrow(/Invalid ViaPossibilities/)
      expect(solver.candidates).toHaveLength(0)
      expect(solver.solvedRoutes).toHaveLength(0)
    } finally {
      spy.mockRestore()
    }
  }
})
