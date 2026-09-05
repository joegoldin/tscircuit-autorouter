import { expect, test } from "bun:test"
import {
  type DownstreamCandidateSummary,
  shouldSelectTraceDensityAlternative,
} from "lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver"

const candidate = (
  overrides: Partial<DownstreamCandidateSummary> = {},
): DownstreamCandidateSummary => ({
  nodePfSum: 5,
  nodePfSquaredSum: 3,
  nodePfMax: 1.1,
  squaredNodePortPointCount: 5_000,
  segmentCount: 400,
  layerChangeCount: 20,
  changedPreloadedTraceSectionCount: 0,
  feedbackRegionCost: 1,
  ...overrides,
})

test("trace-density alternatives must improve regional feedback without bypassing Pf and density constraints", () => {
  const otherwiseAcceptableAlternative = {
    nodePfSum: 5.1,
    nodePfSquaredSum: 3.1,
    squaredNodePortPointCount: 4_700,
  }

  expect(
    shouldSelectTraceDensityAlternative(
      candidate(),
      candidate({
        ...otherwiseAcceptableAlternative,
        feedbackRegionCost: 1.1,
      }),
      40,
    ),
  ).toBe(false)
  expect(
    shouldSelectTraceDensityAlternative(
      candidate(),
      candidate({
        ...otherwiseAcceptableAlternative,
        feedbackRegionCost: 0.9,
      }),
      40,
    ),
  ).toBe(true)
  expect(
    shouldSelectTraceDensityAlternative(
      candidate(),
      candidate({
        feedbackRegionCost: 0.9,
        nodePfSum: 5.2,
        squaredNodePortPointCount: 4_000,
      }),
      40,
    ),
  ).toBe(false)
  expect(
    shouldSelectTraceDensityAlternative(
      candidate(),
      candidate({
        feedbackRegionCost: 0.9,
        squaredNodePortPointCount: 4_800,
      }),
      40,
    ),
  ).toBe(false)
})
