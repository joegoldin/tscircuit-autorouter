import { expect, test } from "bun:test"
import { hasImpossibleSameLayerCrossingGeometry } from "lib/solvers/HyperHighDensitySolver/GrowShrinkHighDensityIntraNodeSolver/invalidSameLayerCrossingGeometry"
import type { NodeWithPortPoints } from "lib/types/high-density-types"

test("single-layer feasibility permits same-net crossings but rejects foreign-net crossings", () => {
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "node",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    availableZ: [0],
    portPoints: [
      { x: -1, y: 0, z: 0, connectionName: "rail_a", rootConnectionName: "rail" },
      { x: 1, y: 0, z: 0, connectionName: "rail_a", rootConnectionName: "rail" },
      { x: 0, y: -1, z: 0, connectionName: "rail_b", rootConnectionName: "rail" },
      { x: 0, y: 1, z: 0, connectionName: "rail_b", rootConnectionName: "rail" },
    ],
  }
  expect(hasImpossibleSameLayerCrossingGeometry(node)).toBe(false)
  const foreignNetNode = {
    ...node,
    portPoints: node.portPoints.map((point) => ({
      ...point,
      rootConnectionName: point.connectionName,
    })),
  }
  expect(hasImpossibleSameLayerCrossingGeometry(foreignNetNode)).toBe(true)
})
