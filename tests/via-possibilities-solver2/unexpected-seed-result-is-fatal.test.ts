import { expect, spyOn, test } from "bun:test"
import { ViaPossibilitiesSolver2 } from "lib/solvers/ViaPossibilitiesSolver/ViaPossibilitiesSolver2"
import { createViaSeedContractSolver } from "../fixtures/create-via-seed-contract-solver"

test("unclassified failure and unsolved generator results remain fatal rather than rejected seeds", (): void => {
  for (const mode of ["failed", "unsolved", "throw", "conflicting-status"] as const) {
    const spy = spyOn(ViaPossibilitiesSolver2.prototype, "solve").mockImplementation(function (this: ViaPossibilitiesSolver2): void {
      if (mode === "throw") throw new Error("unexpected generator exception")
      this.failed = mode === "failed" || mode === "conflicting-status"
      this.solved = mode === "conflicting-status"
      if (mode === "conflicting-status") this.failureReason = "via-count-exhausted"
      this.error = mode === "failed" ? "unexpected generator failure" : null
    })
    try {
      const solver = createViaSeedContractSolver()
      expect(() => solver.createInitialCandidateFromSeed(0)).toThrow(/unexpected|Unexpected/)
      expect(solver.candidates).toHaveLength(0)
      expect(solver.solvedRoutes).toHaveLength(0)
    } finally {
      spy.mockRestore()
    }
  }
})
