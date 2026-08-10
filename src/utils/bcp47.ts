export const SUBTAG_TABLE_REVISION = "2026-08-10";

function chunk(value: string, size: number): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    out.push(value.slice(i, i + size));
  }
  return out;
}

const ISO_639_1_PACKED =
  "aaabaeafakamanarasavayazbabebgbibmbnbobrbscacechcocrcscucvcydadedvdzeeeleneoeseteufafffifjfofrfygagdglgngugvhahehihohrhthuhyhziaidieigiiikioisitiujajvkakgkikjkkklkmknkokrkskukvkwkylalblglilnloltlulvmgmhmimkmlmnmrmsmtmynanbndnengnlnnnonrnvnyocojomorospapiplpsptqurmrnrorurwsascsdsesgsiskslsmsnsosqsrssstsusvswtatetgthtitktltntotrtstttwtyugukuruzvevivowawoxhyiyozazhzu";

const ISO_3166_1_ALPHA2_PACKED =
  "ADAEAFAGAIALAMAOAQARASATAUAWAXAZBABBBDBEBFBGBHBIBJBLBMBNBOBQBRBSBTBVBWBYBZCACCCDCFCGCHCICKCLCMCNCOCRCUCVCWCXCYCZDEDJDKDMDODZECEEEGEHERESETFIFJFKFMFOFRGAGBGDGEGFGGGHGIGLGMGNGPGQGRGSGTGUGWGYHKHMHNHRHTHUIDIEILIMINIOIQIRISITJEJMJOJPKEKGKHKIKMKNKPKRKWKYKZLALBLCLILKLRLSLTLULVLYMAMCMDMEMFMGMHMKMLMMMNMOMPMQMRMSMTMUMVMWMXMYMZNANCNENFNGNINLNONPNRNUNZOMPAPEPFPGPHPKPLPMPNPRPSPTPWPYQARERORSRURWSASBSCSDSESGSHSISJSKSLSMSNSOSRSSSTSVSXSYSZTCTDTFTGTHTJTKTLTMTNTOTRTTTVTWTZUAUGUMUSUYUZVAVCVEVGVIVNVUWFWSYEYTZAZMZW";

const UN_M49_REGIONS_PACKED =
  "001002005009010011013014015017018019021029030034035039053054057061142143145150151154155202419";

export const ISO_639_1: ReadonlySet<string> = new Set(
  chunk(ISO_639_1_PACKED, 2),
);
export const ISO_3166_1_ALPHA2: ReadonlySet<string> = new Set(
  chunk(ISO_3166_1_ALPHA2_PACKED, 2),
);
export const UN_M49_REGIONS: ReadonlySet<string> = new Set(
  chunk(UN_M49_REGIONS_PACKED, 3),
);

export function isKnownLanguage(code: string): boolean {
  return ISO_639_1.has(code.toLowerCase());
}

export function isKnownRegion(code: string): boolean {
  return ISO_3166_1_ALPHA2.has(code.toUpperCase()) || UN_M49_REGIONS.has(code);
}

export interface ParsedHreflang {
  readonly raw: string;
  readonly kind: "x-default" | "tag" | "malformed";
  readonly language?: string;
  readonly script?: string;
  readonly region?: string;
}

const LANGUAGE_RE = /^[A-Za-z]{2,3}$/;
const SCRIPT_RE = /^[A-Za-z]{4}$/;
const REGION_RE = /^(?:[A-Za-z]{2}|[0-9]{3})$/;

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function toRegionCase(value: string): string {
  return /^[0-9]{3}$/.test(value) ? value : value.toUpperCase();
}

export function parseHreflang(value: string): ParsedHreflang {
  if (value.toLowerCase() === "x-default") {
    return { raw: value, kind: "x-default" };
  }
  const parts = value.split("-");
  if (parts.length < 1 || parts.length > 3) {
    return { raw: value, kind: "malformed" };
  }
  const languagePart = parts[0];
  if (!languagePart || !LANGUAGE_RE.test(languagePart)) {
    return { raw: value, kind: "malformed" };
  }
  const language = languagePart.toLowerCase();
  if (parts.length === 1) {
    return { raw: value, kind: "tag", language };
  }
  const secondPart = parts[1];
  if (parts.length === 2) {
    if (secondPart && SCRIPT_RE.test(secondPart)) {
      return {
        raw: value,
        kind: "tag",
        language,
        script: toTitleCase(secondPart),
      };
    }
    if (secondPart && REGION_RE.test(secondPart)) {
      return {
        raw: value,
        kind: "tag",
        language,
        region: toRegionCase(secondPart),
      };
    }
    return { raw: value, kind: "malformed" };
  }
  const thirdPart = parts[2];
  if (
    secondPart &&
    SCRIPT_RE.test(secondPart) &&
    thirdPart &&
    REGION_RE.test(thirdPart)
  ) {
    return {
      raw: value,
      kind: "tag",
      language,
      script: toTitleCase(secondPart),
      region: toRegionCase(thirdPart),
    };
  }
  return { raw: value, kind: "malformed" };
}
