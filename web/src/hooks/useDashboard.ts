import { useState, useEffect } from 'react';

export function useDashboard(initialProjectId: string | null = null) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [projects, setProjects] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [memoryFiles, setMemoryFiles] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [subagents, setSubagents] = useState<any[]>([]);
  const [subagentInstances, setSubagentInstances] = useState<any[]>([]);
  const [subagentSchemas, setSubagentSchemas] = useState<any[]>([]);
  const [initSteps, setInitSteps] = useState<Array<{ step: string; status: string; message: string; projectId?: string }>>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

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
      setGoals([]);
      setSubagents([]);
      return;
    }

    // Fetch subagent schemas (once)
    if (subagentSchemas.length === 0) {
      fetch('/api/subagents/schemas').then(r => r.json()).then(d => setSubagentSchemas(d || []));
    }

    // Fetch templates
    fetch('/api/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : []));

    // Initial Snapshot for selected project
    fetch(`/api/projects/${projectId}/dashboard/snapshot`)
      .then(res => res.json())
      .then(data => {
        if (!data) return;
        setAgents(data.agents || []);
        setMessages(data.messages || []);
        setTasks(data.active_tasks || []);
        setGoals(data.goals || []);
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

    // Fetch Subagents
    fetch('/api/subagents')
      .then(res => res.json())
      .then(data => setSubagents(data || []))
      .catch(() => {});

    // Fetch Subagent Instances (running ones for sidebar)
    fetch('/api/subagents/instances?status=running')
      .then(res => res.json())
      .then(data => setSubagentInstances(data || []))
      .catch(() => {});

    // Fetch Analytics
    fetch(`/api/projects/${projectId}/analytics`)
      .then(r => r.json()).then(d => setAnalytics(d)).catch(() => {});

    // Fetch Activity
    fetch(`/api/projects/${projectId}/activity`)
      .then(r => r.json()).then(d => setActivity(d)).catch(() => {});

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
        case 'goal_started':
        case 'goal_updated':
          setGoals(prev => {
            const idx = prev.findIndex((g: any) => g.goalId === payload.goalId);
            if (idx > -1) { const n = [...prev]; n[idx] = payload; return n; }
            return [payload, ...prev];
          });
          break;
        case 'goal_completed':
        case 'goal_paused':
          setGoals(prev => prev.map((g: any) => g.goalId === payload.goalId ? payload : g));
          break;
        case 'subagent_created':
        case 'subagent_updated':
          setSubagents(prev => {
            const idx = prev.findIndex((s: any) => s.name === payload.name);
            if (idx > -1) { const n = [...prev]; n[idx] = payload; return n; }
            return [payload, ...prev];
          });
          break;
        case 'subagent_deleted':
          setSubagents(prev => prev.filter((s: any) => s.name !== payload.name));
          break;
        case 'subagent_instance_created':
          setSubagentInstances(prev => [payload, ...prev]);
          break;
        case 'subagent_instance_completed':
        case 'subagent_instance_error':
          setSubagentInstances(prev => prev.filter((s: any) => s.id !== payload.id));
          break;
        case 'project_init_step':
          setInitSteps(prev => {
            const existing = prev.findIndex(s => s.step === payload.step);
            if (existing > -1) {
              const next = [...prev];
              next[existing] = payload;
              return next;
            }
            return [...prev, payload];
          });
          break;
        case 'project_init_done':
          setInitSteps(prev => [...prev, { step: 'complete', status: 'done', message: 'Project ready!', projectId: payload.projectId }]);
          fetchProjects();
          break;
        case 'project_init_error':
          setInitSteps(prev => [...prev, { step: 'error', status: 'error', message: payload.error }]);
          break;
      }

      // Capture notifications from notable events
      const notif = getNotification(type, payload);
      if (notif) {
        setNotifications(prev => [notif, ...prev].slice(0, 50));
      }
    };

    function getNotification(type: string, payload: any): any | null {
      switch (type) {
        case 'goal_completed':
          return { id: payload.goalId, type, message: `Goal completed: ${payload.title}`, agentId: payload.agentId, timestamp: new Date().toISOString(), read: false };
        case 'goal_paused':
          return { id: payload.goalId, type, message: `Goal paused: ${payload.title}`, agentId: payload.agentId, timestamp: new Date().toISOString(), read: false };
        case 'goal_claimed':
          return { id: payload.goalId, type, message: `Goal claimed: ${payload.title}`, agentId: payload.agentId, timestamp: new Date().toISOString(), read: false };
        case 'task_finished':
          return { id: payload.task_id, type, message: `Task finished: ${payload.title || payload.task_id}`, agentId: payload.assigned_agent_id, timestamp: new Date().toISOString(), read: false };
        case 'schedule_completed':
          return { id: payload.scheduleId || payload.schedule_id, type, message: `Schedule completed for ${payload.agentId}`, agentId: payload.agentId, timestamp: new Date().toISOString(), read: false };
        case 'subagent_launched':
          return { id: payload.name, type, message: `Subagent launched: ${payload.name}`, agentId: payload.targetAgentId, timestamp: new Date().toISOString(), read: false };
        case 'subagent_instance_created':
          return { id: payload.id, type, message: `Subagent running: ${payload.subagent_name}`, agentId: payload.target_agent_id, timestamp: new Date().toISOString(), read: false };
        case 'subagent_instance_completed':
          return { id: payload.id, type, message: `Subagent completed: ${payload.subagent_name}`, agentId: payload.target_agent_id, timestamp: new Date().toISOString(), read: false };
        case 'subagent_instance_error':
          return { id: payload.id, type, message: `Subagent failed: ${payload.subagent_name}`, agentId: payload.target_agent_id, timestamp: new Date().toISOString(), read: false };
        case 'project_init_error':
          return { id: 'init-error', type, message: `Project init error: ${payload.error}`, agentId: 'system', timestamp: new Date().toISOString(), read: false };
        default:
          return null;
      }
    }

    return () => {
      ws.close();
      setInitSteps([]);
    };
  }, [projectId]);

  const sendMessage = async (message: string, roomId: string = 'coordination', messageType: string = 'human') => {
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
        messageType,
        roomId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to send message');
    }

    return response.json();
  };

  const createGoal = async (data: { agent_id: string; title: string; description: string; stop_condition?: string; max_iterations?: number }) => {
    const project = projects.find(p => p.id === projectId);
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hive-key': project?.apiKey || ''
      },
      body: JSON.stringify({ ...data, project_id: projectId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to create goal');
    }
    return response.json();
  };

  const createSubagent = async (data: {
    name: string;
    agentType: string;
    targetAgentId: string;
    instructions: string;
    fields?: Record<string, any>;
  }) => {
    const response = await fetch('/api/subagents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to create subagent');
    }
    return response.json();
  };

  const updateSubagent = async (name: string, data: {
    targetAgentId?: string;
    instructions?: string;
    fields?: Record<string, any>;
  }) => {
    const response = await fetch(`/api/subagents/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to update subagent');
    }
    return response.json();
  };

  const launchSubagent = async (name: string) => {
    const response = await fetch(`/api/subagents/${encodeURIComponent(name)}/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to launch subagent');
    }
    return response.json();
  };

  const deleteSubagent = async (name: string) => {
    const response = await fetch(`/api/subagents/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to delete subagent');
    }
    return response.json();
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {}
  };

  const searchTemplates = async (q: string) => {
    try {
      const res = await fetch(`/api/subagents/templates/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  };

  const createTemplate = async (data: {
    name: string;
    description: string;
    instructions: string;
    agentType?: string;
    fields?: Record<string, any>;
  }) => {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message ?? 'Failed to create template');
    }
    const tmpl = await res.json();
    setTemplates(prev => [...prev, tmpl]);
    return tmpl;
  };

  const updateTemplate = async (id: string, data: {
    name?: string;
    description?: string;
    instructions?: string;
    agentType?: string;
    fields?: Record<string, any>;
  }) => {
    const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message ?? 'Failed to update template');
    }
    const tmpl = await res.json();
    setTemplates(prev => prev.map(t => t.id === id ? tmpl : t));
    return tmpl;
  };

  const deleteTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message ?? 'Failed to delete template');
    }
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const fetchSubagentInstances = async () => {
    try {
      const res = await fetch('/api/subagents/instances?status=running');
      const data = await res.json();
      setSubagentInstances(data || []);
    } catch {}
  };

  const completeSubagentInstance = async (name: string) => {
    const response = await fetch(`/api/subagents/${encodeURIComponent(name)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to complete subagent');
    }
    return response.json();
  };

  const failSubagentInstance = async (name: string) => {
    const response = await fetch(`/api/subagents/${encodeURIComponent(name)}/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to mark subagent as failed');
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

  const clearInitSteps = () => setInitSteps([]);

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const createProject = async (data: { name: string; description?: string; rootPath: string; initGit?: boolean }) => {
    const response = await fetch('/api/projects/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? 'Failed to create project');
    }
    return response.json();
  };

  const fetchDirListing = async (dirPath: string) => {
    const response = await fetch(`/api/fs/list?path=${encodeURIComponent(dirPath)}`);
    if (!response.ok) throw new Error('Failed to list directory');
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

  return {
    projects, projectId, setProjectId,
    agents, messages, tasks, memoryFiles, goals,
    subagents, subagentInstances, subagentSchemas, initSteps, clearInitSteps,
    sendMessage, createGoal, createSubagent, updateSubagent, launchSubagent, deleteSubagent,
    fetchSubagentInstances, completeSubagentInstance, failSubagentInstance,
    templates, fetchTemplates, searchTemplates, createTemplate, updateTemplate, deleteTemplate,
    createProject, fetchDirListing,
    approvePlan, deleteProject, uploadFile, createFile,
    analytics, activity, notifications, unreadCount, markAllRead,
  };
}
