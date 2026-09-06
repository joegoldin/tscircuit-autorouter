import { expect, test } from "bun:test"
import {
  createTopologyMergingTestNode,
  solveTopologyMergingTestGroups,
} from "../../../fixtures/topology-merging-test-utils"

test("component target represents an overlapping global target with the same owner", (): void => {
  const globalTarget = {
    ...createTopologyMergingTestNode({
      id: "global-gnd-target",
      bounds: { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _connectedTo: ["source_net_0", "pcb_port_gnd"],
  }
  const componentTarget = {
    ...createTopologyMergingTestNode({
      id: "component-gnd-target",
      bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "source_net_0",
  }

  const output = solveTopologyMergingTestGroups([
    { groupId: "global", nodes: [globalTarget], isComponent: false },
    {
      groupId: "component",
      nodes: [componentTarget],
      isComponent: true,
    },
  ])

  expect(output).toHaveLength(1)
  expect(output[0]).toMatchObject({
    capacityMeshNodeId: "component-gnd-target",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    availableZ: [0],
    _containsTarget: true,
    _targetConnectionName: "source_net_0",
  })
})
