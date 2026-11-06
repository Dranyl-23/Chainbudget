"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  Building2,
  MapPin,
  FileText,
  ArrowRight,
  Upload,
  X,
} from "lucide-react";
import { useOrgRegistration } from "@/context/OrgRegistrationContext";
import api from "@/lib/api";
import CustomSelect, { CustomSelectOption } from "@/components/CustomSelect";
import {
  getPhilippineRegions,
  getProvincesForRegion,
  getCitiesForProvince,
  findCity,
} from "@/lib/philippineAddresses";

export default function OrganizationDetailsStepPage() {
  const { application, requirements, saveStep } = useOrgRegistration();
  const router = useRouter();

  const b = application?.basics || {};
  const a = application?.address || {};

  const [displayName, setDisplayName] = useState(b.displayName || "");
  const [legalName, setLegalName] = useState(b.legalName || "");
  const [registrationNumber, setRegistrationNumber] = useState(
    b.registrationNumber || ""
  );
  const [yearEstablished, setYearEstablished] = useState<string>(
    b.yearEstablished ? String(b.yearEstablished) : String(new Date().getFullYear())
  );
  const [mission, setMission] = useState(b.mission || "");
  const [intendedUse, setIntendedUse] = useState(b.intendedUse || "");
  const [logoUrl, setLogoUrl] = useState(b.logoUrl || "");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [region, setRegion] = useState(a.region || "");
  const [province, setProvince] = useState(a.province || "");
  const [city, setCity] = useState(a.city || "");
  const [barangay, setBarangay] = useState(a.barangay || "");
  const [street, setStreet] = useState(a.street || "");
  const [postalCode, setPostalCode] = useState(a.postalCode || "");

  const [extras, setExtras] = useState<Record<string, string>>(b.extras || {});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Philippine Cascading Address State
  const [manualBarangay, setManualBarangay] = useState(false);

  const regionOptions: CustomSelectOption[] = useMemo(() => {
    return getPhilippineRegions().map((r) => ({
      value: r.name,
      label: r.name,
      hint: r.code !== r.name && !r.name.startsWith(r.code) ? r.code : undefined,
    }));
  }, []);

  const provinceOptions: CustomSelectOption[] = useMemo(() => {
    if (!region) return [];
    return getProvincesForRegion(region).map((p) => ({
      value: p.name,
      label: p.name,
    }));
  }, [region]);

  const cityOptions: CustomSelectOption[] = useMemo(() => {
    if (!region || !province) return [];
    return getCitiesForProvince(region, province).map((c) => ({
      value: c.name,
      label: c.name,
      hint: c.postalCode ? `ZIP ${c.postalCode}` : undefined,
    }));
  }, [region, province]);

  const selectedCityData = useMemo(() => {
    if (!region || !province || !city) return undefined;
    return findCity(region, province, city);
  }, [region, province, city]);

  const barangayOptions: CustomSelectOption[] = useMemo(() => {
    const list = selectedCityData?.barangays || [];
    return list.map((brgy) => ({
      value: brgy,
      label: brgy,
    }));
  }, [selectedCityData]);

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    const provinces = getProvincesForRegion(newRegion);
    if (provinces.length === 1) {
      setProvince(provinces[0].name);
    } else {
      setProvince("");
    }
    setCity("");
    setBarangay("");
  };

  const handleProvinceChange = (newProvince: string) => {
    setProvince(newProvince);
    setCity("");
    setBarangay("");
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    setBarangay("");
    const cityData = findCity(region, province, newCity);
    if (cityData?.postalCode && !postalCode) {
      setPostalCode(cityData.postalCode);
    }
  };

  if (!application || !requirements) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<{ documentUrl?: string }>("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.documentUrl) {
        setLogoUrl(res.data.documentUrl);
        toast.success("Organization emblem uploaded.");
      }
    } catch {
      // Fallback to local data URL if under 1.5MB
      if (file.size <= 1.5 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (typeof ev.target?.result === "string") {
            setLogoUrl(ev.target.result);
          }
        };
        reader.readAsDataURL(file);
      } else {
        toast.error("Failed to upload logo image (max 1.5MB).");
      }
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (displayName.trim().length < 2 || displayName.trim().length > 100) {
      errors.displayName = "Display name must be between 2 and 100 characters.";
    }
    if (legalName.trim().length < 2 || legalName.trim().length > 150) {
      errors.legalName = "Legal registered name must be between 2 and 150 characters.";
    }
    if (requirements.details.registrationRequired && !registrationNumber.trim()) {
      errors.registrationNumber = `${requirements.details.registrationLabel} is required for this organization type.`;
    }
    const year = Number(yearEstablished);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1900 || year > currentYear) {
      errors.yearEstablished = `Please enter a valid establishment year between 1900 and ${currentYear}.`;
    }
    if (mission.trim().length < (requirements.details.missionMinLength || 30)) {
      errors.mission = `Mission statement must be at least ${requirements.details.missionMinLength || 30} characters.`;
    }
    if (intendedUse.trim().length < 5) {
      errors.intendedUse = "Please describe the intended use of treasury funds (at least 5 characters).";
    }

    // Validate extraFields
    requirements.details.extraFields?.forEach((f) => {
      const val = (extras[f.key] || "").trim();
      if (f.required && !val) {
        errors[`extras.${f.key}`] = `${f.label} is required.`;
      } else if (f.type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
        errors[`extras.${f.key}`] = `${f.label} must be a valid email address.`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please resolve the highlighted validation errors.");
      return;
    }

    setSaving(true);
    setFieldErrors({});

    const res = await saveStep("details", {
      displayName: displayName.trim(),
      legalName: legalName.trim(),
      registrationNumber: registrationNumber.trim(),
      yearEstablished: Number(yearEstablished),
      mission: mission.trim(),
      intendedUse: intendedUse.trim(),
      logoUrl,
      extras,
      address: {
        region: region.trim(),
        province: province.trim(),
        city: city.trim(),
        barangay: barangay.trim(),
        street: street.trim(),
        postalCode: postalCode.trim(),
      },
    });

    setSaving(false);

    if (!res.ok) {
      setFieldErrors(res.fields || {});
      toast.error(res.errorMessage || "Please check the highlighted fields.");
      return;
    }

    toast.success("Step 1 saved successfully.");
    router.push(`/organizations/new/${application.id}/representative`);
  };

  const err = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-xs text-rose-400 mt-1">{fieldErrors[key]}</p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Legal Identity Card */}
      <div className="bg-surface border border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Step 1 · Legal Identity & Purpose
            </h2>
            <p className="text-xs text-zinc-400">
              Official registration details for your {requirements.label}.
            </p>
          </div>
        </div>

        {/* Emblem / Logo */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-2">
            Organization Emblem / Logo (Optional)
          </label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="relative w-14 h-14 rounded-xl border border-zinc-700 overflow-hidden bg-zinc-900 shrink-0">
                <Image
                  src={logoUrl}
                  alt="Org logo"
                  width={56}
                  height={56}
                  unoptimized
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  className="absolute top-0 right-0 bg-black/80 text-white p-0.5 rounded-bl"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4 text-zinc-500" />
              </div>
            )}
            <div className="flex-1">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                {uploadingLogo ? "Uploading emblem..." : "PNG, JPG, or WebP up to 2 MB."}
              </p>
              {err("logoUrl")}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Display / Common Name *
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. CCIS Student Council"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {err("displayName")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Registered / Legal Name *
            </label>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Full name on registration certificate"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {err("legalName")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              {requirements.details.registrationLabel}{" "}
              {requirements.details.registrationRequired ? "*" : "(Optional)"}
            </label>
            <input
              type="text"
              required={requirements.details.registrationRequired}
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="e.g. CN2024-00192"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {err("registrationNumber")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Year Established *
            </label>
            <input
              type="number"
              required
              min={1900}
              max={new Date().getFullYear()}
              value={yearEstablished}
              onChange={(e) => setYearEstablished(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            {err("yearEstablished")}
          </div>
        </div>

        {/* Dynamic Type-Specific Extra Fields */}
        {requirements.details.extraFields.length > 0 && (
          <div className="pt-2 border-t border-zinc-800/80 grid sm:grid-cols-2 gap-4">
            {requirements.details.extraFields.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {f.label} {f.required ? "*" : ""}
                </label>
                <input
                  type={f.type}
                  required={f.required}
                  value={extras[f.key] || ""}
                  onChange={(e) =>
                    setExtras((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                {err(`extras.${f.key}`)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mission & Intended Use Card */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Mission & Fund Purpose
            </h3>
            <p className="text-xs text-zinc-400">
              Explain what your organization does and how treasury funds will be managed.
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Mission Statement * (min {requirements.details.missionMinLength} characters)
            </label>
            <span
              className={`text-[11px] ${
                mission.trim().length >= requirements.details.missionMinLength
                  ? "text-emerald-400"
                  : "text-zinc-500"
              }`}
            >
              {mission.trim().length} / {requirements.details.missionMinLength}+ chars
            </span>
          </div>
          <textarea
            rows={3}
            required
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="Describe your organization's mandate, constituents, and public mission..."
            className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          {err("mission")}
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
            Intended Use of Treasury Funds *
          </label>
          <input
            type="text"
            required
            value={intendedUse}
            onChange={(e) => setIntendedUse(e.target.value)}
            placeholder="e.g. Student events, operational disbursements, and vendor escrow payments"
            className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          {err("intendedUse")}
        </div>
      </div>

      {/* Philippine Address Card */}
      <div className="bg-surface border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Principal Office / Location
            </h3>
            <p className="text-xs text-zinc-400">
              Physical address or headquarters of the organization.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Region *
            </label>
            <CustomSelect
              value={region}
              onChange={handleRegionChange}
              options={regionOptions}
              placeholder="Select Philippine Region"
              searchable={true}
            />
            {err("address.region")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Province *
            </label>
            <CustomSelect
              value={province}
              onChange={handleProvinceChange}
              options={provinceOptions}
              placeholder={region ? "Select Province" : "Select Region first"}
              disabled={!region || provinceOptions.length === 0}
              searchable={true}
            />
            {err("address.province")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              City / Municipality *
            </label>
            <CustomSelect
              value={city}
              onChange={handleCityChange}
              options={cityOptions}
              placeholder={province ? "Select City / Municipality" : "Select Province first"}
              disabled={!province || cityOptions.length === 0}
              searchable={true}
            />
            {err("address.city")}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Barangay *
              </label>
              {barangayOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setManualBarangay((prev) => !prev)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {manualBarangay ? "Choose from list" : "Type manually"}
                </button>
              )}
            </div>

            {barangayOptions.length > 0 && !manualBarangay ? (
              <CustomSelect
                value={barangay}
                onChange={(val) => setBarangay(val)}
                options={barangayOptions}
                placeholder={city ? "Select Barangay" : "Select City first"}
                disabled={!city}
                searchable={true}
              />
            ) : (
              <input
                type="text"
                required
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                placeholder={city ? "e.g. Barangay Loyola Heights" : "Enter Barangay name"}
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            )}
            {err("address.barangay")}
          </div>

          <div className="sm:col-span-2 grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Street / Building Address *
              </label>
              <input
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Building, room, or street number"
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              {err("address.street")}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Postal Code (4 digits)
              </label>
              <input
                type="text"
                maxLength={4}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="e.g. 1108"
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              {err("address.postalCode")}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-sm inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span>{saving ? "Saving..." : "Save & Continue to Representative"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
