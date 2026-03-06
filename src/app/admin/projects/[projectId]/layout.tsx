import React from "react";

interface ProjectDetailsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailsLayout({
  children,
}: ProjectDetailsLayoutProps) {
  return (
    <div className="w-full h-full flex flex-col">
      {children}
    </div>
  );
}
