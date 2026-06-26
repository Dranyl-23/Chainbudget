"use client";

import { useEffect, useState } from "react";
import { Joyride, STATUS, Step } from "react-joyride";

export default function OnboardingTour() {
  const [run, setRun] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const hasSeenTour = localStorage.getItem("cb_tour_completed");
      if (hasSeenTour !== "true") {
        // Mark as seen immediately so it doesn't show again on refresh/navigate
        localStorage.setItem("cb_tour_completed", "true");
        // Start tour after a short delay to let the dashboard render
        const timer = setTimeout(() => setRun(true), 1500);
        return () => clearTimeout(timer); // Cleanup timeout!
      }
    }
  }, []);

  if (!mounted || !run) return null;

  const steps = [
    {
      target: "body",
      content: "Welcome to ChainBudget! Let's take a quick tour of your new decentralized finance dashboard.",
      placement: "center" as const,
      disableBeacon: true,
    },
    {
      target: "#nav-transactions",
      content: "Here you can view all organizational spending and request new budgets.",
      placement: "right" as const,
    },
    {
      target: "#nav-budget",
      content: "Monitor allocated budgets vs actual spend in real-time.",
      placement: "right" as const,
    },
    {
      target: "#nav-approvals",
      content: "Authorized users (Multi-Sig) can approve high-value transactions here.",
      placement: "right" as const,
    },
    {
      target: "#nav-dao-governance",
      content: "Vote on major organizational decisions transparently on-chain.",
      placement: "right" as const,
    },
    {
      target: "#logout-btn",
      content: "Disconnect your Web3 Wallet when you're done.",
      placement: "right" as const,
    }
  ];

  // Component logic simplified

  return (
    <Joyride
      steps={steps as any}
      run={run}
      continuous
      scrollToFirstStep
    />
  );
}
