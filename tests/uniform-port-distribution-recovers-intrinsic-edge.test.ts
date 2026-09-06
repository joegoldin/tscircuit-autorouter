import { expect, test } from "bun:test"
import { UniformPortDistributionSolver } from "lib/solvers/UniformPortDistributionSolver/UniformPortDistributionSolver"
import { getBug99OffEdgeUniformInput } from "./fixtures/bug99-off-edge-uniform-input"

test("uniform port distribution recovers an intrinsic edge hidden by an off-edge duplicate", (): void => {
  const solver = new UniformPortDistributionSolver(
    getBug99OffEdgeUniformInput(),
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.getOutput()).toHaveLength(2)
  for (const node of solver.getOutput()) {
    expect(node.portPoints.map((point) => point.portPointId)).toEqual([
      "ce105_pp0_z0::0",
      "ce105_pp0_z0::0::dup1",
    ])
    expect(node.portPoints[0].x).toBeCloseTo(-1.8687425, 10)
    expect(node.portPoints[1].x).toBeCloseTo(-1.6062475, 10)
    expect(node.portPoints[0].y).toBeCloseTo(5.8, 10)
    expect(node.portPoints[1].y).toBeCloseTo(5.8, 10)
    expect(node.portPoints[1].x - node.portPoints[0].x).toBeCloseTo(
      0.262495,
      10,
    )
    expect(node.portPoints[1].x - node.portPoints[0].x).toBeGreaterThanOrEqual(
      0.25,
    )
  }
  expect(solver.getOutput()[0].portPoints[0]).toMatchObject({
    connectionName: "source_trace_52__source_trace_55_mst1",
    rootConnectionName: "source_trace_52",
    nextPortPointId: "ce116_pp0_z0::0",
  })
  expect(solver.getOutput()[1].portPoints[1]).toMatchObject({
    connectionName: "source_trace_51__source_trace_53_mst1",
    rootConnectionName: "source_trace_51",
    nextPortPointId: "ce757_pp0_z0::0",
  })
})
