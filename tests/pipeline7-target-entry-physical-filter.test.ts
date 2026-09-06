import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { AvailableSegmentPointSolver } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"
import { TinyHypergraphPortPointPathingSolver } from "lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver"
import { createTargetEntrySpacingFixture } from "./fixtures/target-entry-spacing-fixture"

test("P7 still blocks projected target crossings against original nameless physical obstacles", (): void => {
  const { srj, nodes, edges } = createTargetEntrySpacingFixture()
  srj.obstacles.push({ type: "rect", center: { x: -1.577, y: -1 },
    width: 0.02, height: 0.02, layers: ["top"], connectedTo: [],
  })
  const original = structuredClone(srj)
  const pipeline = new AutoroutingPipelineSolver7_MultiGraph(srj, {
    cacheProvider: null, enforceConfiguredClearance: true,
  })
  pipeline.capacityNodes = nodes
  pipeline.capacityEdges = edges
  pipeline.srjWithPointPairs = srj
  const availableStep = pipeline.pipelineDef.find((step) => step.solverName === "availableSegmentPointSolver")!
  const available = new AvailableSegmentPointSolver(...availableStep.getConstructorParams(pipeline) as ConstructorParameters<typeof AvailableSegmentPointSolver>)
  available.solve()
  pipeline.availableSegmentPointSolver = available
  expect(available.getOutput()[0]!.portPoints[0]!.y).toBe(-1)
  const pathStep = pipeline.pipelineDef.find((step) => step.solverName === "portPointPathingSolver")!
  const params = pathStep.getConstructorParams(pipeline) as ConstructorParameters<typeof TinyHypergraphPortPointPathingSolver>
  expect(params[0].graph.ports.some((port) => port.d.y === -1)).toBe(false)
  expect(params[0].graph.ports.some((port) => port.d.y === -1.4)).toBe(true)
  expect(params[0].connections).toHaveLength(2)
  const tiny = new TinyHypergraphPortPointPathingSolver(...params)
  tiny.solve()
  expect(tiny.solved).toBe(false)
  expect(tiny.failed).toBe(true)
  expect(srj).toEqual(original)
})
