import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ArrowLeft, MessageSquare, ArrowRight, Settings2, FileText, FolderOpen, Terminal, CircleDot, Clock, ClipboardCopy, Upload, GripVertical } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTraceById } from '../services/api';
import type { ApiResponse, TraceData } from '../services/api';

interface TraceSpan {
  object: string;
  id: string;
  trace_id: string;
  parent_id: string | null;
  started_at: string;
  ended_at: string;
  span_data: {
    type: string;
    name?: string;
    input?: any[];
    output?: any[];
    from_agent?: string;
    to_agent?: string;
    tools?: string[];
    handoffs?: string[];
  };
  error: null | any;
}

type SectionName = 'properties' | 'configuration' | 'instructions' | 'functionCall' | 'agents' | 'output' | 'previousStep' | 'history';

interface HistoryItem {
  span: TraceSpan;
  seenAgents: Set<string>;
}

// Replace the existing getAncestorSpans function with this new implementation
const getAncestorSpans = (span: TraceSpan | null, allSpans: TraceSpan[]): TraceSpan[] => {
  if (!span) return [];
  
  // Helper function to get all spans up to a given span ID
  const getAllSpansUpTo = (targetId: string, spans: TraceSpan[]): TraceSpan[] => {
    const result: TraceSpan[] = [];
    
    for (const currentSpan of spans) {
      if (currentSpan.id === targetId) {
        return result;
      }
      
      result.push(currentSpan);
      
      // If this span has children, recursively process them
      const children = (currentSpan as any).children;
      if (children && children.length > 0) {
        const childResults = getAllSpansUpTo(targetId, children);
        if (childResults.length < children.length) {
          // If we found our target in the children, return all results
          return [...result, ...childResults];
        }
        // Otherwise, add all children and continue searching
        result.push(...children);
      }
    }
    
    return result;
  };
  
  return getAllSpansUpTo(span.id, allSpans);
};

function TrajViewer() {
  const { traceId } = useParams();
  const navigate = useNavigate();
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);
  const [previousSpans, setPreviousSpans] = useState<HistoryItem[]>([]);
  const [seenAgents, setSeenAgents] = useState<Set<string>>(new Set());
  const [traceData, setTraceData] = useState<TraceSpan[]>([]);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPosition, setSplitPosition] = useState(70); // percentage of total width
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef<number>(0);
  const [isPolling, setIsPolling] = useState(true); // Add state for controlling polling
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<SectionName, boolean>>({
    properties: true,
    configuration: true,
    instructions: true,
    functionCall: true,
    agents: true,
    output: true,
    previousStep: true,
    history: true
  });

  useEffect(() => {
    if (traceId) {
      loadTraceFile(traceId);

      const pollInterval = setInterval(() => {
        if (isPolling) {
          loadTraceFile(traceId, true);
        }
      }, 1000);

      return () => {
        clearInterval(pollInterval);
      };
    }
  }, [traceId, navigate, isPolling]);

  const loadTraceFile = async (traceId: string, isPollingUpdate: boolean = false) => {
    try {
      const response: ApiResponse<TraceData> = await fetchTraceById(traceId);
      
      if (response.success && response.data.spans && response.data.spans.length > 0) {
        console.log('Trace completion status:', {
          traceId: response.data.trace_id,
          isComplete: response.data.isComplete,
          timestamp: new Date().toISOString()
        });

        if (response.data.isComplete) {
          console.log('Stopping polling - trace is complete');
          setIsPolling(false);
        }
        
        if (isPollingUpdate) {
          const currentExpandedState = new Set(expandedSpans);
          processTraceData(response.data.spans as TraceSpan[], currentExpandedState);
        } else {
          processTraceData(response.data.spans as TraceSpan[]);
        }
        setError(null);
      } else {
        console.error('Error loading trace data: Invalid response format');
        setError('Invalid trace data format received');
      }
    } catch (error) {
      console.error('Error loading trace data:', error);
      setError('Failed to load trace. Please check your authentication.');
      if (isPollingUpdate) {
        setIsPolling(false);
      }
    }
  };

  const processTraceData = (spans: TraceSpan[], preserveExpandedState?: Set<string>) => {
    // Build span hierarchy
    const spanMap = new Map<string, TraceSpan & { children: TraceSpan[] }>();
    
    // Initialize all spans with empty children array
    spans.forEach(span => {
      spanMap.set(span.id, { ...span, children: [] });
    });
    
    // Build the hierarchy by connecting parents and children
    const rootSpans: TraceSpan[] = [];
    spans.forEach(span => {
      const spanWithChildren = spanMap.get(span.id)!;
      if (!span.parent_id) {
        rootSpans.push(spanWithChildren);
      } else {
        const parent = spanMap.get(span.parent_id);
        if (parent) {
          parent.children.push(spanWithChildren);
        }
      }
    });

    setTraceData(rootSpans);
    
    // Set expanded state based on whether we want to preserve current state or not
    if (preserveExpandedState) {
      setExpandedSpans(prev => {
        const newExpanded = new Set(prev);
        // Add any new spans that don't exist in current state
        spans.forEach(span => {
          if (prev.has(span.id)) {
            newExpanded.add(span.id);
          }
        });
        return newExpanded;
      });
    } else {
      // Initially expand all spans
      const initialExpanded = new Set(spans.map(span => span.id));
      setExpandedSpans(initialExpanded);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data: ApiResponse<TraceData> = JSON.parse(text);
      if (data.success && data.data.spans && data.data.spans.length > 0) {
        processTraceData(data.data.spans as TraceSpan[]);
      }
    } catch (error) {
      console.error('Error loading trace data:', error);
    }
  };

  const formatDuration = (duration: number) => {
    if (duration === 0) {
      return '0 ms';
    }
    if (duration >= 1000) {
      const seconds = duration / 1000;
      return `${seconds.toFixed(2)} s`;
    }
    return `${Math.round(duration)} ms`;
  };

  const toggleSpan = (spanId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSpans(prev => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  };

  const toggleSection = (section: SectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  interface SpanRowProps {
    span: TraceSpan;
    depth?: number;
    maxDuration: number;
    index: number;
  }

  const getSpanIcon = (span: TraceSpan) => {
    const iconClasses = "h-4 w-4 flex-shrink-0";
    
    // Agent spans should use CircleDot
    if (span.span_data.type === 'agent') {
      return <CircleDot className={`${iconClasses} text-blue-400`} />;
    }

    // Handoff spans use ArrowRight
    if (span.span_data.type === 'handoff') {
      return <ArrowRight className={`${iconClasses} text-orange-500`} />;
    }

    // Function calls use Terminal
    if (span.span_data.type === 'function') {
      return <Terminal className={`${iconClasses} text-emerald-400`} />;
    }

    // File operations
    if (span.span_data.name === 'read_file') {
      return <FileText className={`${iconClasses} text-emerald-400`} />;
    }
    if (span.span_data.name === 'list_files') {
      return <FolderOpen className={`${iconClasses} text-emerald-400`} />;
    }

    // POST requests and generations
    if (span.span_data.name?.startsWith('POST') || span.span_data.type === 'generation') {
      return <MessageSquare className={`${iconClasses} text-blue-400`} />;
    }

    // Default to CircleDot for unknown types
    return <CircleDot className={`${iconClasses} text-gray-400`} />;
  };

  const getProgressBarColor = (span: TraceSpan) => {
    if (span.span_data.type === 'agent' || span.span_data.name?.startsWith('POST')) {
      return 'bg-blue-500';
    }
    if (span.span_data.name === 'read_file' || span.span_data.name === 'list_files') {
      return 'bg-emerald-500';
    }
    return 'bg-gray-500';
  };

  const renderName = (span: TraceSpan) => {
    if (span.span_data.type === 'handoff') {
      return (
        <div className="flex items-center space-x-1.5 min-w-0">
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-orange-500" />
          <span className="text-gray-400 flex-shrink-0">Handoff</span>
          <ArrowRight className="h-3 w-3 flex-shrink-0 text-gray-500" />
          <span className="text-gray-200 truncate">{span.span_data.to_agent}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2 min-w-0">
        <div className="flex-shrink-0">{getSpanIcon(span)}</div>
        <span className="text-gray-200 truncate">
          {span.span_data.name || span.span_data.type}
        </span>
      </div>
    );
  };

  const SpanRow: React.FC<SpanRowProps> = ({ span, depth = 0, maxDuration, index }) => {
    const duration = new Date(span.ended_at).getTime() - new Date(span.started_at).getTime();
    const startTime = new Date(span.started_at).getTime();
    const endTime = new Date(span.ended_at).getTime();
    
    const startPercentage = ((startTime - new Date(traceData[0].started_at).getTime()) / maxDuration) * 100;
    const widthPercentage = (duration / maxDuration) * 100;
    
    const isExpanded = expandedSpans.has(span.id);
    
    return (
      <>
        <div 
          className={`group ${
            selectedSpan?.id === span.id ? 'bg-[#2A2A2A]' : 
            'bg-[#1C1C1C] hover:bg-[#232323]'
          } transition-colors relative clickable responsive-padding-sm`}
          onClick={(e) => {
            e.stopPropagation();
            handleSpanSelect(span);
          }}
        >
          <div className="flex items-center h-10 px-6 min-w-0 relative responsive-stack-sm">
            <div className="flex items-center flex-shrink-0 min-w-0 responsive-width-sm">
              <div className="flex items-center min-w-0 w-full responsive-stack-xs">
                {/* Indentation and hierarchy - adjusted for mobile */}
                <div className="flex items-center gap-2 responsive-margin-sm">
                  {depth > 0 && (
                    <div 
                      style={{ width: `${depth * 16}px` }}
                      className="responsive-hidden"
                    />
                  )}
                  {(span as any).children?.length > 0 && (
                    <button 
                      className="p-1.5 rounded hover:bg-[#2A2A2A] flex-shrink-0 relative z-10 clickable"
                      onClick={(e) => toggleSpan(span.id, e)}
                    >
                      <ChevronDown 
                        className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                      />
                    </button>
                  )}
                  <div className="responsive-span-name">
                    {renderName(span)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Duration and progress - adjusted for mobile */}
            <div className="flex items-center justify-end space-x-4 min-w-0 flex-1 responsive-stack-sm">
              <div className="text-right text-sm text-gray-400 font-mono responsive-text-sm">
                {formatDuration(duration)}
              </div>
              <div className="relative min-w-0 flex-shrink-0 responsive-progress-sm">
                <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${getProgressBarColor(span)}`}
                    style={{ 
                      width: `${Math.min(widthPercentage, 100)}%`,
                      marginLeft: `${Math.min(startPercentage, 100)}%`,
                      opacity: 0.8
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Render children with responsive adjustments */}
        {isExpanded && (span as any).children?.map((child: TraceSpan, childIndex: number) => (
          <div key={child.id} className="responsive-margin-sm">
            <SpanRow 
              span={child} 
              depth={depth + 1}
              maxDuration={maxDuration}
              index={childIndex + index + 1}
            />
          </div>
        ))}
      </>
    );
  };

  // Calculate max duration for timeline scaling
  const getMaxDuration = (spans: TraceSpan[]) => {
    if (!spans.length) return 0;
    const firstStart = new Date(spans[0].started_at).getTime();
    let lastEnd = new Date(spans[0].ended_at).getTime();
    
    spans.forEach(span => {
      const endTime = new Date(span.ended_at).getTime();
      if (endTime > lastEnd) {
        lastEnd = endTime;
      }
    });
    
    return lastEnd - firstStart;
  };

  // Update the handleSpanSelect function
  const handleSpanSelect = (span: TraceSpan) => {
    setSelectedSpan(span);
    if (span.span_data.type === 'agent') {
      setSeenAgents(prev => new Set([...prev, span.span_data.name || span.span_data.type]));
    }
  };

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
  }, []);

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const delta = e.clientX - dragStartXRef.current;
    const newPosition = Math.min(Math.max(30, splitPosition + (delta / containerWidth) * 100), 85);
    
    setSplitPosition(newPosition);
    dragStartXRef.current = e.clientX;
  }, [isDragging, splitPosition]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDrag, handleDragEnd]);

  return (
    <div className="min-h-screen bg-[#1C1C1C] flex flex-col">
      <style>
        {`
          /* Base styles */
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #2A2A2A;
            border-radius: 5px;
            border: 2px solid #1C1C1C;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #3A3A3A;
          }
          
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #2A2A2A transparent;
          }

          .resize-handle {
            cursor: col-resize;
            transition: background-color 0.2s;
          }

          .resize-handle:hover,
          .resize-handle.dragging {
            background-color: #3A3A3A;
          }

          .user-select-none {
            user-select: none;
          }

          .clickable {
            cursor: pointer;
          }

          .clickable:hover {
            opacity: 0.8;
          }

          /* Tablet and smaller desktop screens */
          @media (max-width: 1024px) {
            .responsive-layout {
              max-width: 100% !important;
              padding: 0 1rem;
            }

            .responsive-width {
              min-width: 0 !important;
            }

            .responsive-text-md {
              font-size: 0.9rem !important;
            }

            .responsive-spacing-md {
              gap: 0.75rem !important;
            }
          }

          /* Mobile landscape and tablet portrait */
          @media (max-width: 768px) {
            .responsive-layout {
              flex-direction: column !important;
              padding: 0 !important;
            }

            .responsive-width {
              width: 100% !important;
            }

            .responsive-hidden {
              display: none !important;
            }

            .responsive-padding {
              padding: 1rem !important;
            }

            .responsive-text {
              font-size: 0.875rem !important;
            }

            .responsive-flex {
              flex-direction: column !important;
              gap: 0.5rem !important;
            }

            .responsive-width-full {
              width: 100% !important;
              max-width: none !important;
            }

            .responsive-grid {
              display: grid !important;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important;
              gap: 0.5rem !important;
            }

            .responsive-span-name {
              max-width: 200px !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
          }

          /* Mobile portrait */
          @media (max-width: 480px) {
            .responsive-padding-sm {
              padding: 0.5rem !important;
            }

            .responsive-text-sm {
              font-size: 0.75rem !important;
            }

            .responsive-stack-sm {
              flex-direction: column !important;
              align-items: stretch !important;
            }

            .responsive-width-sm {
              width: 100% !important;
              min-width: 0 !important;
            }

            .responsive-margin-sm {
              margin: 0.25rem 0 !important;
            }

            .responsive-hide-sm {
              display: none !important;
            }

            .responsive-progress-sm {
              width: 100px !important;
            }
          }

          /* Extra small devices */
          @media (max-width: 360px) {
            .responsive-text-xs {
              font-size: 0.7rem !important;
            }

            .responsive-padding-xs {
              padding: 0.25rem !important;
            }

            .responsive-stack-xs {
              flex-direction: column !important;
              gap: 0.25rem !important;
            }
          }

          /* Dark mode optimization */
          @media (prefers-color-scheme: dark) {
            .dark-mode-optimize {
              background: #1C1C1C !important;
              color: #E5E5E5 !important;
            }
          }
        `}
      </style>
      <header className="bg-[#1C1C1C] border-b border-[#2A2A2A] sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex h-14 px-4 items-center justify-between responsive-padding responsive-padding-sm">
            <div className="flex items-center space-x-2 responsive-stack-sm">
              <button 
                className="text-gray-400 hover:text-gray-300 p-1 rounded hover:bg-gray-800 clickable"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h1 className="text-[15px] font-medium text-gray-200 responsive-text responsive-text-sm">Traces</h1>
              <span className="text-gray-600 responsive-hidden">/</span>
              <span className="text-[15px] text-gray-400 responsive-text responsive-text-sm responsive-hidden">
                {traceId || 'No Trace Selected'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".traj"
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-gray-400 hover:text-gray-300 px-3 py-1.5 rounded hover:bg-gray-800 clickable responsive-padding-sm"
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm responsive-hidden">Upload File</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative">
        <div ref={containerRef} className="max-w-[1600px] mx-auto h-[calc(100vh-3.5rem)] flex responsive-layout">
          {/* Left side content */}
          <div 
            className={`overflow-y-auto custom-scrollbar ${isDragging ? 'user-select-none' : ''} responsive-width responsive-width-sm`}
            style={{ width: `${splitPosition}%` }}
          >
            <div className="divide-y divide-[#2A2A2A]">
              {traceData.map((span, index) => (
                <div key={span.id} className="responsive-margin-sm">
                  <SpanRow 
                    span={span}
                    maxDuration={getMaxDuration(traceData)}
                    index={index}
                    depth={0}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Resize handle - hidden on mobile */}
          <div
            className={`resize-handle flex items-center justify-center w-1 hover:w-1.5 ${isDragging ? 'dragging w-1.5' : ''} responsive-hidden`}
            onMouseDown={handleDragStart}
          >
            <div className="h-8 flex items-center justify-center">
              <GripVertical className="h-4 w-4 text-gray-600" />
            </div>
          </div>

          {/* Right side content */}
          <div 
            className={`overflow-y-auto custom-scrollbar border-l border-[#2A2A2A] bg-[#1C1C1C] ${isDragging ? 'user-select-none' : ''} responsive-width responsive-width-sm`}
            style={{ width: `${100 - splitPosition}%` }}
          >
            <div className="p-6 responsive-padding responsive-padding-sm">
              {selectedSpan ? (
                <div className="space-y-6 responsive-spacing-md">
                  {/* Title Section */}
                  <div className="flex items-center space-x-3">
                    {getSpanIcon(selectedSpan)}
                    <h2 className="text-[15px] font-semibold text-gray-50 responsive-text responsive-text-sm">
                      {selectedSpan.span_data.type === 'handoff' 
                        ? `Handoff → ${selectedSpan.span_data.to_agent}`
                        : selectedSpan.span_data.name || selectedSpan.span_data.type}
                    </h2>
                  </div>

                  {/* Quick Stats Buttons */}
                  <div className="flex items-center flex-wrap gap-2 responsive-flex">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-1.5 flex items-center gap-2 responsive-width-full clickable">
                      <div className="text-blue-400">
                        {selectedSpan.span_data.type === 'handoff' 
                          ? <ArrowRight className="h-4 w-4" />
                          : selectedSpan.span_data.type === 'function'
                            ? <Terminal className="h-4 w-4" />
                            : <MessageSquare className="h-4 w-4" />
                        }
                      </div>
                      <span className="text-sm text-blue-400 font-medium">
                        {selectedSpan.span_data.type === 'handoff' 
                          ? 'Handoff'
                          : selectedSpan.span_data.type === 'function'
                            ? 'Function'
                            : 'Response'}
                      </span>
                    </div>
                    
                    <div className="flex items-center border border-[#2A2A2A] rounded-md px-3 py-1.5 gap-2 responsive-width-full">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-300">
                        {formatDuration(new Date(selectedSpan.ended_at).getTime() - new Date(selectedSpan.started_at).getTime())}
                      </span>
                    </div>
                    
                    {selectedSpan.span_data.input?.[0]?.tokens && (
                      <div className="flex items-center border border-[#2A2A2A] rounded-md px-3 py-1.5">
                        <span className="text-sm text-gray-300">
                          {selectedSpan.span_data.input[0].tokens}t
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center border border-[#2A2A2A] rounded-md px-3 py-1.5">
                      <span className="text-sm font-mono text-gray-400">
                        {selectedSpan.id.replace('span_', '').slice(0, 8)}...
                      </span>
                    </div>
                  </div>

                  {/* Properties Section - Moved above History */}
                  <div className="border-t border-[#2A2A2A]">
                    <div 
                      className="flex items-center justify-between py-3 clickable"
                      onClick={() => toggleSection('properties')}
                    >
                      <h3 className="text-[13px] font-semibold text-gray-50 responsive-text responsive-text-sm">Properties</h3>
                      <button className="text-gray-500 hover:text-gray-400 clickable">
                        <ChevronDown 
                          className={`h-4 w-4 transition-transform ${expandedSections.properties ? '' : '-rotate-90'}`} 
                        />
                      </button>
                    </div>
                    {expandedSections.properties && (
                      <div className="space-y-3 pt-1 pl-4 border-l border-[#2A2A2A] ml-2">
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-sm text-gray-400 flex-shrink-0">Created</span>
                          <span className="text-sm text-gray-200 text-right">
                            {new Date(selectedSpan.started_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-sm text-gray-400 flex-shrink-0">ID</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono text-gray-200 text-right break-all">
                              {selectedSpan.id.replace('span_', '')}
                            </span>
                            <button className="text-gray-500 hover:text-gray-400">
                              <ClipboardCopy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {selectedSpan.span_data.input?.[0]?.model && (
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-sm text-gray-400 flex-shrink-0">Model</span>
                            <span className="text-sm text-gray-200 text-right">
                              {selectedSpan.span_data.input[0].model}
                            </span>
                          </div>
                        )}
                        {selectedSpan.span_data.input?.[0]?.tokens && (
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-sm text-gray-400 flex-shrink-0">Tokens</span>
                            <span className="text-sm text-gray-200 text-right">
                              {selectedSpan.span_data.input[0].tokens} total
                            </span>
                          </div>
                        )}
                        {selectedSpan.span_data.tools && selectedSpan.span_data.tools.length > 0 && (
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-sm text-gray-400 flex-shrink-0">Functions</span>
                            <div className="text-right">
                              {selectedSpan.span_data.tools.map(tool => (
                                <div key={tool} className="text-sm font-mono text-gray-200">{tool}()</div>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedSpan.span_data.type === 'handoff' && (
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-sm text-gray-400 flex-shrink-0">Agents</span>
                            <div className="text-right">
                              <div className="text-sm text-gray-200">{selectedSpan.span_data.to_agent}</div>
                            </div>
                          </div>
                        )}
                        {selectedSpan.span_data.type === 'agent' && (
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-sm text-gray-400 flex-shrink-0">Agent</span>
                            <div className="text-right">
                              <div className="text-sm text-gray-200">{selectedSpan.span_data.name}</div>
                            </div>
                          </div>
                        )}
                        {selectedSpan.span_data.type === 'function' && (
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-sm text-gray-400 flex-shrink-0">Function</span>
                            <div className="text-right">
                              <div className="text-sm text-gray-200">{selectedSpan.span_data.name}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* History Section */}
                  {selectedSpan && getAncestorSpans(selectedSpan, traceData).length > 0 && (
                    <div className="border-t border-[#2A2A2A]">
                      <div 
                        className="flex items-center justify-between py-3 clickable"
                        onClick={() => toggleSection('history')}
                      >
                        <h3 className="text-[13px] font-semibold text-gray-50 responsive-text responsive-text-sm">History</h3>
                        <button className="text-gray-500 hover:text-gray-400 clickable">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${expandedSections.history ? '' : '-rotate-90'}`} 
                          />
                        </button>
                      </div>
                      {expandedSections.history && (
                        <div className="space-y-6 pt-1 pl-4 border-l border-[#2A2A2A] ml-2">
                          {getAncestorSpans(selectedSpan, traceData).map((span, index, spans) => {
                            // Track seen agents to show system content only on first appearance
                            const seenAgentsInHistory = new Set<string>();
                            spans.slice(0, index).forEach(s => {
                              if (s.span_data.type === 'agent') {
                                seenAgentsInHistory.add(s.span_data.name || s.span_data.type);
                              }
                            });

                            // Show system content only for first appearance of an agent after handoff
                            const isNewAgent = span.span_data.type === 'agent' && 
                              !seenAgentsInHistory.has(span.span_data.name || span.span_data.type) &&
                              spans[index - 1]?.span_data.type === 'handoff';

                            return (
                              <div key={index} className="space-y-3 border-b border-[#2A2A2A] pb-4 last:border-0">
                                {/* Span Header */}
                                <div className="flex items-center space-x-2">
                                  {getSpanIcon(span)}
                                  <span className="text-sm text-gray-200">
                                    {span.span_data.name || span.span_data.type}
                                  </span>
                                </div>

                                {/* System Instructions - Only show for first appearance of an agent after handoff */}
                                {isNewAgent && span.span_data.input?.[0]?.content && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm text-gray-400">System Instructions</h4>
                                    <div className="text-sm text-gray-200 whitespace-pre-wrap break-words bg-[#232323] rounded-md p-3">
                                      {span.span_data.input[0].content}
                                    </div>
                                  </div>
                                )}

                                {/* Input - Show for all spans except agent spans unless it's their first appearance */}
                                {span.span_data.input && (!span.span_data.type.includes('agent') || isNewAgent) && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm text-gray-400">Input</h4>
                                    <pre className="text-sm text-gray-200 bg-[#232323] p-3 rounded-md font-mono whitespace-pre-wrap break-all">
                                      {JSON.stringify(span.span_data.input, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {/* Output */}
                                {span.span_data.output && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm text-gray-400">Output</h4>
                                    <pre className="text-sm text-gray-200 bg-[#232323] p-3 rounded-md font-mono whitespace-pre-wrap break-all">
                                      {JSON.stringify(span.span_data.output, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {/* Function Call Details */}
                                {span.span_data.type === 'function' && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm text-gray-400">Function Call</h4>
                                    <div className="text-sm text-gray-200 bg-[#232323] p-3 rounded-md font-mono">
                                      {span.span_data.name}({JSON.stringify(span.span_data.input, null, 2)})
                                    </div>
                                  </div>
                                )}

                                {/* Handoff Details */}
                                {span.span_data.type === 'handoff' && (
                                  <div className="flex items-center gap-2">
                                    <ArrowRight className="h-4 w-4 text-orange-500" />
                                    <span className="text-sm text-gray-200">
                                      Handoff to {span.span_data.to_agent}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Configuration Section */}
                  {(selectedSpan.span_data.input?.[0]?.temperature || 
                    selectedSpan.span_data.input?.[0]?.response_format) && (
                    <div className="border-t border-[#2A2A2A]">
                      <div 
                        className="flex items-center justify-between py-3 clickable"
                        onClick={() => toggleSection('configuration')}
                      >
                        <h3 className="text-[13px] font-semibold text-gray-50 responsive-text responsive-text-sm">Configuration</h3>
                        <button className="text-gray-500 hover:text-gray-400 clickable">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${expandedSections.configuration ? '' : '-rotate-90'}`} 
                          />
                        </button>
                      </div>
                      {expandedSections.configuration && (
                        <div className="space-y-3 pt-1 pl-4 border-l border-[#2A2A2A] ml-2">
                          {selectedSpan.span_data.input?.[0]?.temperature && (
                            <div className="flex justify-between items-start gap-4">
                              <span className="text-sm text-gray-400 flex-shrink-0">Temperature</span>
                              <span className="text-sm text-gray-200 text-right">
                                {selectedSpan.span_data.input[0].temperature}
                              </span>
                            </div>
                          )}
                          {selectedSpan.span_data.input?.[0]?.response_format && (
                            <div className="flex justify-between items-start gap-4">
                              <span className="text-sm text-gray-400 flex-shrink-0">Response</span>
                              <span className="text-sm text-gray-200 text-right">
                                {selectedSpan.span_data.input[0].response_format}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Instructions Section */}
                  {selectedSpan.span_data.input?.[0]?.content && (
                    <div className="border-t border-[#2A2A2A]">
                      <div 
                        className="flex items-center justify-between py-3 clickable"
                        onClick={() => toggleSection('instructions')}
                      >
                        <h3 className="text-[13px] font-semibold text-gray-50 responsive-text responsive-text-sm">Instructions</h3>
                        <button className="text-gray-500 hover:text-gray-400 clickable">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${expandedSections.instructions ? '' : '-rotate-90'}`} 
                          />
                        </button>
                      </div>
                      {expandedSections.instructions && (
                        <div className="space-y-3 pt-1 pl-4 border-l border-[#2A2A2A] ml-2">
                          <h4 className="text-sm text-gray-400">System Instructions</h4>
                          <div className="text-sm text-gray-200 whitespace-pre-wrap break-words bg-[#232323] rounded-md p-3">
                            {selectedSpan.span_data.input[0].content}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Agents Section for Handoffs */}
                  {selectedSpan.span_data.type === 'handoff' && (
                    <div className="border-t border-[#2A2A2A]">
                      <div 
                        className="flex items-center justify-between py-3 clickable"
                        onClick={() => toggleSection('agents')}
                      >
                        <h3 className="text-[13px] font-semibold text-gray-50 responsive-text responsive-text-sm">Agents</h3>
                        <button className="text-gray-500 hover:text-gray-400 clickable">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${expandedSections.agents ? '' : '-rotate-90'}`} 
                          />
                        </button>
                      </div>
                      {expandedSections.agents && (
                        <div className="pt-2 pl-4 border-l border-[#2A2A2A] ml-2">
                          <div className="flex items-center gap-2 mb-2">
                            <CircleDot className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-200">{selectedSpan.span_data.to_agent}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Function Calls Section */}
                  {selectedSpan.span_data.type === 'function' && (
                    <div className="border-t border-[#2A2A2A]">
                      <div 
                        className="flex items-center justify-between py-3 clickable"
                        onClick={() => toggleSection('functionCall')}
                      >
                        <h3 className="text-[13px] font-semibold text-gray-50 responsive-text responsive-text-sm">Function Call</h3>
                        <button className="text-gray-500 hover:text-gray-400 clickable">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${expandedSections.functionCall ? '' : '-rotate-90'}`} 
                          />
                        </button>
                      </div>
                      {expandedSections.functionCall && (
                        <div className="space-y-3 pt-1 pl-4 border-l border-[#2A2A2A] ml-2">
                          <h4 className="text-sm text-gray-400">Arguments</h4>
                          <pre className="text-sm text-gray-200 bg-[#232323] p-3 rounded-md font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(selectedSpan.span_data.input, null, 2)}
                          </pre>
                          <h4 className="text-sm text-gray-400">Output</h4>
                          {selectedSpan.span_data.output ? (
                            <pre className="text-sm text-gray-200 bg-[#232323] p-3 rounded-md font-mono whitespace-pre-wrap break-all">
                              {JSON.stringify(selectedSpan.span_data.output, null, 2)}
                            </pre>
                          ) : (
                            <div className="text-sm text-gray-500">No output</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Output Section */}
                  {selectedSpan.span_data.output && selectedSpan.span_data.type !== 'function' && (
                    <div className="border-t border-[#2A2A2A]">
                      <div 
                        className="flex items-center justify-between py-3 clickable"
                        onClick={() => toggleSection('output')}
                      >
                        <h3 className="text-[13px] font-semibold text-gray-50 responsive-text responsive-text-sm">Output</h3>
                        <button className="text-gray-500 hover:text-gray-400 clickable">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${expandedSections.output ? '' : '-rotate-90'}`} 
                          />
                        </button>
                      </div>
                      {expandedSections.output && (
                        <div className="pt-2 pl-4 border-l border-[#2A2A2A] ml-2">
                          <pre className="text-sm text-gray-200 bg-[#232323] p-3 rounded-md font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(selectedSpan.span_data.output, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 responsive-text responsive-text-sm">Select a span to view details</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default TrajViewer;