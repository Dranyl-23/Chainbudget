"use client";

import React, { useState } from "react";
import { Building, Camera, Upload, Save, Check, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { BACKEND_URL } from "@/lib/config";
import { getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

function formatOrgLogo(logoUrl?: string | null): string | null {
  if (!logoUrl || typeof logoUrl !== "string") return null;
  const trimmed = logoUrl.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("ipfs://")) {
    return trimmed.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
  }
  const backendBase = BACKEND_URL || "https://chainbudget-api.fly.dev";
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${backendBase}${path}`;
}

interface UploadResponse {
  documentUrl?: string;
}

interface OrganizationDetails {
  _id?: string;
  name?: string;
  type?: string;
  logoUrl?: string;
}

interface EmblemRebrandSectionProps {
  orgId: string | null;
  orgDetails: OrganizationDetails | null;
  badgeLabel?: string;
  onSuccess?: (newLogoUrl: string) => void;
}

export default function EmblemRebrandSection({
  orgId,
  orgDetails,
  badgeLabel = "Officer Tool",
  onSuccess,
}: EmblemRebrandSectionProps) {
  const { refreshUser } = useAuth();
  const [orgLogoFile, setOrgLogoFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [isUploadingOrgLogo, setIsUploadingOrgLogo] = useState(false);
  const [showEmblemSuccessModal, setShowEmblemSuccessModal] = useState(false);
  const [uploadedEmblemUrl, setUploadedEmblemUrl] = useState<string | null>(null);
  const [hasImgError, setHasImgError] = useState(false);

  const orgLogoPreview = selectedPreview || formatOrgLogo(orgDetails?.logoUrl);

  const handleOrgLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Emblem image must be under 5MB");
        return;
      }
      setOrgLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRebrandOrgLogo = async () => {
    if (!orgId) {
      toast.error("No active organization selected.");
      return;
    }
    if (!orgLogoFile && !orgLogoPreview) {
      toast.error("Please choose a new emblem image.");
      return;
    }

    try {
      setIsUploadingOrgLogo(true);
      let newLogoUrl = orgLogoPreview;

      if (orgLogoFile) {
        const formData = new FormData();
        formData.append("file", orgLogoFile);
        const uploadRes = await api.post<UploadResponse>("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (uploadRes.data?.documentUrl) {
          newLogoUrl = uploadRes.data.documentUrl;
        }
      }

      if (newLogoUrl) {
        await api.patch(`/organizations/${orgId}`, {
          logoUrl: newLogoUrl,
        });

        const formatted = formatOrgLogo(newLogoUrl);
        setUploadedEmblemUrl(formatted);
        setOrgLogoFile(null);
        setSelectedPreview(null);
        setShowEmblemSuccessModal(true);
        if (onSuccess) onSuccess(newLogoUrl);
        await refreshUser();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update organization emblem"));
    } finally {
      setIsUploadingOrgLogo(false);
    }
  };

  return (
    <>
      <div className="glass p-6 rounded-2xl border border-purple-500/20 w-full shadow-[0_0_30px_rgba(168,85,247,0.08)] relative overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-purple-500/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <Building className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
                Organization Branding & Emblem
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Rebrand or update your custom organization logo across Web, Mobile & Public Ledger.
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400">
            {badgeLabel}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
          <div className="relative group shrink-0">
            <div className="w-24 h-24 rounded-2xl bg-white/5 border-2 border-dashed border-purple-500/40 p-1.5 flex items-center justify-center overflow-hidden shadow-inner">
              {orgLogoPreview && !hasImgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={orgLogoPreview}
                  alt="Org Emblem"
                  className="w-full h-full object-cover rounded-xl"
                  onError={() => setHasImgError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-purple-400">
                  <Building className="w-8 h-8 opacity-60 mb-1" />
                  <span className="text-[10px] text-white/40 font-bold">No Emblem</span>
                </div>
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 p-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-lg transition-all hover:scale-105 border border-purple-400/50">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleOrgLogoFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex-1 w-full space-y-3 text-center sm:text-left">
            <div>
              <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                {orgDetails?.name || "Organization"}
                <span className="text-[11px] font-normal text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  {orgDetails?.type ? orgDetails.type.replace("_", " ") : "DAO"}
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Upload a high-resolution square image (PNG, JPG, WebP) to establish your organization&apos;s Web3 emblem and on-chain identity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 justify-center sm:justify-start">
              <label className="btn-secondary py-2 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Choose New File
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleOrgLogoFileChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleRebrandOrgLogo}
                disabled={isUploadingOrgLogo || !orgLogoFile}
                className="btn-primary py-2 px-5 text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] disabled:opacity-50"
              >
                {isUploadingOrgLogo ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Update Emblem</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Custom Emblem Celebration Modal ── */}
      {showEmblemSuccessModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="relative bg-[#13121d] border border-purple-500/40 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.3)] w-full max-w-sm p-6 text-center animate-modal-pop">
            <div className="relative mx-auto w-24 h-24 mb-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 animate-ping opacity-60" />
              <div className="relative w-20 h-20 rounded-2xl bg-white/5 border-2 border-emerald-400 overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                {uploadedEmblemUrl || orgLogoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={uploadedEmblemUrl || orgLogoPreview || ""}
                    alt="Rebranded Emblem"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building className="w-10 h-10 text-emerald-400" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-[#13121d] shadow-md">
                <Check className="w-4 h-4 stroke-3" />
              </div>
            </div>

            <h3 className="text-xl font-black text-white tracking-tight mb-1">
              Emblem Rebranded!
            </h3>

            <div className="inline-block bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-full mb-3">
              <span className="text-xs font-bold text-purple-300">
                {orgDetails?.name || "Organization"}
              </span>
            </div>

            <p className="text-xs text-white/60 leading-relaxed mb-6 px-2">
              Your new organization logo and custom emblem have been published to IPFS and synchronized across the Public Ledger, Group Chats, and Member Dashboards.
            </p>

            <button
              type="button"
              onClick={() => setShowEmblemSuccessModal(false)}
              className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Done & Synchronized
            </button>
          </div>
        </div>
      )}
    </>
  );
}
