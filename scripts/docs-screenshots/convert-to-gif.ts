#!/usr/bin/env tsx
/**
 * Convert recorded .webm videos to optimized .gif files using ffmpeg.
 *
 * This script:
 * 1. Reads all .webm files from temp-videos/
 * 2. Converts each to an optimized GIF with good quality and small file size
 * 3. Outputs GIFs to docs/explore/images/
 * 4. Cleans up the temp video files
 *
 * Prerequisites:
 * - ffmpeg must be installed: `brew install ffmpeg`
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEMP_VIDEOS_DIR = path.join(__dirname, '../../temp-videos');
const IMAGES_DIR = path.join(__dirname, '../../docs/explore/images');

// GIF conversion settings
const GIF_FPS = 30; // Increased for smoother animation
const GIF_WIDTH = 1000; // Increased for better quality (less pixelation)

// Mapping from video filename to output GIF name
const VIDEO_TO_GIF_MAP: Record<string, string> = {
  'zoom-gif---zooming-and-panning-animation': 'zoom.gif',
  zoom: 'zoom.gif',
  'select-single-gif---clicking-to-select-a-protein': 'select-single.gif',
  'select-single': 'select-single.gif',
  'select-box-gif---box-selection-animation': 'select-box.gif',
  'select-box': 'select-box.gif',
  'legend-toggle-gif---toggling-category-visibility': 'legend-toggle.gif',
  'legend-toggle': 'legend-toggle.gif',
  'legend-reorder-gif---dragging-to-reorder-labels': 'legend-reorder.gif',
  'legend-reorder': 'legend-reorder.gif',
  'legend-others-gif---expanding-and-collapsing-others-group': 'legend-others.gif',
  'legend-others': 'legend-others.gif',
};

// Mapping for videos that need trimming (remove loading screen from start)
// Value is seconds to trim from the beginning
// All animations use INITIAL_PAUSE (2000ms) which we trim as 2.5s to account for any variance
// This removes the loading screen and shows only the animation content
const VIDEO_TRIM_MAP: Record<string, number> = {
  // Zoom animation
  'zoom-gif---zooming-and-panning-animation': 2.5,
  zoom: 2.5,
  // Select single animation
  'select-single-gif---clicking-to-select-a-protein': 2.5,
  'select-single': 2.5,
  // Select box animation
  'select-box-gif---box-selection-animation': 2.5,
  'select-box': 2.5,
  // Legend toggle animation
  'legend-toggle-gif---toggling-category-visibility': 2.5,
  'legend-toggle': 2.5,
  // Legend reorder animation
  'legend-reorder-gif---dragging-to-reorder-labels': 2.5,
  'legend-reorder': 2.5,
  // Legend others animation
  'legend-others-gif---expanding-and-collapsing-others-group': 2.5,
  'legend-others': 2.5,
};

/**
 * Check if ffmpeg is installed
 */
function checkFfmpeg(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a webm video to an optimized GIF using a two-pass approach.
 * This produces much better quality than single-pass conversion.
 */
async function convertToGif(
  inputPath: string,
  outputPath: string,
  trimStart: number = 0,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const palettePath = inputPath.replace('.webm', '-palette.png');

    // Two-pass approach for better GIF quality:
    // 1. Generate a palette from the video (trimmed if needed)
    // 2. Use that palette to create the GIF (trimmed if needed)

    console.log(
      `  Generating palette...${trimStart > 0 ? ` (trimming ${trimStart}s from start)` : ''}`,
    );

    // Pass 1: Generate palette
    // Use trim filter in the filter chain for accurate trimming
    const paletteFilter =
      trimStart > 0
        ? `trim=start=${trimStart},fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff`
        : `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff`;

    const paletteCmd = ['ffmpeg', '-y', '-i', inputPath, '-vf', paletteFilter, palettePath];

    try {
      // Use spawnSync with array to avoid shell interpretation issues with filter strings
      const result = spawnSync(paletteCmd[0], paletteCmd.slice(1), {
        stdio: 'pipe',
      });
      if (result.error || result.status !== 0) {
        throw result.error || new Error(`ffmpeg exited with code ${result.status}`);
      }
    } catch (error) {
      // Fall back to single-pass if palette generation fails
      console.log(`  Palette generation failed, using single-pass conversion...`);
      const singlePassFilter =
        trimStart > 0
          ? `trim=start=${trimStart},fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`
          : `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`;

      const singlePassCmd = [
        'ffmpeg',
        '-y',
        '-i',
        inputPath,
        '-vf',
        singlePassFilter,
        '-loop',
        '0',
        outputPath,
      ];

      try {
        const result = spawnSync(singlePassCmd[0], singlePassCmd.slice(1), {
          stdio: 'pipe',
        });
        if (result.error || result.status !== 0) {
          throw result.error || new Error(`ffmpeg exited with code ${result.status}`);
        }
        resolve();
        return;
      } catch (e) {
        reject(e);
        return;
      }
    }

    console.log(
      `  Converting to GIF...${trimStart > 0 ? ` (trimming ${trimStart}s from start)` : ''}`,
    );

    // Pass 2: Create GIF using the palette (trimmed if needed)
    // Use trim filter in the filter chain for accurate trimming
    const gifFilter =
      trimStart > 0
        ? `[0:v]trim=start=${trimStart},fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
        : `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;

    const gifCmd = [
      'ffmpeg',
      '-y',
      '-i',
      inputPath,
      '-i',
      palettePath,
      '-lavfi',
      gifFilter,
      '-loop',
      '0',
      outputPath,
    ];

    try {
      // Use spawnSync with array to avoid shell interpretation issues with filter strings
      const result = spawnSync(gifCmd[0], gifCmd.slice(1), {
        stdio: 'pipe',
      });
      if (result.error || result.status !== 0) {
        throw result.error || new Error(`ffmpeg exited with code ${result.status}`);
      }

      // Clean up palette file
      if (fs.existsSync(palettePath)) {
        fs.unlinkSync(palettePath);
      }

      resolve();
    } catch (error) {
      // Clean up palette file on error
      if (fs.existsSync(palettePath)) {
        fs.unlinkSync(palettePath);
      }
      reject(error);
    }
  });
}

/**
 * Get the output GIF filename for a video file
 */
function getGifName(videoFilename: string): string | null {
  const baseName = path.basename(videoFilename, '.webm');

  // Check if we have a mapping
  if (VIDEO_TO_GIF_MAP[baseName]) {
    return VIDEO_TO_GIF_MAP[baseName];
  }

  // Try to extract gif name from the video filename
  // Format: "test-name-gif---description" -> "test-name.gif"
  const match = baseName.match(/^([a-z-]+)-gif/);
  if (match) {
    return `${match[1]}.gif`;
  }

  // Default: just use the video name with .gif extension
  return `${baseName}.gif`;
}

/**
 * Get the trim duration for a video file (seconds to trim from start)
 */
function getTrimDuration(videoFilename: string): number {
  const baseName = path.basename(videoFilename, '.webm');
  return VIDEO_TRIM_MAP[baseName] || 0;
}

/**
 * Main function to convert all videos
 */
async function main() {
  console.log('🎬 Converting videos to GIFs...\n');

  // Check ffmpeg
  if (!checkFfmpeg()) {
    console.error('❌ Error: ffmpeg is not installed.');
    console.error('   Install it with: brew install ffmpeg');
    process.exit(1);
  }

  // Check if temp videos directory exists
  if (!fs.existsSync(TEMP_VIDEOS_DIR)) {
    console.log('📁 No temp-videos directory found. Run animation capture first:');
    console.log('   pnpm docs:animations');
    process.exit(0);
  }

  // Get all webm files
  const videoFiles = fs.readdirSync(TEMP_VIDEOS_DIR).filter((f) => f.endsWith('.webm'));

  if (videoFiles.length === 0) {
    console.log('📁 No video files found in temp-videos/');
    console.log('   Run animation capture first: pnpm docs:animations');
    process.exit(0);
  }

  console.log(`Found ${videoFiles.length} video(s) to convert:\n`);

  // Ensure output directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Convert each video
  let successCount = 0;
  let errorCount = 0;

  for (const videoFile of videoFiles) {
    const gifName = getGifName(videoFile);
    if (!gifName) {
      console.log(`⚠️  Skipping ${videoFile} (no mapping found)`);
      continue;
    }

    const inputPath = path.join(TEMP_VIDEOS_DIR, videoFile);
    const outputPath = path.join(IMAGES_DIR, gifName);

    // Skip empty files (0 bytes)
    const stats = fs.statSync(inputPath);
    if (stats.size === 0) {
      console.log(`⚠️  Skipping ${videoFile} (empty file)`);
      continue;
    }

    console.log(`📽️  ${videoFile}`);
    console.log(`   → ${gifName}`);

    const trimDuration = getTrimDuration(videoFile);
    if (trimDuration > 0) {
      console.log(`   ⏱️  Trimming ${trimDuration}s from start to remove loading screen`);
    }

    try {
      await convertToGif(inputPath, outputPath, trimDuration);

      // Report file sizes
      const inputSize = stats.size;
      const outputSize = fs.statSync(outputPath).size;
      console.log(`   ✅ Done (${formatSize(inputSize)} → ${formatSize(outputSize)})\n`);

      successCount++;
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  console.log('━'.repeat(50));
  console.log(`\n✨ Conversion complete!`);
  console.log(`   ✅ Success: ${successCount}`);
  if (errorCount > 0) {
    console.log(`   ❌ Failed: ${errorCount}`);
  }

  // Ask about cleanup
  if (successCount > 0) {
    console.log(`\n📁 Temp videos are in: ${TEMP_VIDEOS_DIR}`);
    console.log(`   To clean up, run: rm -rf temp-videos/`);
  }
}

/**
 * Format file size in human-readable format
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Run main function
main().catch(console.error);
