#!/usr/bin/env bun
/**
 * Rename all "razroom" references to "razroom" throughout the repository
 * Handles: razroom -> razroom, Razroom -> Razroom, RAZROOM -> RAZROOM
 */

import { readdirSync, readFileSync, writeFileSync, statSync, renameSync } from "fs";
import { join, dirname, basename } from "path";

interface RenameStats {
  filesScanned: number;
  filesModified: number;
  filesRenamed: number;
  totalReplacements: number;
  errors: number;
}

const stats: RenameStats = {
  filesScanned: 0,
  filesModified: 0,
  filesRenamed: 0,
  totalReplacements: 0,
  errors: 0,
};

// File extensions to process
const PROCESSABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".yaml",
  ".yml",
  ".toml",
  ".txt",
  ".sh",
  ".bash",
  ".html",
  ".css",
  ".scss",
]);

// Directories to skip
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".turbo"]);

/**
 * Rename all razroom references in file content
 */
function renameInFileContent(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, "utf-8");
    const original = content;
    let replacements = 0;

    // Replace all variations
    // Case 1: RAZROOM -> RAZROOM
    const upperCount = (content.match(/RAZROOM/g) || []).length;
    content = content.replace(/RAZROOM/g, "RAZROOM");
    replacements += upperCount;

    // Case 2: Razroom -> Razroom
    const titleCount = (content.match(/Razroom/g) || []).length;
    content = content.replace(/Razroom/g, "Razroom");
    replacements += titleCount;

    // Case 3: razroom -> razroom (must come last to not affect the above)
    const lowerCount = (content.match(/razroom/g) || []).length;
    content = content.replace(/razroom/g, "razroom");
    replacements += lowerCount;

    // Only write if content changed
    if (content !== original) {
      writeFileSync(filePath, content, "utf-8");
      stats.totalReplacements += replacements;
      return true;
    }

    return false;
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
    stats.errors++;
    return false;
  }
}

/**
 * Rename file if it contains razroom in its name
 */
function renameFile(filePath: string): string | null {
  const dir = dirname(filePath);
  const filename = basename(filePath);

  if (filename.toLowerCase().includes("razroom")) {
    const newFilename = filename
      .replace(/razroom/g, "razroom")
      .replace(/Razroom/g, "Razroom")
      .replace(/RAZROOM/g, "RAZROOM");

    const newPath = join(dir, newFilename);

    try {
      renameSync(filePath, newPath);
      stats.filesRenamed++;
      console.log(`Renamed: ${filename} -> ${newFilename}`);
      return newPath;
    } catch (err) {
      console.error(`Error renaming ${filePath}:`, err);
      stats.errors++;
    }
  }

  return null;
}

/**
 * Process a single file
 */
function processFile(filePath: string): void {
  stats.filesScanned++;

  // Check if file should be processed
  const ext = filePath.substring(filePath.lastIndexOf("."));
  if (!PROCESSABLE_EXTENSIONS.has(ext)) {
    return;
  }

  // Rename content
  if (renameInFileContent(filePath)) {
    stats.filesModified++;
    if (stats.filesModified % 100 === 0) {
      console.log(`Progress: ${stats.filesModified} files modified...`);
    }
  }

  // Rename file itself (after content is updated)
  renameFile(filePath);
}

/**
 * Recursively process directory
 */
function processDirectory(dirPath: string): void {
  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      // Skip certain directories
      if (SKIP_DIRS.has(entry)) {
        continue;
      }

      const fullPath = join(dirPath, entry);

      // Skip symlinks
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (stat.isFile()) {
        processFile(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error processing directory ${dirPath}:`, err);
  }
}

/**
 * Rename specific important files
 */
function renameImportantFiles(): void {
  const renames = [{ from: "razroom.mjs", to: "razroom.mjs" }];

  for (const { from, to } of renames) {
    try {
      renameSync(from, to);
      stats.filesRenamed++;
      console.log(`✓ Renamed: ${from} -> ${to}`);
    } catch {
      // File might not exist or already renamed
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log("🔄 Renaming all 'razroom' references to 'razroom'...\n");

  const startTime = performance.now();

  // Process all files in repository
  const rootDir = process.cwd();
  processDirectory(rootDir);

  // Rename important files
  renameImportantFiles();

  const endTime = performance.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log("\n📊 Rename Summary:");
  console.log(`   Files scanned: ${stats.filesScanned}`);
  console.log(`   Files modified: ${stats.filesModified}`);
  console.log(`   Files renamed: ${stats.filesRenamed}`);
  console.log(`   Total replacements: ${stats.totalReplacements}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Duration: ${duration}s`);

  if (stats.errors > 0) {
    console.log("\n⚠️  Some files had errors. Please review manually.");
    process.exit(1);
  }

  console.log("\n✅ Rename completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("   1. Review changes: git diff");
  console.log("   2. Test build: bun run build");
  console.log("   3. Test CLI: bun razroom.mjs --version");
  console.log("   4. Commit changes: git add . && git commit -m 'Rename razroom to razroom'");
}

void main();
