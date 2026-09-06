import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { HighDensitySolver } from "lib/solvers/HighDensitySolver/HighDensitySolver"
import { GrowShrinkHighDensityIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/GrowShrinkHighDensityIntraNodeSolver"
import { cmn113Node } from "./cmn113-node"

test("legacy Pipeline7 retains the cmn113 invalid fallback diagnostic", (): void => {
  const pipeline = new AutoroutingPipelineSolver7_MultiGraph(
    {
      layerCount: 2,
      minTraceWidth: 0.15,
      minViaPadDiameter: 0.5,
      minTraceToPadEdgeClearance: 0.127,
      bounds: { minX: -29, minY: -1, maxX: -27, maxY: 3 },
      obstacles: [],
      connections: [],
    },
    { cacheProvider: null },
  )
  const highDensityStep = pipeline.pipelineDef.find(
    (step) => step.solverName === "highDensityRouteSolver",
  )!
  const [params] = highDensityStep.getConstructorParams({
    ...pipeline,
    uniformPortDistributionSolver: {
      getOutput: (): typeof cmn113Node[] => [cmn113Node],
    },
    portPointPathingSolver: {
      getOutput: (): {
        nodesWithPortPoints: typeof cmn113Node[]
        inputNodeWithPortPoints: typeof cmn113Node[]
      } => ({
        nodesWithPortPoints: [cmn113Node],
        inputNodeWithPortPoints: [cmn113Node],
      }),
      computeNodePf: (): number => 0.5024493397473047,
    },
  } as unknown as AutoroutingPipelineSolver7_MultiGraph) as [
    ConstructorParameters<typeof HighDensitySolver>[0],
  ]
  const solver = new HighDensitySolver({
    ...params,
    growShrinkMaxInnerIterationsPerGrowthAttempt: 1,
    growShrinkSolutionValidator: (): boolean => false,
  })

  expect(params.growShrinkFallbackToInvalidGeometryOnFailure).toBe(true)
  solver.step()
  const growShrinkSolver =
    solver.activeSubSolver as GrowShrinkHighDensityIntraNodeSolver
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.routes).toHaveLength(7)
  expect(growShrinkSolver.stats.invalidGeometryFallback).toBe(true)
  expect(growShrinkSolver.stats.reason).toBe("growth attempts exhausted")
})
