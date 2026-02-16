#!/usr/bin/env bun
/**
 * Convert Vitest tests to Bun test format
 * Converts ~1,604 test files from Vitest to Bun test runner
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";

interface ConversionStats {
  totalFiles: number;
  converted: number;
  skipped: number;
  errors: number;
}

const stats: ConversionStats = {
  totalFiles: 0,
  converted: 0,
  skipped: 0,
  errors: 0,
};

/**
 * Convert a single test file from Vitest to Bun test
 */
function convertTestFile(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, "utf-8");
    const original = content;

    // 1. Replace Vitest imports with Bun test imports
    content = content.replace(
      /import\s+{([^}]+)}\s+from\s+["']vitest["']/g,
      (match, imports) => {
        // Parse imported items
        const items = imports.split(",").map((s: string) => s.trim());

        // Map vitest exports to bun:test exports
        const mapped = items.map((item: string) => {
          // Handle 'vi' -> needs to be replaced with individual imports
          if (item === "vi") {
            return "mock, spyOn";
          }
          return item;
        });

        // Remove duplicates
        const unique = [...new Set(mapped.flatMap((s: string) => s.split(",").map(x => x.trim())))];

        return `import { ${unique.join(", ")} } from "bun:test"`;
      }
    );

    // 2. Replace @vitest/* imports
    content = content.replace(
      /import\s+{([^}]+)}\s+from\s+["']@vitest\/([^"']+)["']/g,
      'import { $1 } from "bun:test"'
    );

    // 3. Replace vi.spyOn with spyOn
    content = content.replace(/\bvi\.spyOn\b/g, "spyOn");

    // 4. Replace vi.fn with mock
    content = content.replace(/\bvi\.fn\b/g, "mock");

    // 5. Replace vi.mock with mock (for module mocking)
    content = content.replace(/\bvi\.mock\b/g, "mock");

    // 6. Replace vi.clearAllMocks
    content = content.replace(/\bvi\.clearAllMocks\(\)/g, "// mock.restore() // TODO: Review mock cleanup");

    // 7. Replace vi.resetAllMocks
    content = content.replace(/\bvi\.resetAllMocks\(\)/g, "// mock.restore() // TODO: Review mock reset");

    // 8. Replace vi.restoreAllMocks
    content = content.replace(/\bvi\.restoreAllMocks\(\)/g, "// TODO: Review mock restoration");

    // 9. Replace vi.useFakeTimers
    content = content.replace(/\bvi\.useFakeTimers\(\)/g, "// TODO: Implement fake timers for Bun");

    // 10. Replace vi.useRealTimers
    content = content.replace(/\bvi\.useRealTimers\(\)/g, "// TODO: Restore real timers");

    // 11. Replace vi.advanceTimersByTime
    content = content.replace(/\bvi\.advanceTimersByTime\b/g, "// TODO: Advance timers");

    // 12. Replace vi.runAllTimers
    content = content.replace(/\bvi\.runAllTimers\(\)/g, "// TODO: Run all timers");

    // 13. Replace vitest.config references in test files (rare but possible)
    content = content.replace(/vitest\.config/g, "test.config");

    // Only write if content changed
    if (content !== original) {
      writeFileSync(filePath, content, "utf-8");
      return true;
    }

    return false;
  } catch (err) {
    console.error(`Error converting ${filePath}:`, err);
    stats.errors++;
    return false;
  }
}

/**
 * Recursively find and convert all test files
 */
function convertDirectory(dirPath: string): void {
  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);

      // Skip node_modules and dist
      if (entry === "node_modules" || entry === "dist" || entry === ".git") {
        continue;
      }

      // Skip symlinks and handle stat errors
      let stat;
      try {
        stat = statSync(fullPath);
      } catch (err) {
        // Skip files that can't be stat'd (broken symlinks, etc.)
        continue;
      }

      if (stat.isDirectory()) {
        convertDirectory(fullPath);
      } else if (entry.endsWith(".test.ts") || entry.endsWith(".spec.ts")) {
        stats.totalFiles++;

        if (convertTestFile(fullPath)) {
          stats.converted++;
          console.log(`✓ ${fullPath}`);
        } else {
          stats.skipped++;
        }
      }
    }
  } catch (err) {
    console.error(`Error processing directory ${dirPath}:`, err);
  }
}

/**
 * Main conversion function
 */
async function main() {
  console.log("🔄 Converting Vitest tests to Bun test format...\n");

  const startTime = performance.now();

  // Convert all test files
  const rootDir = process.cwd();
  convertDirectory(rootDir);

  const endTime = performance.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log("\n📊 Conversion Summary:");
  console.log(`   Total files found: ${stats.totalFiles}`);
  console.log(`   ✓ Converted: ${stats.converted}`);
  console.log(`   - Skipped (no changes): ${stats.skipped}`);
  console.log(`   ✗ Errors: ${stats.errors}`);
  console.log(`   ⏱ Duration: ${duration}s`);

  if (stats.errors > 0) {
    console.log("\n⚠️  Some files had errors. Please review manually.");
    process.exit(1);
  }

  console.log("\n✅ Test conversion completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("   1. Review files with TODO comments for manual updates");
  console.log("   2. Run: bun test");
  console.log("   3. Fix any remaining test failures");
}

main();
