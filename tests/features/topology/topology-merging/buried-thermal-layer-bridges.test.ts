import { expect, test } from "bun:test"
import type { CapacityMeshNode } from "lib/types"
import {
  createTopologyMergingTestNode,
  solveTopologyMergingTestGroups,
} from "../../../fixtures/topology-merging-test-utils"

test("buried same-owner bottom pad and plated hole survive global target precedence", (): void => {
  const node = (
    id: string,
    x: number,
    y: number,
    size: number,
    availableZ: number[],
  ): CapacityMeshNode => ({
    ...createTopologyMergingTestNode({
      id,
      bounds: {
        minX: x - size / 2,
        maxX: x + size / 2,
        minY: y - size / 2,
        maxY: y + size / 2,
      },
      availableZ,
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "source_net_0",
  })
  const global = node("cmn_528", 2, -2, 4.054, [0, 1])
  const physical = [
    node("top-ep", 2, -2, 4.2, [0]),
    node("bottom-ep", 2, -2, 3.65, [1]),
    node("plated-hole-8", 0.425, -1.475, 0.5, [0, 1]),
  ]
  for (const nodes of [physical, [...physical].reverse()]) {
    const input = [
      { groupId: "global", nodes: [global], isComponent: false },
      { groupId: "component", nodes, isComponent: true },
    ]
    const before = structuredClone(input)
    const output = solveTopologyMergingTestGroups(input)
    expect(input).toEqual(before)
    for (const expected of physical) {
      const actual = output.find(
        (n) => n.capacityMeshNodeId === expected.capacityMeshNodeId,
      )
      expect(actual).toBeDefined()
      expect(actual?.availableZ).toEqual(expected.availableZ)
      expect(actual?._targetConnectionName).toBe("source_net_0")
      expect(actual?.center.x).toBeCloseTo(expected.center.x)
      expect(actual?.center.y).toBeCloseTo(expected.center.y)
      expect(actual?.width).toBeCloseTo(expected.width)
      expect(actual?.height).toBeCloseTo(expected.height)
    }
  }
})
