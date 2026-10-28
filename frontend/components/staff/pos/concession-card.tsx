"use client";

import React, { useState } from "react";
import { Coffee, Popcorn, UtensilsCrossed } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";

export interface ConcessionCardProps {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  category?: string | null;
  size?: string | null;
  description?: string | null;
  comboItems?: Array<{ name: string; quantity: number }>;
  isCombo?: boolean;
  quantity: number;
  onQuantityChange: (delta: number) => void;
}

export function ConcessionCard({
  name,
  price,
  stock,
  imageUrl,
  category,
  size,
  comboItems,
  isCombo = false,
  quantity,
  onQuantityChange,
}: ConcessionCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isOutOfStock = stock <= 0;

  const renderIcon = () => {
    const cat = (category || "").toUpperCase();
    const lowerName = name.toLowerCase();

    if (
      isCombo ||
      cat.includes("COMBO") ||
      cat.includes("POPCORN") ||
      lowerName.includes("bắp") ||
      lowerName.includes("combo")
    ) {
      return <Popcorn className="w-8 h-8 text-[#d97706]" aria-hidden="true" />;
    }

    if (
      cat.includes("BEVERAGE") ||
      cat.includes("DRINK") ||
      lowerName.includes("nước") ||
      lowerName.includes("coca") ||
      lowerName.includes("pepsi") ||
      lowerName.includes("sprite") ||
      lowerName.includes("fanta") ||
      lowerName.includes("trà")
    ) {
      return <Coffee className="w-8 h-8 text-[#0284c7]" aria-hidden="true" />;
    }

    return <UtensilsCrossed className="w-8 h-8 text-[#888888]" aria-hidden="true" />;
  };

  return (
    <div
      className={`p-3.5 border transition-all flex flex-col justify-between ${
        quantity > 0
          ? "border-2 border-primary-600 bg-primary-50 shadow-sm"
          : "border-border-main bg-surface hover:bg-surface-muted hover:border-primary-100"
      }`}
    >
      <div className="flex gap-3 items-start">
        {/* Thumbnail ảnh tỉ lệ 1:1, kích thước 80x80px (w-20 h-20) */}
        <div className="w-20 h-20 rounded bg-surface-muted border border-border-main overflow-hidden flex-shrink-0 flex items-center justify-center relative">
          {imageUrl && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            renderIcon()
          )}
        </div>

        {/* Thông tin sản phẩm */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h5 className="font-bold text-[13px] text-[#231f20] uppercase truncate">
                  {name}
                </h5>
                {isCombo && (
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-[#d97706] text-white rounded">
                    COMBO
                  </span>
                )}
              </div>

              {comboItems && comboItems.length > 0 ? (
                <p className="text-[11px] text-[#666666] mt-0.5 line-clamp-2">
                  {comboItems.map((i) => `${i.name} x${i.quantity}`).join(" + ")}
                </p>
              ) : (
                <p className="text-[11px] text-[#666666] mt-0.5">
                  {size ? `Size: ${size}` : category || "F&B"}
                </p>
              )}
            </div>

            <span
              className={`text-[13px] font-bold flex-shrink-0 ${
                isCombo ? "text-[#da291c]" : "text-[#15803d]"
              }`}
            >
              {formatCurrency(price)}
            </span>
          </div>
        </div>
      </div>

      {/* Tồn kho & Điều khiển số lượng */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#efebdb]">
        <span className="text-[11px] text-[#666666]">
          {isCombo ? "Tồn kho: " : "Kho: "}
          <strong
            className={
              stock <= 5 ? "text-[#da291c]" : "text-[#231f20]"
            }
          >
            {stock}
          </strong>
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={quantity <= 0}
            onClick={() => onQuantityChange(-1)}
            aria-label={`Giảm số lượng ${name}`}
            className="w-7 h-7 bg-[#efebdb] border border-[#dad2b4] text-[#231f20] hover:bg-[#dad2b4] disabled:opacity-40 text-sm font-bold flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            -
          </button>
          <span className="font-bold text-xs w-6 text-center font-mono">
            {quantity}
          </span>
          <button
            type="button"
            disabled={isOutOfStock || quantity >= stock}
            onClick={() => onQuantityChange(1)}
            aria-label={`Tăng số lượng ${name}`}
            className="w-7 h-7 bg-[#da291c] hover:bg-[#b91c1c] disabled:opacity-40 text-sm font-bold flex items-center justify-center text-white cursor-pointer disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
