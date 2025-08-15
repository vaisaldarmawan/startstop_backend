// server.js
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const port = 3001;

// Adjust this to your folder
const TARGET_DIR = "/opt/earthworm/run_working/params";

// If your filenames are UTC timestamps, keep true.
// If they are local time, set to false.
const USE_UTC = true;

// Max span (seconds) for one burst/group after its n1 anchor
const GROUP_SPAN_SEC = 120;

// How many newest parsed items to keep before grouping (tune as you wish)
const PARSE_SLICE = 5000;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

// Convert "YYYYMMDDHHMM" + "SS" to epoch seconds (UTC or local)
function toEpochSeconds(prefix12, sec2) {
  const year = parseInt(prefix12.slice(0, 4), 10);
  const month = parseInt(prefix12.slice(4, 6), 10) - 1; // 0-11
  const day = parseInt(prefix12.slice(6, 8), 10);
  const hour = parseInt(prefix12.slice(8, 10), 10);
  const minute = parseInt(prefix12.slice(10, 12), 10);
  const second = parseInt(sec2, 10);

  const ms = USE_UTC
    ? Date.UTC(year, month, day, hour, minute, second)
    : new Date(year, month, day, hour, minute, second).getTime();

  return Math.floor(ms / 1000);
}

function getNNumber(filename) {
  const m = filename.match(/_n(\d+)\.rep$/);
  return m ? parseInt(m[1], 10) : NaN;
}

app.get("/smart-count", (req, res) => {
  try {
    // 1) Read files
    const allFiles = fs.readdirSync(TARGET_DIR);

    // 2) Parse names like: YYYYMMDDHHMMSS_nX.rep
    const allParsed = [];
    for (const file of allFiles) {
      const match = file.match(/^(\d{12})(\d{2})_n(\d+)\.rep$/);
      if (!match) continue;

      const prefix = match[1]; // YYYYMMDDHHMM
      const secStr = match[2]; // SS
      const nStr = match[3]; // X from nX

      const epochSec = toEpochSeconds(prefix, secStr);

      allParsed.push({
        file,
        prefix, // minute-level
        secondInt: parseInt(secStr, 10),
        epochSec,
        n: parseInt(nStr, 10),
        minute: prefix, // alias for clarity in output
      });
    }

    // 3) Sort by real time (ascending) so we see n1 anchors in chronological order
    allParsed.sort((a, b) => a.epochSec - b.epochSec);

    // 4) Keep a reasonable tail
    const recent = allParsed.slice(-PARSE_SLICE);

    // 5) Grouping anchored by n1 only.
    //    - Start a new group ONLY when we see n === 1
    //    - Add subsequent files to that group while (file.epochSec - group.startSec) <= GROUP_SPAN_SEC
    //    - Ignore files that appear before the first n1 or beyond the time window
    const groups = [];
    let currentGroup = null; // { startSec, startPrefix, files: [] }

    for (const entry of recent) {
      if (entry.n === 1) {
        // If there's an open group, end it first
        if (currentGroup) groups.push(currentGroup);

        // Start a new anchor group at this n1
        currentGroup = {
          startSec: entry.epochSec,
          startPrefix: entry.minute,
          files: [entry],
        };
        continue;
      }

      // If we have an active group, and this file is within the span, add it
      if (
        currentGroup &&
        entry.epochSec - currentGroup.startSec <= GROUP_SPAN_SEC
      ) {
        currentGroup.files.push(entry);
      } else {
        // No current n1-anchored group, or outside the time span: skip.
        // (We never start a group with n > 1.)
      }
    }

    // Close last group if exists
    if (currentGroup) groups.push(currentGroup);

    // 6) Build response
    const result = groups.map((group) => {
      // Sort inside the group by n (arrival order can be messy)
      const sortedFiles = [...group.files].sort((a, b) => a.n - b.n);

      // seconds (for min/max-second reporting)
      const seconds = sortedFiles.map((f) => f.secondInt).sort((a, b) => a - b);

      // prefix-range for readability: from first minute to last minute inside group
      const firstMinute = sortedFiles[0].minute;
      const lastMinute = sortedFiles[sortedFiles.length - 1].minute;

      // Read file contents (sync; OK for small sets)
      const contents = sortedFiles.map(({ file }) => {
        const filePath = path.join(TARGET_DIR, file);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          return { file, content };
        } catch (err) {
          return { file, content: `Gagal membaca file: ${err.message}` };
        }
      });

      return {
        prefix_range: `${firstMinute}–${lastMinute}`,
        file_count: sortedFiles.length,
        min_second: seconds[0],
        max_second: seconds[seconds.length - 1],
        files: sortedFiles.map((f) => f.file),
        contents,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: `Gagal memproses: ${err.message}` });
  }
});

const localIP = getLocalIP();
app.listen(port, () => {
  console.log(`✅ REP API server berjalan di http://${localIP}:${port}`);
});
