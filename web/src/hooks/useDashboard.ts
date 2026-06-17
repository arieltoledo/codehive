import { useState, useEffect } from 'react';

export function useDashboard(initialProjectId: string | null = null) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [projects, setProjects] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [memoryFiles, setMemoryFiles] = useState<any[]>([]);

  const fetchProjects = () => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data.projects));
  };

  useEffect(() => {
    fetchProjects();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setAgents([]);
      setMessages([]);
      setTasks([]);
      setMemoryFiles([]);
      return;
    }

    // Initial Snapshot for selected project
    fetch(`/api/projects/${projectId}/dashboard/snapshot`)
      .then(res => res.json())
      .then(data => {
        if (!data) return;
        setAgents(data.agents || []);
        setMessages(data.messages || []);
        setTasks(data.active_tasks || []);
      })
      .catch(err => {
        console.error('Failed to fetch snapshot:', err);
        setAgents([]);
        setMessages([]);
        setTasks([]);
      });

    // Fetch Memory Files
    fetch(`/api/projects/${projectId}/memory`)
      .then(res => res.json())
      .then(data => setMemoryFiles(data.files || []));

    // WebSocket Connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);
      
      // Filter by projectId
      if (payload.projectId && payload.projectId !== projectId) {
        return;
      }

      switch (type) {
        case 'agent_registered':
        case 'agent_updated':
          setAgents(prev => {
            const index = prev.findIndex(a => a.agent_id === payload.agent_id);
            if (index > -1) {
              const next = [...prev];
              next[index] = payload;
              return next;
            }
            return [...prev, payload];
          });
          break;
        case 'message_sent':
          setMessages(prev => [payload, ...prev].slice(0, 50));
          break;
        case 'task_started':
          setTasks(prev => [payload, ...prev]);
          break;
        case 'task_finished':
          setTasks(prev => prev.filter(t => t.task_id !== payload.task_id));
          break;
        case 'memory_updated':
          setMemoryFiles(prev => {
            const index = prev.findIndex(f => f.filename === payload.filename);
            if (index > -1) {
              const next = [...prev];
              next[index] = payload;
              return next;
            }
            return [payload, ...prev];
          });
          break;
      }
    };
    return () => ws.close();
  }, [projectId]);

  const sendMessage = async (message: string, roomId: string = 'coordination') => {
    const project = projects.find(p => p.id === projectId);
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-hive-key': project?.apiKey || ''
      },
      body: JSON.stringify({
        projectId,
        senderId: 'human_supervisor',
        message,
        messageType: 'human',
        roomId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to send message');
    }

    return response.json();
  };

  const approvePlan = async (filename: string) => {
    const response = await fetch('/api/memory/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, filename })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to approve plan');
    }

    return response.json();
  };

  const deleteProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    const response = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: {
        'x-hive-key': project?.apiKey || ''
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to delete project');
    }

    // Refresh projects list
    fetchProjects();
    return response.json();
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) formData.append('projectId', projectId);

    const response = await fetch('/api/memory/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Upload failed');
    }

    return response.json();
  };

  const createFile = async (filename: string, content: string = '') => {
    const response = await fetch('/api/memory/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, filename, content })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to create file');
    }

    return response.json();
  };

  return { projects, projectId, setProjectId, agents, messages, tasks, memoryFiles, sendMessage, approvePlan, deleteProject, uploadFile, createFile };
}
