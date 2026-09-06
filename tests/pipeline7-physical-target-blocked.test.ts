import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { TinyHypergraphPortPointPathingSolver } from "lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver"
import { createPhysicalTargetPortFixture } from "./fixtures/physical-target-port-fixture"

test("blocked physical target crossings fail without losing connections or restoring fallback ports", (): void => {
  const { srj, nodes, segments } = createPhysicalTargetPortFixture()
  srj.obstacles.push({ type: "rect", center: { x: 0, y: 0 }, width: 0.2,
    height: 2, layers: ["top", "bottom"], connectedTo: [] })
  const original = structuredClone({ srj, nodes, segments })
  const pipeline = new AutoroutingPipelineSolver7_MultiGraph(srj, { cacheProvider: null, enforceConfiguredClearance: true })
  pipeline.capacityNodes = nodes
  pipeline.srjWithPointPairs = srj
  pipeline.sharedEdgeSegmentsWithNecessaryCrampedPortPoints = segments
  const step = pipeline.pipelineDef.find((step) => step.solverName === "portPointPathingSolver")!
  const [params] = step.getConstructorParams(pipeline) as ConstructorParameters<typeof TinyHypergraphPortPointPathingSolver>
  expect(params.graph.ports).toHaveLength(0)
  expect(params.connections).toHaveLength(1)
  const tiny = new TinyHypergraphPortPointPathingSolver(params)
  tiny.solve()
  expect(tiny.solved).toBe(false)
  expect(tiny.failed).toBe(true)
  expect(tiny.error).toBeTruthy()
  expect({ srj, nodes, segments }).toEqual(original)
})
