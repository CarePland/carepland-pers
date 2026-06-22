import { FamilyShell } from "../../components/family/shell/FamilyShell";
import { SmsSimulatorWorkspace } from "../../components/family/sms/SmsSimulatorWorkspace";

export default function SmsSimulatorPage() {
  return (
    <FamilyShell
      title="SMS simulator"
      subtitle="Test Care Family SMS workflows through the same centralized intake service that Twilio will use later."
    >
      <SmsSimulatorWorkspace />
    </FamilyShell>
  );
}
