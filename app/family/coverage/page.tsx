import { FamilyShell } from "../../components/family/shell/FamilyShell";
import { panelClass } from "../../components/shared/uiStyles";

export default function FamilyCoveragePage() {
  return (
    <FamilyShell
      title="Coverage"
      subtitle="A future home for evidence that care is happening without turning the product into surveillance."
    >
      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-blue-950">
          Designed for later
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Coverage signals can eventually include SMS confirmations, care
          reports, inventory responses, arrival evidence, or other integrations.
          The MVP starts with task ownership before adding confidence scoring.
        </p>
      </section>
    </FamilyShell>
  );
}
