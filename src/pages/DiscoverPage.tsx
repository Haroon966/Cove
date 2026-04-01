import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CURATED_MCP_MARKETPLACE, installMarketplaceMcp } from "../features/mcp/marketplace";
import {
  BUILT_IN_SKILLS,
  loadEnabledSkills,
  loadSkillAutoRecommend,
  loadSkillTrustModes,
  setEnabledSkills,
  setSkillAutoRecommend,
  setSkillTrustModes,
  type SkillTrustMode,
} from "../features/skills/skillsCatalog";
import { CURATED_AGENT_MARKETPLACE, installAgentTemplate } from "../features/agents/templateCatalog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Package, Plug, Zap } from "../components/Icons";
import { cn } from "@/lib/utils";

export default function DiscoverPage() {
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [enabledSkills, setEnabledSkillsState] = useState<string[]>([]);
  const [skillsBusy, setSkillsBusy] = useState(false);
  const [skillAutoRecommend, setSkillAutoRecommendState] = useState(true);
  const [skillTrustModes, setSkillTrustModesState] = useState<Record<string, SkillTrustMode>>({});

  const grouped = useMemo(() => {
    const g: Record<string, typeof CURATED_MCP_MARKETPLACE> = {};
    for (const item of CURATED_MCP_MARKETPLACE) {
      if (!g[item.category]) g[item.category] = [];
      g[item.category].push(item);
    }
    return g;
  }, []);

  useEffect(() => {
    void Promise.all([loadEnabledSkills(), loadSkillAutoRecommend(), loadSkillTrustModes()])
      .then(([enabled, autoRecommend, trustModes]) => {
        setEnabledSkillsState(enabled);
        setSkillAutoRecommendState(autoRecommend);
        setSkillTrustModesState(trustModes);
      })
      .catch(() => {
        setEnabledSkillsState([]);
        setSkillAutoRecommendState(true);
        setSkillTrustModesState({});
      });
  }, []);

  const onInstall = async (id: string) => {
    setInstallingId(id);
    setStatus(null);
    try {
      await installMarketplaceMcp(id);
      setStatus(`Installed ${id}. Manage it in Settings → MCP servers.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setInstallingId(null);
    }
  };

  const onToggleAutoRecommend = async (enabled: boolean) => {
    setSkillsBusy(true);
    setStatus(null);
    try {
      await setSkillAutoRecommend(enabled);
      setSkillAutoRecommendState(enabled);
      setStatus("Skill recommendation setting saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setSkillsBusy(false);
    }
  };

  const onSetSkillTrustMode = async (skillId: string, mode: SkillTrustMode) => {
    setSkillsBusy(true);
    setStatus(null);
    try {
      const next = { ...skillTrustModes, [skillId]: mode };
      await setSkillTrustModes(next);
      setSkillTrustModesState(next);
      setStatus("Skill trust mode saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setSkillsBusy(false);
    }
  };

  const onToggleSkill = async (skillId: string, enabled: boolean) => {
    setSkillsBusy(true);
    setStatus(null);
    try {
      const next = enabled
        ? Array.from(new Set([...enabledSkills, skillId]))
        : enabledSkills.filter((id) => id !== skillId);
      await setEnabledSkills(next);
      setEnabledSkillsState(next);
      setStatus("Skill preferences saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setSkillsBusy(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Discover</h1>
          <p className="text-sm text-muted-foreground">Install MCP servers, agent templates, and built-in skills</p>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {status && (
            <div className={cn(
              "mb-6 px-4 py-2.5 rounded-lg text-sm border",
              status.toLowerCase().includes("error") || status.toLowerCase().includes("fail")
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-primary/10 border-primary/20 text-primary"
            )}>
              {status}
            </div>
          )}

          <Tabs defaultValue="mcp">
            <TabsList className="mb-6">
              <TabsTrigger value="mcp" className="gap-2">
                <Plug size={14} /> MCP Servers
              </TabsTrigger>
              <TabsTrigger value="agents" className="gap-2">
                <Bot size={14} /> Agent Templates
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-2">
                <Zap size={14} /> Built-in Skills
              </TabsTrigger>
            </TabsList>

            {/* MCP SERVERS TAB */}
            <TabsContent value="mcp" className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Install curated MCP servers into your local runtime. They'll appear in Settings → MCP Servers after installation.
              </p>
              {Object.entries(grouped).map(([category, entries]) => (
                <div key={category} className="space-y-3">
                  <h2 className="text-sm font-semibold capitalize text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Package size={13} /> {category}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {entries.map((entry) => (
                      <Card key={entry.id} className="hover:border-primary/40 transition-colors">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-sm">{entry.label}</CardTitle>
                              <CardDescription className="text-xs mt-0.5">{entry.description}</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">{entry.transport}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-xs font-mono text-muted-foreground mb-3 truncate">{entry.endpoint}</p>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => void onInstall(entry.id)}
                            disabled={installingId === entry.id}
                          >
                            {installingId === entry.id ? "Installing…" : "Install"}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(grouped).length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-10 text-center gap-2">
                    <Package size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No MCP servers in the marketplace.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* AGENT TEMPLATES TAB */}
            <TabsContent value="agents" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Curated agent templates ready to import.</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/agents">Manage Agents →</Link>
                </Button>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CURATED_AGENT_MARKETPLACE.map((template) => (
                  <Card key={template.id} className="hover:border-primary/40 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                      <CardDescription className="text-xs">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-3">
                          {template.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={async () => {
                          setInstallingId(template.id);
                          setStatus(null);
                          try {
                            await installAgentTemplate(template.id);
                            setStatus(`Imported "${template.name}". Open Agents page to manage.`);
                          } catch (e) {
                            setStatus(e instanceof Error ? e.message : String(e));
                          } finally {
                            setInstallingId(null);
                          }
                        }}
                        disabled={installingId === template.id}
                      >
                        {installingId === template.id ? "Importing…" : "Import template"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {CURATED_AGENT_MARKETPLACE.length === 0 && (
                  <Card className="border-dashed col-span-2">
                    <CardContent className="flex flex-col items-center py-10 text-center gap-2">
                      <Bot size={32} className="text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No agent templates available.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* BUILT-IN SKILLS TAB */}
            <TabsContent value="skills" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Toggle built-in skills to enhance agent capabilities. Changes take effect immediately.
              </p>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Auto recommend skills</p>
                      <p className="text-xs text-muted-foreground">
                        Detect intent per prompt and activate trusted skills automatically.
                      </p>
                    </div>
                    <Switch
                      checked={skillAutoRecommend}
                      disabled={skillsBusy}
                      onCheckedChange={(checked) => void onToggleAutoRecommend(checked)}
                    />
                  </div>
                </CardContent>
              </Card>
              <Separator />
              <div className="space-y-3">
                {BUILT_IN_SKILLS.map((skill) => {
                  const enabled = enabledSkills.includes(skill.id);
                  const trustMode = skillTrustModes[skill.id] ?? skill.defaultTrustMode ?? "auto";
                  return (
                    <Card key={skill.id} className={cn(enabled && "border-primary/40 bg-primary/5")}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{skill.title}</p>
                              <Badge variant="outline" className="text-xs">{skill.domain}</Badge>
                              <Badge variant="secondary" className="text-xs">risk: {skill.risk}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{skill.description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Label htmlFor={`skill-${skill.id}`} className="text-xs text-muted-foreground sr-only">
                              {enabled ? "Enabled" : "Disabled"}
                            </Label>
                            <Switch
                              id={`skill-${skill.id}`}
                              checked={enabled}
                              disabled={skillsBusy}
                              onCheckedChange={(checked) => void onToggleSkill(skill.id, checked)}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {(skill.toolAllowList ?? []).map((tool) => (
                            <Badge key={tool} variant="outline" className="text-[10px]">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Trust mode:</span>
                          <Button
                            size="sm"
                            variant={trustMode === "auto" ? "default" : "outline"}
                            className="h-6 text-[11px]"
                            disabled={skillsBusy}
                            onClick={() => void onSetSkillTrustMode(skill.id, "auto")}
                          >
                            Auto
                          </Button>
                          <Button
                            size="sm"
                            variant={trustMode === "ask" ? "default" : "outline"}
                            className="h-6 text-[11px]"
                            disabled={skillsBusy}
                            onClick={() => void onSetSkillTrustMode(skill.id, "ask")}
                          >
                            Ask first
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {BUILT_IN_SKILLS.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center py-10 text-center gap-2">
                      <Zap size={32} className="text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No built-in skills available.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
