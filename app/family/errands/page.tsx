import { ErrandsWorkspace } from "../../components/family/errands/ErrandsWorkspace";
import { FamilyShell } from "../../components/family/shell/FamilyShell";

export default function FamilyErrandsPage() {
  return (
    <FamilyShell
      title="Errands"
      subtitle="Things to do. Create practical responsibilities, clarify who owns them, and keep the follow-through visible."
    >
      <ErrandsWorkspace />
    </FamilyShell>
  );
}
