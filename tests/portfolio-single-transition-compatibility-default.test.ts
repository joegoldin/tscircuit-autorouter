import { expect, test } from "bun:test"
import type { SingleTransitionIntraNodeSolver } from "lib/solvers/HighDensitySolver/SingleTransitionIntraNodeSolver"
import { PortfolioSingleIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/PortfolioSingleIntraNodeSolver"

test("single-transition portfolio keeps legacy copper dimensions by default", () => {
  const portfolio = new PortfolioSingleIntraNodeSolver({
    nodeWithPortPoints: {
      capacityMeshNodeId: "node",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      portPoints: [
        { x: -2, y: 1.9, z: 0, connectionName: "net" },
        { x: 2, y: 1.9, z: 1, connectionName: "net" },
      ],
    },
    traceWidth: 0.3,
    viaDiameter: 0.5,
    obstacleMargin: 0.4,
  })
  const candidate = portfolio.generateSolver({
    CLOSED_FORM_SINGLE_TRANSITION: true,
  }) as unknown as SingleTransitionIntraNodeSolver

  candidate.solve()

  expect(candidate.solved).toBe(true)
  expect(candidate.solvedRoutes[0]!.traceThickness).toBe(0.15)
  expect(candidate.solvedRoutes[0]!.vias[0]!.y).toBeCloseTo(1.65)
})
