"use client";

import { useEffect, useState, use } from "react";
import { ArrowLeft, FileCode2, FilePlus2, FileMinus2, FileText, ChevronRight, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DiffFile {
  name: string;
  status: "added" | "modified" | "deleted";
  diff: string;
}

export default function DiffViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiff();
  }, [id]);

  async function fetchDiff() {
    try {
      const res = await fetch(`/api/runs/${id}`);
      const run = await res.json();

      const fileEvents = run.events.filter(
        (e: { agent: string; message: string }) =>
          e.agent === "Coder" &&
          (e.message.includes("write_file") ||
            e.message.includes("create_file") ||
            e.message.includes("delete_file"))
      );

      const parsedFiles: DiffFile[] = fileEvents.map(
        (e: { message: string }) => {
          const match = e.message.match(/(?:write_file|create_file|delete_file):\s*(.+)/);
          const fileName = match ? match[1] : "unknown";
          const status = e.message.includes("create_file")
            ? "added"
            : e.message.includes("delete_file")
            ? "deleted"
            : "modified";

          return {
            name: fileName,
            status,
            diff: `${status === "added" ? "+" : status === "deleted" ? "-" : "~"} ${fileName}\n\n// Note: This is a simplified diff simulation based on logs.\n// For full diffs, CodeNXT uses git format-patch or simple-git under the hood.`,
          };
        }
      );

      setFiles(parsedFiles);
      if (parsedFiles.length > 0) {
        setSelectedFile(parsedFiles[0].name);
      }
    } catch (error) {
      console.error("Failed to fetch diff:", error);
    } finally {
      setLoading(false);
    }
  }

  function getFileIcon(status: string) {
    switch (status) {
      case "added": return <FilePlus2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case "deleted": return <FileMinus2 className="w-4 h-4 text-rose-500 shrink-0" />;
      default: return <FileCode2 className="w-4 h-4 text-amber-500 shrink-0" />;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <Activity className="w-6 h-6 text-zinc-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-900 bg-[#050505] shrink-0">
        <div className="flex items-center gap-3">
          <a
            href={`/runs/${id}`}
            className="text-zinc-500 hover:text-zinc-100 transition-colors flex items-center gap-1.5 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Run
          </a>
          <span className="text-zinc-800">/</span>
          <span className="text-sm font-mono text-zinc-400">Changed Files</span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 bg-black">
        {/* File Tree Sidebar */}
        <div className="w-72 border-r border-zinc-900 bg-[#050505] flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-900 shrink-0">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Files Changed ({files.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {files.map((file) => (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file.name)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors group ${
                  selectedFile === file.name
                    ? "bg-zinc-800/80 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                }`}
              >
                {getFileIcon(file.status)}
                <span className="truncate font-mono text-[13px]">{file.name.split('/').pop()}</span>
                {selectedFile === file.name && (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 ml-auto shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Diff Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A]">
          {selectedFile ? (
            <>
              <div className="h-12 border-b border-zinc-900 flex items-center px-4 shrink-0 bg-[#0A0A0A]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-500" />
                  <span className="font-mono text-[13px] text-zinc-300">
                    {selectedFile}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-[#050505] shadow-sm">
                  <div className="p-4 md:p-6 overflow-x-auto">
                    <pre className="text-[13px] font-mono leading-relaxed whitespace-pre">
                      <code className="text-zinc-300">
                        {files.find((f) => f.name === selectedFile)?.diff || "No diff available"}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600">
              <FileCode2 className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a file to view its changes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
