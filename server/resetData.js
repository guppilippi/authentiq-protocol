// resetData.js
// Törli az összes CID, tokenId és ownership adatot.
// whitelist.json érintetlen marad.
// Futtatás: node server/resetData.js

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = process.env.AQ_DATA_ROOT || join(__dir, "data");

async function clearDir(dir) {
	if (!existsSync(dir)) { console.log(`  skip (not found): ${dir}`); return; }
	const files = await readdir(dir);
	await Promise.all(files.map(f => rm(join(dir, f), { recursive: true, force: true })));
	console.log(`  cleared (${files.length} items): ${dir}`);
}

console.log("AQ server data reset");

await clearDir(join(root, "blobs"));
await clearDir(join(root, "tokens"));
await clearDir(join(root, "wallets"));
await clearDir(join(root, "trash"));

const ownershipPath = join(root, "ownership.json");
await writeFile(ownershipPath, "{}", "utf-8");
console.log(`  reset: ${ownershipPath}`);

console.log("Done. whitelist.json érintetlen.");
