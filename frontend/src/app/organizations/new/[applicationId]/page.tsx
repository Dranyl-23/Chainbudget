"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrgRegistration } from "@/context/OrgRegistrationContext";
import { isEditableStatus } from "@/lib/orgApplications";

export default function OrgApplicationIndexRedirect() {
  const { application, loading } = useOrgRegistration();
  const router = useRouter();

  useEffect(() => {
    if (!loading && application) {
      if (isEditableStatus(application.status)) {
        const step = application.currentStep || "details";
        router.replace(`/organizations/new/${application.id}/${step}`);
      } else {
        router.replace(`/organizations/new/${application.id}/status`);
      }
    }
  }, [loading, application, router]);

  return null;
}
