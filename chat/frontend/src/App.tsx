import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Paperclip,
  ArrowUp,
  X,
  Wrench,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  FileText,
  RotateCcw,
  Mail,
  ExternalLink,
  Database,
  SlidersHorizontal,
} from "lucide-react";

interface PublicDocument {
  id: string;
  name: string;
  type: string;
}

interface ToolRequest {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  source_type: "USER" | "PDF";
  trust_level: "TRUSTED" | "UNTRUSTED";
  tainted: boolean;
  risk_level: string;
  decision: "ALLOW" | "CONFIRM" | "BLOCK";
  reason: string;
  status: "pending" | "resolved";
  execution_result: Record<string, unknown> | null;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "agent" | "system";
  content: string;
  tool_request_id: string | null;
  created_at: string;
  tool_request?: ToolRequest | null;
}

export default function App() {
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<PublicDocument | null>(null);
  const [showDocPicker, setShowDocPicker] = useState<boolean>(false);
  const [showToolsPopover, setShowToolsPopover] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveGmail, setIsLiveGmail] = useState<boolean>(false);
  const [isLiveNeon, setIsLiveNeon] = useState<boolean>(false);
  const [neonEnabled, setNeonEnabled] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Initialize new conversation, fetch public documents, and check live status
  useEffect(() => {
    async function init() {
      try {
        const [convRes, docRes, statusRes] = await Promise.all([
          fetch("/api/chat/new", { method: "POST" }),
          fetch("/api/documents"),
          fetch("/api/status"),
        ]);
        const convData = await convRes.json();
        const docData = await docRes.json();
        const statusData = await statusRes.json();

        setConversationId(convData.conversationId);
        setDocuments(docData);
        setIsLiveGmail(Boolean(statusData.isLiveGmail));
        setIsLiveNeon(Boolean(statusData.isLiveNeon));
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    }
    init();
  }, []);

  // Poll for messages in background every 2.5s
  useEffect(() => {
    if (!conversationId) return;

    let isMounted = true;
    async function poll() {
      try {
        const res = await fetch(`/api/chat/${conversationId}/messages`);
        if (res.ok && isMounted) {
          const data: Message[] = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error("Poll messages error:", err);
      }
    }

    const interval = setInterval(poll, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [conversationId]);

  // Reset/Start new conversation
  async function handleNewChat() {
    setIsLoading(true);
    setSelectedDoc(null);
    setInputText("");
    try {
      const res = await fetch("/api/chat/new", { method: "POST" });
      const data = await res.json();
      setConversationId(data.conversationId);
      setMessages([]);
    } catch (err) {
      console.error("Failed to reset chat:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Send user message with toolsEnabled config
  async function handleSendMessage(overrideText?: string, overrideDocId?: string) {
    const textToSend = overrideText !== undefined ? overrideText : inputText.trim();
    const docIdToSend = overrideDocId !== undefined ? overrideDocId : selectedDoc?.id;

    if (!textToSend || !conversationId || isLoading) return;

    setIsLoading(true);
    setInputText("");
    setSelectedDoc(null);
    setShowDocPicker(false);
    setShowToolsPopover(false);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: textToSend,
          attachedDocumentId: docIdToSend,
          toolsEnabled: {
            neonDatabase: neonEnabled,
          },
        }),
      });

      if (res.ok) {
        const updatedMessages: Message[] = await res.json();
        setMessages(updatedMessages);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // Operator human approval
  async function handleApprove(toolRequestId: string) {
    try {
      const res = await fetch(`/api/chat/approve/${toolRequestId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.messages) setMessages(data.messages);
      }
    } catch (err) {
      console.error("Approve failed:", err);
    }
  }

  // Operator human denial
  async function handleDeny(toolRequestId: string) {
    try {
      const res = await fetch(`/api/chat/deny/${toolRequestId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.messages) setMessages(data.messages);
      }
    } catch (err) {
      console.error("Deny failed:", err);
    }
  }

  // Keyboard shortcut: Enter to send (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#0A0A0A] font-sans">
      
      {/* 1. Header (Minimal MCP-Docs Style) */}
      <header className="border-b border-[#E5E5E5] bg-[#FFFFFF] sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded border border-[#0A0A0A] flex items-center justify-center bg-[#0A0A0A] text-white">
            <Shield className="w-4 h-4" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-[#0A0A0A]">
                AgentShield Chat
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#E5E5E5] bg-[#FAFAFA] text-[#6B7280]">
                DEMO FIREWALL
              </span>
            </div>
            <p className="text-xs text-[#6B7280] leading-none pt-0.5">
              AI agent with Gmail & Neon Database access, protected by a runtime security firewall
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E5E5E5] hover:border-[#0A0A0A] text-xs font-mono text-[#0A0A0A] bg-[#FFFFFF] transition-colors cursor-pointer"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* 2. Main Centered Conversational Column */}
      <main className="flex-1 flex flex-col justify-between w-full max-w-[760px] mx-auto px-4 sm:px-6">
        
        {/* Message Thread */}
        <div className="flex-1 py-6 space-y-6">
          {messages.length === 0 ? (
            /* Empty State / Suggested Prompts */
            <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-6">
              <div className="space-y-2 max-w-md">
                <div className="w-10 h-10 rounded-full border border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-center mx-auto text-[#0A0A0A]">
                  <Shield className="w-5 h-5 text-[#0A0A0A]" />
                </div>
                <h2 className="text-base font-semibold text-[#0A0A0A]">
                  AgentShield Runtime Firewall Demo
                </h2>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Test live conversational interactions with an AI agent equipped with tool connectors.
                  Toggle connector access, observe inline evaluations, and test prompt injection defenses.
                </p>
              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl text-left pt-1">
                {/* 1. Neon Database Summary (Clean Flow) */}
                <button
                  onClick={() => {
                    const specDoc = documents.find((d) => d.id === "doc_project_spec");
                    if (specDoc) setSelectedDoc(specDoc);
                    setInputText("Summarize this document and save the summary to our database records.");
                  }}
                  className="p-3 rounded-lg border border-[#E5E5E5] hover:border-[#A3A3A3] hover:bg-[#FAFAFA] transition-all text-xs text-[#0A0A0A] cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                      <Database className="w-3 h-3 text-[#2563EB]" />
                      <span>1. Neon DB Summary (Clean)</span>
                    </div>
                    <div className="text-[11px] text-[#6B7280] font-mono leading-snug">
                      Attach project-spec.pdf & save summary to DB
                    </div>
                  </div>
                  <div className="text-[10px] text-[#2563EB] font-mono pt-2 font-medium">
                    {neonEnabled ? "Toggle ON → CONFIRM → Neon Insert" : "Toggle OFF → Text Only (No DB tool)"}
                  </div>
                </button>

                {/* 2. Neon Database Injection (Attack Flow) */}
                <button
                  onClick={() => {
                    const invoiceDoc = documents.find((d) => d.id === "doc_vendor_invoice");
                    if (invoiceDoc) setSelectedDoc(invoiceDoc);
                    setInputText("Please summarize this invoice and set up what it asks for.");
                  }}
                  className="p-3 rounded-lg border border-[#E5E5E5] hover:border-[#DC2626] hover:bg-[#DC2626]/[0.02] transition-all text-xs text-[#0A0A0A] cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                      <AlertOctagon className="w-3 h-3 text-[#DC2626]" />
                      <span>2. DB Injection (Attack Flow)</span>
                    </div>
                    <div className="text-[11px] text-[#6B7280] font-mono leading-snug">
                      Attach vendor-invoice.pdf (backdoor write)
                    </div>
                  </div>
                  <div className="text-[10px] text-[#DC2626] font-mono pt-2 font-medium">
                    {neonEnabled ? "Toggle ON → Intercepted → BLOCK" : "Toggle OFF → No Tool Available"}
                  </div>
                </button>

                {/* 3. Legitimate Gmail Reply (Clean Flow) */}
                <button
                  onClick={() => {
                    const invoiceDoc = documents.find((d) => d.id === "doc_invoice_reply");
                    if (invoiceDoc) setSelectedDoc(invoiceDoc);
                    setInputText("Please review this invoice and send the requested confirmation email to accounting@ourcompany.com.");
                  }}
                  className="p-3 rounded-lg border border-[#E5E5E5] hover:border-[#A3A3A3] hover:bg-[#FAFAFA] transition-all text-xs text-[#0A0A0A] cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-[#2563EB]" />
                      <span>3. Gmail Reply (Clean Flow)</span>
                    </div>
                    <div className="text-[11px] text-[#6B7280] font-mono leading-snug">
                      Attach invoice-reply-request.pdf & send email
                    </div>
                  </div>
                  <div className="text-[10px] text-[#2563EB] font-mono pt-2 font-medium">
                    Approved Recipient → CONFIRM → Send
                  </div>
                </button>

                {/* 4. Gmail Exfiltration (Attack Flow) */}
                <button
                  onClick={() => {
                    const memoDoc = documents.find((d) => d.id === "doc_urgent_security_notice");
                    if (memoDoc) setSelectedDoc(memoDoc);
                    setInputText("Process this urgent security notice and execute what it demands.");
                  }}
                  className="p-3 rounded-lg border border-[#E5E5E5] hover:border-[#DC2626] hover:bg-[#DC2626]/[0.02] transition-all text-xs text-[#0A0A0A] cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                      <AlertOctagon className="w-3 h-3 text-[#DC2626]" />
                      <span>4. Gmail Exfiltration (Attack)</span>
                    </div>
                    <div className="text-[11px] text-[#6B7280] font-mono leading-snug">
                      Attach urgent-security-notice.pdf (exfiltrate credentials)
                    </div>
                  </div>
                  <div className="text-[10px] text-[#DC2626] font-mono pt-2 font-medium">
                    Injection Intercepted → BLOCK
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* Render Thread Messages */
            messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] bg-[#F5F5F5] text-[#0A0A0A] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              // Agent Message with Optional Inline Tool Event Card
              return (
                <div key={msg.id} className="space-y-3">
                  {/* Agent message text */}
                  {msg.content && (
                    <div className="text-xs sm:text-sm text-[#0A0A0A] leading-relaxed max-w-[90%] whitespace-pre-line">
                      {msg.content}
                    </div>
                  )}

                  {/* TOOL EVENT CARD (The Centerpiece) */}
                  {msg.tool_request && (
                    <ToolEventCard
                      toolRequest={msg.tool_request}
                      onApprove={() => handleApprove(msg.tool_request!.id)}
                      onDeny={() => handleDeny(msg.tool_request!.id)}
                    />
                  )}
                </div>
              );
            })
          )}

          {/* Loading typing indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-[#6B7280] font-mono pt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A] animate-pulse"></span>
              <span>Agent reasoning & firewall evaluation in progress...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Sticky Bottom Composer & Document Attachment Picker */}
        <div className="sticky bottom-0 bg-[#FFFFFF] pt-3 pb-3 mt-4 space-y-2">
          
          {/* Status Bar: Live Connector States & Audit Log */}
          <div className="flex flex-wrap items-center justify-between px-1 text-[11px] font-mono text-[#6B7280] gap-2">
            <div className="flex items-center gap-3">
              {/* Neon Database Status */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    neonEnabled ? (isLiveNeon ? "bg-[#2563EB]" : "bg-[#0A0A0A]") : "bg-[#9CA3AF]"
                  }`}
                ></span>
                <span>
                  NEON DB:{" "}
                  {neonEnabled ? (isLiveNeon ? "ON (Live)" : "ON (Simulated)") : "OFF"}
                </span>
              </div>

              {/* Gmail Status */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isLiveGmail ? "bg-[#2563EB]" : "bg-[#9CA3AF]"}`}
                ></span>
                <span>GMAIL: {isLiveGmail ? "LIVE MCP" : "SIMULATED"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/api/audit-log"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#0A0A0A] transition-colors flex items-center gap-1 underline"
              >
                <span>view audit log</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* Attached Document Chip */}
          {selectedDoc && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-[#E5E5E5] bg-[#FAFAFA] text-xs font-mono text-[#0A0A0A]">
                <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>{selectedDoc.name}</span>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="hover:text-red-600 transition-colors cursor-pointer ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Document Picker Dropdown Popover */}
          {showDocPicker && (
            <div className="absolute bottom-24 left-6 z-40 w-80 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] shadow-sm p-2 text-xs space-y-1">
              <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">
                Select Document to Attach
              </div>
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setShowDocPicker(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#FAFAFA] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="font-mono text-xs text-[#0A0A0A] truncate mr-2">{doc.name}</span>
                  <span className="text-[10px] font-mono text-[#6B7280] uppercase shrink-0">{doc.type}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tools / Connector Settings Popover */}
          {showToolsPopover && (
            <div className="absolute bottom-24 left-12 z-40 w-80 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] shadow-sm p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[#0A0A0A]">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#0A0A0A]" />
                  <span>Tool Connectors</span>
                </div>
                <button
                  onClick={() => setShowToolsPopover(false)}
                  className="text-[#6B7280] hover:text-[#0A0A0A] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* List Item: Neon Database Toggle */}
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded border border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-center shrink-0 mt-0.5 text-[#0A0A0A]">
                    <Database className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-[#0A0A0A]">Neon Database</span>
                      <span className="font-mono text-[9px] uppercase px-1 py-0.2 rounded border border-[#E5E5E5] text-[#6B7280] bg-[#FAFAFA]">
                        {neonEnabled ? (isLiveNeon ? "Live" : "Simulated") : "Disabled"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B7280] leading-snug">
                      Allows agent to write summaries to Neon database table (insert_document_summary)
                    </p>
                  </div>
                </div>

                {/* Switch matching design specs: gray off track, blue accent on track */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={neonEnabled}
                  onClick={() => setNeonEnabled(!neonEnabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-0.5 ${
                    neonEnabled ? "bg-[#2563EB]" : "bg-[#E5E5E5]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                      neonEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Composer Input Box */}
          <div className="relative rounded-2xl border border-[#E5E5E5] bg-[#FFFFFF] focus-within:border-[#A3A3A3] transition-all p-2 flex items-end gap-2">
            {/* Paperclip Attach Button */}
            <button
              onClick={() => {
                setShowDocPicker(!showDocPicker);
                setShowToolsPopover(false);
              }}
              className="p-2 text-[#6B7280] hover:text-[#0A0A0A] rounded-lg hover:bg-[#FAFAFA] transition-colors cursor-pointer shrink-0"
              title="Attach Document"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Tools / Connector Popover Button */}
            <button
              onClick={() => {
                setShowToolsPopover(!showToolsPopover);
                setShowDocPicker(false);
              }}
              className={`p-2 rounded-lg transition-colors cursor-pointer shrink-0 ${
                neonEnabled
                  ? "text-[#2563EB] hover:bg-[#2563EB]/[0.05]"
                  : "text-[#6B7280] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]"
              }`}
              title="Tool Connectors"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Auto-growing Textarea */}
            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message the agent..."
              disabled={isLoading}
              className="flex-1 max-h-36 resize-none outline-hidden border-0 bg-transparent text-xs sm:text-sm text-[#0A0A0A] placeholder-[#9CA3AF] py-1.5"
            />

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              className="w-8 h-8 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center disabled:bg-[#E5E5E5] disabled:text-[#9CA3AF] transition-colors cursor-pointer shrink-0"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}

/**
 * Centered Inline Tool Event Card with Animated Pipeline
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

  const isEmailTool = toolRequest.tool_name === "send_email";
  const isNeonInsert = toolRequest.tool_name === "insert_document_summary";

  return (
    <div
      className={`border rounded-xl p-4 sm:p-5 bg-[#FFFFFF] space-y-3.5 ${
        isConfirm
          ? "border-dashed border-[#0A0A0A]"
          : isBlock
          ? "border-[#E5E5E5]"
          : "border-[#E5E5E5]"
      }`}
    >
      {/* Top Header: Tool Name & Risk */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E5E5] pb-2.5">
        <div className="flex items-center gap-2">
          {isEmailTool ? (
            <Mail className="w-3.5 h-3.5 text-[#0A0A0A]" />
          ) : isNeonInsert ? (
            <Database className="w-3.5 h-3.5 text-[#0A0A0A]" />
          ) : (
            <Wrench className="w-3.5 h-3.5 text-[#0A0A0A]" />
          )}
          <span className="font-mono text-xs font-semibold text-[#0A0A0A]">
            {toolRequest.tool_name}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase text-[#6B7280]">
          [{toolRequest.risk_level} RISK]
        </span>
      </div>

      {/* Arguments JSON / Key-Value */}
      <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E5E5E5] font-mono text-[11px] text-[#0A0A0A] space-y-0.5">
        {Object.entries(toolRequest.arguments).map(([key, val]) => (
          <div key={key}>
            <span className="text-[#6B7280]">{key}: </span>
            <span className="font-medium">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
          </div>
        ))}
      </div>

      {/* Mini Horizontal Staggered Pipeline Strip: SOURCE -> TRUST -> TAINT -> RISK -> DECISION */}
      <div className="pt-1 space-y-1.5">
        <div className="text-[10px] font-mono uppercase text-[#6B7280] tracking-wider">
          Firewall Evaluation Pipeline
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-0">
          
          {/* Node 1: SOURCE */}
          <div
            className="flex-1 p-2 rounded border border-[#E5E5E5] bg-[#FFFFFF] anim-node text-left"
            style={{ animationDelay: "0ms" }}
          >
            <div className="text-[9px] uppercase font-semibold text-[#6B7280]">Source</div>
            <div className="text-[11px] font-mono font-medium text-[#0A0A0A] truncate">
              {toolRequest.source_type}
            </div>
          </div>

          {/* Connector 1 */}
          <div className="hidden sm:flex w-4 h-[1px] bg-[#E5E5E5] relative overflow-hidden shrink-0">
            <div
              className="w-full h-full bg-[#0A0A0A] anim-line"
              style={{ animationDelay: "120ms" }}
            ></div>
          </div>

          {/* Node 2: TRUST */}
          <div
            className="flex-1 p-2 rounded border border-[#E5E5E5] bg-[#FFFFFF] anim-node text-left"
            style={{ animationDelay: "180ms" }}
          >
            <div className="text-[9px] uppercase font-semibold text-[#6B7280]">Trust</div>
            <div
              className={`text-[11px] font-mono font-semibold ${
                toolRequest.trust_level === "TRUSTED" ? "text-[#2563EB]" : "text-[#DC2626]"
              }`}
            >
              {toolRequest.trust_level}
            </div>
          </div>

          {/* Connector 2 */}
          <div className="hidden sm:flex w-4 h-[1px] bg-[#E5E5E5] relative overflow-hidden shrink-0">
            <div
              className="w-full h-full bg-[#0A0A0A] anim-line"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>

          {/* Node 3: TAINT */}
          <div
            className="flex-1 p-2 rounded border border-[#E5E5E5] bg-[#FFFFFF] anim-node text-left"
            style={{ animationDelay: "360ms" }}
          >
            <div className="text-[9px] uppercase font-semibold text-[#6B7280]">Taint</div>
            <div
              className={`text-[11px] font-mono font-semibold ${
                toolRequest.tainted ? "text-[#DC2626]" : "text-[#2563EB]"
              }`}
            >
              {toolRequest.tainted ? "TAINTED" : "CLEAN"}
            </div>
          </div>

          {/* Connector 3 */}
          <div className="hidden sm:flex w-4 h-[1px] bg-[#E5E5E5] relative overflow-hidden shrink-0">
            <div
              className="w-full h-full bg-[#0A0A0A] anim-line"
              style={{ animationDelay: "480ms" }}
            ></div>
          </div>

          {/* Node 4: RISK */}
          <div
            className="flex-1 p-2 rounded border border-[#E5E5E5] bg-[#FFFFFF] anim-node text-left"
            style={{ animationDelay: "540ms" }}
          >
            <div className="text-[9px] uppercase font-semibold text-[#6B7280]">Risk</div>
            <div className="text-[11px] font-mono font-medium text-[#0A0A0A]">
              {toolRequest.risk_level}
            </div>
          </div>

          {/* Connector 4 */}
          <div className="hidden sm:flex w-4 h-[1px] bg-[#E5E5E5] relative overflow-hidden shrink-0">
            <div
              className="w-full h-full bg-[#0A0A0A] anim-line"
              style={{ animationDelay: "660ms" }}
            ></div>
          </div>

          {/* Node 5: DECISION */}
          <div
            className={`flex-1 p-2 rounded border anim-decision text-left ${
              isAllow
                ? "border-[#2563EB] bg-[#2563EB]/[0.04] text-[#2563EB]"
                : isBlock
                ? "border-[#DC2626] bg-[#DC2626]/[0.04] text-[#DC2626]"
                : "border-dashed border-[#0A0A0A] bg-[#FFFFFF] text-[#0A0A0A]"
            }`}
            style={{ animationDelay: "740ms" }}
          >
            <div className="text-[9px] uppercase font-semibold opacity-75">Decision</div>
            <div className="text-[11px] font-mono font-bold tracking-wide">
              {isConfirm ? "CONFIRM" : toolRequest.decision}
            </div>
          </div>

        </div>
      </div>

      {/* Outcome Explanations / Actions */}
      {isBlock && (
        <div className="p-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] text-xs leading-relaxed text-[#DC2626] flex items-start gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold font-mono text-[10px] uppercase tracking-wider block">
              BLOCKED FAIL-CLOSED
            </span>
            <span className="text-[#0A0A0A] text-xs">{toolRequest.reason}</span>
          </div>
        </div>
      )}

      {isConfirm && (
        <div className="p-3.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0A0A0A]">
            <HelpCircle className="w-3.5 h-3.5 text-[#0A0A0A]" />
            <span>Awaiting Operator Confirmation</span>
          </div>
          <p className="text-xs text-[#6B7280]">
            {toolRequest.reason}
          </p>
          <div className="flex items-center gap-2 pt-1">
            {/* The ONLY Solid Black Button */}
            <button
              onClick={onApprove}
              className="px-3.5 py-1.5 rounded-md bg-[#0A0A0A] text-white hover:bg-neutral-800 text-xs font-medium transition-colors cursor-pointer"
            >
              Approve
            </button>
            <button
              onClick={onDeny}
              className="px-3.5 py-1.5 rounded-md border border-[#E5E5E5] bg-[#FFFFFF] text-[#0A0A0A] hover:border-[#DC2626] hover:text-[#DC2626] text-xs font-medium transition-colors cursor-pointer"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* ALLOWED Result View */}
      {isAllow && toolRequest.execution_result && (
        <div className="p-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] text-xs font-mono space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#2563EB] font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ALLOWED — TOOL EXECUTED</span>
          </div>
          {isEmailTool ? (
            <div className="text-[#0A0A0A] font-sans text-xs">
              <div className="font-mono text-[11px] text-[#2563EB] mb-1 font-semibold">
                {toolRequest.execution_result.provider === "real_mcp"
                  ? "[REAL GMAIL MCP SEND]"
                  : "[GMAIL SIMULATED SEND]"}
              </div>
              Email sent to{" "}
              <span className="font-mono font-medium text-[#0A0A0A]">
                {String(toolRequest.execution_result.to || toolRequest.arguments.to)}
              </span>{" "}
              (Message ID:{" "}
              <span className="font-mono font-medium text-[#0A0A0A]">
                {String(toolRequest.execution_result.messageId || "N/A")}
              </span>
              )
            </div>
          ) : isNeonInsert ? (
            <div className="text-[#0A0A0A] font-sans text-xs space-y-1">
              <div className="font-mono text-[11px] text-[#2563EB] font-semibold">
                {toolRequest.execution_result.provider === "real_neon_mcp"
                  ? "[REAL NEON MCP INSERT]"
                  : "[NEON DATABASE SIMULATED INSERT]"}
              </div>
              <div>
                Summary for <span className="font-mono font-medium">{String(toolRequest.execution_result.title || toolRequest.arguments.title)}</span> successfully written to table <span className="font-mono font-medium text-[#2563EB]">document_summaries</span> (Row ID: <span className="font-mono font-medium">{String(toolRequest.execution_result.rowId || "saved")}</span>).
              </div>
            </div>
          ) : (
            <div className="text-[#0A0A0A] overflow-x-auto">
              <pre className="font-mono text-[11px] whitespace-pre-wrap">
                {JSON.stringify(toolRequest.execution_result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
