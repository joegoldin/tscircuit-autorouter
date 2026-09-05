import { expect, test } from "bun:test"
import type { AutoroutingDrcError } from "high-density-repair03/lib"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import type {
  CapacityMeshNodeId,
  SimpleRouteJson,
  SimplifiedPcbTraces,
} from "lib/types"

type TinyAttempt = {
  srj: SimpleRouteJson
  capacityNodeIds: CapacityMeshNodeId[]
  graphRegionIds: CapacityMeshNodeId[]
  regionalCongestionPenaltyByNodeId?: ReadonlyMap<CapacityMeshNodeId, number>
}

class RetryFixturePipeline extends AutoroutingPipelineSolver7_MultiGraph {
  tinyAttempts: TinyAttempt[] = []
  finalValidationCount = 0
  firstAttemptDerivedTraceIds: string[] = []
  penalizedNodeId?: CapacityMeshNodeId

  constructor(
    srj: SimpleRouteJson,
    private readonly clearanceErrorAttemptCount = 1,
  ) {
    super(srj, {
      cacheProvider: null,
      clearanceFeedbackMaxAttempts: clearanceErrorAttemptCount + 1,
    })
    const portPointPathingStep = this.pipelineDef.find(
      (step) => step.solverName === "portPointPathingSolver",
    ) as unknown as {
      getConstructorParams: (
        instance: AutoroutingPipelineSolver7_MultiGraph,
      ) => [
        {
          graph: {
            regions: Array<{ regionId: CapacityMeshNodeId }>
          }
          regionalCongestionPenaltyByNodeId?: ReadonlyMap<
            CapacityMeshNodeId,
            number
          >
        },
      ]
    }
    const getConstructorParams = portPointPathingStep.getConstructorParams
    portPointPathingStep.getConstructorParams = (instance) => {
      const params = getConstructorParams(instance)
      this.tinyAttempts.push({
        srj: structuredClone(instance.srj),
        capacityNodeIds:
          instance.capacityNodes?.map((node) => node.capacityMeshNodeId) ?? [],
        graphRegionIds: params[0].graph.regions.map(
          (region) => region.regionId,
        ),
        regionalCongestionPenaltyByNodeId:
          params[0].regionalCongestionPenaltyByNodeId,
      })
      return params
    }
  }

  protected getFinalDrcErrors(
    traces: SimplifiedPcbTraces,
  ): AutoroutingDrcError[] {
    this.finalValidationCount += 1
    if (this.finalValidationCount > this.clearanceErrorAttemptCount) return []

    if (this.finalValidationCount === 1) {
      this.firstAttemptDerivedTraceIds = traces.map(
        (trace) => trace.pcb_trace_id,
      )
      this.srj.traces = structuredClone(traces)
    }
    const capacityNodes = this.capacityNodes ?? []
    const node = this.penalizedNodeId
      ? capacityNodes.find(
          (candidate) =>
            candidate.capacityMeshNodeId === this.penalizedNodeId,
        )
      : capacityNodes.find(
          (candidate) =>
            capacityNodes.filter(
              (containingNode) =>
                candidate.center.x >=
                  containingNode.center.x - containingNode.width / 2 &&
                candidate.center.x <=
                  containingNode.center.x + containingNode.width / 2 &&
                candidate.center.y >=
                  containingNode.center.y - containingNode.height / 2 &&
                candidate.center.y <=
                  containingNode.center.y + containingNode.height / 2,
            ).length === 1,
        )
    if (!node) {
      throw new Error("Retry fixture could not preserve a unique capacity node")
    }
    this.penalizedNodeId ??= node.capacityMeshNodeId
    return [
      {
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        message: "centered fixture error",
        center: { ...node.center },
      },
    ]
  }
}

test("retries Pipeline7 from the immutable source with fixed regional feedback", () => {
  const originalSrj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.15,
    bounds: { minX: -2, minY: -2, maxX: 2, maxY: 2 },
    obstacles: [],
    connections: [0, 1].map((index) => ({
      name: `net${index}`,
      pointsToConnect: [
        { x: -1, y: index * 0.275, layer: "top" },
        { x: 1, y: index * 0.275, layer: "top" },
      ],
    })),
  }
  const inputBeforeSolve = structuredClone(originalSrj)
  const solver = new RetryFixturePipeline(originalSrj)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.stats.clearanceFeedbackAttemptCount).toBe(2)
  expect(solver.stats.clearanceFeedbackRetryCount).toBe(1)
  expect(solver.stats.clearanceFeedbackPenalties).toEqual([
    [solver.penalizedNodeId, 0.5],
  ])
  expect(originalSrj).toEqual(inputBeforeSolve)
  expect(solver.firstAttemptDerivedTraceIds.length).toBeGreaterThan(0)
  expect(solver.tinyAttempts).toHaveLength(2)
  const secondAttempt = solver.tinyAttempts[1]!
  expect(secondAttempt.regionalCongestionPenaltyByNodeId).toEqual(
    new Map([[solver.penalizedNodeId!, 0.5]]),
  )
  expect(secondAttempt.regionalCongestionPenaltyByNodeId).not.toBe(
    (
      solver as unknown as {
        clearanceFeedbackPenaltyByNodeId: Map<CapacityMeshNodeId, number>
      }
    ).clearanceFeedbackPenaltyByNodeId,
  )
  expect(secondAttempt.capacityNodeIds).toContain(solver.penalizedNodeId!)
  expect(secondAttempt.graphRegionIds).toContain(solver.penalizedNodeId!)
  expect(
    (secondAttempt.srj.traces ?? []).some((trace) =>
      solver.firstAttemptDerivedTraceIds.includes(trace.pcb_trace_id),
    ),
  ).toBe(false)

  const actualTinyInput = (
    solver.portPointPathingSolver as unknown as {
      tinyPipelineSolver: {
        inputProblem: {
          serializedHyperGraph: {
            regions: Array<{
              regionId: string
              d?: Record<string, unknown>
            }>
          }
          regionCostAdjustment?: (context: {
            regionId: number
            regionMetadata: Record<string, unknown> | undefined
            sameLayerCrossings: number
            crossLayerCrossings: number
            entryExitLayerChanges: number
            traceCount: number
          }) => number
        }
      }
    }
  ).tinyPipelineSolver.inputProblem
  const penalizedRegion = actualTinyInput.serializedHyperGraph.regions.find(
    (region) => region.regionId === solver.penalizedNodeId,
  )
  expect(penalizedRegion).toBeDefined()
  expect(actualTinyInput.regionCostAdjustment).toBeFunction()
  expect(
    actualTinyInput.regionCostAdjustment!({
      regionId: 0,
      regionMetadata: penalizedRegion!.d,
      sameLayerCrossings: 1,
      crossLayerCrossings: 0,
      entryExitLayerChanges: 0,
      traceCount: 2,
    }),
  ).toBe(1)

  const cumulativeSolver = new RetryFixturePipeline(
    structuredClone(inputBeforeSolve),
    2,
  )
  cumulativeSolver.solve()
  expect(cumulativeSolver.solved).toBe(true)
  expect(cumulativeSolver.failed).toBe(false)
  expect(cumulativeSolver.stats.clearanceFeedbackAttemptCount).toBe(3)
  expect(cumulativeSolver.stats.clearanceFeedbackRetryCount).toBe(2)
  expect(cumulativeSolver.stats.clearanceFeedbackPenalties).toEqual([
    [cumulativeSolver.penalizedNodeId, 1],
  ])
  expect(cumulativeSolver.tinyAttempts).toHaveLength(3)
  expect(
    cumulativeSolver.tinyAttempts[1]!
      .regionalCongestionPenaltyByNodeId,
  ).toEqual(new Map([[cumulativeSolver.penalizedNodeId!, 0.5]]))
  expect(
    cumulativeSolver.tinyAttempts[2]!
      .regionalCongestionPenaltyByNodeId,
  ).toEqual(new Map([[cumulativeSolver.penalizedNodeId!, 1]]))
  expect(
    cumulativeSolver.tinyAttempts[1]!
      .regionalCongestionPenaltyByNodeId,
  ).not.toBe(
    cumulativeSolver.tinyAttempts[2]!
      .regionalCongestionPenaltyByNodeId,
  )
})
