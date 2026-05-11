import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const DemoContext = createContext();

export const useDemo = () => useContext(DemoContext);

export const DemoProvider = ({ children }) => {
  const [isDemoActive, setIsDemoActive] = useState(false);
  const [demoStep, setDemoStep] = useState(-1); // -1: standby, 0: intro, 1: focus fab, 2: compose, 3: post btn, 4: highlight post, 5: thread, 6: finish
  const [highlightCoords, setHighlightCoords] = useState(null);
  const [demoPostId, setDemoPostId] = useState(null);
  const [autoTypeText, setAutoTypeText] = useState('');
  const [onContinueAction, setOnContinueAction] = useState(null);

  const nextStep = useCallback(() => {
    setDemoStep(prev => prev + 1);
  }, []);

  const resetDemo = useCallback(() => {
    setIsDemoActive(false);
    setDemoStep(-1);
    setHighlightCoords(null);
    setDemoPostId(null);
    setAutoTypeText('');
    setOnContinueAction(null);
  }, []);

  const registerContinueAction = useCallback((fn) => {
    setOnContinueAction(() => fn);
    return () => setOnContinueAction(null);
  }, []);

  const startDemo = useCallback(() => {
    setIsDemoActive(true);
    setDemoStep(1);
  }, []);

  return (
    <DemoContext.Provider
      value={{
        isDemoActive,
        setIsDemoActive,
        demoStep,
        setDemoStep,
        nextStep,
        resetDemo,
        startDemo,
        highlightCoords,
        setHighlightCoords,
        demoPostId,
        setDemoPostId,
        autoTypeText,
        setAutoTypeText,
        onContinueAction,
        registerContinueAction,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};
