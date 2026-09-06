import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"
import type { Candidate } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/types1"

const createSolver = (
  enforceConfiguredClearance: boolean,
): MultiHeadPolyLineIntraNodeSolver =>
  new MultiHeadPolyLineIntraNodeSolver({
    nodeWithPortPoints: {
      capacityMeshNodeId: "final-acceptance",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      portPoints: [
        { x: -1, y: 0, z: 0, connectionName: "route" },
        { x: 1, y: 0, z: 0, connectionName: "route" },
      ],
    },
    traceWidth: 0.15,
    viaDiameter: 0.5,
    obstacleMargin: 0.127,
    enforceConfiguredClearance,
    hyperParameters: { MINIMUM_FINAL_ACCEPTANCE_GAP: 0.001 },
  })

const candidate = ({ minGap, viaX = 0 }: { minGap: number; viaX?: number }): Candidate => ({
  polyLines: [{
    connectionName: "route",
    start: { x: -1, y: 0, z1: 0, z2: 0 },
    end: { x: 1, y: 0, z1: 0, z2: 0 },
    mPoints: [{ x: viaX, y: 0, z1: 0, z2: 1 }],
  }],
  g: 0,
  h: 0,
  f: 0,
  minGaps: [minGap],
  viaCount: 1,
})

test("configured final acceptance stays strict while legacy relaxation remains available", () => {
  const insufficientGap = createSolver(true)
  insufficientGap.lastCandidate = candidate({ minGap: 0.0167 })
  insufficientGap.tryFinalAcceptance()
  expect(insufficientGap.solved).toBe(false)

  const outsideVia = createSolver(true)
  outsideVia.lastCandidate = candidate({ minGap: 0.127, viaX: 0.8 })
  outsideVia.tryFinalAcceptance()
  expect(outsideVia.solved).toBe(false)

  const legal = createSolver(true)
  legal.lastCandidate = candidate({ minGap: 0.127 })
  legal.tryFinalAcceptance()
  expect(legal.solved).toBe(true)
  expect(legal.solvedRoutes).toHaveLength(1)

  const legacy = createSolver(false)
  legacy.lastCandidate = candidate({ minGap: 0.0167, viaX: 0.8 })
  legacy.tryFinalAcceptance()
  expect(legacy.solved).toBe(true)
  expect(legacy.solvedRoutes).toHaveLength(1)
})
