import { expect, test } from "bun:test"
import { createOwnershipParams, getHole, getOwnership } from "./fixtures/tiny-root-ownership"

test("already-connected free endpoints remain nonexclusive unless connected copper owns them", () => {
  const params = createOwnershipParams()
  const hole = getHole(params)
  hole.d._containsObstacle = false
  hole.d._containsTarget = false
  const point = params.connections[0].simpleRouteConnection.pointsToConnect[0]
  point.x = 0
  delete point.pcb_port_id
  expect(getOwnership(params).get("hole")).toBe(-1)
  hole.d._connectedTo = ["net-ground"]
  expect(getOwnership(params).get("hole")).toBe(0)
})
