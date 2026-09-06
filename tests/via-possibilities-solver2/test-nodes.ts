import type { NodeWithPortPoints } from "lib/types/high-density-types"

export const makeCrossingNode = (): NodeWithPortPoints => ({
  capacityMeshNodeId: "crossing-node",
  center: { x: 0, y: 0 },
  width: 2,
  height: 2,
  availableZ: [0, 1],
  portPoints: [
    { connectionName: "A", x: -1, y: -1, z: 0 },
    { connectionName: "A", x: 1, y: 1, z: 0 },
    { connectionName: "B", x: -1, y: 1, z: 0 },
    { connectionName: "B", x: 1, y: -1, z: 0 },
  ],
})
