"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="brief-print">
      Save as PDF or print
    </button>
  );
}
