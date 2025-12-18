import fs from "fs";
import path from "path";

const BASE_URL = "https://api.github.com/repos/seripoyo/mockup_real/contents/public/assets/mockup";
const TARGET_DIRS = ["1x1", "4x5", "9x16"];
const DEST_ROOT = path.join("public", "assets", "mockup");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "youware-agent",
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function downloadFile(url, destination) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "youware-agent",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  await fs.promises.writeFile(destination, Buffer.from(arrayBuffer));
}

async function ensureDirectory(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function syncDirectory(dirName) {
  const targetDir = path.join(DEST_ROOT, dirName);
  await ensureDirectory(targetDir);

  const files = await fetchJson(`${BASE_URL}/${dirName}`);

  for (const file of files) {
    if (file.type !== "file") continue;

    const dest = path.join(targetDir, file.name);
    const exists = await fs.promises
      .access(dest, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      continue;
    }

    console.log(`Downloading ${dirName}/${file.name}`);
    await downloadFile(file.download_url, dest);

    await delay(200);
  }
}

async function main() {
  for (const dir of TARGET_DIRS) {
    await syncDirectory(dir);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
