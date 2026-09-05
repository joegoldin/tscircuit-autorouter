import { expect, test } from "bun:test"
import type { TinyHyperGraphRegionCostAdjustment } from "tiny-hypergraph/lib/index"
import {
  DuplicateCongestedPortSolver,
  TinyHyperGraphSectionSolver,
  TinyHyperGraphSolver,
} from "tiny-hypergraph/lib/index"
import input from "../../fixtures/features/portpointpathing/tinyhypergraph-port-bridge-repro-input.json"
import { TinyHypergraphPortPointPathingSolver } from "lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver"
import type { CapacityMeshNodeId } from "lib/types"

type TinyHypergraphParams = ConstructorParameters<
  typeof TinyHypergraphPortPointPathingSolver
>[0] & {
  regionalCongestionPenaltyByNodeId?: ReadonlyMap<CapacityMeshNodeId, number>
}

type PipelineHarness = {
  inputProblem: {
    regionCostAdjustment?: TinyHyperGraphRegionCostAdjustment
    createSectionMask?: (context: {
      topology: { portCount: number }
    }) => Int8Array
  }
  failed: boolean
  solved: boolean
  getSolver<T>(solverName: string): T | undefined
  solve(): void
}

const createParams = (): TinyHypergraphParams =>
  JSON.parse(
    JSON.stringify(input)
      .replaceAll("left-bridge", "penalized")
      .replaceAll("top-left", "preferred"),
  )

const getAdjustment = (
  callback: TinyHyperGraphRegionCostAdjustment | undefined,
  capacityMeshNodeId: string,
): number => {
  if (!callback) throw new Error("Expected a regional cost adjustment")
  return callback({
    regionId: 0,
    regionMetadata: { capacityMeshNodeId },
    sameLayerCrossings: 2,
    crossLayerCrossings: 3,
    entryExitLayerChanges: 4,
    traceCount: 5,
  })
}

test("regional congestion penalties propagate through every Tiny routing path and reject invalid values", () => {
  const duplicatePrepassAdjustments: Array<
    TinyHyperGraphRegionCostAdjustment | undefined
  > = []
  const originalDuplicateSolve = DuplicateCongestedPortSolver.prototype.solve
  DuplicateCongestedPortSolver.prototype.solve = function (...args) {
    duplicatePrepassAdjustments.push(
      this.options.routeSolveOptions?.regionCostAdjustment,
    )
    return originalDuplicateSolve.apply(this, args)
  }

  try {
    const params = createParams()
    params.regionalCongestionPenaltyByNodeId = new Map([
      ["penalized" as CapacityMeshNodeId, 0.5],
    ])
    const solver = new TinyHypergraphPortPointPathingSolver(params)
    const pipeline = (
      solver as unknown as { tinyPipelineSolver: PipelineHarness }
    ).tinyPipelineSolver
    const primaryAdjustment = pipeline.inputProblem.regionCostAdjustment

    expect(getAdjustment(primaryAdjustment, "penalized")).toBe(5.5)
    expect(getAdjustment(primaryAdjustment, "preferred")).toBe(0)
    expect(duplicatePrepassAdjustments[0]).toBe(primaryAdjustment)

    pipeline.inputProblem.createSectionMask = ({ topology }) =>
      new Int8Array(topology.portCount).fill(1)
    pipeline.solve()

    expect(pipeline.solved).toBe(true)
    expect(pipeline.failed).toBe(false)
    expect(
      pipeline.getSolver<TinyHyperGraphSolver>("solveGraph")
        ?.regionCostAdjustment,
    ).toBe(primaryAdjustment)
    const sectionReplay = pipeline.getSolver<TinyHyperGraphSectionSolver>(
      "optimizeSection",
    )
    expect(sectionReplay?.baselineSolver.regionCostAdjustment).toBe(
      primaryAdjustment,
    )
    expect(sectionReplay?.sectionSolver?.regionCostAdjustment).toBe(
      primaryAdjustment,
    )

    const absentMapSolver = new TinyHypergraphPortPointPathingSolver(
      createParams(),
    )
    const absentMapPipeline = (
      absentMapSolver as unknown as { tinyPipelineSolver: PipelineHarness }
    ).tinyPipelineSolver
    expect(absentMapPipeline.inputProblem.regionCostAdjustment).toBeUndefined()
    expect(duplicatePrepassAdjustments[1]).toBeUndefined()

    for (const invalidPenalty of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const invalidParams = createParams()
      invalidParams.regionalCongestionPenaltyByNodeId = new Map([
        ["penalized" as CapacityMeshNodeId, invalidPenalty],
      ])
      expect(
        () => new TinyHypergraphPortPointPathingSolver(invalidParams),
      ).toThrow("Invalid regional congestion penalty for penalized")
    }
  } finally {
    DuplicateCongestedPortSolver.prototype.solve = originalDuplicateSolve
  }
})
