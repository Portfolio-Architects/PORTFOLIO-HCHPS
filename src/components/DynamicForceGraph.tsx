"use client";

import dynamic from 'next/dynamic';
import React, { forwardRef } from 'react';

// ForceGraph2D heavily relies on window and document (canvas), so it must be dynamically imported.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#F8FAFC]">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
        <div className="mt-4 text-sm font-medium text-slate-500 tracking-wide">
          Initiliazing Spatial Analysis Engine...
        </div>
      </div>
    </div>
  ),
});

type ForceGraph2DType = typeof import('react-force-graph-2d').default;
type DynamicForceGraphProps = React.ComponentProps<ForceGraph2DType>;

const DynamicForceGraph = forwardRef<unknown, DynamicForceGraphProps>((props, ref) => {
  return <ForceGraph2D {...props} ref={ref as any} />;
});

DynamicForceGraph.displayName = 'DynamicForceGraph';

export default DynamicForceGraph;
