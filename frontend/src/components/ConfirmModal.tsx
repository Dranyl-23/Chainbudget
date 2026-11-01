"use client";

import React from "react";
import Portal from "@/components/Portal";
import { AlertTriangle, Info, Trash2, X, CheckCircle2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary" | "success";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <Portal>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isLoading) onCancel();
        }}
      >
        <div className="relative bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
          {/* Close icon */}
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-850 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Badge */}
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-2xl mb-4">
            {variant === "danger" ? (
              <div className="w-full h-full rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
            ) : variant === "warning" ? (
              <div className="w-full h-full rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : variant === "success" ? (
              <div className="w-full h-full rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-full h-full rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <Info className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Title & Message */}
          <h3 className="text-base font-bold text-white tracking-tight mb-1.5">
            {title}
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6 px-1">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 py-2 px-3.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                variant === "danger"
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
                  : variant === "warning"
                  ? "bg-amber-600 hover:bg-amber-500 text-white shadow-xs"
                  : variant === "success"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                  : "bg-white hover:bg-zinc-200 text-zinc-950 font-semibold shadow-xs"
              }`}
            >
              {isLoading ? "Processing..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
