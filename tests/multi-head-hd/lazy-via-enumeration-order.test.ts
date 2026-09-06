import { expect, test } from "bun:test"
import {
  generateBinaryCombinations,
  iterateBinaryCombinations,
} from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/generateBinaryCombinations"
import {
  getEveryPossibleOrdering,
  iterateEveryPossibleOrdering,
} from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/getEveryPossibleOrdering"
import {
  getPossibleInitialViaPositions,
  iteratePossibleInitialViaPositions,
} from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/getPossibleInitialViaPositions"
import type { MHPoint } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/types1"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"

test("lazy via enumeration preserves the legacy sequence at every layer", () => {
  const expectedBinary = [
    [0, 0, 1, 1],
    [0, 1, 0, 1],
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 0, 1, 0],
    [1, 1, 0, 0],
  ]
  expect(generateBinaryCombinations(2, 4)).toEqual(expectedBinary)
  expect(Array.from(iterateBinaryCombinations(2, 4))).toEqual(expectedBinary)
  expect(iterateBinaryCombinations(8, 8).next().value).toEqual(
    Array(8).fill(1),
  )
  const expectedOrderings = [
    ["a", "b", "c"],
    ["a", "c", "b"],
    ["b", "a", "c"],
    ["b", "c", "a"],
    ["c", "a", "b"],
    ["c", "b", "a"],
  ]
  expect(getEveryPossibleOrdering(["a", "b", "c"])).toEqual(
    expectedOrderings,
  )
  expect(Array.from(iterateEveryPossibleOrdering(["a", "b", "c"]))).toEqual(
    expectedOrderings,
  )

  const params = {
    portPairsEntries: [
      [
        "route",
        {
          start: { x: -1, y: 0, z1: 0, z2: 0 },
          end: { x: 1, y: 0, z1: 0, z2: 0 },
        },
      ],
    ] as [
      string,
      { start: Omit<MHPoint, "xMoves" | "yMoves">; end: Omit<MHPoint, "xMoves" | "yMoves"> },
    ][],
    bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    viaCountVariants: [[0], [2]],
  }
  const expectedPositionVariants = [
    { viaPositions: [], viaCountVariant: [0] },
    {
      viaPositions: [
        { x: 0, y: 0.5 },
        { x: 0, y: -0.5 },
      ],
      viaCountVariant: [2],
    },
  ]
  expect(getPossibleInitialViaPositions(params)).toEqual(
    expectedPositionVariants,
  )
  expect(Array.from(iteratePossibleInitialViaPositions(params))).toEqual(
    expectedPositionVariants,
  )

  const createSolver = (): MultiHeadPolyLineIntraNodeSolver =>
    new MultiHeadPolyLineIntraNodeSolver({
      nodeWithPortPoints: {
        capacityMeshNodeId: "batch-equivalence",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        portPoints: [
          { x: -1, y: 0, z: 0, connectionName: "route" },
          { x: 1, y: 0, z: 1, connectionName: "route" },
        ],
      },
      enforceConfiguredClearance: true,
      hyperParameters: { SEGMENTS_PER_POLYLINE: 3 },
    })
  const eagerBatch = createSolver()
  eagerBatch.INITIAL_CANDIDATE_ATTEMPTS_PER_STEP = 1_000
  while (eagerBatch.setupInitialPolyLines() === false) {}
  const oneAtATime = createSolver()
  oneAtATime.INITIAL_CANDIDATE_ATTEMPTS_PER_STEP = 1
  while (oneAtATime.setupInitialPolyLines() === false) {}
  expect(oneAtATime.candidates).toEqual(eagerBatch.candidates)
})
