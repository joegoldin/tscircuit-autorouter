import { checkIfConnectionPointIsInRegion } from "../hgportpointpathingsolver/checkIfConnectionPointIsInRegion"
import type {
  ConnectionHgWithSimpleRouteConnection,
  HgPortPointPathingSolverParams,
} from "../hgportpointpathingsolver/types"
import type { TinyRouteNetIndexer } from "./createTinyRouteNetIndexer"

export function getRegionNetIdByRegionId(input: {
  params: Omit<HgPortPointPathingSolverParams, "connections"> & {
    connections: ConnectionHgWithSimpleRouteConnection[]
  }
  getNetIndex: TinyRouteNetIndexer
}): Map<string, number> {
  const regionNetCandidates = new Map<string, Set<number>>()
  const alreadyConnectedEndpointRegionIds = new Set<string>()
  const netIndexesByConnectionAlias = new Map<string, Set<number>>()
  const netIndexesByRoot = new Map<string, Set<number>>()
  const endpointRegionIds = new Set<string>()
  const unknownOwnerRegionIds = new Set<string>()
  for (const connection of input.params.connections) {
    endpointRegionIds.add(connection.startRegion.regionId)
    endpointRegionIds.add(connection.endRegion.regionId)
    const netId = connection.mutuallyConnectedNetworkId
    const routeNetIndex = input.getNetIndex({
      connectionId: connection.connectionId,
      mutuallyConnectedNetworkId: netId,
    })
    for (const connectionAlias of [connection.connectionId, netId]) {
      const netIndexes =
        netIndexesByConnectionAlias.get(connectionAlias) ?? new Set<number>()
      netIndexes.add(routeNetIndex)
      netIndexesByConnectionAlias.set(connectionAlias, netIndexes)
    }
    for (const root of connection.simpleRouteConnection.__rootConnectionNames ??
      []) {
      const netIndexes = netIndexesByRoot.get(root) ?? new Set<number>()
      netIndexes.add(routeNetIndex)
      netIndexesByRoot.set(root, netIndexes)
    }
    for (const point of connection.simpleRouteConnection.pointsToConnect) {
      for (const region of input.params.graph.regions) {
        if (
          !checkIfConnectionPointIsInRegion({
            point,
            region,
            layerCount: input.params.layerCount,
          })
        ) {
          continue
        }

        const isDesiredConnectionEndpoint =
          point.pcb_port_id !== undefined || region.d._containsTarget === true
        if (!isDesiredConnectionEndpoint) {
          alreadyConnectedEndpointRegionIds.add(region.regionId)
          continue
        }

        let netCandidates = regionNetCandidates.get(region.regionId)
        if (!netCandidates) {
          netCandidates = new Set<number>()
          regionNetCandidates.set(region.regionId, netCandidates)
        }
        netCandidates.add(routeNetIndex)
      }
    }
  }

  for (const region of input.params.graph.regions) {
    const isObstacleTarget =
      region.d._containsObstacle === true && region.d._containsTarget === true
    const targetRoot = isObstacleTarget
      ? region.d._targetConnectionName
      : undefined
    const explicitNetCandidates = new Set<number>()
    for (const connectionName of region.d._connectedTo ?? []) {
      for (const netIndex of netIndexesByConnectionAlias.get(connectionName) ??
        []) {
        explicitNetCandidates.add(netIndex)
      }
      if (isObstacleTarget) {
        for (const netIndex of netIndexesByRoot.get(connectionName) ?? []) {
          explicitNetCandidates.add(netIndex)
        }
      }
    }
    if (targetRoot !== undefined) {
      for (const netIndex of netIndexesByConnectionAlias.get(targetRoot) ?? []) {
        explicitNetCandidates.add(netIndex)
      }
      for (const netIndex of netIndexesByRoot.get(targetRoot) ?? []) {
        explicitNetCandidates.add(netIndex)
      }
      if (explicitNetCandidates.size === 0) {
        // Tiny keeps endpoint regions even when obstacle ownership is absent.
        // Do not let its endpoint inference reopen explicitly unknown copper.
        if (endpointRegionIds.has(region.regionId)) {
          throw new Error(
            `Unknown explicit ownership for endpoint region "${region.regionId}" (root "${targetRoot}")`,
          )
        }
        unknownOwnerRegionIds.add(region.regionId)
        continue
      }
    }
    const netCandidates =
      regionNetCandidates.get(region.regionId) ?? new Set<number>()
    for (const netIndex of explicitNetCandidates) {
      netCandidates.add(netIndex)
    }
    if (
      isObstacleTarget &&
      explicitNetCandidates.size > 0 &&
      netCandidates.size > 1
    ) {
      throw new Error(
        `Conflicting explicit ownership for region "${region.regionId}": net indexes ${[...netCandidates].sort((a, b) => a - b).join(", ")}`,
      )
    }
    regionNetCandidates.set(region.regionId, netCandidates)
  }

  const regionNetIdByRegionId = new Map<string, number>()
  for (const regionId of alreadyConnectedEndpointRegionIds) {
    if (unknownOwnerRegionIds.has(regionId)) continue
    // An endpoint that is already connected to copper only marks where desired
    // routing resumes; it does not make the surrounding region exclusive.
    // Store -1 so the loader does not infer ownership from connection start/end
    // regions. Desired connection endpoints and connected-copper regions are
    // assigned below.
    regionNetIdByRegionId.set(regionId, -1)
  }
  for (const [regionId, netCandidates] of regionNetCandidates) {
    if (unknownOwnerRegionIds.has(regionId)) continue
    if (netCandidates.size !== 1) continue
    regionNetIdByRegionId.set(regionId, [...netCandidates][0]!)
  }
  return regionNetIdByRegionId
}
