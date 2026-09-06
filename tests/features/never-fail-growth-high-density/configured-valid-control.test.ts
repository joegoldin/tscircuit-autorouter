import { expect, test } from "bun:test"
import { GrowShrinkHighDensityIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/GrowShrinkHighDensityIntraNodeSolver"
import { makeNode } from "./test-helpers"

test("configured GrowShrink still accepts an ordinary valid route", (): void => {
  const node = makeNode()
  const solver = new GrowShrinkHighDensityIntraNodeSolver({
    nodeWithPortPoints: node,
    enforceConfiguredClearance: true,
    fallbackToInvalidGeometryOnFailure: true,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.solvedRoutes).toHaveLength(1)
  expect(solver.solvedRoutes[0]!.route[0]).toEqual({ x: 9.5, y: 20, z: 0 })
  expect(solver.solvedRoutes[0]!.route.at(-1)).toEqual({
    x: 10.5,
    y: 20,
    z: 0,
  })
  expect(solver.stats.invalidGeometryFallback).not.toBe(true)
})
