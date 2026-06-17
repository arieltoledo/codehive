import { useState, useRef, useEffect } from 'react';
import { Terminal, Users, CheckSquare, MessageSquare, Send, Book, FileText, X } from 'lucide-react';
import { format } from 'date-fns';
import { useDashboard } from './hooks/useDashboard';

const App = () => {
  const { projects, projectId, setProjectId, agents, messages, tasks, memoryFiles, sendMessage } = useDashboard();
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      alert('Error sending message');
    }
  };

  const handleReadFile = async (file: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/memory/${file.filename}`);
      const data = await response.json();
      setSelectedFile(file);
      setFileContent(data.content);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-[#c5c6c7] font-mono">
      <header className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#1f2833]">
        <div className="flex items-center">
          <Terminal className="w-5 h-5 mr-2 text-cyan-400" />
          <h1 className="text-sm font-bold tracking-tighter uppercase">CodeHive</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-gray-500 uppercase font-bold">Project:</span>
          <select 
            value={projectId} 
            onChange={(e) => setProjectId(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-xs text-cyan-400 px-2 py-1 rounded outline-none focus:border-cyan-500"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </header>
      
      <main className="flex flex-1 overflow-hidden relative">
        {/* Agents Column */}
        <section className="w-64 border-r border-gray-800 flex flex-col shrink-0">
          <div className="p-2 bg-gray-900 text-xs font-bold border-b border-gray-800 flex items-center">
            <Users className="w-3 h-3 mr-1" /> AGENTS
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {agents.filter(a => !a.parent_agent_id).map(parent => (
              <div key={parent.agent_id} className="space-y-1">
                {/* Parent Agent */}
                <div className="p-2 border border-gray-800 bg-gray-900/50 rounded">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-white">{parent.name}</span>
                    <span className={`text-[10px] px-1 rounded ${parent.status === 'working' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                      {parent.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter">{parent.role}</div>
                </div>

                {/* Sub Agents (Nested) */}
                <div className="pl-4 space-y-1">
                  {agents.filter(a => a.parent_agent_id === parent.agent_id).map(sub => (
                    <div key={sub.agent_id} className="p-2 border border-gray-800/50 bg-gray-950/30 rounded flex justify-between items-center">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400">{sub.name}</div>
                        <div className="text-[8px] text-gray-600 uppercase">{sub.role}</div>
                      </div>
                      <span className={`text-[8px] px-1 rounded ${sub.status === 'working' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {sub.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {/* Orphan agents (if any parent is missing) */}
            {agents.filter(a => a.parent_agent_id && !agents.some(p => p.agent_id === a.parent_agent_id)).map(orphan => (
              <div key={orphan.agent_id} className="p-2 border border-red-900/20 bg-red-950/10 rounded opacity-50">
                 <div className="text-xs font-bold text-gray-400">{orphan.name} (??)</div>
              </div>
            ))}
          </div>
        </section>

        {/* Chat Column */}
        <section className="flex-1 flex flex-col bg-black min-w-0">
          <div className="p-2 bg-gray-900 text-xs font-bold border-b border-gray-800 flex items-center">
            <MessageSquare className="w-3 h-3 mr-1" /> COMMUNICATION_LOG
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {[...messages].reverse().map(msg => (
              <div key={msg.message_id} className="text-xs">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`${msg.sender_id === 'human_supervisor' ? 'text-yellow-500' : 'text-cyan-500'} font-bold`}>
                    [{msg.sender_id}]
                  </span>
                  <span className="text-gray-600">[{format(new Date(msg.created_at), 'HH:mm:ss')}]</span>
                </div>
                <div className={`${msg.sender_id === 'human_supervisor' ? 'text-yellow-100' : 'text-gray-300'} pl-4 border-l border-gray-800 ml-2 whitespace-pre-wrap`}>
                  {msg.message}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* User Input Area */}
          <div className="p-4 border-t border-gray-800 bg-gray-900/30">
            <form onSubmit={handleSend} className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Send a message to coordination room..."
                className="w-full bg-gray-900 border border-gray-700 text-xs text-white rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-cyan-500 placeholder-gray-600"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-cyan-400 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Knowledge Base / Memory Column */}
        <section className="w-72 border-l border-gray-800 flex flex-col shrink-0 bg-[#0b0c10]">
          <div className="p-2 bg-gray-900 text-xs font-bold border-b border-gray-800 flex items-center">
            <Book className="w-3 h-3 mr-1" /> SHARED_MEMORY
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {memoryFiles.map(file => (
              <button
                key={file.filename}
                onClick={() => handleReadFile(file)}
                className="w-full text-left p-2 border border-gray-800 bg-gray-900/30 rounded hover:border-cyan-900 transition-colors group"
              >
                <div className="flex items-center text-xs font-bold text-gray-400 group-hover:text-cyan-400">
                  <FileText className="w-3 h-3 mr-2" />
                  <span className="truncate">{file.filename}</span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">
                  Updated: {format(new Date(file.updatedAt), 'MMM d, HH:mm')}
                </div>
              </button>
            ))}
          </div>

          {/* Active Tasks below memory */}
          <div className="p-2 bg-gray-900 text-xs font-bold border-t border-b border-gray-800 flex items-center">
            <CheckSquare className="w-3 h-3 mr-1" /> ACTIVE_TASKS
          </div>
          <div className="h-1/3 overflow-y-auto p-2 space-y-2">
            {tasks.map(task => (
              <div key={task.task_id} className="p-2 border border-cyan-900/30 bg-cyan-950/10 rounded">
                <div className="text-xs font-bold text-cyan-400">{task.title}</div>
                <div className="text-[10px] text-gray-500 mt-1 line-clamp-2">{task.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* File Content Modal/Overlay */}
        {selectedFile && (
          <div className="absolute inset-0 z-50 bg-black/90 flex flex-col p-8">
            <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
              <div className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">{selectedFile.filename}</h2>
              </div>
              <button 
                onClick={() => setSelectedFile(null)}
                className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-900/50 p-6 rounded-lg border border-gray-800 scrollbar-hide">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {fileContent}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
