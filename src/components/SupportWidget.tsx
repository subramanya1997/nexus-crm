"use client";

import { initAsync, destroy } from "@agentictrust/ui";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { describeCurrentPage, registerClientSideTools } from "@/lib/client-tools";

const API_URL = process.env.NEXT_PUBLIC_AT_API_URL || "https://platform.agentictrust.com/api/v1";
const API_KEY = process.env.NEXT_PUBLIC_AT_API_KEY || "";

export default function SupportWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const initializedRef = useRef(false);

  pathnameRef.current = pathname;

  useEffect(() => {
    if (initializedRef.current || !API_KEY) return;
    initializedRef.current = true;

    const navigateFn = (path: string) => router.push(path);

    initAsync({
      apiUrl: API_URL,
      apiKey: API_KEY,
      navigate: navigateFn,
      captureDom: true,
      getPageContext: () => ({
        title: document.title,
        url: window.location.href,
        description: describeCurrentPage(pathnameRef.current),
      }),
    });

    registerClientSideTools(navigateFn);

    return () => {
      destroy();
      initializedRef.current = false;
    };
  }, [router]);

  return null;
}
