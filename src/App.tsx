import React, { useState, useEffect, useMemo } from 'react';
import { CleaningTask, WeekAssignment, MonthOption, SummarySelection } from './types';
import { CLEANING_TASKS, getActiveMonths, getInitialSignupsForWeek } from './data';
import { 
  Sparkles, Clock, User, Check, Calendar, ArrowLeft, 
  CheckCircle2, Edit3, AlertTriangle, LogOut, Download, 
  UserCheck, ShieldCheck, Heart, ChevronRight, RefreshCw, Eye,
  HelpCircle, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';

export default function App() {
  // Calculate 4 active months dynamically
  const activeMonths = useMemo(() => {
    return getActiveMonths();
  }, []);

  // 1. Volunteer Name (Home page request)
  const [volunteerName, setVolunteerName] = useState<string>(() => {
    return localStorage.getItem('ch6_volunteer_name') || '';
  });

  // Persist name changes
  useEffect(() => {
    localStorage.setItem('ch6_volunteer_name', volunteerName);
  }, [volunteerName]);

  // 2. State for all week signups
  const [signupsByWeek, setSignupsByWeek] = useState<{ [weekId: string]: { [taskId: string]: string | null } }>({});

  // Real-time Firestore sync
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'signups'), (snapshot) => {
      const fbSignups: { [weekId: string]: { [taskId: string]: string | null } } = {};
      
      snapshot.forEach((doc) => {
        fbSignups[doc.id] = doc.data() as { [taskId: string]: string | null };
      });
      
      // Merge with default/initial template signups for weeks that are not yet in Firestore
      const finalSignups = { ...fbSignups };
      activeMonths.forEach(m => {
        m.saturdays.forEach(sat => {
          if (!finalSignups[sat.id]) {
            finalSignups[sat.id] = getInitialSignupsForWeek(sat.id);
          }
        });
      });
      
      setSignupsByWeek(finalSignups);
    }, (error) => {
      console.error("Firestore subscription error", error);
      handleFirestoreError(error, OperationType.GET, 'signups');
    });

    return () => unsubscribe();
  }, [activeMonths]);

  // 3. Navigation states
  const [currentPage, setCurrentPage] = useState<'home' | 'task-selection' | 'summary'>('home');
  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [latestSelection, setLatestSelection] = useState<SummarySelection | null>(null);

  // 4. Modal and Action States
  const [modalType, setModalType] = useState<'claim' | 'edit' | 'warning' | null>(null);
  const [activeTask, setActiveTask] = useState<CleaningTask | null>(null);
  const [tempVolunteerName, setTempVolunteerName] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string>('');

  // Initialize selected month if empty
  useEffect(() => {
    if (activeMonths.length > 0 && !selectedMonthId) {
      setSelectedMonthId(activeMonths[0].id);
    }
  }, [activeMonths, selectedMonthId]);

  // Find currently selected month details
  const currentMonthOption = useMemo(() => {
    return activeMonths.find(m => m.id === selectedMonthId);
  }, [activeMonths, selectedMonthId]);

  // Ensure a selected week is always set when month changes
  useEffect(() => {
    if (currentMonthOption && currentMonthOption.saturdays.length > 0) {
      // Default to first week of the selected month
      setSelectedWeekId(currentMonthOption.saturdays[0].id);
    }
  }, [currentMonthOption]);

  // Current selected week Saturdays details
  const currentWeekOption = useMemo(() => {
    if (!currentMonthOption) return null;
    return currentMonthOption.saturdays.find(sat => sat.id === selectedWeekId) || currentMonthOption.saturdays[0];
  }, [currentMonthOption, selectedWeekId]);

  // Helper to extract last name
  const getLastName = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 0 ? parts[parts.length - 1] : "";
  };

  const isAdminUser = (name: string): boolean => {
    return name.trim().toLowerCase() === '&rcd%';
  };

  // Helper to check if name or last name matches
  const canChangeSignup = (currentUser: string, signedUpUser: string): boolean => {
    if (!currentUser.trim() || !signedUpUser.trim()) return false;

    if (isAdminUser(currentUser)) return true;

    const curLower = currentUser.trim().toLowerCase();
    const sgnLower = signedUpUser.trim().toLowerCase();
    if (curLower === sgnLower) return true;
    
    const curLast = getLastName(currentUser).toLowerCase();
    const sgnLast = getLastName(signedUpUser).toLowerCase();
    
    return curLast !== "" && sgnLast !== "" && curLast === sgnLast;
  };

  // Helper to save a single task update to Firestore
  const saveTaskSignup = async (weekId: string, taskId: string, name: string | null) => {
    try {
      await setDoc(doc(db, 'signups', weekId), {
        [taskId]: name
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save signup to Firestore:", e);
      handleFirestoreError(e, OperationType.WRITE, `signups/${weekId}`);
    }
  };

  // Claim dynamic action
  const handleClaimTask = (task: CleaningTask) => {
    setActiveTask(task);
    if (!volunteerName.trim()) {
      setTempVolunteerName('');
      setModalType('claim');
    } else {
      // Pre-fill and sign up directly to Firestore
      saveTaskSignup(selectedWeekId, task.id, volunteerName.trim());
    }
  };

  // Edit / Release action click
  const handleEditTaskClick = (task: CleaningTask, signedUpUser: string) => {
    setActiveTask(task);
    
    // Check match
    const isAuthorized = canChangeSignup(volunteerName, signedUpUser);
    
    if (isAuthorized) {
      setTempVolunteerName(signedUpUser);
      setModalType('edit');
    } else {
      const signedUpLastName = getLastName(signedUpUser) || signedUpUser;
      setWarningMessage(
        `You can only change this task if your name matches, or if you share the same last name of the person signed up ("${signedUpLastName}").`
      );
      setModalType('warning');
    }
  };

  // Save the custom claimed modal name
  const handleConfirmClaim = () => {
    if (!tempVolunteerName.trim()) return;
    setVolunteerName(tempVolunteerName.trim());
    
    if (activeTask) {
      saveTaskSignup(selectedWeekId, activeTask.id, tempVolunteerName.trim());
    }
    setModalType(null);
    setActiveTask(null);
  };

  // Modify / Release task
  const handleConfirmEdit = (action: 'update' | 'clear') => {
    if (!activeTask) return;
    
    const updatedName = action === 'update' ? tempVolunteerName.trim() : null;
    if (action === 'update' && !updatedName) return;
    
    saveTaskSignup(selectedWeekId, activeTask.id, updatedName);
    setModalType(null);
    setActiveTask(null);
  };

  // Validate selections and take to Summary Page
  const handleValidateSelection = () => {
    if (!currentWeekOption) return;
    
    // Find if the current user has any selection in the active week
    const currentWeekSignups = signupsByWeek[selectedWeekId] || {};
    
    // Find the task matching the current user name (exact or last name)
    let matchedTaskId = '';
    let matchedTaskName = '';
    let matchedTaskDesc = '';
    let matchedShift: 1 | 2 = 1;
    let matchedTimeStr = '';

    // Search for direct exact name first, then fallback to last name match
    const matchingTasks = CLEANING_TASKS.filter(task => {
      const signedName = currentWeekSignups[task.id];
      return signedName && signedName.trim().toLowerCase() === volunteerName.trim().toLowerCase();
    });

    const fallbackTasks = CLEANING_TASKS.filter(task => {
      const signedName = currentWeekSignups[task.id];
      return signedName && canChangeSignup(volunteerName, signedName);
    });

    const finalMatchedTasks = matchingTasks.length > 0 ? matchingTasks : fallbackTasks;

    if (finalMatchedTasks.length > 0) {
      const chosen = finalMatchedTasks[0];
      matchedTaskId = chosen.id;
      matchedTaskName = chosen.name;
      matchedTaskDesc = chosen.description;
      matchedShift = chosen.shift;
      matchedTimeStr = chosen.shiftLabel;
    } else {
      // If none selected, we can prompt or simply summarize the first active available task they signed up for, 
      // or if they didn't sign up, we give them a warning!
      setWarningMessage("Please sign up for at least one cleaning task before validating your selection.");
      setModalType('warning');
      return;
    }

    // Set the summary selection details
    setLatestSelection({
      volunteerName: volunteerName.trim() || currentWeekSignups[matchedTaskId] || 'Volunteer',
      taskId: matchedTaskId,
      taskName: matchedTaskName,
      taskDescription: matchedTaskDesc,
      dateStr: currentWeekOption.dateStr,
      timeStr: matchedTimeStr,
      isoDate: currentWeekOption.isoDate,
      shift: matchedShift
    });
    
    setCurrentPage('summary');
  };

  // Reset/Clear data to default for easy re-testing
  const handleResetData = async () => {
    if (confirm("Would you like to reset all tasks in the database to the default signups?")) {
      try {
        for (const m of activeMonths) {
          for (const sat of m.saturdays) {
            await deleteDoc(doc(db, 'signups', sat.id));
          }
        }
        alert("All task data has been reset to defaults.");
      } catch (e) {
        console.error("Failed to reset Firestore data:", e);
        handleFirestoreError(e, OperationType.DELETE, 'signups');
      }
    }
  };

  // Google Calendar integration
  const getGoogleCalendarUrl = (sel: SummarySelection) => {
    const title = encodeURIComponent(`CH6 Chapel Cleaning - ${sel.taskName}`);
    const details = encodeURIComponent(`Thank you for volunteering to help clean Chapel 6! Your assigned task is: ${sel.taskName} (${sel.taskDescription}).`);
    const location = encodeURIComponent("CH6 Chapel");
    
    // Dates format: YYYYMMDDTHHMMSS
    const startHour = sel.shift === 1 ? "083000" : "093000";
    const endHour = sel.shift === 1 ? "090000" : "100000";
    
    const dates = `${sel.isoDate}T${startHour}/${sel.isoDate}T${endHour}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  // ICS file download helper
  const handleDownloadIcs = (sel: SummarySelection) => {
    const startHour = sel.shift === 1 ? "083000" : "093000";
    const endHour = sel.shift === 1 ? "090000" : "100000";
    
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CH6 Chapel Cleaning//NONSGML v1.0//EN",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@ch6chapelcleaning.com`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART:${sel.isoDate}T${startHour}`,
      `DTEND:${sel.isoDate}T${endHour}`,
      `SUMMARY:CH6 Chapel Cleaning - ${sel.taskName}`,
      `DESCRIPTION:Thank you for volunteering! Your task: ${sel.taskName}. Description: ${sel.taskDescription}.`,
      "LOCATION:CH6 Chapel",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\n");
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ch6_cleaning_${sel.isoDate}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const currentWeekSignupsForCheck = signupsByWeek[selectedWeekId] || {};
  const hasSelectedTask = CLEANING_TASKS.some(task => {
    const signedName = currentWeekSignupsForCheck[task.id];
    return signedName && canChangeSignup(volunteerName, signedName);
  });

  return (
    <div className="min-h-screen bg-[#faf9f8] flex flex-col antialiased selection:bg-primary/10 selection:text-primary">
      
      {/* GLOBAL HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-outline-variant/10 shadow-sm backdrop-blur-md bg-white/95">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/15">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-display font-extrabold tracking-tight text-on-surface">
                CH6 Chapel Cleaning
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleResetData}
              title="Reset task data"
              className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {/* CORE CONTAINER */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 md:py-10 flex flex-col justify-start">
        
        <AnimatePresence mode="wait">
          
          {/* ==================== PAGE 1: HOME ==================== */}
          {currentPage === 'home' && (
            <motion.div
              key="home-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Welcome Message Card */}
              <div className="bg-gradient-to-r from-surface-container-low to-surface-container/10 p-5 rounded-2xl border border-outline-variant/10 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-[0.03] pointer-events-none">
                  <Sparkles className="w-48 h-48" />
                </div>
                <div className="relative space-y-2">
                  <h2 className="text-xl md:text-2xl font-display font-bold text-on-surface tracking-tight">
                    Thank you for keeping the Lord's house beautiful.
                  </h2>
                  <p className="text-xs md:text-sm text-on-surface-variant font-sans leading-relaxed max-w-2xl">
                    Please enter your name and select a week to serve below.
                  </p>
                </div>
              </div>

              {/* Request for Name Card */}
              <div className="bg-white p-5 rounded-2xl border border-outline-variant/10 shadow-level1 space-y-3">
                <div className="flex items-center gap-2.5">
                  <User className="w-5 h-5 text-primary" />
                  <label htmlFor="volunteer-name-input" className="font-display font-bold text-base text-on-surface flex items-center">
                    Request for Name:
                    <span className="text-red-500 ml-1" title="Required">*</span>
                  </label>
                </div>
                
                <div className="relative">
                  <input
                    id="volunteer-name-input"
                    type="text"
                    value={volunteerName}
                    onChange={(e) => setVolunteerName(e.target.value)}
                    placeholder="Enter your first and last name..."
                    className="w-full bg-[#fcfbfa] text-on-surface text-sm md:text-base border border-outline-variant rounded-xl px-4 py-3.5 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                  />
                  {volunteerName.trim() && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Selector Label & Month Cards */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold text-base md:text-lg text-on-surface">
                    Please select a week to serve.
                  </h3>
                  {!volunteerName.trim() && (
                    <span className="text-xs text-red-500 font-semibold animate-pulse ml-auto sm:ml-2">
                      (Please enter your name first)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {activeMonths.map((m) => {
                    const isNameEntered = !!volunteerName.trim();
                    return (
                      <motion.div
                        key={m.id}
                        whileHover={isNameEntered ? { y: -4, scale: 1.01 } : {}}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        onClick={() => {
                          if (!isNameEntered) return;
                          setSelectedMonthId(m.id);
                          setCurrentPage('task-selection');
                        }}
                        className={`p-4.5 rounded-2xl border transition-all flex flex-col gap-3.5 ${
                          isNameEntered
                            ? 'bg-white border-outline-variant/10 shadow-level1 hover:shadow-level2 cursor-pointer'
                            : 'bg-white/60 border-outline-variant/5 opacity-50 cursor-not-allowed select-none'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-display font-black text-xl text-on-surface">
                              {m.name} {m.year}
                            </span>
                            <ChevronRight className="w-5 h-5 text-outline" />
                          </div>
                        </div>

                        {/* Saturdays list preview */}
                        <div className="flex flex-wrap gap-1.5">
                          {m.saturdays.map(sat => (
                            <span key={sat.id} className="text-[10px] font-mono bg-surface-container-low text-on-surface px-2 py-0.5 rounded border border-outline-variant/10">
                              {sat.dateNum}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Contact & Support Info Card */}
              <div className="bg-white p-5 rounded-2xl border border-outline-variant/10 shadow-level1 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-primary/5 p-3 rounded-xl text-primary shrink-0">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs md:text-sm text-on-surface-variant font-medium leading-relaxed">
                    Can't find a time that works, perhaps Friday or later Saturday will work, or have a problem?
                  </p>
                  <p className="text-xs md:text-sm font-semibold text-on-surface flex flex-wrap items-center gap-1.5">
                    <span>Contact</span>
                    <span className="text-primary font-bold">Craig Davis</span>
                    <span className="text-outline/60">•</span>
                    <a href="tel:3853526349" className="text-primary hover:underline font-mono inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      385 352-6349
                    </a>
                  </p>
                </div>
              </div>

            </motion.div>
          )}

          {/* ==================== PAGE 2: TASK SELECTION ==================== */}
          {currentPage === 'task-selection' && (
            <motion.div
              key="task-selection-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Back Button and Week Selection Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-outline-variant/10">
                <button
                  onClick={() => setCurrentPage('home')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-container transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Month Selection</span>
                </button>
                
                <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-full text-xs text-primary font-semibold">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Serving as: <strong className="underline">{volunteerName || 'Anonymous'}</strong></span>
                </div>
              </div>

              {/* Saturday Selector Tabs inside month */}
              <div className="bg-white p-4 rounded-xl border border-outline-variant/10 shadow-level1 space-y-3">
                <h3 className="font-display font-bold text-sm text-on-surface flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>Select which Saturday to view:</span>
                </h3>

                <div className="flex flex-wrap gap-2">
                  {currentMonthOption?.saturdays.map((sat) => {
                    const isSelected = selectedWeekId === sat.id;
                    const weekSignups = signupsByWeek[sat.id] || {};
                    const filledCount = Object.values(weekSignups).filter(Boolean).length;

                    return (
                      <button
                        key={sat.id}
                        onClick={() => setSelectedWeekId(sat.id)}
                        className={`flex-1 min-w-[120px] px-3 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary border-primary text-white shadow-sm'
                            : 'bg-surface hover:bg-surface-container border-outline-variant/50 text-on-surface'
                        }`}
                      >
                        <span className="block text-xs font-bold">{sat.label}</span>
                        <span className={`block text-[10px] mt-0.5 font-mono ${isSelected ? 'text-white/80' : 'text-on-surface-variant'}`}>
                          {filledCount} of 12 taken
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 12 TASKS CONTAINER BY SHIFTS */}
              <div className="space-y-6">
                
                {/* SHIFT 1 */}
                <div className="space-y-3">
                  <div className="bg-[#645d53]/5 border-l-4 border-[#645d53] p-3 rounded-r-lg flex items-center justify-between">
                    <h4 className="font-display font-extrabold text-sm text-[#645d53] tracking-wider">
                      <span className="uppercase">Shift 1 - 8:30 am</span>{" "}
                      <span className="lowercase text-[10px] font-normal normal-case ml-1 text-on-surface-variant/80">
                        (each task should take abt 30 min)
                      </span>
                    </h4>
                    <span className="text-[10px] bg-[#645d53]/10 text-[#645d53] font-bold px-2 py-0.5 rounded-full">
                      7 Tasks
                    </span>
                  </div>

                  <div className="bg-white rounded-xl border border-outline-variant/10 shadow-level1 overflow-hidden">
                    {CLEANING_TASKS.filter(t => t.shift === 1).map((task, index) => {
                      const signedUpName = (signupsByWeek[selectedWeekId] || {})[task.id];
                      const isTaken = !!signedUpName;

                      return (
                        <React.Fragment key={task.id}>
                          {index > 0 && <div className="border-t border-dashed border-zinc-400 mx-4" />}
                          <div className="py-1.5 px-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-surface/30 transition-colors">
                            <div className="flex-1 space-y-1">
                              <h5 className="font-display font-bold text-sm text-on-surface">
                                {task.name}
                              </h5>
                              <p className="text-xs text-on-surface-variant font-sans leading-relaxed">
                                {task.description}
                              </p>
                            </div>

                            {/* Action Sign up state */}
                            <div className="flex items-center gap-3">
                              {isTaken ? (
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <span className="block text-[9px] uppercase tracking-wider text-outline font-bold">Assigned</span>
                                    <span className="block text-xs font-semibold text-on-surface flex items-center gap-1 bg-surface px-2.5 py-1 rounded-md border border-outline-variant/20">
                                      <User className="w-3 h-3 text-primary" />
                                      {signedUpName}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleEditTaskClick(task, signedUpName)}
                                    className="p-1.5 rounded-lg border border-outline-variant/50 hover:bg-surface-container text-on-surface-variant transition-colors cursor-pointer"
                                    title="Change signup"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleClaimTask(task)}
                                  className="inline-flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all cursor-pointer"
                                >
                                  <span>Available</span>
                                  <PlusIcon className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleValidateSelection}
                      disabled={!hasSelectedTask}
                      className={`font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
                        hasSelectedTask
                          ? 'bg-primary hover:bg-primary-container text-white shadow-primary/10 cursor-pointer'
                          : 'bg-surface-container text-on-surface-variant/40 border border-outline-variant/10 cursor-not-allowed shadow-none'
                      }`}
                    >
                      <CheckCircle2 className="w-4.5 h-4.5" />
                      <span>Submit Selection</span>
                    </button>
                  </div>
                </div>

                {/* HEAVIER SOLID LINE BETWEEN SHIFTS */}
                <div className="border-t-4 border-zinc-500 my-6 shadow-sm" />

                {/* SHIFT 2 */}
                <div className="space-y-3">
                  <div className="bg-[#2f6378]/5 border-l-4 border-primary p-3 rounded-r-lg flex items-center justify-between">
                    <h4 className="font-display font-extrabold text-sm text-primary tracking-wider">
                      <span className="uppercase">Shift 2 - 9:30 am</span>{" "}
                      <span className="lowercase text-[10px] font-normal normal-case ml-1 text-on-surface-variant/80">
                        (each task should take abt 30 min)
                      </span>
                    </h4>
                    <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                      5 Tasks
                    </span>
                  </div>

                  <div className="bg-white rounded-xl border border-outline-variant/10 shadow-level1 overflow-hidden">
                    {CLEANING_TASKS.filter(t => t.shift === 2).map((task, index) => {
                      const signedUpName = (signupsByWeek[selectedWeekId] || {})[task.id];
                      const isTaken = !!signedUpName;

                      return (
                        <React.Fragment key={task.id}>
                          {index > 0 && <div className="border-t border-dashed border-zinc-400 mx-4" />}
                          <div className="py-1.5 px-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-surface/30 transition-colors">
                            <div className="flex-1 space-y-1">
                              <h5 className="font-display font-bold text-sm text-on-surface">
                                {task.name}
                              </h5>
                              <p className="text-xs text-on-surface-variant font-sans leading-relaxed">
                                {task.description}
                              </p>
                            </div>

                            {/* Action Sign up state */}
                            <div className="flex items-center gap-3">
                              {isTaken ? (
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <span className="block text-[9px] uppercase tracking-wider text-outline font-bold">Assigned</span>
                                    <span className="block text-xs font-semibold text-on-surface flex items-center gap-1 bg-surface px-2.5 py-1 rounded-md border border-outline-variant/20">
                                      <User className="w-3 h-3 text-primary" />
                                      {signedUpName}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleEditTaskClick(task, signedUpName)}
                                    className="p-1.5 rounded-lg border border-outline-variant/50 hover:bg-surface-container text-on-surface-variant transition-colors cursor-pointer"
                                    title="Change signup"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleClaimTask(task)}
                                  className="inline-flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all cursor-pointer"
                                >
                                  <span>Available</span>
                                  <PlusIcon className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* FOOTER ACTIONS AND VALIDATE BUTTON */}
              <div className="bg-white p-5 rounded-2xl border border-outline-variant/10 shadow-level1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-outline">Selected Week:</span>
                  <span className="block text-sm font-semibold text-on-surface">{currentWeekOption?.dateStr}</span>
                </div>
                
                <button
                  onClick={handleValidateSelection}
                  disabled={!hasSelectedTask}
                  className={`font-bold text-sm px-8 py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
                    hasSelectedTask
                      ? 'bg-primary hover:bg-primary-container text-white shadow-primary/10 cursor-pointer'
                      : 'bg-surface-container text-on-surface-variant/40 border border-outline-variant/10 cursor-not-allowed shadow-none'
                  }`}
                >
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  <span>Submit Selection</span>
                </button>
              </div>

            </motion.div>
          )}

          {/* ==================== PAGE 3: SUMMARY ==================== */}
          {currentPage === 'summary' && latestSelection && (
            <motion.div
              key="summary-page"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="max-w-xl mx-auto space-y-6 text-center py-6"
            >
              <div className="bg-white p-8 rounded-2xl border border-outline-variant/10 shadow-level1 space-y-6">
                
                {/* Success Checkmark Circle */}
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-display font-extrabold tracking-tight text-on-surface">
                    CH6 Chapel Cleaning
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Thank you so much, <strong className="text-primary">{latestSelection.volunteerName}</strong>! Your service is essential in preserving the cleanliness of Chapel 6.
                  </p>
                </div>

                {/* Selected Task details */}
                <div className="bg-surface p-5 rounded-xl border border-outline-variant/10 text-left space-y-3">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-outline tracking-wider">Your Cleaning Duty:</span>
                    <span className="block text-base font-bold text-on-surface mt-0.5">{latestSelection.taskName}</span>
                    <span className="block text-xs text-on-surface-variant mt-0.5">{latestSelection.taskDescription}</span>
                  </div>
                  
                  <div className="pt-3 border-t border-outline-variant/5 grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-outline tracking-wider">Date:</span>
                      <span className="block text-xs font-semibold text-on-surface mt-0.5">{latestSelection.dateStr}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-outline tracking-wider">Time:</span>
                      <span className="block text-xs font-semibold text-on-surface mt-0.5">{latestSelection.timeStr}</span>
                    </div>
                  </div>
                </div>

                {/* Calendar additions */}
                <div className="space-y-2 pt-2">
                  <span className="block text-xs text-on-surface-variant font-medium">Add to calendar choice:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href={getGoogleCalendarUrl(latestSelection)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-white hover:bg-surface border border-outline-variant px-4 py-2.5 rounded-lg text-xs font-bold text-on-surface transition-colors"
                    >
                      <span>Google Calendar</span>
                    </a>
                    <button
                      onClick={() => handleDownloadIcs(latestSelection)}
                      className="inline-flex items-center justify-center gap-2 bg-white hover:bg-surface border border-outline-variant px-4 py-2.5 rounded-lg text-xs font-bold text-on-surface transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download iCal (.ics)</span>
                    </button>
                  </div>
                </div>

                {/* Exit actions */}
                <div className="pt-4 border-t border-outline-variant/10">
                  <button
                    onClick={() => {
                      setCurrentPage('home');
                      setLatestSelection(null);
                    }}
                    className="w-full bg-primary hover:bg-primary-container text-white font-bold text-sm py-3 rounded-lg transition-all shadow-sm shadow-primary/10 cursor-pointer"
                  >
                    Finish and exit
                  </button>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ==================== CUSTOM MODALS / DIALOGS ==================== */}
      <AnimatePresence>
        {modalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop: heavy blur (12px) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalType(null)}
              className="fixed inset-0 bg-black/25 backdrop-blur-[12px]"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="bg-white rounded-2xl shadow-level2 border border-outline-variant/15 p-6 max-w-md w-full relative z-10 space-y-4"
            >
              
              {/* modal content by type */}
              {modalType === 'claim' && activeTask && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-primary" />
                    <h3 className="font-display font-bold text-lg text-on-surface">Claim Cleaning Duty</h3>
                  </div>
                  
                  <div className="bg-surface p-3.5 rounded-xl border border-outline-variant/10">
                    <span className="block text-[10px] uppercase font-bold text-outline">{activeTask.shiftLabel}</span>
                    <strong className="block text-sm text-on-surface mt-0.5">{activeTask.name}</strong>
                    <span className="block text-xs text-on-surface-variant mt-0.5">{activeTask.description}</span>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="modal-name-claim" className="block text-xs font-bold text-on-surface-variant">
                      Please enter your name:
                    </label>
                    <input
                      id="modal-name-claim"
                      type="text"
                      placeholder="e.g. Craig Davis"
                      value={tempVolunteerName}
                      onChange={(e) => setTempVolunteerName(e.target.value)}
                      className="w-full bg-[#fcfbfa] border border-outline-variant rounded-xl px-4 py-3 outline-none text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setModalType(null)}
                      className="px-4 py-2 rounded-lg border border-outline-variant hover:bg-surface text-xs font-bold text-on-surface transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmClaim}
                      disabled={!tempVolunteerName.trim()}
                      className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Claim Duty
                    </button>
                  </div>
                </div>
              )}

              {modalType === 'edit' && activeTask && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-primary" />
                    <h3 className="font-display font-bold text-lg text-on-surface">Modify or Release Duty</h3>
                  </div>
                  
                  <p className="text-xs text-on-surface-variant">
                    You have authorized access to modify this task because your name or last name matches the sign-up.
                  </p>

                  <div className="bg-surface p-3.5 rounded-xl border border-outline-variant/10">
                    <span className="block text-[10px] uppercase font-bold text-outline">{activeTask.shiftLabel}</span>
                    <strong className="block text-sm text-on-surface mt-0.5">{activeTask.name}</strong>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="modal-name-edit" className="block text-xs font-bold text-on-surface-variant">
                      Volunteer Name:
                    </label>
                    <input
                      id="modal-name-edit"
                      type="text"
                      placeholder="Name"
                      value={tempVolunteerName}
                      onChange={(e) => setTempVolunteerName(e.target.value)}
                      className="w-full bg-[#fcfbfa] border border-outline-variant rounded-xl px-4 py-3 outline-none text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <button
                      onClick={() => handleConfirmEdit('clear')}
                      className="px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Release (Make Available)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModalType(null)}
                        className="px-3.5 py-2 rounded-lg border border-outline-variant hover:bg-surface text-xs font-bold text-on-surface transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleConfirmEdit('update')}
                        disabled={!tempVolunteerName.trim()}
                        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {modalType === 'warning' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 text-amber-600">
                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                    <h3 className="font-display font-extrabold text-lg text-on-surface">Access Verification</h3>
                  </div>
                  
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                      {warningMessage}
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setModalType(null)}
                      className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              )}

            </motion.div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Micro local helper icons for simple layout
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
