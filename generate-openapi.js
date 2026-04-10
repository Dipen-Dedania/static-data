#!/usr/bin/env node
/**
 * generate-openapi.js
 * ---------------------
 * Recursively walks the `api/` directory, reads every JSON file,
 * infers a JSON Schema from the data, and generates:
 *   - One OpenAPI 3.0 spec per sub-folder  →  api/<folder>/openapi.json
 *   - One combined root spec               →  openapi.json
 *
 * Usage:
 *   node generate-openapi.js [--base-url <url>] [--api-dir <path>] [--out-dir <path>]
 *
 * Defaults:
 *   --base-url  https://raw.githubusercontent.com/dipen27891/static-data/main
 *   --api-dir   ./api
 *   --out-dir   ./  (root openapi.json) and each folder gets its own openapi.json
 */

const fs   = require('fs');
const path = require('path');

// ─── CLI Arguments ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const BASE_URL = getArg('--base-url', 'https://raw.githubusercontent.com/dipen27891/static-data/main');
const API_DIR  = path.resolve(getArg('--api-dir', './api'));
const ROOT_DIR = path.resolve('.');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a file/folder name to a human-readable title */
function toTitle(name) {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\.json$/i, '')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Convert a filename (without .json) to an operationId */
function toOperationId(folderName, fileName) {
  const base = fileName.replace(/\.json$/i, '');
  return `get_${folderName}_${base}`.replace(/[-\s]/g, '_').toLowerCase();
}

/**
 * Infer a JSON Schema from a value (primitive, array, or object).
 * Keeps it simple: detects types, array item schemas, and object properties.
 */
function inferSchema(value, depth = 0) {
  if (value === null) return { type: 'string', nullable: true };
  if (Array.isArray(value)) {
    const itemSchema = value.length > 0 ? inferSchema(value[0], depth + 1) : {};
    return { type: 'array', items: itemSchema };
  }
  if (typeof value === 'object') {
    const properties = {};
    for (const [k, v] of Object.entries(value)) {
      properties[k] = inferSchema(v, depth + 1);
    }
    return { type: 'object', properties };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
  }
  if (typeof value === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

/**
 * Build the OpenAPI response schema for a parsed JSON file.
 * Wraps the root object schema and adds an example.
 */
function buildResponseSchema(data) {
  const schema = inferSchema(data);
  return {
    schema,
    example: (() => {
      // Produce a trimmed example: for arrays inside objects, keep max 2 items
      const trimmed = JSON.parse(JSON.stringify(data));
      if (typeof trimmed === 'object' && !Array.isArray(trimmed)) {
        for (const key of Object.keys(trimmed)) {
          if (Array.isArray(trimmed[key]) && trimmed[key].length > 2) {
            trimmed[key] = trimmed[key].slice(0, 2);
          }
        }
      }
      return trimmed;
    })()
  };
}

/**
 * Collect all JSON files recursively under a directory.
 * Returns an array of absolute file paths.
 */
function collectJsonFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'openapi.json') {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Build an OpenAPI 3.0 document object from a list of json file paths.
 * @param {string}   title     - API title
 * @param {string}   version   - API version string
 * @param {string[]} filePaths - absolute paths to JSON files
 * @param {string}   baseUrl   - server base URL
 */
function buildOpenApiDoc(title, version, filePaths, baseUrl) {
  const paths   = {};
  const schemas = {};
  const tags    = new Set();

  for (const filePath of filePaths) {
    const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'); // e.g. api/india/india-capital-city.json
    const parts        = relativePath.split('/');                                // ['api', 'india', 'india-capital-city.json']
    const folderName   = parts[parts.length - 2];  // e.g. 'india'
    const fileName     = parts[parts.length - 1];  // e.g. 'india-capital-city.json'
    const endpointPath = '/' + relativePath;        // /api/india/india-capital-city.json

    tags.add(folderName);

    // Parse the file and build schema
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.warn(`⚠️  Skipping ${relativePath}: invalid JSON (${e.message})`);
      continue;
    }

    const { schema, example } = buildResponseSchema(data);
    const schemaName = toOperationId(folderName, fileName); // used as $ref key
    schemas[schemaName] = schema;

    const operationId = toOperationId(folderName, fileName);
    const summary     = toTitle(fileName.replace(/\.json$/i, ''));

    paths[endpointPath] = {
      get: {
        tags: [folderName],
        summary,
        description: `Returns the full ${summary} dataset as a JSON array.`,
        operationId,
        responses: {
          '200': {
            description: `Successful response with ${summary} data`,
            headers: {
              'Content-Type': {
                schema: { type: 'string', example: 'application/json' }
              },
              'Access-Control-Allow-Origin': {
                schema: { type: 'string', example: '*' }
              }
            },
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${schemaName}` },
                example
              }
            }
          },
          '404': {
            description: 'Resource not found'
          }
        }
      }
    };
  }

  const tagList = [...tags].map(tag => ({
    name: tag,
    description: `Endpoints for ${toTitle(tag)} data`
  }));

  return {
    openapi: '3.0.3',
    info: {
      title,
      description: `Auto-generated OpenAPI specification for static JSON data hosted on GitHub and proxied via RapidAPI.\n\nBase content URL: ${baseUrl}`,
      version,
      contact: {
        name: 'RapidAPI',
        url: 'https://rapidapi.com/dipen27891/api/india-information'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: baseUrl,
        description: 'GitHub Raw Content (origin)'
      }
    ],
    tags: tagList,
    paths,
    components: {
      schemas
    }
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log('🔍  Scanning API directory:', API_DIR);

  if (!fs.existsSync(API_DIR)) {
    console.error(`❌  api/ directory not found at: ${API_DIR}`);
    process.exit(1);
  }

  // Get all immediate sub-folders of api/
  const subFolders = fs.readdirSync(API_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  console.log(`📂  Found ${subFolders.length} folder(s):`, subFolders.join(', '));

  const allFiles = [];

  // ── Per-folder specs ───────────────────────────────────────────────────────
  for (const folder of subFolders) {
    const folderPath  = path.join(API_DIR, folder);
    const folderFiles = collectJsonFiles(folderPath);

    if (folderFiles.length === 0) {
      console.log(`  ⚠️  Skipping ${folder}/ — no JSON files found`);
      continue;
    }

    console.log(`  📄  ${folder}/ → ${folderFiles.length} file(s):`);
    folderFiles.forEach(f => console.log(`       - ${path.basename(f)}`));

    allFiles.push(...folderFiles);

    const doc      = buildOpenApiDoc(
      `${toTitle(folder)} API`,
      '1.0.0',
      folderFiles,
      BASE_URL
    );
    const outPath  = path.join(folderPath, 'openapi.json');
    fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf-8');
    console.log(`  ✅  Written: ${path.relative(ROOT_DIR, outPath)}`);
  }

  // ── Combined root spec ─────────────────────────────────────────────────────
  if (allFiles.length > 0) {
    const combinedDoc = buildOpenApiDoc(
      'Static Data API (Combined)',
      '1.0.0',
      allFiles,
      BASE_URL
    );
    const rootOut = path.join(ROOT_DIR, 'openapi.json');
    fs.writeFileSync(rootOut, JSON.stringify(combinedDoc, null, 2), 'utf-8');
    console.log(`\n✅  Combined spec written: openapi.json`);
  }

  console.log('\n🎉  Done! Import any openapi.json into RapidAPI to set up Response Transformations.');
  console.log(`    RapidAPI Dashboard → Your API → "Add an API" → Import OpenAPI spec`);
}

main();
