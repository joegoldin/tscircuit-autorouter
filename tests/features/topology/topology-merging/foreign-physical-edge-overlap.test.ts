import { expect, test } from "bun:test"
import { TopologyMergingSolver } from "lib/solvers/TopologyMergingSolver/TopologyMergingSolver"
import { createTopologyMergingTestNode } from "../../../fixtures/topology-merging-test-utils"

test("foreign physical copper edge overlap cannot be carved as clearance fringe", (): void => {
  const targets = [
    { id: "global-pad", minX: 0, maxX: 4, owner: "net-a" },
    { id: "component-pad", minX: 3.5, maxX: 5.5, owner: "net-b" },
  ].map(({ id, minX, maxX, owner }) => ({
    ...createTopologyMergingTestNode({
      id,
      bounds: { minX, maxX, minY: -0.5, maxY: 0.5 },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: owner,
  }))
  const input = {
    layerCount: 2,
    nodeGroups: targets.map((node, index) => ({
      groupId: `group-${index}`,
      isComponent: index === 1,
      nodes: [node],
    })),
    physicalObstacles: targets.map((node) => ({
      type: "rect" as const,
      center: node.center,
      width: node.width,
      height: node.height,
      layers: ["top"],
      connectedTo: [node._targetConnectionName],
    })),
  }
  const before = structuredClone(input)
  expect(() => new TopologyMergingSolver(input).solve()).toThrow(
    "unresolved inter-group overlap",
  )
  expect(input).toEqual(before)
})
