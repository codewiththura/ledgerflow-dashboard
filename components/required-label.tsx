"use client";

import React from "react";
import { Label } from "@/components/ui/label";

interface RequiredLabelProps {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

export const RequiredLabel: React.FC<RequiredLabelProps> = ({
  htmlFor,
  children,
  required = false,
  className = "",
}) => {
  return (
    <Label htmlFor={htmlFor} className={`flex items-center gap-1 font-sans ${className}`}>
      {children}
      {required && <span className="text-destructive font-semibold font-sans text-sm">*</span>}
    </Label>
  );
};
