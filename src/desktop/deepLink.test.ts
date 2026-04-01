import { describe, expect, it } from "vitest";
import { parseDeepLinkUrl } from "./deepLink";

describe("parseDeepLinkUrl", () => {
  it("maps known deep links to routes", () => {
    expect(parseDeepLinkUrl("cove://chat")?.route).toBe("/chat");
    expect(parseDeepLinkUrl("cove://agents")?.route).toBe("/agents");
    expect(parseDeepLinkUrl("cove://open-webui")?.route).toBe("/open-webui");
  });

  it("returns null for unknown links", () => {
    expect(parseDeepLinkUrl("cove://unknown")).toBeNull();
  });
});

