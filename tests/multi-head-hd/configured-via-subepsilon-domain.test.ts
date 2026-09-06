import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver2 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver2_Optimized"
import type { PolyLine2 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/types2"

test("configured via projection repairs subepsilon boundary overflow without requiring repulsion", (): void => {
  const solver = new MultiHeadPolyLineIntraNodeSolver2({
    nodeWithPortPoints: { capacityMeshNodeId: "epsilon", center: { x: 0, y: 0 }, width: 1.045, height: 3.135,
      portPoints: [{ connectionName: "route", x: -0.5225, y: 0, z: 0 }, { connectionName: "route", x: 0.5225, y: 0, z: 1 }] },
    viaDiameter: 0.5, traceWidth: 0.15, obstacleMargin: 0.127, enforceConfiguredClearance: true,
  })
  const maxX = solver.bounds.maxX - (solver.viaDiameter / 2 + solver.BOUNDARY_PADDING)
  const lines: PolyLine2[] = [{ connectionName: "route",
    start: { x: -0.5225, y: 0, z1: 0, z2: 0 }, end: { x: 0.5225, y: 0, z1: 1, z2: 1 },
    mPoints: [{ x: maxX + 1e-8, y: 0, z1: 0, z2: 1 }] }]
  expect(solver.checkIfSolved({ polyLines: lines, minGaps: [] })).toBe(false)
  solver.applyForcesToPolyLines(lines)
  expect(lines[0]!.mPoints[0]!.x).toBe(maxX)
  expect(solver.checkIfSolved({ polyLines: lines, minGaps: [] })).toBe(true)
})
