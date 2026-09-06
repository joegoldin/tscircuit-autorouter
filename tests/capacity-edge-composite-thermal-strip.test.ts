import { expect, test } from "bun:test"
import { CapacityMeshEdgeSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshEdgeSolver"
import { CapacityMeshEdgeSolver2_NodeTreeOptimization } from "lib/solvers/CapacityMeshSolver/CapacityMeshEdgeSolver2_NodeTreeOptimization"
import type { CapacityMeshNode } from "lib/types"

test("the actual thermal strip reaches free space through its same-root top EP", (): void => {
  const nodes: CapacityMeshNode[] = [
    {
      capacityMeshNodeId: "obstacle-pcb_component_17-pcb_component_17:0.19999999999999996:0.7374999999999998:0.2:1.275:top-0-0.19999999999999996-0.7374999999999998__sub_0_0",
      center: { x: 0.19999999999999996, y: 0.41874999999999984 },
      width: 0.19999999999999998,
      height: 0.6375,
      availableZ: [0],
      layer: "z0",
      _containsObstacle: true,
      _containsTarget: true,
      _targetConnectionName: "source_net_0",
    },
    {
      capacityMeshNodeId: "obstacle-pcb_component_17-pcb_component_17:2:-2:4.2:4.2:top-0-2--2",
      center: { x: 1.9999999999999998, y: -1.9999999999999998 },
      width: 4.199999999999999,
      height: 4.199999999999999,
      availableZ: [0],
      layer: "z0",
      _containsObstacle: true,
      _containsTarget: true,
      _targetConnectionName: "source_net_0",
    },
    {
      capacityMeshNodeId: "topology_merge_603",
      center: { x: -0.20000000000000007, y: -3.9990000000000006 },
      width: 0.19999999999999996,
      height: 0.20199999999999818,
      availableZ: [0],
      layer: "z0",
    },
  ]
  const before = structuredClone(nodes)
  for (const Solver of [
    CapacityMeshEdgeSolver,
    CapacityMeshEdgeSolver2_NodeTreeOptimization,
  ]) {
    const solver = new Solver(nodes)
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.failed).toBe(false)
    expect(solver.edges.map((edge) => [...edge.nodeIds].sort()).sort()).toEqual(
      [
        [nodes[0]!.capacityMeshNodeId, nodes[1]!.capacityMeshNodeId].sort(),
        [nodes[1]!.capacityMeshNodeId, nodes[2]!.capacityMeshNodeId].sort(),
      ].sort(),
    )
    expect(nodes).toEqual(before)
  }
})
