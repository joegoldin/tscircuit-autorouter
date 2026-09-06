import { expect, test } from "bun:test"
import { createOwnershipConnection, createOwnershipParams, getHole, getOwnership } from "./fixtures/tiny-root-ownership"

test("same-net root aliases resolve independent of paired-route and alias order", () => {
  for (const reverse of [false, true]) {
    const params = createOwnershipParams()
    params.connections.push(createOwnershipConnection(params, "second", "net-ground", "ground"))
    const foreign = createOwnershipConnection(params, "foreign", "net-power", "power")
    foreign.simpleRouteConnection.pointsToConnect = [
      { x: 20, y: 20, layer: "top" },
      { x: 21, y: 20, layer: "top" },
    ]
    params.connections.push(foreign)
    getHole(params).d._connectedTo = ["route", "net-ground", "ground"]
    if (reverse) {
      params.connections.reverse()
      getHole(params).d._connectedTo!.reverse()
    }
    const owners = getOwnership(params)
    const expected = params.connections.findIndex((connection) => connection.mutuallyConnectedNetworkId === "net-ground") === 0 ? 0 : 1
    expect(owners.get("hole")).toBe(expected)
    expect(owners.get("bottom")).toBe(expected)
  }
})
