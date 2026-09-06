import { expect, test } from "bun:test"
import {
  createTopologyMergingTestNode,
  solveTopologyMergingTestGroups,
} from "../../../fixtures/topology-merging-test-utils"

test("topology merging rejects a foreign target centered inside component copper", (): void => {
  const foreignTarget = {
    ...createTopologyMergingTestNode({
      id: "foreign-target",
      bounds: { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "source_net_foreign",
  }
  const componentTarget = {
    ...createTopologyMergingTestNode({
      id: "component-target",
      bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "source_net_component",
  }

  expect(() =>
    solveTopologyMergingTestGroups([
      { groupId: "global", nodes: [foreignTarget], isComponent: false },
      {
        groupId: "component",
        nodes: [componentTarget],
        isComponent: true,
      },
    ]),
  ).toThrow("unresolved inter-group overlap")
})
