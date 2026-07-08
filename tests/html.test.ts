import { describe, expect, it } from "vitest";
import {
  normalizedText,
  textFromSelection,
  visibleText,
} from "../src/utils/html.js";

describe("HTML text extraction", () => {
  it("handles deeply nested DOM without recursive textContent", () => {
    let node: unknown = { type: "text", data: "Deep text" };
    for (let index = 0; index < 15_000; index += 1)
      node = { type: "tag", children: [node] };

    expect(normalizedText(textFromSelection({ toArray: () => [node] }))).toBe(
      "Deep text",
    );
    expect(
      visibleText("<body>Visible <script>hidden</script>text</body>"),
    ).toBe("Visible text");
  });
});
