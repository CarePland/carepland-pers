import Link from "next/link";

import { FamilyShell } from "../components/family/shell/FamilyShell";
import { ErrandsWorkspace } from "../components/family/errands/ErrandsWorkspace";
import { panelClass } from "../components/shared/uiStyles";

const metrics = [
  {
    label: "Errands",
    value: "Things to do",
    href: "/family/errands",
    prompt: "What do I need to do?",
  },
  {
    label: "Concerns",
    value: "Things to know",
    href: "/family/concerns",
    prompt: "What am I worried about?",
  },
  {
    label: "Essentials",
    value: "Things to maintain",
    href: "/family/essentials",
    prompt: "What cannot run out or break?",
  },
];

export default function FamilyHomePage() {
  return (
    <FamilyShell
      title="Family coordination"
      subtitle="A calm operational view of what needs to happen, who owns it, and what may need attention."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <Link key={metric.label} className={panelClass} href={metric.href}>
            <p className="text-sm font-semibold text-blue-700">
              {metric.label}
            </p>
            <p className="mt-2 text-xl font-semibold text-blue-950">
              {metric.value}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {metric.prompt}
            </p>
          </Link>
        ))}
      </section>
      <ErrandsWorkspace />
    </FamilyShell>
  );
}
