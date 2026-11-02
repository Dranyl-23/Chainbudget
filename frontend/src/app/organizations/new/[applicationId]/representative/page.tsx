"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  UserCheck,
  MailCheck,
  ArrowLeft,
  ArrowRight,
  Send,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { useOrgRegistration } from "@/context/OrgRegistrationContext";
import api from "@/lib/api";

export default function RepresentativeStepPage() {
  const { application, requirements, saveStep, reload } = useOrgRegistration();
  const router = useRouter();

  const rep = application?.representative || {};
  const contact = application?.contact || { emailVerified: false };

  const [fullName, setFullName] = useState(rep.fullName || "");
  const [position, setPosition] = useState(rep.position || "");
  const [idType, setIdType] = useState(
    rep.idType || requirements?.representative.idTypes[0]?.value || "philsys"
  );
  // If an ID was already saved, show a placeholder with the last 4 digits;
  // the user can enter their ID number or keep the last 4 if unchanged.
  const [idNumber, setIdNumber] = useState(rep.idLast4 || "");
  const [email, setEmail] = useState(contact.email || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [authorizedConfirmed, setAuthorizedConfirmed] = useState(
    Boolean(rep.fullName)
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [confirmingOtp, setConfirmingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  if (!application || !requirements) return null;

  const isEmailSameAsSaved =
    Boolean(application.contact.email) &&
    application.contact.email?.toLowerCase() === email.trim().toLowerCase();
  const isVerified = isEmailSameAsSaved && application.contact.emailVerified;

  const handleSaveIdentity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const errors: Record<string, string> = {};

    if (fullName.trim().length < 2 || fullName.trim().length > 100) {
      errors.fullName = "Representative full name must be between 2 and 100 characters.";
    }
    if (position.trim().length < 2 || position.trim().length > 100) {
      errors.position = "Official position / title must be between 2 and 100 characters.";
    }
    const cleanId = idNumber.trim();
    if (!cleanId) {
      errors.idNumber = "Valid ID number or last 4 digits is required.";
    } else if (cleanId.length < 4 || cleanId.length > 40 || !/^[A-Za-z0-9]+$/.test(cleanId)) {
      errors.idNumber = "ID number must be 4 to 40 alphanumeric characters.";
    }

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTrimmed)) {
      errors.email = "Please enter a valid official contact email address.";
    } else if (requirements?.representative?.emailDomainSuffixes?.length) {
      const matchesDomain = requirements.representative.emailDomainSuffixes.some((s) =>
        emailTrimmed.endsWith(s)
      );
      if (!matchesDomain) {
        errors.email = `Official email for this organization must end with ${requirements.representative.emailDomainSuffixes.join(" or ")}.`;
      }
    }

    const cleanPhone = phone.trim().replace(/[\s-]/g, "");
    if (cleanPhone && !/^(\+?63|0)9\d{9}$/.test(cleanPhone)) {
      errors.phone = "Phone must be a valid Philippine mobile number (e.g. 09171234567 or +639171234567).";
    }

    if (!authorizedConfirmed) {
      errors.authorizedConfirmed = "You must confirm you are legally authorized to register this organization.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please resolve the highlighted representative errors.");
      return null;
    }

    setSaving(true);
    setFieldErrors({});

    const res = await saveStep("representative", {
      fullName: fullName.trim(),
      position: position.trim(),
      idType,
      idNumber: cleanId,
      email: emailTrimmed,
      phone: cleanPhone,
      authorizedConfirmed,
    });

    setSaving(false);

    if (!res.ok) {
      setFieldErrors(res.fields || {});
      toast.error(res.errorMessage || "Please check the highlighted fields.");
      return null;
    }

    toast.success("Representative details saved.");
    return res.app;
  };

  const handleSendOtp = async () => {
    // Save step first so the server has the current contact email
    const savedApp = await handleSaveIdentity();
    if (!savedApp) return;

    if (savedApp.contact.emailVerified) {
      toast.success("This email is already verified.");
      return;
    }

    setSendingOtp(true);
    try {
      const res = await api.post<{
        sent?: boolean;
        alreadyVerified?: boolean;
        to?: string;
        resendAfterSec?: number;
      }>(`/org-applications/${application.id}/contact/email/send`);

      if (res.data.alreadyVerified) {
        await reload();
        toast.success("Email is already verified!");
      } else {
        setOtpSent(true);
        setCooldown(res.data.resendAfterSec || 60);
        toast.success(`Verification code sent to ${res.data.to || email}`);
      }
    } catch (err: unknown) {
      const apiErr = err as {
        response?: { data?: { error?: string; retryAfterSec?: number } };
      };
      if (apiErr.response?.data?.retryAfterSec) {
        setCooldown(apiErr.response.data.retryAfterSec);
      }
      toast.error(
        apiErr.response?.data?.error || "Failed to send verification code."
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (otpCode.trim().length !== 6) {
      toast.error("Enter the 6-digit code sent to your email.");
      return;
    }
    setConfirmingOtp(true);
    try {
      await api.post(
        `/org-applications/${application.id}/contact/email/confirm`,
        { code: otpCode.trim() }
      );
      toast.success("Official contact email verified!");
      setOtpCode("");
      setOtpSent(false);
      await reload();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      toast.error(apiErr.response?.data?.error || "Invalid verification code.");
    } finally {
      setConfirmingOtp(false);
    }
  };

  const handleContinue = async () => {
    const saved = await handleSaveIdentity();
    if (!saved) return;
    router.push(`/organizations/new/${application.id}/documents`);
  };

  const err = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-xs text-rose-400 mt-1">{fieldErrors[key]}</p>
    ) : null;

  return (
    <div className="space-y-6">
      {/* Representative Identity Card */}
      <form
        onSubmit={handleSaveIdentity}
        className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Step 2 · Authorized Representative
            </h2>
            <p className="text-xs text-zinc-400">
              Identity of the officer or founder submitting this registration.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Full Legal Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Must match your government ID"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {err("fullName")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Position / Title in Organization *
            </label>
            <input
              type="text"
              required
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. President, Barangay Treasurer, Executive Director"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {err("position")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Government-Issued ID Type *
            </label>
            <select
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {requirements.representative.idTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {err("idType")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              ID Number *{" "}
              <span className="text-[11px] font-normal text-emerald-400">
                (Only last 4 digits stored)
              </span>
            </label>
            <input
              type="text"
              required
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder={
                rep.idLast4
                  ? `Saved ending in ••••${rep.idLast4}`
                  : "Enter ID number"
              }
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {err("idNumber")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Official Contact Email *
              {requirements.representative.emailDomainSuffixes.length > 0 && (
                <span className="text-amber-300 font-normal ml-1">
                  (must end with{" "}
                  {requirements.representative.emailDomainSuffixes.join(" or ")})
                </span>
              )}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="official@organization.org"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {err("email")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              PH Mobile Number (Optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09171234567"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {err("phone")}
          </div>
        </div>

        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 cursor-pointer">
          <input
            type="checkbox"
            checked={authorizedConfirmed}
            onChange={(e) => setAuthorizedConfirmed(e.target.checked)}
            className="mt-0.5 rounded border-zinc-700"
          />
          <span className="text-xs text-zinc-300 leading-relaxed">
            I confirm that I am an authorized officer or representative of this
            organization and have permission to register its treasury on ChainBudget.
          </span>
        </label>
        {err("authorizedConfirmed")}
      </form>

      {/* Official Email OTP Verification Card */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <MailCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Official Email OTP Verification
              </h3>
              <p className="text-xs text-zinc-400">
                Required before final submission to prove control of the contact email.
              </p>
            </div>
          </div>

          {isVerified ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              Verified
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={sendingOtp || cooldown > 0 || !email.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingOtp
                ? "Sending..."
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : otpSent
                ? "Resend Code"
                : "Send 6-Digit Code"}
            </button>
          )}
        </div>

        {!isVerified && (otpSent || application.contact.email) && (
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter 6-digit code"
              className="flex-1 px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm tracking-widest font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleConfirmOtp}
              disabled={confirmingOtp || otpCode.length !== 6}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {confirmingOtp ? "Verifying..." : "Verify Code"}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <Shield className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>
            In local development without SMTP configured, the 6-digit OTP is printed to the backend terminal log.
          </span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            router.push(`/organizations/new/${application.id}/details`)
          }
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous Step
        </button>

        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-sm inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span>{saving ? "Saving..." : "Save & Continue to Documents"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
