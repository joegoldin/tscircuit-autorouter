import { pointToBoxDistance } from "@tscircuit/math-utils"
import type { CapacityMeshNode, ConnectionPoint, SimpleRouteConnection, SimpleRouteJson } from "lib/types"
import { getConnectionPointLayers } from "lib/types"
import { createExplicitOwnershipMap } from "lib/utils/createExplicitOwnershipMap"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"
import type { SharedEdgeSegment } from "./AvailableSegmentPointSolver"

export interface TargetPortProjectionContext {
  originalSrj: SimpleRouteJson
  pairedConnections: SimpleRouteConnection[]
}

export function projectTargetPortPoints({
  sharedEdgeSegments,
  nodes,
  originalSrj,
  pairedConnections,
}: TargetPortProjectionContext & {
  sharedEdgeSegments: SharedEdgeSegment[]
  nodes: CapacityMeshNode[]
}): SharedEdgeSegment[] {
  const connMap = createExplicitOwnershipMap(originalSrj, pairedConnections)
  const nodeById = new Map(nodes.map((node) => [node.capacityMeshNodeId, node]))
  const terminalsByNodeId = new Map<string, ConnectionPoint[]>()
  for (const node of nodes.filter((node) => node._containsTarget)) {
    const owners = new Set([...(node._connectedTo ?? []), node._targetConnectionName].flatMap((alias) => {
      const owner = alias ? connMap.getNetConnectedToId(alias) : undefined
      return owner ? [owner] : []
    }))
    const terminals = originalSrj.connections.flatMap((connection) => connection.pointsToConnect).filter((point) => {
      if (!point.pcb_port_id || pointToBoxDistance(point, node) > 1e-9) return false
      const owner = connMap.getNetConnectedToId(point.pcb_port_id)
      return owner !== undefined && owners.has(owner)
    })
    terminalsByNodeId.set(node.capacityMeshNodeId, terminals)
  }

  return sharedEdgeSegments.map((segment) => {
    const targets = segment.nodeIds.filter((id) => nodeById.get(id)?._containsTarget)
    if (targets.length !== 1) return segment
    const dx = segment.end.x - segment.start.x
    const dy = segment.end.y - segment.start.y
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared === 0) return segment

    return {
      ...segment,
      portPoints: segment.portPoints.map((port) => {
        // Keep Tiny's single physical crossing identity: alternatives would
        // require mutually exclusive candidate support, not extra capacity.
        if (port.availableZ.length !== 1) return port
        const z = port.availableZ[0]!
        if (segment.portPoints.filter((candidate) => candidate.availableZ.includes(z)).length !== 1) return port
        const terminals = targets.flatMap((id) => terminalsByNodeId.get(id)!).filter((point) =>
          getConnectionPointLayers(point).some((layer) => mapLayerNameToZ(layer, originalSrj.layerCount) === z),
        )
        const uniqueTerminals = new Map(terminals.map((point) => [
          JSON.stringify([point.pcb_port_id, point.x, point.y]), point,
        ]))
        if (uniqueTerminals.size !== 1) return port
        const terminal = uniqueTerminals.values().next().value!
        const fraction = Math.max(0, Math.min(1,
          ((terminal.x - segment.start.x) * dx + (terminal.y - segment.start.y) * dy) / lengthSquared,
        ))
        return { ...port, x: segment.start.x + fraction * dx, y: segment.start.y + fraction * dy }
      }),
    }
  })
}
