#!/usr/bin/env node
/**
 * publish-openapi.js
 * ------------------
 * Uploads the generated OpenAPI specification to the RapidAPI Hub.
 *
 * Usage:
 *   RAPIDAPI_API_ID=xxx RAPIDAPI_KEY=yyy node publish-openapi.js --file openapi.json
 */

const fs = require('fs');
const https = require('https');

// ─── CLI Arguments & Env ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const API_ID = process.env.RAPIDAPI_API_ID;
const API_KEY = process.env.RAPIDAPI_KEY;
const SPEC_FILE = getArg('--file', 'openapi.json');

if (!API_ID || !API_KEY) {
  console.error('❌ Error: RAPIDAPI_API_ID and RAPIDAPI_KEY environment variables are required.');
  process.exit(1);
}

if (!fs.existsSync(SPEC_FILE)) {
  console.error(`❌ Error: Specification file not found at ${SPEC_FILE}`);
  process.exit(1);
}

// ─── Execution ────────────────────────────────────────────────────────────────

async function publishSpec() {
  console.log(`🚀 Publishing ${SPEC_FILE} to RapidAPI...`);

  const specContent = fs.readFileSync(SPEC_FILE, 'utf8');

  // RapidAPI expects the OpenAPI JSON as the request body.
  // Note: Some versions of the API may require the spec wrapped in a JSON object { "spec": ... }
  // We'll send the raw JSON spec as it is the most common requirement for the spec endpoint.
  const body = specContent;

  const options = {
    hostname: 'api.rapidapi.com',
    port: 443,
    path: `/v1/apis/${API_ID}/spec`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': API_KEY,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => responseBody += chunk);
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`✅ Successfully published spec to RapidAPI (Status: ${res.statusCode})`);
      } else {
        console.error(`❌ Failed to publish spec. Status: ${res.statusCode}`);
        console.error(`Response: ${responseBody}`);
        process.exit(1);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`❌ Request Error: ${e.message}`);
    process.exit(1);
  });

  req.write(body);
  req.end();
}

publishSpec();
