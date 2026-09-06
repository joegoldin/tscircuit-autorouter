import { getBoundFromCenteredRect, pointToBoundsDistance } from "@tscircuit/math-utils"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import type { SharedEdgeSegment } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"
import type { CapacityMeshNode, SimpleRouteConnection, SimpleRouteJson } from "lib/types"
import { addApproximatingRectsToSrj } from "lib/utils/addApproximatingRectsToSrj"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"

interface PhysicalTargetPortInput {
  sharedEdgeSegments: SharedEdgeSegment[]
  capacityMeshNodes: CapacityMeshNode[]
  originalSrj: SimpleRouteJson
  pairedConnections: SimpleRouteConnection[]
  traceWidth: number
  obstacleMargin: number
}

/** Links only declared electrical identities, never geometric point hashes. */
function createExplicitOwnershipMap(
  srj: SimpleRouteJson,
  pairedConnections: SimpleRouteConnection[],
): ConnectivityMap {
  const connMap = new ConnectivityMap({})
  const groups: Array<Array<string | undefined>> = [
    ...[...srj.connections, ...pairedConnections].map((connection) => [
      connection.name,
      connection.rootConnectionName,
      connection.netConnectionName,
      connection.__netConnectionName,
      ...(connection.__rootConnectionNames ?? []),
      ...(connection.mergedConnectionNames ?? []),
      ...connection.pointsToConnect.flatMap((point) => [point.pcb_port_id, point.pointId]),
    ]),
    ...srj.obstacles.map((obstacle) => [
      obstacle.obstacleId, ...obstacle.connectedTo, ...(obstacle.offBoardConnectsTo ?? []),
    ]),
    ...(srj.traces ?? []).map((trace) => [
      trace.pcb_trace_id, trace.connection_name, ...(trace.connectsTo ?? []),
    ]),
  ]
  for (const group of groups) {
    const aliases = group.filter((alias): alias is string => Boolean(alias))
    if (aliases.length > 0) connMap.addConnections([aliases])
  }
  return connMap
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
  // Normalizing all obstacles together merges coincident aliases. Normalize
  // separately to retain foreign ownership even at identical physical geometry.
  const physicalObstacles = originalSrj.obstacles.flatMap((obstacle) => {
    const ownerIds = [obstacle.obstacleId, ...obstacle.connectedTo, ...(obstacle.offBoardConnectsTo ?? [])]
    const owners = new Set(ownerIds.flatMap((alias) => {
      const owner = alias ? connMap.getNetConnectedToId(alias) : undefined
      return owner ? [owner] : []
    }))
    return addApproximatingRectsToSrj({ ...originalSrj, connections: [], obstacles: [obstacle] })
      .obstacles.map((primitive) => ({
        bounds: getBoundFromCenteredRect(primitive),
        zLayers: primitive.layers.map((layer) => mapLayerNameToZ(layer, originalSrj.layerCount)),
        owners,
      }))
  })
  const requiredDistance = traceWidth / 2 + obstacleMargin

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
      const availableZ = port.availableZ.filter((z) => physicalObstacles.every((obstacle) =>
        !obstacle.zLayers.includes(z) ||
        (commonOwner !== undefined && obstacle.owners.has(commonOwner)) ||
        pointToBoundsDistance(port, obstacle.bounds) >= requiredDistance - 1e-9,
      ))
      if (availableZ.length === 0) return []
      return availableZ.length === port.availableZ.length ? [port] : [{ ...port, availableZ }]
    }),
  }))
}
