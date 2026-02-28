import { ReactNode } from "react";

interface DataCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBg?: string;
  className?: string;
}

export function DataCard({ title, value, icon, iconBg = "bg-[#7A4CFF]/10", className = "" }: DataCardProps) {
  return (
    <div className={"rounded-xl bg-white p-6 shadow-sm border border-gray-100 flex items-center justify-between " + className}>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className={"rounded-lg p-3 " + iconBg + " text-[#7A4CFF]"}>{icon}</div>
    </div>
  );
}
