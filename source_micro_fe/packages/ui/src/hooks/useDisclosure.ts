'use client';

import { useState, useCallback } from 'react';

interface UseDisclosureReturn {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
}

export const useDisclosure = (initialState = false): UseDisclosureReturn => {
  const [isOpen, setIsOpen] = useState(initialState);
  return {
    isOpen,
    onOpen: useCallback(() => setIsOpen(true), []),
    onClose: useCallback(() => setIsOpen(false), []),
    onToggle: useCallback(() => setIsOpen((prev) => !prev), []),
  };
};
