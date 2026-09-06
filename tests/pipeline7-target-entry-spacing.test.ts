import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { AvailableSegmentPointSolver } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"
import { TinyHypergraphPortPointPathingSolver } from "lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver"
import { UniformPortDistributionSolver } from "lib/solvers/UniformPortDistributionSolver/UniformPortDistributionSolver"
import { createTargetEntrySpacingFixture } from "./fixtures/target-entry-spacing-fixture"

test("configured P7 projects crystal crossings without moving their original terminals", (): void => {
  for (const configured of [false, true]) {
    const { srj, nodes, edges } = createTargetEntrySpacingFixture()
    const original = structuredClone({ srj, nodes, edges })
    const pipeline = new AutoroutingPipelineSolver7_MultiGraph(srj, {
      cacheProvider: null, enforceConfiguredClearance: configured,
    })
    pipeline.capacityNodes = nodes
    pipeline.capacityEdges = edges
    pipeline.srjWithPointPairs = srj
    const availableStep = pipeline.pipelineDef.find((step) => step.solverName === "availableSegmentPointSolver")!
    const availableParams = availableStep.getConstructorParams(pipeline) as ConstructorParameters<typeof AvailableSegmentPointSolver>
    const available = new AvailableSegmentPointSolver(...availableParams)
    available.solve()
    pipeline.availableSegmentPointSolver = available
    const segments = available.getOutput()
    expect(available.solved).toBe(true)
    expect(available.failed).toBe(false)
    expect(segments.flatMap((segment) => segment.portPoints)).toHaveLength(2)
    const gap = Math.abs(segments[0]!.portPoints[0]!.y - segments[1]!.portPoints[0]!.y) - srj.minTraceWidth
    if (configured) expect(gap).toBeGreaterThanOrEqual(0.127)
    else expect(gap).toBeCloseTo(0.118, 9)

    const pathStep = pipeline.pipelineDef.find((step) => step.solverName === "portPointPathingSolver")!
    const pathParams = pathStep.getConstructorParams(pipeline) as ConstructorParameters<typeof TinyHypergraphPortPointPathingSolver>
    const path = new TinyHypergraphPortPointPathingSolver(...pathParams)
    path.solve()
    expect(path.solved).toBe(true)
    expect(path.failed).toBe(false)
    expect(pathParams[0].connections).toHaveLength(2)
    pipeline.portPointPathingSolver = path
    const uniformStep = pipeline.pipelineDef.find((step) => step.solverName === "uniformPortDistributionSolver")!
    const uniform = new UniformPortDistributionSolver(...uniformStep.getConstructorParams(pipeline) as ConstructorParameters<typeof UniformPortDistributionSolver>)
    uniform.solve()
    pipeline.uniformPortDistributionSolver = uniform
    const hdStep = pipeline.pipelineDef.find((step) => step.solverName === "highDensityRouteSolver")!
    expect(() => hdStep.getConstructorParams(pipeline)).not.toThrow()

    const selected = uniform.getOutput()
    for (const segment of segments) {
      const crossing = segment.portPoints[0]!
      const selectedPorts = selected.flatMap((node) => node.portPoints).filter((port) => port.portPointId === `${crossing.segmentPortPointId}::0`)
      expect(selectedPorts).toHaveLength(2)
      expect(selectedPorts.every((port) => port.x === crossing.x && port.y === crossing.y && port.z === 0)).toBe(true)
      for (const owner of selected.filter((node) => segment.nodeIds.includes(node.capacityMeshNodeId))) {
        expect(owner.portPointsInPairs!.flat().filter((port) => port.portPointId === `${crossing.segmentPortPointId}::0`)).toHaveLength(1)
      }
    }
    for (const connection of srj.connections) {
      for (const terminal of connection.pointsToConnect) {
        expect(selected.flatMap((node) => node.portPoints).find((port) => port.pcb_port_id === terminal.pcb_port_id)).toMatchObject({
          x: terminal.x, y: terminal.y, z: 0, pcb_port_id: terminal.pcb_port_id,
        })
      }
    }
    expect({ srj, nodes, edges }).toEqual(original)
  }
})
