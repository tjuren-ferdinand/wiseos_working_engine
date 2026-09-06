'use client';

import React from 'react';
import { notFound } from 'next/navigation';
import {
  tokens,
  DisplayLg,
  Heading1,
  Heading2,
  Heading3,
  Body,
  BodySmall,
  Caption,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardContent,
  StatCard,
  Input,
  Badge,
  StatusBadge,
  Sidebar,
  SidebarSection,
  SidebarItem,
  HomeIcon,
  FolderIcon,
  UsersIcon,
  ChartIcon,
  SettingsIcon,
  GraduationIcon,
  Navigation,
  Avatar,
} from '../../experimental-ui';

/**
 * Design Lab Dashboard
 * 
 * Premium SaaS dashboard concept for WiseOS
 * Apple Vision Pro / Linear / Vercel inspired
 * 
 * Features:
 * - Elegant whitespace
 * - Modern typography
 * - Soft depth and shadows
 * - Clean cards
 * - Glass effects (sparingly)
 * - Enterprise quality
 * - Luxury EdTech feel
 */
export default function DesignLabPage() {
  // Experimental route — excluded from production builds unless explicitly
  // enabled via NEXT_PUBLIC_ENABLE_DESIGN_LAB=true (dev/staging only).
  if (process.env.NEXT_PUBLIC_ENABLE_DESIGN_LAB !== 'true') {
    notFound();
  }

  const [activeNav, setActiveNav] = React.useState('dashboard');

  return (
    <div style={{ display: 'flex' }}>
      {/* Sidebar */}
      <Sidebar>
        <SidebarSection>
          <SidebarItem
            icon={<HomeIcon />}
            label="Dashboard"
            active={activeNav === 'dashboard'}
            onClick={() => setActiveNav('dashboard')}
          />
          <SidebarItem
            icon={<GraduationIcon />}
            label="Classes"
            badge={5}
            active={activeNav === 'classes'}
            onClick={() => setActiveNav('classes')}
          />
          <SidebarItem
            icon={<FolderIcon />}
            label="Assignments"
            active={activeNav === 'assignments'}
            onClick={() => setActiveNav('assignments')}
          />
          <SidebarItem
            icon={<UsersIcon />}
            label="Students"
            active={activeNav === 'students'}
            onClick={() => setActiveNav('students')}
          />
        </SidebarSection>

        <SidebarSection title="Analytics">
          <SidebarItem
            icon={<ChartIcon />}
            label="Reports"
            active={activeNav === 'reports'}
            onClick={() => setActiveNav('reports')}
          />
        </SidebarSection>

        <SidebarSection title="System">
          <SidebarItem
            icon={<SettingsIcon />}
            label="Settings"
            active={activeNav === 'settings'}
            onClick={() => setActiveNav('settings')}
          />
        </SidebarSection>
      </Sidebar>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          marginLeft: '260px',
          minHeight: 'calc(100vh - 32px)',
        }}
      >
        {/* Top navigation */}
        <header
          style={{
            position: 'sticky',
            top: '32px',
            zIndex: tokens.zIndex.sticky,
            backgroundColor: tokens.colors.background,
            borderBottom: `1px solid ${tokens.colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '64px',
              padding: `0 ${tokens.spacing[8]}`,
            }}
          >
            <div>
              <Heading2>Dashboard</Heading2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}>
              <Input
                placeholder="Search..."
                style={{ width: '280px' }}
                icon={<SearchIcon />}
              />
              <IconButton variant="ghost">
                <BellIcon />
              </IconButton>
              <Avatar name="Anna Larsson" size={36} />
            </div>
          </div>
        </header>

        {/* Dashboard content */}
        <div style={{ padding: tokens.spacing[8] }}>
          {/* Welcome section */}
          <div style={{ marginBottom: tokens.spacing[8] }}>
            <DisplayLg>Good morning, Anna</DisplayLg>
            <Body style={{ color: tokens.colors.textSecondary, marginTop: tokens.spacing[2] }}>
              Here&apos;s what&apos;s happening with your classes today.
            </Body>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: tokens.spacing[6],
              marginBottom: tokens.spacing[8],
            }}
          >
            <StatCard
              label="Total Students"
              value="247"
              change={{ value: '12%', positive: true }}
              icon={<UsersIcon />}
            />
            <StatCard
              label="Active Classes"
              value="12"
              icon={<GraduationIcon />}
            />
            <StatCard
              label="Pending Reviews"
              value="34"
              change={{ value: '8 new', positive: false }}
              icon={<FolderIcon />}
            />
            <StatCard
              label="Avg. Score"
              value="78%"
              change={{ value: '3%', positive: true }}
              icon={<ChartIcon />}
            />
          </div>

          {/* Two column layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: tokens.spacing[6],
            }}
          >
            {/* Recent activity */}
            <Card variant="default" padding="lg">
              <CardHeader>
                <Heading3>Recent Activity</Heading3>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
                  <ActivityItem
                    title="Math 9A - Chapter Test"
                    subtitle="32 submissions ready for review"
                    time="2 hours ago"
                    status="pending"
                  />
                  <ActivityItem
                    title="Physics 8B - Lab Report"
                    subtitle="All submissions graded"
                    time="Yesterday"
                    status="completed"
                  />
                  <ActivityItem
                    title="Chemistry 9C - Quiz 4"
                    subtitle="Processing 12 submissions..."
                    time="Just now"
                    status="active"
                  />
                  <ActivityItem
                    title="English 7A - Essay"
                    subtitle="28 submissions graded"
                    time="2 days ago"
                    status="completed"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card variant="elevated" padding="lg">
              <CardHeader>
                <Heading3>Quick Actions</Heading3>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[3] }}>
                  <Button variant="primary" fullWidth icon={<PlusIcon />}>
                    New Assignment
                  </Button>
                  <Button variant="secondary" fullWidth icon={<UploadIcon />}>
                    Upload Submissions
                  </Button>
                  <Button variant="ghost" fullWidth icon={<FolderIcon />}>
                    Browse Classes
                  </Button>
                </div>

                <div
                  style={{
                    marginTop: tokens.spacing[6],
                    paddingTop: tokens.spacing[6],
                    borderTop: `1px solid ${tokens.colors.border}`,
                  }}
                >
                  <Caption>Need help?</Caption>
                  <BodySmall style={{ marginTop: tokens.spacing[1] }}>
                    Check out our documentation or contact support.
                  </BodySmall>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Components showcase */}
          <div style={{ marginTop: tokens.spacing[12] }}>
            <Heading2 style={{ marginBottom: tokens.spacing[6] }}>Component Library</Heading2>
            
            {/* Buttons */}
            <Card variant="outlined" padding="lg" style={{ marginBottom: tokens.spacing[6] }}>
              <CardHeader>
                <Heading3>Buttons</Heading3>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', gap: tokens.spacing[3], flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="primary" size="sm">Small</Button>
                  <Button variant="primary" size="lg">Large</Button>
                  <Button variant="primary" loading>Loading</Button>
                  <Button variant="primary" disabled>Disabled</Button>
                </div>
              </CardContent>
            </Card>

            {/* Badges */}
            <Card variant="outlined" padding="lg" style={{ marginBottom: tokens.spacing[6] }}>
              <CardHeader>
                <Heading3>Badges</Heading3>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', gap: tokens.spacing[3], flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge>Default</Badge>
                  <Badge variant="primary">Primary</Badge>
                  <Badge variant="success" dot>Success</Badge>
                  <Badge variant="warning" dot>Warning</Badge>
                  <Badge variant="error" dot>Error</Badge>
                  <Badge variant="info">Info</Badge>
                  <StatusBadge status="active" />
                  <StatusBadge status="pending" />
                  <StatusBadge status="completed" />
                </div>
              </CardContent>
            </Card>

            {/* Cards */}
            <Card variant="outlined" padding="lg">
              <CardHeader>
                <Heading3>Card Variants</Heading3>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: tokens.spacing[4] }}>
                  <Card variant="default" padding="md">
                    <BodySmall>Default</BodySmall>
                  </Card>
                  <Card variant="elevated" padding="md">
                    <BodySmall>Elevated</BodySmall>
                  </Card>
                  <Card variant="outlined" padding="md">
                    <BodySmall>Outlined</BodySmall>
                  </Card>
                  <Card variant="glass" padding="md">
                    <BodySmall>Glass</BodySmall>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

interface ActivityItemProps {
  title: string;
  subtitle: string;
  time: string;
  status: 'active' | 'pending' | 'completed';
}

function ActivityItem({ title, subtitle, time, status }: ActivityItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: tokens.spacing[3],
        borderRadius: tokens.radius.lg,
        backgroundColor: tokens.colors.background,
      }}
    >
      <div style={{ flex: 1 }}>
        <Body style={{ fontWeight: tokens.typography.weightMedium }}>{title}</Body>
        <BodySmall>{subtitle}</BodySmall>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[4] }}>
        <BodySmall>{time}</BodySmall>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="5" />
      <path d="M12 12l4 4" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 2a5 5 0 015 5v3l2 3H3l2-3V7a5 5 0 015-5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17a2 2 0 004 0" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 3v12M3 9h12" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 12v3a1 1 0 001 1h10a1 1 0 001-1v-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12V3M5 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
