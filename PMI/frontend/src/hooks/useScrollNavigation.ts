import { useState, useEffect, useCallback } from 'react';

const SECTION_IDS = ['basic', 'specs', 'sales', 'logistics', 'other', 'channels'];

export function useScrollNavigation() {
  const [activeSection, setActiveSection] = useState('basic');

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      for (const sectionId of SECTION_IDS) {
        const element = document.getElementById(`section-${sectionId}`);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom > 150) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveSection(sectionId);
  }, []);

  return { activeSection, scrollToSection };
}
