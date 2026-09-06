import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import type { SimpleRouteConnection, SimpleRouteJson } from "lib/types"

/** Links only declared electrical identities, never geometric point hashes. */
export function createExplicitOwnershipMap(
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
