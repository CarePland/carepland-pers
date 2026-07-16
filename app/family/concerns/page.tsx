import { FamilyShell } from "../../components/family/shell/FamilyShell";
import { panelClass } from "../../components/shared/uiStyles";

const concerns = [
  {
    category: "Supply concern",
    summary: "Gloves may be running low in the downstairs bathroom.",
    byline: "Submitted by Jamie today",
  },
  {
    category: "Household concern",
    summary: "Kitchen trash needs to be taken out after dinner.",
    byline: "Submitted by Casey yesterday",
  },
];

export default function FamilyConcernsPage() {
  return (
    <FamilyShell
      title="Concerns"
      subtitle="Things to know. A reviewable place for observations, worries, and operational notes from the care team."
    >
      <div className="grid gap-3">
        {concerns.map((concern) => (
          <article key={concern.summary} className={panelClass}>
            <p className="text-sm font-semibold text-blue-700">
              {concern.category}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-blue-950">
              {concern.summary}
            </h2>
            <p className="mt-2 text-sm text-slate-500">{concern.byline}</p>
          </article>
        ))}
      </div>
    </FamilyShell>
  );
}
