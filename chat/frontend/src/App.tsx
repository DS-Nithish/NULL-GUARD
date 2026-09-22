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
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Initialize new conversation and fetch available documents on startup
  useEffect(() => {
    async function init() {
      try {
        const [convRes, docRes] = await Promise.all([
          fetch("/api/chat/new", { method: "POST" }),
          fetch("/api/documents"),
        ]);
        const convData = await convRes.json();
        const docData = await docRes.json();
        setConversationId(convData.conversationId);
        setDocuments(docData);
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

  // Send user message
  async function handleSendMessage(overrideText?: string, overrideDocId?: string) {
    const textToSend = overrideText !== undefined ? overrideText : inputText.trim();
    const docIdToSend = overrideDocId !== undefined ? overrideDocId : selectedDoc?.id;

    if (!textToSend || !conversationId || isLoading) return;

    setIsLoading(true);
    setInputText("");
    setSelectedDoc(null);
    setShowDocPicker(false);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: textToSend,
          attachedDocumentId: docIdToSend,
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

  // Keydown handler (Enter to send, Shift+Enter for newline)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0A0A0A] font-sans flex flex-col selection:bg-neutral-200">
      
      {/* 1. Header — Minimal MCP Docs style */}
      <header className="w-full border-b border-[#E5E5E5] bg-[#FFFFFF] sticky top-0 z-30">
        <div className="max-w-[760px] mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded border border-[#E5E5E5] flex items-center justify-center text-[#0A0A0A] bg-[#FAFAFA]">
              <Shield className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-[#0A0A0A]">
                  AgentShield Chat
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-[#E5E5E5] bg-[#FAFAFA] text-[#6B7280]">
                  live firewall
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#0A0A0A] px-2.5 py-1 rounded border border-[#E5E5E5] hover:bg-[#FAFAFA] transition-all cursor-pointer"
            title="Start new conversation"
          >
            <RotateCcw className="w-3 h-3" />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* 2. Chat Area (Scrollable Message Thread) */}
      <main className="flex-1 max-w-[760px] mx-auto w-full px-5 py-6 flex flex-col justify-between">
        
        {/* Messages List */}
        <div className="space-y-6 flex-1">
          {messages.length === 0 ? (
            /* Empty State with Suggested Prompts (ChatGPT-style) */
            <div className="py-12 sm:py-16 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-10 h-10 rounded-xl border border-[#E5E5E5] flex items-center justify-center bg-[#FAFAFA] text-[#0A0A0A]">
                <Shield className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h2 className="text-base font-semibold text-[#0A0A0A]">
                  AI Agent with Firewall Protection
                </h2>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Ask the agent to execute actions or attach files to test deterministic prompt injection containment.
                </p>
              </div>

              {/* Clickable Suggested Prompt Chips */}
              <div className="grid grid-cols-1 gap-2.5 w-full max-w-lg text-left pt-2">
                <button
                  onClick={() => {
                    setInputText("Create a database called customer_db");
                    setSelectedDoc(null);
                  }}
                  className="p-3.5 rounded-lg border border-[#E5E5E5] hover:border-[#A3A3A3] hover:bg-[#FAFAFA] transition-all text-xs text-[#0A0A0A] cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-[#0A0A0A]">1. Normal Tool Request</div>
                    <div className="text-[11px] text-[#6B7280] font-mono">
                      "Create a database called customer_db"
                    </div>
                  </div>
                  <span className="text-[#6B7280] group-hover:text-[#0A0A0A] transition-colors text-sm">&rarr;</span>
                </button>

                <button
                  onClick={() => {
                    const invoiceDoc = documents.find((d) => d.id === "doc_vendor_invoice");
                    if (invoiceDoc) setSelectedDoc(invoiceDoc);
                    setInputText("Summarize this invoice and set up what it requests");
                  }}
                  className="p-3.5 rounded-lg border border-[#E5E5E5] hover:border-[#A3A3A3] hover:bg-[#FAFAFA] transition-all text-xs text-[#0A0A0A] cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-[#0A0A0A]">2. Prompt Injection Attack</div>
                    <div className="text-[11px] text-[#6B7280] font-mono">
                      Attach vendor-invoice.pdf and summarize it
                    </div>
                  </div>
                  <span className="text-[#6B7280] group-hover:text-[#0A0A0A] transition-colors text-sm">&rarr;</span>
                </button>

                <button
                  onClick={() => {
                    const specDoc = documents.find((d) => d.id === "doc_project_spec");
                    if (specDoc) setSelectedDoc(specDoc);
                    setInputText("Summarize project-spec.pdf");
                  }}
                  className="p-3.5 rounded-lg border border-[#E5E5E5] hover:border-[#A3A3A3] hover:bg-[#FAFAFA] transition-all text-xs text-[#0A0A0A] cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-[#0A0A0A]">3. Clean Document Verification</div>
                    <div className="text-[11px] text-[#6B7280] font-mono">
                      Attach project-spec.pdf and summarize it
                    </div>
                  </div>
                  <span className="text-[#6B7280] group-hover:text-[#0A0A0A] transition-colors text-sm">&rarr;</span>
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
                    <div className="text-xs sm:text-sm text-[#0A0A0A] leading-relaxed max-w-[90%]">
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
        <div className="sticky bottom-0 bg-[#FFFFFF] pt-4 pb-2 mt-4">
          
          {/* Attached Document Chip */}
          {selectedDoc && (
            <div className="mb-2 flex items-center gap-2">
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
            <div className="absolute bottom-20 left-6 z-40 w-72 rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] shadow-sm p-1.5 text-xs space-y-1">
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
                  className="w-full text-left px-2.5 py-2 rounded hover:bg-[#FAFAFA] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="font-mono text-xs text-[#0A0A0A]">{doc.name}</span>
                  <span className="text-[10px] font-mono text-[#6B7280] uppercase">{doc.type}</span>
                </button>
              ))}
            </div>
          )}

          {/* Composer Input Box */}
          <div className="relative rounded-2xl border border-[#E5E5E5] bg-[#FFFFFF] focus-within:border-[#A3A3A3] transition-all p-2 flex items-end gap-2">
            {/* Paperclip Attach Button */}
            <button
              onClick={() => setShowDocPicker(!showDocPicker)}
              className="p-2 text-[#6B7280] hover:text-[#0A0A0A] rounded-lg hover:bg-[#FAFAFA] transition-colors cursor-pointer shrink-0"
              title="Attach Document"
            >
              <Paperclip className="w-4 h-4" />
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

          <div className="text-[10px] text-center text-[#9CA3AF] mt-1.5">
            AgentShield intercepts tool execution fail-closed before any actions are executed.
          </div>
        </div>

      </main>
    </div>
  );
}

/**
 * TOOL EVENT CARD COMPONENT
 * Renders the inline firewall inspection card in the chat thread.
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
  const isBlock = toolRequest.decision === "BLOCK";
  const isAllow = toolRequest.decision === "ALLOW";
  const isConfirm = toolRequest.decision === "CONFIRM" && toolRequest.status === "pending";

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
          <Wrench className="w-3.5 h-3.5 text-[#0A0A0A]" />
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
            <span className="font-medium">{String(val)}</span>
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

      {isAllow && toolRequest.execution_result && (
        <div className="p-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] text-xs font-mono space-y-1">
          <div className="flex items-center gap-1.5 text-[#2563EB] font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ALLOWED — TOOL EXECUTED</span>
          </div>
          <div className="text-[#0A0A0A]">
            {JSON.stringify(toolRequest.execution_result)}
          </div>
        </div>
      )}
    </div>
  );
}
