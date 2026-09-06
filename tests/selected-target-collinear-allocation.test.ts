import { expect, test } from "bun:test"
import { allocateSelectedTargetPortSpacing } from "lib/solvers/AvailableSegmentPointSolver/allocateSelectedTargetPortSpacing"
import type { NodeWithPortPoints, PortPoint } from "lib/types/high-density-types"
import type { CapacityMeshNode } from "lib/types"
import type { SharedEdgeSegment } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"

test("selected collinear target crossings retain slots and move the minimum distance", (): void => {
  const connections = [
    { name: "a", nominalTraceWidth: 0.5, pointsToConnect: [{ x: 1, y: -0.25, layer: "top", pcb_port_id: "pa" }] },
    { name: "b", nominalTraceWidth: 0.15, pointsToConnect: [{ x: 1, y: 0.25, layer: "top", pcb_port_id: "pb" }] },
  ]
  const originalSrj = { layerCount: 2, minTraceWidth: 0.15, bounds: { minX: -1, maxX: 2, minY: -1, maxY: 1 },
    connections, obstacles: [] }
  const capacityNodes: CapacityMeshNode[] = [
    { capacityMeshNodeId: "common", center: { x: -0.5, y: 0 }, width: 1, height: 2, layer: "z0,1", availableZ: [0, 1] },
    { capacityMeshNodeId: "ta", center: { x: 0.5, y: -0.25 }, width: 1, height: 0.704,
      layer: "z0", availableZ: [0], _containsTarget: true, _connectedTo: ["a"] },
    { capacityMeshNodeId: "tb", center: { x: 0.5, y: 0.25 }, width: 1, height: 0.704,
      layer: "z0", availableZ: [0], _containsTarget: true, _connectedTo: ["b"] },
  ]
  const segments: SharedEdgeSegment[] = [
    { edgeId: "ea", nodeIds: ["common", "ta"], start: { x: 0, y: -0.602 }, end: { x: 0, y: 0.102 },
      availableZ: [0], portPoints: [-0.39425, -0.10575].map((y, i) => ({
        segmentPortPointId: `ea_pp${i}_z0`, x: 0, y, availableZ: [0], nodeIds: ["common", "ta"], edgeId: "ea",
        connectionName: null, distToCentermostPortOnZ: 0, cramped: false,
      })) },
    { edgeId: "eb", nodeIds: ["common", "tb"], start: { x: 0, y: -0.102 }, end: { x: 0, y: 0.602 },
      availableZ: [0], portPoints: [0.10575, 0.39425].map((y, i) => ({
        segmentPortPointId: `eb_pp${i}_z0`, x: 0, y, availableZ: [0], nodeIds: ["common", "tb"], edgeId: "eb",
        connectionName: null, distToCentermostPortOnZ: 0, cramped: false,
      })) },
  ]
  const points: PortPoint[] = [
    ...segments[0]!.portPoints.map((point) => ({ ...point, portPointId: `${point.segmentPortPointId}::0`, z: 0, connectionName: "a" })),
    ...segments[1]!.portPoints.map((point) => ({ ...point, portPointId: `${point.segmentPortPointId}::0`, z: 0, connectionName: "b" })),
  ]
  const nodes: NodeWithPortPoints[] = capacityNodes.map((node) => ({
    ...node, availableZ: [0, 1], portPoints: points.map((point) => ({ ...point })),
    portPointsInPairs: points.map((point) => [{ ...point }, { ...point }]),
  }))
  const original = structuredClone(nodes)
  const output = allocateSelectedTargetPortSpacing({
    nodesWithPortPoints: nodes, capacityNodes, sharedEdgeSegments: segments,
    originalSrj, pairedConnections: connections, traceWidth: 0.15, clearance: 0.127,
  })
  const unique = [...new Map(output.flatMap((node) => node.portPoints).map((point) => [point.portPointId, point])).values()]
  for (const [index, expected] of [-0.427, -0.1385, 0.1385, 0.427].entries()) {
    expect(unique[index]!.y).toBeCloseTo(expected, 8)
  }
  expect(unique.map((point) => point.portPointId)).toEqual(["ea_pp0_z0::0", "ea_pp1_z0::0", "eb_pp0_z0::0", "eb_pp1_z0::0"])
  expect(output.flatMap((node) => node.portPointsInPairs!).flat().every((point) =>
    unique.find((candidate) => candidate.portPointId === point.portPointId)?.y === point.y)).toBe(true)
  expect(nodes).toEqual(original)

  const narrowSegments = structuredClone(segments)
  narrowSegments[0]!.start.y = -0.2
  narrowSegments[0]!.end.y = 0
  narrowSegments[0]!.portPoints = [{ ...narrowSegments[0]!.portPoints[0]!, y: -0.1 }]
  narrowSegments[1]!.start.y = -0.05
  narrowSegments[1]!.end.y = 0.15
  narrowSegments[1]!.portPoints = [{ ...narrowSegments[1]!.portPoints[0]!, y: 0.05 }]
  const narrowPoints: PortPoint[] = [
    { ...narrowSegments[0]!.portPoints[0]!, portPointId: "ea_pp0_z0::0", z: 0, connectionName: "a" },
    { ...narrowSegments[1]!.portPoints[0]!, portPointId: "eb_pp0_z0::0", z: 0, connectionName: "b" },
  ]
  const narrowNodes: NodeWithPortPoints[] = capacityNodes.map((node) => ({
    ...node, portPoints: narrowPoints.map((point) => ({ ...point })),
    portPointsInPairs: narrowPoints.map((point) => [{ ...point }, { ...point }]),
  }))
  const blocked = {
    ...originalSrj,
    connections: [...connections, { name: "blocker", pointsToConnect: [{ x: 1.5, y: -0.36, layer: "top", pcb_port_id: "blocker" }] }],
    obstacles: [{ type: "rect" as const, center: { x: 0, y: -0.36 }, width: 0.01, height: 0.01,
      layers: ["top"], connectedTo: ["blocker"] }],
  }
  expect(allocateSelectedTargetPortSpacing({
    nodesWithPortPoints: narrowNodes, capacityNodes, sharedEdgeSegments: narrowSegments,
    originalSrj: blocked, pairedConnections: connections, traceWidth: 0.15, clearance: 0.127,
  })).toBe(narrowNodes)
})
