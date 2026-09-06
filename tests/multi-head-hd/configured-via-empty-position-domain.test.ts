import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver2 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver2_Optimized"
import type { PolyLine2 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/types2"

test("configured via projection refuses an empty position domain without shrinking a via", (): void => {
  const solver = new MultiHeadPolyLineIntraNodeSolver2({
    nodeWithPortPoints: { capacityMeshNodeId: "too-narrow", center: { x: 0, y: 0 }, width: 0.5, height: 2,
      portPoints: [{ connectionName: "route", x: -0.25, y: 0, z: 0 }, { connectionName: "route", x: 0.25, y: 0, z: 1 }] },
    viaDiameter: 0.5, traceWidth: 0.15, obstacleMargin: 0.127, enforceConfiguredClearance: true,
  })
  const lines: PolyLine2[] = [{ connectionName: "route",
    start: { x: -0.25, y: 0, z1: 0, z2: 0 }, end: { x: 0.25, y: 0, z1: 1, z2: 1 },
    mPoints: [{ x: 0, y: 0, z1: 0, z2: 1 }] }]
  const original = structuredClone(lines)
  expect(() => solver.applyForcesToPolyLines(lines)).toThrow(/empty via-center domain/)
  expect(lines).toEqual(original)
  expect(solver.viaDiameter).toBe(0.5)
})
