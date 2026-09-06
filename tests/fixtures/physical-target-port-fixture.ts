import type { CapacityMeshNode, SimpleRouteJson } from "lib/types"
import type { SharedEdgeSegment } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"

export function createPhysicalTargetPortFixture(): {
  srj: SimpleRouteJson
  nodes: CapacityMeshNode[]
  segments: SharedEdgeSegment[]
} {
  const srj: SimpleRouteJson = {
    layerCount: 2, minTraceWidth: 0.15, minTraceToPadEdgeClearance: 0.127,
    bounds: { minX: -3, maxX: 3, minY: -3, maxY: 3 },
    connections: [{ name: "route", __rootConnectionNames: ["net"], pointsToConnect: [
      { x: -0.5, y: 0, layer: "top", pcb_port_id: "a" },
      { x: 0.5, y: 0, layer: "top", pcb_port_id: "b" },
    ] }],
    obstacles: [
      { type: "rect", center: { x: 0, y: 0 }, width: 2, height: 0.2,
        layers: ["top"], connectedTo: ["a", "b", "net"] },
      { type: "rect", center: { x: 0, y: 0.4 }, width: 0.5, height: 0.4,
        layers: ["top"], connectedTo: ["foreign"] },
    ],
  }
  const nodes: CapacityMeshNode[] = [-0.5, 0.5].map((x, i) => ({
    capacityMeshNodeId: `target${i}`, center: { x, y: 0 }, width: 1, height: 1,
    layer: "top", availableZ: [0, 1], _containsTarget: true,
    _connectedTo: [i === 0 ? "a" : "b"],
  }))
  const nodeIds: [string, string] = ["target0", "target1"]
  const segments: SharedEdgeSegment[] = [{
    edgeId: "edge", nodeIds, start: { x: 0, y: -0.5 }, end: { x: 0, y: 0.5 }, availableZ: [0, 1],
    portPoints: [0.05, -0.2].map((y, i) => ({
      segmentPortPointId: `port${i}`, x: 0, y, availableZ: [0, 1], nodeIds,
      edgeId: "edge", connectionName: null, distToCentermostPortOnZ: i,
      cramped: true, tinyHypergraphPortPenalty: 7,
    })),
  }]
  return { srj, nodes, segments }
}
