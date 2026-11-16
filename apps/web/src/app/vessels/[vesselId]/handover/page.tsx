"use client";

import React from "react";
import { useParams } from "next/navigation";
import { DEMO_IDS } from "@/lib/offline/db";
import { HandoverWizard } from "@/components/HandoverWizard";

export default function VesselHandoverPage() {
  const params = useParams<{ vesselId: string }>();
  const vesselId = params?.vesselId || DEMO_IDS.VESSEL_ID;

  return <HandoverWizard vesselId={vesselId} />;
}
