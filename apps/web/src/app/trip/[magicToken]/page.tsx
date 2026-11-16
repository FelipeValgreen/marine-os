"use client";

import React from "react";
import { useParams } from "next/navigation";
import { DEMO_IDS } from "@/lib/offline/db";
import { VoyagesZarpeView } from "@/components/VoyagesZarpeView";

export default function MagicLinkTripPage() {
  const params = useParams<{ magicToken: string }>();
  const magicToken = params?.magicToken || DEMO_IDS.MAGIC_TOKEN;

  return <VoyagesZarpeView magicToken={magicToken} />;
}
