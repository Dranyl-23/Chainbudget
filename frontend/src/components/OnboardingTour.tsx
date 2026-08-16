"use client";

import { useEffect, useState } from "react";
import { Joyride, STATUS, Step, EventData } from "react-joyride";

const steps: Step[] = [
  {
    target: "body",
    content: "Welcome to ChainBudget! Let's take a quick tour of your new decentralized finance dashboard.",
    placement: "bottom",
  },
  {
    target: "#nav-transactions",
    content: "Here you can view all organizational spending and request new budgets.",
    placement: "right",
  },
  {
    target: "#nav-budget",
    content: "Monitor allocated budgets vs actual spend in real-time.",
    placement: "right",
  },
  {
    target: "#nav-approvals",
    content: "Authorized users (Multi-Sig) can approve high-value transactions here.",
    placement: "right",
  },
  {
    target: "#nav-dao-governance",
    content: "Vote on major organizational decisions transparently on-chain.",
    placement: "right",
  },
  {
    target: "#logout-btn",
    content: "Disconnect your Web3 Wallet when you're done.",
    placement: "right",
  },
];

export default function OnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const hasSeenTour = localStorage.getItem("cb_tour_completed");
      if (hasSeenTour !== "true") {
        // Mark as seen immediately so it doesn't show again on refresh/navigate
        localStorage.setItem("cb_tour_completed", "true");
        // Start tour after a short delay to let the dashboard render
        const timer = setTimeout(() => setRun(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {
      // Gracefully handle storage errors (e.g. private mode)
    }
  }, []);

  const handleJoyrideEvent = (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
    }
  };

  if (!run) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleJoyrideEvent}
    />
  );
}
