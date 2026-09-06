import { getBoundingBox, type Bounds } from "@tscircuit/math-utils"
import { getObstacleAvailableZ } from "lib/solvers/BgaTopologyGeneratorSolver/bgpTopologyGeneratorShared"
import type { Obstacle } from "lib/types"
import type {
  PreparedTopologyMergingNode,
  TopologyMergingLayerTopology,
  TopologyMergingMode,
  TopologyMergingNodeGroup,
  TopologyMergingRegion,
} from "./topology-merging-types"
import { TOPOLOGY_MERGING_EPSILON } from "./topology-merging-types"

export function getCanonicalCoordinates(values: number[]): number[] {
  const sortedValues = [...values].sort((a, b) => a - b)
  const coordinates: number[] = []

  for (const value of sortedValues) {
    const previousValue = coordinates[coordinates.length - 1]
    if (
      previousValue === undefined ||
      Math.abs(value - previousValue) > TOPOLOGY_MERGING_EPSILON
    ) {
      coordinates.push(value)
    }
  }

  return coordinates
}

export function doesBoundsContainPoint(
  bounds: Bounds,
  point: { x: number; y: number },
): boolean {
  return (
    point.x >= bounds.minX - TOPOLOGY_MERGING_EPSILON &&
    point.x <= bounds.maxX + TOPOLOGY_MERGING_EPSILON &&
    point.y >= bounds.minY - TOPOLOGY_MERGING_EPSILON &&
    point.y <= bounds.maxY + TOPOLOGY_MERGING_EPSILON
  )
}

export function compactTopologyMergingRegions(
  regions: TopologyMergingRegion[],
): TopologyMergingRegion[] {
  let compactedRegions = regions

  while (true) {
    const horizontallyCompacted = compactRegionsInDirection(
      compactedRegions,
      "horizontal",
    )
    const verticallyCompacted = compactRegionsInDirection(
      horizontallyCompacted,
      "vertical",
    )

    if (verticallyCompacted.length === compactedRegions.length) {
      return verticallyCompacted
    }

    compactedRegions = verticallyCompacted
  }
}

export function getLayerTopologiesForCoveredNodes({
  coveringNodes,
  nodeGroups,
  layerCount,
}: {
  coveringNodes: PreparedTopologyMergingNode[]
  nodeGroups: readonly TopologyMergingNodeGroup[]
  layerCount: number
}): TopologyMergingLayerTopology[] {
  const layerTopologyBySignature = new Map<
    string,
    TopologyMergingLayerTopology
  >()
  for (let z = 0; z < layerCount; z++) {
    const nodesOnLayer = coveringNodes
      .filter(({ node }) => node.availableZ.includes(z))
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))
    if (nodesOnLayer.length === 0) continue

    const activeGroupIndexes = new Set(
      nodesOnLayer.map(({ groupIndex }) => groupIndex),
    )
    const targetObstacleNodes = nodesOnLayer.filter(
      ({ node }) => node._containsObstacle && node._containsTarget,
    )
    const globalTargetObstacleNodes = targetObstacleNodes.filter(
      ({ groupIndex }) => !nodeGroups[groupIndex]!.isComponent,
    )
    const targetGroupIndexes = new Set(
      targetObstacleNodes.map(({ groupIndex }) => groupIndex),
    )
    const topologyMode: TopologyMergingMode =
      targetObstacleNodes.length > 0
        ? globalTargetObstacleNodes.length > 0 || targetGroupIndexes.size === 1
          ? "target-passthrough"
          : "target-merged"
        : activeGroupIndexes.size === 1
          ? "passthrough"
          : "merged"
    const sourceKeyGroups = getSourceKeyGroupsForTopologyMode({
      topologyMode,
      nodesOnLayer,
      targetObstacleNodes,
      globalTargetObstacleNodes,
    })

    for (const sourceKeys of sourceKeyGroups) {
      const topologySignature = JSON.stringify({
        mode: topologyMode,
        sourceKeys,
      })
      const existingTopology = layerTopologyBySignature.get(topologySignature)
      if (existingTopology) {
        existingTopology.availableZ.push(z)
      } else {
        layerTopologyBySignature.set(topologySignature, {
          availableZ: [z],
          sourceKeys,
          topologyMode,
          topologySignature,
        })
      }
    }
  }

  return [...layerTopologyBySignature.values()]
}

export function restoreAuthoritativeTargetRegions({
  regions,
  preparedNodeBySourceKey,
  nodeGroups,
  physicalObstacles,
  layerCount,
}: {
  regions: TopologyMergingRegion[]
  preparedNodeBySourceKey: ReadonlyMap<string, PreparedTopologyMergingNode>
  nodeGroups: readonly TopologyMergingNodeGroup[]
  physicalObstacles?: readonly Obstacle[]
  layerCount: number
}): TopologyMergingRegion[] {
  const topologyModesBySourceKey = new Map<string, Set<TopologyMergingMode>>()
  for (const region of regions) {
    for (const sourceKey of region.sourceKeys) {
      const topologyModes =
        topologyModesBySourceKey.get(sourceKey) ??
        new Set<TopologyMergingMode>()
      topologyModes.add(region.topologyMode)
      topologyModesBySourceKey.set(sourceKey, topologyModes)
    }
  }

  const restorableSourceKeys = new Set(
    [...topologyModesBySourceKey.entries()]
      .filter(
        ([, topologyModes]) =>
          topologyModes.size === 1 && topologyModes.has("target-passthrough"),
      )
      .map(([sourceKey]) => sourceKey),
  )
  // Global target precedence can hide a whole pad or plated layer bridge.
  // Those physical component targets still need their original provenance.
  for (const preparedNode of preparedNodeBySourceKey.values()) {
    if (
      nodeGroups[preparedNode.groupIndex]!.isComponent &&
      preparedNode.node._containsObstacle &&
      preparedNode.node._containsTarget &&
      !topologyModesBySourceKey.has(preparedNode.sourceKey) &&
      [...preparedNodeBySourceKey.values()].some(
        (candidate) =>
          !nodeGroups[candidate.groupIndex]!.isComponent &&
          candidate.node._containsObstacle &&
          candidate.node._containsTarget &&
          candidate.node.availableZ.some((z) =>
            preparedNode.node.availableZ.includes(z),
          ) &&
          boundsHavePositiveAreaOverlap(candidate.bounds, preparedNode.bounds) &&
          getTargetOwnerIds(candidate.node).some((owner) =>
            getTargetOwnerIds(preparedNode.node).includes(owner),
          ),
      )
    ) {
      restorableSourceKeys.add(preparedNode.sourceKey)
    }
  }
  const componentTargetByRefinedGlobalSourceKey = new Map<
    string,
    PreparedTopologyMergingNode[]
  >()
  for (const sourceKey of [...restorableSourceKeys]) {
    const preparedNode = preparedNodeBySourceKey.get(sourceKey)
    if (!preparedNode) continue
    const sourceGroup = nodeGroups[preparedNode.groupIndex]
    if (sourceGroup?.isComponent) continue

    const overlappingComponentTargets = [...preparedNodeBySourceKey.values()]
      .filter(
        (candidate) =>
          nodeGroups[candidate.groupIndex]?.isComponent === true &&
          candidate.node._containsObstacle === true &&
          candidate.node._containsTarget === true &&
          candidate.node.availableZ.some((z) =>
            preparedNode.node.availableZ.includes(z),
          ) &&
          boundsHavePositiveAreaOverlap(
            preparedNode.bounds,
            candidate.bounds,
          ),
      )
      .filter((candidate) => {
        const sourceOwners = getTargetOwnerIds(preparedNode.node)
        const componentOwners = getTargetOwnerIds(candidate.node)
        const hasSameOwner = sourceOwners.some((owner) =>
          componentOwners.includes(owner),
        )
        if (hasSameOwner) return true
        if (sourceOwners.length === 0 || componentOwners.length === 0) {
          return false
        }
        return isPhysicalCopperClearOfComponentTarget({
          globalTarget: preparedNode,
          componentTarget: candidate,
          physicalObstacles,
          layerCount,
        })
      })
    if (overlappingComponentTargets.length > 0) {
      restorableSourceKeys.delete(sourceKey)
      componentTargetByRefinedGlobalSourceKey.set(
        sourceKey,
        overlappingComponentTargets,
      )
    }
  }
  if (
    restorableSourceKeys.size === 0 &&
    componentTargetByRefinedGlobalSourceKey.size === 0
  ) {
    return regions
  }

  const retainedRegions = regions.flatMap((region) => {
    if (region.topologyMode !== "target-passthrough") return [region]
    const sourceKey = region.sourceKeys[0]!
    if (restorableSourceKeys.has(sourceKey)) return []
    const overlappingComponentTargets =
      componentTargetByRefinedGlobalSourceKey.get(sourceKey)
    if (!overlappingComponentTargets) return [region]
    const availableZ = region.availableZ.filter(
      (z) =>
        !overlappingComponentTargets.some(
          (componentTarget) =>
            componentTarget.node.availableZ.includes(z) &&
            boundsHavePositiveAreaOverlap(region.bounds, componentTarget.bounds),
        ),
    )
    return availableZ.length > 0 ? [{ ...region, availableZ }] : []
  })
  const restoredRegions = [...restorableSourceKeys].map((sourceKey) => {
    const preparedNode = preparedNodeBySourceKey.get(sourceKey)
    if (!preparedNode) {
      throw new Error(
        `TopologyMergingSolver: missing authoritative target source "${sourceKey}"`,
      )
    }
    return {
      bounds: { ...preparedNode.bounds },
      availableZ: [...preparedNode.node.availableZ],
      sourceKeys: [sourceKey],
      topologyMode: "target-passthrough" as const,
      topologySignature: JSON.stringify({
        mode: "target-passthrough",
        sourceKeys: [sourceKey],
      }),
    }
  })

  return [...retainedRegions, ...restoredRegions]
}

function isPhysicalCopperClearOfComponentTarget({
  globalTarget,
  componentTarget,
  physicalObstacles,
  layerCount,
}: {
  globalTarget: PreparedTopologyMergingNode
  componentTarget: PreparedTopologyMergingNode
  physicalObstacles?: readonly Obstacle[]
  layerCount: number
}): boolean {
  if (!physicalObstacles) return false

  const globalOwners = getTargetOwnerIds(globalTarget.node)
  const componentOwners = getTargetOwnerIds(componentTarget.node)
  const sharedLayers = globalTarget.node.availableZ.filter((z) =>
    componentTarget.node.availableZ.includes(z),
  )
  const provenLayers = new Set<number>()
  for (const obstacle of physicalObstacles) {
    if (!globalOwners.some((owner) => obstacle.connectedTo.includes(owner))) {
      continue
    }
    const bounds = getBoundingBox(obstacle)
    if (!boundsHavePositiveAreaOverlap(bounds, globalTarget.bounds)) continue
    const layers = getObstacleAvailableZ(obstacle, layerCount).filter((z) =>
      sharedLayers.includes(z),
    )
    if (layers.length === 0) continue
    if (
      componentOwners.some((owner) => obstacle.connectedTo.includes(owner)) ||
      boundsHavePositiveAreaOverlap(bounds, componentTarget.bounds)
    ) {
      return false
    }
    for (const z of layers) provenLayers.add(z)
  }
  return sharedLayers.every((z) => provenLayers.has(z))
}

function getTargetOwnerIds(
  node: PreparedTopologyMergingNode["node"],
): string[] {
  return [node._targetConnectionName, ...(node._connectedTo ?? [])].filter(
    (id): id is string => id !== undefined,
  )
}

function boundsHavePositiveAreaOverlap(a: Bounds, b: Bounds): boolean {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) >
      TOPOLOGY_MERGING_EPSILON &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) >
      TOPOLOGY_MERGING_EPSILON
  )
}

function getRegionMergeKey(region: TopologyMergingRegion): string {
  return JSON.stringify({
    availableZ: region.availableZ,
    topologySignature: region.topologySignature,
  })
}

function getHorizontalMergeBucketKey(region: TopologyMergingRegion): string {
  return JSON.stringify({
    mergeKey: getRegionMergeKey(region),
    minY: region.bounds.minY.toPrecision(15),
    maxY: region.bounds.maxY.toPrecision(15),
  })
}

function getVerticalMergeBucketKey(region: TopologyMergingRegion): string {
  return JSON.stringify({
    mergeKey: getRegionMergeKey(region),
    minX: region.bounds.minX.toPrecision(15),
    maxX: region.bounds.maxX.toPrecision(15),
  })
}

function compactRegionsInDirection(
  regions: TopologyMergingRegion[],
  direction: "horizontal" | "vertical",
): TopologyMergingRegion[] {
  const regionsByMergeBucket = new Map<string, TopologyMergingRegion[]>()

  for (const region of regions) {
    const bucketKey =
      direction === "horizontal"
        ? getHorizontalMergeBucketKey(region)
        : getVerticalMergeBucketKey(region)
    const bucket = regionsByMergeBucket.get(bucketKey) ?? []
    bucket.push(region)
    regionsByMergeBucket.set(bucketKey, bucket)
  }

  return [...regionsByMergeBucket.values()].flatMap((bucket) =>
    mergeRegionRun(bucket, direction),
  )
}

function mergeRegionRun(
  regions: TopologyMergingRegion[],
  direction: "horizontal" | "vertical",
): TopologyMergingRegion[] {
  const sortedRegions = [...regions].sort((a, b) =>
    direction === "horizontal"
      ? a.bounds.minX - b.bounds.minX
      : a.bounds.minY - b.bounds.minY,
  )
  const mergedRegions: TopologyMergingRegion[] = []

  for (const region of sortedRegions) {
    const previousRegion = mergedRegions[mergedRegions.length - 1]
    const regionsTouch =
      previousRegion !== undefined &&
      (direction === "horizontal"
        ? Math.abs(previousRegion.bounds.maxX - region.bounds.minX) <=
          TOPOLOGY_MERGING_EPSILON
        : Math.abs(previousRegion.bounds.maxY - region.bounds.minY) <=
          TOPOLOGY_MERGING_EPSILON)

    if (!previousRegion || !regionsTouch) {
      mergedRegions.push({
        ...region,
        bounds: { ...region.bounds },
        availableZ: [...region.availableZ],
        sourceKeys: [...region.sourceKeys],
      })
      continue
    }

    if (direction === "horizontal") {
      previousRegion.bounds.maxX = region.bounds.maxX
    } else {
      previousRegion.bounds.maxY = region.bounds.maxY
    }
  }

  return mergedRegions
}

function getSourceKeyGroupsForTopologyMode({
  topologyMode,
  nodesOnLayer,
  targetObstacleNodes,
  globalTargetObstacleNodes,
}: {
  topologyMode: TopologyMergingMode
  nodesOnLayer: PreparedTopologyMergingNode[]
  targetObstacleNodes: PreparedTopologyMergingNode[]
  globalTargetObstacleNodes: PreparedTopologyMergingNode[]
}): string[][] {
  if (topologyMode === "target-passthrough") {
    const authoritativeNodes =
      globalTargetObstacleNodes.length > 0
        ? globalTargetObstacleNodes
        : targetObstacleNodes
    return authoritativeNodes.map(({ sourceKey }) => [sourceKey])
  }
  if (topologyMode === "target-merged") {
    return [targetObstacleNodes.map(({ sourceKey }) => sourceKey).sort()]
  }
  if (topologyMode === "passthrough") {
    return nodesOnLayer.map(({ sourceKey }) => [sourceKey])
  }
  return [nodesOnLayer.map(({ sourceKey }) => sourceKey).sort()]
}
