"use client";

import { useEffect, useState, use } from "react";

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

      // Parse events to extract file changes
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
            diff: `${status === "added" ? "+" : status === "deleted" ? "-" : "~"} ${fileName}`,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <a
            href={`/runs/${id}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Run Detail
          </a>
          <span className="text-border">/</span>
          <span className="text-sm text-muted-foreground">Diff</span>
        </div>
        <h1 className="text-2xl font-bold mt-2">Changed Files</h1>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* File Tree */}
        <div className="w-72 border-r border-border p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Files ({files.length})
          </h3>
          <div className="space-y-1">
            {files.map((file) => (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file.name)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedFile === file.name
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <span
                  className={`text-xs font-bold ${
                    file.status === "added"
                      ? "text-success"
                      : file.status === "deleted"
                      ? "text-destructive"
                      : "text-warning"
                  }`}
                >
                  {file.status === "added"
                    ? "+"
                    : file.status === "deleted"
                    ? "−"
                    : "~"}
                </span>
                <span className="truncate font-mono text-xs">{file.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedFile ? (
            <div className="glass rounded-xl p-6">
              <h3 className="font-mono text-sm mb-4 text-muted-foreground">
                {selectedFile}
              </h3>
              <pre className="text-sm font-mono text-foreground/80 whitespace-pre-wrap">
                {files.find((f) => f.name === selectedFile)?.diff ||
                  "No diff available"}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Select a file to view changes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
