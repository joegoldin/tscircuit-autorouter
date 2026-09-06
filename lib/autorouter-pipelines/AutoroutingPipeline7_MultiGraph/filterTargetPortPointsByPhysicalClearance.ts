import type { SharedEdgeSegment } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"
import type { CapacityMeshNode, SimpleRouteConnection, SimpleRouteJson } from "lib/types"
import { createExplicitOwnershipMap } from "lib/utils/createExplicitOwnershipMap"
import { createPhysicalObstacleClearanceChecker } from "./createPhysicalObstacleClearanceChecker"

interface PhysicalTargetPortInput {
  sharedEdgeSegments: SharedEdgeSegment[]
  capacityMeshNodes: CapacityMeshNode[]
  originalSrj: SimpleRouteJson
  pairedConnections: SimpleRouteConnection[]
  traceWidth: number
  obstacleMargin: number
}

/**
 * Filters board-world crossing points in mm against original physical copper.
 * Call after component/cramped segment selection so no later source restores
 * a crossing that violates a foreign pad. Other routing/final DRC gates remain necessary.
 */
export function filterTargetPortPointsByPhysicalClearance({
  sharedEdgeSegments,
  capacityMeshNodes,
  originalSrj,
  pairedConnections,
  traceWidth,
  obstacleMargin,
}: PhysicalTargetPortInput): SharedEdgeSegment[] {
  const connMap = createExplicitOwnershipMap(originalSrj, pairedConnections)
  const nodeById = new Map(capacityMeshNodes.map((node) => [node.capacityMeshNodeId, node]))
  const isClear = createPhysicalObstacleClearanceChecker({
    originalSrj, pairedConnections, obstacleMargin,
  })

  return sharedEdgeSegments.map((segment) => ({
    ...segment,
    portPoints: segment.portPoints.flatMap((port) => {
      const targets = port.nodeIds.map((id) => {
        const node = nodeById.get(id)
        if (!node) throw new Error(`Missing capacity node "${id}" for port "${port.segmentPortPointId}"`)
        return node
      }).filter((node) => node._containsTarget)
      if (targets.length === 0) return [port]

      const targetOwners = targets.map((node) => new Set(
        [...(node._connectedTo ?? []), node._targetConnectionName].flatMap((alias) => {
          const owner = alias ? connMap.getNetConnectedToId(alias) : undefined
          return owner ? [owner] : []
        }),
      ))
      const commonOwners = [...targetOwners[0]].filter((owner) =>
        targetOwners.every((owners) => owners.has(owner)),
      )
      const commonOwner = commonOwners.length === 1 ? commonOwners[0] : undefined
      const availableZ = port.availableZ.filter((z) =>
        isClear(port, z, commonOwner, traceWidth))
      if (availableZ.length === 0) return []
      return availableZ.length === port.availableZ.length ? [port] : [{ ...port, availableZ }]
    }),
  }))
}
