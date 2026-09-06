import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { TinyHypergraphPortPointPathingSolver } from "lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver"
import { createPhysicalTargetPortFixture } from "./fixtures/physical-target-port-fixture"

test("P7 filters physical target ports after selecting merged cramped/component segments", (): void => {
  for (const configured of [false, true]) {
    const { srj, nodes, segments } = createPhysicalTargetPortFixture()
    const original = structuredClone({ srj, nodes, segments })
    const pipeline = new AutoroutingPipelineSolver7_MultiGraph(srj, {
      cacheProvider: null, enforceConfiguredClearance: configured,
    })
    pipeline.capacityNodes = nodes
    pipeline.srjWithPointPairs = srj
    pipeline.sharedEdgeSegmentsWithNecessaryCrampedPortPoints = segments
    const connMap = pipeline.connMap
    const step = pipeline.pipelineDef.find((step) => step.solverName === "portPointPathingSolver")!
    const [params] = step.getConstructorParams(pipeline) as ConstructorParameters<typeof TinyHypergraphPortPointPathingSolver>
    const ports = params.graph.ports.map((port) => port.d)
    expect(ports.some((port) => port.y === 0.05 && port.z === 0)).toBe(!configured)
    expect(ports.some((port) => port.y === 0.05 && port.z === 1)).toBe(true)
    expect(ports.some((port) => port.y === -0.2 && port.z === 0 && port.tinyHypergraphPortPenalty === 7)).toBe(true)
    expect(params.connections).toHaveLength(srj.connections.length)
    expect(pipeline.connMap).toBe(connMap)
    expect({ srj, nodes, segments }).toEqual(original)
  }
})
