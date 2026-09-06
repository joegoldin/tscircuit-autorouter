import { expect, test } from "bun:test"
import {
  createTopologyMergingTestNode,
  solveTopologyMergingTestGroups,
} from "../../../fixtures/topology-merging-test-utils"

test("a component target without copper cannot truncate a global obstacle target", (): void => {
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
  const marker = {
    ...createTopologyMergingTestNode({
      id: "marker",
      bounds: { minX: 3.5, maxX: 5.5, minY: -0.5, maxY: 0.5 },
      availableZ: [0],
    }),
    _containsTarget: true,
    _targetConnectionName: "net-b",
  }
  const input = [
    { groupId: "global", nodes: [global], isComponent: false },
    { groupId: "component", nodes: [marker], isComponent: true },
  ]
  const output = solveTopologyMergingTestGroups(input)
  expect(output.find((node) => node.capacityMeshNodeId === "global")).toMatchObject({
    center: { x: 2, y: 0 },
    width: 4,
    height: 1,
    availableZ: [0],
  })
})
