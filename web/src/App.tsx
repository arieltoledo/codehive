import { useState, useRef, useEffect } from 'react';
import { Users, Send, Book, FileText, X, LayoutGrid, Upload, FilePlus, ChevronDown, ChevronRight, Hash, Bell, Settings, Search, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useDashboard } from './hooks/useDashboard';
import { ProjectGrid } from './components/ProjectGrid';

const App = () => {
  const { projects, projectId, setProjectId, agents, messages, tasks, memoryFiles, sendMessage, approvePlan, deleteProject, uploadFile, createFile } = useDashboard();
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleAgent = (id: string) => {
    setExpandedAgents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    try {
      await sendMessage(inputValue);
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

  const coordinatorTasks = tasks.filter(t => !t.parent_task_id);
  const getSubTasks = (parentId: string) => tasks.filter(t => t.parent_task_id === parentId);
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

        <button className="w-12 h-12 rounded-[24px] bg-discord-dark flex items-center justify-center transition-all duration-200 hover:bg-discord-green hover:rounded-[16px] group">
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
                <div>
                  <div className="px-2 flex items-center text-[11px] font-bold text-discord-muted uppercase tracking-wider mb-2">
                    <ChevronDown className="w-3 h-3 mr-1" /> ACTIVE_AGENTS
                  </div>
                  <div className="space-y-0.5">
                    {agents.filter(a => !a.parent_agent_id).map(parent => (
                      <div key={parent.agent_id} className="space-y-0.5">
                        <button 
                          onClick={() => toggleAgent(parent.agent_id)}
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
                              <button key={sub.agent_id} className="w-full px-2 py-1.5 rounded flex items-center text-discord-muted hover:bg-white/5 hover:text-discord-light transition-colors group">
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
                  <Bell className="w-5 h-5 cursor-pointer hover:text-discord-light transition-colors" />
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
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="px-4 pb-6 bg-discord-dark">
                <form onSubmit={handleSend} className="bg-discord-darker rounded-lg px-4 flex items-center space-x-4 min-h-[44px]">
                  <PlusCircle className="w-6 h-6 text-discord-muted hover:text-white cursor-pointer transition-colors" />
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={`Message #coordination_room`}
                    className="flex-1 bg-transparent text-sm py-3 outline-none placeholder-discord-muted"
                  />
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
                {/* Memory Files - Now taking more space */}
                <div className="flex-1 flex flex-col min-h-0 border-b border-white/5">
                  <div className="p-4 flex items-center justify-between text-[11px] font-bold text-discord-muted uppercase tracking-wider bg-black/5">
                    <span className="flex items-center"><Book className="w-3.5 h-3.5 mr-2 text-discord-cyan" /> SHARED_RESOURCES</span>
                    <div className="flex space-x-2">
                      <FilePlus onClick={handleCreateFile} className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
                      <Upload onClick={() => fileInputRef.current?.click()} className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
                    </div>
                  </div>
                  
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
                </div>

                {/* Mission Control - Compact view */}
                <div className="h-1/3 flex flex-col min-h-0 bg-black/10">
                  <div className="p-3 text-[11px] font-bold text-discord-muted uppercase tracking-wider border-b border-white/5">
                    PRIMARY_MISSION_LOG
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {coordinatorTasks.map(parent => (
                      <div key={parent.task_id} className="bg-discord-dark/50 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="text-[9px] text-discord-cyan font-black uppercase mb-1 opacity-70">Sector_{parent.task_id.substring(0,4)}</div>
                        <div className="text-[11px] font-bold text-white mb-2 leading-tight">{parent.title}</div>
                        
                        <div className="space-y-1.5 mt-2 border-t border-white/5 pt-2">
                          {getSubTasks(parent.task_id).map(sub => (
                            <div key={sub.task_id} className="flex items-center space-x-2 group">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sub.status === 'running' ? 'bg-discord-yellow' : 'bg-discord-green'}`} />
                              <span className="text-[10px] font-medium text-discord-muted group-hover:text-discord-light truncate flex-1">{sub.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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
          </>
        )}
      </div>
    </div>
  );
};

export default App;
