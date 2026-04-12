"use client";

import { initAsync, destroy } from "@agentictrust/ui";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_AT_API_URL || "https://platform.agentictrust.com/api/v1";
const API_KEY = process.env.NEXT_PUBLIC_AT_API_KEY || "";

interface UserIdentity {
  id: string;
  email: string;
  name: string;
  hmac: string;
}

export default function SupportWidget() {
  const router = useRouter();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !API_KEY) return;
    initializedRef.current = true;

    const navigateFn = (path: string) => router.push(path);

    fetch("/api/identity")
      .then((r) => r.json())
      .then(async (user: UserIdentity) => {
        await initAsync({
          apiUrl: API_URL,
          apiKey: API_KEY,
          navigate: navigateFn,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            hmac: user.hmac,
          },
          getPageContext: () => ({
            title: document.title,
            url: window.location.href,
          }),
        });
      })
      .catch(async () => {
        await initAsync({
          apiUrl: API_URL,
          apiKey: API_KEY,
          navigate: navigateFn,
          getPageContext: () => ({
            title: document.title,
            url: window.location.href,
          }),
        });
      });

    return () => {
      destroy();
      initializedRef.current = false;
    };
  }, [router]);

  return null;
}
