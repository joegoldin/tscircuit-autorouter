import { HighDensitySolverB01 } from "@tscircuit/high-density-b01"
import { getConnectivityMapFromSimpleRouteJson } from "../../lib/utils/getConnectivityMapFromSimpleRouteJson"
const { srj, routes } = await Bun.file("/tmp/esp-router-result.json").json()
const connMap = getConnectivityMapFromSimpleRouteJson(srj)
const portPoints = routes.flatMap((route: any) => [route.route[0], route.route.at(-1)].map((point: any) => ({
  ...point, connectionName: route.connectionName, rootConnectionName: route.rootConnectionName,
})))
const inset = (srj.minBoardEdgeClearance ?? 0) + srj.minTraceWidth / 2
const solver = new HighDensitySolverB01({
  nodeWithPortPoints: {
    capacityMeshNodeId: "board",
    center: { x: (srj.bounds.minX + srj.bounds.maxX) / 2, y: (srj.bounds.minY + srj.bounds.maxY) / 2 },
    width: srj.bounds.maxX - srj.bounds.minX - 2 * inset,
    height: srj.bounds.maxY - srj.bounds.minY - 2 * inset,
    availableZ: [0, 1], portPoints,
  },
  obstacles: srj.obstacles.map((obstacle: any, index: number) => ({
    ...obstacle,
    connectionName: srj.connections.find((connection: any) => obstacle.connectedTo.some((id: string) => connMap.areIdsConnected(connection.name, id)))?.name ?? `obstacle${index}`,
    zLayers: obstacle.layers.map((layer: string) => layer === "top" ? 0 : 1),
  })),
  traceThickness: srj.minTraceWidth,
  traceMargin: 0.15,
  obstacleClearanceMargin: 0.15,
  viaDiameter: srj.minViaPadDiameter,
  viaMinDistFromBorder: srj.minViaPadDiameter / 2 + 0.15,
  highResolutionCellSize: 0.05,
  lowResolutionCellSize: 0.05,
  maxCellCount: 2000000,
})
let report = Date.now()
while (!solver.solved && !solver.failed) {
  solver.step()
  if (Date.now() > report) {
    report = Date.now() + 20000
    console.log(solver.iterations, solver.progress)
  }
}
console.log(solver.solved, solver.failed, solver.error, solver.iterations)
if (solver.solved) await Bun.write("/tmp/esp-board-b01.json", JSON.stringify(solver.getOutput()))
