"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronDown, Check, Plus, Building, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import Portal from "@/components/Portal";

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

function formatOrgLogo(url?: string) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const backendBase = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "https://chainbudget-api.fly.dev";
  return `${backendBase}${url.startsWith("/") ? "" : "/"}${url}`;
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
        className={`rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 ${className}`}
      >
        <Building className="text-purple-400" style={{ width: Math.max(12, size * 0.5), height: Math.max(12, size * 0.5) }} />
      </div>
    );
  }

  return (
    <Image 
      src={formatted} 
      alt={name || "Org Emblem"} 
      width={size}
      height={size}
      unoptimized
      className={`rounded-lg object-cover bg-white/5 border border-purple-500/30 shrink-0 ${className}`}
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
    <div className="px-3 mb-6 relative" ref={dropdownRef}>
      {/* Selector Button */}
      <div 
        className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors sidebar-card select-none hover:bg-white/5"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <OrgLogoIcon url={activeOrg?.logoUrl} name={activeOrg?.name} size={28} />
          <div className="overflow-hidden">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Organization</p>
            <p className="text-sm font-bold text-gray-100 truncate">
              {loading ? "Loading..." : activeOrg ? activeOrg.name : "Select Organization"}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute top-full left-3 right-3 mt-1 bg-[#160B2E] rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-purple-500/30 py-1 z-50 animate-fade-in">
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {orgs.map((org) => (
              <div 
                key={org._id}
                className="px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer flex items-center justify-between transition-colors gap-2"
                onClick={() => {
                  setActiveOrgId(org._id);
                  setDropdownOpen(false);
                }}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <OrgLogoIcon url={org.logoUrl} name={org.name} size={20} />
                  <span className="truncate">{org.name}</span>
                </div>
                {activeOrgId === org._id && <Check className="w-4 h-4 text-cyan-400 shrink-0 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />}
              </div>
            ))}
            {orgs.length === 0 && !loading && (
              <div className="px-3 py-2 text-sm text-gray-500 italic">No organizations found</div>
            )}
          </div>
          <div className="border-t border-white/10 mt-1 pt-1">
            <div 
              className="px-3 py-2 text-sm text-fuchsia-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10 cursor-pointer flex items-center gap-2 font-medium transition-colors"
              onClick={() => {
                setModalOpen(true);
                setDropdownOpen(false);
              }}
            >
              <Plus className="w-4 h-4" /> Create New Organization
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modalOpen && (
        <Portal>
          <div className="fixed inset-0 z-100 flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-md">
            <div className="glass rounded-xl md:rounded-2xl p-5 md:p-6 w-full max-w-md shadow-[0_0_40px_rgba(139,92,246,0.15)] border border-purple-500/20 animate-modal-pop">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-white drop-shadow-sm">New Organization</h2>
                </div>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-3 md:mb-4 p-2 md:p-3 bg-red-500/10 text-red-400 text-xs md:text-sm rounded-lg border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div>
                  <label className="block text-xs md:text-sm font-bold text-white/80 uppercase tracking-widest mb-1.5">Organization Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Computer Science Society"
                    className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-inner"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-bold text-white/80 uppercase tracking-widest mb-1.5">Custom Emblem / Logo</label>
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <div className="relative w-12 h-12 rounded-xl border border-purple-500/50 overflow-hidden shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                        <Image 
                          src={logoPreview} 
                          alt="Emblem preview" 
                          width={48}
                          height={48}
                          unoptimized
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                          className="absolute top-0 right-0 bg-red-500/80 hover:bg-red-500 text-white p-0.5 rounded-bl-lg"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-dashed border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400">
                        <Building className="w-5 h-5" />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleLogoFileChange}
                      className="flex-1 px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-xs text-white/60 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 file:transition-colors transition-all shadow-inner cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-bold text-white/80 uppercase tracking-widest mb-1.5">Organization Type</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-inner appearance-none"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="student_org" className="bg-gray-900">Student Organization</option>
                    <option value="barangay" className="bg-gray-900">Barangay Fund</option>
                    <option value="homeowners_association" className="bg-gray-900">Homeowners Association</option>
                    <option value="ngo" className="bg-gray-900">Non-Government Organization</option>
                    <option value="cooperative" className="bg-gray-900">Cooperative</option>
                    <option value="church" className="bg-gray-900">Church / Religious Group</option>
                    <option value="sports_club" className="bg-gray-900">Sports Club</option>
                    <option value="startup" className="bg-gray-900">Startup</option>
                    <option value="family" className="bg-gray-900">Family Fund</option>
                    <option value="fundraising" className="bg-gray-900">Fundraising Campaign</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-bold text-white/80 uppercase tracking-widest mb-0.5">High-Value Threshold (₱)</label>
                  <p className="text-[10px] md:text-xs text-white/40 mb-2">Transactions above this amount will require multi-sig approval.</p>
                  <input 
                    type="number" 
                    required
                    min="0"
                    className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-inner"
                    value={formData.highValueThreshold}
                    onChange={(e) => setFormData({...formData, highValueThreshold: Number(e.target.value)})}
                  />
                </div>

                <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-white/90">Private Organization</label>
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isPrivate ? "bg-purple-500" : "bg-white/20"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isPrivate ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">
                    If enabled, only members can view your transaction ledger and DAO. Your organization will still be listed in the public directory.
                  </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 px-4 text-sm font-bold text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 text-sm font-bold text-purple-100 bg-purple-500/80 hover:bg-purple-500 border border-purple-500/50 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]"
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
