import type { CapacityMeshNode, SimpleRouteConnection, SimpleRouteJson } from "lib/types"
import type { NodeWithPortPoints, PortPoint } from "lib/types/high-density-types"
import { createExplicitOwnershipMap } from "lib/utils/createExplicitOwnershipMap"

interface SelectedTargetPortSpacingInput {
  nodesWithPortPoints: NodeWithPortPoints[]
  capacityNodes: CapacityMeshNode[]
  originalSrj: SimpleRouteJson
  pairedConnections: SimpleRouteConnection[]
  traceWidth: number
  clearance: number
}

export function assertSelectedTargetPortSpacing({
  nodesWithPortPoints,
  capacityNodes,
  originalSrj,
  pairedConnections,
  traceWidth,
  clearance,
}: SelectedTargetPortSpacingInput): void {
  const connMap = createExplicitOwnershipMap(originalSrj, pairedConnections)
  const targetNodeIds = new Set(capacityNodes.filter((node) => node._containsTarget).map((node) => node.capacityMeshNodeId))
  const targetPortIds = new Set<string>()
  const portOwners = new Map<string, Set<string>>()
  const selected = new Map<string, PortPoint>()
  for (const node of nodesWithPortPoints) {
    for (const port of node.portPoints) {
      if (!port.portPointId || port.pcb_port_id) continue
      const owners = portOwners.get(port.portPointId) ?? new Set<string>()
      owners.add(node.capacityMeshNodeId)
      portOwners.set(port.portPointId, owners)
      if (targetNodeIds.has(node.capacityMeshNodeId)) targetPortIds.add(port.portPointId)
      const key = JSON.stringify([port.portPointId, port.connectionName])
      const previous = selected.get(key)
      if (previous && (previous.x !== port.x || previous.y !== port.y || previous.z !== port.z)) {
        throw new Error(`Inconsistent shared crossing coordinates for "${port.portPointId}"`)
      }
      selected.set(key, port)
    }
  }
  const crossings = [...selected.values()].filter((port) => portOwners.get(port.portPointId!)!.size > 1)
  for (let i = 0; i < crossings.length; i++) {
    const a = crossings[i]!
    const ownerA = connMap.getNetConnectedToId(a.connectionName)
    for (let j = i + 1; j < crossings.length; j++) {
      const b = crossings[j]!
      if (a.z !== b.z || (!targetPortIds.has(a.portPointId!) && !targetPortIds.has(b.portPointId!))) continue
      const ownerB = connMap.getNetConnectedToId(b.connectionName)
      if (ownerA !== undefined && ownerA === ownerB) continue
      const requiredDistance = traceWidth + clearance
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (distance < requiredDistance - 1e-9) {
        throw new Error(
          `Target-entry crossing clearance conflict: "${a.portPointId}" (${a.connectionName}) and "${b.portPointId}" (${b.connectionName}) on layer ${a.z} have center spacing ${distance}mm, require ${requiredDistance}mm; selected crossings cannot proceed to high-density routing`,
        )
      }
    }
  }
}
