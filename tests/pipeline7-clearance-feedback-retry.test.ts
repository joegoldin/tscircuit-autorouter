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
  regionalCongestionPenaltyByNodeId?: ReadonlyMap<CapacityMeshNodeId, number>
}

class RetryFixturePipeline extends AutoroutingPipelineSolver7_MultiGraph {
  tinyAttempts: TinyAttempt[] = []
  finalValidationCount = 0
  firstAttemptDerivedTraceIds: string[] = []

  constructor(srj: SimpleRouteJson) {
    super(srj, { cacheProvider: null })
    const portPointPathingStep = this.pipelineDef.find(
      (step) => step.solverName === "portPointPathingSolver",
    ) as unknown as {
      getConstructorParams: (
        instance: AutoroutingPipelineSolver7_MultiGraph,
      ) => [
        {
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
    if (this.finalValidationCount > 1) return []

    this.firstAttemptDerivedTraceIds = traces.map((trace) => trace.pcb_trace_id)
    this.srj.traces = structuredClone(traces)
    const node = this.capacityNodes![0]!
    this.capacityNodes = [
      {
        ...node,
        capacityMeshNodeId: "node-a",
      },
    ]
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
  expect(solver.stats.clearanceFeedbackPenalties).toEqual([["node-a", 0.5]])
  expect(originalSrj).toEqual(inputBeforeSolve)
  expect(solver.firstAttemptDerivedTraceIds.length).toBeGreaterThan(0)
  expect(solver.tinyAttempts).toHaveLength(2)
  const secondAttempt = solver.tinyAttempts[1]!
  expect(secondAttempt.regionalCongestionPenaltyByNodeId).toEqual(
    new Map([["node-a", 0.5]]),
  )
  expect(secondAttempt.regionalCongestionPenaltyByNodeId).not.toBe(
    (
      solver as unknown as {
        clearanceFeedbackPenaltyByNodeId: Map<CapacityMeshNodeId, number>
      }
    ).clearanceFeedbackPenaltyByNodeId,
  )
  expect(
    (secondAttempt.srj.traces ?? []).some((trace) =>
      solver.firstAttemptDerivedTraceIds.includes(trace.pcb_trace_id),
    ),
  ).toBe(false)
})
