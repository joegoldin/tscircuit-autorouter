import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { MultiHeadPolyLineIntraNodeSolver3 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver3_ViaPossibilitiesSolverIntegration"
import type { PolyLine2 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/types2"
import type { NodeWithPortPoints } from "lib/types/high-density-types"

test("optimized forces ignore connected routes but repel foreign routes", (): void => {
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "connected-route-forces",
    center: { x: 0, y: 0 },
    width: 6,
    height: 6,
    availableZ: [0, 1],
    portPoints: [
      { connectionName: "A", x: -2, y: -1, z: 0 },
      { connectionName: "A", x: 2, y: 1, z: 0 },
      { connectionName: "B", x: -2, y: 1, z: 0 },
      { connectionName: "B", x: 2, y: -1, z: 0 },
    ],
  }
  const lines: PolyLine2[] = [
    {
      connectionName: "A",
      start: { x: -2, y: -1, z1: 0, z2: 0 },
      end: { x: 2, y: 1, z1: 0, z2: 0 },
      mPoints: [{ x: -0.1, y: 0, z1: 0, z2: 0 }],
    },
    {
      connectionName: "B",
      start: { x: -2, y: 1, z1: 0, z2: 0 },
      end: { x: 2, y: -1, z1: 0, z2: 0 },
      mPoints: [{ x: 0.1, y: 0, z1: 0, z2: 0 }],
    },
  ]
  const connectedSolver = new MultiHeadPolyLineIntraNodeSolver3({
    nodeWithPortPoints: node,
    connMap: new ConnectivityMap({ net: ["A", "B"] }),
  })
  const connectedLines = structuredClone(lines)

  expect(
    connectedSolver.applyForcesToPolyLines(connectedLines).lastStepMoved,
  ).toBe(false)
  expect(connectedLines).toEqual(lines)

  const foreignSolver = new MultiHeadPolyLineIntraNodeSolver3({
    nodeWithPortPoints: node,
    connMap: new ConnectivityMap({ net_a: ["A"], net_b: ["B"] }),
  })
  const foreignLines = structuredClone(lines)

  expect(foreignSolver.applyForcesToPolyLines(foreignLines).lastStepMoved).toBe(
    true,
  )
  expect(foreignLines).not.toEqual(lines)
})
