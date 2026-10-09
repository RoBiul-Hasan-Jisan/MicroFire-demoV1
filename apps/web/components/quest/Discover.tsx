"use client";

import { useEffect } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";

/** Lights a discovery when its page is reached (for pages a quest sends you to). */
export function Discover({ id }: { id: string }) {
  const { discover } = useExplorer();
  useEffect(() => discover(id), [discover, id]);
  return null;
}
