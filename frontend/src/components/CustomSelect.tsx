"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

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
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside or Escape pressed
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const sizeClasses = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Dropdown Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full bg-zinc-900 border ${
          isOpen ? "border-zinc-500 ring-1 ring-zinc-500/20" : "border-zinc-800 hover:border-zinc-700"
        } rounded-lg text-left flex items-center justify-between text-zinc-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm ${sizeClasses} ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className={selectedOption ? "text-zinc-100 font-medium" : "text-zinc-500"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? "rotate-180 text-zinc-200" : ""
          }`}
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl p-1.5 max-h-60 overflow-y-auto space-y-0.5 animate-in fade-in-0 zoom-in-95 duration-150 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none ${menuClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
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
                }}
                className={`w-full ${
                  size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs md:text-sm"
                } rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer ${
                  option.disabled
                    ? "opacity-40 cursor-not-allowed"
                    : isSelected
                    ? "bg-zinc-800/70 text-white font-medium"
                    : "text-zinc-300 hover:bg-zinc-800/40 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {option.icon}
                  <div className="truncate">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && <span className="block text-[10px] text-zinc-500">{option.hint}</span>}
                  </div>
                </div>
                {isSelected && (
                  <Check className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} text-zinc-200 shrink-0 ml-2`} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
