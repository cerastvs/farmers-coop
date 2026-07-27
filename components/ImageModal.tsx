"use client";

import { X } from "lucide-react";

export function ImageModal({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 rounded-full bg-white p-1.5 shadow-lg hover:bg-gray-100"
        >
          <X size={18} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] rounded-2xl object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}
