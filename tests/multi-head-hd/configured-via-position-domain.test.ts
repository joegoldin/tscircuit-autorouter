import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver2 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver2_Optimized"
import type { PolyLine2 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/types2"

test("configured composed via force cannot push a legal center outside its accepted domain", (): void => {
  const solver = new MultiHeadPolyLineIntraNodeSolver2({
    nodeWithPortPoints: { capacityMeshNodeId: "domain", center: { x: 0, y: 0 }, width: 1.045, height: 3.135,
      portPoints: [{ connectionName: "via", x: 0.209, y: -1, z: 0 }, { connectionName: "via", x: 0.209, y: 1, z: 1 }] },
    viaDiameter: 0.5, traceWidth: 0.15, obstacleMargin: 0.127, enforceConfiguredClearance: true,
  })
  const maxX = solver.bounds.maxX - 0.25 - solver.BOUNDARY_PADDING
  const lines: PolyLine2[] = [
    { connectionName: "via", start: { x: maxX, y: -1, z1: 0, z2: 0 },
      end: { x: maxX, y: 1, z1: 1, z2: 1 }, mPoints: [{ x: maxX, y: 0, z1: 0, z2: 1 }] },
    { connectionName: "foreign", start: { x: -0.35, y: -1, z1: 0, z2: 0 },
      end: { x: -0.35, y: 1, z1: 0, z2: 0 }, mPoints: [{ x: -0.35, y: 0, z1: 0, z2: 0 }] },
  ]
  const endpoints = lines.map((line) => [structuredClone(line.start), structuredClone(line.end)])
  expect(solver.checkIfSolved({ polyLines: lines, minGaps: solver.computeMinGapBtwPolyLines(lines) })).toBe(true)
  solver.applyForcesToPolyLines(lines)
  expect(lines[0]!.mPoints[0]!.x).toBeLessThanOrEqual(maxX)
  expect(lines.map((line) => [line.start, line.end])).toEqual(endpoints)
  expect(lines[0]!.mPoints[0]).toMatchObject({ z1: 0, z2: 1 })
})
