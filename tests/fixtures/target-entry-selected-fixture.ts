import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { AvailableSegmentPointSolver } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"
import { UniformPortDistributionSolver } from "lib/solvers/UniformPortDistributionSolver/UniformPortDistributionSolver"
import type { NodeWithPortPoints, PortPoint } from "lib/types/high-density-types"
import { createTargetEntrySpacingFixture } from "./target-entry-spacing-fixture"

export function createSelectedTargetEntryFixture(
  fixture: ReturnType<typeof createTargetEntrySpacingFixture>,
  configured = true,
): { pipeline: AutoroutingPipelineSolver7_MultiGraph; selected: NodeWithPortPoints[]; check: () => unknown } {
  const { srj, nodes, edges } = fixture
  const pipeline = new AutoroutingPipelineSolver7_MultiGraph(srj, {
    cacheProvider: null, enforceConfiguredClearance: configured,
  })
  pipeline.capacityNodes = nodes
  pipeline.capacityEdges = edges
  pipeline.srjWithPointPairs = srj
  const availableStep = pipeline.pipelineDef.find((step) => step.solverName === "availableSegmentPointSolver")!
  const available = new AvailableSegmentPointSolver(...availableStep.getConstructorParams(pipeline) as ConstructorParameters<typeof AvailableSegmentPointSolver>)
  available.solve()
  pipeline.availableSegmentPointSolver = available
  const selected: NodeWithPortPoints[] = nodes.map((node) => ({ ...node, portPoints: [], portPointsInPairs: [] }))
  for (const [i, segment] of available.getOutput().entries()) {
    const connection = srj.connections[i]!
    const crossing: PortPoint = {
      ...segment.portPoints[0]!, z: 0,
      portPointId: `${segment.portPoints[0]!.segmentPortPointId}::0`,
      connectionName: connection.name,
    }
    for (const [ownerIndex, ownerId] of segment.nodeIds.entries()) {
      const terminal = connection.pointsToConnect[ownerIndex]!
      const pair: [PortPoint, PortPoint] = [
        { ...terminal, z: 0, connectionName: connection.name }, { ...crossing },
      ]
      const owner = selected.find((node) => node.capacityMeshNodeId === ownerId)!
      owner.portPoints.push(...pair)
      owner.portPointsInPairs!.push(pair)
    }
  }
  const uniform = new UniformPortDistributionSolver({ nodeWithPortPoints: [], inputNodesWithPortPoints: [], obstacles: [] })
  uniform.redistributedNodes = selected
  pipeline.uniformPortDistributionSolver = uniform
  const step = pipeline.pipelineDef.find((step) => step.solverName === "highDensityRouteSolver")!
  return { pipeline, selected, check: () => step.getConstructorParams(pipeline) }
}
