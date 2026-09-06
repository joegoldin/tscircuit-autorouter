import { expect, test } from "bun:test"
import { getBoundsIntersection } from "lib/solvers/TopologyPlanningSolver/capacity-node-geometry"
import { TopologyMergingSolver } from "lib/solvers/TopologyMergingSolver/TopologyMergingSolver"
import {
  createTopologyMergingTestNode,
} from "../../../fixtures/topology-merging-test-utils"

test("topology merging refines a global target clearance fringe around foreign component copper", (): void => {
  const globalTarget = {
    ...createTopologyMergingTestNode({
      id: "cmn_393",
      bounds: {
        minX: -0.597,
        maxX: -0.043,
        minY: -2.902,
        maxY: 0.502,
      },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _connectedTo: ["pcb_smtpad_92", "pcb_port_49", "source_net_8"],
  }
  const thermalTarget = {
    ...createTopologyMergingTestNode({
      id: "u2-thermal-pad",
      bounds: { minX: -0.1, maxX: 4.1, minY: -4.1, maxY: 0.1 },
      availableZ: [0],
    }),
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "source_net_0",
  }
  const input = [
    { groupId: "global", nodes: [globalTarget], isComponent: false },
    { groupId: "component-u2", nodes: [thermalTarget], isComponent: true },
  ]
  const expectedInput = structuredClone(input)

  const solver = new TopologyMergingSolver({
    layerCount: 2,
    nodeGroups: input,
    physicalObstacles: [
      {
        type: "rect",
        center: { x: -0.32, y: -1.2 },
        width: 0.15,
        height: 3,
        layers: ["top"],
        connectedTo: ["pcb_smtpad_92", "pcb_port_49", "source_net_8"],
      },
    ],
  })
  solver.solve()
  const output = solver.getOutput()
  const preservedThermal = output.find(
    (node) => node.capacityMeshNodeId === "u2-thermal-pad",
  )
  const vdDaTargetRegion = output.find(
    (node) =>
      node.availableZ.includes(0) &&
      node._connectedTo?.includes("pcb_port_49") &&
      Math.abs(node.center.x + 0.32) <= node.width / 2 &&
      Math.abs(node.center.y + 1.2) <= node.height / 2,
  )

  expect(input).toEqual(expectedInput)
  expect(preservedThermal).toMatchObject({
    capacityMeshNodeId: "u2-thermal-pad",
    availableZ: [0],
    _containsObstacle: true,
    _containsTarget: true,
    _targetConnectionName: "source_net_0",
  })
  expect(preservedThermal?.center.x).toBeCloseTo(2)
  expect(preservedThermal?.center.y).toBeCloseTo(-2)
  expect(preservedThermal?.width).toBeCloseTo(4.2)
  expect(preservedThermal?.height).toBeCloseTo(4.2)
  expect(vdDaTargetRegion).toBeDefined()
  expect(vdDaTargetRegion?.availableZ).toEqual([0])
  expect(vdDaTargetRegion?._connectedTo).toContain("source_net_8")
  for (let a = 0; a < output.length; a++) {
    for (let b = a + 1; b < output.length; b++) {
      if (
        !output[a]!.availableZ.some((z) => output[b]!.availableZ.includes(z))
      ) {
        continue
      }
      const intersection = getBoundsIntersection(
        {
          minX: output[a]!.center.x - output[a]!.width / 2,
          maxX: output[a]!.center.x + output[a]!.width / 2,
          minY: output[a]!.center.y - output[a]!.height / 2,
          maxY: output[a]!.center.y + output[a]!.height / 2,
        },
        {
          minX: output[b]!.center.x - output[b]!.width / 2,
          maxX: output[b]!.center.x + output[b]!.width / 2,
          minY: output[b]!.center.y - output[b]!.height / 2,
          maxY: output[b]!.center.y + output[b]!.height / 2,
        },
      )
      expect(
        !intersection ||
          intersection.maxX - intersection.minX <= 1e-5 ||
          intersection.maxY - intersection.minY <= 1e-5,
      ).toBe(true)
    }
  }
})
