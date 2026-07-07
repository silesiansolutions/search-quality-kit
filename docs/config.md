# Configuration

The loader discovers `search-quality.config.ts`, `.mts`, `.js`, `.mjs`, `.cjs`, or `.json`. Pass another file with `--config`. Every nested section accepts partial values and receives defaults.

| Section                | Important fields                                                     | Defaults                         |
| ---------------------- | -------------------------------------------------------------------- | -------------------------------- |
| `site`                 | `baseUrl`, `localUrl`, `stagingHosts`                                | common local/preview host tokens |
| `build`                | `command`, `startCommand`, `distDir`, `startupTimeoutMs`             | `dist`, 30 seconds               |
| `crawl`                | `entrypoints`, `maxPages`, `include`, `exclude`, timeout, user agent | `/`, 100 pages                   |
| `checks`               | one boolean per built-in check                                       | all enabled                      |
| `rules.title`          | min/max length, duplicate policy                                     | 10–70, no duplicates             |
| `rules.description`    | min/max, missing and duplicate policy                                | 50–170, required, no duplicates  |
| `rules.canonical`      | `required`                                                           | true                             |
| `rules.robots`         | `disallowAllInProduction`                                            | false                            |
| `rules.structuredData` | JSON and visible-content switches                                    | syntax validation on             |
| `rules.openGraph`      | `requireImage`                                                       | false                            |
| `rules.renderedHtml`   | main/H1 policy and minimum visible text                              | main and H1 required, 80 chars   |
| `rules.performance`    | HTML, script, and image thresholds                                   | 500 KiB HTML/image, 10 scripts   |
| `output`               | default format and filenames                                         | console                          |
| `ci`                   | `failOn`, `warnOnly`                                                 | fail on error                    |

Length and byte thresholds are regression heuristics, not Google ranking limits. Tune them to the project instead of disabling unrelated checks.

Paths in `include`, `exclude`, and `entrypoints` are URL paths. Exclusions apply to sitemap scope and crawling. A deliberate `noindex` page should normally be excluded rather than globally weakening the indexability check.
