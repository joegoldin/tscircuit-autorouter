import input from "../../fixtures/features/portpointpathing/tinyhypergraph-port-bridge-repro-input.json"
import type {
  ConnectionHgWithSimpleRouteConnection,
  RegionHg,
} from "lib/solvers/PortPointPathingSolver/hgportpointpathingsolver/types"
import { createTinyRouteNetIndexer } from "lib/solvers/PortPointPathingSolver/tinyhypergraph/createTinyRouteNetIndexer"
import { getRegionNetIdByRegionId } from "lib/solvers/PortPointPathingSolver/tinyhypergraph/getRegionNetIdByRegionId"
import type { CapacityMeshNodeId } from "lib/types"

export type OwnershipParams = Parameters<typeof getRegionNetIdByRegionId>[0]["params"]

export function createOwnershipParams(): OwnershipParams {
  const params = structuredClone(input) as OwnershipParams
  params.graph = { regions: [], ports: [] }
  params.connections = []
  params.layerCount = 2
  params.minViaPadDiameter = 0.5
  params.preserveTerminalPcbPortIds = true
  params.flags.USE_SELECTIVE_RERIP_ROUTING = true
  const definitions: Array<[string, number, number, number[], boolean]> = [
    ["top", 0, 4.2, [0], true],
    ["hole", 0, 0.5, [0, 1], true],
    ["bottom", 0, 3.65, [1], true],
    ["free", -2.325, 1, [0, 1], false],
    ["destination", -3.325, 1, [0], true],
  ]
  for (const [name, x, size, availableZ, obstacle] of definitions) {
    params.graph.regions.push({
      regionId: name,
      ports: [],
      d: {
        capacityMeshNodeId: name as CapacityMeshNodeId,
        center: { x, y: 0 },
        width: size,
        height: size,
        availableZ,
        layer: `z${availableZ.join(",")}`,
        _containsObstacle: obstacle,
        _containsTarget: obstacle,
        ...(obstacle ? { _targetConnectionName: "ground" } : {}),
      },
    })
  }
  const edges: Array<[string, string, string, number, number]> = [
    ["top-hole", "top", "hole", 0, 0],
    ["hole-bottom", "hole", "bottom", 0, 1],
    ["bottom-free", "bottom", "free", -1.825, 1],
    ["free-destination", "free", "destination", -2.825, 0],
  ]
  for (const [portId, first, second, x, z] of edges) {
    const region1 = params.graph.regions.find((r) => r.regionId === first)!
    const region2 = params.graph.regions.find((r) => r.regionId === second)!
    const port = {
      portId,
      region1,
      region2,
      d: { portId, x, y: 0, z, distToCentermostPortOnZ: 0, regions: [region1, region2] },
    }
    params.graph.ports.push(port)
    region1.ports.push(port)
    region2.ports.push(port)
  }
  params.connections.push(createOwnershipConnection(params, "route", "net-ground", "ground"))
  return params
}

export function createOwnershipConnection(
  params: OwnershipParams,
  name: string,
  net: string,
  root: string,
): ConnectionHgWithSimpleRouteConnection {
  return {
    connectionId: name,
    mutuallyConnectedNetworkId: net,
    startRegion: params.graph.regions[0],
    endRegion: params.graph.regions[4],
    simpleRouteConnection: {
      name,
      __rootConnectionNames: [root],
      pointsToConnect: [
        { x: 1, y: 0, layer: "top", pcb_port_id: "pcb_port_source" },
        { x: -3.325, y: 0, layer: "top", pcb_port_id: "pcb_port_destination" },
      ],
    },
  }
}

export function getOwnership(params: OwnershipParams): Map<string, number> {
  return getRegionNetIdByRegionId({
    params,
    getNetIndex: createTinyRouteNetIndexer(),
  })
}

export function getHole(params: OwnershipParams): RegionHg {
  const hole = params.graph.regions.find((region) => region.regionId === "hole")
  if (!hole) throw new Error("Expected the thermal-hole fixture region")
  return hole
}
