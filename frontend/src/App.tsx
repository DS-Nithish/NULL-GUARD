import { useState, useEffect, useRef } from "react";
import {
  Shield,
  Paperclip,
  ArrowUp,
  X,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertOctagon,
  LayoutDashboard,
  MessageSquare,
  Wrench,
  Lock,
} from "lucide-react";

interface PublicDocument {
  id: string;
  name: string;
  description: string;
  size?: string;
}

interface ToolRequest {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  source_type: "USER" | "PDF";
  trust_level: "TRUSTED" | "UNTRUSTED";
  tainted: boolean;
  risk_level: "LOW" | "HIGH";
  decision: "ALLOW" | "CONFIRM" | "BLOCK";
  reason: string;
  status: "pending" | "resolved" | "blocked" | "denied";
  execution_result: Record<string, unknown> | null;
  created_at: string;
}

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  tool_request_id?: string | null;
  tool_request?: ToolRequest | null;
  created_at: string;
}

interface DashboardStats {
  total: number;
  allowed: number;
  confirmed: number;
  blocked: number;
}

interface SecurityEvent {
  id: string;
  timestamp: string;
  tool: string;
  decision: "ALLOW" | "CONFIRM" | "BLOCK";
  source: "USER" | "PDF";
  risk: "LOW" | "HIGH";
  tainted: boolean;
  reason: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentRequests: ToolRequest[];
  recentEvents: SecurityEvent[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "dashboard">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<PublicDocument | null>(null);
  const [showDocPicker, setShowDocPicker] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, activeTab]);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const [docsRes, msgsRes, dashRes] = await Promise.all([
          fetch("/api/documents"),
          fetch("/api/chat/messages"),
          fetch("/api/dashboard"),
        ]);
        if (docsRes.ok) setDocuments(await docsRes.json());
        if (msgsRes.ok) {
          const data = await msgsRes.json();
          setMessages(data.messages || []);
        }
        if (dashRes.ok) setDashboardData(await dashRes.json());
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    init();
  }, []);

  // Poll dashboard data and chat messages every 1.5s
  useEffect(() => {
    let isMounted = true;
    async function poll() {
      try {
        const dashRes = await fetch("/api/dashboard");
        if (dashRes.ok && isMounted) {
          setDashboardData(await dashRes.json());
        }
      } catch (err) {
        console.error("Dashboard poll error:", err);
      }
    }

    const interval = setInterval(poll, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Reset demo session
  async function handleResetSession() {
    setIsLoading(true);
    setSelectedDoc(null);
    setInputText("");
    try {
      const res = await fetch("/api/chat/reset", { method: "POST" });
      if (res.ok) {
        setMessages([]);
        const dashRes = await fetch("/api/dashboard");
        if (dashRes.ok) setDashboardData(await dashRes.json());
      }
    } catch (err) {
      console.error("Failed to reset session:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Send chat message
  async function handleSendMessage(overrideText?: string, overrideDocId?: string) {
    const textToSend = overrideText !== undefined ? overrideText : inputText.trim();
    const docIdToSend = overrideDocId !== undefined ? overrideDocId : selectedDoc?.id;

    if (!textToSend && !docIdToSend) return;
    if (isLoading) return;

    setIsLoading(true);
    setInputText("");
    setSelectedDoc(null);
    setShowDocPicker(false);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          documentId: docIdToSend,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setIsLoading(false);
      // Refresh dashboard after message
      try {
        const dashRes = await fetch("/api/dashboard");
        if (dashRes.ok) setDashboardData(await dashRes.json());
      } catch {}
    }
  }

  // Approve a pending CONFIRM tool call
  async function handleApprove(requestId: string) {
    try {
      const res = await fetch(`/api/chat/approve/${requestId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        const dashRes = await fetch("/api/dashboard");
        if (dashRes.ok) setDashboardData(await dashRes.json());
      }
    } catch (err) {
      console.error("Approve error:", err);
    }
  }

  // Deny a pending CONFIRM tool call
  async function handleDeny(requestId: string) {
    try {
      const res = await fetch(`/api/chat/deny/${requestId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        const dashRes = await fetch("/api/dashboard");
        if (dashRes.ok) setDashboardData(await dashRes.json());
      }
    } catch (err) {
      console.error("Deny error:", err);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#FFFFFF] text-[#0A0A0A] font-sans antialiased">
      {/* Top Header */}
      <header className="h-14 border-b border-[#E5E5E5] px-4 sm:px-6 flex items-center justify-between bg-[#FFFFFF] shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#0A0A0A]" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-[#0A0A0A]">
              AgentShield
            </span>
          </div>

          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-[#E5E5E5] bg-[#FAFAFA] text-[#6B7280]">
            IN-MEMORY FIREWALL
          </span>

          <div className="hidden sm:flex items-center gap-1.5 ml-2 text-xs font-mono text-[#6B7280]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
            <span>Zero DB · Isolated Middleware</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation Tab Switcher */}
          <div className="flex items-center border border-[#E5E5E5] rounded-lg p-0.5 bg-[#FAFAFA]">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === "chat"
                  ? "bg-[#FFFFFF] text-[#0A0A0A] shadow-xs"
                  : "text-[#6B7280] hover:text-[#0A0A0A]"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === "dashboard"
                  ? "bg-[#FFFFFF] text-[#0A0A0A] shadow-xs"
                  : "text-[#6B7280] hover:text-[#0A0A0A]"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Live Dashboard</span>
              {dashboardData && dashboardData.stats.total > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#E5E5E5] font-mono text-[#0A0A0A]">
                  {dashboardData.stats.total}
                </span>
              )}
            </button>
          </div>

          {/* Reset Session Button */}
          <button
            onClick={handleResetSession}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1 text-xs border border-[#E5E5E5] rounded-md hover:bg-[#FAFAFA] transition-colors text-[#6B7280] hover:text-[#0A0A0A] cursor-pointer"
            title="Reset in-memory session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === "chat" ? (
          /* ================= CHAT VIEW ================= */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Scrollable Chat Area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 max-w-4xl w-full mx-auto">
              {messages.length === 0 ? (
                /* Empty State / Scenario Kickstarters */
                <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center space-y-6 my-auto">
                  <div className="w-12 h-12 rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-center">
                    <Shield className="w-6 h-6 text-[#0A0A0A]" />
                  </div>

                  <div className="space-y-1.5 max-w-md">
                    <h2 className="text-base font-semibold text-[#0A0A0A] tracking-tight">
                      AgentShield Runtime Security Firewall
                    </h2>
                    <p className="text-xs text-[#6B7280] leading-relaxed">
                      AI agent with document extraction capabilities, protected by an in-memory
                      firewall middleware. Test normal extraction versus prompt injection attack.
                    </p>
                  </div>

                  {/* Two Main Demo Flow Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left pt-2">
                    {/* Flow 1: Clean Document */}
                    <button
                      onClick={() =>
                        handleSendMessage(
                          "Please extract and summarize this business document.",
                          "clean-doc",
                        )
                      }
                      className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] hover:border-[#A3A3A3] transition-all text-left group cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#0A0A0A]">
                          1. Clean Document Flow
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] font-medium">
                          ALLOW
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7280] leading-snug">
                        Attaches <code className="font-mono text-[#0A0A0A]">clean-document.pdf</code>.
                        Agent extracts text and safely calls{" "}
                        <code className="font-mono text-[#2563EB]">summarize_document</code>.
                      </p>
                      <div className="text-[10px] text-[#2563EB] font-mono flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Run Clean Flow</span>
                        <span>→</span>
                      </div>
                    </button>

                    {/* Flow 2: Injected Document */}
                    <button
                      onClick={() =>
                        handleSendMessage(
                          "Please review and extract this compliance document.",
                          "injected-doc",
                        )
                      }
                      className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] hover:border-[#DC2626]/40 transition-all text-left group cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#0A0A0A]">
                          2. Prompt Injection Attack
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#DC2626]/10 text-[#DC2626] font-medium">
                          BLOCK
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7280] leading-snug">
                        Attaches <code className="font-mono text-[#0A0A0A]">injected-document.pdf</code>.
                        Hidden prompt attempts <code className="font-mono text-[#DC2626]">execute_privileged_action</code>.
                        Firewall intercepts and blocks it.
                      </p>
                      <div className="text-[10px] text-[#DC2626] font-mono flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Run Attack Simulation</span>
                        <span>→</span>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                /* Message List */
                messages.map((msg) => (
                  <div key={msg.id} className="space-y-3">
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-xl rounded-2xl px-4 py-2.5 bg-[#FAFAFA] border border-[#E5E5E5] text-xs text-[#0A0A0A] leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 max-w-2xl">
                        {/* Text Content */}
                        {msg.content && (
                          <div className="text-xs text-[#0A0A0A] leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        )}

                        {/* Inline Tool Event Card */}
                        {msg.tool_request && (
                          <ToolEventCard
                            toolRequest={msg.tool_request}
                            onApprove={() => handleApprove(msg.tool_request!.id)}
                            onDeny={() => handleDeny(msg.tool_request!.id)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-[#6B7280] font-mono py-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#2563EB] animate-pulse"></span>
                  <span>Agent extracting document & evaluating security policy...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Composer */}
            <div className="border-t border-[#E5E5E5] p-4 bg-[#FFFFFF] shrink-0">
              <div className="max-w-4xl mx-auto space-y-2">
                {/* Document Quick-Attach Popover */}
                {showDocPicker && (
                  <div className="border border-[#E5E5E5] rounded-xl p-3 bg-[#FFFFFF] shadow-sm space-y-2 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-[#E5E5E5]">
                      <span className="font-semibold text-[#0A0A0A]">Select Fixture Document</span>
                      <button
                        onClick={() => setShowDocPicker(false)}
                        className="text-[#6B7280] hover:text-[#0A0A0A]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {documents.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => {
                            setSelectedDoc(doc);
                            setShowDocPicker(false);
                          }}
                          className="flex items-start gap-2.5 p-2 rounded-lg border border-[#E5E5E5] hover:border-[#0A0A0A] transition-all text-left cursor-pointer group"
                        >
                          <FileText className="w-4 h-4 text-[#6B7280] group-hover:text-[#0A0A0A] shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-mono font-medium text-[#0A0A0A]">
                              {doc.name}
                            </div>
                            <div className="text-[10px] text-[#6B7280]">{doc.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Document Chip */}
                {selectedDoc && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-[#E5E5E5] bg-[#FAFAFA] text-xs font-mono text-[#0A0A0A]">
                    <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>{selectedDoc.name}</span>
                    <button
                      onClick={() => setSelectedDoc(null)}
                      className="text-[#6B7280] hover:text-[#0A0A0A] cursor-pointer ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Composer Box */}
                <div className="relative rounded-2xl border border-[#E5E5E5] bg-[#FFFFFF] focus-within:border-[#A3A3A3] transition-all p-2 flex items-end gap-2">
                  <button
                    onClick={() => setShowDocPicker(!showDocPicker)}
                    className="p-2 text-[#6B7280] hover:text-[#0A0A0A] rounded-lg hover:bg-[#FAFAFA] transition-colors cursor-pointer shrink-0"
                    title="Attach Document"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask agent to extract or summarize a document..."
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-xs text-[#0A0A0A] placeholder-[#9CA3AF] focus:outline-hidden py-2 max-h-32"
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={(!inputText.trim() && !selectedDoc) || isLoading}
                    className="p-2 rounded-xl bg-[#0A0A0A] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#262626] transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= LIVE DASHBOARD VIEW ================= */
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 max-w-5xl w-full mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
              <div>
                <h1 className="text-lg font-semibold text-[#0A0A0A] tracking-tight">
                  Firewall Inspection Dashboard
                </h1>
                <p className="text-xs text-[#6B7280]">
                  Live in-memory stats, provenance tracking, and policy decisions for the active session.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-[#FAFAFA] border border-[#E5E5E5] text-[#0A0A0A]">
                  <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse"></span>
                  Polling Live State (1.5s)
                </span>
              </div>
            </div>

            {/* 4 Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] space-y-1">
                <span className="text-[11px] font-mono text-[#6B7280] uppercase tracking-wider">
                  Total Calls
                </span>
                <div className="text-2xl font-bold font-mono text-[#0A0A0A]">
                  {dashboardData?.stats.total ?? 0}
                </div>
                <div className="text-[10px] text-[#6B7280]">Inspected requests</div>
              </div>

              <div className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] space-y-1">
                <span className="text-[11px] font-mono text-[#2563EB] uppercase tracking-wider">
                  Allowed
                </span>
                <div className="text-2xl font-bold font-mono text-[#2563EB]">
                  {dashboardData?.stats.allowed ?? 0}
                </div>
                <div className="text-[10px] text-[#6B7280]">Safe low-risk actions</div>
              </div>

              <div className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] space-y-1">
                <span className="text-[11px] font-mono text-[#D97706] uppercase tracking-wider">
                  Pending
                </span>
                <div className="text-2xl font-bold font-mono text-[#D97706]">
                  {dashboardData?.stats.confirmed ?? 0}
                </div>
                <div className="text-[10px] text-[#6B7280]">Awaiting operator</div>
              </div>

              <div className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] space-y-1">
                <span className="text-[11px] font-mono text-[#DC2626] uppercase tracking-wider">
                  Blocked Attacks
                </span>
                <div className="text-2xl font-bold font-mono text-[#DC2626]">
                  {dashboardData?.stats.blocked ?? 0}
                </div>
                <div className="text-[10px] text-[#6B7280]">Tainted executions stopped</div>
              </div>
            </div>

            {/* Security Events Table */}
            <div className="border border-[#E5E5E5] rounded-xl overflow-hidden bg-[#FFFFFF] space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#0A0A0A] uppercase tracking-wider font-mono">
                  Runtime Security Events Log ({dashboardData?.recentEvents.length ?? 0})
                </h3>
              </div>

              {(!dashboardData || dashboardData.recentEvents.length === 0) ? (
                <div className="text-center py-10 text-xs text-[#9CA3AF] font-mono">
                  No tool execution events recorded in this session yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#E5E5E5] text-[#6B7280] text-[11px]">
                        <th className="py-2 px-3 font-normal">Timestamp</th>
                        <th className="py-2 px-3 font-normal">Tool</th>
                        <th className="py-2 px-3 font-normal">Source</th>
                        <th className="py-2 px-3 font-normal">Taint</th>
                        <th className="py-2 px-3 font-normal">Risk</th>
                        <th className="py-2 px-3 font-normal">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E5E5]">
                      {dashboardData.recentEvents.map((evt) => (
                        <tr key={evt.id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="py-2.5 px-3 text-[#6B7280] text-[11px]">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#0A0A0A]">
                            {evt.tool}
                          </td>
                          <td className="py-2.5 px-3 text-[#6B7280]">{evt.source}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                evt.tainted
                                  ? "bg-[#DC2626]/10 text-[#DC2626]"
                                  : "bg-[#2563EB]/10 text-[#2563EB]"
                              }`}
                            >
                              {evt.tainted ? "TAINTED" : "CLEAN"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#6B7280]">{evt.risk}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                evt.decision === "ALLOW"
                                  ? "bg-[#2563EB]/10 text-[#2563EB]"
                                  : evt.decision === "BLOCK"
                                  ? "bg-[#DC2626]/10 text-[#DC2626]"
                                  : "bg-[#D97706]/10 text-[#D97706]"
                              }`}
                            >
                              {evt.decision}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Centered Inline Tool Event Card with Firewall Pipeline
 */
function ToolEventCard({
  toolRequest,
  onApprove,
  onDeny,
}: {
  toolRequest: ToolRequest;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const isAllow = toolRequest.decision === "ALLOW";
  const isBlock = toolRequest.decision === "BLOCK";
  const isConfirm = toolRequest.decision === "CONFIRM" && toolRequest.status === "pending";

  return (
    <div
      className={`border rounded-xl p-4 sm:p-5 bg-[#FFFFFF] space-y-3.5 ${
        isBlock
          ? "border-[#DC2626]/30 bg-[#FEF2F2]/10"
          : isAllow
          ? "border-[#E5E5E5]"
          : "border-[#D97706]/30 bg-[#FFFBEB]/10"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2.5">
        <div className="flex items-center gap-2">
          {isBlock ? (
            <AlertOctagon className="w-4 h-4 text-[#DC2626]" />
          ) : isAllow ? (
            <Wrench className="w-4 h-4 text-[#2563EB]" />
          ) : (
            <Lock className="w-4 h-4 text-[#D97706]" />
          )}
          <span className="font-mono text-xs font-semibold text-[#0A0A0A]">
            {toolRequest.tool_name}
          </span>
        </div>

        <span
          className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${
            toolRequest.risk_level === "HIGH"
              ? "bg-[#DC2626]/10 text-[#DC2626]"
              : "bg-[#E5E5E5] text-[#0A0A0A]"
          }`}
        >
          [{toolRequest.risk_level} RISK]
        </span>
      </div>

      {/* Tool Arguments */}
      <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-lg p-2.5 font-mono text-[11px] space-y-1">
        {Object.entries(toolRequest.arguments).map(([key, val]) => (
          <div key={key}>
            <span className="text-[#6B7280]">{key}: </span>
            <span className="text-[#0A0A0A] font-medium">
              {typeof val === "object" ? JSON.stringify(val) : String(val)}
            </span>
          </div>
        ))}
      </div>

      {/* Firewall Evaluation Pipeline */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[10px] font-mono text-[#6B7280] uppercase tracking-wider">
          Firewall Evaluation Pipeline
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center">
          <div className="border border-[#E5E5E5] rounded-md p-1.5 bg-[#FFFFFF]">
            <div className="text-[9px] font-mono text-[#6B7280] uppercase">Source</div>
            <div className="text-[11px] font-mono font-semibold text-[#0A0A0A]">
              {toolRequest.source_type}
            </div>
          </div>
          <div className="border border-[#E5E5E5] rounded-md p-1.5 bg-[#FFFFFF]">
            <div className="text-[9px] font-mono text-[#6B7280] uppercase">Trust</div>
            <div className="text-[11px] font-mono font-semibold text-[#0A0A0A]">
              {toolRequest.trust_level}
            </div>
          </div>
          <div className="border border-[#E5E5E5] rounded-md p-1.5 bg-[#FFFFFF]">
            <div className="text-[9px] font-mono text-[#6B7280] uppercase">Taint</div>
            <div
              className={`text-[11px] font-mono font-semibold ${
                toolRequest.tainted ? "text-[#DC2626]" : "text-[#2563EB]"
              }`}
            >
              {toolRequest.tainted ? "TAINTED" : "CLEAN"}
            </div>
          </div>
          <div className="border border-[#E5E5E5] rounded-md p-1.5 bg-[#FFFFFF]">
            <div className="text-[9px] font-mono text-[#6B7280] uppercase">Risk</div>
            <div className="text-[11px] font-mono font-semibold text-[#0A0A0A]">
              {toolRequest.risk_level}
            </div>
          </div>
          <div
            className={`border rounded-md p-1.5 ${
              isBlock
                ? "border-[#DC2626] bg-[#DC2626]/5 text-[#DC2626]"
                : isAllow
                ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                : "border-[#D97706] bg-[#D97706]/5 text-[#D97706]"
            }`}
          >
            <div className="text-[9px] font-mono uppercase">Decision</div>
            <div className="text-[11px] font-mono font-bold">{toolRequest.decision}</div>
          </div>
        </div>
      </div>

      {/* ALLOWED Result View */}
      {isAllow && toolRequest.execution_result && (
        <div className="p-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] text-xs font-mono space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#2563EB] font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ALLOWED — TOOL EXECUTED</span>
          </div>
          <div className="text-[#0A0A0A] font-sans text-xs">
            <span className="font-semibold font-mono text-[#2563EB]">
              {String(toolRequest.execution_result.title || "Document Summary")}:
            </span>{" "}
            {String(toolRequest.execution_result.summary || "")}
          </div>
          {Array.isArray(toolRequest.execution_result.key_points) && (
            <ul className="list-disc list-inside text-[11px] text-[#6B7280] space-y-0.5 pt-1">
              {toolRequest.execution_result.key_points.map((pt, idx) => (
                <li key={idx}>{String(pt)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* BLOCKED Warning Box */}
      {isBlock && (
        <div className="p-3 rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/5 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#DC2626] font-semibold text-[11px] font-mono">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>EXECUTION PREVENTED — PRIVILEGED ACTION BLOCKED</span>
          </div>
          <p className="text-[#0A0A0A] text-xs leading-relaxed">{toolRequest.reason}</p>
        </div>
      )}

      {/* CONFIRM Approval Buttons */}
      {isConfirm && (
        <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-between gap-3">
          <div className="text-[11px] text-[#6B7280]">
            Action flagged for operator review.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDeny}
              className="px-3 py-1 rounded-lg border border-[#E5E5E5] text-xs font-medium text-[#6B7280] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors cursor-pointer"
            >
              Deny
            </button>
            <button
              onClick={onApprove}
              className="px-3 py-1 rounded-lg bg-[#0A0A0A] text-xs font-medium text-white hover:bg-[#262626] transition-colors cursor-pointer"
            >
              Approve Execution
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
