import { expect, test } from "bun:test"
import { GrowShrinkHighDensityIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/GrowShrinkHighDensityIntraNodeSolver"
import { makeCrossingSingleLayerNode } from "./test-helpers"

test("configured GrowShrink refuses an explicitly requested invalid constructor fallback", (): void => {
  const solver = new GrowShrinkHighDensityIntraNodeSolver({
    nodeWithPortPoints: makeCrossingSingleLayerNode(),
    enforceConfiguredClearance: true,
    fallbackToInvalidGeometryOnFailure: true,
  })

  expect(solver.solved).toBe(false)
  expect(solver.failed).toBe(true)
  expect(solver.solvedRoutes).toEqual([])
  expect(solver.error).toContain("impossible single-layer crossing")
})
