/**
 * BudgetChart.tsx
 *
 * Visual category spending and budget utilization chart for ChainBudget Mobile.
 * Renders categorized breakdown and multi-segment allocation bar with full Theme tokens.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const CATEGORY_COLORS = [
  '#e879f9', // Fuchsia
  '#38bdf8', // Sky Blue
  '#34d399', // Emerald
  '#fbbf24', // Amber
  '#f43f5e', // Rose
  '#a78bfa', // Purple
];

type BudgetChartProps = {
  budgets: Array<{
    category: string;
    allocatedAmount?: number;
    spentAmount?: number;
    amount?: number;
    spent?: number;
  }>;
  currency?: string;
};

export default function BudgetChart({ budgets, currency = '₱' }: BudgetChartProps) {
  const { colors } = useTheme();

  if (!budgets || budgets.length === 0) {
    return null;
  }

  // Calculate totals
  const totalAllocated = budgets.reduce(
    (sum, b) => sum + (b.allocatedAmount || b.amount || 0),
    0
  );
  const totalSpent = budgets.reduce(
    (sum, b) => sum + (b.spentAmount || b.spent || 0),
    0
  );

  const utilizationRate = totalAllocated > 0 ? Math.min(100, Math.round((totalSpent / totalAllocated) * 100)) : 0;
  const remaining = Math.max(0, totalAllocated - totalSpent);

  return (
    <View 
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      className="p-5 rounded-3xl mb-8 border shadow-sm"
    >
      {/* Header & Overall Metric */}
      <View className="flex-row justify-between items-start mb-4">
        <View>
          <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase tracking-widest font-bold mb-1">
            BUDGET UTILIZATION
          </Text>
          <View className="flex-row items-baseline gap-1">
            <Text style={{ color: colors.textPrimary }} className="text-2xl font-extrabold">{utilizationRate}%</Text>
            <Text style={{ color: colors.textSecondary }} className="text-xs font-semibold">utilized</Text>
          </View>
        </View>

        <View className="items-end">
          <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase tracking-widest font-bold mb-1">
            REMAINING
          </Text>
          <Text style={{ color: colors.success }} className="text-base font-extrabold">
            {currency}{remaining.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Multi-Segment Allocation Bar */}
      <View 
        style={{ backgroundColor: colors.cardGlass }}
        className="h-3 w-full rounded-full flex-row overflow-hidden mb-4 p-0.5"
      >
        {budgets.map((b, idx) => {
          const spent = b.spentAmount || b.spent || 0;
          const pct = totalAllocated > 0 ? (spent / totalAllocated) * 100 : 0;
          if (pct <= 0) return null;

          return (
            <View
              key={idx}
              style={{
                width: `${pct}%`,
                backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                height: '100%',
                borderRadius: 4,
                marginRight: idx < budgets.length - 1 ? 2 : 0,
              }}
            />
          );
        })}
      </View>

      {/* Category Chips Breakdown */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-1">
        {budgets.map((b, idx) => {
          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          const allocated = b.allocatedAmount || b.amount || 0;
          const spent = b.spentAmount || b.spent || 0;
          const catPct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;

          return (
            <View
              key={idx}
              style={{ backgroundColor: colors.cardGlass, borderColor: colors.borderSubtle }}
              className="border px-3 py-2 rounded-2xl mx-1 items-start min-w-[110px]"
            >
              <View className="flex-row items-center gap-1.5 mb-1">
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                <Text style={{ color: colors.textPrimary }} className="text-xs font-bold" numberOfLines={1}>
                  {b.category}
                </Text>
              </View>
              <Text style={{ color: colors.textPrimary }} className="font-extrabold text-xs">
                {currency}{spent.toLocaleString()}
              </Text>
              <Text style={{ color: colors.textMuted }} className="text-[9px]">
                {catPct}% of {currency}{allocated.toLocaleString()}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
