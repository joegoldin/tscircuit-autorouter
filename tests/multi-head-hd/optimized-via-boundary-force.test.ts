import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver3 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver3_ViaPossibilitiesSolverIntegration"
import type { PolyLine2 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/types2"
import type { NodeWithPortPoints } from "lib/types/high-density-types"

test("optimized via boundary force matches strict acceptance padding", (): void => {
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "via-boundary-force",
    center: { x: 0, y: 0 },
    width: 1.045,
    height: 3.135,
    availableZ: [0, 1],
    portPoints: [
      { connectionName: "control", x: -0.5225, y: 0, z: 0 },
      { connectionName: "control", x: 0.5225, y: 0, z: 1 },
    ],
  }
  const solver = new MultiHeadPolyLineIntraNodeSolver3({
    nodeWithPortPoints: node,
    viaDiameter: 0.5,
    traceWidth: 0.15,
    obstacleMargin: 0.127,
    enforceConfiguredClearance: true,
  })
  const makeLine = (viaX: number): PolyLine2 => ({
    connectionName: "control",
    start: { x: -0.5225, y: 0, z1: 0, z2: 0 },
    end: { x: 0.5225, y: 0, z1: 1, z2: 1 },
    mPoints: [{ x: viaX, y: 0, z1: 0, z2: 1 }],
  })
  const centeredLines = [makeLine(0)]

  expect(
    solver.checkIfSolved({ polyLines: centeredLines, minGaps: [] }),
  ).toBe(true)
  expect(solver.applyForcesToPolyLines(centeredLines).lastStepMoved).toBe(false)
  expect(centeredLines[0].mPoints[0].x).toBe(0)

  const legalMinX = solver.bounds.minX + 0.5 / 2 + solver.BOUNDARY_PADDING
  const outsideLines = [makeLine(legalMinX - 0.01)]
  const outsideXBefore = outsideLines[0].mPoints[0].x

  expect(
    solver.checkIfSolved({ polyLines: outsideLines, minGaps: [] }),
  ).toBe(false)
  expect(solver.applyForcesToPolyLines(outsideLines).lastStepMoved).toBe(true)
  expect(outsideLines[0].mPoints[0].x).toBeGreaterThan(outsideXBefore)
})
