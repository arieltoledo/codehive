import { useState, useRef, useEffect, useCallback } from 'react';
import { Users, Send, Book, FileText, X, LayoutGrid, Upload, FilePlus, ChevronDown, ChevronRight, Hash, Bell, Settings, Search, PlusCircle, Target, Bot, Folder } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useDashboard } from './hooks/useDashboard';
import { ProjectGrid } from './components/ProjectGrid';

const App = () => {
  const { projects, projectId, setProjectId, agents, messages, memoryFiles, goals, subagents, subagentInstances, subagentSchemas, initSteps, clearInitSteps, sendMessage, createGoal, createSubagent, updateSubagent, launchSubagent, deleteSubagent, completeSubagentInstance, failSubagentInstance, createProject, fetchDirListing, approvePlan, deleteProject, uploadFile, createFile, analytics, activity, notifications, unreadCount, markAllRead } = useDashboard();
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ agent_id: '', title: '', description: '', stop_condition: '', max_iterations: 10 });

  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [showMentions, setShowMentions] = useState(false);
  const mentionRef = useRef<HTMLDivElement>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; agent: any } | null>(null);

  // Subagent modal
  const [showSubagentModal, setShowSubagentModal] = useState(false);
  const [subagentTargetAgent, setSubagentTargetAgent] = useState<any>(null);
  const [subagentForm, setSubagentForm] = useState({ name: '', instructions: '', fields: {} as Record<string, any> });
  const [subagentSchema, setSubagentSchema] = useState<any>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  // Subagent management modal
  const [showSubagentManage, setShowSubagentManage] = useState(false);

  // Subagent editor (view/edit)
  const [editingSubagent, setEditingSubagent] = useState<any | null>(null);
  const [editorTargetAgent, setEditorTargetAgent] = useState('');
  const [editorInstructions, setEditorInstructions] = useState('');
  const [editorFields, setEditorFields] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Launch confirmation modal
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);
  const [launchConfirmName, setLaunchConfirmName] = useState('');

  // New project modal
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({ name: '', description: '', rootPath: '', initGit: true });
  const [isCreating, setIsCreating] = useState(false);

  // File browser
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(true);
  const [sharedExpanded, setSharedExpanded] = useState(true);
  const [goalsExpanded, setGoalsExpanded] = useState(true);
  const [subagentsExpanded, setSubagentsExpanded] = useState(true);
  const [fileBrowserPath, setFileBrowserPath] = useState('');
  const [fileBrowserEntries, setFileBrowserEntries] = useState<any[]>([]);
  const [fileBrowserLoading, setFileBrowserLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleAgent = (id: string) => {
    setExpandedAgents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!showNotifications) return;
    const handler = () => setShowNotifications(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showNotifications]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const text = inputValue.trim();

    if (text === '/goal') {
      setShowGoalModal(true);
      setInputValue('');
      return;
    }

    if (text === '/goal list') {
      try {
        const res = await fetch(`/api/goals?project_id=${projectId}`);
        const goalsData = await res.json();
        const lines = goalsData.length === 0
          ? 'No goals found.'
          : goalsData.map((g: any) =>
              `**${g.title}** — ${g.status} (iter: ${g.iterationCount}/${g.maxIterations || '∞'}, agent: ${g.agentId})`
            ).join('\n');
        await sendMessage(`📋 **Goal List**\n${lines}`, undefined, 'system');
      } catch (err) {
        console.error(err);
      }
      setInputValue('');
      return;
    }

    const statusMatch = text.match(/^\/goal status\s+(.+)/);
    if (statusMatch) {
      try {
        const res = await fetch(`/api/goals/${statusMatch[1]}`);
        const g = await res.json();
        if (!g) {
          await sendMessage(`❌ Goal \`${statusMatch[1]}\` not found`, undefined, 'system');
        } else {
          await sendMessage(
            `📊 **Goal: ${g.title}**\nStatus: ${g.status}\nAgent: ${g.agentId}\nDescription: ${g.description}\nStop condition: ${g.stopCondition || '—'}\nIterations: ${g.iterationCount}/${g.maxIterations || '∞'}\nProgress: ${g.progress || '—'}\nCreated: ${new Date(g.createdAt).toLocaleString()}`,
            undefined, 'system'
          );
        }
      } catch (err) {
        await sendMessage(`❌ Error fetching goal: ${(err as Error).message}`, undefined, 'system');
      }
      setInputValue('');
      return;
    }

    const completeMatch = text.match(/^\/goal complete\s+(.+)/);
    if (completeMatch) {
      try {
        await fetch(`/api/goals/${completeMatch[1]}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        await sendMessage(`✅ Goal \`${completeMatch[1]}\` marked as completed`, undefined, 'system');
      } catch (err) {
        await sendMessage(`❌ Error: ${(err as Error).message}`, undefined, 'system');
      }
      setInputValue('');
      return;
    }

    const pauseMatch = text.match(/^\/goal pause\s+(.+)/);
    if (pauseMatch) {
      try {
        await fetch(`/api/goals/${pauseMatch[1]}/pause`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: 'Paused via chat' }) });
        await sendMessage(`⏸️ Goal \`${pauseMatch[1]}\` paused`, undefined, 'system');
      } catch (err) {
        await sendMessage(`❌ Error: ${(err as Error).message}`, undefined, 'system');
      }
      setInputValue('');
      return;
    }

    // /subagent command: /subagent @agentname [key=value ...]
    const subagentMatch = text.match(/^\/subagent\s+@(\S+)\s+(.+)/);
    if (subagentMatch) {
      const targetName = subagentMatch[1];
      const rest = subagentMatch[2];
      const agent = agents.find((a: any) => a.name.toLowerCase() === targetName.toLowerCase() || a.agent_id === targetName);
      if (!agent) {
        await sendMessage(`❌ Agent @${targetName} not found`, undefined, 'system');
        setInputValue('');
        return;
      }

      // Parse key=value pairs
      const parts = rest.match(/(?:--(\w+)\s+"([^"]*)"|--(\w+)\s+(\S+))/g);
      const args: Record<string, string> = {};
      if (parts) {
        for (const p of parts) {
          const m = p.match(/--(\w+)\s+"([^"]*)"/) || p.match(/--(\w+)\s+(\S+)/);
          if (m) args[m[1]] = m[2] || m[3];
        }
      }
      const name = args.name || targetName + '-sub';
      const instructions = args.instructions || args.prompt || args.i || rest.replace(/(?:--\w+\s+"[^"]*"|--\w+\s+\S+)/g, '').trim();
      const schema = subagentSchemas.find((s: any) => agent.provider?.toLowerCase().includes(s.agentType.replace('-', '')));

      try {
        await createSubagent({
          name, agentType: schema?.agentType || 'generic', targetAgentId: agent.agent_id, instructions, fields: args,
        });
        await sendMessage(`🤖 Subagent **${name}** created for @${agent.name}`, undefined, 'system');
        // Auto-launch (creates running instance)
        await launchSubagent(name);
        await sendMessage(`🚀 Subagent **${name}** launched — running instance created`, undefined, 'system');
      } catch (err) {
        await sendMessage(`❌ ${(err as Error).message}`, undefined, 'system');
      }
      setInputValue('');
      return;
    }

    try {
      await sendMessage(text);
      setInputValue('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleReadFile = async (file: any) => {
    try {
      if (file.type === 'markdown') {
        const response = await fetch(`/api/projects/${projectId}/memory/${file.filename}`);
        const text = await response.text();
        setFileContent(text);
      }
      setSelectedFile(file);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    } catch (err) {
      alert('Upload failed');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleCreateFile = async () => {
    const filename = prompt('Enter filename (e.g., notes.md):');
    if (!filename) return;
    try {
      await createFile(filename);
    } catch (err) {
      alert('Failed to create file');
    }
  };

  const handleApprove = async () => {
    if (!selectedFile) return;
    setIsApproving(true);
    try {
      await approvePlan(selectedFile.filename);
      setSelectedFile(null);
    } catch (err) {
      alert('Failed to approve plan');
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.agent_id || !goalForm.title || !goalForm.description) return;
    try {
      await createGoal(goalForm);
      await sendMessage(`🎯 Goal created: **${goalForm.title}** (assigned to ${goalForm.agent_id})`);
      setShowGoalModal(false);
      setGoalForm({ agent_id: '', title: '', description: '', stop_condition: '', max_iterations: 10 });
    } catch (err) {
      alert('Failed to create goal');
    }
  };

  // @mention input handling
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setShowMentions(true);
      setMentionIndex(-1);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (agent: any) => {
    const cursorPos = (document.getElementById('chat-input') as HTMLInputElement)?.selectionStart || inputValue.length;
    const textBefore = inputValue.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (!atMatch) return;
    const before = inputValue.slice(0, cursorPos - atMatch[0].length);
    const after = inputValue.slice(cursorPos);
    setInputValue(`${before}@${agent.name} ${after}`);
    setShowMentions(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentions) return;
    const filtered = agents.filter((a: any) => a.name.toLowerCase().includes(mentionQuery));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (mentionIndex >= 0 && filtered[mentionIndex]) {
        e.preventDefault();
        selectMention(filtered[mentionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, agent: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, agent });
  }, []);

  const closeContextMenu = () => setContextMenu(null);

  const handleLaunchSubagent = (agent: any) => {
    closeContextMenu();
    const schema = subagentSchemas.find((s: any) => agent.provider?.toLowerCase().includes(s.agentType.replace('-', '')) || s.agentType === agent.provider);
    setSubagentSchema(schema || subagentSchemas[0] || null);
    setSubagentTargetAgent(agent);
    setSubagentForm({ name: '', instructions: '', fields: {} });
    setShowSubagentModal(true);
  };

  const handleScheduleWakeup = (agent: any) => {
    closeContextMenu();
    const wakeupAt = prompt('Schedule wake-up (ISO datetime, e.g. 2026-06-24T10:00:00):');
    if (!wakeupAt) return;
    const command = prompt('Command to run on wake-up:', `cd ${window.location.pathname} && ${agent.provider} --prompt "Wake-up call from CodeHive"`);
    if (!command) return;
    fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agent.agent_id, wakeup_at: wakeupAt, command })
    }).then(async () => {
      await sendMessage(`⏰ Scheduled wake-up for **${agent.name}** at ${new Date(wakeupAt).toLocaleString()}`, undefined, 'system');
    }).catch(err => alert(`Schedule failed: ${err.message}`));
  };

  const handleViewDetails = async (agent: any) => {
    closeContextMenu();
    await sendMessage(
      `📋 **Agent: ${agent.name}**\nID: \`${agent.agent_id}\`\nProvider: ${agent.provider}\nRole: ${agent.role}\nStatus: ${agent.status}\nParent: ${agent.parent_agent_id || '—'}`,
      undefined, 'system'
    );
  };

  // Subagent modal
  const handleCreateSubagent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subagentForm.name || !subagentForm.instructions || !subagentTargetAgent) return;
    try {
      await createSubagent({
        name: subagentForm.name,
        agentType: subagentSchema?.agentType || 'generic',
        targetAgentId: subagentTargetAgent.agent_id,
        instructions: subagentForm.instructions,
        fields: subagentForm.fields,
      });
      await sendMessage(`🤖 Subagent **${subagentForm.name}** created for @${subagentTargetAgent.name}`, undefined, 'system');
      setShowSubagentModal(false);
      setSubagentForm({ name: '', instructions: '', fields: {} });
    } catch (err) {
      alert(`Failed to create subagent: ${(err as Error).message}`);
    }
  };

  const handleLaunchExisting = (name: string) => {
    setLaunchConfirmName(name);
    setShowLaunchConfirm(true);
  };

  const confirmLaunch = async () => {
    if (!launchConfirmName) return;
    setIsLaunching(true);
    setShowLaunchConfirm(false);
    try {
      await launchSubagent(launchConfirmName);
      await sendMessage(`🚀 Subagent **${launchConfirmName}** launched — running instance created`, undefined, 'system');
    } catch (err) {
      await sendMessage(`❌ Launch failed: ${(err as Error).message}`, undefined, 'system');
    } finally {
      setIsLaunching(false);
      setLaunchConfirmName('');
    }
  };

  const updateSubagentField = (fieldName: string, value: any) => {
    setSubagentForm(f => ({ ...f, fields: { ...f.fields, [fieldName]: value } }));
  };

  const currentProject = projects.find(p => p.id === projectId);

  return (
    <div className="flex h-screen overflow-hidden bg-discord-black text-discord-light selection:bg-discord-blurple/30 font-sans">
      
      {/* 1. SERVER SIDEBAR (Projects) */}
      <nav className="w-[72px] bg-discord-black flex flex-col items-center py-3 space-y-2 shrink-0 border-r border-black/10">
        <button 
          onClick={() => setProjectId(null)}
          className={`w-12 h-12 rounded-[24px] flex items-center justify-center transition-all duration-200 group relative ${
            !projectId ? 'bg-discord-blurple rounded-[16px]' : 'bg-discord-dark hover:bg-discord-blurple hover:rounded-[16px]'
          }`}
        >
          <div className={`absolute -left-1 w-1 bg-white transition-all rounded-r-full ${!projectId ? 'h-10' : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'}`} />
          <LayoutGrid className={`w-6 h-6 transition-colors ${!projectId ? 'text-white' : 'text-discord-cyan group-hover:text-white'}`} />
        </button>

        <div className="w-8 h-[2px] bg-white/5 rounded-full" />

        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => setProjectId(p.id)}
            className={`w-12 h-12 rounded-[24px] flex items-center justify-center transition-all duration-200 group relative overflow-hidden ${
              projectId === p.id ? 'bg-discord-blurple rounded-[16px]' : 'bg-discord-dark hover:bg-discord-blurple hover:rounded-[16px]'
            }`}
            title={p.name}
          >
            <div className={`absolute -left-1 w-1 bg-white transition-all rounded-r-full ${projectId === p.id ? 'h-10' : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'}`} />
            <span className={`text-xs font-bold ${projectId === p.id ? 'text-white' : 'text-discord-muted group-hover:text-white'}`}>
              {p.name.substring(0, 2).toUpperCase()}
            </span>
          </button>
        ))}

        <button onClick={() => setShowNewProjectModal(true)} className="w-12 h-12 rounded-[24px] bg-discord-dark flex items-center justify-center transition-all duration-200 hover:bg-discord-green hover:rounded-[16px] group">
          <PlusCircle className="w-6 h-6 text-discord-green group-hover:text-white" />
        </button>
      </nav>

      <div className="flex flex-1 overflow-hidden bg-discord-dark">
        {!projectId ? (
          <ProjectGrid 
            projects={projects} 
            onSelectProject={setProjectId} 
            onDeleteProject={deleteProject} 
          />
        ) : (
          <>
            {/* 2. CHANNEL SIDEBAR (Agents & Squads) */}
            <aside className="w-60 bg-discord-darker flex flex-col shrink-0">
              <header className="h-12 px-4 flex items-center border-b border-black/10 shadow-sm">
                <h2 className="text-sm font-black text-white truncate">{currentProject?.name.toUpperCase()}</h2>
              </header>

              <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                {analytics && (
                  <div>
                    <div className="px-2 text-[11px] font-bold text-discord-muted uppercase tracking-wider mb-2">ANALYTICS</div>
                    <div className="grid grid-cols-2 gap-1 px-2">
                      <div className="bg-discord-dark/50 rounded p-2">
                        <div className="text-[18px] font-black text-white">{analytics.agents?.working || 0}</div>
                        <div className="text-[8px] text-discord-muted uppercase tracking-wider">Agents</div>
                      </div>
                      <div className="bg-discord-dark/50 rounded p-2">
                        <div className="text-[18px] font-black text-white">{analytics.tasks?.active || 0}</div>
                        <div className="text-[8px] text-discord-muted uppercase tracking-wider">Tasks</div>
                      </div>
                      <div className="bg-discord-dark/50 rounded p-2">
                        <div className="text-[18px] font-black text-white">{analytics.goals?.in_progress || 0}</div>
                        <div className="text-[8px] text-discord-muted uppercase tracking-wider">Goals</div>
                      </div>
                      <div className="bg-discord-dark/50 rounded p-2">
                        <div className="text-[18px] font-black text-white">{analytics.messages?.today || 0}</div>
                        <div className="text-[8px] text-discord-muted uppercase tracking-wider">Msgs</div>
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <div className="px-2 flex items-center text-[11px] font-bold text-discord-muted uppercase tracking-wider mb-2">
                    <ChevronDown className="w-3 h-3 mr-1" /> ACTIVE_AGENTS
                  </div>
                  <div className="space-y-0.5">
                    {agents.filter(a => !a.parent_agent_id).map(parent => (
                      <div key={parent.agent_id} className="space-y-0.5">
                        <button 
                          onClick={() => toggleAgent(parent.agent_id)}
                          onContextMenu={(e) => handleContextMenu(e, parent)}
                          className={`w-full group px-2 py-1.5 rounded flex items-center transition-colors ${
                            expandedAgents[parent.agent_id] ? 'bg-white/10 text-white' : 'text-discord-muted hover:bg-white/5 hover:text-discord-light'
                          }`}
                        >
                          <Hash className="w-4 h-4 mr-1.5 opacity-60" />
                          <span className="text-sm font-semibold truncate flex-1 text-left">{parent.name}</span>
                          {agents.filter(a => a.parent_agent_id === parent.agent_id).length > 0 && (
                             <ChevronRight className={`w-3 h-3 transition-transform ${expandedAgents[parent.agent_id] ? 'rotate-90' : ''}`} />
                          )}
                        </button>

                        {expandedAgents[parent.agent_id] && (
                          <div className="ml-6 space-y-0.5">
                            {agents.filter(a => a.parent_agent_id === parent.agent_id).map(sub => (
                              <button key={sub.agent_id} onContextMenu={(e) => handleContextMenu(e, sub)} className="w-full px-2 py-1.5 rounded flex items-center text-discord-muted hover:bg-white/5 hover:text-discord-light transition-colors group">
                                <div className={`w-2 h-2 rounded-full mr-2 ${sub.status === 'working' ? 'bg-discord-green' : 'bg-discord-muted/40'}`} />
                                <span className="text-[13px] font-medium truncate">{sub.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* User Identity Panel */}
              <div className="h-14 bg-discord-darkest px-2 flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center text-white font-bold text-xs">H</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate leading-tight">Human_Supervisor</div>
                  <div className="text-[10px] text-discord-muted truncate">#0001</div>
                </div>
                <div className="flex items-center text-discord-muted">
                  <button className="p-1.5 hover:bg-white/5 rounded transition-colors"><Settings className="w-4 h-4" /></button>
                </div>
              </div>
            </aside>

            {/* 3. MAIN CHAT AREA */}
            <main className="flex-1 flex flex-col min-w-0 bg-discord-dark relative">
              <header className="h-12 px-4 flex items-center border-b border-black/10 shadow-sm z-10">
                <Hash className="w-6 h-6 text-discord-muted mr-2" />
                <h3 className="text-sm font-bold text-white mr-auto">coordination_room</h3>
                <div className="flex items-center space-x-4 text-discord-muted">
                  <div className="relative">
                    <Bell className="w-5 h-5 cursor-pointer hover:text-discord-light transition-colors"
                      onClick={() => { setShowNotifications(!showNotifications); if (showNotifications) markAllRead(); }} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-discord-red text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                    {showNotifications && (
                      <div className="absolute top-full right-0 mt-2 w-80 bg-discord-darkest border border-white/10 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-3 text-[11px] font-bold text-discord-muted uppercase tracking-wider border-b border-white/5">NOTIFICATIONS</div>
                        {notifications.length === 0 && (
                          <div className="p-4 text-xs text-discord-muted/50 text-center">No notifications</div>
                        )}
                        {notifications.map((n: any, i: number) => (
                          <div key={`${n.id}-${i}`} className={`px-3 py-2.5 border-b border-white/5 text-xs ${n.read ? 'opacity-50' : ''}`}>
                            <div className="flex items-center space-x-2">
                              <span>{n.message}</span>
                            </div>
                            <div className="text-[9px] text-discord-muted mt-1">{format(new Date(n.timestamp), 'HH:mm')}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <input type="text" placeholder="Search" className="bg-discord-darkest rounded h-6 text-xs px-2 w-36 focus:w-48 transition-all outline-none" />
                    <Search className="w-3.5 h-3.5 absolute right-2 top-1.5" />
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">
                {[...messages].reverse().map((msg) => (
                  <div key={msg.message_id} className="flex space-x-4 group">
                    <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm ${
                      msg.sender_id === 'human_supervisor' ? 'bg-discord-blurple' : 'bg-discord-green'
                    }`}>
                      {msg.sender_id.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline space-x-2 mb-0.5">
                        <span className={`text-[15px] font-bold hover:underline cursor-pointer ${
                          msg.sender_id === 'human_supervisor' ? 'text-white' : 'text-discord-green'
                        }`}>
                          {msg.sender_id}
                        </span>
                        <span className="text-[10px] text-discord-muted font-bold tracking-tighter opacity-70">
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                      </div>
                      <div className={`text-[15px] leading-relaxed text-discord-light whitespace-pre-wrap ${
                        msg.messageType === 'system' ? 'italic text-discord-muted bg-discord-darkest/30 p-2 rounded-lg border-l-2 border-discord-cyan/30' : ''
                      }`}>
                        {msg.message.split(/(@\w+)/g).map((part: string, i: number) => {
                          if (part.startsWith('@') && agents.some((a: any) => a.name === part.slice(1) || a.agent_id === part.slice(1))) {
                            return <span key={i} className="text-discord-cyan font-bold">{part}</span>;
                          }
                          return part;
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="px-4 pb-6 bg-discord-dark relative">
                <form onSubmit={handleSend} className="bg-discord-darker rounded-lg px-4 flex items-center space-x-4 min-h-[44px]">
                  <PlusCircle className="w-6 h-6 text-discord-muted hover:text-white cursor-pointer transition-colors" />
                  <div className="flex-1 relative">
                    <input
                      id="chat-input"
                      type="text"
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleInputKeyDown}
                      placeholder={`Message #coordination_room`}
                      className="w-full bg-transparent text-sm py-3 outline-none placeholder-discord-muted"
                    />
                    {showMentions && (
                      <div ref={mentionRef} className="absolute bottom-full left-0 mb-1 w-56 bg-discord-darkest border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
                        {agents.filter((a: any) => a.name.toLowerCase().includes(mentionQuery)).map((a: any, i: number) => (
                          <button
                            key={a.agent_id}
                            type="button"
                            onClick={() => selectMention(a)}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center space-x-2 transition-colors ${
                              i === mentionIndex ? 'bg-discord-blurple/30 text-white' : 'text-discord-muted hover:bg-white/5 hover:text-discord-light'
                            }`}
                          >
                            <Hash className="w-3 h-3 shrink-0" />
                            <span className="font-medium">{a.name}</span>
                            <span className="text-[10px] text-discord-muted/60 ml-auto">{a.provider}</span>
                          </button>
                        ))}
                        {agents.filter((a: any) => a.name.toLowerCase().includes(mentionQuery)).length === 0 && (
                          <div className="px-3 py-2 text-xs text-discord-muted/50">No agents found</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button type="submit" className="p-2 text-discord-muted hover:text-white transition-colors">
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </main>

            {/* 4. UTILITY SIDEBAR (Memory & Tasks) */}
            <aside className="w-96 bg-discord-darker border-l border-black/10 flex flex-col shrink-0 hidden lg:flex">
               <header className="h-12 px-4 flex items-center border-b border-black/10 shadow-sm shrink-0">
                <Users className="w-5 h-5 text-discord-muted mr-2" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tactical_Brief</h3>
              </header>

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Memory Files - collapsible */}
                <div className={`${sharedExpanded ? 'flex-1' : 'flex-none'} flex flex-col min-h-0 border-b border-white/5`}>
                  <div
                    className="p-4 flex items-center justify-between text-[11px] font-bold text-discord-muted uppercase tracking-wider bg-black/5 cursor-pointer hover:text-discord-light select-none"
                    onClick={() => setSharedExpanded(!sharedExpanded)}
                  >
                    <span className="flex items-center">
                      <ChevronRight className={`w-3 h-3 mr-1 transition-transform ${sharedExpanded ? 'rotate-90' : ''}`} />
                      <Book className="w-3.5 h-3.5 mr-2 text-discord-cyan" /> SHARED_RESOURCES
                    </span>
                    <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                      <FilePlus onClick={handleCreateFile} className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
                      <Upload onClick={() => fileInputRef.current?.click()} className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
                    </div>
                  </div>
                  
                  {sharedExpanded && (<>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e.target.files)} multiple />
                  
                  <div 
                    className={`flex-1 overflow-y-auto p-4 space-y-2 transition-all custom-scrollbar ${isDragging ? 'bg-discord-blurple/10 ring-2 ring-discord-blurple/30 ring-inset' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    {memoryFiles.length === 0 && !isDragging && (
                      <div className="h-full flex flex-col items-center justify-center text-discord-muted/30 text-center space-y-3">
                        <Upload className="w-12 h-12 opacity-10" />
                        <p className="text-[10px] font-bold uppercase tracking-widest leading-loose">
                          Drop intelligence data here<br/>to synchronize with agents
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-2">
                      {memoryFiles.map(file => (
                        <button
                          key={file.filename}
                          onClick={() => handleReadFile(file)}
                          className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group flex items-start space-x-3 ${
                            file.status === 'pending' ? 'bg-discord-yellow/10 border-discord-yellow/20' : 
                            file.status === 'approved' ? 'bg-discord-green/10 border-discord-green/20' : 
                            'bg-discord-dark border-white/5 hover:bg-discord-darkest hover:border-discord-cyan/30'
                          }`}
                        >
                          <div className={`p-2 rounded-lg bg-black/20 shrink-0 group-hover:scale-110 transition-transform ${
                            file.type === 'pdf' ? 'text-discord-red' : file.type === 'image' ? 'text-discord-cyan' : 'text-discord-muted'
                          }`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-bold text-discord-light group-hover:text-discord-cyan truncate tracking-tight uppercase">
                              {file.filename}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[9px] text-discord-muted font-bold">{file.type.toUpperCase()}</span>
                              {file.status !== 'none' && (
                                <span className={`text-[8px] font-black px-1 rounded ${
                                  file.status === 'pending' ? 'text-discord-yellow' : 'text-discord-green'
                                }`}>
                                  {file.status.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  </>)}
                </div>

                {/* Goals Section */}
                <div className="flex-none border-b border-white/5">
                  <div
                    className="p-3 text-[11px] font-bold text-discord-muted uppercase tracking-wider flex items-center bg-black/5 cursor-pointer hover:text-discord-light select-none"
                    onClick={() => setGoalsExpanded(!goalsExpanded)}
                  >
                    <ChevronRight className={`w-3 h-3 mr-1 transition-transform ${goalsExpanded ? 'rotate-90' : ''}`} />
                    <Target className="w-3.5 h-3.5 mr-2 text-discord-cyan" /> ACTIVE_GOALS
                    <button type="button" onClick={(e) => { e.stopPropagation(); setGoalForm({ agent_id: '', title: '', description: '', stop_condition: '', max_iterations: 10 }); setShowGoalModal(true); }} className="ml-auto text-discord-muted hover:text-white transition-colors">
                      <PlusCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {goalsExpanded && (
                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {goals.filter((g: any) => g.status === 'in_progress' || g.status === 'paused').length === 0 && (
                      <div className="text-[10px] text-discord-muted/40 text-center py-4">No active goals</div>
                    )}
                    {goals.filter((g: any) => g.status === 'in_progress' || g.status === 'paused').map((goal: any) => (
                      <div key={goal.goalId} className="bg-discord-dark/50 rounded-lg p-2.5 border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-discord-cyan">{goal.title}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                            goal.status === 'in_progress' ? 'bg-discord-green/20 text-discord-green' : 'bg-discord-yellow/20 text-discord-yellow'
                          }`}>{goal.status === 'in_progress' ? 'ACTIVE' : 'PAUSED'}</span>
                        </div>
                        <div className="text-[10px] text-discord-muted truncate">{goal.description}</div>
                        <div className="flex items-center justify-between mt-1.5 text-[9px] text-discord-muted">
                          <span>Agent: {goal.agentId}</span>
                          <span>Iteration: {goal.iterationCount}{goal.maxIterations ? `/${goal.maxIterations}` : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>

                {/* Subagents Section — Running Instances */}
                <div className="flex-none border-b border-white/5">
                  <div
                    className="p-3 text-[11px] font-bold text-discord-muted uppercase tracking-wider flex items-center bg-black/5 cursor-pointer hover:text-discord-light select-none"
                    onClick={() => setSubagentsExpanded(!subagentsExpanded)}
                  >
                    <ChevronRight className={`w-3 h-3 mr-1 transition-transform ${subagentsExpanded ? 'rotate-90' : ''}`} />
                    <Bot className="w-3.5 h-3.5 mr-2 text-discord-cyan" /> SUBAGENTS
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowSubagentManage(true); }} className="ml-auto text-discord-muted hover:text-white transition-colors" title="Manage definitions">
                      <Settings className="w-3 h-3" />
                    </button>
                  </div>
                  {subagentsExpanded && (
                  <div className="max-h-[160px] overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {subagentInstances.length === 0 && (
                      <div className="text-[10px] text-discord-muted/40 text-center py-4">No running instances</div>
                    )}
                    {subagentInstances.map((inst: any) => (
                      <div key={inst.id} className="bg-discord-dark/50 rounded-lg p-2.5 border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-discord-cyan">{inst.subagent_name}</span>
                          <div className="flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-pulse" title="running" />
                            <button type="button" onClick={async () => {
                              try {
                                await completeSubagentInstance(inst.subagent_name);
                                await sendMessage(`✅ Subagent **${inst.subagent_name}** marked as completed`, undefined, 'system');
                              } catch (err) {
                                await sendMessage(`❌ ${(err as Error).message}`, undefined, 'system');
                              }
                            }}
                              className="text-[8px] text-discord-muted hover:text-discord-green px-1 transition-colors"
                              title="Mark complete"
                            >✓</button>
                            <button type="button" onClick={async () => {
                              try {
                                await failSubagentInstance(inst.subagent_name);
                                await sendMessage(`⚠️ Subagent **${inst.subagent_name}** marked as failed`, undefined, 'system');
                              } catch (err) {
                                await sendMessage(`❌ ${(err as Error).message}`, undefined, 'system');
                              }
                            }}
                              className="text-[8px] text-discord-muted hover:text-discord-red px-1 transition-colors"
                              title="Mark failed"
                            >✕</button>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-[9px] text-discord-muted">
                          <span className="text-[10px]">@{inst.target_agent_id}</span>
                          <span className="text-[8px] uppercase opacity-60">{inst.agent_type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>

                {/* Activity Log - Unified timeline */}
                <div className="h-1/3 flex flex-col min-h-0 bg-black/10">
                  <div
                    className="p-3 text-[11px] font-bold text-discord-muted uppercase tracking-wider border-b border-white/5 flex items-center cursor-pointer hover:text-discord-light select-none"
                    onClick={() => setActivityExpanded(!activityExpanded)}
                  >
                    <ChevronRight className={`w-3 h-3 mr-1 transition-transform ${activityExpanded ? 'rotate-90' : ''}`} />
                    ACTIVITY_LOG
                  </div>
                  {activityExpanded && (
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                      {activity.length === 0 && (
                        <div className="text-[10px] text-discord-muted/40 text-center py-4">No activity yet</div>
                      )}
                      {activity.slice(0, 50).map((item: any, i: number) => (
                        <div key={`${item.type}-${item.id}-${i}`} className="flex items-start space-x-2 px-1 py-1.5 rounded hover:bg-white/5 transition-colors">
                          <span className="mt-0.5">
                            {item.type === 'goal' ? '🎯' : item.type === 'task' ? '⚡' : item.type === 'decision' ? '📝' : '💬'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-medium text-discord-light truncate leading-tight">{item.summary}</div>
                            <div className="flex items-center space-x-2 text-[8px] text-discord-muted mt-0.5">
                              <span>@{item.agentId}</span>
                              <span>{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* 5. FILE PREVIEW MODAL */}
            {selectedFile && (
              <div className="absolute inset-0 z-50 bg-discord-black/95 backdrop-blur-sm flex flex-col">
                <header className="h-14 px-6 flex items-center justify-between border-b border-white/5 bg-discord-darkest">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-discord-dark rounded-lg"><FileText className="w-5 h-5 text-discord-cyan" /></div>
                    <h2 className="text-base font-bold text-white uppercase tracking-tight">{selectedFile.filename}</h2>
                  </div>
                  <div className="flex items-center space-x-4">
                    {selectedFile.status === 'pending' && (
                      <button onClick={handleApprove} disabled={isApproving} className="bg-discord-green hover:bg-discord-green/80 text-white px-4 py-1.5 rounded text-xs font-bold transition-all shadow-lg active:scale-95">
                        {isApproving ? 'PROCESSING...' : 'AUTHORIZE_PROTOCOL'}
                      </button>
                    )}
                    <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-discord-red/20 rounded-lg transition-all text-discord-muted hover:text-discord-red">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </header>
                
                <div className="flex-1 overflow-hidden p-8 flex justify-center">
                   <div className="w-full max-w-5xl bg-discord-darker rounded-xl border border-white/5 shadow-2xl overflow-hidden relative">
                    {selectedFile.type === 'markdown' ? (
                      <div className="p-10 h-full overflow-y-auto custom-scrollbar">
                        <pre className="text-[15px] text-discord-light whitespace-pre-wrap font-mono leading-relaxed">{fileContent}</pre>
                      </div>
                    ) : selectedFile.type === 'image' ? (
                      <div className="flex items-center justify-center h-full p-4"><img src={`/api/projects/${projectId}/memory/${selectedFile.filename}`} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" /></div>
                    ) : selectedFile.type === 'pdf' ? (
                      <iframe src={`/api/projects/${projectId}/memory/${selectedFile.filename}`} className="w-full h-full border-none bg-white" title={selectedFile.filename} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <Book className="w-16 h-16 text-discord-muted opacity-20" />
                        <p className="text-discord-muted font-bold tracking-widest uppercase text-xs">Unsupported Protocol</p>
                        <a href={`/api/projects/${projectId}/memory/${selectedFile.filename}`} target="_blank" rel="noreferrer" className="bg-discord-cyan text-white px-6 py-2 rounded font-bold text-xs hover:bg-discord-cyan/80">Retrieve File</a>
                      </div>
                    )}
                   </div>
                </div>
              </div>
            )}

            {/* 6. CONTEXT MENU */}
            {contextMenu && (
              <div className="fixed inset-0 z-50" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
                <div
                  className="absolute bg-discord-darkest border border-white/10 rounded-lg shadow-2xl py-1 w-56 z-50"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleLaunchSubagent(contextMenu.agent)}
                    className="w-full px-3 py-2 text-left text-sm text-discord-light hover:bg-white/10 flex items-center space-x-2 transition-colors"
                  >
                    <Bot className="w-4 h-4 text-discord-cyan" />
                    <span>Launch Subagent</span>
                  </button>
                  <button
                    onClick={() => handleScheduleWakeup(contextMenu.agent)}
                    className="w-full px-3 py-2 text-left text-sm text-discord-light hover:bg-white/10 flex items-center space-x-2 transition-colors"
                  >
                    <Bell className="w-4 h-4 text-discord-yellow" />
                    <span>Schedule Wake-up</span>
                  </button>
                  <button
                    onClick={() => handleViewDetails(contextMenu.agent)}
                    className="w-full px-3 py-2 text-left text-sm text-discord-light hover:bg-white/10 flex items-center space-x-2 transition-colors"
                  >
                    <Hash className="w-4 h-4 text-discord-muted" />
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={() => {
                      closeContextMenu();
                      setShowSubagentManage(true);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-discord-light hover:bg-white/10 flex items-center space-x-2 transition-colors"
                  >
                    <Bot className="w-4 h-4 text-discord-cyan" />
                    <span>Manage Subagents</span>
                  </button>
                  <div className="border-t border-white/5 my-1" />
                  <button
                    onClick={() => {
                      closeContextMenu();
                      setGoalForm(f => ({ ...f, agent_id: contextMenu.agent.agent_id }));
                      setShowGoalModal(true);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-discord-light hover:bg-white/10 flex items-center space-x-2 transition-colors"
                  >
                    <Target className="w-4 h-4 text-discord-yellow" />
                    <span>Set Goal</span>
                  </button>
                </div>
              </div>
            )}

            {/* 7. SUBAGENT MODAL */}
            {showSubagentModal && (
              <div className="absolute inset-0 z-50 bg-discord-black/80 backdrop-blur-sm flex items-center justify-center">
                <form onSubmit={handleCreateSubagent} className="bg-discord-darker rounded-xl border border-white/10 shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center">
                      <Bot className="w-5 h-5 mr-2 text-discord-cyan" />
                      New Subagent for @{subagentTargetAgent?.name}
                    </h2>
                    <button type="button" onClick={() => setShowSubagentModal(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="text-[11px] text-discord-muted bg-discord-dark/50 rounded-lg p-3">
                    Format: <strong className="text-discord-cyan">{subagentSchema?.format?.toUpperCase() || 'JSON'}</strong> → {subagentSchema?.nativeDir || '.codehive/agents/'}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Subagent Name *</label>
                    <input type="text" value={subagentForm.name} onChange={e => setSubagentForm(f => ({...f, name: e.target.value}))}
                      placeholder="my-custom-agent"
                      className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan" />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Instructions / Prompt *</label>
                    <textarea rows={4} value={subagentForm.instructions} onChange={e => setSubagentForm(f => ({...f, instructions: e.target.value}))}
                      placeholder="You are a specialized agent that..."
                      className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan resize-none" />
                  </div>

                  {subagentSchema?.fields?.filter((f: any) => f.name !== 'name' && !f.name.includes('instruction') && !f.name.includes('prompt')).map((field: any) => (
                    <div key={field.name}>
                      <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">
                        {field.label}{field.required ? ' *' : ''}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea rows={2} value={subagentForm.fields[field.name] || ''} onChange={e => updateSubagentField(field.name, e.target.value)}
                          className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan resize-none" />
                      ) : field.type === 'select' ? (
                        <select value={subagentForm.fields[field.name] || ''} onChange={e => updateSubagentField(field.name, e.target.value)}
                          className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan">
                          <option value="">—</option>
                          {field.options?.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'number' ? (
                        <input type="number" value={subagentForm.fields[field.name] || ''} onChange={e => updateSubagentField(field.name, e.target.value ? parseInt(e.target.value) : '')}
                          className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan" />
                      ) : (
                        <input type="text" value={subagentForm.fields[field.name] || ''} onChange={e => updateSubagentField(field.name, e.target.value)}
                          className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan" />
                      )}
                    </div>
                  ))}

                  <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={() => setShowSubagentModal(false)} className="px-4 py-2 text-sm text-discord-muted hover:text-white transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-discord-cyan text-white rounded-lg text-sm font-bold hover:bg-discord-cyan/80 transition-colors">Create Subagent</button>
                  </div>
                </form>
              </div>
            )}

            {/* 8. LAUNCH CONFIRMATION MODAL */}
            {showLaunchConfirm && (
              <div className="absolute inset-0 z-50 bg-discord-black/80 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-discord-darker rounded-xl border border-white/10 shadow-2xl w-full max-w-sm p-6 space-y-4">
                  <h2 className="text-lg font-bold text-white flex items-center">
                    <Bot className="w-5 h-5 mr-2 text-discord-cyan" />
                    Launch Subagent
                  </h2>
                  <p className="text-sm text-discord-muted">
                    Create a running instance for <strong className="text-discord-light">{launchConfirmName}</strong>?
                  </p>
                  <p className="text-xs text-discord-muted/60">The instance will appear in the sidebar. The subagent can mark itself complete via API when done.</p>
                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={() => { setShowLaunchConfirm(false); setLaunchConfirmName(''); }} className="px-4 py-2 text-sm text-discord-muted hover:text-white transition-colors">Cancel</button>
                    <button type="button" onClick={confirmLaunch} disabled={isLaunching}
                      className="px-4 py-2 bg-discord-cyan text-white rounded-lg text-sm font-bold hover:bg-discord-cyan/80 transition-colors disabled:opacity-50"
                    >{isLaunching ? 'Launching...' : 'Launch'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* 9. SUBAGENT MANAGEMENT MODAL */}
            {showSubagentManage && (
              <div className="absolute inset-0 z-50 bg-discord-black/80 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-discord-darker rounded-xl border border-white/10 shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center">
                      <Bot className="w-5 h-5 mr-2 text-discord-cyan" />
                      Subagent Definitions
                    </h2>
                    <button type="button" onClick={() => setShowSubagentManage(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {subagents.length === 0 && (
                      <div className="text-xs text-discord-muted/40 text-center py-8">No subagent definitions. Right-click an agent → Launch Subagent to create one.</div>
                    )}
                    {subagents.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-discord-muted border-b border-white/5">
                            <th className="text-left font-bold uppercase tracking-wider p-2">Name</th>
                            <th className="text-left font-bold uppercase tracking-wider p-2">Type</th>
                            <th className="text-left font-bold uppercase tracking-wider p-2">Target</th>
                            <th className="text-left font-bold uppercase tracking-wider p-2">Created</th>
                            <th className="text-right font-bold uppercase tracking-wider p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subagents.map((sa: any) => (
                            <tr key={sa.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-2 font-medium text-discord-light">{sa.name}</td>
                              <td className="p-2 text-discord-muted">{sa.agentType}</td>
                              <td className="p-2 text-discord-cyan">@{sa.targetAgentId}</td>
                              <td className="p-2 text-discord-muted">{new Date(sa.createdAt).toLocaleDateString()}</td>
                              <td className="p-2 text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  <button type="button" onClick={() => {
                                    setEditingSubagent(sa);
                                    setEditorTargetAgent(sa.targetAgentId);
                                    setEditorInstructions(sa.instructions);
                                    setEditorFields(sa.fields || {});
                                  }}
                                    className="px-2 py-1 text-[9px] font-bold bg-discord-cyan/20 text-discord-cyan rounded hover:bg-discord-cyan/40 transition-colors"
                                  >View</button>
                                  <button type="button" onClick={() => {
                                    setShowSubagentManage(false);
                                    handleLaunchExisting(sa.name);
                                  }}
                                    className="px-2 py-1 text-[9px] font-bold bg-discord-green/20 text-discord-green rounded hover:bg-discord-green/40 transition-colors"
                                  >Launch</button>
                                  <button type="button" onClick={async () => {
                                    if (!confirm(`Delete subagent "${sa.name}"?`)) return;
                                    try {
                                      await deleteSubagent(sa.name);
                                      await sendMessage(`🗑️ Subagent **${sa.name}** deleted`, undefined, 'system');
                                    } catch (err) {
                                      alert(`Failed: ${(err as Error).message}`);
                                    }
                                  }}
                                    className="px-2 py-1 text-[9px] font-bold text-discord-muted hover:text-discord-red transition-colors"
                                  >✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 10. SUBAGENT EDITOR MODAL */}
            {editingSubagent && (
              <div className="absolute inset-0 z-50 bg-discord-black/80 backdrop-blur-sm flex items-center justify-center">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSaving(true);
                  try {
                    await updateSubagent(editingSubagent.name, {
                      targetAgentId: editorTargetAgent,
                      instructions: editorInstructions,
                      fields: editorFields,
                    });
                    await sendMessage(`✏️ Subagent **${editingSubagent.name}** updated`, undefined, 'system');
                    setEditingSubagent(null);
                  } catch (err) {
                    alert(`Failed to update: ${(err as Error).message}`);
                  } finally {
                    setIsSaving(false);
                  }
                }} className="bg-discord-darker rounded-xl border border-white/10 shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center">
                      <Bot className="w-5 h-5 mr-2 text-discord-cyan" />
                      Edit Subagent: {editingSubagent.name}
                    </h2>
                    <button type="button" onClick={() => setEditingSubagent(null)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
                  </div>

                  {/* Read-only info */}
                  <div className="bg-discord-dark/50 rounded-lg p-3 space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-discord-muted">Name</span><span className="text-discord-light font-mono">{editingSubagent.name}</span></div>
                    <div className="flex justify-between"><span className="text-discord-muted">Type</span><span className="text-discord-light">{editingSubagent.agentType}</span></div>
                    <div className="flex justify-between"><span className="text-discord-muted">Created</span><span className="text-discord-light">{new Date(editingSubagent.createdAt).toLocaleString()}</span></div>
                    <div className="flex justify-between">
                      <span className="text-discord-muted">Config</span>
                      <span className={editingSubagent.configWritten ? 'text-discord-green' : 'text-discord-muted'}>
                        {editingSubagent.configWritten ? `Written → ${editingSubagent.configPath}` : 'Not written'}
                      </span>
                    </div>
                  </div>

                  {/* Target Agent */}
                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Target Agent</label>
                    <select value={editorTargetAgent} onChange={e => setEditorTargetAgent(e.target.value)}
                      className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan"
                    >
                      {agents.filter((a: any) => !a.parent_agent_id).map((a: any) => (
                        <option key={a.agent_id} value={a.agent_id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Instructions */}
                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Instructions / Prompt</label>
                    <textarea rows={4} value={editorInstructions} onChange={e => setEditorInstructions(e.target.value)}
                      className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan resize-none"
                    />
                  </div>

                  {/* Schema fields (dynamic) */}
                  {(() => {
                    const schema = subagentSchemas.find((s: any) =>
                      editingSubagent.agentType === s.agentType ||
                      editingSubagent.agentType?.toLowerCase().includes(s.agentType.replace('-', ''))
                    );
                    return schema?.fields?.filter((f: any) => f.name !== 'name' && !f.name.includes('instruction') && !f.name.includes('prompt')).map((field: any) => (
                      <div key={field.name}>
                        <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea rows={2} value={editorFields[field.name] || ''} onChange={e => setEditorFields(f => ({...f, [field.name]: e.target.value}))}
                            className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan resize-none" />
                        ) : field.type === 'select' ? (
                          <select value={editorFields[field.name] || ''} onChange={e => setEditorFields(f => ({...f, [field.name]: e.target.value}))}
                            className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan">
                            <option value="">—</option>
                            {field.options?.map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'number' ? (
                          <input type="number" value={editorFields[field.name] || ''} onChange={e => setEditorFields(f => ({...f, [field.name]: e.target.value ? parseInt(e.target.value) : ''}))}
                            className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan" />
                        ) : (
                          <input type="text" value={editorFields[field.name] || ''} onChange={e => setEditorFields(f => ({...f, [field.name]: e.target.value}))}
                            className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan" />
                        )}
                      </div>
                    ));
                  })()}

                  <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={() => setEditingSubagent(null)} className="px-4 py-2 text-sm text-discord-muted hover:text-white transition-colors">Cancel</button>
                    <button type="submit" disabled={isSaving}
                      className="px-4 py-2 bg-discord-cyan text-white rounded-lg text-sm font-bold hover:bg-discord-cyan/80 transition-colors disabled:opacity-50"
                    >{isSaving ? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </form>
              </div>
            )}

            {/* 11. INIT PROGRESS PANEL */}
            {initSteps.length > 0 && (
              <div className="absolute bottom-0 right-96 z-50 m-4 w-96 bg-discord-darker border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-3 text-[11px] font-bold text-discord-muted uppercase tracking-wider border-b border-white/5 flex items-center">
                  <LayoutGrid className="w-3.5 h-3.5 mr-2 text-discord-cyan" /> PROJECT INITIALIZATION
                </div>
                <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
                  {initSteps.map((step: any) => (
                    <div key={step.step} className="flex items-start space-x-2.5">
                      {step.status === 'done' ? (
                        <span className="text-discord-green text-sm mt-0.5">✓</span>
                      ) : step.status === 'error' ? (
                        <span className="text-discord-red text-sm mt-0.5">✗</span>
                      ) : (
                        <span className="w-4 h-4 mt-0.5 border-2 border-discord-cyan border-t-transparent rounded-full animate-spin shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium ${step.status === 'done' ? 'text-discord-green' : step.status === 'error' ? 'text-discord-red' : 'text-discord-light'}`}>
                          {step.message}
                        </div>
                      </div>
                    </div>
                  ))}
                  {initSteps.some(s => s.step === 'complete') && (
                    <button
                      onClick={() => { clearInitSteps(); }}
                      className="w-full mt-2 text-xs text-discord-cyan hover:text-white font-bold py-1.5 rounded bg-discord-cyan/10 hover:bg-discord-cyan/20 transition-colors"
                    >
                      DISMISS
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 12. NEW PROJECT MODAL */}
            {showNewProjectModal && (
              <div className="absolute inset-0 z-50 bg-discord-black/80 backdrop-blur-sm flex items-center justify-center">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newProjectForm.name || !newProjectForm.rootPath) return;
                  setIsCreating(true);
                  try {
                    await createProject({
                      name: newProjectForm.name,
                      description: newProjectForm.description,
                      rootPath: newProjectForm.rootPath,
                      initGit: newProjectForm.initGit,
                    });
                    setShowNewProjectModal(false);
                    setNewProjectForm({ name: '', description: '', rootPath: '', initGit: true });
                  } catch (err) {
                    alert(`Failed to create project: ${(err as Error).message}`);
                  } finally {
                    setIsCreating(false);
                  }
                }} className="bg-discord-darker rounded-xl border border-white/10 shadow-2xl w-full max-w-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center">
                      <LayoutGrid className="w-5 h-5 mr-2 text-discord-green" /> New Project
                    </h2>
                    <button type="button" onClick={() => setShowNewProjectModal(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Project Name *</label>
                    <input type="text" value={newProjectForm.name} onChange={e => setNewProjectForm(f => ({...f, name: e.target.value}))}
                      placeholder="my-awesome-project"
                      className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-green" />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Description</label>
                    <input type="text" value={newProjectForm.description} onChange={e => setNewProjectForm(f => ({...f, description: e.target.value}))}
                      placeholder="A short description"
                      className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-green" />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Root Path *</label>
                    <div className="flex mt-1 space-x-2">
                      <input type="text" value={newProjectForm.rootPath} onChange={e => setNewProjectForm(f => ({...f, rootPath: e.target.value}))}
                        placeholder="/home/user/projects/my-project"
                        className="flex-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-green font-mono text-xs" />
                      <button type="button" onClick={async () => {
                        const startPath = newProjectForm.rootPath || '/home';
                        setFileBrowserPath(startPath);
                        setFileBrowserLoading(true);
                        setShowFileBrowser(true);
                        try {
                          const data = await fetchDirListing(startPath);
                          setFileBrowserEntries(data.entries || []);
                        } catch {
                          setFileBrowserEntries([]);
                        } finally {
                          setFileBrowserLoading(false);
                        }
                      }} className="px-3 py-2 bg-discord-dark border border-white/10 rounded-lg text-xs text-discord-muted hover:text-white hover:border-discord-green transition-colors shrink-0">
                        Browse
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={newProjectForm.initGit} onChange={e => setNewProjectForm(f => ({...f, initGit: e.target.checked}))}
                      className="w-4 h-4 rounded border-white/20 bg-discord-dark text-discord-green focus:ring-discord-green" />
                    <span className="text-sm text-discord-muted">Initialize Git repository</span>
                  </label>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={() => setShowNewProjectModal(false)} className="px-4 py-2 text-sm text-discord-muted hover:text-white transition-colors">Cancel</button>
                    <button type="submit" disabled={isCreating}
                      className="px-4 py-2 bg-discord-green text-white rounded-lg text-sm font-bold hover:bg-discord-green/80 transition-colors disabled:opacity-50"
                    >{isCreating ? 'Creating...' : 'Create Project'}</button>
                  </div>
                </form>
              </div>
            )}

            {/* 13. FILE BROWSER MODAL */}
            {showFileBrowser && (
              <div className="absolute inset-0 z-[60] bg-discord-black/80 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-discord-darker rounded-xl border border-white/10 shadow-2xl w-full max-w-2xl p-4 space-y-3 max-h-[70vh] flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center">
                      <Folder className="w-4 h-4 mr-2 text-discord-yellow" /> Select Folder
                    </h3>
                    <button type="button" onClick={() => setShowFileBrowser(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
                  </div>

                  {/* Breadcrumb */}
                  <div className="flex items-center space-x-1 text-xs text-discord-muted bg-discord-dark rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">
                    {fileBrowserPath.split('/').filter(Boolean).map((part, i, arr) => {
                      const fullPath = '/' + arr.slice(0, i + 1).join('/');
                      return (
                        <span key={fullPath} className="flex items-center">
                          <button type="button" onClick={async () => {
                            setFileBrowserPath(fullPath);
                            setFileBrowserLoading(true);
                            try { const d = await fetchDirListing(fullPath); setFileBrowserEntries(d.entries || []); } catch {}
                            setFileBrowserLoading(false);
                          }} className="hover:text-discord-cyan transition-colors">{part}</button>
                          {i < arr.length - 1 && <span className="mx-1">/</span>}
                        </span>
                      );
                    })}
                  </div>

                  {/* Directory listing */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[200px] bg-discord-dark rounded-lg p-2">
                    {fileBrowserLoading ? (
                      <div className="flex items-center justify-center h-full text-discord-muted text-xs">Loading...</div>
                    ) : (
                      <div className="space-y-0.5">
                        {/* Parent dir */}
                        {fileBrowserPath !== '/' && (
                          <button type="button" onClick={async () => {
                            const parent = fileBrowserPath.split('/').slice(0, -1).join('/') || '/';
                            setFileBrowserPath(parent);
                            setFileBrowserLoading(true);
                            try { const d = await fetchDirListing(parent); setFileBrowserEntries(d.entries || []); } catch {}
                            setFileBrowserLoading(false);
                          }} className="w-full px-3 py-1.5 text-left text-xs text-discord-muted hover:bg-white/5 rounded flex items-center space-x-2">
                            <span className="text-discord-yellow">📁</span>
                            <span>..</span>
                          </button>
                        )}
                        {fileBrowserEntries.filter((e: any) => e.isDirectory).map((entry: any) => (
                          <button key={entry.path} type="button" onClick={async () => {
                            setFileBrowserPath(entry.path);
                            setFileBrowserLoading(true);
                            try { const d = await fetchDirListing(entry.path); setFileBrowserEntries(d.entries || []); } catch {}
                            setFileBrowserLoading(false);
                          }} className="w-full px-3 py-1.5 text-left text-xs text-discord-muted hover:bg-white/5 rounded flex items-center space-x-2">
                            <span className="text-discord-yellow">📁</span>
                            <span>{entry.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Current path + select */}
                  <div className="flex items-center space-x-2">
                    <input type="text" value={fileBrowserPath} readOnly
                      className="flex-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-xs text-discord-muted font-mono" />
                    <button type="button" onClick={() => {
                      setNewProjectForm(f => ({...f, rootPath: fileBrowserPath}));
                      setShowFileBrowser(false);
                    }} className="px-4 py-2 bg-discord-green text-white rounded-lg text-xs font-bold hover:bg-discord-green/80 transition-colors">
                      Select This Folder
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 14. GOAL MODAL */}
            {showGoalModal && (
              <div className="absolute inset-0 z-50 bg-discord-black/80 backdrop-blur-sm flex items-center justify-center">
                <form onSubmit={handleCreateGoal} className="bg-discord-darker rounded-xl border border-white/10 shadow-2xl w-full max-w-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center"><Target className="w-5 h-5 mr-2 text-discord-cyan" /> New Goal</h2>
                    <button type="button" onClick={() => setShowGoalModal(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Agent</label>
                    <select value={goalForm.agent_id} onChange={e => setGoalForm(f => ({...f, agent_id: e.target.value}))}
                      className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan">
                      <option value="">Select agent...</option>
                      {agents.filter((a: any) => !a.parent_agent_id).map((a: any) => (
                        <option key={a.agent_id} value={a.agent_id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Title</label>
                    <input type="text" value={goalForm.title} onChange={e => setGoalForm(f => ({...f, title: e.target.value}))}
                      className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan" />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Description</label>
                    <textarea rows={3} value={goalForm.description} onChange={e => setGoalForm(f => ({...f, description: e.target.value}))}
                      className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan resize-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Stop Condition (optional)</label>
                      <input type="text" value={goalForm.stop_condition} onChange={e => setGoalForm(f => ({...f, stop_condition: e.target.value}))}
                        className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-discord-muted uppercase tracking-wider">Max Iterations</label>
                      <input type="number" min={1} value={goalForm.max_iterations} onChange={e => setGoalForm(f => ({...f, max_iterations: parseInt(e.target.value) || 10}))}
                        className="w-full mt-1 bg-discord-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-discord-cyan" />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={() => setShowGoalModal(false)} className="px-4 py-2 text-sm text-discord-muted hover:text-white transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-discord-cyan text-white rounded-lg text-sm font-bold hover:bg-discord-cyan/80 transition-colors">Create Goal</button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
