import { expect, test } from "bun:test"
import type { CapacityMeshNode } from "lib/types"
import type { NodeWithPortPoints } from "lib/types/high-density-types"
import type { SharedEdgeSegment } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"
import { allocateSelectedTargetPortSpacing } from "lib/solvers/AvailableSegmentPointSolver/allocateSelectedTargetPortSpacing"

test("corner allocation cannot overwrite or approach a third selected crossing", (): void => {
  const connections = ["a", "b", "c"].map((name, i) => ({
    name, pointsToConnect: [{ x: 4 + i, y: 4, layer: "top", pcb_port_id: `terminal_${name}` }],
  }))
  const capacityNodes: CapacityMeshNode[] = [
    { capacityMeshNodeId: "common", center: { x: 1, y: 1 }, width: 2, height: 2, layer: "z0", availableZ: [0] },
    ...connections.map(({ name }) => ({ capacityMeshNodeId: `target_${name}`, center: { x: 3, y: 1 },
      width: 1, height: 1, layer: "z0", availableZ: [0],
      _containsTarget: true, _connectedTo: [name] })),
  ]
  for (const thirdY of [1.47, 1.487]) {
    const raw = [
      { edgeId: "ea", nodeIds: ["common", "target_a"] as [string, string],
        start: { x: 2, y: 1 }, end: { x: 2, y: 2 }, x: 2, y: 1.747, name: "a" },
      { edgeId: "eb", nodeIds: ["common", "target_b"] as [string, string],
        start: { x: 1, y: 2 }, end: { x: 2, y: 2 }, x: 2, y: 2, name: "b" },
      { edgeId: "ec", nodeIds: ["common", "target_c"] as [string, string],
        start: { x: 2, y: 1.3 }, end: { x: 2, y: 1.9 }, x: 2, y: thirdY, name: "c" },
    ]
    const segments: SharedEdgeSegment[] = raw.map((edge) => ({
      ...edge, availableZ: [0], portPoints: [{ segmentPortPointId: `${edge.edgeId}_pp`,
        x: edge.x, y: edge.y, availableZ: [0], nodeIds: edge.nodeIds, edgeId: edge.edgeId,
        connectionName: null, distToCentermostPortOnZ: 0, cramped: false }],
    }))
    const points = raw.map((edge) => ({
      x: edge.x, y: edge.y, z: 0, portPointId: `${edge.edgeId}_pp::0`, connectionName: edge.name,
    }))
    const nodes: NodeWithPortPoints[] = capacityNodes.map((node) => ({
      ...node,
      portPoints: points.filter((point) =>
        node.capacityMeshNodeId === "common" ||
        node.capacityMeshNodeId === `target_${point.connectionName}`).map((point) => ({ ...point })),
    }))
    const output = allocateSelectedTargetPortSpacing({
      nodesWithPortPoints: nodes,
      capacityNodes,
      sharedEdgeSegments: segments,
      originalSrj: { layerCount: 2, minTraceWidth: 0.15, connections, obstacles: [],
        bounds: { minX: 0, minY: 0, maxX: 8, maxY: 8 } },
      pairedConnections: connections,
      traceWidth: 0.15,
      clearance: 0.127,
    })
    expect(output).toBe(nodes)
  }
})
