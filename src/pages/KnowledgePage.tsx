import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createKnowledgeDoc,
  deleteKnowledgeDoc,
  listKnowledgeDocs,
  type KnowledgeDoc,
} from "../features/knowledge/knowledgeService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BookOpen, Plus, Trash2, Upload } from "../components/Icons";
import { cn } from "@/lib/utils";

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try { setDocs(await listKnowledgeDocs()); }
    catch (e) { console.error(e); }
  };

  useEffect(() => { void refresh(); }, []);

  const onCreate = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      await createKnowledgeDoc({
        title: title.trim(),
        content: content.trim(),
        chunkCount: Math.max(1, Math.ceil(content.length / 1200)),
      });
      setTitle(""); setContent("");
      setStatus("Document saved.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };

  const onImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const textLike = new Set(["text/plain", "text/markdown", "text/csv", "application/json", "text/html", "application/xml", "text/xml"]);
    let imported = 0;
    for (const file of Array.from(files)) {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      const isTextByExt = ["txt", "md", "markdown", "csv", "json", "html", "htm", "xml"].includes(ext);
      if (!textLike.has(file.type) && !isTextByExt) continue;
      const fileContent = await file.text();
      if (!fileContent.trim()) continue;
      await createKnowledgeDoc({ title: file.name, sourcePath: file.name, mimeType: file.type || null, content: fileContent });
      imported += 1;
    }
    await refresh();
    setStatus(imported > 0 ? `Imported ${imported} file(s).` : "No supported files were imported.");
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Store and retrieve documents for AI-augmented responses</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/chat">Use in Chat →</Link>
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {status && (
              <div className={cn(
                "px-4 py-2.5 rounded-lg text-sm border",
                status.toLowerCase().includes("error") || status.toLowerCase().includes("no supported")
                  ? "bg-destructive/10 border-destructive/20 text-destructive"
                  : "bg-primary/10 border-primary/20 text-primary"
              )}>
                {status}
              </div>
            )}

            {/* Add document */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add Document</CardTitle>
                <CardDescription>Paste text or import files. Documents are chunked for retrieval.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File import */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.xml"
                    className="hidden"
                    onChange={(e) => void onImportFiles(e.target.files)}
                  />
                  <Button
                    variant="outline"
                    className="w-full h-20 border-dashed flex-col gap-1.5 text-muted-foreground hover:text-foreground hover:border-primary/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={20} />
                    <span className="text-sm">Click to import files</span>
                    <span className="text-xs opacity-70">txt, md, csv, json, html, xml</span>
                  </Button>
                </div>

                <div className="relative flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground shrink-0">or paste manually</span>
                  <Separator className="flex-1" />
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Document title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Content</Label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Paste knowledge content here…"
                      rows={8}
                      className="resize-none font-mono text-sm"
                    />
                  </div>
                  <Button
                    onClick={() => void onCreate()}
                    disabled={!title.trim() || !content.trim()}
                  >
                    <Plus size={14} className="mr-1.5" /> Save Document
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Document list */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Documents ({docs.length})
              </h2>
              {docs.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-10 text-center gap-2">
                    <BookOpen size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No documents yet. Add one above.</p>
                  </CardContent>
                </Card>
              ) : (
                docs.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{doc.title}</p>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {doc.chunk_count} chunk{doc.chunk_count !== 1 ? "s" : ""}
                            </Badge>
                            {doc.source_path && (
                              <Badge variant="outline" className="text-xs font-mono shrink-0">
                                {doc.source_path}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Added {new Date(doc.created_at * 1000).toLocaleDateString()}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive">
                              <Trash2 size={13} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{doc.title}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the document and all its chunks.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => void deleteKnowledgeDoc(doc.id).then(() => refresh())}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
