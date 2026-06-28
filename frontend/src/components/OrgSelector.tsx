"use client";

import { useState, useEffect, useRef } from "react";
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

export default function OrgSelector() {
  const { activeOrgId, setActiveOrgId } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    type: "student_org",
    highValueThreshold: 10000,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrgs = async () => {
    try {
      const res = await api.get("/organizations");
      setOrgs(res.data);
      
      // If no active org but we have orgs, set the first one
      if (!activeOrgId && res.data.length > 0) {
        setActiveOrgId(res.data[0]._id);
      }
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

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

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("name", formData.name);
      data.append("type", formData.type);
      data.append("highValueThreshold", formData.highValueThreshold.toString());
      if (logoFile) {
        data.append("logo", logoFile);
      }

      const res = await api.post("/organizations", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const newOrg = res.data;
      setOrgs([...orgs, newOrg]);
      setActiveOrgId(newOrg._id);
      setModalOpen(false);
      setDropdownOpen(false);
      setFormData({ name: "", type: "student_org", highValueThreshold: 10000 });
      setLogoFile(null);
      // Force reload to refresh user memberships from token/backend if needed
      window.location.reload(); 
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create organization");
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
        <div className="overflow-hidden">
          <p className="text-xs text-gray-400 mb-0.5">Organization</p>
          <p className="text-sm font-medium text-gray-100 truncate">
            {loading ? "Loading..." : activeOrg ? activeOrg.name : "Select Organization"}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute top-full left-3 right-3 mt-1 glass rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/10 py-1 z-50 animate-fade-in">
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {orgs.map(org => (
              <div 
                key={org._id}
                className="px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer flex items-center justify-between transition-colors"
                onClick={() => {
                  setActiveOrgId(org._id);
                  setDropdownOpen(false);
                }}
              >
                <span className="truncate pr-2">{org.name}</span>
                {activeOrgId === org._id && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />}
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-md">
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
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-bold text-white/80 uppercase tracking-widest mb-1.5">Organization Logo (Optional)</label>
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp"
                    onChange={e => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-xs text-white/60 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 file:transition-colors transition-all shadow-inner cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-bold text-white/80 uppercase tracking-widest mb-1.5">Organization Type</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-inner appearance-none"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
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
                    onChange={e => setFormData({...formData, highValueThreshold: Number(e.target.value)})}
                  />
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
