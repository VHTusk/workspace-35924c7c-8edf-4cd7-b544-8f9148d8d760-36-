'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Users, UserPlus, Gamepad2, MapPin, 
  Zap, Check, X, Send, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface FriendStatus {
  userId: string;
  status: string;
  venue?: string;
  courtName?: string;
  lookingForTeam: boolean;
  teamFormat?: string;
  message?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    hiddenElo?: number;
    profileImage?: string;
  };
}

interface TeamInvite {
  id: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    hiddenElo?: number;
    profileImage?: string;
  };
  tournament?: {
    id: string;
    name: string;
    startDate: Date;
    location: string;
  };
  teamName?: string;
  createdAt: string;
}

export function FriendsPlayingNow() {
  const params = useParams();
  const sport = params.sport as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [loading, setLoading] = useState(true);
  const [friendsPlaying, setFriendsPlaying] = useState<FriendStatus[]>([]);
  const [friendsLookingForTeam, setFriendsLookingForTeam] = useState<FriendStatus[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [sport]);

  const fetchData = async () => {
    try {
      const [statusRes, invitesRes] = await Promise.all([
        fetch('/api/social/friends-playing'),
        fetch('/api/social/quick-team-invite'),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setFriendsPlaying(data.friendsPlaying || []);
        setFriendsLookingForTeam(data.friendsLookingForTeam || []);
        setOnlineFriends(data.onlineFriends || []);
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setPendingInvites(data.pendingInvites || []);
      }
    } catch (error) {
      console.error('Failed to fetch social data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setProcessingInvite(inviteId);
    try {
      const res = await fetch('/api/social/quick-team-invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, action: 'accept' }),
      });

      if (res.ok) {
        setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
        fetchData();
      }
    } catch (error) {
      console.error('Failed to accept invite:', error);
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setProcessingInvite(inviteId);
    try {
      const res = await fetch('/api/social/quick-team-invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, action: 'decline' }),
      });

      if (res.ok) {
        setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
      }
    } catch (error) {
      console.error('Failed to decline invite:', error);
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleInviteFriend = async (friendId: string) => {
    try {
      const res = await fetch('/api/social/quick-team-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: friendId }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to send invite:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Friends Playing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalActive = friendsPlaying.length + onlineFriends.length;

  return (
    <div className="space-y-4">
      {/* Pending Team Invites */}
      {pendingInvites.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700">
              <UserPlus className="h-5 w-5" />
              Team Invites ({pendingInvites.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={invite.sender.profileImage} />
                    <AvatarFallback>
                      {invite.sender.firstName[0]}{invite.sender.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {invite.sender.firstName} {invite.sender.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {invite.tournament?.name || 'Looking for a doubles partner'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeclineInvite(invite.id)}
                    disabled={processingInvite === invite.id}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvite(invite.id)}
                    disabled={processingInvite === invite.id}
                  >
                    {processingInvite === invite.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Friends Looking for Team */}
      {friendsLookingForTeam.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              Looking for Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {friendsLookingForTeam.map(friend => (
              <div key={friend.userId} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={friend.user.profileImage} />
                    <AvatarFallback>
                      {friend.user.firstName[0]}{friend.user.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {friend.user.firstName} {friend.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {friend.teamFormat || 'Doubles'} • {friend.message || 'Join my team!'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleInviteFriend(friend.userId)}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Join
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Friends Currently Playing */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              Friends Playing
            </span>
            {totalActive > 0 && (
              <Badge className="bg-green-500">{totalActive} active</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {friendsPlaying.length === 0 && onlineFriends.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No friends currently playing</p>
              <p className="text-sm mt-1">Add friends to see when they're online</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Currently playing */}
              {friendsPlaying.map(friend => (
                <div key={friend.userId} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={friend.user.profileImage} />
                      <AvatarFallback>
                        {friend.user.firstName[0]}{friend.user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {friend.user.firstName} {friend.user.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {friend.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {friend.venue}
                        </span>
                      )}
                      {friend.courtName && (
                        <Badge variant="outline" className="text-xs">
                          {friend.courtName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700">Playing</Badge>
                </div>
              ))}

              {/* Online friends */}
              {onlineFriends.slice(0, 5).map(friend => (
                <div key={friend.id} className="flex items-center justify-between gap-3 p-2 hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={friend.profileImage} />
                        <AvatarFallback>
                          {friend.firstName[0]}{friend.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-400 rounded-full border-2 border-white" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {friend.firstName} {friend.lastName}
                      </p>
                      <p className="text-sm text-gray-500">Online now</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleInviteFriend(friend.id)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {onlineFriends.length > 5 && (
                <p className="text-sm text-center text-gray-500 pt-2">
                  +{onlineFriends.length - 5} more friends online
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
