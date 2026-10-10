export type UserRole = 'student' | 'admin' | 'moderator';

export interface UserProfile {
  id: string;
  fullName: string;
  firstName: string;
  email: string;
  avatarUrl: string;
  college: string;
  branch: string;
  academicYear: string; // e.g. "Third Year"
  bio: string;
  role: UserRole;
  reputation: number; // e.g. 4.6
  profileVisibility: 'public' | 'campus_only' | 'private';
  interests: string[];
  skills: { name: string; proficiency: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'; verified: boolean }[];
  githubUrl?: string;
  linkedinUrl?: string;
  leetcodeUrl?: string;
  hackerrankUrl?: string;
  statusEmoji?: string;
  avatarPresetId?: string;
  completedProjectsCount: number;
  signupBonusAwarded: boolean;
  createdAt: string;
}

export interface AvatarPreset {
  id: string;
  name: string;
  category: '3D Modern' | 'Campus Tech' | 'Illustrated' | 'Anime Dev';
  url: string;
}

export interface QuickActionItem {
  id: string;
  title: string;
  desc: string;
  iconName: string;
  to: string;
  colorClass?: string;
}

export interface PlatformConnection {
  id: string;
  platform: 'leetcode' | 'hackerrank' | 'github' | 'linkedin';
  displayName: string;
  username: string;
  profileUrl: string;
  isConnected: boolean;
  isVerified: boolean;
  creditsEarnedToday: number;
  dailyCap: number;
  lastSyncAt?: string;
  eligibleActivities: string[];
}

export interface CreditAccount {
  userId: string;
  availableBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
}

export type TransactionType = 'signup_bonus' | 'reward_leetcode' | 'reward_github' | 'reward_hackerrank' | 'reward_linkedin' | 'unlock_question' | 'resource_deposit' | 'micro_gig_payout' | 'admin_adjustment';

export interface CreditTransaction {
  id: string;
  userId: string;
  transactionType: TransactionType;
  amount: number; // positive for credit, negative for debit
  description: string;
  sourcePlatform?: string;
  referenceId?: string;
  idempotencyKey?: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
}

export interface ActivityHistoryItem {
  id: string;
  userId: string;
  eventType: 'credit_earned' | 'credit_spent' | 'project_joined' | 'project_created' | 'question_unlocked' | 'platform_connected' | 'resource_borrowed' | 'milestone_completed' | 'gig_completed' | 'event_registered';
  category: 'Credits Earned' | 'Credits Spent' | 'Projects' | 'Developer Platforms' | 'Team Invitations' | 'Resources' | 'Events' | 'Profile Updates' | 'Coding Arena';
  title: string;
  description: string;
  timestamp: string;
  status: 'Completed' | 'Active' | 'Pending' | 'Verified';
  creditDelta?: number;
  associatedEntityId?: string;
  linkUrl?: string;
}

export type CodingPlatform = 'LeetCode' | 'HackerRank' | 'GeeksforGeeks';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface CodingQuestion {
  id: string;
  title: string;
  platform: CodingPlatform;
  questionUrl: string;
  difficulty: QuestionDifficulty;
  topics: string[];
  summary: string;
  category: 'Free' | 'Premium';
  creditPrice: number; // 0 for free, 100 default for premium
  externalAccessRequirement?: string; // e.g. "Requires destination LeetCode Premium subscription"
  isPublished: boolean;
  lastLinkVerifiedAt: string;
  createdAt: string;
}

export interface QuestionUnlock {
  id: string;
  userId: string;
  questionId: string;
  transactionId: string;
  creditsPaid: number;
  unlockedAt: string;
}

export interface ProjectMember {
  userId: string;
  name: string;
  avatarUrl: string;
  role: string;
  joinedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  category: string; // e.g. "Web Development", "AI / ML", "IoT & Hardware"
  technologies: string[];
  requiredSkills: string[];
  ownerId: string;
  ownerName: string;
  members: ProjectMember[];
  status: 'Active' | 'Planning' | 'In Progress' | 'On Hold' | 'Completed';
  userRole?: string; // user's role in this project if enrolled
  progress: number; // 0 to 100
  memberCount: number;
  maxMembers: number;
  repoUrl?: string;
  coverImage?: string;
  lastUpdated: string;
  createdAt: string;
  isUserEnrolled?: boolean;
}

export interface ResourceItem {
  id: string;
  name: string;
  category: 'Books' | 'Lab Equipment' | 'Electronics' | 'Learning Materials';
  description: string;
  ownerId: string;
  ownerName: string;
  availability: 'Available' | 'Borrowed' | 'Reserved';
  borrowingDuration: string;
  creditCost?: number;
  imageUrl?: string;
  borrowedByUserId?: string;
  borrowedAt?: string;
  dueDate?: string;
}

export interface MicroGig {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  deadline: string;
  creatorId: string;
  creatorName: string;
  rewardCredits: number;
  status: 'Open' | 'Assigned' | 'In Progress' | 'Submitted' | 'Completed';
  applicantsCount: number;
  createdAt: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  category: 'Hackathon' | 'Workshop' | 'Meetup' | 'Competition' | 'Online Session';
  dateTime: string;
  location: string;
  isOnline: boolean;
  organizer: string;
  registrationDeadline: string;
  eligibility: string;
  tags: string[];
  registrationUrl: string;
  isRegistered?: boolean;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorBranch: string;
  category: 'Announcement' | 'Discussion' | 'Achievement' | 'Team Formation';
  title: string;
  content: string;
  tags: string[];
  upvotes: number;
  isUpvoted?: boolean;
  commentCount: number;
  comments: {
    id: string;
    authorName: string;
    authorAvatar: string;
    content: string;
    createdAt: string;
  }[];
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'project_invite' | 'credit_reward' | 'question_unlock' | 'resource_request' | 'gig_update' | 'event_reminder' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  linkUrl?: string;
  createdAt: string;
}

export interface RewardRule {
  id: string;
  platform: 'leetcode' | 'hackerrank' | 'github' | 'linkedin';
  activityType: string;
  rewardAmount: number;
  dailyCap: number;
  active: boolean;
  verificationMethod: 'OAuth / Webhook API' | 'Public Profile Scrape & Commit Hash' | 'Manual Review';
  updatedAt: string;
}

export interface AuditLogItem {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export type AiMentorMode = 'Learn' | 'Hint' | 'Debug' | 'Team';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  codeSnippet?: string;
  mode?: AiMentorMode;
  createdAt: string;
}
