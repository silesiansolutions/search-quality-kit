import type {
  PluginCheckDefinition,
  PluginDefinition,
  PluginFinding,
} from "./types.js";

const SEVERITIES = new Set(["error", "warning", "info"]);
const CLASSIFICATIONS = new Set([
  "google-requirement",
  "google-recommendation",
  "local-heuristic",
  "profile-expectation",
]);
const CHECK_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const PLUGIN_NAME = /^[a-z][a-z0-9-]*$/;

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function validateCheckDefinition(value: unknown): PluginCheckDefinition {
  const check = record(value);
  if (!check) throw new Error("Invalid plugin check: expected an object.");
  if (typeof check.id !== "string" || !check.id.trim())
    throw new Error("Invalid plugin check: id is required.");
  if (!CHECK_ID.test(check.id))
    throw new Error(
      `Invalid plugin check '${check.id}': id must be namespaced, for example custom.no-placeholder-copy.`,
    );
  if (typeof check.title !== "string" || !check.title.trim())
    throw new Error(`Invalid plugin check '${check.id}': title is required.`);
  if (typeof check.category !== "string" || !check.category.trim())
    throw new Error(
      `Invalid plugin check '${check.id}': category is required.`,
    );
  if (!CLASSIFICATIONS.has(String(check.classification)))
    throw new Error(
      `Invalid plugin check '${check.id}': classification must be google-requirement, google-recommendation, local-heuristic, or profile-expectation.`,
    );
  if (!SEVERITIES.has(String(check.defaultSeverity)))
    throw new Error(
      `Invalid plugin check '${check.id}': defaultSeverity must be error, warning, or info.`,
    );
  if (check.docsUrl !== undefined) {
    try {
      const docsUrl = new URL(String(check.docsUrl));
      if (!/^https?:$/.test(docsUrl.protocol)) throw new Error();
    } catch {
      throw new Error(
        `Invalid plugin check '${check.id}': docsUrl must be an absolute HTTP(S) URL.`,
      );
    }
  }
  if (typeof check.run !== "function")
    throw new Error(`Invalid plugin check '${check.id}': run is required.`);
  return Object.freeze({
    ...(check as unknown as PluginCheckDefinition),
  });
}

export function defineCheck(
  definition: PluginCheckDefinition,
): PluginCheckDefinition {
  return validateCheckDefinition(definition);
}

export function validatePluginDefinition(value: unknown): PluginDefinition {
  const plugin = record(value);
  if (!plugin) throw new Error("Invalid plugin: expected an object.");
  if (typeof plugin.name !== "string" || !PLUGIN_NAME.test(plugin.name))
    throw new Error(
      "Invalid plugin: name is required and must use lowercase letters, numbers, and hyphens.",
    );
  if (!Array.isArray(plugin.checks) || plugin.checks.length === 0)
    throw new Error(
      `Invalid plugin '${plugin.name}': checks must not be empty.`,
    );
  const checks = plugin.checks.map(validateCheckDefinition);
  const ids = new Set<string>();
  for (const check of checks) {
    if (
      !check.id.startsWith("custom.") &&
      !check.id.startsWith(`${plugin.name}.`)
    )
      throw new Error(
        `Invalid plugin '${plugin.name}': check id '${check.id}' must start with 'custom.' or '${plugin.name}.'.`,
      );
    if (ids.has(check.id))
      throw new Error(
        `Invalid plugin '${plugin.name}': duplicate check id '${check.id}'.`,
      );
    ids.add(check.id);
  }
  let policyPack: PluginDefinition["policyPack"];
  if (plugin.policyPack !== undefined) {
    const metadata = record(plugin.policyPack);
    if (!metadata || typeof metadata.name !== "string" || !metadata.name.trim())
      throw new Error(
        `Invalid plugin '${plugin.name}': policyPack.name is required.`,
      );
    const optionsSummary = record(metadata.optionsSummary);
    if (!optionsSummary)
      throw new Error(
        `Invalid plugin '${plugin.name}': policyPack.optionsSummary must be an object.`,
      );
    let safeOptionsSummary: Record<string, unknown>;
    try {
      safeOptionsSummary = JSON.parse(
        JSON.stringify(optionsSummary, (_key, option: unknown) => {
          if (
            option === undefined ||
            ["function", "symbol", "bigint"].includes(typeof option)
          )
            throw new Error("non-serializable option");
          return option;
        }),
      ) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Invalid plugin '${plugin.name}': policyPack.optionsSummary must contain serializable values.`,
      );
    }
    policyPack = Object.freeze({
      name: metadata.name,
      optionsSummary: deepFreeze(safeOptionsSummary),
    });
  }
  return Object.freeze({
    name: plugin.name,
    checks: Object.freeze(checks),
    ...(policyPack ? { policyPack } : {}),
  });
}

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return validatePluginDefinition(definition);
}

export function validatePluginCollection(
  values: readonly unknown[],
): readonly PluginDefinition[] {
  const plugins = values.map(validatePluginDefinition);
  const ids = new Map<string, string>();
  for (const plugin of plugins)
    for (const check of plugin.checks) {
      const previous = ids.get(check.id);
      if (previous)
        throw new Error(
          `Duplicate plugin check id '${check.id}' in plugins '${previous}' and '${plugin.name}'.`,
        );
      ids.set(check.id, plugin.name);
    }
  return Object.freeze(plugins);
}

export function validatePluginFinding(
  value: unknown,
  plugin: PluginDefinition,
  check: PluginCheckDefinition,
  index: number,
): PluginFinding {
  const finding = record(value);
  const prefix = `Invalid finding ${index} from plugin '${plugin.name}' check '${check.id}'`;
  if (!finding) throw new Error(`${prefix}: expected an object.`);
  if (typeof finding.code !== "string" || !finding.code.trim())
    throw new Error(`${prefix}: code is required.`);
  if (
    !CHECK_ID.test(finding.code) ||
    (!finding.code.startsWith("custom.") &&
      !finding.code.startsWith(`${plugin.name}.`))
  )
    throw new Error(
      `${prefix}: code '${finding.code}' must start with 'custom.' or '${plugin.name}.'.`,
    );
  if (typeof finding.message !== "string" || !finding.message.trim())
    throw new Error(`${prefix}: message is required.`);
  if (typeof finding.remediation !== "string" || !finding.remediation.trim())
    throw new Error(`${prefix}: remediation is required.`);
  if (
    finding.severity !== undefined &&
    !SEVERITIES.has(String(finding.severity))
  )
    throw new Error(`${prefix}: severity must be error, warning, or info.`);
  for (const key of ["url", "file"] as const)
    if (finding[key] !== undefined && typeof finding[key] !== "string")
      throw new Error(`${prefix}: ${key} must be a string.`);
  if (
    finding.relatedUrls !== undefined &&
    (!Array.isArray(finding.relatedUrls) ||
      !finding.relatedUrls.every((item) => typeof item === "string"))
  )
    throw new Error(`${prefix}: relatedUrls must be an array of strings.`);
  return Object.freeze(finding as unknown as PluginFinding);
}
