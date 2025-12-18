import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUBLIC_MOCKUP_DIR = path.join(PROJECT_ROOT, "public", "assets", "mockup");

const SUPPORTED_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);
const ASPECT_LABELS: Record<string, string> = {
  "1x1": "1:1",
  "4x5": "4:5",
  "9x16": "9:16",
  "16x9": "16:9",
};

const DEVICE_KEYWORDS: Array<{ keyword: string; type: string; label: string; priority: number }> = [
  { keyword: "spandlaptop", type: "Device Set", label: "Phone & Laptop", priority: 0 },
  { keyword: "2sp", type: "Device Set", label: "Dual Phones", priority: 0 },
  { keyword: "3sp", type: "Device Set", label: "Triple Phones", priority: 0 },
  { keyword: "laptop", type: "Laptop", label: "Laptop", priority: 1 },
  { keyword: "tablet", type: "Tablet", label: "Tablet", priority: 2 },
  { keyword: "phone", type: "Smartphone", label: "Smartphone", priority: 3 },
  { keyword: "smartphone", type: "Smartphone", label: "Smartphone", priority: 3 },
  { keyword: "sp", type: "Smartphone", label: "Smartphone", priority: 3 },
];

const COLOR_NAME_MAP: Record<string, string> = {
  baige: "Beige",
  baiige: "Beige",
  grean: "Green",
  grey: "Gray",
  gray: "Gray",
};

// Colors to exclude from filters
const EXCLUDED_COLORS = new Set([
  "001", "002", "003", "004", "005", "006", "007", "008", "009",
  "brpwn", "baihe"
]);

// Check if a color token is a valid color (not a number or excluded term)
function isValidColor(token: string): boolean {
  const lower = token.toLowerCase();
  // Exclude if it's in the exclusion list
  if (EXCLUDED_COLORS.has(lower)) {
    return false;
  }
  // Exclude if it's purely numeric
  if (/^\d+$/.test(token)) {
    return false;
  }
  return true;
}

interface ParsedDevice {
  type: string;
  label: string;
  priority: number;
}

function titleCase(input: string): string {
  if (!input) return input;
  const normalized = COLOR_NAME_MAP[input.toLowerCase()] ?? input;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function normalizeDevice(devicePart: string): ParsedDevice {
  const key = devicePart.toLowerCase();
  const match = DEVICE_KEYWORDS.find((entry) => key.includes(entry.keyword));
  if (match) {
    return { type: match.type, label: match.label, priority: match.priority };
  }
  return { type: "Accessory", label: devicePart, priority: 4 };
}

interface GalleryItem {
  id: string;
  originalFilename: string;
  publicPath: string;
  folder: string;
  aspectKey: string;
  aspectRatio: string;
  deviceType: string;
  deviceLabel: string;
  priority: number;
  sequence: number | null;
  colors: string[];
  colorTokens: string[];
  searchTokens: string[];
  displayName: string;
}

function parseFilename(filename: string, folder: string): GalleryItem | null {
  const extension = path.extname(filename).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return null;
  }

  const basename = filename.replace(new RegExp(`${extension}$`), "");
  const parts = basename.split("_").filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  const devicePart = parts[0];
  const aspectPart = parts[1]?.toLowerCase() ?? "";
  const sequencePart = parts[2];
  const colorParts = parts.slice(3);

  const aspectKey = aspectPart;
  const aspectRatio = ASPECT_LABELS[aspectKey];
  if (!aspectRatio) {
    return null;
  }

  const sequence = Number.parseInt(sequencePart, 10);
  const sequenceValue = Number.isNaN(sequence) ? null : sequence;

  const parsedDevice = normalizeDevice(devicePart);
  // Filter out invalid colors (numbers and excluded terms)
  const validColorParts = colorParts.filter(isValidColor);
  const colors = validColorParts.map(titleCase);
  const colorTokens = validColorParts.map((token) => token.toLowerCase());

  const searchTokens = [basename.toLowerCase(), parsedDevice.type.toLowerCase(), parsedDevice.label.toLowerCase(), aspectRatio, ...colorTokens];

  const id = `${folder}-${basename}`;
  const displaySequence = sequenceValue !== null ? `#${sequenceValue.toString().padStart(3, "0")}` : "";
  const displayColors = colors.length > 0 ? ` • ${colors.join(" / ")}` : "";
  const displayName = `${parsedDevice.label} ${aspectRatio} ${displaySequence}${displayColors}`.trim();

  return {
    id,
    originalFilename: filename,
    publicPath: `/assets/mockup/${folder}/${filename}`,
    folder,
    aspectKey,
    aspectRatio,
    deviceType: parsedDevice.type,
    deviceLabel: parsedDevice.label,
    priority: parsedDevice.priority,
    sequence: sequenceValue,
    colors,
    colorTokens,
    searchTokens,
    displayName,
  };
}

async function collectGalleryItems(): Promise<GalleryItem[]> {
  const entries = await fs.readdir(PUBLIC_MOCKUP_DIR, { withFileTypes: true });
  const items: GalleryItem[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = entry.name;
    const folderPath = path.join(PUBLIC_MOCKUP_DIR, folder);
    const files = await fs.readdir(folderPath);

    for (const file of files) {
      const item = parseFilename(file, folder);
      if (item) {
        items.push(item);
      }
    }
  }

  return items.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    if (a.aspectRatio !== b.aspectRatio) {
      return a.aspectRatio.localeCompare(b.aspectRatio);
    }
    if (a.sequence !== null && b.sequence !== null) {
      return a.sequence - b.sequence;
    }
    return a.originalFilename.localeCompare(b.originalFilename);
  });
}

async function main() {
  const items = await collectGalleryItems();
  const outputPath = path.join(PROJECT_ROOT, "src", "features", "mockup", "data", "mockupGalleryData.ts");

  const fileHeader = `// Auto-generated by scripts/generate-gallery-metadata.ts\n// Do not edit manually. Run \"node scripts/generate-gallery-metadata.ts\" to regenerate.\n\n`;

  const importLine = `import { MockupGalleryItem } from \"../gallery\";\n\n`;
  const arrayLiteral = JSON.stringify(items, null, 2).replace(/"([^"\\]+)":/g, "$1:");
  const exportLine = `export const mockupGalleryItems: MockupGalleryItem[] = ${arrayLiteral};\n`;

  await fs.writeFile(outputPath, fileHeader + importLine + exportLine, "utf8");
  console.log(`✅ Generated ${items.length} gallery items → ${path.relative(PROJECT_ROOT, outputPath)}`);
}

main().catch((error) => {
  console.error("Failed to generate gallery metadata", error);
  process.exit(1);
});
