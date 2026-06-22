import { FamilyShell } from "../../components/family/shell/FamilyShell";
import { panelClass } from "../../components/shared/uiStyles";

const members = [
  { name: "Andrew", relationship: "Care Coordinator", lastActive: "Today" },
  { name: "Jamie", relationship: "Family member", lastActive: "Yesterday" },
  { name: "Taylor", relationship: "Neighbor", lastActive: "Last week" },
];

export default function FamilyMembersPage() {
  return (
    <FamilyShell
      title="Members"
      subtitle="People participating in practical care coordination. Access is intentionally simple for the MVP."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <article key={member.name} className={panelClass}>
            <h2 className="text-lg font-semibold text-blue-950">
              {member.name}
            </h2>
            <p className="mt-2 text-sm font-semibold text-blue-700">
              {member.relationship}
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Last active: {member.lastActive}
            </p>
          </article>
        ))}
      </div>
    </FamilyShell>
  );
}
