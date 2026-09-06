import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver9_PreloadedTraceGraph } from "lib/autorouter-pipelines/AutoroutingPipeline9_PreloadedTraceGraph/AutoroutingPipelineSolver9_PreloadedTraceGraph"

test("Pipeline9 solveUntilPhase returns from a terminal solver state", () => {
  const solver = Object.create(
    AutoroutingPipelineSolver9_PreloadedTraceGraph.prototype,
  ) as AutoroutingPipelineSolver9_PreloadedTraceGraph
  solver.solved = false
  solver.failed = true
  let phaseReadCount = 0
  solver.getCurrentPhase = () => {
    phaseReadCount++
    throw new Error("terminal solver state read its current phase")
  }

  expect(() => solver.solveUntilPhase("highDensityStitchSolver")).not.toThrow()
  expect(phaseReadCount).toBe(0)
})
