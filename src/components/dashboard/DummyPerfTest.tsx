import dynamic from 'next/dynamic';
import React, { useMemo } from 'react';
const MindMap3D = dynamic(() => import('../MindMap3D').then(mod => mod.MindMap3D), { ssr: false });
import { Task, Project } from "@/types";

interface DummyPerfTestProps {
  projectList: Project[];
  taskList: Task[];
}

export function DummyPerfTest({ projectList, taskList }: DummyPerfTestProps) {

  const projectListMap = useMemo(() => new Map(projectList.map(p => [p.id, p])), [projectList]);
  return (
    <div className="p-4 bg-slate-900/50 rounded-xl border border-white/10">
      <h3 className="text-lg font-bold text-white mb-4">Dummy Perf Test</h3>
      <div className="space-y-2">
        {taskList.map(task => {
          const project = projectListMap.get(task.projectId);;
          return (
            <div key={task.id} className="p-2 bg-white/5 rounded border border-white/5 flex justify-between">
              <span>{task.title}</span>
              <span className="text-indigo-400 font-mono text-xs">{project ? project.name : "No Project"}</span>
            </div>
          );
        })}
      </div>
      <div className="hidden">
        <MindMap3D 
          signalKeywords={{}} 
          signalEntries={[]} 
          onAddSignal={() => {}} 
        />
      </div>
    </div>
  );
}
