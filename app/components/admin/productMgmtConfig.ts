export const productMgmtSections = [
  {
    description: "Regressions, confusing behavior, and things that should be verified as fixed.",
    key: "bug",
    label: "Bugs",
  },
  {
    description: "Must-have items before inviting Early Access users.",
    key: "beta",
    label: "Early Access Readiness",
  },
  {
    description: "A running note of visible changes, deployment notes, and known limitations.",
    key: "release",
    label: "Release Notes",
  },
  {
    description: "Useful ideas that should not interrupt the current beta path.",
    key: "wishlist",
    label: "Wishlist",
  },
  {
    description: "AI interpretation quality, prompt behavior, and review tooling.",
    key: "ai_qa",
    label: "AI / QA",
  },
  {
    description: "Maintenance tools, test data, error visibility, and support workflows.",
    key: "admin_ops",
    label: "Admin / Ops",
  },
] as const;
