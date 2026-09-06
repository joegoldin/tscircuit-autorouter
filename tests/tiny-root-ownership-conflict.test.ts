import { expect, test } from "bun:test"
import { createOwnershipConnection, createOwnershipParams, getHole, getOwnership } from "./fixtures/tiny-root-ownership"

test("explicit ownership conflicts cannot be overridden by endpoint containment or alias order", () => {
  for (const variant of ["root-collision", "alias-conflict", "alias-collision", "unknown-root"]) {
    for (const reverse of [false, true]) {
      const params = createOwnershipParams()
      const hole = getHole(params)
      params.connections[0].simpleRouteConnection.pointsToConnect[0].x = 0
      if (variant === "unknown-root") {
        hole.d._targetConnectionName = "unknown"
      } else {
        const foreign = createOwnershipConnection(params, variant === "alias-collision" ? "net-ground" : "foreign", "net-power", variant === "root-collision" ? "ground" : "power")
        foreign.simpleRouteConnection.pointsToConnect = [
          { x: 20, y: 20, layer: "top", pcb_port_id: "foreign-start" },
          { x: 21, y: 20, layer: "top", pcb_port_id: "foreign-end" },
        ]
        params.connections.push(foreign)
        hole.d._connectedTo = variant === "alias-conflict" ? ["route", "net-power"] : ["net-ground"]
      }
      if (reverse) {
        params.connections.reverse()
        hole.d._connectedTo?.reverse()
      }
      if (variant === "unknown-root") {
        expect(getOwnership(params).get("hole"), `${variant}, reverse=${reverse}`).toBeUndefined()
      } else {
        expect(() => getOwnership(params)).toThrow("Conflicting explicit ownership for region")
      }
    }
  }
})
