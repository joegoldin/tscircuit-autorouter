import { getBoundFromCenteredRect, pointToBoundsDistance } from "@tscircuit/math-utils"
import type { Point } from "@tscircuit/math-utils"
import type { SimpleRouteConnection, SimpleRouteJson } from "lib/types"
import { addApproximatingRectsToSrj } from "lib/utils/addApproximatingRectsToSrj"
import { createExplicitOwnershipMap } from "lib/utils/createExplicitOwnershipMap"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"

export function createPhysicalObstacleClearanceChecker({
  originalSrj,
  pairedConnections,
  obstacleMargin,
}: {
  originalSrj: SimpleRouteJson
  pairedConnections: SimpleRouteConnection[]
  obstacleMargin: number
}): (point: Point, z: number, owner: string | undefined, traceWidth: number) => boolean {
  const connMap = createExplicitOwnershipMap(originalSrj, pairedConnections)
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
  return (point, z, owner, traceWidth) => physicalObstacles.every((obstacle) =>
    !obstacle.zLayers.includes(z) ||
    (owner !== undefined && obstacle.owners.has(owner)) ||
    pointToBoundsDistance(point, obstacle.bounds) >= traceWidth / 2 + obstacleMargin - 1e-9)
}
