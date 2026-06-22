import { Dispatch, FormEvent, SetStateAction } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

export type ProfileCareSubject = {
  care_circle_id: string;
  display_name: string;
  id: string;
  is_active: boolean;
  is_default: boolean;
  subject_type: string;
};

export type PendingReactivateCareVip = {
  displayName: string;
  id: string;
};

type AppointmentView = "archived" | "logged" | "upcoming";

type CareCircleContext = {
  careCircleId: string;
};

type CareVipActionsConfig = {
  allSubjectsValue: string;
  appointmentView: AppointmentView;
  canAddCareVip: boolean;
  careSubjects: ProfileCareSubject[];
  entitlement: {
    max_active_subjects: number;
    plan_name: string;
  };
  getErrorMessage: (error: unknown) => string;
  getPrimaryCareContext: () => Promise<CareCircleContext>;
  isLikelyEmail: (value: string) => boolean;
  loadAppointments: (
    view?: AppointmentView,
    subjectId?: string
  ) => Promise<void>;
  newCareVipName: string;
  pendingReactivateCareVip: PendingReactivateCareVip | null;
  setCareVipFormMessage: (value: string) => void;
  setCreatingCareVip: (value: boolean) => void;
  setDeactivatingCareVipId: (value: string | null) => void;
  setManagingCareVips: (value: boolean) => void;
  setMessage: (value: string) => void;
  setNewAppointmentSubjectId: Dispatch<SetStateAction<string>>;
  setNewCareVipName: (value: string) => void;
  setPendingDeactivateCareVipId: (value: string | null) => void;
  setPendingReactivateCareVip: (
    value: PendingReactivateCareVip | null
  ) => void;
  setSelectedSubjectId: Dispatch<SetStateAction<string>>;
  supabase: SupabaseClient;
};

export function createCareVipActions({
  allSubjectsValue,
  appointmentView,
  canAddCareVip,
  careSubjects,
  entitlement,
  getErrorMessage,
  getPrimaryCareContext,
  isLikelyEmail,
  loadAppointments,
  newCareVipName,
  pendingReactivateCareVip,
  setCareVipFormMessage,
  setCreatingCareVip,
  setDeactivatingCareVipId,
  setManagingCareVips,
  setMessage,
  setNewAppointmentSubjectId,
  setNewCareVipName,
  setPendingDeactivateCareVipId,
  setPendingReactivateCareVip,
  setSelectedSubjectId,
  supabase,
}: CareVipActionsConfig) {
  async function createCareVip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingCareVip(true);
    setMessage("");
    setCareVipFormMessage("");

    try {
      const displayName = newCareVipName.trim();

      if (!displayName) {
        throw new Error("Please enter a Care VIP name.");
      }

      const normalizedDisplayName = displayName.toLowerCase();
      const isEmailEntry = isLikelyEmail(displayName);
      const activeMatch = isEmailEntry
        ? careSubjects.find(
            (subject) =>
              subject.display_name.trim().toLowerCase() ===
              normalizedDisplayName
          )
        : null;

      if (activeMatch) {
        setCareVipFormMessage(
          "Sorry, that email is already in use. Please enter a different email."
        );
        setPendingReactivateCareVip(null);
        return;
      }

      if (!canAddCareVip) {
        throw new Error(
          `${entitlement.plan_name} allows ${entitlement.max_active_subjects} active Care VIP.`
        );
      }

      const { careCircleId } = await getPrimaryCareContext();
      const { data: inactiveMatches, error: inactiveMatchesError } =
        await supabase
          .from("care_subjects")
          .select("id,display_name")
          .eq("care_circle_id", careCircleId)
          .eq("is_active", false);

      if (inactiveMatchesError) {
        throw inactiveMatchesError;
      }

      const inactiveMatch = isEmailEntry
        ? inactiveMatches?.find(
            (subject) =>
              subject.display_name.trim().toLowerCase() ===
              normalizedDisplayName
          )
        : null;

      if (inactiveMatch) {
        setCareVipFormMessage("");
        setPendingReactivateCareVip({
          displayName: inactiveMatch.display_name,
          id: inactiveMatch.id,
        });
        setCreatingCareVip(false);
        return;
      }

      const isFirstCareVip = careSubjects.length === 0;

      const { data: newSubject, error } = await supabase
        .from("care_subjects")
        .insert({
          care_circle_id: careCircleId,
          display_name: displayName,
          is_active: true,
          is_default: isFirstCareVip,
          subject_type: "other",
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      setNewCareVipName("");
      setCareVipFormMessage("");
      setPendingReactivateCareVip(null);
      setSelectedSubjectId(newSubject.id);
      setNewAppointmentSubjectId(newSubject.id);
      setManagingCareVips(false);
      await loadAppointments(appointmentView, newSubject.id);
      setMessage("Care VIP added.");
    } catch (error) {
      setCareVipFormMessage(getErrorMessage(error));
    } finally {
      setCreatingCareVip(false);
    }
  }

  async function reactivateCareVip() {
    if (!pendingReactivateCareVip) {
      return;
    }

    setCreatingCareVip(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("care_subjects")
        .update({ is_active: true })
        .eq("id", pendingReactivateCareVip.id);

      if (error) {
        throw error;
      }

      const reactivatedId = pendingReactivateCareVip.id;
      setPendingReactivateCareVip(null);
      setCareVipFormMessage("");
      setNewCareVipName("");
      setSelectedSubjectId(reactivatedId);
      setNewAppointmentSubjectId(reactivatedId);
      await loadAppointments(appointmentView, reactivatedId);
      setMessage("Care VIP reactivated.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setCreatingCareVip(false);
    }
  }

  async function deactivateCareVip(subject: ProfileCareSubject) {
    if (subject.is_default) {
      return;
    }

    setDeactivatingCareVipId(subject.id);
    setMessage("");

    try {
      const { error } = await supabase
        .from("care_subjects")
        .update({ is_active: false })
        .eq("id", subject.id)
        .eq("is_default", false);

      if (error) {
        throw error;
      }

      setPendingDeactivateCareVipId(null);
      setPendingReactivateCareVip(null);
      setSelectedSubjectId((currentSubjectId) =>
        currentSubjectId === subject.id ? allSubjectsValue : currentSubjectId
      );
      setNewAppointmentSubjectId((currentSubjectId) =>
        currentSubjectId === subject.id ? "" : currentSubjectId
      );
      await loadAppointments(appointmentView, allSubjectsValue);
      setMessage("Care VIP deactivated.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeactivatingCareVipId(null);
    }
  }

  return {
    createCareVip,
    deactivateCareVip,
    reactivateCareVip,
  };
}
