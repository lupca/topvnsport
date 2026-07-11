import { Category } from '../../types';

export const categoryTileThemes = [
  {
    shell: 'from-slate-950 via-slate-900 to-slate-800',
    accent: 'from-white/10 to-white/0',
    chip: 'bg-white/10 text-white/85 border-white/10',
    badge: 'text-white/80',
    monogram: 'bg-white/10 text-white'
  },
  {
    shell: 'from-brand-primary via-sky-600 to-cyan-600',
    accent: 'from-white/20 to-white/0',
    chip: 'bg-white/10 text-white border-white/10',
    badge: 'text-white/75',
    monogram: 'bg-white/15 text-white'
  },
  {
    shell: 'from-emerald-600 via-teal-600 to-cyan-700',
    accent: 'from-white/15 to-white/0',
    chip: 'bg-white/10 text-white border-white/10',
    badge: 'text-white/75',
    monogram: 'bg-white/15 text-white'
  },
  {
    shell: 'from-amber-500 via-orange-600 to-rose-600',
    accent: 'from-white/20 to-white/0',
    chip: 'bg-black/10 text-white border-white/10',
    badge: 'text-white/80',
    monogram: 'bg-white/15 text-white'
  },
  {
    shell: 'from-violet-600 via-fuchsia-600 to-pink-600',
    accent: 'from-white/20 to-white/0',
    chip: 'bg-white/10 text-white border-white/10',
    badge: 'text-white/75',
    monogram: 'bg-white/15 text-white'
  }
];

export function getCategoryMonogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function getCategorySubtitle(category: Category) {
  return category.display_name.replace(/^\[root\]\s*\/\s*/, '');
}
