import type { SearchQualityConfig } from "../config/schema.js";
import type { FindingClassification, Severity } from "../report/types.js";

export type PluginCheckClassification = Extract<
  FindingClassification,
  | "google-requirement"
  | "google-recommendation"
  | "local-heuristic"
  | "profile-expectation"
>;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type PluginConfig = DeepReadonly<Omit<SearchQualityConfig, "plugins">>;

export interface PluginPageMetadata {
  readonly title?: string;
  readonly description?: string;
  readonly canonical?: string;
  readonly robots?: string;
  readonly language?: string;
  readonly openGraph: Readonly<Record<string, string>>;
}

export interface PluginPageLink {
  readonly href: string;
  readonly url?: string;
  readonly text: string;
  readonly rel: readonly string[];
}

export interface PluginPage {
  readonly url: string;
  readonly initialUrl: string;
  readonly finalUrl: string;
  readonly statusCode: number;
  readonly rawHtml: string;
  readonly visibleText: string;
  readonly metadata: PluginPageMetadata;
  readonly links: readonly PluginPageLink[];
  readonly structuredData: readonly unknown[];
  readonly file?: string;
}

export interface PluginCheckContext {
  readonly pages: readonly PluginPage[];
  readonly config: PluginConfig;
}

export interface PluginFinding {
  readonly code: string;
  readonly severity?: Severity;
  readonly url?: string;
  readonly file?: string;
  readonly message: string;
  readonly remediation: string;
  readonly relatedUrls?: readonly string[];
}

export interface PluginCheckDefinition {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly classification: PluginCheckClassification;
  readonly defaultSeverity: Severity;
  readonly docsUrl?: string;
  readonly run:
    | ((context: PluginCheckContext) => readonly PluginFinding[])
    | ((context: PluginCheckContext) => Promise<readonly PluginFinding[]>);
}

export interface PluginPolicyPackMetadata {
  readonly name: string;
  readonly optionsSummary: Readonly<Record<string, unknown>>;
}

export interface PluginDefinition {
  readonly name: string;
  readonly checks: readonly PluginCheckDefinition[];
  readonly policyPack?: PluginPolicyPackMetadata;
}

export interface PluginError {
  readonly plugin: string;
  readonly check: string;
  readonly message: string;
}
