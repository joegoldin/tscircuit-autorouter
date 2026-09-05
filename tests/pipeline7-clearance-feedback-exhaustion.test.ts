import { expect, test } from "bun:test"
import type { AutoroutingDrcError } from "high-density-repair03/lib"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import type { SimpleRouteJson, SimplifiedPcbTraces } from "lib/types"

class UnmappableClearancePipeline extends AutoroutingPipelineSolver7_MultiGraph {
  protected getFinalDrcErrors(
    _traces: SimplifiedPcbTraces,
  ): AutoroutingDrcError[] {
    return [
      {
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        message: "fixture error without a center",
      },
    ]
  }
}

test("fails loudly without readable output after exhausting clearance feedback", () => {
  const srj: SimpleRouteJson = {
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
  const solver = new AutoroutingPipelineSolver7_MultiGraph(srj, {
    cacheProvider: null,
    clearanceFeedbackMaxAttempts: 2,
  })

  solver.solve()

  expect(solver.solved).toBe(false)
  expect(solver.failed).toBe(true)
  expect(solver.stats.clearanceFeedbackAttemptCount).toBe(2)
  expect(solver.stats.clearanceFeedbackRetryCount).toBe(1)
  expect(solver.finalDrcErrors.length).toBeGreaterThan(0)
  expect(solver.error).toContain("after 2 attempt(s)")
  expect(solver.error).toContain(solver.finalDrcErrors[0]!.message)
  expect(() => solver.getOutputSimplifiedPcbTraces()).toThrow(
    "Cannot get output before solving is complete",
  )

  const unmappableSolver = new UnmappableClearancePipeline(srj, {
    cacheProvider: null,
    clearanceFeedbackMaxAttempts: 2,
  })
  expect(() => unmappableSolver.solve()).not.toThrow()
  expect(unmappableSolver.solved).toBe(false)
  expect(unmappableSolver.failed).toBe(true)
  expect(unmappableSolver.stats.clearanceFeedbackAttemptCount).toBe(1)
  expect(unmappableSolver.stats.clearanceFeedbackRetryCount).toBe(0)
  expect(unmappableSolver.error).toContain(
    "Pipeline7 cannot map clearance error to a capacity node",
  )
  expect(() => unmappableSolver.getOutputSimplifiedPcbTraces()).toThrow(
    "Cannot get output before solving is complete",
  )

  const defaultLimitSolver = new AutoroutingPipelineSolver7_MultiGraph(srj, {
    cacheProvider: null,
  })
  expect(defaultLimitSolver.clearanceFeedbackMaxAttempts).toBe(12)
  for (const invalidMaxAttempts of [0, -1, 1.5]) {
    expect(
      () =>
        new AutoroutingPipelineSolver7_MultiGraph(srj, {
          cacheProvider: null,
          clearanceFeedbackMaxAttempts: invalidMaxAttempts,
        }),
    ).toThrow(
      "Pipeline7 clearanceFeedbackMaxAttempts must be a positive integer",
    )
  }
})
