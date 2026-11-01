"use client";

import React, { useState } from "react";
import { Building, Camera, Upload, Save, Check, CheckCircle2 } from "lucide-react";
import Portal from "@/components/Portal";
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
      <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-xs w-full relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Organization Branding &amp; Emblem
              </h2>
              <p className="text-[11px] text-zinc-400">
                Rebrand or update your custom organization logo across Web, Mobile &amp; Public Ledger.
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
            {badgeLabel}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-xl bg-zinc-900 border border-dashed border-zinc-700 p-1 flex items-center justify-center overflow-hidden">
              {orgLogoPreview && !hasImgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={orgLogoPreview}
                  alt="Org Emblem"
                  className="w-full h-full object-cover rounded-lg"
                  onError={() => setHasImgError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-500">
                  <Building className="w-6 h-6 opacity-60 mb-0.5" />
                  <span className="text-[10px] text-zinc-500 font-medium">No Emblem</span>
                </div>
              )}
            </div>
            <label className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-full bg-white text-zinc-950 cursor-pointer shadow-sm transition-transform hover:scale-105 border border-zinc-300">
              <Camera className="w-3.5 h-3.5" />
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleOrgLogoFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center justify-center sm:justify-start gap-2">
                {orgDetails?.name || "Organization"}
                <span className="text-[10px] font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                  {orgDetails?.type ? orgDetails.type.replace("_", " ") : "DAO"}
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Upload a high-resolution square image (PNG, JPG, WebP) to establish your organization&apos;s Web3 emblem and on-chain identity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1 justify-center sm:justify-start">
              <label className="px-3.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
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
                className="btn-primary py-1.5 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isUploadingOrgLogo ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
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
        <Portal>
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowEmblemSuccessModal(false);
            }}
            className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
          >
            <div className="relative bg-[#121215] border border-zinc-800 rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5 text-center animate-modal-pop my-auto">
              <div className="relative mx-auto w-20 h-20 mb-4 flex items-center justify-center">
                <div className="relative w-18 h-18 rounded-xl bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center shadow-xs">
                  {uploadedEmblemUrl || orgLogoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uploadedEmblemUrl || orgLogoPreview || ""}
                      alt="Rebranded Emblem"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building className="w-8 h-8 text-zinc-400" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-[#121215] shadow-xs">
                  <Check className="w-3.5 h-3.5" />
                </div>
              </div>

              <h3 className="text-base font-bold text-white tracking-tight mb-1">
                Emblem Rebranded
              </h3>

              <div className="inline-block bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 rounded-full mb-2.5">
                <span className="text-xs font-medium text-zinc-300">
                  {orgDetails?.name || "Organization"}
                </span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed mb-5 px-1">
                Your new organization logo and custom emblem have been published to IPFS and synchronized across the Public Ledger, Group Chats, and Member Dashboards.
              </p>

              <button
                type="button"
                onClick={() => setShowEmblemSuccessModal(false)}
                className="btn-primary w-full py-2.5 px-4 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Done &amp; Synchronized
              </button>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
