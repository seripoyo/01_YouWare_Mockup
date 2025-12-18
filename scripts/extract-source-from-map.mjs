import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const mapFile = process.argv[2] || "dist/assets/index-LqE4mWRg.js.map";

const map = JSON.parse(readFileSync(mapFile, "utf-8"));

const sources = map.sources;
const sourcesContent = map.sourcesContent;

console.log(`Found ${sources.length} source files in ${mapFile}`);

for (let i = 0; i < sources.length; i++) {
  const source = sources[i];
  const content = sourcesContent?.[i];
  
  if (!content) {
    console.log(`  [SKIP] ${source} - no content`);
    continue;
  }
  
  // Only extract src/ files
  if (!source.includes("/src/")) {
    continue;
  }
  
  // Get the relative path from ../../src/ to just src/
  const srcIndex = source.indexOf("/src/");
  const relativePath = source.substring(srcIndex + 1); // removes the leading "/"
  
  const outPath = join("extracted", relativePath);
  const outDir = dirname(outPath);
  
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, content);
  console.log(`  [OK] ${relativePath}`);
}

console.log("Done! Check the 'extracted' folder.");
