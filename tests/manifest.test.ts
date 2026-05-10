import manifest from "@/manifest";

const WEBPILOT_EXTENSION_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2MMIurte87Qyc3+fgE14sZvVNdY7Y/olNx0+9P5av+/KaVbtRjgsAWB7hEdJhvX0qjAPi083fknAmZ/kMjTWVGhjWgl+XVxWH19PANwk7gbPw0qxYQsEi8p9iFJteirmszxPootNYsFnSCdgTebk9O7j2E1mNDCcR9+vt6rOMTZXBgjNy8tmAtHeWG5m8XD+EZSvx7sxh4bXNIhKMcpUnnx8j6+BHiuJyAkKsgTHkZ8pDAapwRYX+FpMzSLap5ugeiGCFiA3RWOTFG0LdbjJ1tuIczu3EJ3diGOgQtt5nZmZJvCkcA60l4qShDiJhWTFHHi2VsROY51eJLecQsffFQIDAQAB";

describe("manifest", () => {
  it("includes a fixed extension key so unpacked builds keep the same id", () => {
    expect((manifest as { key?: string }).key).toBe(WEBPILOT_EXTENSION_KEY);
  });
});
