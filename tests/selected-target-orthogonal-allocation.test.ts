import { expect, test } from "bun:test"
import type { CapacityMeshNode } from "lib/types"
import type { NodeWithPortPoints, PortPoint } from "lib/types/high-density-types"
import type { SharedEdgeSegment } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"
import { allocateSelectedTargetPortSpacing } from "lib/solvers/AvailableSegmentPointSolver/allocateSelectedTargetPortSpacing"

test("a two-entry shared corner uses the minimum bounded outward displacement", (): void => {
  const connections = [
    { name: "vertical", pointsToConnect: [{ x: 2, y: 1, layer: "top", pcb_port_id: "pv" }] },
    { name: "horizontal", pointsToConnect: [{ x: 1, y: 2, layer: "top", pcb_port_id: "ph" }] },
  ]
  const originalSrj = { layerCount: 2, minTraceWidth: 0.15, bounds: { minX: 0, maxX: 3, minY: 0, maxY: 3 },
    connections, obstacles: [] }
  const capacityNodes: CapacityMeshNode[] = [
    { capacityMeshNodeId: "common", center: { x: 1, y: 1 }, width: 2, height: 2, layer: "z0", availableZ: [0] },
    { capacityMeshNodeId: "tv", center: { x: 2.5, y: 1 }, width: 1, height: 1,
      layer: "z0", availableZ: [0], _containsTarget: true, _connectedTo: ["vertical"] },
    { capacityMeshNodeId: "th", center: { x: 1, y: 2.5 }, width: 1, height: 1,
      layer: "z0", availableZ: [0], _containsTarget: true, _connectedTo: ["horizontal"] },
  ]
  const segments: SharedEdgeSegment[] = [
    { edgeId: "ev", nodeIds: ["common", "tv"], start: { x: 2, y: 1 }, end: { x: 2, y: 2 },
      availableZ: [0], portPoints: [{ segmentPortPointId: "ev_pp0_z0", x: 2, y: 1.747, availableZ: [0],
        nodeIds: ["common", "tv"], edgeId: "ev", connectionName: null, distToCentermostPortOnZ: 0, cramped: false }] },
    { edgeId: "eh", nodeIds: ["common", "th"], start: { x: 1, y: 2 }, end: { x: 2, y: 2 },
      availableZ: [0], portPoints: [{ segmentPortPointId: "eh_pp0_z0", x: 2, y: 2, availableZ: [0],
        nodeIds: ["common", "th"], edgeId: "eh", connectionName: null, distToCentermostPortOnZ: 0, cramped: false }] },
  ]
  const selected: PortPoint[] = [
    { ...segments[0]!.portPoints[0]!, portPointId: "ev_pp0_z0::0", z: 0, connectionName: "vertical" },
    { ...segments[1]!.portPoints[0]!, portPointId: "eh_pp0_z0::0", z: 0, connectionName: "horizontal" },
  ]
  const nodes: NodeWithPortPoints[] = capacityNodes.map((node) => ({
    ...node, portPoints: selected.map((point) => ({ ...point })),
    portPointsInPairs: selected.map((point) => [{ ...point }, { ...point }]),
  }))
  const original = structuredClone(nodes)
  const output = allocateSelectedTargetPortSpacing({
    nodesWithPortPoints: nodes, capacityNodes, sharedEdgeSegments: segments,
    originalSrj, pairedConnections: connections, traceWidth: 0.15, clearance: 0.127,
  })
  const unique = [...new Map(output.flatMap((node) => node.portPoints).map((point) => [point.portPointId, point])).values()]
  expect(unique[0]!.x).toBe(2)
  expect(unique[0]!.y).toBeCloseTo(1.7239598716, 8)
  expect(unique[1]!.x).toBeCloseTo(1.9769598716, 8)
  expect(unique[1]!.y).toBe(2)
  expect(Math.hypot(unique[0]!.x - unique[1]!.x, unique[0]!.y - unique[1]!.y)).toBeCloseTo(0.277, 9)
  expect(nodes).toEqual(original)

  const sameRootConnections = connections.map((connection) => ({
    ...connection, rootConnectionName: "shared",
  }))
  expect(allocateSelectedTargetPortSpacing({
    nodesWithPortPoints: nodes, capacityNodes, sharedEdgeSegments: segments,
    originalSrj: { ...originalSrj, connections: sameRootConnections },
    pairedConnections: sameRootConnections, traceWidth: 0.15, clearance: 0.127,
  })).toBe(nodes)

  const blockedSrj = {
    ...originalSrj,
    connections: [...connections, { name: "blocker", pointsToConnect: [{ x: 0, y: 0, layer: "top", pcb_port_id: "blocker" }] }],
    obstacles: [{ type: "rect" as const, center: { x: 2, y: 1.7239598716 }, width: 0.01, height: 0.01,
      layers: ["top"], connectedTo: ["blocker"] }],
  }
  expect(allocateSelectedTargetPortSpacing({
    nodesWithPortPoints: nodes, capacityNodes, sharedEdgeSegments: segments,
    originalSrj: blockedSrj, pairedConnections: connections,
    traceWidth: 0.15, clearance: 0.127,
  })).toBe(nodes)

  const shortSegments = structuredClone(segments)
  shortSegments[0]!.start.y = 1.9
  shortSegments[0]!.portPoints[0]!.y = 2
  shortSegments[1]!.start.x = 1.9
  shortSegments[1]!.portPoints[0]!.x = 2
  const cornerNodes = structuredClone(nodes)
  for (const node of cornerNodes) {
    for (const point of [...node.portPoints, ...node.portPointsInPairs!.flat()]) {
      point.x = 2
      point.y = 2
    }
  }
  expect(allocateSelectedTargetPortSpacing({
    nodesWithPortPoints: cornerNodes, capacityNodes, sharedEdgeSegments: shortSegments,
    originalSrj, pairedConnections: connections, traceWidth: 0.15, clearance: 0.127,
  })).toBe(cornerNodes)
})
