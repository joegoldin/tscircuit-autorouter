import { expect, test } from "bun:test"
import { CapacityMeshEdgeSolver2_NodeTreeOptimization } from "lib/solvers/CapacityMeshSolver/CapacityMeshEdgeSolver2_NodeTreeOptimization"
import type { CapacityMeshNode } from "lib/types"

test("all same-root target fragments retain access through one connected free edge", (): void => {
  const nodes: CapacityMeshNode[] = Array.from({ length: 24 }, (_, index) => ({
    capacityMeshNodeId: `fragment-${index}`,
    center: { x: index, y: 0 },
    width: 1,
    height: 1,
    layer: "z0",
    availableZ: [0],
    _containsTarget: true,
    _containsObstacle: true,
    _targetConnectionName: "gnd",
  }))
  nodes.push({
    capacityMeshNodeId: "free",
    center: { x: 24, y: 0 },
    width: 1,
    height: 1,
    layer: "z0",
    availableZ: [0],
  })
  const before = structuredClone(nodes)
  const solver = new CapacityMeshEdgeSolver2_NodeTreeOptimization(nodes)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.edges).toHaveLength(24)
  expect(nodes).toEqual(before)
})
