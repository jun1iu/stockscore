'use client';

import { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Wraps every page so a navigation animates like a screen change in a phone app.
 * The direction (push, pop or tab switch) is chosen in CSS from the data-nav attribute
 * that the Motion component sets on the click, before the page changes.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <ViewTransition key={path} enter="page page-in" exit="page page-out" default="none">
      <div className="screen">{children}</div>
    </ViewTransition>
  );
}
