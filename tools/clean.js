// Cross-platform replacement for rm -rf so npm run build can also work on Windows contributors (like me!)
import { rmSync } from "node:fs";

for (const dir of process.argv.slice(2)) {
    rmSync(dir, { recursive: true, force: true }); // Equivalent to rm -rf
}