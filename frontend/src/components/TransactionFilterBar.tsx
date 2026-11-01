"use client";

import React from "react";
import { Search } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";

export interface TransactionFilterState {
  search: string;
  type: string;
  status: string;
  range: string;
}

interface TransactionFilterBarProps {
  filters: TransactionFilterState;
  onFilterChange: (updated: TransactionFilterState) => void;
}

export default function TransactionFilterBar({
  filters,
  onFilterChange,
}: TransactionFilterBarProps) {
  return (
    <div className="p-2 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col md:flex-row items-center gap-2 mb-4">
      {/* Search Input */}
      <div className="flex-1 relative w-full">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by description, reference, or recipient..."
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 focus:border-zinc-600 rounded-lg text-white placeholder-zinc-500 outline-none transition-colors"
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Filter Select Controls */}
      <div className="grid grid-cols-3 gap-2 w-full md:w-auto shrink-0">
        <CustomSelect
          size="sm"
          value={filters.type}
          onChange={(val) => onFilterChange({ ...filters, type: val })}
          options={[
            { value: "", label: "All Types" },
            { value: "income", label: "Inflows (+)" },
            { value: "expense", label: "Outflows (-)" },
          ]}
          placeholder="All Types"
        />

        <CustomSelect
          size="sm"
          value={filters.status}
          onChange={(val) => onFilterChange({ ...filters, status: val })}
          options={[
            { value: "", label: "All Statuses" },
            { value: "approved", label: "Approved" },
            { value: "pending_approval", label: "Multi-Sig" },
            { value: "requested", label: "Requested" },
            { value: "rejected", label: "Rejected" },
          ]}
          placeholder="All Statuses"
        />

        <CustomSelect
          size="sm"
          value={filters.range || "all"}
          onChange={(val) => onFilterChange({ ...filters, range: val })}
          options={[
            { value: "all", label: "All Time" },
            { value: "24h", label: "Past 24H" },
            { value: "7d", label: "Past 7 Days" },
            { value: "30d", label: "Past 30 Days" },
            { value: "90d", label: "Past 90 Days" },
            { value: "1year", label: "Past Year" },
          ]}
          placeholder="All Time"
        />
      </div>
    </div>
  );
}
