-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CITIZEN', 'STUDENT', 'RESEARCHER', 'INDUSTRY_PARTNER', 'GOVERNMENT_REPRESENTATIVE', 'ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "SolutionStatus" AS ENUM ('proposed', 'under_review', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "ProgressUpdateType" AS ENUM ('STATUS', 'UPDATE');

-- CreateEnum
CREATE TYPE "MembershipRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('proposed', 'active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "TeamRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('planned', 'in_progress', 'completed', 'blocked');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'blocked', 'done');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('draft', 'submitted', 'approved', 'changes_requested', 'rejected');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'reviewed', 'dismissed', 'actioned');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CITIZEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "supportingInformation" TEXT,
    "proposedSolutions" TEXT,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'open',
    "votes" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solution" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposedApproach" TEXT,
    "expectedImpact" TEXT,
    "requiredResources" TEXT,
    "authorId" TEXT,
    "status" "SolutionStatus" NOT NULL DEFAULT 'proposed',
    "challengeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Solution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationType" TEXT,
    "expertise" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "challengeId" TEXT,
    "solutionId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ModerationStatus" NOT NULL DEFAULT 'pending',
    "moderatorId" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembershipRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "message" TEXT,
    "status" "MembershipRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembershipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "challengeId" TEXT,
    "solutionId" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTeamMembership" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTeamRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "message" TEXT,
    "status" "TeamRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTeamRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "assigneeId" TEXT,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionEvaluation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "impact" INTEGER NOT NULL,
    "feasibility" INTEGER NOT NULL,
    "sustainability" INTEGER NOT NULL,
    "equity" INTEGER NOT NULL,
    "innovation" INTEGER NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolutionEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "reviewerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "externalUrl" TEXT NOT NULL,
    "urlHost" TEXT NOT NULL,
    "status" "DeliverableStatus" NOT NULL DEFAULT 'draft',
    "reviewerFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collaboration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT,
    "solutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collaboration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT,
    "solutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressUpdate" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "ProgressUpdateType" NOT NULL DEFAULT 'UPDATE',
    "status" "ChallengeStatus",
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "challengeId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ChallengeToOrganization" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ChallengeToOrganization_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Challenge_authorId_createdAt_idx" ON "Challenge"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Challenge_category_createdAt_idx" ON "Challenge"("category", "createdAt");

-- CreateIndex
CREATE INDEX "Challenge_status_createdAt_idx" ON "Challenge"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Challenge_location_createdAt_idx" ON "Challenge"("location", "createdAt");

-- CreateIndex
CREATE INDEX "Challenge_title_idx" ON "Challenge"("title");

-- CreateIndex
CREATE INDEX "Solution_challengeId_idx" ON "Solution"("challengeId");

-- CreateIndex
CREATE INDEX "Solution_authorId_idx" ON "Solution"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationReport_status_createdAt_idx" ON "ModerationReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationReport_challengeId_idx" ON "ModerationReport"("challengeId");

-- CreateIndex
CREATE INDEX "ModerationReport_solutionId_idx" ON "ModerationReport"("solutionId");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationReport_reporterId_challengeId_solutionId_key" ON "ModerationReport"("reporterId", "challengeId", "solutionId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "OrganizationMembershipRequest_organizationId_status_created_idx" ON "OrganizationMembershipRequest"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembershipRequest_organizationId_requesterId_st_key" ON "OrganizationMembershipRequest"("organizationId", "requesterId", "status");

-- CreateIndex
CREATE INDEX "Project_organizationId_status_createdAt_idx" ON "Project"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Project_challengeId_idx" ON "Project"("challengeId");

-- CreateIndex
CREATE INDEX "Project_solutionId_idx" ON "Project"("solutionId");

-- CreateIndex
CREATE INDEX "ProjectTeamMembership_userId_idx" ON "ProjectTeamMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamMembership_projectId_userId_key" ON "ProjectTeamMembership"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectTeamRequest_projectId_status_createdAt_idx" ON "ProjectTeamRequest"("projectId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamRequest_projectId_requesterId_status_key" ON "ProjectTeamRequest"("projectId", "requesterId", "status");

-- CreateIndex
CREATE INDEX "Milestone_projectId_status_dueDate_idx" ON "Milestone"("projectId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "SolutionEvaluation_projectId_createdAt_idx" ON "SolutionEvaluation"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SolutionEvaluation_projectId_solutionId_evaluatorId_key" ON "SolutionEvaluation"("projectId", "solutionId", "evaluatorId");

-- CreateIndex
CREATE INDEX "Deliverable_projectId_status_createdAt_idx" ON "Deliverable"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityRecord_projectId_createdAt_idx" ON "ActivityRecord"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_challengeId_key" ON "Vote"("userId", "challengeId");

-- CreateIndex
CREATE INDEX "Collaboration_challengeId_idx" ON "Collaboration"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "Collaboration_userId_challengeId_solutionId_key" ON "Collaboration"("userId", "challengeId", "solutionId");

-- CreateIndex
CREATE INDEX "Comment_challengeId_idx" ON "Comment"("challengeId");

-- CreateIndex
CREATE INDEX "Comment_solutionId_idx" ON "Comment"("solutionId");

-- CreateIndex
CREATE INDEX "ProgressUpdate_challengeId_createdAt_idx" ON "ProgressUpdate"("challengeId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgressUpdate_authorId_createdAt_idx" ON "ProgressUpdate"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_challengeId_createdAt_idx" ON "Notification"("challengeId", "createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_userId_score_idx" ON "Recommendation"("userId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_userId_challengeId_key" ON "Recommendation"("userId", "challengeId");

-- CreateIndex
CREATE INDEX "_ChallengeToOrganization_B_index" ON "_ChallengeToOrganization"("B");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solution" ADD CONSTRAINT "Solution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solution" ADD CONSTRAINT "Solution_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembershipRequest" ADD CONSTRAINT "OrganizationMembershipRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembershipRequest" ADD CONSTRAINT "OrganizationMembershipRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamMembership" ADD CONSTRAINT "ProjectTeamMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamMembership" ADD CONSTRAINT "ProjectTeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamRequest" ADD CONSTRAINT "ProjectTeamRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamRequest" ADD CONSTRAINT "ProjectTeamRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionEvaluation" ADD CONSTRAINT "SolutionEvaluation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionEvaluation" ADD CONSTRAINT "SolutionEvaluation_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionEvaluation" ADD CONSTRAINT "SolutionEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecord" ADD CONSTRAINT "ActivityRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecord" ADD CONSTRAINT "ActivityRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChallengeToOrganization" ADD CONSTRAINT "_ChallengeToOrganization_A_fkey" FOREIGN KEY ("A") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChallengeToOrganization" ADD CONSTRAINT "_ChallengeToOrganization_B_fkey" FOREIGN KEY ("B") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
