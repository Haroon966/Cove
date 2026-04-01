import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "../api/tauri";
import type { BackendType } from "../types";
import {
  deleteAgentProfile,
  listAgentProfiles,
  saveAgentProfile,
  setActiveAgentProfile,
  type AgentProfile,
} from "../features/agents/agentProfiles";
import {
  deleteAgentGroup,
  listAgentGroups,
  saveAgentGroup,
  setActiveAgentGroup,
  type AgentGroup,
} from "../features/agents/agentGroups";
import {
  deleteWorkspace,
  listWorkspaces,
  saveWorkspace,
  setActiveWorkspace,
  type WorkspaceRecord,
} from "../features/workspaces/workspaces";
import {
  deleteScheduledTask,
  listScheduledTasks,
  saveScheduledTask,
  type ScheduledTaskRecord,
} from "../features/scheduling/scheduledTasks";
import { listInstalledAgentTemplates, removeAgentTemplate } from "../features/agents/templateCatalog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Bot, Users, FolderOpen, Clock, Package } from "../components/Icons";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const [draftBackend, setDraftBackend] = useState<BackendType | "">("");
  const [draftToolsEnabled, setDraftToolsEnabled] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDesc, setWorkspaceDesc] = useState("");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskRecord[]>([]);
  const [taskName, setTaskName] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [taskIntervalMinutes, setTaskIntervalMinutes] = useState(60);
  const [templates, setTemplates] = useState<
    { id: string; name: string; description: string; system_prompt: string; tags?: string[] | null }[]
  >([]);
  const [status, setStatus] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [templateList, profileList, groupList, workspaceList, taskList, config] = await Promise.all([
        listInstalledAgentTemplates(),
        listAgentProfiles(),
        listAgentGroups(),
        listWorkspaces(),
        listScheduledTasks(),
        invoke<{
          active_agent_profile_id?: string | null;
          active_agent_group_id?: string | null;
          active_workspace_id?: string | null;
        }>("config_load"),
      ]);
      setTemplates(templateList);
      setProfiles(profileList);
      setGroups(groupList);
      setWorkspaces(workspaceList);
      setScheduledTasks(taskList);
      setActiveProfileId(config.active_agent_profile_id ?? null);
      setActiveGroupId(config.active_agent_group_id ?? null);
      setActiveWorkspaceId(config.active_workspace_id ?? null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => { void loadData(); }, []);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => a.name.localeCompare(b.name)),
    [profiles]
  );

  const resetDraft = () => {
    setDraftName(""); setDraftDescription(""); setDraftPrompt("");
    setDraftModel(""); setDraftBackend(""); setDraftToolsEnabled(true);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Agents</h1>
          <p className="text-sm text-muted-foreground">Build and manage local agent profiles</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/discover">Discover Templates</Link>
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {status && (
            <div className={cn(
              "mb-4 px-4 py-2.5 rounded-lg text-sm border",
              status.toLowerCase().includes("error") || status.toLowerCase().includes("fail")
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-primary/10 border-primary/20 text-primary"
            )}>
              {status}
            </div>
          )}

          <Tabs defaultValue="profiles">
            <TabsList className="mb-6">
              <TabsTrigger value="profiles" className="gap-2">
                <Bot size={14} /> Profiles
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-2">
                <Users size={14} /> Groups
              </TabsTrigger>
              <TabsTrigger value="workspaces" className="gap-2">
                <FolderOpen size={14} /> Workspaces
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="gap-2">
                <Clock size={14} /> Scheduled
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <Package size={14} /> Templates
              </TabsTrigger>
            </TabsList>

            {/* PROFILES TAB */}
            <TabsContent value="profiles" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New Agent Profile</CardTitle>
                  <CardDescription>Create a reusable profile with a custom system prompt and model preferences.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder="Profile name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
                      <Input
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        placeholder="Short description"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>System Prompt</Label>
                    <Textarea
                      value={draftPrompt}
                      onChange={(e) => setDraftPrompt(e.target.value)}
                      placeholder="Agent instructions / system prompt…"
                      rows={5}
                      className="resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Preferred Model <span className="text-muted-foreground">(optional)</span></Label>
                      <Input
                        value={draftModel}
                        onChange={(e) => setDraftModel(e.target.value)}
                        placeholder="e.g. llama3"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Preferred Backend <span className="text-muted-foreground">(optional)</span></Label>
                      <Select value={draftBackend || "__inherit__"} onValueChange={(v) => setDraftBackend(v === "__inherit__" ? "" : v as BackendType)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Inherit from settings" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__inherit__">Inherit from settings</SelectItem>
                          <SelectItem value="ollama">Ollama</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="openai_compatible">OpenAI-compatible</SelectItem>
                          <SelectItem value="open_webui">Open WebUI</SelectItem>
                          <SelectItem value="groq">Groq</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="draft-tools" checked={draftToolsEnabled} onCheckedChange={setDraftToolsEnabled} />
                    <Label htmlFor="draft-tools">Enable tools for this profile</Label>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      disabled={!draftName.trim() || !draftPrompt.trim()}
                      onClick={async () => {
                        try {
                          await saveAgentProfile({
                            id: `${draftName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
                            name: draftName.trim(),
                            description: draftDescription.trim() || null,
                            system_prompt: draftPrompt.trim(),
                            preferred_model: draftModel.trim() || null,
                            preferred_backend: (draftBackend || null) as BackendType | null,
                            tools_enabled: draftToolsEnabled,
                          });
                          await loadData(); resetDraft();
                          setStatus("Agent profile created.");
                        } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
                      }}
                    >
                      <Plus size={14} className="mr-1.5" /> Save Profile
                    </Button>
                    <Button variant="outline" onClick={resetDraft}>Clear</Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Profiles ({sortedProfiles.length})
                </h2>
                {sortedProfiles.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center py-10 text-center gap-2">
                      <Bot size={32} className="text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No profiles yet. Create one above.</p>
                    </CardContent>
                  </Card>
                ) : (
                  sortedProfiles.map((profile) => (
                    <Card key={profile.id} className={cn(activeProfileId === profile.id && "border-primary/50 bg-primary/5")}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{profile.name}</span>
                            {activeProfileId === profile.id && (
                              <Badge variant="secondary" className="text-xs">Active</Badge>
                            )}
                            {profile.tools_enabled !== false && (
                              <Badge variant="outline" className="text-xs">Tools on</Badge>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {activeProfileId !== profile.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={async () => {
                                  try {
                                    await setActiveAgentProfile(profile.id);
                                    setActiveProfileId(profile.id);
                                    setStatus(`Active profile: ${profile.name}`);
                                  } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
                                }}
                              >
                                Set active
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                  <Trash2 size={13} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{profile.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => {
                                      try {
                                        await deleteAgentProfile(profile.id); await loadData();
                                        setStatus(`Removed: ${profile.name}`);
                                      } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
                                    }}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {profile.description && (
                          <p className="text-sm text-muted-foreground">{profile.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          backend: {profile.preferred_backend ?? "inherit"} · model: {profile.preferred_model ?? "inherit"}
                        </p>
                        <details className="group">
                          <summary className="text-xs text-primary cursor-pointer select-none">System prompt</summary>
                          <pre className="mt-2 text-xs bg-muted rounded-lg p-3 whitespace-pre-wrap overflow-x-auto max-h-40">
                            {profile.system_prompt}
                          </pre>
                        </details>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* GROUPS TAB */}
            <TabsContent value="groups" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New Group</CardTitle>
                  <CardDescription>Combine profiles for multi-agent orchestration.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Group name</Label>
                    <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Members</Label>
                    {sortedProfiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Create profiles first.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {sortedProfiles.map((profile) => (
                          <label key={profile.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-border accent-primary"
                              checked={groupMembers.includes(profile.id)}
                              onChange={(e) =>
                                setGroupMembers((prev) =>
                                  e.target.checked
                                    ? Array.from(new Set([...prev, profile.id]))
                                    : prev.filter((id) => id !== profile.id)
                                )
                              }
                            />
                            <span className="text-sm">{profile.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      disabled={!groupName.trim() || groupMembers.length === 0}
                      onClick={async () => {
                        try {
                          await saveAgentGroup({
                            id: `${groupName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
                            name: groupName.trim(),
                            member_profile_ids: groupMembers,
                          });
                          setGroupName(""); setGroupMembers([]);
                          await loadData(); setStatus("Agent group saved.");
                        } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
                      }}
                    >
                      <Plus size={14} className="mr-1.5" /> Save Group
                    </Button>
                    <Button variant="outline" onClick={() => { setGroupName(""); setGroupMembers([]); }}>Clear</Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Groups ({groups.length})</h2>
                {groups.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center py-10 text-center gap-2">
                      <Users size={32} className="text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No groups yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  groups.map((group) => (
                    <Card key={group.id} className={cn(activeGroupId === group.id && "border-primary/50 bg-primary/5")}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{group.name}</span>
                            {activeGroupId === group.id && <Badge variant="secondary" className="text-xs">Active</Badge>}
                          </div>
                          <div className="flex gap-1">
                            {activeGroupId !== group.id && (
                              <Button variant="outline" size="sm" className="h-7 text-xs"
                                onClick={async () => {
                                  try { await setActiveAgentGroup(group.id); setActiveGroupId(group.id); setStatus(`Active: ${group.name}`); }
                                  catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
                                }}
                              >Set active</Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{group.name}"?</AlertDialogTitle>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => { try { await deleteAgentGroup(group.id); await loadData(); } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); } }}
                                  >Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Members: {group.member_profile_ids.map((id) => profiles.find((p) => p.id === id)?.name ?? id).join(", ")}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* WORKSPACES TAB */}
            <TabsContent value="workspaces" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New Workspace</CardTitle>
                  <CardDescription>Define project-scoped contexts for agent file operations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Workspace name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
                      <Input value={workspaceDesc} onChange={(e) => setWorkspaceDesc(e.target.value)} placeholder="Short description" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Root Path <span className="text-muted-foreground">(optional)</span></Label>
                    <Input value={workspaceRoot} onChange={(e) => setWorkspaceRoot(e.target.value)} placeholder="/path/to/project" />
                  </div>
                  <Button
                    disabled={!workspaceName.trim()}
                    onClick={async () => {
                      try {
                        await saveWorkspace({
                          id: `${workspaceName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
                          name: workspaceName.trim(),
                          description: workspaceDesc.trim() || null,
                          root_path: workspaceRoot.trim() || null,
                        });
                        setWorkspaceName(""); setWorkspaceDesc(""); setWorkspaceRoot("");
                        await loadData(); setStatus("Workspace saved.");
                      } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
                    }}
                  >
                    <Plus size={14} className="mr-1.5" /> Save Workspace
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Workspaces ({workspaces.length})</h2>
                {workspaces.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center py-10 text-center gap-2">
                      <FolderOpen size={32} className="text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No workspaces yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  workspaces.map((ws) => (
                    <Card key={ws.id} className={cn(activeWorkspaceId === ws.id && "border-primary/50 bg-primary/5")}>
                      <CardContent className="pt-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{ws.name}</span>
                            {activeWorkspaceId === ws.id && <Badge variant="secondary" className="text-xs">Active</Badge>}
                          </div>
                          <div className="flex gap-1">
                            {activeWorkspaceId !== ws.id && (
                              <Button variant="outline" size="sm" className="h-7 text-xs"
                                onClick={async () => {
                                  try { await setActiveWorkspace(ws.id); setActiveWorkspaceId(ws.id); setStatus(`Active: ${ws.name}`); }
                                  catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
                                }}
                              >Set active</Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete "{ws.name}"?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => { try { await deleteWorkspace(ws.id); await loadData(); } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); } }}
                                  >Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {ws.description && <p className="text-sm text-muted-foreground">{ws.description}</p>}
                        {ws.root_path && <p className="text-xs font-mono text-muted-foreground">{ws.root_path}</p>}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* SCHEDULED TASKS TAB */}
            <TabsContent value="scheduled" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New Scheduled Task</CardTitle>
                  <CardDescription>Run a prompt automatically on a recurring interval.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Task name</Label>
                      <Input value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="Task name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Interval (minutes)</Label>
                      <Input
                        type="number" min={1} value={taskIntervalMinutes}
                        onChange={(e) => setTaskIntervalMinutes(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prompt / instruction</Label>
                    <Textarea value={taskPrompt} onChange={(e) => setTaskPrompt(e.target.value)} rows={3} className="resize-none" placeholder="What should the agent do each run?" />
                  </div>
                  <Button
                    disabled={!taskName.trim() || !taskPrompt.trim()}
                    onClick={async () => {
                      try {
                        const now = Math.floor(Date.now() / 1000);
                        await saveScheduledTask({
                          id: `${taskName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
                          name: taskName.trim(),
                          prompt: taskPrompt.trim(),
                          interval_minutes: taskIntervalMinutes,
                          enabled: true,
                          next_run_at: now + taskIntervalMinutes * 60,
                        });
                        setTaskName(""); setTaskPrompt(""); setTaskIntervalMinutes(60);
                        await loadData(); setStatus("Scheduled task created.");
                      } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
                    }}
                  >
                    <Plus size={14} className="mr-1.5" /> Save Task
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tasks ({scheduledTasks.length})</h2>
                {scheduledTasks.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center py-10 text-center gap-2">
                      <Clock size={32} className="text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No scheduled tasks yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  scheduledTasks.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{task.name}</span>
                            <Badge variant={task.enabled ? "secondary" : "outline"} className="text-xs">
                              {task.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-7 text-xs"
                              onClick={async () => {
                                try { await saveScheduledTask({ ...task, enabled: !task.enabled }); await loadData(); }
                                catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
                              }}
                            >{task.enabled ? "Disable" : "Enable"}</Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete "{task.name}"?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => { try { await deleteScheduledTask(task.id); await loadData(); } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); } }}
                                  >Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Every {task.interval_minutes} min · next run:{" "}
                          {task.next_run_at ? new Date(task.next_run_at * 1000).toLocaleString() : "pending"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{task.prompt}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* TEMPLATES TAB */}
            <TabsContent value="templates" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Installed agent templates for local reuse.</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/discover">Browse marketplace</Link>
                </Button>
              </div>
              <Separator />
              {templates.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-10 text-center gap-2">
                    <Package size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No templates installed. Use Discover to import.</p>
                    <Button variant="outline" size="sm" asChild><Link to="/discover">Go to Discover</Link></Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {templates.map((t) => (
                    <Card key={t.id}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{t.name}</p>
                            <p className="text-sm text-muted-foreground">{t.description}</p>
                            {t.tags && t.tags.length > 0 && (
                              <div className="flex gap-1 flex-wrap mt-1">
                                {t.tags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                              </div>
                            )}
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={13} /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Remove "{t.name}"?</AlertDialogTitle></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={async () => { try { await removeAgentTemplate(t.id); await loadData(); } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); } }}
                                >Remove</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        <details>
                          <summary className="text-xs text-primary cursor-pointer">System prompt</summary>
                          <pre className="mt-2 text-xs bg-muted rounded-lg p-3 whitespace-pre-wrap overflow-x-auto max-h-40">{t.system_prompt}</pre>
                        </details>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
