import { expect, test } from "bun:test"
import { ViaPossibilitiesSolver2 } from "lib/solvers/ViaPossibilitiesSolver/ViaPossibilitiesSolver2"
import { cmn113Node } from "../features/never-fail-growth-high-density/cmn113-node"

test("ViaPossibilitiesSolver2 without a connectivity map keeps paths distinct", (): void => {
  const solver = new ViaPossibilitiesSolver2({
    nodeWithPortPoints: cmn113Node,
    viaDiameter: 0.5,
  })

  solver.solve()

  expect(solver.solved).toBe(false)
  expect(solver.failed).toBe(true)
  expect(solver.error).toBe("Exceeded max via count of 5")
})
