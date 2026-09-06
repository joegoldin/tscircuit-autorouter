import { expect, test } from "bun:test"
import { CapacityMeshEdgeSolver2_NodeTreeOptimization } from "lib/solvers/CapacityMeshSolver/CapacityMeshEdgeSolver2_NodeTreeOptimization"
import type { CapacityMeshNode } from "lib/types"

test("target access rejects foreign unknown disconnected and cross-layer relays", (): void => {
  const target: CapacityMeshNode = {
    capacityMeshNodeId: "target",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    layer: "z0",
    availableZ: [0],
    _containsTarget: true,
    _containsObstacle: true,
    _targetConnectionName: "gnd",
  }
  const relay = {
    ...target,
    capacityMeshNodeId: "relay",
    center: { x: 1, y: 0 },
  }
  const free: CapacityMeshNode = {
    capacityMeshNodeId: "free",
    center: { x: 2, y: 0 },
    width: 1,
    height: 1,
    layer: "z0",
    availableZ: [0],
  }
  const cases: CapacityMeshNode[][] = [
    [target, { ...relay, _targetConnectionName: "foreign" }, free],
    [target, { ...relay, _targetConnectionName: undefined }, free],
    [target, { ...relay, _containsObstacle: false }, free],
    [
      target,
      { ...relay, center: { x: 1.02, y: 0 } },
      { ...free, center: { x: 2.02, y: 0 } },
    ],
    [target, relay],
    [
      target,
      { ...relay, availableZ: [0, 1], layer: "z0,1" },
      { ...free, availableZ: [1], layer: "z1" },
    ],
  ]
  for (const nodes of cases) {
    const before = structuredClone(nodes)
    const solver = new CapacityMeshEdgeSolver2_NodeTreeOptimization(nodes)
    expect(() => solver.solve()).toThrow('Target obstacle region "target"')
    expect(solver.failed).toBe(true)
    expect(solver.solved).toBe(false)
    expect(nodes).toEqual(before)
  }
  const direct = new CapacityMeshEdgeSolver2_NodeTreeOptimization([
    target,
    { ...free, center: { x: 1, y: 0 } },
  ])
  direct.solve()
  expect(direct.solved).toBe(true)
  expect(direct.failed).toBe(false)
})
