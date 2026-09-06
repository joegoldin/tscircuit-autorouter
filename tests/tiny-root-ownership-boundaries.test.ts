import { expect, test } from "bun:test"
import { createOwnershipConnection, createOwnershipParams, getHole, getOwnership } from "./fixtures/tiny-root-ownership"

test("root ownership stays scoped to obstacle targets and preserves unknown and foreign ownership", () => {
  for (const [obstacle, target] of [[false, true], [true, false], [false, false]]) {
    const params = createOwnershipParams()
    const hole = getHole(params)
    hole.d._containsObstacle = obstacle
    hole.d._containsTarget = target
    hole.d._connectedTo = ["ground"]
    expect(getOwnership(params).get("hole")).toBeUndefined()
  }
  const params = createOwnershipParams()
  const hole = getHole(params)
  delete hole.d._targetConnectionName
  expect(getOwnership(params).get("hole")).toBeUndefined()
  hole.d._targetConnectionName = "missing-root"
  expect(getOwnership(params).get("hole")).toBeUndefined()
  hole.d._connectedTo = ["net-ground", "unrecognized-description"]
  expect(getOwnership(params).get("hole")).toBe(0)
  delete hole.d._connectedTo
  const foreign = createOwnershipConnection(params, "foreign", "net-power", "power")
  foreign.simpleRouteConnection.pointsToConnect = [
    { x: 20, y: 20, layer: "top" },
    { x: 21, y: 20, layer: "top" },
  ]
  params.connections.push(foreign)
  hole.d._targetConnectionName = "power"
  expect(getOwnership(params).get("hole")).toBe(1)
})
