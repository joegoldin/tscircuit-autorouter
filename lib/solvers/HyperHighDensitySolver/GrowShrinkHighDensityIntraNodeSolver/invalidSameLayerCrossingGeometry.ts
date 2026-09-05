import type {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
  PortPoint,
} from "lib/types/high-density-types"
import { getIntraNodeCrossingsUsingCircle } from "lib/utils/getIntraNodeCrossingsUsingCircle"

const uniqueAvailableZ = (node: NodeWithPortPoints) => {
  if (node.availableZ?.length) {
    return [...new Set(node.availableZ)].sort((a, b) => a - b)
  }
  return [...new Set(node.portPoints.map((point) => point.z ?? 0))].sort(
    (a, b) => a - b,
  )
}

export const hasImpossibleSameLayerCrossingGeometry = (
  node: NodeWithPortPoints,
): boolean => {
  if (uniqueAvailableZ(node).length !== 1) return false
  const connections = new Map<string, PortPoint[]>()
  for (const point of node.portPoints) {
    const points = connections.get(point.connectionName) ?? []
    points.push(point)
    connections.set(point.connectionName, points)
  }
  const pairs = [...connections.values()]
  for (let i = 0; i < pairs.length; i++) {
    const first = pairs[i]!
    const firstRoot = first[0]!.rootConnectionName ?? first[0]!.connectionName
    for (let j = i + 1; j < pairs.length; j++) {
      const second = pairs[j]!
      const secondRoot = second[0]!.rootConnectionName ?? second[0]!.connectionName
      if (firstRoot === secondRoot) continue
      if (getIntraNodeCrossingsUsingCircle({
        ...node,
        portPoints: [...first, ...second],
      }).numSameLayerCrossings > 0) return true
    }
  }
  return false
}

export const createInvalidDirectConnectionRoutes = (
  node: NodeWithPortPoints,
  traceThickness: number,
  viaDiameter: number,
): HighDensityIntraNodeRoute[] => {
  const pointsByConnection = new Map<string, PortPoint[]>()
  const [z] = uniqueAvailableZ(node)

  for (const portPoint of node.portPoints) {
    pointsByConnection.set(portPoint.connectionName, [
      ...(pointsByConnection.get(portPoint.connectionName) ?? []),
      portPoint,
    ])
  }

  return Array.from(pointsByConnection.entries()).flatMap(
    ([connectionName, points]) => {
      if (points.length < 2) return []
      const start = points[0]
      const end = points[points.length - 1]
      const startZ = start.z ?? z ?? 0
      const endZ = end.z ?? z ?? 0
      const via = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }

      return [
        {
          connectionName,
          rootConnectionName: start.rootConnectionName,
          regionId: node.capacityMeshNodeId,
          traceThickness,
          viaDiameter,
          route: [
            { x: start.x, y: start.y, z: startZ },
            ...(startZ === endZ
              ? []
              : [{ ...via, z: startZ }, { ...via, z: endZ }]),
            { x: end.x, y: end.y, z: endZ },
          ],
          vias: startZ === endZ ? [] : [via],
        },
      ]
    },
  )
}

export const createInvalidSameLayerCrossingRoutes =
  createInvalidDirectConnectionRoutes
