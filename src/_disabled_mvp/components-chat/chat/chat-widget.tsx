"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Minimize2,
  Maximize2,
  AlertCircle,
  CheckCircle,
  Clock,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status?: "sending" | "sent" | "error";
  metadata?: {
    intent?: string;
    confidence?: number;
    dataSource?: string;
  };
}

interface QuickAction {
  id: string;
  label: string;
  query: string;
  icon: typeof HelpCircle;
}

// Quick action suggestions
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "refund",
    label: "Where is my refund?",
    query: "I want to check the status of my refund",
    icon: Clock,
  },
  {
    id: "match",
    label: "When is my match?",
    query: "When is my next scheduled match?",
    icon: CheckCircle,
  },
  {
    id: "kyc",
    label: "KYC status",
    query: "What is the status of my KYC verification?",
    icon: AlertCircle,
  },
  {
    id: "help",
    label: "Help me",
    query: "I need help with the platform",
    icon: HelpCircle,
  },
];

// Generate unique session ID
const generateSessionId = () => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(generateSessionId());
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Hi! I'm VALORHIVE Assistant. How can I help you today?\n\nYou can ask me about:\n• Refund status\n• Match schedules\n• KYC verification\n• Tournament registrations\n• And more!",
          timestamp: new Date(),
          status: "sent",
        },
      ]);
    }
  }, [isOpen, messages.length]);

  // Send message to API
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}_user`,
      role: "user",
      content: messageText.trim(),
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: messageText.trim(),
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}_assistant`,
        role: "assistant",
        content: data.response || "I'm sorry, I couldn't process your request. Please try again.",
        timestamp: new Date(),
        status: "sent",
        metadata: {
          intent: data.intent,
          confidence: data.confidence,
          dataSource: data.dataSource,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update unread count if chat is minimized
      if (isMinimized) {
        setUnreadCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Chat error:", error);

      const errorMessage: ChatMessage = {
        id: `${Date.now()}_error`,
        role: "system",
        content: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
        status: "error",
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, messages, isLoading, isMinimized]);

  // Handle quick action click
  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.query);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // Clear unread count when opening chat
  const handleOpenChat = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
  };

  // Don't render on server
  if (typeof window === "undefined") return null;

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Button
          onClick={handleOpenChat}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card
          className={cn(
            "fixed z-50 shadow-2xl transition-all duration-300 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700",
            isMinimized
              ? "bottom-6 right-6 w-72 h-14"
              : "bottom-6 right-6 w-96 h-[32rem] max-h-[80vh]"
          )}
        >
          {/* Header */}
          <CardHeader className="p-3 border-b border-gray-200 dark:border-gray-700 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-600 to-teal-600 flex items-center justify-center">
                <Bot className="w-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">VALORHIVE Support</CardTitle>
                {!isMinimized && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">AI Assistant</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Chat Content */}
          {!isMinimized && (
            <>
              <ScrollArea className="flex-1 p-0" style={{ height: "calc(100% - 120px)" }}>
                <CardContent className="p-4 space-y-4" ref={scrollRef}>
                  {/* Messages */}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-2",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === "assistant" && (
                        <Avatar className="h-8 w-8 bg-gradient-to-r from-green-600 to-teal-600">
                          <AvatarFallback className="bg-transparent">
                            <Bot className="h-4 w-4 text-white" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                          message.role === "user"
                            ? "bg-gradient-to-r from-green-600 to-teal-600 text-white"
                            : message.role === "system"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.metadata?.dataSource && (
                          <p className="text-xs text-gray-500 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                            Source: {message.metadata.dataSource}
                          </p>
                        )}
                      </div>
                      {message.role === "user" && (
                        <Avatar className="h-8 w-8 bg-gray-200 dark:bg-gray-700">
                          <AvatarFallback>
                            <User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-2 justify-start">
                      <Avatar className="h-8 w-8 bg-gradient-to-r from-green-600 to-teal-600">
                        <AvatarFallback className="bg-transparent">
                          <Bot className="h-4 w-4 text-white" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                      </div>
                    </div>
                  )}

                  {/* Quick Actions (show when few messages) */}
                  {messages.length <= 2 && !isLoading && (
                    <div className="pt-2">
                      <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_ACTIONS.map((action) => (
                          <Button
                            key={action.id}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleQuickAction(action)}
                          >
                            <action.icon className="h-3 w-3 mr-1" />
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </ScrollArea>

              {/* Input Area */}
              <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your message..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}
