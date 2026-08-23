"use client";

import React from "react";
import { Search } from "lucide-react";

export interface TransactionFilterState {
  search: string;
  type: string;
  status: string;
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
    <div className="flex flex-col md:flex-row gap-3 mb-6">
      <div className="flex-1 relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search transactions by description, reference, or category..."
          className="input !pl-9 w-full"
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
        <select
          className="input w-full"
          value={filters.type}
          onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select
          className="input w-full"
          value={filters.status}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending_approval">Pending</option>
          <option value="requested">Requested</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
    </div>
  );
}
