"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Users, 
  Crown, 
  Megaphone, 
  MessageCircle,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import { useGroupChat, type GroupChatMessage } from '@/hooks/use-group-chat';

interface GroupChatProps {
  chatId: string;
  chatName: string;
  chatType: 'TOURNAMENT_GENERAL' | 'TOURNAMENT_ANNOUNCEMENTS' | 'TEAM';
  userRole: 'ADMIN' | 'MEMBER' | null;
  isReadOnly?: boolean;
  className?: string;
}

export function GroupChat({
  chatId,
  chatName,
  chatType,
  userRole,
  isReadOnly = false,
  className,
}: GroupChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [members, setMembers] = useState<Array<{
    user: { id: string; firstName: string; lastName: string };
    role: string;
  }>>([]);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isConnected,
    messages,
    typingUsers,
    error,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    setInitialMessages,
    clearError,
  } = useGroupChat({ chatId });

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const response = await fetch(`/api/group-chats/${chatId}/messages?limit=50`);
        if (response.ok) {
          const data = await response.json();
          setInitialMessages(data.messages);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [chatId, setInitialMessages]);

  // Fetch members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch(`/api/group-chats/${chatId}/members`);
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members);
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      }
    };

    fetchMembers();
  }, [chatId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when messages change
  useEffect(() => {
    if (messages.length > 0 && isConnected) {
      markAsRead();
    }
  }, [messages.length, isConnected, markAsRead]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isReadOnly) return;

    const success = sendMessage(inputValue.trim());
    if (success) {
      setInputValue('');
      stopTyping();
    }
  }, [inputValue, isReadOnly, sendMessage, stopTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    
    // Handle typing indicator
    if (value && !isReadOnly) {
      startTyping();
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    }
  };

  const isAnnouncementsChat = chatType === 'TOURNAMENT_ANNOUNCEMENTS';
  const canSendMessage = !isReadOnly && (isAnnouncementsChat ? userRole === 'ADMIN' : true);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, GroupChatMessage[]>);

  return (
    <Card className={`flex flex-col h-[600px] ${className}`}>
      {/* Header */}
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAnnouncementsChat ? (
              <Megaphone className="w-5 h-5 text-amber-500" />
            ) : (
              <MessageCircle className="w-5 h-5 text-primary" />
            )}
            <CardTitle className="text-lg">{chatName}</CardTitle>
            {isAnnouncementsChat && (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                Announcements
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMembers(!showMembers)}
            >
              <Users className="w-4 h-4 mr-1" />
              {members.length}
            </Button>
          </div>
        </div>
      </CardHeader>

      <Separator />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Messages */}
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Error display */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
              <Button variant="ghost" size="sm" onClick={clearError}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Messages list */}
          <ScrollArea className="flex-1 p-4">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                <p>No messages yet</p>
                <p className="text-sm">Be the first to say hello!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedMessages).map(([date, msgs]) => (
                  <div key={date}>
                    <div className="flex items-center justify-center my-4">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {date}
                      </span>
                    </div>
                    {msgs.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground">
              {typingUsers.length === 1 ? (
                <span>Someone is typing...</span>
              ) : (
                <span>{typingUsers.length} people are typing...</span>
              )}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t">
            {isReadOnly ? (
              <div className="text-center text-sm text-muted-foreground">
                This chat is read-only
              </div>
            ) : !canSendMessage ? (
              <div className="text-center text-sm text-muted-foreground">
                Only admins can post announcements
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isAnnouncementsChat ? "Write an announcement..." : "Type a message..."}
                  disabled={!isConnected}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSend} 
                  disabled={!inputValue.trim() || !isConnected}
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>

        {/* Members sidebar */}
        {showMembers && (
          <>
            <Separator orientation="vertical" />
            <div className="w-48 flex-shrink-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <h4 className="font-medium mb-3 text-sm">Members ({members.length})</h4>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.user.id} className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {member.user.firstName[0]}{member.user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {member.user.firstName} {member.user.lastName}
                          </p>
                        </div>
                        {member.role === 'ADMIN' && (
                          <Crown className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

// Message bubble component
function MessageBubble({ message }: { message: GroupChatMessage }) {
  const isSystem = message.type === 'SYSTEM';
  const isAnnouncement = message.type === 'ANNOUNCEMENT';
  const initials = `${message.sender.firstName[0]}${message.sender.lastName[0]}`;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isAnnouncement ? 'bg-amber-500/10 -mx-4 px-4 py-2' : ''}`}>
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback className="text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm">
            {message.sender.firstName} {message.sender.lastName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
          {isAnnouncement && (
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
              <Megaphone className="w-3 h-3 mr-1" />
              Announcement
            </Badge>
          )}
        </div>
        <p className="text-sm text-foreground break-words">{message.content}</p>
        {message.imageUrl && (
          <img 
            src={message.imageUrl} 
            alt="Shared image" 
            className="max-w-[200px] rounded mt-2"
          />
        )}
      </div>
    </div>
  );
}

export default GroupChat;
