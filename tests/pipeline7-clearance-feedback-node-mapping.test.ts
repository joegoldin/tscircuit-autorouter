import { expect, test } from "bun:test"
import type { AutoroutingDrcError } from "high-density-repair03/lib"
import { getClearanceFeedbackNodeIds } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/get-clearance-feedback-node-ids"
import type { CapacityMeshNode } from "lib/types"

test("maps every centered clearance error to inclusive capacity-node bounds", () => {
  const capacityNodes: CapacityMeshNode[] = [
    {
      capacityMeshNodeId: "node-a",
      center: { x: 0, y: 0 },
      width: 2,
      height: 4,
      layer: "top",
      availableZ: [0],
    },
    {
      capacityMeshNodeId: "node-b",
      center: { x: 4, y: 0 },
      width: 2,
      height: 2,
      layer: "top",
      availableZ: [0],
    },
    {
      capacityMeshNodeId: "node-c-top",
      center: { x: 8, y: 0 },
      width: 2,
      height: 2,
      layer: "top",
      availableZ: [0],
    },
    {
      capacityMeshNodeId: "node-c-bottom",
      center: { x: 8, y: 0 },
      width: 2,
      height: 2,
      layer: "bottom",
      availableZ: [1],
    },
  ]
  const mappedNodeIds = getClearanceFeedbackNodeIds(
    [
      {
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        message: "first error in node a",
        center: { x: 0, y: 0 },
      },
      {
        type: "pcb_via_clearance_error",
        error_type: "pcb_via_clearance_error",
        message: "duplicate error in node a on its inclusive boundary",
        center: { x: 1, y: 2 },
      },
      {
        type: "pcb_pad_pad_clearance_error",
        error_type: "pcb_pad_pad_clearance_error",
        message: "error in node b on its inclusive boundary",
        center: { x: 5, y: -1 },
      },
      {
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        message: "layerless error in overlapping layer partitions",
        center: { x: 8, y: 0 },
      },
    ],
    capacityNodes,
  )

  expect(mappedNodeIds).toEqual(
    new Set(["node-a", "node-b", "node-c-top", "node-c-bottom"]),
  )
  expect(() =>
    getClearanceFeedbackNodeIds(
      [
        {
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: "missing center",
        },
      ],
      capacityNodes,
    ),
  ).toThrow("Pipeline7 cannot map clearance error to a capacity node")
  expect(() =>
    getClearanceFeedbackNodeIds(
      [
        {
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: "outside every node",
          center: { x: 10, y: 10 },
        },
      ] as AutoroutingDrcError[],
      capacityNodes,
    ),
  ).toThrow("Pipeline7 cannot map clearance error to a capacity node")
})
