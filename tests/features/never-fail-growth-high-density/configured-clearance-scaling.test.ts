import { expect, test } from "bun:test"
import { GrowShrinkHighDensityIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/GrowShrinkHighDensityIntraNodeSolver"
import { makeNode } from "./test-helpers"

const obstacle = {
  obstacleId: "obstacle",
  type: "rect" as const,
  layers: ["top"],
  center: { x: 10.25, y: 20.25 },
  width: 0.2,
  height: 0.4,
  connectedTo: [],
}

test("GrowShrink scales physical clearance only when configured enforcement is enabled", () => {
  const createSolver = (enforceConfiguredClearance: boolean) => {
    const solver = new GrowShrinkHighDensityIntraNodeSolver({
      nodeWithPortPoints: makeNode(),
      traceWidth: 0.1,
      viaDiameter: 0.3,
      obstacleMargin: 0.15,
      obstacles: [obstacle],
      enforceConfiguredClearance,
    })
    solver.scaleFactor = 2
    ;(solver as any).createActiveSubSolver()
    return solver.activeSubSolver!.constructorParams
  }

  const legacyParams = createSolver(false)
  expect(legacyParams.traceWidth).toBe(0.1)
  expect(legacyParams.viaDiameter).toBe(0.3)
  expect(legacyParams.obstacleMargin).toBe(0.15)
  expect(legacyParams.obstacles).toEqual([obstacle])

  const strictParams = createSolver(true)
  expect(strictParams.traceWidth).toBe(0.2)
  expect(strictParams.viaDiameter).toBe(0.6)
  expect(strictParams.obstacleMargin).toBe(0.3)
  expect(strictParams.obstacles).toEqual([
    {
      ...obstacle,
      center: { x: 10.5, y: 20.5 },
      width: 0.4,
      height: 0.8,
    },
  ])
})
