"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquare, ArrowUpRight, ArrowLeft } from "lucide-react";

export default function DashboardChatRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/chat");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-[#101014] border border-zinc-800 rounded-2xl select-none animate-fade-in">
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 mb-4 shadow-sm">
        <MessageSquare className="w-6 h-6 animate-pulse" />
      </div>
      <h2 className="text-base font-semibold text-white mb-1.5">Opening Fullscreen Studio Chat...</h2>
      <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
        Redirecting you to the standalone 100% fullscreen chat workspace.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <Link
          href="/chat"
          className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 flex items-center gap-1.5 rounded-lg transition shadow-sm"
        >
          <span>Open Fullscreen Now</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
