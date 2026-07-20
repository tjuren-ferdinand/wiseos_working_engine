/**
 * WiseOS Experimental UI System
 * 
 * Apple Vision Pro / Linear / Vercel inspired
 * Scandinavian minimalism + Premium SaaS + Luxury EdTech
 * 
 * This design system is ISOLATED to /design-lab only.
 * Do not import these components into production routes.
 */

// Design tokens
export { tokens } from './tokens';
export type { Tokens } from './tokens';

// Typography
export {
  DisplayXL,
  DisplayLg,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  BodyLarge,
  Body,
  BodySmall,
  Caption,
  Code,
} from './typography';

// Components
export { Button, IconButton } from './components/Button';
export { Card, CardHeader, CardContent, CardFooter, StatCard } from './components/Card';
export { Input, Textarea, Select } from './components/Input';
export { Badge, StatusBadge } from './components/Badge';
export { Logo, LogoMark } from './components/Logo';
export { Navigation, Avatar } from './components/Navigation';
export {
  Sidebar,
  SidebarSection,
  SidebarItem,
  HomeIcon,
  FolderIcon,
  UsersIcon,
  ChartIcon,
  SettingsIcon,
  DocumentIcon,
  GraduationIcon,
} from './components/Sidebar';
