"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Ticket,
  MessageSquare,
  Search,
  Loader2,
  User,
  AlertCircle,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TicketMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderRole: "user" | "admin" | "system";
  createdAt: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  userId: string;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  sport: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  messages: TicketMessage[];
}

const priorityColors = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const statusColors = {
  open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  waiting: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  resolved: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

// Mock data - initialized outside component to avoid useEffect setState issues
const initialTickets: SupportTicket[] = [
  {
    id: "1",
    subject: "Unable to register for tournament",
    description: "I'm trying to register for the State Championship but getting a payment error.",
    category: "payment",
    priority: "high",
    status: "open",
    userId: "user1",
    userName: "Rahul Sharma",
    userEmail: "rahul@example.com",
    sport: "cornhole",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    messages: [
      {
        id: "m1",
        content: "I'm trying to register for the State Championship but getting a payment error. Transaction ID: TXN123456",
        senderId: "user1",
        senderName: "Rahul Sharma",
        senderRole: "user",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "2",
    subject: "Profile verification pending for 5 days",
    description: "I submitted my ID proof for organization verification but it's still pending.",
    category: "account",
    priority: "medium",
    status: "in_progress",
    userId: "user2",
    userName: "Priya Patel",
    userEmail: "priya@example.com",
    sport: "darts",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    assignedTo: "Admin Team",
    messages: [
      {
        id: "m2",
        content: "I submitted my ID proof for organization verification but it's still pending.",
        senderId: "user2",
        senderName: "Priya Patel",
        senderRole: "user",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "m3",
        content: "We're looking into this. Your verification is in queue.",
        senderId: "admin1",
        senderName: "Support Team",
        senderRole: "admin",
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "3",
    subject: "Incorrect match result displayed",
    description: "My match result shows I lost 0-3 but I actually won 3-1.",
    category: "tournament",
    priority: "high",
    status: "waiting",
    userId: "user3",
    userName: "Amit Kumar",
    userEmail: "amit@example.com",
    sport: "cornhole",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: "Tournament Admin",
    messages: [
      {
        id: "m4",
        content: "My match result shows I lost 0-3 but I actually won 3-1. Match ID: M123",
        senderId: "user3",
        senderName: "Amit Kumar",
        senderRole: "user",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

const categoryIcons: Record<string, React.ElementType> = {
  account: User,
  payment: Ticket,
  tournament: Ticket,
  technical: AlertCircle,
  other: MessageSquare,
};

export function SupportTicketSystem() {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [replyMessage, setReplyMessage] = useState("");
  const [sending, setSending] = useState(false);

  const filteredTickets = tickets.filter(ticket => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        ticket.subject.toLowerCase().includes(query) ||
        ticket.userName.toLowerCase().includes(query) ||
        ticket.id.includes(query)
      );
    }
    if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
    if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
    return true;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    waiting: tickets.filter(t => t.status === "waiting").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
  };

  const handleStatusChange = (ticketId: string, newStatus: string) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, status: newStatus as SupportTicket["status"] } : t
    ));
    toast.success("Ticket status updated");
  };

  const handlePriorityChange = (ticketId: string, newPriority: string) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, priority: newPriority as SupportTicket["priority"] } : t
    ));
    toast.success("Ticket priority updated");
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    
    setSending(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newMessage: TicketMessage = {
      id: `m${Date.now()}`,
      content: replyMessage,
      senderId: "admin",
      senderName: "Support Team",
      senderRole: "admin",
      createdAt: new Date().toISOString(),
    };
    
    setTickets(prev => prev.map(t => 
      t.id === selectedTicket.id 
        ? { ...t, messages: [...t.messages, newMessage], updatedAt: new Date().toISOString() }
        : t
    ));
    
    setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, newMessage] } : null);
    setReplyMessage("");
    setSending(false);
    toast.success("Reply sent");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 shadow-sm cursor-pointer hover:border-green-500/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.open}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{stats.waiting}</p>
            <p className="text-xs text-muted-foreground">Waiting</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-500">{stats.resolved}</p>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
      <Card className="bg-card border-border/50 shadow-sm">
        <CardContent className="p-0">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTickets.map((ticket) => {
                const CategoryIcon = categoryIcons[ticket.category] || Ticket;
                return (
                  <div
                    key={ticket.id}
                    className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={ticket.userPhoto} />
                        <AvatarFallback>{ticket.userName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground">#{ticket.id}</span>
                          <Badge className={cn("text-xs", priorityColors[ticket.priority])}>
                            {ticket.priority}
                          </Badge>
                          <Badge className={cn("text-xs", statusColors[ticket.status])}>
                            {ticket.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{ticket.userName}</span>
                          <span>{formatDate(ticket.createdAt)}</span>
                          <span className="capitalize">{ticket.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {ticket.sport}
                        </Badge>
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{ticket.messages.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Ticket #{selectedTicket.id}
                  <Badge className={priorityColors[selectedTicket.priority]}>
                    {selectedTicket.priority}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selectedTicket.subject}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Ticket Info */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <Select
                      value={selectedTicket.status}
                      onValueChange={(v) => handleStatusChange(selectedTicket.id, v)}
                    >
                      <SelectTrigger className="w-32 h-7">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting">Waiting</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Priority: </span>
                    <Select
                      value={selectedTicket.priority}
                      onValueChange={(v) => handlePriorityChange(selectedTicket.id, v)}
                    >
                      <SelectTrigger className="w-28 h-7">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTicket.assignedTo && (
                    <div>
                      <span className="text-muted-foreground">Assigned: </span>
                      <span className="font-medium">{selectedTicket.assignedTo}</span>
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={selectedTicket.userPhoto} />
                    <AvatarFallback>{selectedTicket.userName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{selectedTicket.userName}</p>
                    <p className="text-xs text-muted-foreground">{selectedTicket.userEmail}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {selectedTicket.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "p-3 rounded-lg",
                        message.senderRole === "admin"
                          ? "bg-primary/10 ml-8"
                          : message.senderRole === "system"
                          ? "bg-muted"
                          : "bg-muted/50 mr-8"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{message.senderName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(message.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  ))}
                </div>

                {/* Reply */}
                <div className="space-y-2">
                  <Label>Reply</Label>
                  <Textarea
                    placeholder="Type your response..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                  Close
                </Button>
                <Button onClick={handleSendReply} disabled={!replyMessage.trim() || sending}>
                  {sending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Reply
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
