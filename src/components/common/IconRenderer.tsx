import React from 'react';
import * as Icons from 'lucide-react';

interface IconRendererProps {
  name: string;
  className?: string;
  size?: number;
}

export const AVAILABLE_LUCIDE_ICONS = [
  'Globe',
  'Instagram',
  'Facebook',
  'Youtube',
  'MessageCircle',
  'Phone',
  'Mail',
  'GraduationCap',
  'BookOpen',
  'Book',
  'School',
  'UserPlus',
  'FileText',
  'Folder',
  'Calendar',
  'Award',
  'CheckCircle',
  'Layers',
  'Link',
  'ExternalLink',
  'Heart',
  'HelpCircle',
  'Info',
  'Bell',
  'Download',
  'Database',
  'QrCode',
  'Settings',
  'Shield',
  'Users',
  'BarChart2',
  'Compass',
  'MapPin',
  'Camera',
  'Video',
  'Sparkles',
  'Briefcase',
  'DollarSign',
  'Clock',
  'Star',
];

export const IconRenderer: React.FC<IconRendererProps> = ({ name, className = 'w-5 h-5', size }) => {
  const IconComponent = (Icons as any)[name] || Icons.Globe;
  return <IconComponent className={className} size={size} />;
};
