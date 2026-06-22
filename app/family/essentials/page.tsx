import { FamilyShell } from "../../components/family/shell/FamilyShell";
import { panelClass } from "../../components/shared/uiStyles";

export default function FamilyEssentialsPage() {
  return (
    <FamilyShell
      title="Essentials"
      subtitle="Things to maintain. The supplies, household systems, and basics that cannot run out or break unnoticed."
    >
      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-blue-950">
          Future workflow
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Essentials can later become low-friction checks, predictions, and
          errand prompts. For now this route exists as the home for the
          “cannot run out or break” category.
        </p>
      </section>
    </FamilyShell>
  );
}
