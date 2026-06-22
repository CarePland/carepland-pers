import { ComponentProps } from "react";

import { ProfileAccountSummary } from "./ProfileAccountSummary";
import { ProfileContactDetailsForm } from "./ProfileContactDetailsForm";

type ProfilePageProps = {
  accountSummaryProps: ComponentProps<typeof ProfileAccountSummary>;
  contactDetailsProps: ComponentProps<typeof ProfileContactDetailsForm>;
  message?: string;
};

export function ProfilePage({
  accountSummaryProps,
  contactDetailsProps,
  message,
}: ProfilePageProps) {
  return (
    <div className="mt-6 space-y-5">
      <ProfileAccountSummary {...accountSummaryProps} />
      <ProfileContactDetailsForm {...contactDetailsProps} />
      {message ? (
        <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
