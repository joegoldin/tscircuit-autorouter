import type { CapacityMeshEdge, CapacityMeshNode, SimpleRouteJson } from "lib/types"

export function createTargetEntrySpacingFixture(): {
  srj: SimpleRouteJson
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
} {
  // Captured cmn62/U2 crystal target rectangles; remote terminals are reduced
  // into cmn62 so this fixture exercises crossing assignment, not full routing.
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.127,
    bounds: { minX: -4, maxX: 1, minY: -6, maxY: 0 },
    connections: [-1, -1.4].map((y, i) => ({
      name: `crystal${i}`,
      nominalTraceWidth: 0.15,
      pointsToConnect: [
        { x: -3, y: -2.488 - i, layer: "top", pcb_port_id: `remote${i}` },
        { x: -0.95, y, layer: "top", pcb_port_id: `pcb_port_${51 + i}` },
      ],
    })),
    obstacles: [-1, -1.4].map((y, i) => ({
      type: "rect",
      center: { x: -0.95, y },
      width: 0.85,
      height: 0.2,
      layers: ["top"],
      connectedTo: [`pcb_port_${51 + i}`, `crystal${i}`],
    })),
  }
  const nodes: CapacityMeshNode[] = [
    { capacityMeshNodeId: "cmn_62", center: { x: -2.5445, y: -3 },
      width: 1.935, height: 4.076, layer: "top", availableZ: [0, 1] },
    ...[-1, -1.4].map((y, i) => ({
      capacityMeshNodeId: `cmn_${345 + i}`, center: { x: -0.95, y },
      width: 1.254, height: 0.604, layer: "top", availableZ: [0],
      _containsTarget: true, _connectedTo: [`pcb_port_${51 + i}`],
    })),
  ]
  const edges: CapacityMeshEdge[] = [
    { capacityMeshEdgeId: "ce1645", nodeIds: ["cmn_62", "cmn_345"] },
    { capacityMeshEdgeId: "ce1643", nodeIds: ["cmn_62", "cmn_346"] },
  ]
  return { srj, nodes, edges }
}
