import { expect } from "bun:test"
import { getBoundFromCenteredRect, pointToBoundsDistance, segmentToBoundsMinDistance } from "@tscircuit/math-utils"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import type { SimpleRouteJson } from "lib/types"
import capturedU5 from "./u5-physical-crossings.srj.json"

export function createU5PhysicalSrj(variant: "captured" | "two-layer" | "corrected" = "captured"): SimpleRouteJson {
  const srj = structuredClone(capturedU5) as SimpleRouteJson
  if (variant === "two-layer") {
    srj.obstacles.push(...[5.375, 8.625].map((y) => ({
      type: "rect" as const, center: { x: 9.5, y }, width: 0.2, height: 0.75,
      layers: ["top"], connectedTo: ["test_foreign_wall"],
    })))
  }
  if (variant === "corrected") {
    srj.obstacles = srj.obstacles.filter((pad) =>
      !["pcb_smtpad_178", "pcb_smtpad_182"].includes(pad.circuitJsonMetadata!.pcb_smtpad_id!),
    )
    for (const obstacle of srj.obstacles) {
      obstacle.center.x = obstacle.center.x === 9.125 ? 9.05 : 9.95
    }
    for (const connection of srj.connections) for (const point of connection.pointsToConnect) {
      point.x = point.x === 9.125 ? 9.05 : 9.95
    }
    srj.obstacles.push({ type: "rect", center: { x: 9.5, y: 7 }, width: 0.4,
      height: 1.6, layers: ["top"], connectedTo: [] })
  }
  return srj
}

export function assertU5PhysicalRouting(srj: SimpleRouteJson, requireBottom: boolean): {
  pipeline: AutoroutingPipelineSolver7_MultiGraph
  minimumTraceGap: number
  minimumViaGap: number
} {
  const input = structuredClone(srj)
  const pipeline = new AutoroutingPipelineSolver7_MultiGraph(srj, {
    cacheProvider: null, enforceConfiguredClearance: true, clearanceFeedbackMaxAttempts: 1,
  })
  pipeline.solve()
  expect(pipeline.error).toBeNull()
  expect(pipeline.failed).toBe(false)
  expect(pipeline.solved).toBe(true)
  expect(pipeline.finalDrcErrors).toEqual([])
  expect(pipeline.srjWithPointPairs!.connections).toHaveLength(srj.connections.length)
  const routes = pipeline._getOutputHdRoutes()
  expect(routes).toHaveLength(srj.connections.length)
  const originalTerminals = new Set(srj.connections.flatMap((connection) =>
    connection.pointsToConnect.map((point) => point.pcb_port_id),
  ))
  const returnedTerminals = new Set<string | undefined>()
  let minimumTraceGap = Infinity
  let minimumViaGap = Infinity
  for (const route of routes) {
    expect(route.traceThickness).toBe(0.15)
    expect(route.viaDiameter).toBe(0.5)
    const pair = pipeline.srjWithPointPairs!.connections.find((connection) => connection.name === route.connectionName)!
    expect(pair).toBeDefined()
    const ordered = pair.pointsToConnect[0].pcb_port_id === route.startPcbPortId
      ? pair.pointsToConnect : [...pair.pointsToConnect].reverse()
    expect(route.startPcbPortId).toBe(ordered[0].pcb_port_id)
    expect(route.endPcbPortId).toBe(ordered[1].pcb_port_id)
    for (const [point, terminal] of [[route.route[0], ordered[0]], [route.route.at(-1)!, ordered[1]]] as const) {
      expect(point).toMatchObject({ x: terminal.x, y: terminal.y, z: 0 })
      returnedTerminals.add(terminal.pcb_port_id)
    }
    if (requireBottom) expect(route.route.some((point) => point.z === 1)).toBe(true)
    for (let i = 1; i < route.route.length; i++) {
      const a = route.route[i - 1], b = route.route[i]
      if (a.z === b.z) continue
      expect({ x: a.x, y: a.y }).toEqual({ x: b.x, y: b.y })
      expect(route.vias.some((via) => via.x === a.x && via.y === a.y)).toBe(true)
    }
  }
  expect(returnedTerminals).toEqual(originalTerminals)
  // Measure the actual post-power output, not only pre-power HD geometry.
  const finalTraces = pipeline.getOutputSimplifiedPcbTraces()
  expect(finalTraces).toHaveLength(srj.connections.length)
  for (const trace of finalTraces) {
    const roots = ["source_net_0", trace.connection_name]
    const foreign = srj.obstacles.filter((pad) => !pad.connectedTo.some((alias) => roots.includes(alias)))
    for (let i = 0; i < trace.route.length; i++) {
      const point = trace.route[i]
      if (point.route_type === "via") {
        expect(point.via_diameter).toBe(0.5)
        expect(point.via_hole_diameter).toBe(0.2)
        for (const pad of foreign) minimumViaGap = Math.min(minimumViaGap,
          pointToBoundsDistance(point, getBoundFromCenteredRect(pad)) - point.via_diameter! / 2)
      } else if (point.route_type === "wire") {
        expect(point.width).toBe(0.15)
        const previous = trace.route[i - 1]
        for (const pad of foreign) {
          if (!pad.layers.includes(point.layer)) continue
          const bounds = getBoundFromCenteredRect(pad)
          minimumTraceGap = Math.min(minimumTraceGap,
            pointToBoundsDistance(point, bounds) - point.width / 2)
          if (previous?.route_type === "wire" && previous.layer === point.layer) {
            minimumTraceGap = Math.min(minimumTraceGap,
              segmentToBoundsMinDistance(previous, point, bounds) - point.width / 2)
          }
        }
      } else {
        throw new Error(`Unexpected output primitive ${point.route_type}`)
      }
    }
  }
  expect(minimumTraceGap).toBeGreaterThanOrEqual(0.127 - 1e-9)
  expect(minimumViaGap).toBeGreaterThanOrEqual(0.127 - 1e-9)
  expect(srj).toEqual(input)
  return { pipeline, minimumTraceGap, minimumViaGap }
}
