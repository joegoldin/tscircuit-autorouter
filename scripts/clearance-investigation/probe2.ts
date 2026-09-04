import { readFileSync } from "node:fs"
import { AutoroutingPipelineSolver7_MultiGraph } from "../../dist/index.js"
const srj = JSON.parse(readFileSync(process.argv[2]!, "utf8"))
const solver: any = new AutoroutingPipelineSolver7_MultiGraph(srj, {})
while (!solver.solved && !solver.failed) solver.step()
const hd = solver.highDensityRouteSolver
const meta = hd.nodeSolveMetadataById
const entries = meta instanceof Map ? [...meta.entries()] : Object.entries(meta ?? {})
console.log("meta entries", entries.length, JSON.stringify(entries[0]?.[1]).slice(0, 300))
// route -> node: routes carry regionId? map by nodeId in metadata if present
const byNode: Record<string, any> = {}
for (const [id, m] of entries) byNode[id] = m
const sample = hd.routes.find((r: any) => r.regionId)
console.log("route sample regionId", sample?.regionId, "keys of meta value", entries[0] && Object.keys(entries[0][1]))
