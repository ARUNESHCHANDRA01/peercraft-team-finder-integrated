import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  PlatformConnection,
  CreditTransaction,
  ActivityHistoryItem,
  CodingQuestion,
  Project,
  ResourceItem,
  MicroGig,
  CampusEvent,
  CommunityPost,
  NotificationItem,
  RewardRule,
  AuditLogItem,
  AIMessage,
  AiMentorMode,
  QuickActionItem,
} from '../types';
import { findTeammates, formatTeamReply, TeamFinderError } from '../services/teamFinderApi';
import {
  initialUser,
  adminUser,
  otherStudents,
  avatarPresets,
  defaultQuickActions,
  initialPlatformConnections,
  initialProjects,
  initialCodingQuestions,
  initialTransactions,
  initialHistory,
  initialResources,
  initialMicroGigs,
  initialEvents,
  initialCommunityPosts,
  initialNotifications,
  initialRewardRules,
  initialAuditLogs,
} from '../data/mockData';

interface AppContextType {
  currentUser: UserProfile;
  switchUser: (user: UserProfile) => void;
  allUsers: UserProfile[];
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  
  // Credit balance and transactions
  availableCredits: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  transactions: CreditTransaction[];
  history: ActivityHistoryItem[];
  addHistoryItem: (item: Omit<ActivityHistoryItem, 'id' | 'timestamp' | 'userId'>) => void;
  
  // Platform connections & earning
  platformConnections: PlatformConnection[];
  updatePlatformConnection: (platform: string, username: string, profileUrl: string) => void;
  claimPlatformReward: (platform: string, activityName: string, amount: number) => { success: boolean; message: string };
  
  // Coding arena & question unlock flow
  codingQuestions: CodingQuestion[];
  unlockedQuestionIds: string[];
  unlockQuestion: (questionId: string) => { success: boolean; reason?: string; question?: CodingQuestion };
  addCodingQuestion: (question: Omit<CodingQuestion, 'id' | 'createdAt'>) => void;
  updateCodingQuestion: (id: string, updates: Partial<CodingQuestion>) => void;
  verifyQuestionLink: (id: string) => void;
  
  // Projects
  projects: Project[];
  activeProjectsCount: number;
  createProject: (projectData: Omit<Project, 'id' | 'createdAt' | 'lastUpdated' | 'ownerId' | 'ownerName' | 'members' | 'memberCount' | 'isUserEnrolled'>) => void;
  joinProject: (projectId: string, role?: string) => void;
  
  // Resources
  resources: ResourceItem[];
  borrowedResourcesCount: number;
  borrowResource: (resourceId: string) => { success: boolean; message: string };
  returnResource: (resourceId: string) => { success: boolean; message: string };
  
  // Micro-gigs
  microGigs: MicroGig[];
  applyToGig: (gigId: string) => void;
  createGig: (gig: Omit<MicroGig, 'id' | 'creatorId' | 'creatorName' | 'applicantsCount' | 'createdAt' | 'status'>) => void;
  
  // Events
  events: CampusEvent[];
  registerForEvent: (eventId: string) => void;
  
  // Community
  communityPosts: CommunityPost[];
  createCommunityPost: (title: string, content: string, category: CommunityPost['category'], tags: string[]) => void;
  togglePostUpvote: (postId: string) => void;
  addCommentToPost: (postId: string, text: string) => void;
  
  // Notifications
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  
  // Admin & Rules
  signupBonusAmount: number;
  setSignupBonusAmount: (amount: number) => void;
  rewardRules: RewardRule[];
  updateRewardRule: (id: string, updates: Partial<RewardRule>) => void;
  auditLogs: AuditLogItem[];
  addAuditLog: (action: string, targetType: string, targetId: string, details: string) => void;
  
  // AI Mentor
  aiMessages: AIMessage[];
  aiMentorMode: AiMentorMode;
  setAiMentorMode: (mode: AiMentorMode) => void;
  isAiMentorOpen: boolean;
  setIsAiMentorOpen: (open: boolean) => void;
  selectedQuestionContext: CodingQuestion | null;
  setSelectedQuestionContext: (q: CodingQuestion | null) => void;
  sendAiMessage: (messageText: string) => void;
  clearAiMessages: () => void;
  isAiThinking: boolean;
  
  // Global search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Responsive Sidebar state
  isSidebarCollapsed: boolean;
  toggleSidebarCollapse: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Movable Quick Actions
  quickActions: QuickActionItem[];
  reorderQuickActions: (newActions: QuickActionItem[]) => void;
  moveQuickAction: (index: number, direction: 'up' | 'down') => void;
  resetQuickActions: () => void;

  // Engaging Avatar selection & status
  showAvatarPicker: boolean;
  setShowAvatarPicker: (show: boolean) => void;
  updateAvatar: (avatarUrl: string, statusEmoji?: string) => void;

  // Fullscreen support
  isFullscreen: boolean;
  toggleFullscreen: () => void;

  // Reset demo state
  resetToDemoDefaults: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state from localStorage or use defaults
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('peercraft_user');
    return saved ? JSON.parse(saved) : initialUser;
  });

  const [availableCredits, setAvailableCredits] = useState<number>(() => {
    const saved = localStorage.getItem('peercraft_credits');
    return saved !== null ? Number(saved) : 1250;
  });

  const [lifetimeEarned, setLifetimeEarned] = useState<number>(() => {
    const saved = localStorage.getItem('peercraft_lifetime_earned');
    return saved !== null ? Number(saved) : 1250;
  });

  const [lifetimeSpent, setLifetimeSpent] = useState<number>(() => {
    const saved = localStorage.getItem('peercraft_lifetime_spent');
    return saved !== null ? Number(saved) : 0;
  });

  const [platformConnections, setPlatformConnections] = useState<PlatformConnection[]>(() => {
    const saved = localStorage.getItem('peercraft_platforms');
    return saved ? JSON.parse(saved) : initialPlatformConnections;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('peercraft_projects');
    return saved ? JSON.parse(saved) : initialProjects;
  });

  const [codingQuestions, setCodingQuestions] = useState<CodingQuestion[]>(() => {
    const saved = localStorage.getItem('peercraft_questions');
    return saved ? JSON.parse(saved) : initialCodingQuestions;
  });

  const [unlockedQuestionIds, setUnlockedQuestionIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('peercraft_unlocked_questions');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<CreditTransaction[]>(() => {
    const saved = localStorage.getItem('peercraft_transactions');
    return saved ? JSON.parse(saved) : initialTransactions;
  });

  const [history, setHistory] = useState<ActivityHistoryItem[]>(() => {
    const saved = localStorage.getItem('peercraft_history');
    return saved ? JSON.parse(saved) : initialHistory;
  });

  const [resources, setResources] = useState<ResourceItem[]>(() => {
    const saved = localStorage.getItem('peercraft_resources');
    return saved ? JSON.parse(saved) : initialResources;
  });

  const [microGigs, setMicroGigs] = useState<MicroGig[]>(() => {
    const saved = localStorage.getItem('peercraft_gigs');
    return saved ? JSON.parse(saved) : initialMicroGigs;
  });

  const [events, setEvents] = useState<CampusEvent[]>(() => {
    const saved = localStorage.getItem('peercraft_events');
    return saved ? JSON.parse(saved) : initialEvents;
  });

  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(() => {
    const saved = localStorage.getItem('peercraft_community');
    return saved ? JSON.parse(saved) : initialCommunityPosts;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('peercraft_notifications');
    return saved ? JSON.parse(saved) : initialNotifications;
  });

  const [signupBonusAmount, setSignupBonusAmountState] = useState<number>(() => {
    const saved = localStorage.getItem('peercraft_signup_bonus');
    return saved !== null ? Number(saved) : 1000;
  });

  const [rewardRules, setRewardRules] = useState<RewardRule[]>(() => {
    const saved = localStorage.getItem('peercraft_reward_rules');
    return saved ? JSON.parse(saved) : initialRewardRules;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() => {
    const saved = localStorage.getItem('peercraft_audit_logs');
    return saved ? JSON.parse(saved) : initialAuditLogs;
  });

  // AI Mentor State
  const [aiMentorMode, setAiMentorMode] = useState<AiMentorMode>('Learn');
  const [isAiMentorOpen, setIsAiMentorOpen] = useState<boolean>(false);
  const [selectedQuestionContext, setSelectedQuestionContext] = useState<CodingQuestion | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    {
      id: 'ai_welcome',
      role: 'assistant',
      mode: 'Learn',
      content: "Hello! I am your PeerCraft AI Mentor. Whether you want to understand an algorithm from first principles, receive step-by-step hints without spoiling the solution, or debug your edge cases, I'm here to help. Planning a project? Switch to Team mode and describe it, and I'll suggest teammates. Select a mode above to get started!",
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');

  // Responsive Sidebar state (Expanded ~240px <-> Collapsed 72px)
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState<boolean>(() => {
    return localStorage.getItem('peercraft_sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsedState((prev) => {
      const next = !prev;
      localStorage.setItem('peercraft_sidebar_collapsed', next.toString());
      return next;
    });
  };

  const setSidebarCollapsed = (collapsed: boolean) => {
    setIsSidebarCollapsedState(collapsed);
    localStorage.setItem('peercraft_sidebar_collapsed', collapsed.toString());
  };

  // Movable Quick Actions state
  const [quickActions, setQuickActions] = useState<QuickActionItem[]>(() => {
    const saved = localStorage.getItem('peercraft_quick_actions');
    return saved ? JSON.parse(saved) : defaultQuickActions;
  });

  const reorderQuickActions = (newActions: QuickActionItem[]) => {
    setQuickActions(newActions);
    localStorage.setItem('peercraft_quick_actions', JSON.stringify(newActions));
  };

  const moveQuickAction = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === quickActions.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...quickActions];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    setQuickActions(updated);
    localStorage.setItem('peercraft_quick_actions', JSON.stringify(updated));
  };

  const resetQuickActions = () => {
    setQuickActions(defaultQuickActions);
    localStorage.setItem('peercraft_quick_actions', JSON.stringify(defaultQuickActions));
  };

  // Engaging Avatar Picker & Status Modal
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const updateAvatar = (avatarUrl: string, statusEmoji?: string) => {
    setCurrentUser((prev) => ({
      ...prev,
      avatarUrl,
      statusEmoji: statusEmoji !== undefined ? statusEmoji : prev.statusEmoji,
    }));
    setShowAvatarPicker(false);
  };

  // Fullscreen helper
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('peercraft_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('peercraft_credits', availableCredits.toString());
    localStorage.setItem('peercraft_lifetime_earned', lifetimeEarned.toString());
    localStorage.setItem('peercraft_lifetime_spent', lifetimeSpent.toString());
  }, [availableCredits, lifetimeEarned, lifetimeSpent]);

  useEffect(() => {
    localStorage.setItem('peercraft_platforms', JSON.stringify(platformConnections));
  }, [platformConnections]);

  useEffect(() => {
    localStorage.setItem('peercraft_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('peercraft_questions', JSON.stringify(codingQuestions));
  }, [codingQuestions]);

  useEffect(() => {
    localStorage.setItem('peercraft_unlocked_questions', JSON.stringify(unlockedQuestionIds));
  }, [unlockedQuestionIds]);

  useEffect(() => {
    localStorage.setItem('peercraft_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('peercraft_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('peercraft_resources', JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    localStorage.setItem('peercraft_gigs', JSON.stringify(microGigs));
  }, [microGigs]);

  useEffect(() => {
    localStorage.setItem('peercraft_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('peercraft_community', JSON.stringify(communityPosts));
  }, [communityPosts]);

  useEffect(() => {
    localStorage.setItem('peercraft_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('peercraft_signup_bonus', signupBonusAmount.toString());
  }, [signupBonusAmount]);

  useEffect(() => {
    localStorage.setItem('peercraft_reward_rules', JSON.stringify(rewardRules));
  }, [rewardRules]);

  useEffect(() => {
    localStorage.setItem('peercraft_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Derived metrics
  // Enrolled active projects: only projects where isUserEnrolled is true and status !== 'Completed'
  const activeProjectsCount = projects.filter(
    (p) => p.isUserEnrolled && p.status !== 'Completed'
  ).length;

  const borrowedResourcesCount = resources.filter(
    (r) => r.borrowedByUserId === currentUser.id && r.availability === 'Borrowed'
  ).length;

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  // Add history helper
  const addHistoryItem = (item: Omit<ActivityHistoryItem, 'id' | 'timestamp' | 'userId'>) => {
    const newItem: ActivityHistoryItem = {
      ...item,
      id: `hist_${Date.now()}`,
      userId: currentUser.id,
      timestamp: 'Just now',
    };
    setHistory((prev) => [newItem, ...prev]);
  };

  // Add audit log helper
  const addAuditLog = (action: string, targetType: string, targetId: string, details: string) => {
    const newLog: AuditLogItem = {
      id: `audit_${Date.now()}`,
      adminId: currentUser.id,
      adminName: currentUser.fullName,
      action,
      targetType,
      targetId,
      details,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // User switching (e.g. Aryan Sharma <-> Admin Ananya Sen)
  const switchUser = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      addAuditLog('SESSION_SWITCH', 'AUTH', user.id, `Switched view to administrative persona: ${user.fullName}`);
    }
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setCurrentUser((prev) => ({ ...prev, ...updates }));
    addHistoryItem({
      eventType: 'milestone_completed',
      category: 'Profile Updates',
      title: 'Profile Updated',
      description: 'Updated personal profile details and developer preferences.',
      status: 'Completed',
      linkUrl: '/profile',
    });
  };

  // Platform reward claiming with daily cap check
  const claimPlatformReward = (platformKey: string, activityName: string, amount: number) => {
    const platform = platformConnections.find((p) => p.platform === platformKey);
    if (!platform) return { success: false, message: 'Platform not found.' };

    if (!platform.isConnected) {
      return { success: false, message: `Please connect your ${platform.displayName} profile first.` };
    }

    if (platform.creditsEarnedToday + amount > platform.dailyCap) {
      return {
        success: false,
        message: `Daily cap of ${platform.dailyCap} credits reached for ${platform.displayName}. You have already earned ${platform.creditsEarnedToday} credits today.`,
      };
    }

    // Atomic issuance
    setAvailableCredits((prev) => prev + amount);
    setLifetimeEarned((prev) => prev + amount);

    // Update platform record
    setPlatformConnections((prev) =>
      prev.map((p) =>
        p.platform === platformKey
          ? { ...p, creditsEarnedToday: p.creditsEarnedToday + amount, lastSyncAt: 'Just now' }
          : p
      )
    );

    // Create transaction record
    const newTx: CreditTransaction = {
      id: `tx_${Date.now()}`,
      userId: currentUser.id,
      transactionType: `reward_${platformKey}` as any,
      amount: amount,
      description: `Verified ${platform.displayName} reward: ${activityName}`,
      sourcePlatform: platform.displayName,
      referenceId: `verif_${Math.random().toString(36).substring(2, 9)}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Create history item
    addHistoryItem({
      eventType: 'credit_earned',
      category: 'Developer Platforms',
      title: `${platform.displayName} Contribution Reward`,
      description: `Earned ${amount} Campus Credits for verified ${activityName}.`,
      status: 'Verified',
      creditDelta: amount,
      linkUrl: '/credits/earn',
    });

    // Notify user
    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        userId: currentUser.id,
        type: 'credit_reward',
        title: `${platform.displayName} Reward Credited!`,
        message: `You earned +${amount} Campus Credits for ${activityName}.`,
        isRead: false,
        linkUrl: '/credits',
        createdAt: 'Just now',
      },
      ...prev,
    ]);

    return { success: true, message: `Successfully earned +${amount} Campus Credits!` };
  };

  const updatePlatformConnection = (platformKey: string, username: string, profileUrl: string) => {
    setPlatformConnections((prev) =>
      prev.map((p) =>
        p.platform === platformKey
          ? {
              ...p,
              username,
              profileUrl,
              isConnected: true,
              isVerified: true,
              lastSyncAt: 'Just now',
            }
          : p
      )
    );

    addHistoryItem({
      eventType: 'platform_connected',
      category: 'Developer Platforms',
      title: `Connected ${platformKey.toUpperCase()} Profile`,
      description: `Saved and linked verified developer profile @${username}.`,
      status: 'Completed',
      linkUrl: '/credits/earn',
    });
  };

  // Question unlocking flow
  const unlockQuestion = (questionId: string) => {
    const question = codingQuestions.find((q) => q.id === questionId);
    if (!question) {
      return { success: false, reason: 'Question not found' };
    }

    // If already unlocked, return existing entitlement with no re-charge!
    if (unlockedQuestionIds.includes(questionId)) {
      return { success: true, question };
    }

    const price = question.creditPrice;

    // Server-authoritative credit check
    if (availableCredits < price) {
      return { success: false, reason: 'insufficient_credits', question };
    }

    // Atomic debit
    setAvailableCredits((prev) => prev - price);
    setLifetimeSpent((prev) => prev + price);
    setUnlockedQuestionIds((prev) => [...prev, questionId]);

    // Create transaction
    const newTx: CreditTransaction = {
      id: `tx_${Date.now()}`,
      userId: currentUser.id,
      transactionType: 'unlock_question',
      amount: -price,
      description: `Unlocked curated link: ${question.title} (${question.platform})`,
      sourcePlatform: question.platform,
      referenceId: question.id,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Record in history
    addHistoryItem({
      eventType: 'question_unlocked',
      category: 'Coding Arena',
      title: `Unlocked Question Link: ${question.title}`,
      description: `Used ${price} Campus Credits to unlock curated link for ${question.title} on ${question.platform}.`,
      status: 'Completed',
      creditDelta: -price,
      linkUrl: '/coding-arena',
    });

    // Notify user
    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        userId: currentUser.id,
        type: 'question_unlock',
        title: `Question Link Unlocked: ${question.title}`,
        message: `Unlocked curated link for ${question.title}. You can now practice on ${question.platform}.`,
        isRead: false,
        linkUrl: '/coding-arena',
        createdAt: 'Just now',
      },
      ...prev,
    ]);

    return { success: true, question };
  };

  const addCodingQuestion = (newQ: Omit<CodingQuestion, 'id' | 'createdAt'>) => {
    const question: CodingQuestion = {
      ...newQ,
      id: `q_${Date.now()}`,
      createdAt: new Date().toISOString().substring(0, 10),
    };
    setCodingQuestions((prev) => [question, ...prev]);
    addAuditLog('CREATE_QUESTION', 'CODING_QUESTION', question.id, `Published question "${question.title}" (${question.category}) with price ${question.creditPrice}`);
  };

  const updateCodingQuestion = (id: string, updates: Partial<CodingQuestion>) => {
    setCodingQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
    addAuditLog('UPDATE_QUESTION', 'CODING_QUESTION', id, `Updated details for question ${id}`);
  };

  const verifyQuestionLink = (id: string) => {
    const today = new Date().toISOString().substring(0, 10);
    setCodingQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, lastLinkVerifiedAt: today } : q))
    );
    addAuditLog('VERIFY_LINK', 'CODING_QUESTION', id, `Verified external destination link integrity`);
  };

  // Projects
  const createProject = (projectData: Omit<Project, 'id' | 'createdAt' | 'lastUpdated' | 'ownerId' | 'ownerName' | 'members' | 'memberCount' | 'isUserEnrolled'>) => {
    const newProject: Project = {
      ...projectData,
      id: `proj_${Date.now()}`,
      ownerId: currentUser.id,
      ownerName: currentUser.fullName,
      userRole: 'Project Lead',
      progress: 10,
      memberCount: 1,
      isUserEnrolled: true,
      lastUpdated: 'Just now',
      createdAt: new Date().toISOString(),
      members: [
        {
          userId: currentUser.id,
          name: currentUser.fullName,
          avatarUrl: currentUser.avatarUrl,
          role: 'Project Lead',
          joinedAt: new Date().toISOString().substring(0, 10),
        },
      ],
    };

    setProjects((prev) => [newProject, ...prev]);

    addHistoryItem({
      eventType: 'project_created',
      category: 'Projects',
      title: `Created Project: ${newProject.title}`,
      description: `Initialized project and enrolled as Project Lead.`,
      status: 'Active',
      linkUrl: `/projects/${newProject.id}`,
    });
  };

  const joinProject = (projectId: string, role = 'Team Member') => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const alreadyMember = p.members.some((m) => m.userId === currentUser.id);
          if (alreadyMember) return p;

          return {
            ...p,
            isUserEnrolled: true,
            userRole: role,
            memberCount: p.memberCount + 1,
            members: [
              ...p.members,
              {
                userId: currentUser.id,
                name: currentUser.fullName,
                avatarUrl: currentUser.avatarUrl,
                role,
                joinedAt: new Date().toISOString().substring(0, 10),
              },
            ],
          };
        }
        return p;
      })
    );

    const project = projects.find((p) => p.id === projectId);
    addHistoryItem({
      eventType: 'project_joined',
      category: 'Projects',
      title: `Joined Project: ${project?.title || 'Campus Project'}`,
      description: `Enrolled as ${role}.`,
      status: 'Active',
      linkUrl: `/projects/${projectId}`,
    });
  };

  // Resources
  const borrowResource = (resourceId: string) => {
    const res = resources.find((r) => r.id === resourceId);
    if (!res || res.availability !== 'Available') {
      return { success: false, message: 'Resource is currently not available.' };
    }

    setResources((prev) =>
      prev.map((r) =>
        r.id === resourceId
          ? {
              ...r,
              availability: 'Borrowed',
              borrowedByUserId: currentUser.id,
              borrowedAt: new Date().toISOString().substring(0, 10),
            }
          : r
      )
    );

    addHistoryItem({
      eventType: 'resource_borrowed',
      category: 'Resources',
      title: `Borrowed: ${res.name}`,
      description: `Resource borrowed from ${res.ownerName} for ${res.borrowingDuration}.`,
      status: 'Active',
      linkUrl: '/resources/history',
    });

    return { success: true, message: `Successfully requested ${res.name}!` };
  };

  const returnResource = (resourceId: string) => {
    const res = resources.find((r) => r.id === resourceId);
    if (!res) return { success: false, message: 'Resource not found' };

    setResources((prev) =>
      prev.map((r) =>
        r.id === resourceId
          ? {
              ...r,
              availability: 'Available',
              borrowedByUserId: undefined,
              borrowedAt: undefined,
            }
          : r
      )
    );

    addHistoryItem({
      eventType: 'milestone_completed',
      category: 'Resources',
      title: `Returned: ${res.name}`,
      description: `Item returned in good condition. Borrow record completed.`,
      status: 'Completed',
      linkUrl: '/resources',
    });

    return { success: true, message: `Successfully returned ${res.name}.` };
  };

  // Micro-gigs
  const applyToGig = (gigId: string) => {
    setMicroGigs((prev) =>
      prev.map((g) => (g.id === gigId ? { ...g, applicantsCount: g.applicantsCount + 1 } : g))
    );
    const gig = microGigs.find((g) => g.id === gigId);
    addHistoryItem({
      eventType: 'milestone_completed',
      category: 'Projects',
      title: `Applied to Micro-Gig: ${gig?.title}`,
      description: `Submitted proposal for ${gig?.rewardCredits} credits reward.`,
      status: 'Pending',
      linkUrl: '/micro-gigs',
    });
  };

  const createGig = (gig: Omit<MicroGig, 'id' | 'creatorId' | 'creatorName' | 'applicantsCount' | 'createdAt' | 'status'>) => {
    const newGig: MicroGig = {
      ...gig,
      id: `gig_${Date.now()}`,
      creatorId: currentUser.id,
      creatorName: currentUser.fullName,
      applicantsCount: 0,
      status: 'Open',
      createdAt: new Date().toISOString().substring(0, 10),
    };
    setMicroGigs((prev) => [newGig, ...prev]);
  };

  // Events
  const registerForEvent = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, isRegistered: true } : e))
    );
    const ev = events.find((e) => e.id === eventId);
    addHistoryItem({
      eventType: 'event_registered',
      category: 'Events',
      title: `Registered: ${ev?.title}`,
      description: `Confirmed participation for ${ev?.dateTime}.`,
      status: 'Completed',
      linkUrl: '/events',
    });
  };

  // Community
  const createCommunityPost = (title: string, content: string, category: CommunityPost['category'], tags: string[]) => {
    const newPost: CommunityPost = {
      id: `post_${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      authorAvatar: currentUser.avatarUrl,
      authorBranch: `${currentUser.branch} • ${currentUser.academicYear}`,
      category,
      title,
      content,
      tags,
      upvotes: 1,
      isUpvoted: true,
      commentCount: 0,
      comments: [],
      createdAt: 'Just now',
    };
    setCommunityPosts((prev) => [newPost, ...prev]);
  };

  const togglePostUpvote = (postId: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const upvoted = !p.isUpvoted;
          return {
            ...p,
            isUpvoted: upvoted,
            upvotes: upvoted ? p.upvotes + 1 : Math.max(0, p.upvotes - 1),
          };
        }
        return p;
      })
    );
  };

  const addCommentToPost = (postId: string, text: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            commentCount: p.commentCount + 1,
            comments: [
              ...p.comments,
              {
                id: `c_${Date.now()}`,
                authorName: currentUser.fullName,
                authorAvatar: currentUser.avatarUrl,
                content: text,
                createdAt: 'Just now',
              },
            ],
          };
        }
        return p;
      })
    );
  };

  // Notifications
  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Admin rules
  const setSignupBonusAmount = (amount: number) => {
    setSignupBonusAmountState(amount);
    addAuditLog('SET_SIGNUP_BONUS', 'CONFIG', 'BONUS', `Updated signup bonus from default to ${amount} Campus Credits.`);
  };

  const updateRewardRule = (id: string, updates: Partial<RewardRule>) => {
    setRewardRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString().substring(0, 10) } : r))
    );
    addAuditLog('UPDATE_REWARD_RULE', 'REWARD_RULE', id, `Updated reward parameters for ${id}`);
  };

  // AI Mentor messaging with mode-specific reasoning
  const sendAiMessage = (messageText: string) => {
    if (!messageText.trim()) return;
    // One question at a time: ignore clicks while an answer is still on its way.
    if (isAiThinking) return;

    const userMsg: AIMessage = {
      id: `ai_${Date.now()}`,
      role: 'user',
      content: messageText,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setIsAiThinking(true);

    // Team mode: ask the PeerCraft server, which runs the AI Team Finder (Dify) for us.
    // Learn / Hint / Debug below are still scripted demo replies.
    if (aiMentorMode === 'Team') {
      findTeammates(messageText, [initialUser, adminUser, ...otherStudents], currentUser.id)
        .then((result) => formatTeamReply(result))
        .catch((err: unknown) =>
          err instanceof TeamFinderError
            ? err.message
            : 'Something went wrong while looking for teammates. Please try again.'
        )
        .then((content) => {
          const assistantMsg: AIMessage = {
            id: `ai_resp_${Date.now()}`,
            role: 'assistant',
            mode: 'Team',
            content,
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setAiMessages((prev) => [...prev, assistantMsg]);
          setIsAiThinking(false);
        });
      return;
    }

    // Realistic intelligent assistant response generation
    setTimeout(() => {
      let replyContent = '';
      const qContext = selectedQuestionContext ? `regarding "${selectedQuestionContext.title}"` : '';

      if (aiMentorMode === 'Learn') {
        replyContent = `### Concept Breakdown ${qContext}\n\n` +
          `Let's analyze the underlying pattern:\n\n` +
          `1. **Problem Core:** This problem evaluates your understanding of algorithmic trade-offs (space vs. time complexity).\n` +
          `2. **Key Intuition:** Instead of a brute-force approach (often $O(N^2)$), think about how storing intermediate states in an auxiliary hash map or two-pointer window reduces unnecessary computations to $O(N)$.\n` +
          `3. **Step-by-Step Logic:**\n` +
          `   - **Step 1:** Initialize pointers or frequency maps.\n` +
          `   - **Step 2:** Iterate while maintaining invariant conditions.\n` +
          `   - **Step 3:** Evaluate candidate solutions on-the-fly.\n\n` +
          `*Question for you:* Have you considered what happens if the input has duplicate values or negative numbers?`;
      } else if (aiMentorMode === 'Hint') {
        replyContent = `### Progressive Hint ${qContext}\n\n` +
          `💡 **Hint 1 of 3:**\n` +
          `Notice how sorting the input array or utilizing a hash map transforms lookups from linear time to constant time $O(1)$.\n\n` +
          `> *Key Question to consider:* Can you traverse the array once and check if the complement \`(target - current)\` was already encountered?\n\n` +
          `Let me know if you would like **Hint 2** (focusing on edge cases and memory bounds).`;
      } else {
        // Debug mode
        replyContent = `### Debugging Analysis ${qContext}\n\n` +
          `Here is what to look out for in your implementation:\n\n` +
          `1. **Boundary & Off-by-one errors:** Ensure while-loop conditions use \`<= \` or \`< \` according to inclusive/exclusive index semantics.\n` +
          `2. **Empty or Single-element checks:** Handle \`len == 0\` or \`len == 1\` upfront to prevent NullPointer or IndexOutOfBounds exceptions.\n` +
          `3. **Time Complexity:** Optimal target is typically **$O(N)$ time** and **$O(N)$ auxiliary space**.\n\n` +
          `If you paste your exact code snippet, I can identify the specific line failing tests.`;
      }

      const assistantMsg: AIMessage = {
        id: `ai_resp_${Date.now()}`,
        role: 'assistant',
        mode: aiMentorMode,
        content: replyContent,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setAiMessages((prev) => [...prev, assistantMsg]);
      setIsAiThinking(false);
    }, 800);
  };

  const clearAiMessages = () => {
    setAiMessages([
      {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        mode: aiMentorMode,
        content: `Conversation refreshed. I'm ready to assist you in ${aiMentorMode} mode. Ask any question or paste a code snippet!`,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const resetToDemoDefaults = () => {
    localStorage.clear();
    setCurrentUser(initialUser);
    setAvailableCredits(1250);
    setLifetimeEarned(1250);
    setLifetimeSpent(0);
    setPlatformConnections(initialPlatformConnections);
    setProjects(initialProjects);
    setCodingQuestions(initialCodingQuestions);
    setUnlockedQuestionIds([]);
    setTransactions(initialTransactions);
    setHistory(initialHistory);
    setResources(initialResources);
    setMicroGigs(initialMicroGigs);
    setEvents(initialEvents);
    setCommunityPosts(initialCommunityPosts);
    setNotifications(initialNotifications);
    setSignupBonusAmountState(1000);
    setRewardRules(initialRewardRules);
    setAuditLogs(initialAuditLogs);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        switchUser,
        allUsers: [initialUser, adminUser, ...otherStudents],
        updateUserProfile,
        availableCredits,
        lifetimeEarned,
        lifetimeSpent,
        transactions,
        history,
        addHistoryItem,
        platformConnections,
        updatePlatformConnection,
        claimPlatformReward,
        codingQuestions,
        unlockedQuestionIds,
        unlockQuestion,
        addCodingQuestion,
        updateCodingQuestion,
        verifyQuestionLink,
        projects,
        activeProjectsCount,
        createProject,
        joinProject,
        resources,
        borrowedResourcesCount,
        borrowResource,
        returnResource,
        microGigs,
        applyToGig,
        createGig,
        events,
        registerForEvent,
        communityPosts,
        createCommunityPost,
        togglePostUpvote,
        addCommentToPost,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        signupBonusAmount,
        setSignupBonusAmount,
        rewardRules,
        updateRewardRule,
        auditLogs,
        addAuditLog,
        aiMessages,
        aiMentorMode,
        setAiMentorMode,
        isAiMentorOpen,
        setIsAiMentorOpen,
        selectedQuestionContext,
        setSelectedQuestionContext,
        sendAiMessage,
        clearAiMessages,
        isAiThinking,
        searchQuery,
        setSearchQuery,
        isSidebarCollapsed,
        toggleSidebarCollapse,
        setSidebarCollapsed,
        quickActions,
        reorderQuickActions,
        moveQuickAction,
        resetQuickActions,
        showAvatarPicker,
        setShowAvatarPicker,
        updateAvatar,
        isFullscreen,
        toggleFullscreen,
        resetToDemoDefaults,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
