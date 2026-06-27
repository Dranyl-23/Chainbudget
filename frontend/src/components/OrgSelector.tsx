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
        className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors sidebar-card select-none"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        <div className="overflow-hidden">
          <p className="text-xs text-gray-500 mb-0.5">Organization</p>
          <p className="text-sm font-medium text-gray-700 truncate">
            {loading ? "Loading..." : activeOrg ? activeOrg.name : "Select Organization"}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute top-full left-3 right-3 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 animate-fade-in">
          <div className="max-h-48 overflow-y-auto">
            {orgs.map(org => (
              <div 
                key={org._id}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                onClick={() => {
                  setActiveOrgId(org._id);
                  setDropdownOpen(false);
                }}
              >
                <span className="truncate pr-2">{org.name}</span>
                {activeOrgId === org._id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </div>
            ))}
            {orgs.length === 0 && !loading && (
              <div className="px-3 py-2 text-sm text-gray-500 italic">No organizations found</div>
            )}
          </div>
          <div className="border-t border-gray-100 mt-1 pt-1">
            <div 
              className="px-3 py-2 text-sm text-primary hover:bg-primary/5 cursor-pointer flex items-center gap-2 font-medium"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-6 w-full max-w-md shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Building className="w-4 h-4 md:w-5 md:h-5 text-primary" /> New Organization
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 md:mb-4 p-2 md:p-3 bg-red-50 text-red-600 text-xs md:text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateOrg} className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Computer Science Society"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Organization Logo (Optional)</label>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp"
                  onChange={e => setLogoFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-1.5 md:py-2 border border-gray-200 rounded-lg text-[10px] md:text-sm text-gray-600 file:mr-2 md:file:mr-4 file:py-1 file:px-2 md:file:px-3 file:rounded-full file:border-0 file:text-[10px] md:file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Organization Type</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option value="student_org">Student Organization</option>
                  <option value="barangay">Barangay Fund</option>
                  <option value="homeowners_association">Homeowners Association</option>
                  <option value="ngo">Non-Government Organization</option>
                  <option value="cooperative">Cooperative</option>
                  <option value="church">Church / Religious Group</option>
                  <option value="sports_club">Sports Club</option>
                  <option value="startup">Startup</option>
                  <option value="family">Family Fund</option>
                  <option value="fundraising">Fundraising Campaign</option>
                </select>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1">High-Value Transaction Threshold (₱)</label>
                <p className="text-[10px] md:text-xs text-gray-500 mb-1.5 md:mb-2">Transactions above this amount will require multi-sig approval.</p>
                <input 
                  type="number" 
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.highValueThreshold}
                  onChange={e => setFormData({...formData, highValueThreshold: Number(e.target.value)})}
                />
              </div>

              <div className="pt-2 md:pt-4 flex gap-2 md:gap-3">
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-1.5 md:py-2 px-3 md:px-4 text-sm md:text-base border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 btn-primary py-1.5 md:py-2.5 text-sm md:text-base justify-center disabled:opacity-70 whitespace-nowrap"
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
