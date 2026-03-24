# Tenet CSS

**Tenet is a CSS framework which fluidly interpolates not only your entire font stack, but also all whitespace and element sizes.**

**Tenet promotes a sensible and maintainable approach to building the frontend of large codebases.**

With Tenet you define a small viewport size and a font-size to go with it, as well as a large viewport size and a font-size to go with that. Between these viewport sizes, Tenet fluidly interpolates not only your entire font stack, but also all whitespace and element sizes. In addition to this, you'll define two different ratios (for the minimum and maximum viewport sizes) by which the font-size of your headings will increase, and Tenet will fluidly interpolate between those!

This means you won't need to write media queries for your font-sizes again, and you'll write far fewer media queries overall, as elements resize fluidly with the viewport.

Tenet also comes with many handy tools pointing you toward a methodology for writing maintainable frontends, with your quality of life in mind, while avoiding introducing technical debt as much as is possible.

## Table of Contents

- [What is this?](#what-is-this)
- [Who is this for?](#who-is-this-for)
- [Why is it called Tenet?](#why-is-it-called-tenet)
- [Installation](#installation)
- [Build Tools](#build-tools)
- [I have an idea for Tenet!](#i-have-an-idea-for-tenet-i-have-a-question-about-tenet)

## What is this?
Tenet is a sensible toolkit for starting large front-end projects, and for prototyping designs for the web. It is opinionated, and a detailed guide to the suggested methodology for working with this toolkit can be found in the [documentation](https://github.com/trubblebruin/tenet/wiki).

Tenet aims to help reduce the introduction of technical debt, which is useful because you or another human like you will almost certainly end up maintaining the project that you're designing and building now, and they will be happier if you make sensible decisions from the outset.

Tenet has been in use in production in various forms since 2013, though in its original incarnation it was tightly coupled to a CMS. It is currently in production on user-facing government software, amongst other large pieces of software for national and international organisations.

## Who is this for?
This is not a CSS library for engineers looking to add presentational classes to elements and have their prototype app styled quickly; there are already many excellent libraries for that.

Tenet is a set of tools and a methodology for front-end engineers and designers who design in-browser, write hundreds (if not thousands) of lines of CSS on a daily basis on large projects, and seek to avoid introducing technical debt.

I design almost entirely in code and in-browser; this isn't a conference talk about the novelty of a designer-engineer, but rather a practical and well-tested set of tools and ideas to help push that job role forwards in our industry in a meaningful way.

I work closely with excellent backend engineers, and our aim is to make robust software together while maintaining a high quality of life for engineers; reducing repetition, increasing predictability in our codebases, avoiding common and annoying bugs, etc. It is my opinion that context and methodologies can and should be shared freely and be continuously improved, from project managers to designers to engineers, and that the separation of concerns and skills that pervades our industry at present is holding us back, but that's for another time.

## Why is it called Tenet?
Tenet is named after the designer [Deiter Rams](https://en.wikipedia.org/wiki/Dieter_Rams) and his tenets of [good design](https://www.vitsoe.com/eu/about/good-design); my favourite of which is "_good design makes a product understandable_".

> Design should not dominate things, should not dominate people. It should help people. That’s its role.

_Dieter Rams_

## Installation

1. Clone this repository into your project
2. Delete Tenet's `.git` folder (if you accidentally made a commit before removing it, run `git rm --cached tenet` from your project root)
3. Install build dependencies:
   ```bash
   cd source/build_tools/user_interface
   npm install
   ```
4. Edit the paths in `source/build_tools/user_interface/build_modules/config.js` to match your project structure:

| Path | Default Location |
|------|------------------|
| Source JavaScript | `source/assets/js/app.js` |
| Source Stylus | `source/assets/stylus/app.styl` |
| Source Images | `source/assets/images/**/*.{png,jpg,jpeg}` |
| Output JavaScript | `distribution/assets/js/` |
| Output CSS | `distribution/assets/css/` |
| Output Images | `distribution/assets/images/` |

## Build Tools

Run all commands from `source/build_tools/user_interface/`.

### Quick Start

```bash
# Development mode (watch for changes)
npm run develop

# Production build
npm run build

# Lint JavaScript
npm run lint

# Lint and auto-fix
npm run lint:fix
```

### NPM Scripts

#### `npm run build`

Creates an optimised production build:

1. Cleans all previously generated assets
2. Runs all build tasks in parallel:
   - **JavaScript**: Lint → Bundle (ESBuild) → Minify → Remove sourcemaps
   - **CSS**: Lint Stylus → Compile to CSS → PostCSS → Minify → Remove sourcemaps
   - **Images**: Optimise with ImageMin (mozjpeg, pngquant)
3. Outputs build statistics

#### `npm run develop`

Starts development mode with file watching:

1. Performs an initial build
2. Watches for file changes and rebuilds accordingly
3. Continues running even if errors occur (fix and save to retry)
4. Press `Ctrl+C` to stop

#### `npm run lint` / `npm run lint:fix`

Lints all JavaScript files using ESLint. Use `lint:fix` to automatically resolve fixable issues.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Set to `production` for production builds | `development` |
| `SOURCE_MAPS` | Set to `false` to disable sourcemaps | `true` |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, or `NONE` | `INFO` |

## I have an idea for Tenet! I have a question about Tenet!
That's great to hear! Please have a peek at the documentation first and then feel free to start a discussion on this repo.

> Tenet is a working reference implementation of responsible design.

_[Gary Stevens](https://uncommoncorrelation.co.uk)_

> There is no place for hope in software development.

_[Jim Hill](https://dammitjim.co.uk), paraphrasing Frederick Phillips Brooks, Jr._
