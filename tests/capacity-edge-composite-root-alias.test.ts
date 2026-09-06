import { expect, test } from "bun:test"
import { CapacityMeshEdgeSolver2_NodeTreeOptimization } from "lib/solvers/CapacityMeshSolver/CapacityMeshEdgeSolver2_NodeTreeOptimization"
import type { CapacityMeshNode } from "lib/types"

test("a global target relay uses its explicit unique root alias without guessing unknown ownership", (): void => {
  const target: CapacityMeshNode = {
    capacityMeshNodeId: "target",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    layer: "z1",
    availableZ: [1],
    _containsTarget: true,
    _containsObstacle: true,
    _targetConnectionName: "source_net_0",
  }
  const relay: CapacityMeshNode = {
    ...target,
    capacityMeshNodeId: "global-relay",
    center: { x: 1, y: 0 },
    _targetConnectionName: undefined,
    _connectedTo: ["pcb_port_88", "source_net_0"],
  }
  const free: CapacityMeshNode = {
    capacityMeshNodeId: "free",
    center: { x: 2, y: 0 },
    width: 1,
    height: 1,
    layer: "z1",
    availableZ: [1],
  }
  const input = [target, relay, free]
  const before = structuredClone(input)
  const solver = new CapacityMeshEdgeSolver2_NodeTreeOptimization(input)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.edges).toHaveLength(2)
  expect(input).toEqual(before)

  const otherRoot = {
    ...target,
    capacityMeshNodeId: "other-root",
    center: { x: 10, y: 0 },
    _targetConnectionName: "source_net_1",
  }
  for (const invalidRelay of [
    { ...relay, _connectedTo: ["pcb_port_unknown"] },
    { ...relay, _connectedTo: ["source_net_0", "source_net_1"] },
    { ...relay, _connectedTo: ["source_net_1", "source_net_0"] },
    { ...relay, _targetConnectionName: "source_net_1" },
    {
      ...relay,
      _targetConnectionName: "source_net_0",
      _connectedTo: ["source_net_1"],
    },
  ]) {
    const blocked = new CapacityMeshEdgeSolver2_NodeTreeOptimization([
      target,
      invalidRelay,
      free,
      otherRoot,
      { ...free, capacityMeshNodeId: "other-free", center: { x: 11, y: 0 } },
    ])
    expect(() => blocked.solve()).toThrow('Target obstacle region "target"')
    expect(blocked.failed).toBe(true)
  }
})
