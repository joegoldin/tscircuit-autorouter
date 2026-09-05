import { AutoroutingPipelineSolver7_MultiGraph } from "../../lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
const srj = await Bun.file("tests/fixtures/esp-led-controller-v3.1.srj.json").json()
const solver = new AutoroutingPipelineSolver7_MultiGraph(srj, {})
while (!solver.netToPointPairsSolver?.solved && !solver.failed) solver.step()
await Bun.write("/tmp/esp-router-pairs.json", JSON.stringify(solver.srjWithPointPairs))
