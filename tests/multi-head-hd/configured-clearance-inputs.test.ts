import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"
import type { NodeWithPortPoints } from "lib/types/high-density-types"

const node: NodeWithPortPoints = {
  capacityMeshNodeId: "configured-clearance-node",
  center: { x: 0, y: 0 },
  width: 2,
  height: 2,
  portPoints: [
    { x: -1, y: 0, z: 0, connectionName: "connection" },
    { x: 1, y: 0, z: 0, connectionName: "connection" },
  ],
}

test("MultiHead adds configured boundary padding only in clearance mode", () => {
  const createSolver = (enforceConfiguredClearance: boolean) =>
    new MultiHeadPolyLineIntraNodeSolver({
      nodeWithPortPoints: node,
      traceWidth: 0.1,
      viaDiameter: 0.4,
      obstacleMargin: 0.2,
      enforceConfiguredClearance,
    })

  const legacySolver = createSolver(false)
  expect(legacySolver.traceWidth).toBe(0.1)
  expect(legacySolver.obstacleMargin).toBe(0.2)
  expect(legacySolver.BOUNDARY_PADDING).toBe(0.05)

  const strictSolver = createSolver(true)
  expect(strictSolver.traceWidth).toBe(0.1)
  expect(strictSolver.obstacleMargin).toBe(0.2)
  expect(strictSolver.BOUNDARY_PADDING).toBe(0.1)
})
