"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronDown, Check, Plus, Building, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import Portal from "@/components/Portal";
import CustomSelect from "@/components/CustomSelect";

interface Organization {
  _id: string;
  name: string;
  type: string;
  logoUrl?: string;
}

interface CreateOrgFormData {
  name: string;
  type: string;
  highValueThreshold: number;
  isPrivate: boolean;
}

interface ApiErrorResponse {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
}

function formatOrgLogo(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("ipfs://")) {
    return trimmed.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
  }
  const backendBase = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "https://chainbudget-api.fly.dev";
  return `${backendBase}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function OrgLogoIcon({ 
  url, 
  name, 
  size = 28, 
  className = "" 
}: { 
  url?: string; 
  name?: string; 
  size?: number; 
  className?: string; 
}) {
  const [hasError, setHasError] = useState(false);
  const formatted = formatOrgLogo(url);

  if (!formatted || hasError) {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 ${className}`}
      >
        <Building className="text-zinc-400" style={{ width: Math.max(12, size * 0.5), height: Math.max(12, size * 0.5) }} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img 
      src={formatted} 
      alt={name || "Org Emblem"} 
      style={{ width: size, height: size }}
      className={`rounded-lg object-cover bg-zinc-900 border border-zinc-800 shrink-0 ${className}`}
      onError={() => setHasError(true)}
    />
  );
}

export default function OrgSelector() {
  const { activeOrgId, setActiveOrgId } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form states
  const [formData, setFormData] = useState<CreateOrgFormData>({
    name: "",
    type: "student_org",
    highValueThreshold: 10000,
    isPrivate: false,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadOrgs = async () => {
      try {
        const res = await api.get<Organization[]>("/organizations");
        if (!isCancelled) {
          const organizations = res.data || [];
          setOrgs(organizations);
          
          // If no active org but we have orgs, set the first one
          if (!activeOrgId && organizations.length > 0) {
            setActiveOrgId(organizations[0]._id);
          }
        }
      } catch (err: unknown) {
        console.error("Failed to fetch organizations:", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrgs();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId, setActiveOrgId]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeOrg = orgs.find((o) => o._id === activeOrgId);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      let uploadedLogoUrl: string | undefined = undefined;

      // If logo file is selected, upload it
      if (logoFile) {
        try {
          const uploadData = new FormData();
          uploadData.append("file", logoFile);
          const uploadRes = await api.post<{ documentUrl?: string }>("/upload", uploadData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          uploadedLogoUrl = uploadRes.data?.documentUrl;
        } catch {
          // If upload fails, use local Base64 data URL
          uploadedLogoUrl = logoPreview || undefined;
        }
      }

      const res = await api.post<Organization>("/organizations", {
        ...formData,
        logoUrl: uploadedLogoUrl || logoPreview || undefined,
      });

      const newOrg = res.data;
      setOrgs((prev) => [...prev, newOrg]);
      setActiveOrgId(newOrg._id);
      setModalOpen(false);
      setFormData({
        name: "",
        type: "student_org",
        highValueThreshold: 10000,
        isPrivate: false,
      });
      setLogoFile(null);
      setLogoPreview(null);
      setIsSubmitting(false);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setError(apiErr.response?.data?.error || apiErr.response?.data?.message || "Failed to create organization");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full select-none" ref={dropdownRef}>
      {/* Selector Button */}
      <div 
        className="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors bg-[#121215] border border-zinc-800 hover:border-zinc-700 select-none shadow-xs"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <OrgLogoIcon url={activeOrg?.logoUrl} name={activeOrg?.name} size={28} />
          <div className="overflow-hidden min-w-0">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold leading-none mb-1">Organization</p>
            <p className="text-xs font-bold text-white truncate">
              {loading ? "Loading..." : activeOrg ? activeOrg.name : "Select Organization"}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 w-full bg-[#121215] rounded-xl shadow-2xl border border-zinc-800 py-1.5 z-50 animate-fade-in">
          <div className="max-h-52 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
            {orgs.map((org) => {
              const isSelected = activeOrgId === org._id;
              return (
                <div 
                  key={org._id}
                  className={`px-2.5 py-2 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors gap-2 ${
                    isSelected
                      ? "bg-zinc-800 text-white font-semibold"
                      : "text-zinc-300 hover:text-white hover:bg-zinc-900"
                  }`}
                  onClick={() => {
                    setActiveOrgId(org._id);
                    setDropdownOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <OrgLogoIcon url={org.logoUrl} name={org.name} size={22} />
                    <span className="truncate">{org.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
              );
            })}
            {orgs.length === 0 && !loading && (
              <div className="px-3 py-2 text-xs text-zinc-500 italic">No organizations found</div>
            )}
          </div>
          <div className="border-t border-zinc-800/80 mt-1 pt-1 px-1">
            <button
              type="button"
              className="w-full px-2.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg cursor-pointer flex items-center gap-2 font-medium transition-colors whitespace-nowrap"
              onClick={() => {
                setModalOpen(true);
                setDropdownOpen(false);
              }}
            >
              <div className="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-zinc-400">
                <Plus className="w-3 h-3" />
              </div>
              <span className="truncate">Create New Organization</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modalOpen && (
        <Portal>
          <div className="fixed inset-0 z-100 flex items-center justify-center p-3 md:p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#121215] rounded-2xl p-5 md:p-6 w-full max-w-md shadow-2xl border border-zinc-800 animate-modal-pop">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4 text-zinc-300" />
                  </div>
                  <h2 className="text-base md:text-lg font-semibold text-white">New Organization</h2>
                </div>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-3 md:mb-4 p-2.5 bg-rose-500/10 text-rose-400 text-xs md:text-sm rounded-lg border border-rose-500/20">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Organization Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Computer Science Society"
                    className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Custom Emblem / Logo</label>
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <div className="relative w-11 h-11 rounded-lg border border-zinc-700 overflow-hidden shrink-0">
                        <Image 
                          src={logoPreview} 
                          alt="Emblem preview" 
                          width={44}
                          height={44}
                          unoptimized
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                          className="absolute top-0 right-0 bg-black/80 hover:bg-black text-white p-0.5 rounded-bl"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-zinc-900 border border-dashed border-zinc-750 flex items-center justify-center shrink-0 text-zinc-400">
                        <Building className="w-4 h-4" />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleLogoFileChange}
                      className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 file:transition-colors transition-colors cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Organization Type</label>
                  <CustomSelect
                    value={formData.type}
                    onChange={(val) => setFormData({ ...formData, type: val })}
                    options={[
                      { value: "student_org", label: "Student Organization" },
                      { value: "barangay", label: "Barangay Fund" },
                      { value: "homeowners_association", label: "Homeowners Association" },
                      { value: "ngo", label: "Non-Government Organization" },
                      { value: "cooperative", label: "Cooperative" },
                      { value: "church", label: "Church / Religious Group" },
                      { value: "sports_club", label: "Sports Club" },
                      { value: "startup", label: "Startup" },
                      { value: "family", label: "Family Fund" },
                      { value: "fundraising", label: "Fundraising Campaign" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">High-Value Threshold (₱)</label>
                  <p className="text-[11px] text-zinc-500 mb-2">Transactions above this amount require multi-sig approval.</p>
                  <input 
                    type="number" 
                    required
                    min="0"
                    className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors"
                    value={formData.highValueThreshold}
                    onChange={(e) => setFormData({...formData, highValueThreshold: Number(e.target.value)})}
                  />
                </div>

                <div className="flex flex-col gap-2 p-3.5 bg-zinc-900/60 rounded-lg border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-300">Private Organization</label>
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.isPrivate ? "bg-white" : "bg-zinc-700"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full ${formData.isPrivate ? "bg-zinc-950 translate-x-4.5" : "bg-zinc-300 translate-x-1"} transition-transform`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    If enabled, only members can view your ledger and DAO. Your organization will still be listed in the public directory.
                  </p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2 px-4 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 py-2 px-4 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? "Creating..." : "Create Organization"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
