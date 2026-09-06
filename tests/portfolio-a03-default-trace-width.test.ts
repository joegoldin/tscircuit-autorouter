import { expect, test } from "bun:test"
import { PortfolioSingleIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/PortfolioSingleIntraNodeSolver"
import type { HighDensitySolverA03 } from "@tscircuit/high-density-a01"

test("A03 respects requested copper width independently of clearance policy", () => {
  for (const enforceConfiguredClearance of [undefined, false]) {
    const portfolio = new PortfolioSingleIntraNodeSolver({
      nodeWithPortPoints: {
        capacityMeshNodeId: "node",
        center: { x: 0, y: 0 },
        width: 4,
        height: 4,
        portPoints: [
          { x: -2, y: 0, z: 0, connectionName: "net" },
          { x: 2, y: 0, z: 0, connectionName: "net" },
        ],
      },
      traceWidth: 0.15,
      viaDiameter: 0.3,
      obstacleMargin: 0.15,
      enforceConfiguredClearance,
    })
    const candidate = portfolio.generateSolver({
      HIGH_DENSITY_A03: true,
    }) as unknown as HighDensitySolverA03
    candidate.solve()

    expect(candidate.failed).toBe(false)
    expect(candidate.solved).toBe(true)
    expect(candidate.getOutput()[0]!.traceThickness).toBe(0.15)
  }
})
