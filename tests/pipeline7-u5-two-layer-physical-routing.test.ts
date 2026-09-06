import { expect, test } from "bun:test"
import { getBoundFromCenteredRect, pointToBoundsDistance, segmentToBoundsMinDistance } from "@tscircuit/math-utils"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { createPipeline7AutoroutingDrcEvaluator } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/create-pipeline7-autorouting-drc-evaluator"
import { MultiGraphTopologyPlannerSolver } from "lib/solvers/TopologyPlanningSolver/MultiGraphTopologyPlannerSolver"
import { CapacityMeshEdgeSolver2_NodeTreeOptimization } from "lib/solvers/CapacityMeshSolver/CapacityMeshEdgeSolver2_NodeTreeOptimization"
import { AvailableSegmentPointSolver } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"
import { TinyHypergraphPortPointPathingSolver } from "lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver"
import { HighDensitySolver } from "lib/solvers/HighDensitySolver/HighDensitySolver"
import { MultipleHighDensityRouteStitchSolver3 } from "lib/solvers/RouteStitchingSolver/MultipleHighDensityRouteStitchSolver3"
import { createU5PhysicalSrj } from "./fixtures/u5-physical-routing"

test("P7 topology and target gate generate a two-layer U5 escape without prescribed vias", (): void => {
  const srj = createU5PhysicalSrj("two-layer")
  const original = structuredClone(srj)
  const topology = new MultiGraphTopologyPlannerSolver({ inputSrj: srj,
    obstacleMargin: 0.127, enforceConfiguredClearance: true })
  topology.solve()
  expect(topology.solved).toBe(true)
  const nodes = topology.getOutput().globalMeshNodes
  const edges = new CapacityMeshEdgeSolver2_NodeTreeOptimization(nodes)
  edges.solve()
  const available = new AvailableSegmentPointSolver({ nodes, edges: edges.edges,
    traceWidth: 0.15, shouldReturnCrampedPortPoints: true })
  available.solve()
  const pipeline = new AutoroutingPipelineSolver7_MultiGraph(srj, { cacheProvider: null, enforceConfiguredClearance: true })
  pipeline.capacityNodes = nodes
  pipeline.srjWithPointPairs = srj
  pipeline.sharedEdgeSegmentsWithNecessaryCrampedPortPoints = available.getOutput()
  const step = pipeline.pipelineDef.find((step) => step.solverName === "portPointPathingSolver")!
  const params = step.getConstructorParams(pipeline) as ConstructorParameters<typeof TinyHypergraphPortPointPathingSolver>
  const tiny = new TinyHypergraphPortPointPathingSolver(...params)
  tiny.solve()
  expect(tiny.error).toBeNull()
  expect(tiny.solved).toBe(true)
  const hd = new HighDensitySolver({
    nodePortPoints: tiny.getOutput().nodesWithPortPoints, connMap: pipeline.connMap,
    viaDiameter: 0.5, traceWidth: 0.15, obstacleMargin: 0.127, layerCount: 2,
    obstacles: srj.obstacles, enforceConfiguredClearance: true, useConfiguredCopperDimensions: true,
    useGrowShrinkHighDensityIntraNodeSolver: true, preserveTerminalPcbPortIds: true,
    growShrinkFallbackToInvalidGeometryOnFailure: true, effort: 1,
  })
  hd.solve()
  expect(hd.solved).toBe(true)
  const stitch = new MultipleHighDensityRouteStitchSolver3({ connections: srj.connections,
    hdRoutes: hd.routes, layerCount: 2, defaultViaDiameter: 0.5, preserveTerminalPcbPortIds: true })
  stitch.solve()
  expect(stitch.solved).toBe(true)
  expect(stitch.mergedHdRoutes).toHaveLength(srj.connections.length)
  const evaluation = createPipeline7AutoroutingDrcEvaluator({ connections: srj.connections,
    originalConnections: srj.connections, layerCount: 2, obstacles: srj.obstacles,
    defaultViaHoleDiameter: 0.2, connMap: pipeline.connMap, srjWithPointPairs: srj, originalSrj: srj })({ hdRoutes: stitch.mergedHdRoutes, traces: [] })
  expect(Array.isArray(evaluation) ? evaluation : evaluation.errors).toEqual([])
  for (const route of stitch.mergedHdRoutes) {
    expect(route.traceThickness).toBe(0.15)
    expect(route.viaDiameter).toBe(0.5)
    expect(route.route.some((point) => point.z === 1)).toBe(true)
    const pair = srj.connections.find((connection) => connection.name === route.connectionName)!
    const terminalIds = [route.startPcbPortId, route.endPcbPortId]
    expect(new Set(terminalIds)).toEqual(new Set(pair.pointsToConnect.map((point) => point.pcb_port_id)))
    for (const point of [route.route[0], route.route.at(-1)!]) {
      expect(pair.pointsToConnect.some((terminal) => terminal.x === point.x && terminal.y === point.y && point.z === 0)).toBe(true)
    }
    const foreign = srj.obstacles.filter((obstacle) => !obstacle.connectedTo.includes("source_net_0"))
    for (let i = 1; i < route.route.length; i++) {
      const a = route.route[i - 1], b = route.route[i]
      if (a.z !== b.z) {
        expect({ x: a.x, y: a.y }).toEqual({ x: b.x, y: b.y })
        expect(route.vias.some((via) => via.x === a.x && via.y === a.y)).toBe(true)
      } else if (a.z === 0) for (const obstacle of foreign) {
        expect(segmentToBoundsMinDistance(a, b, getBoundFromCenteredRect(obstacle)) - 0.075).toBeGreaterThanOrEqual(0.127 - 1e-9)
      }
    }
    for (const via of route.vias) for (const obstacle of foreign) {
      expect(pointToBoundsDistance(via, getBoundFromCenteredRect(obstacle)) - 0.25).toBeGreaterThanOrEqual(0.127 - 1e-9)
    }
  }
  expect(srj).toEqual(original)
})
