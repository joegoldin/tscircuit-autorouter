import { expect, test } from "bun:test"
import {
  createTopologyMergingTestNode,
  solveTopologyMergingTestGroups,
} from "../../../fixtures/topology-merging-test-utils"

test("topology merging preserves overlapping targets on distinct layers", (): void => {
  const bottomTarget = {
    ...createTopologyMergingTestNode({
      id: "bottom-target",
      bounds: { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 },
      availableZ: [1],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "source_net_bottom",
  }
  const topComponentTarget = {
    ...createTopologyMergingTestNode({
      id: "top-component-target",
      bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "source_net_top",
  }

  const output = solveTopologyMergingTestGroups([
    { groupId: "global", nodes: [bottomTarget], isComponent: false },
    {
      groupId: "component",
      nodes: [topComponentTarget],
      isComponent: true,
    },
  ])

  expect(output).toHaveLength(2)
  expect(output).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        capacityMeshNodeId: "bottom-target",
        availableZ: [1],
        _targetConnectionName: "source_net_bottom",
      }),
      expect.objectContaining({
        capacityMeshNodeId: "top-component-target",
        availableZ: [0],
        _targetConnectionName: "source_net_top",
      }),
    ]),
  )
})
