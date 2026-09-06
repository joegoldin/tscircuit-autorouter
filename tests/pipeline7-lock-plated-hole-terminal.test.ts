import { expect, test } from "bun:test"
import { lockHdRouteTerminals } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/lock-hd-route-terminals"
import { getTerminalLayerIndicesByPcbPortId } from "lib/autorouter-pipelines/AutoroutingPipeline9_PreloadedTraceGraph/getTerminalLayerIndicesByPcbPortId"
import type { SimpleRouteConnection, Obstacle } from "lib/types"
import type { HighDensityRoute } from "lib/types/high-density-types"

test("terminal locking accepts either copper layer of a proven plated hole", () => {
  const connections: SimpleRouteConnection[] = [{
    name: "net",
    pointsToConnect: [
      { x: 0, y: 0, layer: "top", pcb_port_id: "port_a" },
      { x: 2, y: 0, layer: "top", pcb_port_id: "port_b" },
    ],
  }]
  const routes: HighDensityRoute[] = [{
    connectionName: "net",
    startPcbPortId: "port_a",
    endPcbPortId: "port_b",
    traceThickness: 0.15,
    viaDiameter: 0.5,
    route: [{ x: 0, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }],
    vias: [],
  }]
  const obstacles: Obstacle[] = connections[0]!.pointsToConnect.map((point) => ({
    type: "rect",
    layers: ["top", "bottom"],
    center: { x: point.x, y: point.y },
    width: 0.5,
    height: 0.5,
    connectedTo: [point.pcb_port_id!],
  }))
  const physicalLayers = getTerminalLayerIndicesByPcbPortId(connections, obstacles, 2)
  const output = lockHdRouteTerminals(routes, connections, undefined, 2, physicalLayers)
  expect(output[0]!.route).toEqual([
    { x: 0, y: 0, z: 1, pcb_port_id: "port_a" },
    { x: 2, y: 0, z: 1, pcb_port_id: "port_b" },
  ])
  expect(output[0]!.vias).toEqual([])
  expect(routes[0]!.route[0]).toEqual({ x: 0, y: 0, z: 1 })
  const surfaceLayers = getTerminalLayerIndicesByPcbPortId(connections, [], 2)
  expect(() => lockHdRouteTerminals(routes, connections, undefined, 2, surfaceLayers)).toThrow("start terminal layer changed")
})
