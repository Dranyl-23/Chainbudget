"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  searchable?: boolean;
}

export default function CustomSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  disabled = false,
  size = "md",
  searchable = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside or Escape pressed
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
        setHighlightedIndex(-1);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearch("");
        setHighlightedIndex(-1);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, searchable]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.hint && opt.hint.toLowerCase().includes(q)) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [options, search, searchable]);

  const toggleDropdown = () => {
    if (disabled) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      const idx = filteredOptions.findIndex((opt) => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setSearch("");
      setHighlightedIndex(-1);
    }
  };

  const handleKeyDownOnButton = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        const idx = filteredOptions.findIndex((opt) => opt.value === value);
        setHighlightedIndex(idx >= 0 ? idx : 0);
      } else if (e.key === "ArrowDown") {
        setHighlightedIndex((prev) => (prev + 1 < filteredOptions.length ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1));
      } else if (e.key === "Enter" || e.key === " ") {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const opt = filteredOptions[highlightedIndex];
          if (!opt.disabled) {
            onChange(opt.value);
            setIsOpen(false);
            setSearch("");
            setHighlightedIndex(-1);
          }
        }
      }
    }
  };

  const sizeClasses =
    size === "sm"
      ? "px-3 py-2 text-xs min-h-[36px]"
      : "px-3.5 py-2.5 text-sm min-h-[42px]";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Dropdown Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDownOnButton}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full bg-zinc-900 border ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-950/20"
            : "border-zinc-800 hover:border-zinc-700"
        } rounded-xl text-left flex items-center justify-between text-zinc-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm ${sizeClasses} ${buttonClassName}`}
      >
        <span className="flex items-center gap-2.5 truncate">
          {selectedOption?.icon && (
            <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors shrink-0">
              {selectedOption.icon}
            </span>
          )}
          <span
            className={`truncate ${
              selectedOption || value ? "text-white font-medium" : "text-zinc-500"
            }`}
          >
            {selectedOption ? selectedOption.label : value || placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? "rotate-180 text-indigo-400" : ""
          }`}
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          className={`absolute right-0 top-full mt-2 z-50 min-w-full w-max max-w-[280px] sm:min-w-[230px] bg-[#141418] border border-zinc-800/90 rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/5 overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-150 ${menuClassName}`}
        >
          {searchable && (
            <div className="p-2.5 border-b border-zinc-800/80 bg-[#141418] shrink-0">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search options..."
                  className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div
            ref={listRef}
            role="listbox"
            className="p-1.5 max-h-60 overflow-y-auto space-y-1 custom-scrollbar"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-3 text-xs text-zinc-500 text-center">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = option.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full ${
                      size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs sm:text-sm"
                    } rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                      option.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : isSelected
                        ? "bg-indigo-600/15 text-white font-semibold border border-indigo-500/30 shadow-xs shadow-indigo-950/20"
                        : isHighlighted
                        ? "bg-zinc-800/80 text-white"
                        : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {option.icon && (
                        <div
                          className={`shrink-0 ${
                            isSelected ? "text-indigo-400" : "text-zinc-400"
                          }`}
                        >
                          {option.icon}
                        </div>
                      )}
                      <div className="min-w-0 truncate">
                        <span className="block truncate">{option.label}</span>
                        {option.hint && (
                          <span className="block text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                            {option.hint}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
