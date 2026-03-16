"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { describeCurrentPage, registerClientSideTools } from "@/lib/client-tools";

const API_URL = process.env.NEXT_PUBLIC_AT_API_URL || "https://platform.agentictrust.com/api/v1";
const API_KEY = process.env.NEXT_PUBLIC_AT_API_KEY || "";

export default function SupportWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !API_KEY) return;
    initializedRef.current = true;

    let cleanupFn: (() => void) | undefined;

    import("@agentictrust/ui").then(({ initAsync, destroy }) => {
      initAsync({
        apiUrl: API_URL,
        apiKey: API_KEY,
        navigate: (path: string) => router.push(path),
        captureDom: true,
        pageContext: {
          title: document.title,
          url: window.location.href,
          description: describeCurrentPage(pathname),
        },
      });

      setTimeout(() => {
        registerClientSideTools((path: string) => router.push(path));
      }, 500);

      cleanupFn = destroy;
    });

    return () => {
      cleanupFn?.();
      initializedRef.current = false;
    };
  }, [router, pathname]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.AgenticTrust) {
      window.AgenticTrust.setContext({
        title: document.title,
        url: window.location.href,
        description: describeCurrentPage(pathname),
      });
    }
  }, [pathname]);

  return null;
}
