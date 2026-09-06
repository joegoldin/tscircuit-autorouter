import { expect, test } from "bun:test"
import { TopologyMergingSolver } from "lib/solvers/TopologyMergingSolver/TopologyMergingSolver"
import type { Obstacle } from "lib/types"
import { createTopologyMergingTestNode } from "../../../fixtures/topology-merging-test-utils"

test("foreign fringe refinement requires complete unambiguous physical ownership on the shared layer", (): void => {
  const global = {
    ...createTopologyMergingTestNode({
      id: "global",
      bounds: { minX: 0, maxX: 4, minY: -0.5, maxY: 0.5 },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "net-a",
  }
  const component = {
    ...createTopologyMergingTestNode({
      id: "component",
      bounds: { minX: 3.5, maxX: 5.5, minY: -0.5, maxY: 0.5 },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "net-b",
  }
  const clear: Obstacle = {
    type: "rect",
    center: { x: 2, y: 0 },
    width: 2,
    height: 1,
    layers: ["top"],
    connectedTo: ["net-a"],
  }
  const colliding: Obstacle = { ...clear, center: { x: 3.6, y: 0 }, width: 0.2 }
  const nodeGroups = [
    { groupId: "global", nodes: [global], isComponent: false },
    { groupId: "component", nodes: [component], isComponent: true },
  ]
  for (const physicalObstacles of [
    undefined,
    [],
    [{ ...clear, layers: ["bottom"] }],
    [{ ...clear, connectedTo: ["unknown"] }],
    [{ ...clear, connectedTo: ["net-a", "net-b"] }],
    [clear, colliding],
    [colliding, clear],
  ]) {
    const input = { layerCount: 2, nodeGroups, physicalObstacles }
    const before = structuredClone(input)
    expect(() => new TopologyMergingSolver(input).solve()).toThrow(
      "unresolved inter-group overlap",
    )
    expect(input).toEqual(before)
  }
  const solver = new TopologyMergingSolver({
    layerCount: 2,
    nodeGroups,
    physicalObstacles: [clear],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(
    solver.getOutput().find((node) => node.capacityMeshNodeId === "component"),
  ).toMatchObject({ center: component.center, availableZ: [0] })
})
