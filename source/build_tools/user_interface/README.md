# Tenet CSS Build Tools

A modern, modular build system for compiling and optimising frontend assets. This system replaces the previous Gulp-based workflow with a faster, more maintainable Node.js implementation using ESBuild for JavaScript and Stylus for CSS.

## Table of Contents

- [Quick Start](#quick-start)
- [NPM Scripts](#npm-scripts)
- [CLI Commands](#cli-commands)
- [Build Pipelines](#build-pipelines)
- [Configuration](#configuration)
- [Directory Structure](#directory-structure)
- [Caching](#caching)
- [Error Handling](#error-handling)
- [Extending the Build System](#extending-the-build-system)

## Quick Start

```bash
# Install dependencies
npm install

# Development mode (watch for changes)
npm run develop

# Production build
npm run build

# Lint JavaScript
npm run lint

# Lint and auto-fix
npm run lint:fix
```

## NPM Scripts

### `npm run build`

Creates an optimised production build:

1. Cleans all previously generated assets
2. Runs all build tasks in parallel:
   - **JavaScript**: Lint → Bundle (ESBuild) → Minify → Remove sourcemaps
   - **CSS**: Lint Stylus → Compile to CSS → PostCSS → Minify → Remove sourcemaps
   - **Images**: Optimise with ImageMin (mozjpeg, pngquant)
3. Outputs build statistics

**Output files:**
- `distribution/assets/js/app.js` - Bundled JavaScript
- `distribution/assets/js/app.min.js` - Minified JavaScript
- `distribution/assets/css/app.css` - Compiled CSS
- `distribution/assets/css/app.min.css` - Minified CSS

### `npm run develop`

Starts development mode with file watching:

1. Performs an initial build
2. Watches for file changes:
   - JavaScript files → Rebuilds JS pipeline
   - Stylus files → Rebuilds CSS pipeline
   - Image files → Re-optimises changed images
3. Continues running even if errors occur (fix and save to retry)
4. Press `Ctrl+C` to stop

### `npm run lint`

Lints all JavaScript files using ESLint, including:
- Source files in `source/assets/js/`
- Build tool files in `source/build_tools/user_interface/`

### `npm run lint:fix`

Runs ESLint with the `--fix` flag to automatically resolve fixable issues.

## CLI Commands

Run commands directly with `node build.js <command> [options]`:

| Command | Description |
|---------|-------------|
| `build` | Full production build |
| `develop` | Development mode with file watching |
| `lint` | Lint JavaScript files |
| `clean` | Remove all generated assets |
| `build-js` | Build only JavaScript |
| `build-css` | Build only CSS |
| `minify-images` | Optimise images only |

### Options

| Option | Description |
|--------|-------------|
| `--fix` | Auto-fix linting issues |
| `--verbose` | Show detailed output and timing |
| `--quiet` | Show errors only |
| `--log-file [path]` | Write output to a log file |
| `--help` | Show help information |

### Examples

```bash
# Production build with detailed output
node build.js build --verbose

# Lint and auto-fix
node build.js lint --fix

# Build with logging to file
node build.js build --log-file build.log

# Build only CSS
node build.js build-css
```

## Build Pipelines

### JavaScript Pipeline

```
source/assets/js/app.js
    ↓
[ESLint] Lint source files
    ↓
[ESBuild] Bundle modules (IIFE format)
    ↓
distribution/assets/js/app.js
    ↓
[ESBuild] Minify (drop console/debugger in production)
    ↓
distribution/assets/js/app.min.js
    ↓
[Production] Remove sourcemap references
```

**Tools used:**
- **ESBuild** - Bundling and minification (targets: Chrome 80+, Firefox 78+, Safari 13+, Edge 80+)
- **ESLint** - Code quality with unicorn and comment-length plugins

### CSS Pipeline

```
source/assets/stylus/app.styl
    ↓
[Stylint] Lint Stylus files
    ↓
[Stylus] Compile to CSS (with Rupture for media queries)
    ↓
[PostCSS] Autoprefixer + CSS MQPacker
    ↓
distribution/assets/css/app.css
    ↓
[CleanCSS] Minify (level 2 optimisation)
    ↓
distribution/assets/css/app.min.css
    ↓
[Production] Remove sourcemap references
```

**Tools used:**
- **Stylus** - CSS preprocessor with Rupture plugin
- **PostCSS** - Autoprefixer for vendor prefixes, CSS MQPacker for media query optimisation
- **CleanCSS** - CSS minification
- **Stylint** - Stylus code quality

### Image Pipeline

```
source/assets/images/**/*.{png,jpg,jpeg}
    ↓
[ImageMin] Optimise images
    ├── mozjpeg (quality: 80, progressive)
    └── pngquant (quality: 65-80%)
    ↓
distribution/assets/images/
```

## Configuration

Configuration is centralised in `build_modules/config.js`.

### Build Profiles

#### Development Profile
```javascript
{
    minify: false,      // Skip minification
    sourceMaps: true,   // Generate sourcemaps
    cache: true,        // Use file caching
    stats: true         // Track build statistics
}
```

#### Production Profile
```javascript
{
    minify: true,       // Minify output
    sourceMaps: false,  // No sourcemaps
    cache: true,        // Use file caching
    stats: true         // Track build statistics
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Set to `production` for production builds | `development` |
| `SOURCE_MAPS` | Set to `false` to disable sourcemaps | `true` |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, or `NONE` | `INFO` |
| `CI` | Set to `true` in CI environments | Auto-detected |

### Tool Configurations

#### ESBuild
```javascript
{
    target: ["chrome80", "edge80", "es2020", "firefox78", "safari13"],
    format: "iife",
    bundle: true
}
```

#### Stylus
```javascript
{
    compress: false,  // Handled by CleanCSS
    use: ["rupture"]  // Responsive utilities
}
```

#### ImageMin
```javascript
{
    mozjpeg: { quality: 80, progressive: true },
    pngquant: { quality: [0.65, 0.8], speed: 4 }
}
```

### File Paths

All paths are configured in `config.js`:

| Path | Location |
|------|----------|
| Source JavaScript | `source/assets/js/app.js` |
| Source Stylus | `source/assets/stylus/app.styl` |
| Source Images | `source/assets/images/**/*.{png,jpg,jpeg}` |
| Output JavaScript | `distribution/assets/js/` |
| Output CSS | `distribution/assets/css/` |
| Output Images | `distribution/assets/images/` |
| Cache Directory | `source/build_tools/user_interface/.cache/` |

## Directory Structure

```
source/build_tools/user_interface/
├── build.js                    # Main entry point and task registration
├── package.json                # Dependencies and npm scripts
├── eslint.config.mjs           # ESLint configuration
├── .stylintrc                  # Stylint configuration
├── .browserslistrc             # Browser support targets
├── postcss.config.js           # PostCSS configuration
├── README.md                   # This file
├── .cache/                     # Build cache (auto-generated)
│   ├── js_cache.json
│   ├── css-cache.json
│   ├── images-cache.json
│   └── build-stats.json
└── build_modules/              # Build system modules
    ├── config.js               # Centralised configuration
    ├── task_registry.js        # Task runner implementation
    ├── task_utilities.js       # Shared task utilities
    ├── utilities.js            # Logging, caching, statistics
    ├── errors.js               # Error classes and handling
    ├── cli_formatter.js        # CLI output formatting
    └── tasks/                   # Individual task implementations
        ├── javascript_esbuild.js   # JavaScript processing
        ├── stylus.js               # CSS/Stylus processing
        ├── images.js               # Image optimisation
        └── watcher.js              # File watching
```

## Caching

The build system uses SHA256 hash-based caching to skip reprocessing unchanged files.

### How It Works

1. Each file's content hash is calculated and stored in `.cache/*.json`
2. Before processing, the current hash is compared with the cached hash
3. If unchanged, the file is skipped (logged as "Using cached...")
4. JavaScript caching also tracks all imported dependencies

### Cache Files

| File | Purpose |
|------|---------|
| `js_cache.json` | JavaScript entry file and all dependencies |
| `css-cache.json` | Stylus files and their imports |
| `images-cache.json` | Individual image file hashes |
| `build-stats.json` | Build timing and statistics |

### Clearing Cache

Delete the `.cache/` directory to force a full rebuild:

```bash
rm -rf source/build_tools/user_interface/.cache
```

## Error Handling

The build system uses a structured error classification system.

### Error Categories

| Category | Description |
|----------|-------------|
| `filesystem` | File operations, permissions, missing files |
| `validation` | Invalid inputs, configuration errors |
| `dependency` | Missing tools, version conflicts |
| `syntax` | Code syntax errors, linting failures |
| `process` | External process failures |
| `timeout` | Operation timeouts |

### Error Severity

| Severity | Behaviour |
|----------|-----------|
| `critical` | Stops build completely |
| `error` | Task fails, build may continue |
| `warning` | Issue noted, task continues |

### Development Mode Error Recovery

In development mode (`npm run develop`), most errors are recoverable:

1. Error is logged with suggestions
2. File watcher continues running
3. Fix the issue and save to trigger a rebuild

### Error Output

Errors include:
- Clear error message
- File and line information (when available)
- Suggested fixes
- Error code for debugging (in verbose mode)

## Extending the Build System

### Adding a New Task

1. Create a task function in `build_modules/tasks/`:

```javascript
/**
 * My custom task.
 * @returns {Promise<Object>} Task result
 */
export async function myCustomTask() {
    log("Running my custom task...", "INFO", "MyTask");

    // Task implementation

    return { success: true };
}
```

2. Register the task in `build.js`:

```javascript
import { myCustomTask } from "./build_modules/tasks/my_task.js";

// In setupTaskRunner():
runner.registerTask("my-task", myCustomTask, {
    description: "My custom task",
    dependencies: [],      // Tasks to run first
    parallel: false,       // Run dependencies in parallel?
    enabled: true,         // Is this task enabled?
    critical: true         // Should errors stop the build?
});
```

3. Add to a build sequence if needed:

```javascript
await runner.runSequence(["clean", "my-task", "build"]);
```

### Task Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `description` | `string` | `""` | Human-readable description |
| `dependencies` | `string[]` | `[]` | Tasks to run before this one |
| `parallel` | `boolean` | `false` | Run dependencies in parallel |
| `enabled` | `boolean` | `true` | Skip if false |
| `critical` | `boolean` | `true` | Exit on error if true |

### Using Task Utilities

```javascript
import { processWithCache, cleanFiles } from "../task_utilities.js";
import { log, recordFileProcessed } from "../utilities.js";

// Process with caching
const result = await processWithCache({
    input: "source/file.txt",
    output: "dist/file.txt",
    cache: ".cache/my-cache.json",
    processor: async (inputs, output) => {
        // Process the file
        return { success: true };
    },
    context: "MyTask"
});

// Clean files
await cleanFiles("dist/**/*.tmp", { context: "MyTask" });

// Log messages
log("Processing...", "INFO", "MyTask");
log("Debug info", "DEBUG", "MyTask");
log("Warning!", "WARNING", "MyTask");
```

### Creating Custom Error Types

```javascript
import { BuildError, ErrorCategory, ErrorSeverity } from "../errors.js";

class MyCustomError extends BuildError {
    constructor(message, options = {}) {
        super(message, {
            category: ErrorCategory.VALIDATION,
            severity: ErrorSeverity.ERROR,
            ...options
        });
    }
}
```
