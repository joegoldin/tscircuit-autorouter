import { expect, test } from "bun:test"
import {
  createTopologyMergingTestNode,
  solveTopologyMergingTestGroups,
} from "../../../fixtures/topology-merging-test-utils"

test("refining a same-owner top target preserves the global bottom-layer coverage", (): void => {
  const global = {
    ...createTopologyMergingTestNode({
      id: "global",
      bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      availableZ: [0, 1],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "gnd",
  }
  const top = { ...global, capacityMeshNodeId: "top", availableZ: [0], layer: "z0" }
  const output = solveTopologyMergingTestGroups([
    { groupId: "global", isComponent: false, nodes: [global] },
    { groupId: "component", isComponent: true, nodes: [top] },
  ])
  expect(output).toHaveLength(2)
  expect(
    output.find((node) => node.capacityMeshNodeId === "top")?.availableZ,
  ).toEqual([0])
  const bottom = output.find((node) => node.availableZ.includes(1))
  expect(bottom).toMatchObject({
    center: global.center,
    width: 2,
    height: 2,
    availableZ: [1],
    _targetConnectionName: "gnd",
  })
})
