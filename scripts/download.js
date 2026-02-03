/**
 * Simple downloader with redirect support.
 * Usage: node scripts/download.js <url> <destPath>
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

function request(url) {
  return url.startsWith("https:") ? https : http;
}

function download(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const destDir = path.dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });

    const req = request(url).get(
      url,
      {
        headers: {
          "User-Agent": "Kovax-Game-Downloader",
          Accept: "*/*",
        },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects for ${url}`));
            res.resume();
            return;
          }
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          download(next, destPath, redirectsLeft - 1).then(resolve, reject);
          return;
        }

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Failed ${url}: HTTP ${res.statusCode}`));
          res.resume();
          return;
        }

        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", (err) => {
          try {
            file.close(() => {});
          } catch {}
          reject(err);
        });
      }
    );

    req.on("error", reject);
  });
}

async function main() {
  const url = process.argv[2];
  const dest = process.argv[3];
  if (!url || !dest) {
    console.error("Usage: node scripts/download.js <url> <destPath>");
    process.exit(1);
  }
  await download(url, dest);
  console.log(`Downloaded: ${url} -> ${dest}`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

